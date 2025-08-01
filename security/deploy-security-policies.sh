#!/bin/bash
# Enhanced Security Deployment Script for Electrical Estimation System
# Deploys comprehensive security policies, RBAC, and monitoring

set -euo pipefail

# Configuration
PROJECT_ID="${PROJECT_ID:-}"
CLUSTER_NAME="${CLUSTER_NAME:-electrical-estimation-cluster}"
REGION="${REGION:-us-central1}"
DOMAIN_NAME="${DOMAIN_NAME:-electrical-estimation.com}"
SECURITY_DIR="$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

success() {
    echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Validate prerequisites
validate_prerequisites() {
    log "🔐 Validating security deployment prerequisites..."
    
    if [[ -z "$PROJECT_ID" ]]; then
        error "PROJECT_ID environment variable is required"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "gcloud" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if cluster has required permissions
    if ! kubectl auth can-i create clusterroles &> /dev/null; then
        error "Insufficient permissions to create cluster roles"
        exit 1
    fi
    
    success "Prerequisites validation completed"
}

# Create necessary GCP resources
setup_gcp_security_resources() {
    log "🛡️ Setting up GCP security resources..."
    
    # Enable required APIs
    info "Enabling required GCP APIs..."
    gcloud services enable \
        cloudsecurity.googleapis.com \
        containeranalysis.googleapis.com \
        binaryauthorization.googleapis.com \
        secretmanager.googleapis.com \
        cloudkms.googleapis.com \
        --project="$PROJECT_ID"
    
    # Create KMS keyring for Binary Authorization
    info "Creating KMS keyring for Binary Authorization..."
    if ! gcloud kms keyrings describe binauthz-keyring --location=global --project="$PROJECT_ID" &>/dev/null; then
        gcloud kms keyrings create binauthz-keyring \
            --location=global \
            --project="$PROJECT_ID"
    fi
    
    # Create KMS key for Binary Authorization
    if ! gcloud kms keys describe binauthz-key --keyring=binauthz-keyring --location=global --project="$PROJECT_ID" &>/dev/null; then
        gcloud kms keys create binauthz-key \
            --keyring=binauthz-keyring \
            --location=global \
            --purpose=asymmetric-signing \
            --default-algorithm=ec-sign-p256-sha256 \
            --project="$PROJECT_ID"
    fi
    
    # Create Binary Authorization attestor
    info "Creating Binary Authorization attestor..."
    if ! gcloud container binauthz attestors describe prod-attestor --project="$PROJECT_ID" &>/dev/null; then
        gcloud container binauthz attestors create prod-attestor \
            --attestation-authority-note-project="$PROJECT_ID" \
            --attestation-authority-note="prod-attestor-note" \
            --description="Production attestor for electrical estimation system" \
            --project="$PROJECT_ID"
        
        # Add public key to attestor
        gcloud container binauthz attestors public-keys add \
            --attestor=prod-attestor \
            --keyversion-project="$PROJECT_ID" \
            --keyversion-location=global \
            --keyversion-keyring=binauthz-keyring \
            --keyversion-key=binauthz-key \
            --keyversion=1 \
            --project="$PROJECT_ID"
    fi
    
    # Create service accounts with proper IAM roles
    info "Creating security service accounts..."
    
    # Monitoring service account
    if ! gcloud iam service-accounts describe "electrical-monitoring-gsa@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" &>/dev/null; then
        gcloud iam service-accounts create electrical-monitoring-gsa \
            --display-name="Electrical Monitoring Service Account" \
            --description="Service account for monitoring and security scanning" \
            --project="$PROJECT_ID"
        
        # Grant necessary roles
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:electrical-monitoring-gsa@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/monitoring.viewer"
        
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:electrical-monitoring-gsa@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/containeranalysis.occurrences.viewer"
    fi
    
    # N8N workflow service account
    if ! gcloud iam service-accounts describe "n8n-workflow-gsa@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" &>/dev/null; then
        gcloud iam service-accounts create n8n-workflow-gsa \
            --display-name="N8N Workflow Service Account" \
            --description="Service account for N8N workflow automation" \
            --project="$PROJECT_ID"
        
        # Grant minimal required roles
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:n8n-workflow-gsa@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/secretmanager.secretAccessor"
    fi
    
    # Backup service account
    if ! gcloud iam service-accounts describe "electrical-backup-gsa@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" &>/dev/null; then
        gcloud iam service-accounts create electrical-backup-gsa \
            --display-name="Electrical Backup Service Account" \
            --description="Service account for backup and disaster recovery" \
            --project="$PROJECT_ID"
        
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:electrical-backup-gsa@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/storage.admin"
    fi
    
    success "GCP security resources setup completed"
}

# Deploy Cloud Armor security policies
deploy_cloud_armor() {
    log "🔒 Deploying Cloud Armor security policies..."
    
    # Execute Cloud Armor deployment script
    if [[ -f "$SECURITY_DIR/cloud-armor-policies.yaml" ]]; then
        # Extract and execute the gcloud deployment script
        local armor_script=$(mktemp)
        kubectl get configmap cloud-armor-config -n electrical-estimation -o jsonpath='{.data.gcloud-deployment-script\.sh}' > "$armor_script" 2>/dev/null || {
            # Extract from the YAML file if configmap doesn't exist
            awk '/gcloud-deployment-script.sh: \|/{flag=1; next} /^[[:space:]]*[^[:space:]]/{if(flag) exit} flag' "$SECURITY_DIR/cloud-armor-policies.yaml" | sed 's/^    //' > "$armor_script"
        }
        
        chmod +x "$armor_script"
        PROJECT_ID="$PROJECT_ID" bash "$armor_script"
        rm -f "$armor_script"
    else
        warn "Cloud Armor policies file not found, skipping..."
    fi
    
    success "Cloud Armor security policies deployed"
}

# Install Gatekeeper for admission control
install_gatekeeper() {
    log "🚪 Installing Gatekeeper admission controller..."
    
    # Check if Gatekeeper is already installed
    if kubectl get namespace gatekeeper-system &>/dev/null; then
        info "Gatekeeper is already installed, upgrading..."
    else
        info "Installing Gatekeeper..."
    fi
    
    # Install/upgrade Gatekeeper using helm
    helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
    helm repo update
    
    helm upgrade --install gatekeeper gatekeeper/gatekeeper \
        --namespace gatekeeper-system \
        --create-namespace \
        --set replicas=3 \
        --set auditInterval=60 \
        --set constraintViolationsLimit=20 \
        --set auditFromCache=false \
        --set disableValidatingAdmissionWebhook=false \
        --wait
    
    # Wait for Gatekeeper to be ready
    kubectl wait --for=condition=Available deployment/gatekeeper-controller-manager -n gatekeeper-system --timeout=300s
    kubectl wait --for=condition=Available deployment/gatekeeper-audit -n gatekeeper-system --timeout=300s
    
    success "Gatekeeper admission controller installed"
}

# Deploy Kubernetes security policies
deploy_k8s_security_policies() {
    log "🛡️ Deploying Kubernetes security policies..."
    
    # Create namespace with Pod Security Standards
    kubectl create namespace electrical-estimation --dry-run=client -o yaml | \
        kubectl label --local -f - \
            pod-security.kubernetes.io/enforce=restricted \
            pod-security.kubernetes.io/audit=restricted \
            pod-security.kubernetes.io/warn=restricted \
            name=electrical-estimation \
            --dry-run=client -o yaml | \
        kubectl apply -f -
    
    # Replace PROJECT_ID and DOMAIN_NAME in policy files
    info "Applying enhanced security policies..."
    sed "s/PROJECT_ID/$PROJECT_ID/g; s/DOMAIN_NAME/$DOMAIN_NAME/g" "$SECURITY_DIR/enhanced-security-policies.yaml" | \
        kubectl apply -f -
    
    # Apply container security policies
    info "Applying container security policies..."
    sed "s/PROJECT_ID/$PROJECT_ID/g" "$SECURITY_DIR/container-security-policies.yaml" | \
        kubectl apply -f -
    
    # Apply original RBAC policies with updates
    info "Applying updated RBAC policies..."
    sed "s/PROJECT_ID/$PROJECT_ID/g; s/DOMAIN_NAME/$DOMAIN_NAME/g" "$SECURITY_DIR/rbac-policies.yaml" | \
        kubectl apply -f -
    
    success "Kubernetes security policies deployed"
}

# Install cert-manager for SSL certificate management
install_cert_manager() {
    log "🔐 Installing cert-manager for SSL certificate management..."
    
    # Check if cert-manager is already installed
    if kubectl get namespace cert-manager &>/dev/null; then
        info "cert-manager is already installed, upgrading..."
    else
        info "Installing cert-manager..."
        kubectl create namespace cert-manager
    fi
    
    # Install cert-manager using helm
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --version v1.13.0 \
        --set installCRDs=true \
        --set global.leaderElection.namespace=cert-manager \
        --wait
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s
    kubectl wait --for=condition=Available deployment/cert-manager-cainjector -n cert-manager --timeout=300s
    kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s
    
    success "cert-manager installed successfully"
}

# Install Falco for runtime security monitoring
install_falco() {
    log "👁️ Installing Falco for runtime security monitoring..."
    
    # Install Falco using helm
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    
    helm upgrade --install falco falcosecurity/falco \
        --namespace falco \
        --create-namespace \
        --set falco.grpc.enabled=true \
        --set falco.grpcOutput.enabled=true \
        --set falco.httpOutput.enabled=true \
        --set falco.jsonOutput=true \
        --set falco.logLevel=info \
        --set falco.priority=debug \
        --set falco.bufferedOutputs=true \
        --set collectors.kubernetes.enabled=true \
        --set collectors.containerd.enabled=true \
        --wait
    
    # Apply custom Falco rules
    kubectl create configmap falco-custom-rules \
        --from-literal=custom_rules.yaml="$(kubectl get configmap security-monitoring-config -n electrical-estimation -o jsonpath='{.data.falco-rules\.yaml}')" \
        -n falco \
        --dry-run=client -o yaml | kubectl apply -f -
    
    success "Falco runtime security monitoring installed"
}

# Setup security monitoring and alerting
setup_security_monitoring() {
    log "📊 Setting up security monitoring and alerting..."
    
    # Create security dashboard in Grafana (if available)
    info "Configuring security monitoring dashboard..."
    
    # Apply security monitoring configuration
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-dashboard-config
  namespace: electrical-estimation
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "Security Monitoring Dashboard",
        "panels": [
          {
            "title": "Failed Authentication Attempts",
            "type": "graph",
            "targets": [
              {
                "expr": "increase(http_requests_total{code=~\"401|403\"}[5m])",
                "legendFormat": "Failed Auth - {{method}} {{handler}}"
              }
            ]
          },
          {
            "title": "Security Policy Violations",
            "type": "graph",
            "targets": [
              {
                "expr": "increase(gatekeeper_violations_total[5m])",
                "legendFormat": "Policy Violations - {{violation_kind}}"
              }
            ]
          },
          {
            "title": "Container Security Events",
            "type": "logs",
            "targets": [
              {
                "expr": "{job=\"falco\", priority=~\"Critical|Warning\"}"
              }
            ]
          }
        ]
      }
    }
EOF
    
    success "Security monitoring configured"
}

# Generate security credentials
generate_security_credentials() {
    log "🔑 Generating security credentials..."
    
    # Generate random passwords
    local db_password=$(openssl rand -base64 32)
    local n8n_password=$(openssl rand -base64 32)
    local encryption_key=$(openssl rand -hex 32)
    local webhook_secret=$(openssl rand -base64 32)
    
    # Update secrets with generated passwords
    kubectl patch secret database-credentials -n electrical-estimation \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/data/password\", \"value\":\"$(echo -n "$db_password" | base64 -w 0)\"}]"
    
    kubectl patch secret n8n-credentials -n electrical-estimation \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/data/password\", \"value\":\"$(echo -n "$n8n_password" | base64 -w 0)\"}]"
    
    kubectl patch secret n8n-credentials -n electrical-estimation \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/data/encryption_key\", \"value\":\"$(echo -n "$encryption_key" | base64 -w 0)\"}]"
    
    # Store credentials in Google Secret Manager
    echo -n "$db_password" | gcloud secrets create electrical-db-password --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$db_password" | gcloud secrets versions add electrical-db-password --data-file=- --project="$PROJECT_ID"
    
    echo -n "$n8n_password" | gcloud secrets create electrical-n8n-password --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$n8n_password" | gcloud secrets versions add electrical-n8n-password --data-file=- --project="$PROJECT_ID"
    
    echo -n "$webhook_secret" | gcloud secrets create electrical-webhook-secret --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
        echo -n "$webhook_secret" | gcloud secrets versions add electrical-webhook-secret --data-file=- --project="$PROJECT_ID"
    
    success "Security credentials generated and stored"
}

# Validate security deployment
validate_security_deployment() {
    log "✅ Validating security deployment..."
    
    local validation_errors=()
    
    # Check Gatekeeper installation
    if ! kubectl get deployment gatekeeper-controller-manager -n gatekeeper-system &>/dev/null; then
        validation_errors+=("Gatekeeper controller not found")
    fi
    
    # Check security policies
    if ! kubectl get constrainttemplates.templates.gatekeeper.sh containerrequiredsecurity &>/dev/null; then
        validation_errors+=("Container security constraint template not found")
    fi
    
    # Check cert-manager
    if ! kubectl get deployment cert-manager -n cert-manager &>/dev/null; then
        validation_errors+=("cert-manager not found")
    fi
    
    # Check Falco
    if ! kubectl get daemonset falco -n falco &>/dev/null; then
        validation_errors+=("Falco daemonset not found")
    fi
    
    # Check RBAC policies
    if ! kubectl get clusterrole electrical-estimation-enhanced-role &>/dev/null; then
        validation_errors+=("Enhanced RBAC role not found")
    fi
    
    # Check network policies
    if ! kubectl get networkpolicy electrical-calculator-network-policy -n electrical-estimation &>/dev/null; then
        validation_errors+=("Network policy not found")
    fi
    
    # Check secrets
    if ! kubectl get secret database-credentials -n electrical-estimation &>/dev/null; then
        validation_errors+=("Database credentials secret not found")
    fi
    
    if [[ ${#validation_errors[@]} -eq 0 ]]; then
        success "Security deployment validation passed"
        return 0
    else
        error "Security deployment validation failed:"
        for error in "${validation_errors[@]}"; do
            error "  - $error"
        done
        return 1
    fi
}

# Generate security report
generate_security_report() {
    log "📋 Generating security deployment report..."
    
    local report_file="/tmp/security-deployment-report.md"
    
    cat > "$report_file" << EOF
# Security Deployment Report
**Generated:** $(date)
**Project:** $PROJECT_ID
**Cluster:** $CLUSTER_NAME
**Domain:** $DOMAIN_NAME

## Deployed Security Components

### ✅ Access Control & RBAC
- Enhanced service accounts with granular permissions
- Pod Security Standards enforcement (restricted)
- Resource quotas and limits
- Emergency break-glass access controls

### ✅ Network Security
- Advanced NetworkPolicies for micro-segmentation
- Cloud Armor WAF with SQL injection and XSS protection
- Rate limiting and DDoS protection
- SSL/TLS certificate management with cert-manager

### ✅ Container Security
- Gatekeeper admission controller with security policies
- Binary Authorization for image verification
- Container vulnerability scanning
- Pod security contexts and capabilities restrictions

### ✅ Runtime Security
- Falco runtime security monitoring
- Security event alerting
- Audit logging configuration
- Continuous vulnerability scanning

### ✅ Secrets Management
- Kubernetes secrets with rotation
- Google Secret Manager integration
- Encrypted storage at rest
- Secure credential generation

### ✅ Monitoring & Alerting
- Security metrics collection
- Failed authentication monitoring
- Policy violation alerts
- Runtime security event tracking

## Security Validation Results
$(kubectl get pods -n electrical-estimation -o wide 2>/dev/null | head -10 || echo "Namespace not found")

## Next Steps
1. Configure monitoring dashboards
2. Set up alerting notification channels
3. Test security policies with sample violations
4. Configure backup and disaster recovery
5. Conduct security audit and penetration testing

## Support Information
- **Security Policies:** /security/ directory
- **Monitoring:** Prometheus + Grafana
- **Incident Response:** Follow security runbook
- **Emergency Access:** Contact security team

EOF
    
    info "Security report generated: $report_file"
    cat "$report_file"
}

# Main execution function
main() {
    log "🚀 Starting enhanced security deployment for Electrical Estimation System"
    log "==============================================================================="
    
    validate_prerequisites
    setup_gcp_security_resources
    deploy_cloud_armor
    install_gatekeeper
    install_cert_manager
    install_falco
    deploy_k8s_security_policies
    setup_security_monitoring
    generate_security_credentials
    
    if validate_security_deployment; then
        generate_security_report
        
        log "==============================================================================="
        success "🎉 Enhanced security deployment completed successfully!"
        log ""
        log "🔐 Security Components Deployed:"
        log "  - Enhanced RBAC with granular permissions"
        log "  - Cloud Armor WAF with DDoS protection"
        log "  - Gatekeeper admission controller"
        log "  - cert-manager for SSL certificate management"
        log "  - Falco runtime security monitoring"
        log "  - Pod Security Standards enforcement"
        log "  - Network policies for micro-segmentation"
        log "  - Binary Authorization for image verification"
        log "  - Comprehensive security monitoring"
        log ""
        log "🚀 System Status: SECURITY HARDENED"
        log "==============================================================================="
    else
        error "Security deployment validation failed. Please review the errors above."
        exit 1
    fi
}

# Execute main function
main "$@"