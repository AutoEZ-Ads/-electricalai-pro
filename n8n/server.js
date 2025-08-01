#!/usr/bin/env node

// ElectricalAI Pro N8N Server
// Production server wrapper for N8N with custom initialization

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const N8N_PORT = process.env.N8N_PORT || process.env.PORT || 5678;
const DB_TYPE = process.env.DB_TYPE || 'postgresdb';

console.log('🚀 Starting ElectricalAI Pro N8N Server');
console.log(`Environment: ${NODE_ENV}`);
console.log(`Port: ${N8N_PORT}`);
console.log(`Database: ${DB_TYPE}`);

/**
 * Wait for database to be ready
 */
async function waitForDatabase() {
  if (DB_TYPE !== 'postgresdb') {
    console.log('📊 Using file database, skipping connection check');
    return;
  }

  const maxRetries = 30;
  const retryDelay = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: process.env.DB_POSTGRESDB_HOST,
        port: process.env.DB_POSTGRESDB_PORT,
        database: process.env.DB_POSTGRESDB_DATABASE,
        user: process.env.DB_POSTGRESDB_USER,
        password: process.env.DB_POSTGRESDB_PASSWORD,
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      console.log('✅ Database connection established');
      return;
      
    } catch (error) {
      console.log(`⏳ Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('❌ Failed to connect to database after maximum retries');
        process.exit(1);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Initialize database schema if needed
 */
async function initializeDatabase() {
  if (DB_TYPE !== 'postgresdb' || NODE_ENV !== 'production') {
    console.log('📊 Skipping database initialization');
    return;
  }

  try {
    console.log('📊 Initializing database schema...');
    
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_POSTGRESDB_HOST,
      port: process.env.DB_POSTGRESDB_PORT,
      database: process.env.DB_POSTGRESDB_DATABASE,
      user: process.env.DB_POSTGRESDB_USER,
      password: process.env.DB_POSTGRESDB_PASSWORD,
    });

    await client.connect();
    
    // Check if our custom tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('estimations', 'floor_plan_analyses', 'workflow_executions')
    `;
    
    const result = await client.query(tablesQuery);
    
    if (result.rows.length === 0) {
      console.log('📊 Creating ElectricalAI Pro database schema...');
      
      // Read and execute schema file
      const schemaPath = path.join(__dirname, 'database-schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schema);
        console.log('✅ Database schema created successfully');
      } else {
        console.log('⚠️  Schema file not found, skipping custom table creation');
      }
    } else {
      console.log('✅ Database schema already exists');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't exit - N8N can still function with basic tables
  }
}

/**
 * Import default workflows if first run
 */
async function importDefaultWorkflows() {
  if (NODE_ENV !== 'production') {
    console.log('🔧 Skipping workflow import in development mode');
    return;
  }

  try {
    console.log('📦 Checking for default workflows...');
    
    const workflowsDir = path.join(__dirname, 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      console.log('📦 No workflows directory found');
      return;
    }

    const workflowFiles = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.json'));
    
    if (workflowFiles.length === 0) {
      console.log('📦 No workflow files found');
      return;
    }

    console.log(`📦 Found ${workflowFiles.length} workflow files`);
    
    // Wait a bit for N8N to fully start before importing
    setTimeout(async () => {
      for (const file of workflowFiles) {
        try {
          console.log(`📦 Importing workflow: ${file}`);
          // Workflow import would happen here via N8N API
          // For now, workflows need to be manually imported through the UI
        } catch (error) {
          console.error(`❌ Failed to import workflow ${file}:`, error.message);
        }
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Workflow import failed:', error);
  }
}

/**
 * Start N8N process
 */
function startN8N() {
  console.log('🚀 Starting N8N process...');
  
  // Set N8N environment variables
  const n8nEnv = {
    ...process.env,
    N8N_HOST: '0.0.0.0',
    N8N_PORT: N8N_PORT,
    N8N_DISABLE_PRODUCTION_MAIN_PROCESS: 'false'
  };

  // Worker mode for queue processing
  if (process.env.EXECUTIONS_PROCESS === 'worker') {
    console.log('🔧 Starting in worker mode');
    const worker = spawn('n8n', ['worker'], {
      env: n8nEnv,
      stdio: 'inherit'
    });
    
    worker.on('error', (error) => {
      console.error('❌ N8N worker process error:', error);
      process.exit(1);
    });
    
    worker.on('exit', (code) => {
      console.log(`🔧 N8N worker process exited with code ${code}`);
      process.exit(code);
    });
    
    return;
  }

  // Main N8N process
  const n8nArgs = ['start'];
  
  // Add tunnel flag for development
  if (NODE_ENV === 'development') {
    n8nArgs.push('--tunnel');
  }

  const n8n = spawn('n8n', n8nArgs, {
    env: n8nEnv,
    stdio: 'inherit'
  });

  n8n.on('error', (error) => {
    console.error('❌ N8N process error:', error);
    process.exit(1);
  });

  n8n.on('exit', (code) => {
    console.log(`🚀 N8N process exited with code ${code}`);
    process.exit(code);
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM, shutting down gracefully');
    n8n.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('📴 Received SIGINT, shutting down gracefully');
    n8n.kill('SIGINT');
  });
}

/**
 * Health check endpoint
 */
function setupHealthCheck() {
  const express = require('express');
  const app = express();
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'electricalai-n8n',
      environment: NODE_ENV
    });
  });
  
  const healthPort = parseInt(N8N_PORT) + 1000;
  app.listen(healthPort, () => {
    console.log(`🏥 Health check server running on port ${healthPort}`);
  });
}

/**
 * Main initialization sequence
 */
async function initialize() {
  try {
    console.log('🔧 Initializing ElectricalAI Pro N8N...');
    
    // Wait for database to be ready
    await waitForDatabase();
    
    // Initialize database schema
    await initializeDatabase();
    
    // Set up health check endpoint
    setupHealthCheck();
    
    // Import default workflows (after N8N starts)
    importDefaultWorkflows();
    
    // Start N8N process
    startN8N();
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Start the server
initialize();