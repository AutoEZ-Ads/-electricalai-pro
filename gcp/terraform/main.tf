# GCP Electrical Estimation System Infrastructure
# Main Terraform configuration for production-ready deployment

terraform {
  required_version = ">= 1.5.7"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  # Remote state configuration - update with your GCS bucket
  backend "gcs" {
    bucket = "electrical-estimation-tf-state"
    prefix = "terraform/state"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Local values for common resource naming
locals {
  name_prefix = "electrical-est"
  common_labels = {
    project     = "electrical-estimation-system"
    environment = var.environment
    managed_by  = "terraform"
    team        = "electrical-engineering"
  }
  
  # Network configuration
  network_name    = "${local.name_prefix}-vpc"
  subnet_name     = "${local.name_prefix}-subnet"
  secondary_ranges = {
    pods     = "${local.name_prefix}-pods"
    services = "${local.name_prefix}-services"
  }
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "bigquery.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "servicenetworking.googleapis.com"
  ])

  service = each.value
  project = var.project_id

  disable_dependent_services = true
  disable_on_destroy         = false
}

# VPC Network for electrical estimation system
resource "google_compute_network" "vpc" {
  name                    = local.network_name
  auto_create_subnetworks = false
  mtu                     = 1460
  
  depends_on = [google_project_service.required_apis]
}

# Subnet for GKE cluster and Cloud SQL
resource "google_compute_subnetwork" "subnet" {
  name          = local.subnet_name
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id

  # Secondary IP ranges for GKE pods and services
  secondary_ip_range {
    range_name    = local.secondary_ranges.pods
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = local.secondary_ranges.services
    ip_cidr_range = var.services_cidr
  }

  # Enable private Google access for internal services
  private_ip_google_access = true
}

# Cloud Router for NAT Gateway
resource "google_compute_router" "router" {
  name    = "${local.name_prefix}-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

# Cloud NAT for outbound internet access
resource "google_compute_router_nat" "nat" {
  name   = "${local.name_prefix}-nat"
  router = google_compute_router.router.name
  region = var.region

  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "icmp"
  }

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  source_ranges = [var.subnet_cidr, var.pods_cidr, var.services_cidr]
  direction     = "INGRESS"
  priority      = 1000
}

# Service account for GKE nodes
resource "google_service_account" "gke_nodes" {
  account_id   = "${local.name_prefix}-gke-nodes"
  display_name = "Electrical Estimation GKE Nodes"
  description  = "Service account for GKE cluster nodes"
}

# IAM bindings for GKE service account
resource "google_project_iam_member" "gke_node_service_account" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.objectViewer"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Service account for n8n application
resource "google_service_account" "n8n_service" {
  account_id   = "${local.name_prefix}-n8n"
  display_name = "N8N Electrical Estimation Service"
  description  = "Service account for N8N workflows and electrical calculations"
}

# IAM bindings for N8N service account
resource "google_project_iam_member" "n8n_service_account" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/monitoring.metricWriter"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.n8n_service.email}"
}

# Private service connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${local.name_prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]

  depends_on = [google_project_service.required_apis]
}

# Cloud SQL instance for electrical estimation data
resource "google_sql_database_instance" "main" {
  name                = "${local.name_prefix}-db-${random_string.db_suffix.result}"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = var.environment == "prod" ? true : false

  settings {
    tier                        = var.db_tier
    availability_type           = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type                   = "PD_SSD"
    disk_size                   = var.db_disk_size
    disk_autoresize             = true
    disk_autoresize_limit       = var.db_max_disk_size

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_statement"
      value = "ddl"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    maintenance_window {
      day          = 7
      hour         = 2
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.required_apis
  ]
}

# Database user for n8n
resource "google_sql_user" "n8n_user" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# Main database for electrical estimation
resource "google_sql_database" "electrical_estimation" {
  name     = "electrical_estimation"
  instance = google_sql_database_instance.main.name
  charset  = "UTF8"
  collation = "en_US.UTF8"
}

# Random string for unique resource naming
resource "random_string" "db_suffix" {
  length  = 8
  special = false
  upper   = false
}

# BigQuery dataset for electrical estimation analytics
resource "google_bigquery_dataset" "electrical_analytics" {
  dataset_id  = "electrical_estimation_analytics"
  description = "Analytics dataset for electrical estimation system"
  location    = var.region

  labels = local.common_labels

  access {
    role          = "OWNER"
    user_by_email = google_service_account.n8n_service.email
  }

  access {
    role           = "READER"
    special_group  = "projectReaders"
  }

  access {
    role           = "WRITER"
    special_group  = "projectWriters"
  }

  depends_on = [google_project_service.required_apis]
}

# BigQuery tables for electrical data
resource "google_bigquery_table" "project_analytics" {
  dataset_id = google_bigquery_dataset.electrical_analytics.dataset_id
  table_id   = "project_analytics"

  labels = local.common_labels

  time_partitioning {
    type  = "DAY"
    field = "created_date"
  }

  clustering = ["building_type", "project_status"]

  schema = jsonencode([
    {
      name = "project_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "project_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "building_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "square_footage"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "total_cost"
      type = "NUMERIC"
      mode = "NULLABLE"
    },
    {
      name = "material_cost"
      type = "NUMERIC"
      mode = "NULLABLE"
    },
    {
      name = "labor_cost"
      type = "NUMERIC"
      mode = "NULLABLE"
    },
    {
      name = "confidence_score"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "project_status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "created_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "completed_date"
      type = "DATE"
      mode = "NULLABLE"
    }
  ])
}

# Secret Manager secrets
resource "google_secret_manager_secret" "db_connection" {
  secret_id = "${local.name_prefix}-db-connection"

  labels = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_connection" {
  secret = google_secret_manager_secret.db_connection.id
  secret_data = jsonencode({
    host     = google_sql_database_instance.main.private_ip_address
    database = google_sql_database.electrical_estimation.name
    username = google_sql_user.n8n_user.name
    password = var.db_password
    port     = 5432
  })
}

# N8N configuration secret
resource "google_secret_manager_secret" "n8n_config" {
  secret_id = "${local.name_prefix}-n8n-config"

  labels = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "n8n_config" {
  secret = google_secret_manager_secret.n8n_config.id
  secret_data = jsonencode({
    n8n_basic_auth_user     = var.n8n_auth_user
    n8n_basic_auth_password = var.n8n_auth_password
    n8n_encryption_key      = var.n8n_encryption_key
    webhook_url             = "https://${var.domain_name}/webhook"
  })
}

# Storage bucket for electrical documents and reports
resource "google_storage_bucket" "electrical_documents" {
  name     = "${local.name_prefix}-documents-${random_string.bucket_suffix.result}"
  location = var.region

  labels = local.common_labels

  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# IAM binding for storage bucket
resource "google_storage_bucket_iam_member" "n8n_storage_admin" {
  bucket = google_storage_bucket.electrical_documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.n8n_service.email}"
}