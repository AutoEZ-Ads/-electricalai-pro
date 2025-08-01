# 🚀 N8N Workflow Import Guide for ElectricalAI Pro

## 📋 Available Workflows

### 1. Electrical Estimation Pipeline
**File**: `electrical-estimation-workflow.json`
**Purpose**: Complete electrical load calculation and cost estimation
**Webhook**: `http://localhost:5678/webhook/electrical-estimation`

### 2. Floor Plan Analysis
**File**: `floor-plan-analysis-workflow.json` 
**Purpose**: AI-powered floor plan analysis with electrical markup
**Webhook**: `http://localhost:5678/webhook/floor-plan-upload`

---

## 📥 How to Import Workflows

### Step 1: Access N8N Interface
1. Open http://localhost:5678
2. Login with your credentials:
   - Email: yudi@adsezs.com
   - Password: NightHunter13#

### Step 2: Import Workflow
1. Click the **"+"** button in the top right
2. Select **"Import from file"**
3. Navigate to `/Users/yudilunger/Desktop/electrical-estimation-system/n8n/workflows/`
4. Select the workflow JSON file
5. Click **"Import"**

### Step 3: Configure Credentials
You'll need to set up these credentials:

#### PostgreSQL Database
- **Name**: `ElectricalAI Database`
- **Host**: `localhost`
- **Port**: `5440`
- **Database**: `n8n_db`
- **User**: `n8n_user`
- **Password**: Check your `.env` file

#### OpenAI API
- **Name**: `ElectricalAI OpenAI`
- **API Key**: Your OpenAI API key

### Step 4: Activate Workflow
1. Click the workflow name to open it
2. Click the toggle switch in the top right to **activate**
3. Workflow is now live and ready to receive webhooks

---

## 🧪 Testing the Workflows

### Test Electrical Estimation
```bash
curl -X POST http://localhost:5678/webhook/electrical-estimation \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "TEST-001",
    "projectType": "residential",
    "squareFootage": 2500,
    "complexityLevel": "standard",
    "location": "suburban",
    "specialRequirements": []
  }'
```

### Test Floor Plan Analysis
```bash
curl -X POST http://localhost:5678/webhook/floor-plan-upload \
  -H "Content-Type: multipart/form-data" \
  -F "projectId=FP-TEST-001" \
  -F "file=@/path/to/floor-plan.jpg"
```

---

## 🔧 Configuration Notes

### Environment Variables
Make sure these are set in your N8N environment:
- `ELECTRICALAI_API_URL`: Your ElectricalAI Pro API endpoint
- `ELECTRICALAI_API_KEY`: Your API authentication key
- `OPENAI_API_KEY`: OpenAI API key for floor plan analysis

### Database Tables
The workflows expect these tables to exist:
- `estimations`: For storing electrical estimates
- `floor_plan_analyses`: For storing floor plan analysis results

### License Key
Your N8N license key: `4d525856-ba2b-4346-b2cc-8839f18c425b`

---

## 📊 Workflow Features

### Electrical Estimation Pipeline
- **NEC 2023 Compliant** load calculations
- **Historical data calibration** for accuracy
- **Material and labor cost estimation**
- **Risk assessment** based on project complexity
- **Database persistence** for tracking

### Floor Plan Analysis
- **AI Vision processing** with OpenAI GPT-4V
- **Electrical symbol recognition**
- **Code compliance checking** (NEC requirements)
- **Construction guide generation** with grid coordinates
- **Field crew instructions** with safety protocols

---

## 🚀 Next Steps

1. **Import both workflows** into N8N
2. **Configure all credentials** (Database, OpenAI)
3. **Test with sample data** using the curl commands above
4. **Integrate with your frontend** by calling the webhook URLs
5. **Monitor executions** in N8N dashboard

The workflows are now ready to power ElectricalAI Pro's automation! 🎉