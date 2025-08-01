# Development Environment Configuration
# Terraform variables for dev environment

# Project configuration
project_id  = "your-project-id"
region      = "us-central1"
zone        = "us-central1-a"
environment = "dev"

# Network configuration
subnet_cidr   = "10.0.0.0/24"
pods_cidr     = "10.1.0.0/16"
services_cidr = "10.2.0.0/16"

# Database configuration (smaller for dev)
db_tier           = "db-custom-1-2048"  # 1 vCPU, 2GB RAM
db_disk_size      = 20
db_max_disk_size  = 50
db_user           = "n8n_dev_user"
# db_password should be set via environment variable or secret

# GKE configuration (cost-optimized for dev)
gke_cluster_name        = "electrical-estimation-dev"
gke_initial_node_count  = 1
gke_min_node_count      = 1
gke_max_node_count      = 3
gke_machine_type        = "e2-standard-2"
gke_disk_size_gb        = 30
enable_preemptible_nodes = true  # Enable for cost savings in dev

# N8N configuration
n8n_auth_user = "admin"
# n8n_auth_password should be set via environment variable
# n8n_encryption_key should be set via environment variable
domain_name = "dev.electrical-estimation.example.com"

# Cloud Run configuration (smaller for dev)
cloud_run_memory        = "1Gi"
cloud_run_cpu          = "1"
cloud_run_concurrency  = 40
cloud_run_min_instances = 0
cloud_run_max_instances = 5

# BigQuery configuration
bq_location                      = "US"
bq_delete_contents_on_destroy    = true  # Allow deletion in dev

# Monitoring configuration
notification_email   = "dev-alerts@yourcompany.com"
enable_monitoring    = true

# Cost optimization
enable_cost_optimization = true

# Labels
labels = {
  project     = "electrical-estimation"
  environment = "dev"
  team        = "electrical-engineering"
  managed_by  = "terraform"
  cost_center = "engineering"
}