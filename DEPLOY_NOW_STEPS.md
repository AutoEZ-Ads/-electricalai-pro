# 🚀 Deploy ElectricalAI Pro - Step by Step

## Step 1: Create GitHub Repository

### Open your web browser and:
1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `electricalai-pro`
   - **Description**: "Professional electrical estimation system with AI-powered calculations and Monday.com integration"
   - **Private/Public**: Choose based on your preference
   - ⚠️ **DO NOT** check "Initialize this repository with a README"
3. Click **"Create repository"**

## Step 2: Push Your Code

### Copy and run these commands in Mac Terminal:

```bash
# Navigate to your project
cd ~/Desktop/electrical-estimation-system

# Add the GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/electricalai-pro.git

# Push the production branch
git push -u origin production

# When prompted for credentials:
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_PERSONAL_ACCESS_TOKEN (not your GitHub password!)
```

### Need a Personal Access Token?
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "ElectricalAI Deployment"
4. Select scopes: `repo` (full control)
5. Click "Generate token"
6. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

## Step 3: Push All Branches

```bash
# Also push the main branch
git checkout main
git push -u origin main

# Switch back to production
git checkout production
```

## Step 4: Verify on GitHub
1. Go to https://github.com/YOUR_USERNAME/electricalai-pro
2. Check that you see:
   - ✅ All your files
   - ✅ Both `main` and `production` branches
   - ✅ Latest commit message

## Step 5: Deploy to Render

### A. Deploy Backend
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your `electricalai-pro` repository
5. Configure:
   - **Name**: `electricalai-backend`
   - **Branch**: `production`
   - **Root Directory**: `webapp/backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. Click **"Create Web Service"**

### B. Deploy Frontend
1. Click **"New +"** → **"Static Site"**
2. Select your repository again
3. Configure:
   - **Name**: `electricalai-frontend`
   - **Branch**: `production`
   - **Root Directory**: `webapp/frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Click **"Create Static Site"**

### C. Create PostgreSQL Database
1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `electricalai-db`
   - **Database**: Leave default
   - **User**: Leave default
3. Click **"Create Database"**
4. **COPY THE INTERNAL DATABASE URL** when it's ready

### D. Create Redis Instance
1. Click **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `electricalai-redis`
3. Click **"Create Redis"**
4. **COPY THE INTERNAL REDIS URL** when it's ready

## Step 6: Configure Environment Variables

### In your Backend Service:
1. Go to **Environment** tab
2. Add these variables:

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=[PASTE YOUR POSTGRESQL INTERNAL URL]
REDIS_URL=[PASTE YOUR REDIS INTERNAL URL]
FRONTEND_URL=https://electricalai-frontend.onrender.com
JWT_SECRET=your-super-secret-jwt-key-change-this
OPENAI_API_KEY=sk-...your-openai-key
```

### Monday.com variables (get from https://developers.monday.com):
```bash
MONDAY_CLIENT_ID=your_client_id
MONDAY_CLIENT_SECRET=your_client_secret
MONDAY_API_TOKEN=your_api_token
MONDAY_SIGNING_SECRET=your_signing_secret
MONDAY_REDIRECT_URI=https://electricalai-backend.onrender.com/auth/callback
```

## Step 7: Deploy Monday App

In Mac Terminal:
```bash
cd ~/Desktop/electrical-estimation-system/monday-app

# Install Monday CLI if not installed
npm install -g @mondaycom/apps-cli

# Login to Monday
mapps auth

# Push your app
mapps code:push

# Get installation link
mapps app:install
```

## Step 8: Test Everything

### 1. Check Backend Health:
```
https://electricalai-backend.onrender.com/health
```

### 2. Check Frontend:
```
https://electricalai-frontend.onrender.com
```

### 3. Test Monday Integration:
- Install the app using the link from `mapps app:install`
- Add to a test board
- Try uploading a blueprint

## 🎉 Success Checklist

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Backend deployed on Render
- [ ] Frontend deployed on Render
- [ ] Database created and connected
- [ ] Redis created and connected
- [ ] Environment variables configured
- [ ] Monday app deployed
- [ ] Health check passing
- [ ] Frontend loading
- [ ] Monday integration working

## 🆘 Troubleshooting

### "Permission denied" when pushing to GitHub
- Make sure you're using a Personal Access Token, not your password
- Check that the token has `repo` scope

### Backend not starting
- Check logs in Render dashboard
- Verify DATABASE_URL is correct
- Make sure all environment variables are set

### Frontend not building
- Check build logs in Render
- Verify no syntax errors in code

### Monday app not working
- Check webhook URL matches your backend URL
- Verify signing secret is correct
- Check Monday developer console for errors

## 📞 Quick Support

- **Render Issues**: Check logs in dashboard
- **GitHub Issues**: Verify credentials and repository settings
- **Monday Issues**: Check developer console
- **Database Issues**: Verify connection string format

---

**Your backup is safe at**: `~/Desktop/electrical-backup-20250802-025629.tar.gz`

**You're ready to launch! 🚀**