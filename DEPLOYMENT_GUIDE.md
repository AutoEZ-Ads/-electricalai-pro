# Electrical Estimation System - GCP Deployment Guide

This guide provides step-by-step instructions for deploying the comprehensive electrical estimation system to Google Cloud Platform using the provided Terraform infrastructure.

## Prerequisites

Before deployment, ensure you have:
- Google Cloud SDK installed and configured
- Terraform v1.0+ installed
- kubectl installed
- Docker installed (for local testing)
- A GCP project with billing enabled

## Required GCP APIs

Enable the following APIs in your GCP project:
```bash
gcloud services enable compute.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable vpcaccess.googleapis.com
```

## Deployment Steps

### 1. Configuration Setup

Navigate to the appropriate environment directory:
```bash
cd gcp/terraform/environments/dev  # For development
# or
cd gcp/terraform/environments/prod  # For production
```

Update `terraform.tfvars` with your project-specific values:
```hcl
project_id = "your-actual-project-id"
domain_name = "your-domain.com"
notification_email = "alerts@yourcompany.com"
```

### 2. Set Environment Variables

Export required sensitive variables:
```bash
export TF_VAR_db_password="your-secure-database-password"
export TF_VAR_n8n_auth_password="your-n8n-admin-password"
export TF_VAR_n8n_encryption_key="your-32-character-encryption-key"
```

### 3. Initialize and Deploy Infrastructure

```bash
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

### 4. Configure kubectl Access

```bash
gcloud container clusters get-credentials electrical-estimation-dev \
  --region=us-central1 \
  --project=your-project-id
```

### 5. Deploy Application Components

Apply Kubernetes manifests:
```bash
kubectl apply -f ../../kubernetes/namespace.yaml
kubectl apply -f ../../kubernetes/
```

### 6. Verify Deployment

Check that all pods are running:
```bash
kubectl get pods -n electrical-estimation
kubectl get services -n electrical-estimation
kubectl get ingress -n electrical-estimation
```

## Environment-Specific Configurations

### Development Environment
- Uses preemptible nodes for cost savings
- Smaller resource allocations
- Allows data deletion on destroy
- Single-replica deployments

### Production Environment  
- Standard (non-preemptible) nodes for reliability
- Higher resource allocations
- Data protection enabled
- Multi-replica deployments with auto-scaling

## Post-Deployment Configuration

### 1. DNS Setup

Point your domain to the load balancer IP:
```bash
# Get the external IP
terraform output load_balancer_ip

# Configure your DNS provider to point:
# yourdomain.com -> [LOAD_BALANCER_IP]
# *.yourdomain.com -> [LOAD_BALANCER_IP]
```

### 2. SSL Certificate Verification

Wait for SSL certificate provisioning (can take up to 30 minutes):
```bash
kubectl describe managedcertificate ssl-cert -n electrical-estimation
```

### 3. Initial N8N Setup

1. Access N8N at: `https://yourdomain.com`
2. Login with credentials from Secret Manager
3. Import electrical estimation workflows
4. Configure database connections using provided outputs

## Monitoring and Alerting

### Accessing Monitoring

- **Cloud Console**: Navigate to Operations > Monitoring
- **Custom Dashboard**: Available as "Electrical Estimation System Dashboard"
- **Uptime Checks**: Configured for N8N and API endpoints

### Alert Configuration

Alerts are automatically configured for:
- Service uptime failures
- High error rates (>5%)
- CPU usage (>80%)
- Memory usage (>85%)
- Database connection issues
- BigQuery job failures

## Application Architecture

### Core Components

1. **N8N Workflow Engine**: Orchestrates electrical calculations
2. **Backend API**: Handles estimation requests and data management
3. **Cloud Run Services**:
   - Electrical Calculator: Complex electrical computations
   - Material Database: Cost and specification lookups
   - Report Generator: PDF and documentation generation

### Data Flow

1. User submits project through web interface
2. N8N workflow processes estimation request
3. Cloud Run services perform specialized calculations
4. Results stored in Cloud SQL database
5. Analytics data exported to BigQuery
6. Reports generated and stored in Cloud Storage

## Security Features

### Network Security
- Private VPC with controlled egress
- Private service networking for Cloud SQL
- VPC Access Connector for Cloud Run
- Network policies for pod-to-pod communication

### Identity and Access
- Workload Identity for secure service account binding
- Least-privilege IAM roles
- Secret Manager integration for sensitive data
- Service account keys rotation

### Data Protection
- Encrypted data at rest and in transit
- Private IP addresses for database connections
- Regular automated backups
- GDPR compliance ready

## Scaling Configuration

### Horizontal Pod Autoscaling
- N8N: 2-10 replicas based on CPU/memory
- Backend API: 3-20 replicas based on load
- Cloud Run: 0-100 instances with concurrency controls

### Vertical Scaling
- Database: Up to 500GB with automatic disk expansion
- Node pools: Auto-scaling from 1-20 nodes
- Memory/CPU: Configurable per environment

## Cost Optimization

### Development Environment
- Preemptible nodes (60-90% cost savings)
- Smaller instance sizes
- Scale-to-zero Cloud Run instances
- Reduced backup retention

### Production Environment
- Reserved instances for predictable workloads
- Sustained use discounts
- Resource-based auto-scaling
- Committed use discounts for consistent usage

## Troubleshooting

### Common Issues

**SSL Certificate Not Provisioning**
```bash
# Check certificate status
kubectl describe managedcertificate ssl-cert -n electrical-estimation

# Verify domain ownership
nslookup yourdomain.com
```

**Database Connection Failures**
```bash
# Check database instance status
gcloud sql instances describe electrical-estimation-db

# Verify network connectivity
kubectl exec -it [pod-name] -n electrical-estimation -- nc -zv [db-ip] 5432
```

**N8N Workflows Not Executing**
```bash
# Check N8N pod logs
kubectl logs -f deployment/n8n -n electrical-estimation

# Verify database connectivity
kubectl exec -it deployment/n8n -n electrical-estimation -- npm run db:migrate
```

### Useful Commands

```bash
# View all resources
kubectl get all -n electrical-estimation

# Check pod logs
kubectl logs -f [pod-name] -n electrical-estimation

# Access pod shell
kubectl exec -it [pod-name] -n electrical-estimation -- /bin/bash

# Port forward for local testing
kubectl port-forward service/n8n 5678:80 -n electrical-estimation
```

## Backup and Disaster Recovery

### Automated Backups
- Cloud SQL: Daily backups with 7-day retention
- Cloud Storage: Multi-regional replication
- Kubernetes configs: Version controlled in Git

### Recovery Procedures
1. Database restore from automated backups
2. Application redeployment from Git
3. DNS failover to secondary region (if configured)

## Performance Tuning

### Database Optimization
- Connection pooling enabled
- Read replicas for analytics queries
- Automatic storage scaling
- Query performance insights

### Application Performance
- Resource limits and requests configured
- Horizontal pod autoscaling
- CDN integration for static assets
- Caching with Redis

## Maintenance

### Regular Tasks
- Security patches via automatic node upgrades
- Database maintenance windows
- SSL certificate renewal (automatic)
- Monitoring dashboard reviews

### Upgrade Procedures
1. Test changes in development environment
2. Update Terraform configurations
3. Apply infrastructure changes
4. Deploy application updates via CI/CD
5. Verify functionality and performance

## Support and Documentation

### Additional Resources
- [GKE Autopilot Documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)
- [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
- [N8N Documentation](https://docs.n8n.io/)

### Getting Help
- Infrastructure issues: Check Terraform state and logs
- Application issues: Review Kubernetes pod logs
- Performance issues: Use Cloud Monitoring dashboard
- Security concerns: Review IAM audit logs

This deployment provides a production-ready, scalable electrical estimation system capable of handling 100+ concurrent AI agents as specified in your requirements.