# GKE Autopilot cluster for electrical estimation system
# This configuration creates a production-ready GKE Autopilot cluster

# GKE Autopilot cluster
resource "google_container_cluster" "autopilot" {
  name     = var.gke_cluster_name
  location = var.region

  # Autopilot mode - fully managed Kubernetes
  enable_autopilot = true

  # Network configuration
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # IP allocation policy for secondary ranges
  ip_allocation_policy {
    cluster_secondary_range_name  = local.secondary_ranges.pods
    services_secondary_range_name = local.secondary_ranges.services
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Master authorized networks
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  }

  # Network policy
  network_policy {
    enabled = true
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Cluster features
  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    network_policy_config {
      disabled = false
    }

    gcp_filestore_csi_driver_config {
      enabled = true
    }

    gcs_fuse_csi_driver_config {
      enabled = true
    }
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Shielded nodes
  node_config {
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  # Maintenance policy
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T09:00:00Z"
      end_time   = "2023-01-01T17:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }

  # Resource labels
  resource_labels = merge(local.common_labels, {
    cluster_type = "autopilot"
  })

  # Logging and monitoring
  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "API_SERVER"
    ]
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "API_SERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER"
    ]

    managed_prometheus {
      enabled = true
    }
  }

  # Notification configuration
  notification_config {
    pubsub {
      enabled = true
      topic   = google_pubsub_topic.gke_notifications.id
    }
  }

  # Cluster autoscaling
  cluster_autoscaling {
    enabled = true
    
    auto_provisioning_defaults {
      service_account = google_service_account.gke_nodes.email
      oauth_scopes = [
        "https://www.googleapis.com/auth/cloud-platform"
      ]

      management {
        auto_repair  = true
        auto_upgrade = true
      }

      shielded_instance_config {
        enable_secure_boot          = true
        enable_integrity_monitoring = true
      }
    }
  }

  # Security configuration
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  depends_on = [
    google_compute_subnetwork.subnet,
    google_project_service.required_apis
  ]
}

# Pub/Sub topic for GKE notifications
resource "google_pubsub_topic" "gke_notifications" {
  name = "${local.name_prefix}-gke-notifications"

  labels = local.common_labels
}

# Kubernetes service account for n8n
resource "kubernetes_service_account" "n8n" {
  metadata {
    name      = "n8n"
    namespace = "default"
    
    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.n8n_service.email
    }

    labels = local.common_labels
  }

  depends_on = [google_container_cluster.autopilot]
}

# IAM binding for Workload Identity
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.n8n_service.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[default/n8n]"
  ]
}

# Namespace for electrical estimation system
resource "kubernetes_namespace" "electrical_system" {
  metadata {
    name = "electrical-estimation"

    labels = merge(local.common_labels, {
      "istio-injection" = "enabled"
    })
  }

  depends_on = [google_container_cluster.autopilot]
}

# ConfigMap for n8n configuration
resource "kubernetes_config_map" "n8n_config" {
  metadata {
    name      = "n8n-config"
    namespace = kubernetes_namespace.electrical_system.metadata[0].name

    labels = local.common_labels
  }

  data = {
    "N8N_HOST"                     = var.domain_name
    "N8N_PROTOCOL"                 = "https"
    "N8N_EDITOR_BASE_URL"         = "https://${var.domain_name}/"
    "WEBHOOK_URL"                 = "https://${var.domain_name}/webhook/"
    "N8N_METRICS"                 = "true"
    "N8N_DISABLE_PRODUCTION_MAIN_PROCESS" = "true"
    "EXECUTIONS_PROCESS"          = "main"
    "EXECUTIONS_MODE"             = "regular"
    "N8N_LOG_LEVEL"               = var.environment == "prod" ? "info" : "debug"
    "N8N_LOG_OUTPUT"              = "console"
    "GENERIC_TIMEZONE"            = "America/New_York"
    "N8N_DEFAULT_LOCALE"          = "en"
    "N8N_PERSONALIZATION_ENABLED" = "false"
    "N8N_VERSION_NOTIFICATIONS_ENABLED" = "false"
    "N8N_DIAGNOSTICS_ENABLED"     = "false"
    "N8N_HIRING_BANNER_ENABLED"   = "false"
    "DB_TYPE"                     = "postgresdb"
    "DB_POSTGRESDB_HOST"          = google_sql_database_instance.main.private_ip_address
    "DB_POSTGRESDB_PORT"          = "5432"
    "DB_POSTGRESDB_DATABASE"      = google_sql_database.electrical_estimation.name
    "DB_POSTGRESDB_USER"          = google_sql_user.n8n_user.name
    "DB_POSTGRESDB_SSL_ENABLED"   = "true"
    "DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED" = "false"
  }

  depends_on = [google_container_cluster.autopilot]
}

# Secret for sensitive n8n configuration
resource "kubernetes_secret" "n8n_secrets" {
  metadata {
    name      = "n8n-secrets"
    namespace = kubernetes_namespace.electrical_system.metadata[0].name

    labels = local.common_labels
  }

  type = "Opaque"

  data = {
    "N8N_BASIC_AUTH_ACTIVE"   = "true"
    "N8N_BASIC_AUTH_USER"     = base64encode(var.n8n_auth_user)
    "N8N_BASIC_AUTH_PASSWORD" = base64encode(var.n8n_auth_password)
    "N8N_ENCRYPTION_KEY"      = base64encode(var.n8n_encryption_key)
    "DB_POSTGRESDB_PASSWORD"  = base64encode(var.db_password)
  }

  depends_on = [google_container_cluster.autopilot]
}

# Persistent Volume Claim for n8n data
resource "kubernetes_persistent_volume_claim" "n8n_data" {
  metadata {
    name      = "n8n-data"
    namespace = kubernetes_namespace.electrical_system.metadata[0].name

    labels = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = "10Gi"
      }
    }

    storage_class_name = "premium-rwo"
  }

  depends_on = [google_container_cluster.autopilot]
}