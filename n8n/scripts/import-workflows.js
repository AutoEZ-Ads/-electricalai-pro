#!/usr/bin/env node

/**
 * ElectricalAI Pro N8N Workflow Import Script
 * Automatically imports all workflows and sets up credentials
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_AUTH_USER = process.env.N8N_BASIC_AUTH_USER || 'admin';
const N8N_AUTH_PASS = process.env.N8N_BASIC_AUTH_PASSWORD;
const WORKFLOWS_DIR = path.join(__dirname, '../workflows');
const CONFIG_FILE = path.join(__dirname, '../config/workflow-config.json');

// Load configuration
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (error) {
  console.error('Failed to load configuration:', error.message);
  process.exit(1);
}

/**
 * Create authenticated axios instance
 */
function createN8NClient() {
  const auth = N8N_AUTH_PASS ? 
    Buffer.from(`${N8N_AUTH_USER}:${N8N_AUTH_PASS}`).toString('base64') :
    null;

  return axios.create({
    baseURL: N8N_BASE_URL,
    headers: auth ? {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

/**
 * Check N8N connectivity
 */
async function checkN8NConnection() {
  console.log('🔍 Checking N8N connection...');
  
  try {
    const client = createN8NClient();
    const response = await client.get('/healthz');
    
    if (response.status === 200) {
      console.log('✅ N8N connection successful');
      return true;
    } else {
      console.error('❌ N8N health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to connect to N8N:', error.message);
    if (error.response?.status === 401) {
      console.error('💡 Hint: Check N8N authentication credentials');
    }
    return false;
  }
}

/**
 * Import a single workflow
 */
async function importWorkflow(workflowFile, workflowConfig) {
  console.log(`📦 Importing workflow: ${workflowConfig.name}`);
  
  try {
    const workflowPath = path.join(WORKFLOWS_DIR, workflowFile);
    
    if (!fs.existsSync(workflowPath)) {
      console.error(`❌ Workflow file not found: ${workflowPath}`);
      return false;
    }
    
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    const client = createN8NClient();
    
    // Check if workflow already exists
    try {
      const existingWorkflows = await client.get('/api/v1/workflows');
      const existingWorkflow = existingWorkflows.data.data.find(w => w.name === workflowData.name);
      
      if (existingWorkflow) {
        console.log(`⚠️  Workflow '${workflowData.name}' already exists. Updating...`);
        
        // Update existing workflow
        const updateResponse = await client.patch(`/api/v1/workflows/${existingWorkflow.id}`, {
          ...workflowData,
          id: existingWorkflow.id
        });
        
        if (updateResponse.status === 200) {
          console.log(`✅ Updated workflow: ${workflowConfig.name}`);
          
          // Activate workflow if configured
          if (workflowConfig.enabled) {
            await client.patch(`/api/v1/workflows/${existingWorkflow.id}/activate`);
            console.log(`🟢 Activated workflow: ${workflowConfig.name}`);
          }
          
          return true;
        }
      } else {
        // Create new workflow
        const createResponse = await client.post('/api/v1/workflows', workflowData);
        
        if (createResponse.status === 201) {
          console.log(`✅ Imported workflow: ${workflowConfig.name}`);
          
          // Activate workflow if configured
          if (workflowConfig.enabled) {
            await client.patch(`/api/v1/workflows/${createResponse.data.data.id}/activate`);
            console.log(`🟢 Activated workflow: ${workflowConfig.name}`);
          }
          
          return true;
        }
      }
    } catch (apiError) {
      // Fallback: Use direct workflow import (if N8N supports it)
      console.log('⚠️  Using fallback import method...');
      
      try {
        const importResponse = await client.post('/api/v1/workflows/import', workflowData);
        
        if (importResponse.status === 201) {
          console.log(`✅ Imported workflow: ${workflowConfig.name}`);
          return true;
        }
      } catch (fallbackError) {
        console.error(`❌ Failed to import workflow ${workflowConfig.name}:`, fallbackError.message);
        return false;
      }
    }
    
  } catch (error) {
    console.error(`❌ Error importing workflow ${workflowConfig.name}:`, error.message);
    return false;
  }
  
  return false;
}

/**
 * Setup credentials
 */
async function setupCredentials() {
  console.log('🔐 Setting up credentials...');
  
  const client = createN8NClient();
  const credentials = config.credentials || {};
  
  for (const [credId, credConfig] of Object.entries(credentials)) {
    try {
      console.log(`🔑 Checking credential: ${credConfig.name}`);
      
      // Check if credential already exists
      const existingCreds = await client.get('/api/v1/credentials');
      const existingCred = existingCreds.data.data.find(c => c.name === credConfig.name);
      
      if (existingCred) {
        console.log(`✅ Credential '${credConfig.name}' already exists`);
      } else {
        console.log(`⚠️  Credential '${credConfig.name}' needs to be created manually`);
        console.log(`   Type: ${credConfig.type}`);
        console.log(`   Required fields: ${credConfig.requiredFields.join(', ')}`);
      }
      
    } catch (error) {
      console.error(`❌ Error checking credential ${credConfig.name}:`, error.message);
    }
  }
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const required = config.environmentVariables?.required || [];
  const missing = [];
  
  required.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => {
      console.error(`   - ${envVar}`);
    });
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

/**
 * Generate import report
 */
function generateReport(results) {
  console.log('\n📋 IMPORT REPORT');
  console.log('='.repeat(50));
  
  const totalWorkflows = results.length;
  const successfulImports = results.filter(r => r.success).length;
  const failedImports = results.filter(r => !r.success).length;
  
  console.log(`Total workflows: ${totalWorkflows}`);
  console.log(`Successful imports: ${successfulImports} ✅`);
  console.log(`Failed imports: ${failedImports} ❌`);
  console.log(`Success rate: ${Math.round((successfulImports / totalWorkflows) * 100)}%`);
  
  if (failedImports > 0) {
    console.log('\nFailed workflows:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`❌ ${r.name}`);
    });
  }
  
  console.log('\n📄 Next steps:');
  console.log('1. Set up credentials in N8N UI if needed');
  console.log('2. Configure environment variables');
  console.log('3. Test workflows with sample data');
  console.log('4. Monitor executions in N8N dashboard');
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    totalWorkflows,
    successfulImports,
    failedImports,
    successRate: Math.round((successfulImports / totalWorkflows) * 100),
    results
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../logs/import-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n📊 Detailed report saved to: logs/import-report.json`);
}

/**
 * Main import function
 */
async function importAllWorkflows() {
  console.log('🚀 ElectricalAI Pro N8N Workflow Import');
  console.log('=' .repeat(50));
  
  // Create logs directory
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Validate environment
  if (!validateEnvironment()) {
    console.error('❌ Environment validation failed');
    process.exit(1);
  }
  
  // Check N8N connection
  if (!(await checkN8NConnection())) {
    console.error('❌ N8N connection failed');
    process.exit(1);
  }
  
  // Setup credentials
  await setupCredentials();
  
  // Import workflows
  console.log('\n📦 Starting workflow import...');
  const workflows = config.workflowConfiguration?.workflows || [];
  const results = [];
  
  for (const workflow of workflows) {
    const success = await importWorkflow(workflow.file, workflow);
    results.push({
      name: workflow.name,
      file: workflow.file,
      success,
      webhook: workflow.webhook
    });
  }
  
  // Generate report
  generateReport(results);
  
  const successfulImports = results.filter(r => r.success).length;
  
  if (successfulImports === workflows.length) {
    console.log('\n🎉 All workflows imported successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some workflows failed to import. Check the report above.');
    process.exit(1);
  }
}

// Run the import process
if (require.main === module) {
  importAllWorkflows().catch(error => {
    console.error('❌ Import process failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  importAllWorkflows,
  importWorkflow,
  checkN8NConnection
};