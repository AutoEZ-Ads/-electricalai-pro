// 🚀 ElectricalAI Pro Production Webhook Configuration
// Update all webhook URLs to use your live production endpoints

const webhookConfig = {
  // Production N8N Webhook Endpoints
  electricalEstimation: 'https://electricalai-n8n.onrender.com/webhook/electrical-estimation',
  floorPlanAnalysis: 'https://electricalai-n8n.onrender.com/webhook/floor-plan-upload',
  necCompliance: 'https://electricalai-n8n.onrender.com/webhook/nec-compliance-check',
  materialCostTracking: 'https://electricalai-n8n.onrender.com/webhook/material-cost-update',
  progressMonitoring: 'https://electricalai-n8n.onrender.com/webhook/project-progress-update',
  
  // Production API Endpoints
  backendAPI: 'https://electricalai-pro.onrender.com',
  healthCheck: 'https://electricalai-pro.onrender.com/health',
  apiEstimations: 'https://electricalai-pro.onrender.com/api/estimations',
  apiProjects: 'https://electricalai-pro.onrender.com/api/projects',
  
  // N8N System URLs
  n8nAdmin: 'https://electricalai-n8n.onrender.com',
  n8nHealthCheck: 'https://electricalai-n8n.onrender.com/healthz',
  
  // Frontend URLs
  frontend: 'https://electricalai-frontend.onrender.com',
  mondayApp: 'https://electricalai-monday-app.onrender.com'
};

// Production Environment Configuration
const productionConfig = {
  environment: 'production',
  apiVersion: 'v1',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  
  // Authentication (will be set via environment variables)
  apiKey: process.env.ELECTRICALAI_API_KEY,
  mondayToken: process.env.MONDAY_API_TOKEN,
  openaiKey: process.env.OPENAI_API_KEY,
  
  // Rate limiting
  rateLimitRequests: 100,
  rateLimitWindow: 60000, // 1 minute
  
  // Webhook security
  webhookSecret: process.env.WEBHOOK_SECRET,
  
  // Database connections (managed by Render)
  database: {
    main: process.env.DATABASE_URL,
    n8n: process.env.N8N_DATABASE_URL
  },
  
  // Cache configuration
  redis: {
    main: process.env.REDIS_URL,
    n8n: process.env.N8N_REDIS_URL
  }
};

// Export configurations
module.exports = {
  webhookConfig,
  productionConfig
};

// Usage Examples:

// 1. Frontend JavaScript (React/Monday.com app)
const frontendConfig = {
  n8nWebhooks: {
    estimation: webhookConfig.electricalEstimation,
    floorPlan: webhookConfig.floorPlanAnalysis,
    compliance: webhookConfig.necCompliance,
    materialCost: webhookConfig.materialCostTracking,
    progress: webhookConfig.progressMonitoring
  },
  
  backendAPI: webhookConfig.backendAPI,
  
  // API call example
  async triggerEstimation(projectData) {
    const response = await fetch(webhookConfig.electricalEstimation, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${productionConfig.apiKey}`
      },
      body: JSON.stringify({
        ...projectData,
        timestamp: new Date().toISOString(),
        source: 'monday-app'
      })
    });
    
    return response.json();
  }
};

// 2. N8N Workflow Configuration
const n8nWorkflowConfig = {
  nodes: {
    webhook: {
      url: webhookConfig.electricalEstimation,
      method: 'POST',
      authentication: 'headerAuth',
      headerAuth: {
        name: 'X-API-Key',
        value: '={{$env.ELECTRICALAI_API_KEY}}'
      }
    },
    
    httpRequest: {
      url: webhookConfig.backendAPI + '/api/estimations',
      method: 'POST',
      authentication: 'headerAuth',
      sendQuery: false,
      sendHeaders: false,
      sendBody: true,
      contentType: 'json'
    }
  }
};

// 3. Monday.com App Configuration
const mondayAppConfig = {
  // Update your Monday app's environment variables
  envVars: {
    REACT_APP_N8N_WEBHOOK_BASE: 'https://electricalai-n8n.onrender.com',
    REACT_APP_BACKEND_API: webhookConfig.backendAPI,
    REACT_APP_ENVIRONMENT: 'production'
  },
  
  // Integration settings for Monday.com
  integrationSettings: {
    webhookUrl: webhookConfig.backendAPI + '/webhook/monday',
    apiEndpoint: webhookConfig.backendAPI + '/api/monday',
    n8nInstance: 'https://electricalai-n8n.onrender.com'
  }
};

// 4. Testing Configuration
const testingConfig = {
  endpoints: [
    {
      name: 'Backend Health Check',
      url: webhookConfig.healthCheck,
      expectedStatus: 200
    },
    {
      name: 'N8N Health Check', 
      url: webhookConfig.n8nHealthCheck,
      expectedStatus: 200
    },
    {
      name: 'Electrical Estimation Webhook',
      url: webhookConfig.electricalEstimation,
      method: 'POST',
      testPayload: {
        projectType: 'residential',
        squareFootage: 2500,
        complexityLevel: 'standard',
        location: 'suburban'
      }
    },
    {
      name: 'Floor Plan Analysis Webhook',
      url: webhookConfig.floorPlanAnalysis,
      method: 'POST',
      testPayload: {
        projectId: 'test-001',
        metadata: { type: 'residential', sqft: 2500 }
      }
    }
  ]
};

console.log('🚀 ElectricalAI Pro Production Webhook Configuration Loaded');
console.log('📊 Available Endpoints:');
console.log('• Backend API:', webhookConfig.backendAPI);
console.log('• N8N System:', webhookConfig.n8nAdmin);
console.log('• Webhooks:', Object.keys(webhookConfig).filter(k => k.includes('webhook') || k.includes('Estimation') || k.includes('Analysis')).length, 'endpoints configured');

// Export all configurations
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    webhookConfig,
    productionConfig,
    frontendConfig,
    n8nWorkflowConfig,
    mondayAppConfig,
    testingConfig
  };
}