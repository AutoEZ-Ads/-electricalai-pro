#!/bin/bash

# 🚀 Push ElectricalAI Pro to GitHub
# Run this after creating your repository on GitHub.com

echo "🚀 Pushing ElectricalAI Pro to GitHub"
echo "====================================="

# Get the GitHub username from user
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [[ -z "$GITHUB_USERNAME" ]]; then
    echo "❌ GitHub username is required"
    exit 1
fi

echo "📡 Setting up remote origin..."
git remote add origin https://github.com/${GITHUB_USERNAME}/electricalai-pro.git

echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "✅ Successfully pushed to GitHub!"
echo "🔗 Your repository: https://github.com/${GITHUB_USERNAME}/electricalai-pro"
echo ""
echo "🎉 Next steps:"
echo "1. Visit your repository on GitHub"
echo "2. Add repository secrets for deployment"
echo "3. Deploy to production with ./deploy-full-system.sh"