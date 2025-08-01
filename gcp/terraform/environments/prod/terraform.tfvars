# Production Environment Configuration
# Terraform variables for production environment

# Project configuration
project_id  = "your-prod-project-id"
region      = "us-central1"
zone        = "us-central1-a"
environment = "prod"

# Network configuration
subnet_cidr   = "10.10.0.0/24"
pods_cidr     = "10.11.0.0/16"
services_cidr = "10.12.0.0/16"

# Database configuration (production-ready)
db_tier           = "db-custom-4-8192"  # 4 vCPU, 8GB RAM
db_disk_size      = 100
db_max_disk_size  = 500
db_user           = "n8n_prod_user"
# db_password should be set via environment variable or secret

# GKE configuration (production settings)
gke_cluster_name        = "electrical-estimation-prod"
gke_initial_node_count  = 3
gke_min_node_count      = 3
gke_max_node_count      = 20
gke_machine_type        = "e2-standard-4"
gke_disk_size_gb        = 100
enable_preemptible_nodes = false  # Disable for production reliability

# N8N configuration
n8n_auth_user = "admin"
# n8n_auth_password should be set via environment variable
# n8n_encryption_key should be set via environment variable
domain_name = "electrical-estimation.yourcompany.com"

# Cloud Run configuration (production-ready)
cloud_run_memory        = "2Gi"
cloud_run_cpu          = "2"
cloud_run_concurrency  = 80
cloud_run_min_instances = 1
cloud_run_max_instances = 100

# BigQuery configuration
bq_location                      = "US"
bq_delete_contents_on_destroy    = false  # Protect production data

# Monitoring configuration
notification_email   = "prod-alerts@yourcompany.com"
enable_monitoring    = true

# Cost optimization (disabled for production reliability)
enable_cost_optimization = false

# Labels
labels = {
  project     = "electrical-estimation"
  environment = "prod"
  team        = "electrical-engineering"
  managed_by  = "terraform"
  cost_center = "production"
  compliance  = "required"
}