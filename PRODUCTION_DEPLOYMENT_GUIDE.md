# 🚀 ElectricalAI Pro Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the complete ElectricalAI Pro system to production, including the N8N workflow automation platform and Monday.com marketplace app.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Monday.com    │────│   N8N Workflows │────│  ElectricalAI   │
│  Marketplace    │    │   (Render.com)  │    │   API System    │
│      App        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐             ┌─────────┐
    │ React   │            │ N8N UI  │             │  AI/ML  │
    │Frontend │            │Database │             │Services │
    └─────────┘            └─────────┘             └─────────┘
```

## Prerequisites

### Required Accounts
- [Render.com](https://render.com) account for N8N deployment
- [Monday.com](https://monday.com) developer account
- GitHub account for repository hosting
- OpenAI API key for AI services
- ElectricalAI Pro API credentials

### Required Tools
- Node.js 18+ and npm
- Docker and Docker Compose
- Git
- Render CLI (will be installed automatically)

### Required Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Render.com Configuration
RENDER_API_TOKEN=your_render_api_token_here

# N8N Configuration
N8N_HOST=electricalai-n8n.onrender.com
N8N_PROTOCOL=https
N8N_PORT=5678

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
ELECTRICALAI_API_KEY=your_electricalai_api_key_here
MONDAY_API_TOKEN=your_monday_api_token_here

# Database Configuration (managed by Render)
DB_TYPE=postgresdb
NODE_ENV=production

# Security
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_secure_password_here
```

## Phase 1: N8N Workflow System Deployment

### Step 1: Prepare Environment

```bash
# 1. Source environment variables
source .env.production

# 2. Validate environment
echo "Checking environment variables..."
echo "RENDER_API_TOKEN: ${RENDER_API_TOKEN:0:10}..."
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "ELECTRICALAI_API_KEY: ${ELECTRICALAI_API_KEY:0:10}..."
```

### Step 2: Deploy N8N to Production

```bash
# Execute the production deployment script
./deploy-n8n-production.sh
```

This script will:
- ✅ Install Render CLI
- ✅ Authenticate with Render.com
- ✅ Deploy N8N main service
- ✅ Deploy N8N worker service
- ✅ Set up PostgreSQL database
- ✅ Configure Redis cache
- ✅ Import 5 production workflows
- ✅ Test all webhook endpoints

### Step 3: Verify N8N Deployment

After deployment, verify these endpoints are accessible:

```bash
# Health check
curl https://electricalai-n8n.onrender.com/healthz

# Webhook endpoints
curl -X POST https://electricalai-n8n.onrender.com/webhook/electrical-estimation
curl -X POST https://electricalai-n8n.onrender.com/webhook/floor-plan-upload
curl -X POST https://electricalai-n8n.onrender.com/webhook/nec-compliance-check
curl -X POST https://electricalai-n8n.onrender.com/webhook/material-cost-update
curl -X POST https://electricalai-n8n.onrender.com/webhook/project-progress-update
```

## Phase 2: Monday.com App Deployment

### Step 1: Build Production App

```bash
# Navigate to Monday app directory
cd monday-app

# Install dependencies
npm install

# Build production version
npm run build
```

### Step 2: Deploy to Monday.com

```bash
# Deploy using Monday CLI
npm run deploy
```

### Step 3: Configure Monday.com Integration

1. **Create Monday.com Developer App:**
   - Go to [Monday.com Developer Center](https://developer.monday.com)
   - Create new app: "ElectricalAI Pro"
   - Add required scopes: `boards:read`, `boards:write`, `items:read`, `items:write`

2. **Configure App Views:**
   - Item View: `/item-view` (Project estimator)
   - Board View: `/board-view` (Dashboard)
   - Integration View: `/integration-view` (N8N configuration)

3. **Set Webhook URLs:**
   - Primary webhook: `https://electricalai-n8n.onrender.com/webhook/electrical-estimation`
   - Integration webhook: `https://your-monday-app.onrender.com/webhook/monday`

## Phase 3: System Integration Testing

### Step 1: End-to-End Testing

```bash
# Run integration tests
cd monday-app
npm test

# Run E2E tests
npm run test:e2e
```

### Step 2: Load Testing

```bash
# Test N8N system under load
cd ../testing
python comprehensive-load-testing.py
```

### Step 3: Workflow Testing

Test each workflow with sample data:

```javascript
// Electrical Estimation Test
const estimationPayload = {
  projectType: "residential",
  squareFootage: 2500,
  complexityLevel: "standard",
  location: "suburban"
};

// Floor Plan Analysis Test
const floorPlanPayload = {
  projectId: "test-project-001",
  metadata: { type: "residential", sqft: 2500 },
  floorPlanFile: "base64_encoded_image_data"
};

// NEC Compliance Test
const compliancePayload = {
  projectId: "test-project-001",
  specifications: {
    circuits: 20,
    amperage: 200,
    voltage: 240
  }
};
```

## Phase 4: Production Monitoring

### Step 1: Set Up Monitoring

```bash
# Deploy monitoring stack
./monitoring/deploy-monitoring.sh
```

### Step 2: Configure Alerts

Set up alerts for:
- N8N service health
- Workflow execution failures
- Database connection issues
- API rate limits
- Response time degradation

### Step 3: Log Monitoring

Monitor logs in Render dashboard:
- N8N application logs
- Database query logs
- Worker process logs
- Error tracking

## Phase 5: Monday.com Marketplace Submission

### Step 1: Prepare Submission Package

```bash
# Generate submission assets
cd monday-app
npm run build:marketplace
```

### Step 2: Submit to Marketplace

1. **App Store Listing:**
   - Name: "ElectricalAI Pro"
   - Category: Construction & Engineering
   - Description: AI-powered electrical estimation
   - Screenshots: Include dashboard and estimation views
   - Pricing: $49/month per user

2. **Review Process:**
   - Submit app through Monday.com developer portal
   - Provide demo account credentials
   - Include technical documentation
   - Wait for approval (typically 2-3 weeks)

## Production URLs

After successful deployment:

- **N8N Main Service:** `https://electricalai-n8n.onrender.com`
- **N8N Admin UI:** `https://electricalai-n8n.onrender.com/admin`
- **Monday.com App:** Accessible through Monday.com marketplace
- **Monitoring Dashboard:** `https://electricalai-monitoring.onrender.com`

## Available Workflows

1. **Electrical Estimation** (`/webhook/electrical-estimation`)
   - Calculates project costs and materials
   - NEC 2023 compliance checking
   - Real-time material pricing

2. **Floor Plan Analysis** (`/webhook/floor-plan-upload`)
   - AI-powered floor plan parsing
   - Outlet and fixture detection
   - Load calculation automation

3. **NEC Compliance Check** (`/webhook/nec-compliance-check`)
   - Automated code compliance validation
   - Safety requirement verification
   - Report generation

4. **Material Cost Tracking** (`/webhook/material-cost-update`)
   - Real-time copper pricing (COMEX)
   - Regional cost adjustments
   - Supplier integration

5. **Progress Monitoring** (`/webhook/project-progress-update`)
   - Project milestone tracking
   - Performance analytics
   - Automated reporting

## Support and Maintenance

### Daily Operations
- Monitor system health dashboards
- Review error logs and alerts
- Update material cost databases
- Process customer feedback

### Weekly Tasks
- Review system performance metrics
- Update workflow configurations
- Process Monday.com app reviews
- Analyze usage patterns

### Monthly Tasks
- Update NEC compliance rules
- Review and optimize workflows
- Analyze customer churn and engagement
- Plan feature updates

## Troubleshooting

### Common Issues

1. **N8N Deployment Fails**
   ```bash
   # Check Render logs
   render logs --service electricalai-n8n
   
   # Verify environment variables
   render env list --service electricalai-n8n
   ```

2. **Monday.com App Not Loading**
   ```bash
   # Check build logs
   npm run build --verbose
   
   # Verify Monday SDK configuration
   npm run test:monday
   ```

3. **Workflow Execution Errors**
   ```bash
   # Check N8N execution logs
   curl https://electricalai-n8n.onrender.com/api/v1/executions
   
   # Test individual workflows
   npm run test:workflows
   ```

### Performance Optimization

1. **Database Optimization**
   - Index frequently queried columns
   - Archive old execution data
   - Monitor connection pool usage

2. **N8N Optimization**
   - Scale worker processes
   - Optimize workflow logic
   - Cache frequent calculations

3. **Monday.com App Optimization**
   - Minimize API calls
   - Implement client-side caching
   - Optimize bundle size

## Security Considerations

- All API keys are encrypted at rest
- HTTPS enforced for all communications
- Rate limiting implemented on all endpoints
- Regular security updates and patches
- GDPR compliance for EU users
- Complete audit trail logging

## Success Metrics

Track these KPIs post-deployment:

- **System Reliability:** 99.9% uptime
- **Workflow Success Rate:** >95% successful executions
- **Response Time:** <2 seconds average
- **User Adoption:** Track active users in Monday.com
- **Customer Satisfaction:** NPS score >70
- **Revenue Growth:** Monthly recurring revenue tracking

---

## 🎉 Deployment Complete!

Your ElectricalAI Pro system is now live in production with:

✅ **5 AI-powered workflows** running on N8N
✅ **Monday.com marketplace app** for user interaction  
✅ **Production-grade infrastructure** on Render.com
✅ **Comprehensive monitoring** and alerting
✅ **End-to-end testing** suite
✅ **NEC 2023 compliance** checking
✅ **Real-time material cost** tracking

**Next Steps:** Monitor system performance, gather user feedback, and iterate on features based on customer needs.

---

*🚀 Generated with [Claude Code](https://claude.ai/code)*

*Co-Authored-By: Claude <noreply@anthropic.com>*