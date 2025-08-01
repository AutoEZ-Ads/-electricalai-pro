#!/bin/bash

# ElectricalAI Pro Monday.com App Deployment Script
# Handles production deployment to Render.com and Monday.com marketplace

set -e  # Exit on any error

# Configuration
APP_NAME="electricalai-pro-monday-app"
PRODUCTION_URL="https://electricalai-monday-app.onrender.com"
STAGING_URL="https://electricalai-staging.onrender.com"
GITHUB_REPO="https://github.com/electricalai/monday-app.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment variables are set
check_env_vars() {
    log_info "Checking environment variables..."
    
    local required_vars=(
        "REACT_APP_MONDAY_CLIENT_ID"
        "REACT_APP_N8N_WEBHOOK_BASE"
        "REACT_APP_ELECTRICALAI_API_KEY"
        "RENDER_API_KEY"
        "MONDAY_APP_ID"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    log_success "All required environment variables are set"
}

# Run tests before deployment
run_tests() {
    log_info "Running test suite..."
    
    # Unit tests
    log_info "Running unit tests..."
    npm test -- --coverage --watchAll=false
    
    # Integration tests
    log_info "Running integration tests..."
    npm run test:integration
    
    # E2E tests (if available)
    if command -v playwright &> /dev/null; then
        log_info "Running E2E tests..."
        npx playwright test
    else
        log_warning "Playwright not found, skipping E2E tests"
    fi
    
    log_success "All tests passed"
}

# Build application for production
build_app() {
    log_info "Building application for production..."
    
    # Clean previous build
    rm -rf build/
    
    # Set production environment
    export NODE_ENV=production
    export REACT_APP_ENVIRONMENT=production
    
    # Build application
    npm run build
    
    # Verify build output
    if [[ ! -d "build" ]]; then
        log_error "Build directory not found"
        exit 1
    fi
    
    # Check build size
    local build_size=$(du -sh build/ | cut -f1)
    log_info "Build size: $build_size"
    
    # Check for critical files
    local critical_files=("build/index.html" "build/static/js" "build/static/css")
    for file in "${critical_files[@]}"; do
        if [[ ! -e "$file" ]]; then
            log_error "Critical build file missing: $file"
            exit 1
        fi
    done
    
    log_success "Application built successfully"
}

# Deploy to staging environment first
deploy_staging() {
    log_info "Deploying to staging environment..."
    
    # Use Render API to deploy to staging
    curl -X POST "https://api.render.com/v1/services/srv-staging/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "clearCache": "clear"
        }'
    
    # Wait for staging deployment
    log_info "Waiting for staging deployment to complete..."
    sleep 30
    
    # Health check staging
    local staging_health=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/health")
    if [[ "$staging_health" != "200" ]]; then
        log_error "Staging health check failed (HTTP $staging_health)"
        exit 1
    fi
    
    log_success "Staging deployment successful"
}

# Run smoke tests on staging
smoke_test_staging() {
    log_info "Running smoke tests on staging..."
    
    # Test app initialization
    local init_test=$(curl -s "$STAGING_URL" | grep -c "ElectricalAI Pro")
    if [[ "$init_test" -eq 0 ]]; then
        log_error "App initialization test failed"
        exit 1
    fi
    
    # Test API endpoints
    local api_health=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/health")
    if [[ "$api_health" != "200" ]]; then
        log_warning "API health check returned HTTP $api_health"
    fi
    
    # Test Monday.com integration endpoints
    local monday_config=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/monday/config")
    if [[ "$monday_config" != "200" ]]; then
        log_warning "Monday.com config endpoint returned HTTP $monday_config"
    fi
    
    log_success "Staging smoke tests passed"
}

# Deploy to production
deploy_production() {
    log_info "Deploying to production environment..."
    
    # Create production deployment
    curl -X POST "https://api.render.com/v1/services/srv-production/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "clearCache": "clear"
        }'
    
    # Wait for production deployment
    log_info "Waiting for production deployment to complete..."
    sleep 60
    
    # Health check production
    local prod_health=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL/health")
    if [[ "$prod_health" != "200" ]]; then
        log_error "Production health check failed (HTTP $prod_health)"
        exit 1
    fi
    
    log_success "Production deployment successful"
}

# Update Monday.com app configuration
update_monday_app() {
    log_info "Updating Monday.com app configuration..."
    
    # Update app URLs in Monday.com
    curl -X PUT "https://api.monday.com/v2/apps/$MONDAY_APP_ID" \
        -H "Authorization: Bearer $MONDAY_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"$PRODUCTION_URL\",
            \"webhook_url\": \"$PRODUCTION_URL/webhook\"
        }"
    
    log_success "Monday.com app configuration updated"
}

# Run production smoke tests
smoke_test_production() {
    log_info "Running production smoke tests..."
    
    # Test app loading
    local load_time=$(curl -o /dev/null -s -w "%{time_total}" "$PRODUCTION_URL")
    log_info "App load time: ${load_time}s"
    
    # Test critical paths
    local endpoints=(
        "/item-view"
        "/board-view" 
        "/integration-view"
        "/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL$endpoint")
        if [[ "$status" != "200" ]]; then
            log_error "Endpoint $endpoint returned HTTP $status"
            exit 1
        fi
        log_info "✓ $endpoint (HTTP $status)"
    done
    
    # Test N8N integration
    local n8n_test=$(curl -s "$PRODUCTION_URL/api/n8n/health" | jq -r '.status')
    if [[ "$n8n_test" == "healthy" ]]; then
        log_success "N8N integration healthy"
    else
        log_warning "N8N integration may have issues"
    fi
    
    log_success "Production smoke tests passed"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    log_info "Sending deployment notification..."
    
    # Slack notification (if webhook URL is set)
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"ElectricalAI Pro Deployment $status\",
                \"attachments\": [{
                    \"color\": \"$([ \"$status\" == \"SUCCESS\" ] && echo \"good\" || echo \"danger\")\",
                    \"fields\": [{
                        \"title\": \"Status\",
                        \"value\": \"$status\",
                        \"short\": true
                    }, {
                        \"title\": \"Environment\",
                        \"value\": \"Production\",
                        \"short\": true
                    }, {
                        \"title\": \"URL\",
                        \"value\": \"$PRODUCTION_URL\",
                        \"short\": false
                    }, {
                        \"title\": \"Message\",
                        \"value\": \"$message\",
                        \"short\": false
                    }]
                }]
            }"
    fi
    
    # Email notification (if configured)
    if command -v sendmail &> /dev/null && [[ -n "$NOTIFICATION_EMAIL" ]]; then
        echo "Subject: ElectricalAI Pro Deployment $status
From: noreply@electricalai.pro
To: $NOTIFICATION_EMAIL

ElectricalAI Pro Monday.com App deployment completed with status: $status

URL: $PRODUCTION_URL
Message: $message
Timestamp: $(date)
" | sendmail "$NOTIFICATION_EMAIL"
    fi
}

# Rollback function
rollback() {
    log_error "Deployment failed, initiating rollback..."
    
    # Get previous successful deployment
    local previous_deploy=$(curl -s "https://api.render.com/v1/services/srv-production/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" | \
        jq -r '.[] | select(.status == "live") | .id' | head -1)
    
    if [[ -n "$previous_deploy" ]]; then
        log_info "Rolling back to deployment: $previous_deploy"
        
        curl -X POST "https://api.render.com/v1/services/srv-production/deploys/$previous_deploy/rollback" \
            -H "Authorization: Bearer $RENDER_API_KEY"
        
        log_success "Rollback initiated"
    else
        log_error "No previous successful deployment found for rollback"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    
    # Remove temporary files
    rm -rf tmp/
    rm -f deployment.log
    
    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    local deployment_type=${1:-"production"}
    
    log_info "Starting ElectricalAI Pro deployment (type: $deployment_type)"
    log_info "Timestamp: $(date)"
    
    # Trap errors for rollback
    trap 'rollback; send_notification "FAILED" "Deployment failed and rollback initiated"; exit 1' ERR
    
    # Pre-deployment checks
    check_env_vars
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --production=false
    
    # Run tests
    run_tests
    
    # Build application
    build_app
    
    if [[ "$deployment_type" == "staging" ]]; then
        deploy_staging
        smoke_test_staging
        log_success "Staging deployment completed successfully"
        return 0
    fi
    
    # Full production deployment
    deploy_staging
    smoke_test_staging
    
    # Deploy to production
    deploy_production
    update_monday_app
    smoke_test_production
    
    # Success notification
    send_notification "SUCCESS" "ElectricalAI Pro deployed successfully to production"
    
    log_success "Production deployment completed successfully!"
    log_info "App URL: $PRODUCTION_URL"
    log_info "Monday.com App ID: $MONDAY_APP_ID"
    
    # Cleanup
    cleanup
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi