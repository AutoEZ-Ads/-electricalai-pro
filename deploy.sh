#!/bin/bash

# Electrical Estimation System - GCP Deployment Script
# Automated deployment following the implementation guide

set -e

echo "🏗️ Electrical Estimation System - GCP Deployment"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud SDK not found. Please install it first:"
        echo "  curl -sSL https://sdk.cloud.google.com | bash"
        exit 1
    fi
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform not found. Please install it:"
        echo "  brew install terraform"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install it:"
        echo "  brew install kubectl"
        exit 1
    fi
    
    print_success "All prerequisites found"
}

# Authentication setup
setup_authentication() {
    print_status "Setting up GCP authentication..."
    
    # Check if already authenticated
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        print_success "Already authenticated with GCP"
        return 0
    fi
    
    print_warning "Please authenticate with Google Cloud Platform"
    echo "Run: gcloud auth login"
    echo "Then run: gcloud auth application-default login"
    echo ""
    echo "After authentication, run this script again."
    exit 1
}

# Project setup
setup_project() {
    print_status "Setting up GCP project..."
    
    # Get current project
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
    
    if [[ -z "$PROJECT_ID" ]]; then
        print_warning "No project set. Please set your GCP project:"
        echo "  gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi
    
    print_success "Using project: $PROJECT_ID"
    
    # Enable required APIs
    print_status "Enabling required GCP APIs..."
    
    APIS=(
        "compute.googleapis.com"
        "container.googleapis.com"
        "sql-component.googleapis.com"
        "sqladmin.googleapis.com"
        "bigquery.googleapis.com"
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "secretmanager.googleapis.com"
        "monitoring.googleapis.com"
        "logging.googleapis.com"
        "redis.googleapis.com"
        "vpcaccess.googleapis.com"
        "servicenetworking.googleapis.com"
    )
    
    for api in "${APIS[@]}"; do
        print_status "Enabling $api..."
        gcloud services enable "$api" --project="$PROJECT_ID"
    done
    
    print_success "All APIs enabled"
}

# Environment selection
select_environment() {
    print_status "Select deployment environment:"
    echo "1) Development (dev)"
    echo "2) Production (prod)"
    echo "3) Staging (staging)"
    
    read -p "Enter choice [1-3]: " env_choice
    
    case $env_choice in
        1) ENVIRONMENT="dev" ;;
        2) ENVIRONMENT="prod" ;;
        3) ENVIRONMENT="staging" ;;
        *) print_error "Invalid choice"; exit 1 ;;
    esac
    
    print_success "Selected environment: $ENVIRONMENT"
}

# Terraform setup
setup_terraform() {
    print_status "Setting up Terraform..."
    
    cd "gcp/terraform/environments/$ENVIRONMENT"
    
    # Check if terraform.tfvars exists
    if [[ ! -f "terraform.tfvars" ]]; then
        print_warning "terraform.tfvars not found. Creating template..."
        
        cat > terraform.tfvars << EOF
# GCP Project Configuration
project_id = "$(gcloud config get-value project)"
region     = "us-central1"
zone       = "us-central1-a"

# Environment
environment = "$ENVIRONMENT"

# Domain Configuration
domain_name = "your-domain.com"

# Network Configuration
subnet_cidr   = "10.0.0.0/24"
pods_cidr     = "10.1.0.0/16"
services_cidr = "10.2.0.0/16"

# Database Configuration
db_tier         = "db-f1-micro"
db_disk_size    = 20
db_max_disk_size = 100
db_user         = "n8n_user"

# GKE Configuration
gke_cluster_name = "electrical-estimation-$ENVIRONMENT"

# Notification Configuration
notification_email = "alerts@yourcompany.com"
EOF
        
        print_warning "Please edit terraform.tfvars with your specific values:"
        echo "  - domain_name: Your actual domain"
        echo "  - notification_email: Your email for alerts"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
    
    # Initialize Terraform
    print_status "Initializing Terraform..."
    terraform init
    
    print_success "Terraform initialized"
}

# Set sensitive variables
set_sensitive_variables() {
    print_status "Setting up sensitive variables..."
    
    # Generate random passwords if not set
    if [[ -z "$TF_VAR_db_password" ]]; then
        export TF_VAR_db_password=$(openssl rand -base64 32)
        print_success "Generated database password"
    fi
    
    if [[ -z "$TF_VAR_n8n_auth_password" ]]; then
        export TF_VAR_n8n_auth_password=$(openssl rand -base64 16)
        print_success "Generated N8N password"
    fi
    
    if [[ -z "$TF_VAR_n8n_encryption_key" ]]; then
        export TF_VAR_n8n_encryption_key=$(openssl rand -hex 16)
        print_success "Generated N8N encryption key"
    fi
    
    export TF_VAR_n8n_auth_user="admin"
    
    print_success "Sensitive variables configured"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure with Terraform..."
    
    # Plan deployment
    print_status "Creating Terraform plan..."
    terraform plan -var-file="terraform.tfvars" -out="tfplan"
    
    # Ask for confirmation
    echo ""
    read -p "Do you want to apply this plan? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Apply deployment
        print_status "Applying Terraform configuration..."
        terraform apply "tfplan"
        
        print_success "Infrastructure deployed successfully!"
    else
        print_warning "Deployment cancelled"
        exit 0
    fi
}

# Configure kubectl
configure_kubectl() {
    print_status "Configuring kubectl..."
    
    PROJECT_ID=$(gcloud config get-value project)
    REGION=$(terraform output -raw region 2>/dev/null || echo "us-central1")
    CLUSTER_NAME=$(terraform output -raw cluster_name 2>/dev/null || echo "electrical-estimation-$ENVIRONMENT")
    
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID"
    
    print_success "kubectl configured"
}

# Deploy Kubernetes resources
deploy_kubernetes() {
    print_status "Deploying Kubernetes resources..."
    
    cd ../../../kubernetes
    
    # Apply namespace first
    kubectl apply -f namespace.yaml 2>/dev/null || echo "Namespace may already exist"
    
    # Apply all other resources
    kubectl apply -f .
    
    print_success "Kubernetes resources deployed"
}

# Display deployment information
show_deployment_info() {
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Deployment Information:"
    echo "========================="
    
    cd "../gcp/terraform/environments/$ENVIRONMENT"
    
    # Get outputs from Terraform
    echo "Project ID: $(terraform output -raw project_id 2>/dev/null || echo 'Not available')"
    echo "Region: $(terraform output -raw region 2>/dev/null || echo 'Not available')"
    echo "Cluster Name: $(terraform output -raw cluster_name 2>/dev/null || echo 'Not available')"
    echo "Database Host: $(terraform output -raw database_private_ip 2>/dev/null || echo 'Not available')"
    echo "Load Balancer IP: $(terraform output -raw load_balancer_ip 2>/dev/null || echo 'Not available')"
    
    echo ""
    echo "🔐 Sensitive Information:"
    echo "========================"
    echo "N8N Username: admin"
    echo "N8N Password: $TF_VAR_n8n_auth_password"
    echo "Database Password: [Generated - check Secret Manager]"
    
    echo ""
    echo "📚 Next Steps:"
    echo "=============="
    echo "1. Point your domain to the Load Balancer IP"
    echo "2. Wait for SSL certificate provisioning (up to 30 minutes)"
    echo "3. Access N8N at: https://your-domain.com"
    echo "4. Import electrical estimation workflows"
    echo "5. Configure database connections"
    
    echo ""
    echo "🔍 Useful Commands:"
    echo "=================="
    echo "Check pod status: kubectl get pods -n electrical-estimation"
    echo "View logs: kubectl logs -f deployment/n8n -n electrical-estimation"
    echo "Port forward for testing: kubectl port-forward service/n8n 5678:80 -n electrical-estimation"
}

# Main execution
main() {
    check_prerequisites
    setup_authentication
    setup_project
    select_environment
    setup_terraform
    set_sensitive_variables
    deploy_infrastructure
    configure_kubectl
    deploy_kubernetes
    show_deployment_info
}

# Run main function
main "$@"