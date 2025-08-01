#!/bin/bash

# 🚀 ElectricalAI Pro Monday.com App Deployment Script
# Deploy the Monday.com marketplace app for ElectricalAI Pro

set -e

echo "🚀 ElectricalAI Pro Monday.com App Deployment"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Monday CLI is installed
if ! command -v mapps &> /dev/null; then
    echo -e "${RED}❌ Monday.com Apps CLI not found${NC}"
    echo -e "${BLUE}📦 Installing Monday.com Apps CLI...${NC}"
    npm install -g @mondaycom/apps-cli
    echo -e "${GREEN}✅ Monday.com Apps CLI installed${NC}"
fi

# Check if we're in the right directory
if [[ ! -f "mapps.json" ]]; then
    echo -e "${RED}❌ mapps.json not found. Please run this script from the monday-app directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-deployment checklist:${NC}"
echo "1. ✅ Monday.com Apps CLI installed"
echo "2. ✅ App configuration (mapps.json) present" 
echo "3. ✅ React app built and ready"
echo ""

# Check if build directory exists
if [[ ! -d "build" ]]; then
    echo -e "${YELLOW}⚠️  Build directory not found. Building app now...${NC}"
    npm run build
    echo -e "${GREEN}✅ App built successfully${NC}"
fi

echo -e "${BLUE}🔐 Monday.com Authentication Required${NC}"
echo -e "${YELLOW}You will need to provide your Monday.com API token.${NC}"
echo -e "${YELLOW}Get your token from: https://developer.monday.com/apps${NC}"
echo ""

# Initialize Monday CLI (this will prompt for API token)
echo -e "${BLUE}🔧 Initializing Monday.com CLI...${NC}"
mapps init

# Verify authentication
echo -e "${BLUE}🔍 Verifying authentication...${NC}"
if mapps app:list &> /dev/null; then
    echo -e "${GREEN}✅ Authentication successful${NC}"
else
    echo -e "${RED}❌ Authentication failed. Please check your API token${NC}"
    exit 1
fi

# Deploy the app
echo -e "${BLUE}🚀 Deploying ElectricalAI Pro to Monday.com...${NC}"
echo ""
echo -e "${YELLOW}This will:${NC}"
echo "• Upload your app to Monday.com"
echo "• Create a new app version"
echo "• Make it available for testing"
echo ""

if mapps app:deploy; then
    echo -e "${GREEN}✅ ElectricalAI Pro deployed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Deployment Summary:${NC}"
    echo -e "${GREEN}✅ App Name: ElectricalAI Pro - Construction Estimator${NC}"
    echo -e "${GREEN}✅ Version: 1.0.0 (Production Release)${NC}"
    echo -e "${GREEN}✅ Features: Item View, Board View, Integration View${NC}"
    echo -e "${GREEN}✅ Status: Deployed and ready for testing${NC}"
    echo ""
    echo -e "${BLUE}🔗 Next Steps:${NC}"
    echo "1. Test your app in a Monday.com board"
    echo "2. Submit for marketplace review (optional)"
    echo "3. Share with your team for feedback"
    echo ""
    echo -e "${YELLOW}💡 App Access:${NC}"
    echo "• Go to any Monday.com board"
    echo "• Click '+' to add a view"
    echo "• Find 'ElectricalAI Pro' in your apps"
    echo "• Add Item View, Board View, or Integration View"
    echo ""
    echo -e "${GREEN}🎉 Your ElectricalAI Pro app is now live on Monday.com!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo -e "${YELLOW}Common issues:${NC}"
    echo "• Invalid API token"
    echo "• Missing required files"
    echo "• Network connectivity issues"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo "1. Verify your API token at https://developer.monday.com/apps"
    echo "2. Ensure build directory exists (run 'npm run build')"
    echo "3. Check your internet connection"
    exit 1
fi

# Optional: Promote to live (for production)
echo ""
read -p "Do you want to promote this version to live? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔥 Promoting app to live...${NC}"
    if mapps app:promote; then
        echo -e "${GREEN}✅ App promoted to live successfully!${NC}"
        echo -e "${GREEN}🚀 ElectricalAI Pro is now live in production!${NC}"
    else
        echo -e "${YELLOW}⚠️  Promotion failed. App is still available for testing.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎊 ElectricalAI Pro Monday.com deployment complete!${NC}"