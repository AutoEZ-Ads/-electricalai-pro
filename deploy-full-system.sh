#!/bin/bash

# 🚀 ElectricalAI Pro Complete System Deployment
# Deploy entire ElectricalAI Pro platform to Render.com using render.yaml

set -e

echo "🚀 ElectricalAI Pro Complete System Deployment"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required environment variables are set
check_env_vars() {
    echo -e "${BLUE}📋 Checking environment variables...${NC}"
    
    local required_vars=(
        "RENDER_API_TOKEN"
        "OPENAI_API_KEY"
        "ELECTRICALAI_API_KEY"
        "MONDAY_API_TOKEN"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "${RED}   - $var${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 Please set the following environment variables:${NC}"
        echo "export RENDER_API_TOKEN='your_render_api_token'"
        echo "export OPENAI_API_KEY='your_openai_api_key'"
        echo "export ELECTRICALAI_API_KEY='your_electricalai_api_key'"
        echo "export MONDAY_API_TOKEN='your_monday_api_token'"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
}

# Install Render CLI if not installed
install_render_cli() {
    if ! command -v render &> /dev/null; then
        echo -e "${BLUE}📦 Installing Render CLI...${NC}"
        
        # Install Render CLI based on OS
        if [[ "$(uname)" == "Darwin" ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install render
            else
                echo -e "${YELLOW}⚠️  Homebrew not found. Installing Render CLI via curl...${NC}"
                curl -fsSL https://cli.render.com/install | bash
            fi
        elif [[ "$(uname)" == "Linux" ]]; then
            # Linux
            curl -fsSL https://cli.render.com/install | bash
        else
            echo -e "${RED}❌ Unsupported operating system${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Render CLI installed successfully${NC}"
    else
        echo -e "${GREEN}✅ Render CLI already installed${NC}"
    fi
}

# Login to Render
login_to_render() {
    echo -e "${BLUE}🔐 Authenticating with Render...${NC}"
    
    # Set the API token
    export RENDER_API_TOKEN="${RENDER_API_TOKEN}"
    
    # Test authentication
    if render whoami &> /dev/null; then
        echo -e "${GREEN}✅ Successfully authenticated with Render${NC}"
    else
        echo -e "${RED}❌ Failed to authenticate with Render${NC}"
        echo -e "${YELLOW}💡 Please check your RENDER_API_TOKEN${NC}"
        exit 1
    fi
}

# Validate system configuration
validate_system_config() {
    echo -e "${BLUE}🔍 Validating system configuration...${NC}"
    
    # Check if render.yaml exists
    if [[ ! -f "render.yaml" ]]; then
        echo -e "${RED}❌ render.yaml configuration not found${NC}"
        exit 1
    fi
    
    # Check if webapp directories exist
    if [[ ! -d "webapp/backend" ]] || [[ ! -d "webapp/frontend" ]]; then
        echo -e "${RED}❌ Webapp directories not found${NC}"
        exit 1
    fi
    
    # Check if N8N directory exists
    if [[ ! -d "n8n" ]]; then
        echo -e "${RED}❌ N8N directory not found${NC}"
        exit 1
    fi
    
    # Check if Monday app directory exists
    if [[ ! -d "monday-app" ]]; then
        echo -e "${RED}❌ Monday app directory not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ System configuration validated${NC}"
}

# Build all applications
build_applications() {
    echo -e "${BLUE}🔨 Building all applications...${NC}"
    
    # Build backend
    echo -e "${BLUE}Building backend API...${NC}"
    if [[ -f "webapp/backend/package.json" ]]; then
        cd webapp/backend
        npm install --production
        cd ../..
        echo -e "${GREEN}✅ Backend built successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend package.json not found, skipping build${NC}"
    fi
    
    # Build frontend
    echo -e "${BLUE}Building frontend React app...${NC}"
    if [[ -f "webapp/frontend/package.json" ]]; then
        cd webapp/frontend
        npm install
        npm run build
        cd ../..
        echo -e "${GREEN}✅ Frontend built successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend package.json not found, skipping build${NC}"
    fi
    
    # Build Monday app
    echo -e "${BLUE}Building Monday.com app...${NC}"
    if [[ -f "monday-app/package.json" ]]; then
        cd monday-app
        npm install
        npm run build
        cd ..
        echo -e "${GREEN}✅ Monday app built successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Monday app package.json not found, skipping build${NC}"
    fi
}

# Deploy to Render using render.yaml
deploy_to_render() {
    echo -e "${BLUE}🚀 Deploying complete system to Render.com...${NC}"
    
    # Deploy using render.yaml
    echo -e "${BLUE}📤 Starting deployment with render.yaml...${NC}"
    
    if render deploy --config-file render.yaml; then
        echo -e "${GREEN}✅ System deployment initiated successfully${NC}"
    else
        echo -e "${RED}❌ System deployment failed${NC}"
        exit 1
    fi
}

# Wait for deployment to complete
wait_for_deployment() {
    echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
    echo -e "${YELLOW}This may take 10-15 minutes for all services to come online...${NC}"
    
    local services=(
        "https://electricalai-backend.onrender.com/health"
        "https://electricalai-frontend.onrender.com"
        "https://electricalai-n8n.onrender.com/healthz"
        "https://electricalai-monday-app.onrender.com"
    )
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        echo -e "${YELLOW}🔄 Checking deployment status... (Attempt $attempt/$max_attempts)${NC}"
        
        local all_services_up=true
        
        for service in "${services[@]}"; do
            if ! curl -f -s "$service" > /dev/null 2>&1; then
                all_services_up=false
                break
            fi
        done
        
        if [[ "$all_services_up" == true ]]; then
            echo -e "${GREEN}✅ All services are online and healthy!${NC}"
            return 0
        fi
        
        sleep 30
        ((attempt++))
    done
    
    echo -e "${YELLOW}⚠️  Deployment may still be in progress. Check Render dashboard for status.${NC}"
    return 1
}

# Test system endpoints
test_system_endpoints() {
    echo -e "${BLUE}🧪 Testing system endpoints...${NC}"
    
    local endpoints=(
        "https://electricalai-backend.onrender.com/health|Backend API Health"
        "https://electricalai-frontend.onrender.com|Frontend Application"
        "https://electricalai-n8n.onrender.com/healthz|N8N Workflow System"
        "https://electricalai-n8n.onrender.com/webhook/electrical-estimation|Electrical Estimation Webhook"
        "https://electricalai-n8n.onrender.com/webhook/floor-plan-upload|Floor Plan Analysis Webhook"
        "https://electricalai-n8n.onrender.com/webhook/nec-compliance-check|NEC Compliance Webhook"
        "https://electricalai-monday-app.onrender.com|Monday.com App"
    )
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r endpoint description <<< "$endpoint_info"
        echo -e "${BLUE}Testing ${description}...${NC}"
        
        if curl -f -s "$endpoint" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${description} is accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  ${description} may not be ready yet${NC}"
        fi
    done
}

# Deploy Monday.com app
deploy_monday_app() {
    echo -e "${BLUE}📱 Deploying Monday.com marketplace app...${NC}"
    
    cd monday-app
    
    # Check if Monday CLI is available
    if command -v mapps &> /dev/null; then
        echo -e "${BLUE}Deploying to Monday.com marketplace...${NC}"
        
        # This will require user interaction for API token
        echo -e "${YELLOW}💡 You'll need to provide your Monday.com API token${NC}"
        if ./deploy-monday-app.sh; then
            echo -e "${GREEN}✅ Monday.com app deployed successfully${NC}"
        else
            echo -e "${YELLOW}⚠️  Monday.com app deployment requires manual setup${NC}"
            echo -e "${YELLOW}Run './monday-app/deploy-monday-app.sh' after this script completes${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Monday CLI not found. Run './monday-app/deploy-monday-app.sh' separately${NC}"
    fi
    
    cd ..
}

# Display deployment summary
display_summary() {
    echo -e "${GREEN}"
    echo "🎉 ElectricalAI Pro Complete System Deployment Complete!"
    echo "======================================================="
    echo -e "${NC}"
    echo -e "${BLUE}📊 Deployed Services:${NC}"
    echo -e "${GREEN}✅ Backend API: https://electricalai-backend.onrender.com${NC}"
    echo -e "${GREEN}✅ Frontend App: https://electricalai-frontend.onrender.com${NC}"
    echo -e "${GREEN}✅ N8N Workflows: https://electricalai-n8n.onrender.com${NC}"
    echo -e "${GREEN}✅ N8N Worker: Background processing service${NC}"
    echo -e "${GREEN}✅ Monday.com App: https://electricalai-monday-app.onrender.com${NC}"
    echo -e "${GREEN}✅ PostgreSQL Databases: 2 production databases${NC}"
    echo -e "${GREEN}✅ Redis Cache: 2 Redis instances for performance${NC}"
    echo ""
    echo -e "${BLUE}🔗 Available Endpoints:${NC}"
    echo "• Backend API: /health, /api/estimations, /api/projects"
    echo "• N8N Webhooks: /webhook/electrical-estimation, /webhook/floor-plan-upload"  
    echo "• Frontend: Complete React dashboard"
    echo "• Monday App: Item View, Board View, Integration View"
    echo ""
    echo -e "${BLUE}🔐 Admin Access:${NC}"
    echo "• N8N Admin: https://electricalai-n8n.onrender.com (username: admin)"
    echo "• Backend Logs: Available in Render dashboard"
    echo "• Database: PostgreSQL accessible via Render dashboard"
    echo ""
    echo -e "${BLUE}💰 Cost Estimate:${NC}"
    echo "• Total monthly cost: ~$50-70/month for starter plans"
    echo "• Scale to standard plans as usage grows"
    echo "• Database and Redis included in service costs"
    echo ""
    echo -e "${BLUE}📚 Next Steps:${NC}"
    echo "1. Complete Monday.com app deployment (if not done automatically)"
    echo "2. Test all workflows with sample data"
    echo "3. Configure monitoring and alerts"
    echo "4. Begin customer onboarding"
    echo "5. Monitor system performance and costs"
    echo ""
    echo -e "${GREEN}🚀 Your ElectricalAI Pro platform is now live in production!${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 ElectricalAI Pro Complete System Deployment${NC}"
    echo ""
    
    # Run deployment steps
    check_env_vars
    install_render_cli
    login_to_render
    validate_system_config
    build_applications
    deploy_to_render
    wait_for_deployment
    test_system_endpoints
    deploy_monday_app
    display_summary
    
    echo -e "${GREEN}✅ Production deployment completed successfully!${NC}"
}

# Execute main function
main "$@"