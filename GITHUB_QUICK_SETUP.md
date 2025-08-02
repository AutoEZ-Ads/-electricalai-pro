# GitHub Repository Setup - Quick Guide

## Option 1: Create New Repository (Recommended)

### Step 1: Create Repository on GitHub
1. Go to https://github.com/new
2. Repository name: `electricalai-pro`
3. Description: "Professional electrical estimation system with AI-powered calculations"
4. Make it **Private** initially
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Push Your Code
Run these commands in your Mac Terminal:

```bash
cd ~/Desktop/electrical-estimation-system

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/electricalai-pro.git

# Push production branch
git push -u origin production

# Push main branch too
git checkout main
git push -u origin main

# Switch back to production
git checkout production
```

## Option 2: Use Existing Repository

If you already have a repository:

```bash
cd ~/Desktop/electrical-estimation-system

# Set the remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push production branch
git push -u origin production
```

## Option 3: Quick Deploy with GitHub CLI

If you have GitHub CLI installed:

```bash
cd ~/Desktop/electrical-estimation-system

# Create and push in one command
gh repo create electricalai-pro --private --source=. --remote=origin --push
```

## After Pushing to GitHub

1. **Verify Push Success**
   - Go to your GitHub repository
   - Check that both `main` and `production` branches exist
   - Verify all files are present

2. **Connect to Render**
   - In Render dashboard, click "New +" → "Web Service"
   - Connect your GitHub account
   - Select your repository
   - Choose the `production` branch
   - Deploy!

## Troubleshooting

### Authentication Failed
```bash
# Use personal access token instead of password
# Create token at: https://github.com/settings/tokens
git push -u origin production
# Enter username and token (not password)
```

### Permission Denied
```bash
# Check your SSH keys
ssh -T git@github.com

# Or use HTTPS with credentials
git remote set-url origin https://github.com/USERNAME/REPO.git
```

## Emergency Backup Location
Your backup is saved at:
`~/Desktop/electrical-backup-20250802-025629.tar.gz`

## Next Steps
1. Push to GitHub ✓
2. Set up Render services
3. Configure environment variables
4. Deploy Monday.com app
5. Test production endpoints

---
**Remember**: Never commit sensitive data like API keys or passwords!