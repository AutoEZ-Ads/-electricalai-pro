// N8N Integration API Routes for ElectricalAI Pro
// Provides endpoints for N8N workflows to interact with main application

const express = require('express');
const router = express.Router();
const axios = require('axios');

// N8N webhook base URL
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'electricalai-secret';

// ================================
// ESTIMATION INTEGRATION
// ================================

/**
 * Trigger electrical estimation workflow
 * POST /api/n8n/estimate
 */
router.post('/estimate', async (req, res) => {
  try {
    const {
      projectId,
      projectType = 'residential',
      squareFootage,
      complexityLevel = 'standard',
      location = 'suburban',
      specialRequirements = []
    } = req.body;

    // Validate required fields
    if (!projectId || !squareFootage) {
      return res.status(400).json({
        error: 'Missing required fields: projectId and squareFootage'
      });
    }

    // Prepare payload for N8N workflow
    const workflowPayload = {
      projectId,
      projectType,
      squareFootage: parseInt(squareFootage),
      complexityLevel,
      location,
      specialRequirements,
      requestedBy: req.user?.id || 'api-user',
      requestedAt: new Date().toISOString(),
      source: 'electricalai-pro-api'
    };

    // Trigger N8N electrical estimation workflow
    const n8nResponse = await axios.post(
      `${N8N_BASE_URL}/webhook/electrical-estimation`,
      workflowPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': N8N_WEBHOOK_SECRET
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Log API usage
    await logApiUsage({
      projectId,
      endpoint: '/api/n8n/estimate',
      method: 'POST',
      userId: req.user?.id,
      responseTime: Date.now() - req.startTime,
      statusCode: 200,
      requestSize: JSON.stringify(workflowPayload).length,
      responseSize: JSON.stringify(n8nResponse.data).length
    });

    res.json({
      success: true,
      projectId,
      estimation: n8nResponse.data,
      message: 'Electrical estimation completed successfully',
      processingTime: `${Date.now() - req.startTime}ms`
    });

  } catch (error) {
    console.error('N8N Estimation Error:', error);
    
    // Log failed API usage
    await logApiUsage({
      projectId: req.body.projectId,
      endpoint: '/api/n8n/estimate',
      method: 'POST',
      userId: req.user?.id,
      responseTime: Date.now() - req.startTime,
      statusCode: 500,
      requestSize: JSON.stringify(req.body).length,
      responseSize: 0
    });

    res.status(500).json({
      error: 'Estimation workflow failed',
      message: error.response?.data?.message || error.message,
      projectId: req.body.projectId
    });
  }
});

// ================================
// FLOOR PLAN ANALYSIS INTEGRATION
// ================================

/**
 * Trigger floor plan analysis workflow
 * POST /api/n8n/analyze-floor-plan
 */
router.post('/analyze-floor-plan', async (req, res) => {
  try {
    const { projectId, floorPlanImage, metadata = {} } = req.body;

    if (!projectId || !floorPlanImage) {
      return res.status(400).json({
        error: 'Missing required fields: projectId and floorPlanImage'
      });
    }

    // Prepare multipart form data for N8N workflow
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('projectId', projectId);
    form.append('metadata', JSON.stringify({
      ...metadata,
      requestedBy: req.user?.id || 'api-user',
      requestedAt: new Date().toISOString(),
      source: 'electricalai-pro-api'
    }));

    // Handle base64 image data
    if (floorPlanImage.startsWith('data:image/')) {
      const base64Data = floorPlanImage.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const mimeType = floorPlanImage.split(';')[0].split(':')[1];
      const extension = mimeType.split('/')[1];
      
      form.append('file', imageBuffer, {
        filename: `floor-plan-${projectId}.${extension}`,
        contentType: mimeType
      });
    } else {
      return res.status(400).json({
        error: 'Invalid image format. Expected base64 data URL'
      });
    }

    // Trigger N8N floor plan analysis workflow
    const n8nResponse = await axios.post(
      `${N8N_BASE_URL}/webhook/floor-plan-upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-Webhook-Secret': N8N_WEBHOOK_SECRET
        },
        timeout: 60000 // 60 second timeout for image processing
      }
    );

    // Log API usage
    await logApiUsage({
      projectId,
      endpoint: '/api/n8n/analyze-floor-plan',
      method: 'POST',
      userId: req.user?.id,
      responseTime: Date.now() - req.startTime,
      statusCode: 200,
      requestSize: floorPlanImage.length,
      responseSize: JSON.stringify(n8nResponse.data).length
    });

    res.json({
      success: true,
      projectId,
      analysis: n8nResponse.data,
      message: 'Floor plan analysis completed successfully',
      processingTime: `${Date.now() - req.startTime}ms`
    });

  } catch (error) {
    console.error('N8N Floor Plan Analysis Error:', error);
    
    // Log failed API usage
    await logApiUsage({
      projectId: req.body.projectId,
      endpoint: '/api/n8n/analyze-floor-plan',
      method: 'POST',
      userId: req.user?.id,
      responseTime: Date.now() - req.startTime,
      statusCode: 500,
      requestSize: req.body.floorPlanImage?.length || 0,
      responseSize: 0
    });

    res.status(500).json({
      error: 'Floor plan analysis workflow failed',
      message: error.response?.data?.message || error.message,
      projectId: req.body.projectId
    });
  }
});

// ================================
// HISTORICAL DATA ENDPOINTS
// ================================

/**
 * Get calibration factors for estimation
 * POST /api/historical/calibration-factors
 */
router.post('/historical/calibration-factors', async (req, res) => {
  try {
    const { projectType, location, complexityLevel, lookbackMonths = 12 } = req.body;

    // This endpoint is called by N8N workflows
    const db = req.app.get('db'); // Assuming database connection is available
    
    // Get calibration factors
    const calibrationQuery = `
      SELECT 
        material_factor,
        labor_factor,
        risk_adjustment,
        sample_size,
        last_updated
      FROM calibration_factors 
      WHERE project_type = $1 
        AND location = $2 
        AND complexity_level = $3
    `;
    
    const calibrationResult = await db.query(calibrationQuery, [projectType, location, complexityLevel]);
    
    // Get similar project history
    const historyQuery = `
      SELECT 
        COUNT(*) as similar_projects_count,
        AVG(variance_percentage) as average_variance,
        STDDEV(variance_percentage) as variance_stddev
      FROM project_history ph
      JOIN estimations e ON ph.original_estimate_id = e.id
      WHERE e.project_type = $1 
        AND e.location = $2 
        AND e.complexity_level = $3
        AND e.created_at >= NOW() - INTERVAL '${lookbackMonths} months'
    `;
    
    const historyResult = await db.query(historyQuery, [projectType, location, complexityLevel]);
    
    const calibrationData = calibrationResult.rows[0] || {
      material_factor: 1.0,
      labor_factor: 1.0,
      risk_adjustment: 1.0,
      sample_size: 0
    };
    
    const historyData = historyResult.rows[0] || {
      similar_projects_count: 0,
      average_variance: null,
      variance_stddev: null
    };

    // Calculate overall calibration factor
    const calibrationFactor = (
      calibrationData.material_factor * 0.4 +
      calibrationData.labor_factor * 0.4 +
      calibrationData.risk_adjustment * 0.2
    );

    // Determine risk level based on variance
    let riskLevel = 'medium';
    if (historyData.variance_stddev !== null) {
      if (historyData.variance_stddev < 5) riskLevel = 'low';
      else if (historyData.variance_stddev > 15) riskLevel = 'high';
    }

    const response = {
      calibrationFactor: Math.round(calibrationFactor * 1000) / 1000,
      riskLevel,
      similarProjectsCount: parseInt(historyData.similar_projects_count) || 0,
      averageVariance: historyData.average_variance ? `${Math.round(historyData.average_variance * 100) / 100}%` : 'N/A',
      riskFactors: [],
      factors: {
        material: calibrationData.material_factor,
        labor: calibrationData.labor_factor,
        risk: calibrationData.risk_adjustment,
        sampleSize: calibrationData.sample_size
      },
      dataQuality: calibrationData.sample_size > 10 ? 'high' : calibrationData.sample_size > 5 ? 'medium' : 'low'
    };

    // Add risk factors based on data
    if (calibrationData.sample_size < 5) {
      response.riskFactors.push('Limited historical data available');
    }
    if (historyData.variance_stddev > 15) {
      response.riskFactors.push('High cost variance in similar projects');
    }
    if (calibrationFactor > 1.2) {
      response.riskFactors.push('Market conditions show cost increases');
    }

    res.json(response);

  } catch (error) {
    console.error('Historical Data Error:', error);
    res.status(500).json({
      error: 'Failed to retrieve historical calibration data',
      message: error.message
    });
  }
});

// ================================
// WORKFLOW STATUS AND MONITORING
// ================================

/**
 * Get workflow execution status
 * GET /api/n8n/status/:projectId
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const db = req.app.get('db');

    const statusQuery = `
      SELECT 
        workflow_name,
        execution_id,
        status,
        started_at,
        completed_at,
        execution_time_ms,
        error_message
      FROM workflow_executions 
      WHERE project_id = $1 
      ORDER BY started_at DESC 
      LIMIT 10
    `;

    const result = await db.query(statusQuery, [projectId]);

    res.json({
      projectId,
      executions: result.rows,
      summary: {
        total: result.rows.length,
        successful: result.rows.filter(r => r.status === 'success').length,
        failed: result.rows.filter(r => r.status === 'failed').length,
        running: result.rows.filter(r => r.status === 'running').length
      }
    });

  } catch (error) {
    console.error('Status Check Error:', error);
    res.status(500).json({
      error: 'Failed to retrieve workflow status',
      message: error.message
    });
  }
});

/**
 * Get N8N system health
 * GET /api/n8n/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check N8N connectivity
    const healthCheck = await axios.get(`${N8N_BASE_URL}/healthz`, {
      timeout: 5000
    });

    // Check database connectivity
    const db = req.app.get('db');
    await db.query('SELECT 1');

    res.json({
      status: 'healthy',
      n8n: {
        status: healthCheck.status === 200 ? 'connected' : 'disconnected',
        url: N8N_BASE_URL
      },
      database: {
        status: 'connected'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health Check Error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Log API usage for monitoring and billing
 */
async function logApiUsage({
  projectId,
  endpoint,
  method,
  userId,
  responseTime,
  statusCode,
  requestSize,
  responseSize
}) {
  try {
    const db = require('../config/database'); // Adjust path as needed
    
    await db.query(`
      INSERT INTO api_usage (
        project_id, endpoint, method, user_id, 
        response_time_ms, status_code, 
        request_size_bytes, response_size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      projectId, endpoint, method, userId,
      responseTime, statusCode,
      requestSize, responseSize
    ]);
  } catch (error) {
    console.error('Failed to log API usage:', error);
    // Don't throw - logging failure shouldn't break the main request
  }
}

/**
 * Middleware to track request start time
 */
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

router.use((error, req, res, next) => {
  console.error('N8N Integration Error:', error);
  
  res.status(500).json({
    error: 'N8N Integration Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;