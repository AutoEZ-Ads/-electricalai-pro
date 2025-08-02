# GitHub Personal Access Token Setup

## You Need a Personal Access Token (Passwords Don't Work Anymore)

### Quick Steps to Create Token:

1. **Go to**: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. **Note**: "ElectricalAI Deployment"
4. **Expiration**: 90 days (or your preference)
5. **Select scopes**: 
   - ✅ **repo** (Full control of private repositories)
6. Click **"Generate token"**
7. **COPY THE TOKEN NOW!** (You won't see it again)

### Use the Token:

When pushing to GitHub:
- **Username**: autoezads
- **Password**: [PASTE YOUR TOKEN HERE]

### Push Commands:

```bash
cd ~/Desktop/electrical-estimation-system
git push -u origin production
# Enter username: autoezads
# Enter password: [YOUR_PERSONAL_ACCESS_TOKEN]

# Also push main branch
git push -u origin main
```

## Alternative: Use GitHub CLI

```bash
# Install GitHub CLI
brew install gh

# Login
gh auth login

# Then push normally
git push -u origin production
```

**SECURITY REMINDER**: Change your GitHub password immediately since it was shared in chat!