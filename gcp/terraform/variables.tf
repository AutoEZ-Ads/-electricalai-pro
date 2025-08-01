# Variables for GCP Electrical Estimation System

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Network configuration
variable "subnet_cidr" {
  description = "CIDR block for the subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "pods_cidr" {
  description = "CIDR block for GKE pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "CIDR block for GKE services"
  type        = string
  default     = "10.2.0.0/16"
}

# Database configuration
variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-custom-2-4096"
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 20
}

variable "db_max_disk_size" {
  description = "Maximum Cloud SQL disk size for auto-resize in GB"
  type        = number
  default     = 100
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "n8n_user"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# GKE configuration
variable "gke_cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "electrical-estimation-cluster"
}

variable "gke_initial_node_count" {
  description = "Initial number of nodes in the GKE cluster"
  type        = number
  default     = 1
}

variable "gke_min_node_count" {
  description = "Minimum number of nodes in the GKE cluster"
  type        = number
  default     = 1
}

variable "gke_max_node_count" {
  description = "Maximum number of nodes in the GKE cluster"
  type        = number
  default     = 10
}

variable "gke_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-standard-2"
}

variable "gke_disk_size_gb" {
  description = "Disk size for GKE nodes in GB"
  type        = number
  default     = 50
}

variable "gke_disk_type" {
  description = "Disk type for GKE nodes"
  type        = string
  default     = "pd-ssd"
}

variable "enable_preemptible_nodes" {
  description = "Enable preemptible nodes for cost optimization"
  type        = bool
  default     = false
}

# N8N configuration
variable "n8n_auth_user" {
  description = "N8N basic auth username"
  type        = string
  default     = "admin"
}

variable "n8n_auth_password" {
  description = "N8N basic auth password"
  type        = string
  sensitive   = true
}

variable "n8n_encryption_key" {
  description = "N8N encryption key for sensitive data"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for the electrical estimation system"
  type        = string
  default     = "electrical-estimation.example.com"
}

# Cloud Run configuration
variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run services"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run services"
  type        = string
  default     = "2"
}

variable "cloud_run_concurrency" {
  description = "Maximum concurrent requests per Cloud Run instance"
  type        = number
  default     = 80
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 100
}

# BigQuery configuration
variable "bq_location" {
  description = "BigQuery dataset location"
  type        = string
  default     = "US"
}

variable "bq_delete_contents_on_destroy" {
  description = "Delete BigQuery dataset contents on destroy"
  type        = bool
  default     = false
}

# Monitoring and alerting
variable "notification_email" {
  description = "Email for monitoring notifications"
  type        = string
  default     = ""
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

# Cost optimization
variable "enable_cost_optimization" {
  description = "Enable cost optimization features like preemptible instances"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default = {
    project     = "electrical-estimation"
    managed_by  = "terraform"
  }
}