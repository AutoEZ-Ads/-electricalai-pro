#!/bin/bash

# 🚀 ElectricalAI Pro GitHub Repository Setup
# Create and configure GitHub repository for production deployment

set -e

echo "🚀 ElectricalAI Pro GitHub Repository Setup"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if GitHub CLI is installed
check_github_cli() {
    if command -v gh &> /dev/null; then
        echo -e "${GREEN}✅ GitHub CLI is installed${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  GitHub CLI not found${NC}"
        echo -e "${BLUE}📦 Installing GitHub CLI...${NC}"
        
        # Install GitHub CLI based on OS
        if [[ "$(uname)" == "Darwin" ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install gh
            else
                echo -e "${RED}❌ Homebrew not found. Please install GitHub CLI manually:${NC}"
                echo "Visit: https://cli.github.com/"
                return 1
            fi
        elif [[ "$(uname)" == "Linux" ]]; then
            # Linux
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
            sudo apt update
            sudo apt install gh
        else
            echo -e "${RED}❌ Unsupported operating system${NC}"
            echo "Please install GitHub CLI manually: https://cli.github.com/"
            return 1
        fi
        
        echo -e "${GREEN}✅ GitHub CLI installed successfully${NC}"
    fi
}

# Authenticate with GitHub
authenticate_github() {
    echo -e "${BLUE}🔐 Authenticating with GitHub...${NC}"
    
    if gh auth status &> /dev/null; then
        echo -e "${GREEN}✅ Already authenticated with GitHub${NC}"
    else
        echo -e "${YELLOW}💡 Please authenticate with GitHub CLI${NC}"
        gh auth login
        echo -e "${GREEN}✅ GitHub authentication complete${NC}"
    fi
}

# Get repository details from user
get_repo_details() {
    echo -e "${BLUE}📝 Repository Configuration${NC}"
    
    # Get GitHub username
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        GITHUB_USERNAME=$(gh api user --jq .login)
        echo -e "${GREEN}✅ GitHub username: ${GITHUB_USERNAME}${NC}"
    else
        read -p "Enter your GitHub username: " GITHUB_USERNAME
    fi
    
    # Repository name
    REPO_NAME="electricalai-pro"
    echo -e "${GREEN}✅ Repository name: ${REPO_NAME}${NC}"
    
    # Repository description
    REPO_DESCRIPTION="AI-powered electrical construction estimation platform with Monday.com integration, N8N workflow automation, and NEC 2023 compliance checking."
    
    echo -e "${BLUE}Repository will be created as: ${GITHUB_USERNAME}/${REPO_NAME}${NC}"
}

# Create GitHub repository
create_github_repo() {
    echo -e "${BLUE}🏗️  Creating GitHub repository...${NC}"
    
    # Create repository using GitHub CLI
    if gh repo create "${REPO_NAME}" \
        --description "${REPO_DESCRIPTION}" \
        --public \
        --clone=false \
        --add-readme=false; then
        echo -e "${GREEN}✅ Repository created successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Repository may already exist or creation failed${NC}"
        echo -e "${BLUE}Continuing with existing repository...${NC}"
    fi
}

# Configure git remote
configure_git_remote() {
    echo -e "${BLUE}🔗 Configuring Git remote...${NC}"
    
    REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    
    # Check if origin remote exists
    if git remote get-url origin &> /dev/null; then
        echo -e "${YELLOW}⚠️  Remote 'origin' already exists${NC}"
        echo -e "${BLUE}Updating remote URL...${NC}"
        git remote set-url origin "${REPO_URL}"
    else
        echo -e "${BLUE}Adding remote 'origin'...${NC}"
        git remote add origin "${REPO_URL}"
    fi
    
    echo -e "${GREEN}✅ Git remote configured: ${REPO_URL}${NC}"
}

# Check git status and commit if needed
check_git_status() {
    echo -e "${BLUE}📋 Checking Git status...${NC}"
    
    if [[ -n $(git status --porcelain) ]]; then
        echo -e "${YELLOW}⚠️  Uncommitted changes found${NC}"
        echo -e "${BLUE}Committing changes...${NC}"
        
        git add .
        git commit -m "Final updates before GitHub push

Complete ElectricalAI Pro system ready for production deployment:
- N8N workflow automation system
- Monday.com marketplace app
- Production-ready infrastructure with render.yaml
- Comprehensive deployment scripts and documentation

🚀 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        
        echo -e "${GREEN}✅ Changes committed${NC}"
    else
        echo -e "${GREEN}✅ Working directory clean${NC}"
    fi
}

# Push to GitHub
push_to_github() {
    echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
    
    # Check if main branch exists on remote
    if git ls-remote --heads origin main &> /dev/null; then
        echo -e "${BLUE}Pushing to existing main branch...${NC}"
        git push origin main
    else
        echo -e "${BLUE}Pushing and setting upstream for main branch...${NC}"
        git push -u origin main
    fi
    
    echo -e "${GREEN}✅ Code pushed to GitHub successfully${NC}"
}

# Configure repository settings
configure_repo_settings() {
    echo -e "${BLUE}⚙️  Configuring repository settings...${NC}"
    
    # Enable issues and projects
    gh repo edit "${GITHUB_USERNAME}/${REPO_NAME}" \
        --enable-issues \
        --enable-projects \
        --enable-wiki \
        --visibility public
    
    # Add repository topics
    gh repo edit "${GITHUB_USERNAME}/${REPO_NAME}" \
        --add-topic "electrical-estimation" \
        --add-topic "construction-ai" \
        --add-topic "monday-com" \
        --add-topic "n8n-workflows" \
        --add-topic "nec-compliance" \
        --add-topic "saas-platform" \
        --add-topic "react" \
        --add-topic "nodejs" \
        --add-topic "postgresql" \
        --add-topic "render-com"
    
    echo -e "${GREEN}✅ Repository settings configured${NC}"
}

# Create repository secrets for deployment
create_deployment_secrets() {
    echo -e "${BLUE}🔐 Setting up deployment secrets...${NC}"
    
    echo -e "${YELLOW}💡 You'll need to add these secrets to your GitHub repository:${NC}"
    echo ""
    echo -e "${BLUE}Repository Secrets (Settings > Secrets and variables > Actions):${NC}"
    echo "• RENDER_API_TOKEN - Your Render.com API token"
    echo "• OPENAI_API_KEY - Your OpenAI API key"
    echo "• ELECTRICALAI_API_KEY - Your ElectricalAI API key"
    echo "• MONDAY_API_TOKEN - Your Monday.com API token"
    echo ""
    echo -e "${YELLOW}These secrets are required for automated deployment via GitHub Actions${NC}"
}

# Display success summary
display_success_summary() {
    echo -e "${GREEN}"
    echo "🎉 GitHub Repository Setup Complete!"
    echo "===================================="
    echo -e "${NC}"
    echo -e "${BLUE}📊 Repository Details:${NC}"
    echo -e "${GREEN}✅ Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
    echo -e "${GREEN}✅ Visibility: Public${NC}"
    echo -e "${GREEN}✅ Issues: Enabled${NC}"
    echo -e "${GREEN}✅ Projects: Enabled${NC}"
    echo -e "${GREEN}✅ Wiki: Enabled${NC}"
    echo -e "${GREEN}✅ Topics: Added for discoverability${NC}"
    echo ""
    echo -e "${BLUE}🔗 Quick Links:${NC}"
    echo "• Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
    echo "• Clone URL: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    echo "• Issues: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/issues"
    echo "• Actions: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/actions"
    echo "• Settings: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/settings"
    echo ""
    echo -e "${BLUE}📚 Next Steps:${NC}"
    echo "1. Add deployment secrets in GitHub repository settings"
    echo "2. Review and customize README.md if needed"
    echo "3. Set up branch protection rules for main branch"
    echo "4. Configure GitHub Actions for automated deployment"
    echo "5. Deploy to production using render.yaml configuration"
    echo ""
    echo -e "${BLUE}🚀 Deployment Commands:${NC}"
    echo "# Clone repository anywhere:"
    echo "git clone https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    echo ""
    echo "# Deploy to production:"
    echo "cd ${REPO_NAME}"
    echo "./deploy-full-system.sh"
    echo ""
    echo -e "${GREEN}🎊 Your ElectricalAI Pro system is now on GitHub and ready for production deployment!${NC}"
}

# Main execution function
main() {
    echo -e "${BLUE}🚀 ElectricalAI Pro GitHub Setup${NC}"
    echo ""
    
    # Run setup steps
    check_github_cli
    authenticate_github
    get_repo_details
    create_github_repo
    configure_git_remote
    check_git_status
    push_to_github
    configure_repo_settings
    create_deployment_secrets
    display_success_summary
    
    echo -e "${GREEN}✅ GitHub repository setup completed successfully!${NC}"
}

# Execute main function
main "$@"