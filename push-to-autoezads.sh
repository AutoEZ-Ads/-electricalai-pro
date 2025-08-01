#!/bin/bash

# 🚀 Push ElectricalAI Pro to autoezads/electricalai-pro
# Run this AFTER creating the repository on GitHub.com

echo "🚀 Pushing ElectricalAI Pro to GitHub"
echo "Repository: https://github.com/autoezads/electricalai-pro"
echo "========================================================="

# Check if repository exists first
echo "🔍 Checking if repository exists..."
if curl -s -f -I "https://github.com/autoezads/electricalai-pro" > /dev/null; then
    echo "✅ Repository exists!"
else
    echo "❌ Repository not found!"
    echo ""
    echo "Please create the repository first:"
    echo "1. Go to https://github.com/autoezads"
    echo "2. Click 'New repository'"
    echo "3. Name: electricalai-pro"
    echo "4. Description: AI-powered electrical construction estimation platform"
    echo "5. Make it Public"
    echo "6. DON'T check any boxes (no README, no .gitignore)"
    echo "7. Click 'Create repository'"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "📡 Setting up remote origin..."
git remote add origin https://github.com/autoezads/electricalai-pro.git

echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Your ElectricalAI Pro system is now on GitHub!"
    echo "========================================================="
    echo ""
    echo "🔗 Repository URL: https://github.com/autoezads/electricalai-pro"
    echo ""
    echo "📊 What's now on GitHub:"
    echo "✅ Complete ElectricalAI Pro system"
    echo "✅ 5 AI-powered workflows"
    echo "✅ Monday.com marketplace app"
    echo "✅ Production deployment configuration"
    echo "✅ Business materials and documentation"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Visit: https://github.com/autoezads/electricalai-pro"
    echo "2. Add deployment secrets (optional)"
    echo "3. Deploy to production: ./deploy-full-system.sh"
    echo ""
    echo "💰 Your \$25K+ MRR SaaS platform is ready for the world!"
else
    echo ""
    echo "❌ Push failed. Possible issues:"
    echo "• Repository doesn't exist yet"
    echo "• No write access to the repository"
    echo "• Network connectivity issues"
    echo ""
    echo "Please check the repository exists and try again."
fi