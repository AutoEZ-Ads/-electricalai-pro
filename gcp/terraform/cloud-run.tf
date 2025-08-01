# Cloud Run services for variable workload components
# This configuration creates Cloud Run services for electrical calculation microservices

# Cloud Run service for electrical calculator
resource "google_cloud_run_v2_service" "electrical_calculator" {
  name     = "${local.name_prefix}-calculator"
  location = var.region
  
  labels = local.common_labels

  template {
    labels = local.common_labels
    
    service_account = google_service_account.n8n_service.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "gcr.io/${var.project_id}/electrical-calculator:latest"
      
      ports {
        container_port = 3002
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        timeout_seconds      = 5
        period_seconds       = 10
        failure_threshold    = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 30
        timeout_seconds      = 5
        period_seconds       = 30
        failure_threshold    = 3
      }

      volume_mounts {
        name       = "secrets"
        mount_path = "/etc/secrets"
      }
    }

    volumes {
      name = "secrets"
      secret {
        secret = google_secret_manager_secret.n8n_config.secret_id
      }
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.required_apis,
    google_vpc_access_connector.connector
  ]
}

# Cloud Run service for material database
resource "google_cloud_run_v2_service" "material_database" {
  name     = "${local.name_prefix}-materials"
  location = var.region
  
  labels = local.common_labels

  template {
    labels = local.common_labels
    
    service_account = google_service_account.n8n_service.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "gcr.io/${var.project_id}/material-database:latest"
      
      ports {
        container_port = 3003
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "BIGQUERY_DATASET"
        value = google_bigquery_dataset.electrical_analytics.dataset_id
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        timeout_seconds      = 5
        period_seconds       = 10
        failure_threshold    = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 30
        timeout_seconds      = 5
        period_seconds       = 30
        failure_threshold    = 3
      }
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.required_apis,
    google_vpc_access_connector.connector
  ]
}

# Cloud Run service for report generator
resource "google_cloud_run_v2_service" "report_generator" {
  name     = "${local.name_prefix}-reports"
  location = var.region
  
  labels = local.common_labels

  template {
    labels = local.common_labels
    
    service_account = google_service_account.n8n_service.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "gcr.io/${var.project_id}/report-generator:latest"
      
      ports {
        container_port = 3004
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.electrical_documents.name
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 15
        timeout_seconds      = 10
        period_seconds       = 10
        failure_threshold    = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 30
        timeout_seconds      = 10
        period_seconds       = 30
        failure_threshold    = 3
      }

      volume_mounts {
        name       = "reports"
        mount_path = "/app/reports"
      }
    }

    volumes {
      name = "reports"
      gcs {
        bucket = google_storage_bucket.electrical_documents.name
      }
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.required_apis,
    google_vpc_access_connector.connector
  ]
}

# VPC Access Connector for Cloud Run services
resource "google_vpc_access_connector" "connector" {
  name          = "${local.name_prefix}-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  
  min_instances = 2
  max_instances = 10

  depends_on = [google_project_service.required_apis]
}

# Redis instance for caching
resource "google_redis_instance" "cache" {
  name           = "${local.name_prefix}-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region

  location_id             = var.zone
  alternative_location_id = "${substr(var.region, 0, length(var.region)-1)}b"

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = "REDIS_7_0"
  display_name      = "Electrical Estimation Cache"
  
  labels = local.common_labels

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection
  ]
}

# IAM policy for Cloud Run services
resource "google_cloud_run_service_iam_member" "calculator_invoker" {
  location = google_cloud_run_v2_service.electrical_calculator.location
  project  = google_cloud_run_v2_service.electrical_calculator.project
  service  = google_cloud_run_v2_service.electrical_calculator.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.n8n_service.email}"
}

resource "google_cloud_run_service_iam_member" "materials_invoker" {
  location = google_cloud_run_v2_service.material_database.location
  project  = google_cloud_run_v2_service.material_database.project
  service  = google_cloud_run_v2_service.material_database.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.n8n_service.email}"
}

resource "google_cloud_run_service_iam_member" "reports_invoker" {
  location = google_cloud_run_v2_service.report_generator.location
  project  = google_cloud_run_v2_service.report_generator.project
  service  = google_cloud_run_v2_service.report_generator.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.n8n_service.email}"
}

# Load balancer for Cloud Run services
resource "google_compute_global_address" "lb_ip" {
  name         = "${local.name_prefix}-lb-ip"
  ip_version   = "IPV4"
  address_type = "EXTERNAL"
}

resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  name = "${local.name_prefix}-ssl-cert"

  managed {
    domains = [var.domain_name]
  }
}

# Network Endpoint Groups for Cloud Run services
resource "google_compute_region_network_endpoint_group" "calculator_neg" {
  name                  = "${local.name_prefix}-calculator-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.electrical_calculator.name
  }
}

resource "google_compute_region_network_endpoint_group" "materials_neg" {
  name                  = "${local.name_prefix}-materials-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.material_database.name
  }
}

resource "google_compute_region_network_endpoint_group" "reports_neg" {
  name                  = "${local.name_prefix}-reports-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.report_generator.name
  }
}