#!/bin/bash

# 🔧 Fix GitHub Repository for Render Deployment
# This script helps resolve the "empty repository" error

echo "🔧 Fixing GitHub Repository for Render Deployment"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Current situation:${NC}"
echo "• GitHub repository exists: https://github.com/autoezads/electricalai-pro"
echo "• Repository is empty (no commits)"
echo "• Render can't deploy from empty repository"
echo "• Your complete ElectricalAI Pro system is ready locally"
echo ""

echo -e "${BLUE}🔍 Checking local repository status...${NC}"
echo "Local commits: $(git rev-list --count HEAD)"
echo "Local files: $(find . -type f | wc -l) files ready to push"
echo "Current branch: $(git branch --show-current)"
echo ""

echo -e "${BLUE}📊 What you have locally:${NC}"
echo "✅ Complete ElectricalAI Pro system (108+ files)"
echo "✅ Backend API with Node.js/Express"
echo "✅ Frontend React dashboard"
echo "✅ N8N workflow automation (5 AI workflows)"
echo "✅ Monday.com marketplace app"
echo "✅ Production deployment configuration (render.yaml)"
echo "✅ All business materials and documentation"
echo ""

echo -e "${YELLOW}🎯 SOLUTION: Push your code to GitHub${NC}"
echo ""
echo -e "${BLUE}Option 1: Manual GitHub Setup${NC}"
echo "1. Go to https://github.com/autoezads/electricalai-pro"
echo "2. Make sure you're signed in to the 'autoezads' account"
echo "3. If the repository is private, make it public:"
echo "   - Go to Settings → General → Danger Zone"
echo "   - Click 'Change repository visibility'"
echo "   - Select 'Make public'"
echo "4. Copy the clone URL from the repository page"
echo ""

echo -e "${BLUE}Option 2: Try push with different method${NC}"
echo "Run these commands one by one:"
echo ""
echo "# Remove existing remote"
echo "git remote remove origin"
echo ""
echo "# Add remote again"
echo "git remote add origin https://github.com/autoezads/electricalai-pro.git"
echo ""
echo "# Force push (if needed)"
echo "git push -u origin main --force"
echo ""

echo -e "${BLUE}Option 3: Create new repository${NC}"
echo "If access issues persist:"
echo "1. Create a new repository with a different name"
echo "2. Use: 'electricalai-platform' or 'electrical-estimation-ai'"
echo "3. Update Render to use the new repository"
echo ""

echo -e "${GREEN}💡 After successful push:${NC}"
echo "1. Visit: https://github.com/autoezads/electricalai-pro"
echo "2. Verify all your files are there (108+ files)"
echo "3. Go back to Render and retry deployment"
echo "4. Render will now see your complete system and deploy successfully"
echo ""

echo -e "${BLUE}🚀 Expected result after push:${NC}"
echo "• Repository will show complete project structure"
echo "• README.md will display project information"
echo "• Render deployment will work immediately"
echo "• Your \$25K+ MRR SaaS platform will be live!"
echo ""

read -p "Press Enter to continue or Ctrl+C to exit..."

echo -e "${BLUE}🔄 Attempting to push now...${NC}"

# Try to push
if git push -u origin main; then
    echo -e "${GREEN}✅ SUCCESS! Code pushed to GitHub${NC}"
    echo ""
    echo -e "${BLUE}🎉 Next steps:${NC}"
    echo "1. Visit: https://github.com/autoezads/electricalai-pro"
    echo "2. Verify your files are there"
    echo "3. Return to Render and retry deployment"
    echo "4. Your ElectricalAI Pro system will deploy successfully!"
else
    echo -e "${RED}❌ Push failed${NC}"
    echo ""
    echo -e "${YELLOW}Possible solutions:${NC}"
    echo "1. Check if you're signed in to the correct GitHub account"
    echo "2. Verify repository permissions"
    echo "3. Make sure repository is public"
    echo "4. Try creating a new repository with a different name"
    echo ""
    echo -e "${BLUE}Manual commands to try:${NC}"
    echo "git remote -v  # Check current remotes"
    echo "git remote remove origin"
    echo "git remote add origin https://github.com/autoezads/electricalai-pro.git"
    echo "git push -u origin main --force"
fi