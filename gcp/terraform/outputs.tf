# Outputs for GCP Electrical Estimation System

# Network outputs
output "vpc_network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.vpc.name
}

output "subnet_name" {
  description = "Name of the subnet"
  value       = google_compute_subnetwork.subnet.name
}

output "subnet_cidr" {
  description = "CIDR block of the subnet"
  value       = google_compute_subnetwork.subnet.ip_cidr_range
}

# GKE cluster outputs
output "gke_cluster_name" {
  description = "Name of the GKE cluster"
  value       = google_container_cluster.autopilot.name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.autopilot.endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = google_container_cluster.autopilot.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "gke_cluster_location" {
  description = "GKE cluster location"
  value       = google_container_cluster.autopilot.location
}

# Database outputs
output "database_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.name
}

output "database_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "database_connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = google_sql_database_instance.main.connection_name
}

output "database_name" {
  description = "Name of the main database"
  value       = google_sql_database.electrical_estimation.name
}

# Service account outputs
output "gke_service_account_email" {
  description = "Email of the GKE nodes service account"
  value       = google_service_account.gke_nodes.email
}

output "n8n_service_account_email" {
  description = "Email of the N8N service account"
  value       = google_service_account.n8n_service.email
}

# Cloud Run outputs
output "electrical_calculator_url" {
  description = "URL of the electrical calculator Cloud Run service"
  value       = google_cloud_run_v2_service.electrical_calculator.uri
}

output "material_database_url" {
  description = "URL of the material database Cloud Run service"
  value       = google_cloud_run_v2_service.material_database.uri
}

output "report_generator_url" {
  description = "URL of the report generator Cloud Run service"
  value       = google_cloud_run_v2_service.report_generator.uri
}

# Storage outputs
output "documents_bucket_name" {
  description = "Name of the electrical documents storage bucket"
  value       = google_storage_bucket.electrical_documents.name
}

output "documents_bucket_url" {
  description = "URL of the electrical documents storage bucket"
  value       = google_storage_bucket.electrical_documents.url
}

# BigQuery outputs
output "bigquery_dataset_id" {
  description = "ID of the BigQuery dataset for electrical analytics"
  value       = google_bigquery_dataset.electrical_analytics.dataset_id
}

output "bigquery_dataset_location" {
  description = "Location of the BigQuery dataset"
  value       = google_bigquery_dataset.electrical_analytics.location
}

output "project_analytics_table_id" {
  description = "ID of the project analytics BigQuery table"
  value       = google_bigquery_table.project_analytics.table_id
}

# Redis outputs
output "redis_host" {
  description = "Host of the Redis instance"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "redis_port" {
  description = "Port of the Redis instance"
  value       = google_redis_instance.cache.port
}

output "redis_memory_size" {
  description = "Memory size of the Redis instance in GB"
  value       = google_redis_instance.cache.memory_size_gb
}

# Secret Manager outputs
output "db_connection_secret_id" {
  description = "Secret Manager secret ID for database connection"
  value       = google_secret_manager_secret.db_connection.secret_id
}

output "n8n_config_secret_id" {
  description = "Secret Manager secret ID for N8N configuration"
  value       = google_secret_manager_secret.n8n_config.secret_id
}

# Load balancer outputs
output "load_balancer_ip" {
  description = "External IP address of the load balancer"
  value       = google_compute_global_address.lb_ip.address
}

output "ssl_certificate_name" {
  description = "Name of the managed SSL certificate"
  value       = google_compute_managed_ssl_certificate.ssl_cert.name
}

# VPC Access outputs
output "vpc_connector_name" {
  description = "Name of the VPC Access connector"
  value       = google_vpc_access_connector.connector.name
}

# Monitoring outputs
output "uptime_check_n8n_id" {
  description = "ID of the N8N uptime check"
  value       = google_monitoring_uptime_check_config.n8n_uptime.uptime_check_id
}

output "uptime_check_api_id" {
  description = "ID of the API uptime check"
  value       = google_monitoring_uptime_check_config.api_uptime.uptime_check_id
}

output "notification_channel_email" {
  description = "Email notification channel for monitoring alerts"
  value       = var.notification_email != "" ? google_monitoring_notification_channel.email[0].name : null
}

# Project information
output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "zone" {
  description = "GCP Zone"
  value       = var.zone
}

# Environment information
output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "domain_name" {
  description = "Domain name for the electrical estimation system"
  value       = var.domain_name
}

# Cost optimization information
output "preemptible_nodes_enabled" {
  description = "Whether preemptible nodes are enabled for cost optimization"
  value       = var.enable_preemptible_nodes
}

output "cost_optimization_enabled" {
  description = "Whether cost optimization features are enabled"
  value       = var.enable_cost_optimization
}

# Kubernetes connection command
output "gke_connect_command" {
  description = "Command to connect to the GKE cluster"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.autopilot.name} --region=${google_container_cluster.autopilot.location} --project=${var.project_id}"
}

# Application URLs
output "application_urls" {
  description = "URLs for accessing the electrical estimation system"
  value = {
    main_application = "https://${var.domain_name}"
    n8n_interface   = "https://${var.domain_name}"
    api_endpoint    = "https://${var.domain_name}/api"
    health_check    = "https://${var.domain_name}/health"
    webhooks        = "https://${var.domain_name}/webhook"
  }
}

# Database connection information
output "database_connection_info" {
  description = "Database connection information"
  value = {
    host     = google_sql_database_instance.main.private_ip_address
    port     = 5432
    database = google_sql_database.electrical_estimation.name
    username = google_sql_user.n8n_user.name
  }
  sensitive = true
}

# Deployment verification
output "deployment_verification" {
  description = "Commands for verifying the deployment"
  value = {
    check_cluster_status = "kubectl get nodes"
    check_pods_status   = "kubectl get pods -n electrical-estimation"
    check_services      = "kubectl get services -n electrical-estimation"
    check_ingress       = "kubectl get ingress -n electrical-estimation"
    view_logs_n8n      = "kubectl logs -n electrical-estimation -l app=n8n -f"
    view_logs_api      = "kubectl logs -n electrical-estimation -l app=backend-api -f"
  }
}

# Resource labels
output "common_labels" {
  description = "Common labels applied to all resources"
  value       = local.common_labels
}