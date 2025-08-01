# Monitoring and Alerting Configuration for Electrical Estimation System
# Cloud Operations (Stackdriver) monitoring setup

# Notification channel for alerts
resource "google_monitoring_notification_channel" "email" {
  count        = var.notification_email != "" ? 1 : 0
  display_name = "Electrical Estimation Email Alerts"
  type         = "email"
  
  labels = {
    email_address = var.notification_email
  }

  enabled = true
}

# Uptime check for n8n service
resource "google_monitoring_uptime_check_config" "n8n_uptime" {
  display_name = "N8N Electrical Estimation Uptime Check"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/healthz"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain_name
    }
  }

  content_matchers {
    content = "ok"
    matcher = "CONTAINS_STRING"
  }

  checker_type = "STATIC_IP_CHECKERS"
}

# Uptime check for backend API
resource "google_monitoring_uptime_check_config" "api_uptime" {
  display_name = "Backend API Uptime Check"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain_name
    }
  }

  content_matchers {
    content = "healthy"
    matcher = "CONTAINS_STRING"
  }

  checker_type = "STATIC_IP_CHECKERS"
}

# Alert policy for uptime failures
resource "google_monitoring_alert_policy" "uptime_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "Electrical Estimation System Down"
  
  documentation {
    content   = "The electrical estimation system is experiencing downtime. Check the GKE cluster and Cloud Run services."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Uptime check failure"
    
    condition_threshold {
      filter          = "resource.type=\"uptime_url\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for high error rate
resource "google_monitoring_alert_policy" "error_rate_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "High Error Rate - Electrical Estimation"
  
  documentation {
    content   = "The electrical estimation system is experiencing a high error rate (>5% in 5 minutes)."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "High error rate"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"k8s_container\"",
        "resource.labels.cluster_name=\"${var.gke_cluster_name}\"",
        "resource.labels.namespace_name=\"electrical-estimation\""
      ])
      
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05  # 5% error rate
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.container_name"]
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Alert policy for high CPU usage
resource "google_monitoring_alert_policy" "cpu_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "High CPU Usage - GKE Cluster"
  
  documentation {
    content   = "GKE cluster CPU usage is above 80% for 10 minutes."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "High CPU usage"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"k8s_node\"",
        "resource.labels.cluster_name=\"${var.gke_cluster_name}\"",
        "metric.type=\"kubernetes.io/node/cpu/allocatable_utilization\""
      ])
      
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8  # 80% CPU usage
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Alert policy for high memory usage
resource "google_monitoring_alert_policy" "memory_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "High Memory Usage - GKE Cluster"
  
  documentation {
    content   = "GKE cluster memory usage is above 85% for 10 minutes."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "High memory usage"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"k8s_node\"",
        "resource.labels.cluster_name=\"${var.gke_cluster_name}\"",
        "metric.type=\"kubernetes.io/node/memory/allocatable_utilization\""
      ])
      
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85  # 85% memory usage
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Alert policy for database connection issues
resource "google_monitoring_alert_policy" "database_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "Database Connection Issues"
  
  documentation {
    content   = "Cloud SQL database is experiencing connection issues or high error rates."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Database connection errors"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloudsql_database\"",
        "resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\"",
        "metric.type=\"cloudsql.googleapis.com/database/network/connections\""
      ])
      
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1  # Less than 1 connection
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Alert policy for BigQuery job failures
resource "google_monitoring_alert_policy" "bigquery_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "BigQuery Job Failures"
  
  documentation {
    content   = "BigQuery jobs for electrical estimation analytics are failing."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "BigQuery job failures"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"bigquery_project\"",
        "metric.type=\"bigquery.googleapis.com/job/num_failed\""
      ])
      
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5  # More than 5 failed jobs
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Custom metrics for electrical estimation workflows
resource "google_logging_metric" "estimation_completion_time" {
  name   = "electrical_estimation_completion_time"
  filter = join(" AND ", [
    "resource.type=\"k8s_container\"",
    "resource.labels.namespace_name=\"electrical-estimation\"",
    "jsonPayload.event_type=\"estimation_completed\""
  ])

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DOUBLE"
    display_name = "Electrical Estimation Completion Time"
  }

  value_extractor = "EXTRACT(jsonPayload.completion_time_seconds)"

  label_extractors = {
    "building_type" = "EXTRACT(jsonPayload.building_type)"
    "project_size"  = "EXTRACT(jsonPayload.project_size)"
  }
}

# Custom metric for estimation accuracy
resource "google_logging_metric" "estimation_accuracy" {
  name   = "electrical_estimation_accuracy"
  filter = join(" AND ", [
    "resource.type=\"k8s_container\"",
    "resource.labels.namespace_name=\"electrical-estimation\"",
    "jsonPayload.event_type=\"estimation_validated\""
  ])

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DOUBLE"
    display_name = "Electrical Estimation Accuracy"
  }

  value_extractor = "EXTRACT(jsonPayload.accuracy_percentage)"

  label_extractors = {
    "estimation_type" = "EXTRACT(jsonPayload.estimation_type)"
    "building_type"   = "EXTRACT(jsonPayload.building_type)"
  }
}

# Log-based alert for application errors
resource "google_monitoring_alert_policy" "application_error_alert" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "Application Error Spike"
  
  documentation {
    content   = "Electrical estimation application is experiencing error spikes."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Application error rate"
    
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"k8s_container\"",
        "resource.labels.namespace_name=\"electrical-estimation\"",
        "severity=\"ERROR\""
      ])
      
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10  # More than 10 errors in 5 minutes
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  combiner = "OR"
  enabled  = true

  dynamic "notification_channels" {
    for_each = google_monitoring_notification_channel.email
    content {
      notification_channels = [notification_channels.value.id]
    }
  }
}

# Dashboard for electrical estimation metrics
resource "google_monitoring_dashboard" "electrical_estimation_dashboard" {
  dashboard_json = jsonencode({
    displayName = "Electrical Estimation System Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "N8N Workflow Executions"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"electrical-estimation\" AND resource.labels.container_name=\"n8n\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = {
                label = "Executions per second"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          widget = {
            title = "API Response Times"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"electrical-estimation\" AND resource.labels.container_name=\"backend-api\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
              }]
              yAxis = {
                label = "Response time (ms)"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 12
          height = 4
          yPos   = 4
          widget = {
            title = "Estimation Completion Times by Building Type"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/electrical_estimation_completion_time\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_MEAN"
                      groupByFields      = ["metric.label.building_type"]
                    }
                  }
                }
              }]
              yAxis = {
                label = "Completion time (seconds)"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })
}

# SLO for API availability
resource "google_monitoring_slo" "api_availability" {
  service      = "electrical-estimation-api"
  display_name = "API Availability SLO"
  
  goal                = 0.995  # 99.5% availability
  calendar_period     = "MONTH"
  
  availability_slo_config {
    method = "REQUEST_BASED"
    
    request_based_sli {
      good_total_ratio {
        total_service_filter = join(" AND ", [
          "resource.type=\"k8s_container\"",
          "resource.labels.namespace_name=\"electrical-estimation\"",
          "resource.labels.container_name=\"backend-api\""
        ])
        
        good_service_filter = join(" AND ", [
          "resource.type=\"k8s_container\"",
          "resource.labels.namespace_name=\"electrical-estimation\"",
          "resource.labels.container_name=\"backend-api\"",
          "protoPayload.response.status<500"
        ])
      }
    }
  }
}