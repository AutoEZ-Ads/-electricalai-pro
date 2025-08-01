# 🚀 N8N Deployment Guide for ElectricalAI Pro
## Complete setup for local Docker and Render.com deployment

---

## 📋 Overview

This guide provides complete instructions for deploying N8N workflow automation for ElectricalAI Pro in multiple environments:
- **Local Docker Development**
- **Render.com Production Deployment**
- **Custom Node Integration**

---

## 🐳 Local Docker Deployment

### **1. Prerequisites**
- Docker Desktop installed and running
- Git repository cloned
- Port 5678 available

### **2. Quick Start**
```bash
# Navigate to n8n directory
cd n8n

# Copy environment template
cp .env.n8n .env

# Start N8N with Docker Compose
docker-compose -f docker-compose.n8n.yml up -d

# View logs
docker-compose -f docker-compose.n8n.yml logs -f n8n

# Access N8N
# URL: http://localhost:5678
# Username: admin
# Password: electricalai_admin
```

### **3. Service Architecture**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   N8N Main      │────▶│  PostgreSQL DB  │     │     Redis       │
│  (Port 5678)    │     │  (Port 5433)    │     │  (Port 6380)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                                │
         └──────────────────────┬────────────────────────┘
                                │
                       ┌────────▼────────┐
                       │   N8N Worker    │
                       │  (Queue Mode)   │
                       └─────────────────┘
```

### **4. Custom Node Installation**
```bash
# Enter N8N container
docker exec -it n8n-app sh

# Navigate to custom nodes directory
cd /home/node/.n8n/custom

# Install dependencies
npm install

# Restart N8N to load custom nodes
docker-compose -f docker-compose.n8n.yml restart n8n
```

---

## 🌐 Render.com Deployment

### **1. Prerequisites**
- Render.com account
- GitHub repository connected
- Environment variables configured

### **2. Deployment Steps**

#### **Step 1: Create Render Blueprint**
```bash
# In your repository root
cp n8n/render.yaml render.yaml

# Commit and push
git add render.yaml
git commit -m "Add Render deployment configuration"
git push origin main
```

#### **Step 2: Deploy on Render**
1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository with `render.yaml`
5. Click "Apply" to create all services

#### **Step 3: Configure Environment Variables**
In Render Dashboard, set these environment variables:

```bash
# ElectricalAI Pro Integration
ELECTRICALAI_API_URL=https://api.electricalai.pro
ELECTRICALAI_API_KEY=your_production_api_key

# External Services
OPENAI_API_KEY=sk-your-openai-key
CLAUDE_API_KEY=your-claude-key

# Email Configuration
N8N_SMTP_HOST=smtp.sendgrid.net
N8N_SMTP_USER=apikey
N8N_SMTP_PASS=your-sendgrid-api-key
```

#### **Step 4: Configure Custom Domain**
1. In Render Dashboard → Web Service → Settings
2. Add custom domain: `n8n.electricalai.pro`
3. Configure DNS CNAME: `n8n.electricalai.pro` → `electricalai-n8n.onrender.com`

### **3. Service URLs**
- **N8N Interface**: https://n8n.electricalai.pro
- **Webhook Base**: https://n8n.electricalai.pro/webhook/
- **Health Check**: https://n8n.electricalai.pro/healthz

---

## 🔧 N8N Workflows Configuration

### **1. Core Workflows**

#### **Electrical Estimation Workflow**
```json
{
  "name": "ElectricalAI Estimation Pipeline",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "electrical-estimation",
        "method": "POST"
      }
    },
    {
      "name": "Load Calculator",
      "type": "@custom-nodes/electrical.LoadCalculator",
      "parameters": {
        "projectType": "={{$json.projectType}}",
        "squareFootage": "={{$json.squareFootage}}"
      }
    },
    {
      "name": "AI Cost Analysis",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "operation": "completion",
        "prompt": "Analyze electrical costs for: {{$json}}"
      }
    },
    {
      "name": "Save to Database",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert",
        "table": "estimations"
      }
    }
  ]
}
```

#### **Floor Plan Analysis Workflow**
```json
{
  "name": "Floor Plan AI Analysis",
  "nodes": [
    {
      "name": "File Upload Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "floor-plan-upload",
        "method": "POST",
        "binaryData": true
      }
    },
    {
      "name": "Extract Image",
      "type": "n8n-nodes-base.moveBinaryData",
      "parameters": {
        "mode": "binaryToJson"
      }
    },
    {
      "name": "AI Vision Analysis",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "resource": "vision",
        "operation": "analyze"
      }
    },
    {
      "name": "Generate Markup",
      "type": "@custom-nodes/electrical.FloorPlanMarkup",
      "parameters": {
        "analysisData": "={{$json}}"
      }
    }
  ]
}
```

### **2. Integration Endpoints**

#### **ElectricalAI Pro Backend Integration**
```javascript
// Webhook endpoints for N8N
const n8nEndpoints = {
  estimation: 'https://n8n.electricalai.pro/webhook/electrical-estimation',
  floorPlan: 'https://n8n.electricalai.pro/webhook/floor-plan-upload',
  compliance: 'https://n8n.electricalai.pro/webhook/nec-compliance-check',
  reporting: 'https://n8n.electricalai.pro/webhook/generate-report'
};

// Example API call from backend
async function triggerN8NWorkflow(workflowPath, data) {
  const response = await fetch(`${N8N_WEBHOOK_URL}/webhook/${workflowPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

---

## 📊 Monitoring & Maintenance

### **1. Health Monitoring**
```bash
# Check N8N health
curl https://n8n.electricalai.pro/healthz

# Check database connectivity
docker exec n8n-postgres pg_isready

# View execution history
docker exec -it n8n-app n8n execute:list
```

### **2. Backup Strategy**
```bash
# Backup N8N data
docker exec n8n-postgres pg_dump -U n8n_user n8n_db > n8n_backup_$(date +%Y%m%d).sql

# Backup workflows
docker cp n8n-app:/home/node/.n8n/workflows ./backups/workflows_$(date +%Y%m%d)

# Restore from backup
docker exec -i n8n-postgres psql -U n8n_user n8n_db < n8n_backup_20250731.sql
```

### **3. Performance Optimization**
```javascript
// Configure worker pool for heavy workloads
const workerConfig = {
  executions: {
    mode: 'queue',
    concurrency: 10,
    timeout: 300000, // 5 minutes
    maxConsecutiveFailures: 3
  },
  queue: {
    bull: {
      redis: {
        host: 'n8n-redis',
        port: 6379
      },
      queueRecoveryInterval: 60000
    }
  }
};
```

---

## 🔐 Security Configuration

### **1. Authentication Setup**
```bash
# Generate secure passwords
N8N_BASIC_AUTH_PASSWORD=$(openssl rand -base64 32)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update environment variables
echo "N8N_BASIC_AUTH_PASSWORD=$N8N_BASIC_AUTH_PASSWORD" >> .env
echo "N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY" >> .env
```

### **2. Webhook Security**
```javascript
// Validate webhook signatures
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```

### **3. API Rate Limiting**
```yaml
# In render.yaml, add rate limiting
envVars:
  - key: N8N_RATE_LIMIT_ENABLED
    value: "true"
  - key: N8N_RATE_LIMIT_MAX_REQUESTS
    value: "100"
  - key: N8N_RATE_LIMIT_WINDOW_MS
    value: "900000"
```

---

## 🚀 Quick Commands

### **Local Development**
```bash
# Start all services
docker-compose -f docker-compose.n8n.yml up -d

# Stop all services
docker-compose -f docker-compose.n8n.yml down

# View logs
docker-compose -f docker-compose.n8n.yml logs -f

# Access N8N CLI
docker exec -it n8n-app n8n

# Reset N8N
docker-compose -f docker-compose.n8n.yml down -v
docker-compose -f docker-compose.n8n.yml up -d
```

### **Production (Render)**
```bash
# Deploy updates
git push origin main

# View logs (in Render Dashboard)
# Services → electricalai-n8n → Logs

# Manual restart
# Services → electricalai-n8n → Manual Deploy
```

---

## 📞 Support & Troubleshooting

### **Common Issues**

**Database Connection Failed**
```bash
# Check PostgreSQL status
docker-compose -f docker-compose.n8n.yml ps
docker-compose -f docker-compose.n8n.yml logs n8n-postgres
```

**Custom Nodes Not Loading**
```bash
# Rebuild custom nodes
docker exec -it n8n-app sh -c "cd /home/node/.n8n/custom && npm install"
docker-compose -f docker-compose.n8n.yml restart n8n
```

**Webhook Not Receiving Data**
```bash
# Test webhook endpoint
curl -X POST http://localhost:5678/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### **Performance Issues**
1. Enable queue mode for heavy workloads
2. Add more worker instances
3. Increase PostgreSQL connection pool
4. Monitor Redis memory usage

---

## 🎯 Next Steps

1. **Import ElectricalAI Workflows**: Use N8N UI to import pre-built workflows
2. **Configure Integrations**: Set up connections to ElectricalAI Pro API
3. **Test Automation**: Run test workflows with sample data
4. **Monitor Performance**: Set up alerts for failed executions
5. **Scale as Needed**: Add workers for increased load

---

**🚀 N8N is now ready to power ElectricalAI Pro's workflow automation!**