import axios from 'axios';

class N8NService {
  constructor() {
    this.baseUrl = null;
    this.apiKey = null;
    this.client = null;
  }

  initialize(config) {
    // Use production N8N URL by default
    this.baseUrl = config.baseUrl || 'https://electricalai-n8n.onrender.com';
    this.apiKey = config.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for workflow execution
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'ElectricalAI-Monday-App/1.0.0'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`N8N Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('N8N Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`N8N Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error('N8N Response Error:', error.response?.data || error.message);
        
        // Transform error for better user experience
        const transformedError = this.transformError(error);
        return Promise.reject(transformedError);
      }
    );

    console.log('N8NService initialized with baseUrl:', this.baseUrl);
  }

  transformError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 404:
          return new Error('Workflow not found. Please check your N8N configuration.');
        case 401:
          return new Error('Authentication failed. Please check your API key.');
        case 429:
          return new Error('Rate limit exceeded. Please try again later.');
        case 500:
          return new Error('N8N server error. Please try again or contact support.');
        default:
          return new Error(data?.message || `Request failed with status ${status}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      return new Error('No response from N8N server. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  /**
   * Trigger electrical estimation workflow
   * @param {Object} payload - Estimation parameters
   * @returns {Promise<Object>} Estimation results
   */
  async triggerEstimationWorkflow(payload) {
    try {
      console.log('Triggering estimation workflow with payload:', payload);
      
      const response = await this.client.post('/webhook/electrical-estimation', {
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'monday-app'
      });

      const results = response.data;
      
      // Validate response structure
      if (!results.success) {
        throw new Error(results.message || 'Estimation workflow failed');
      }

      console.log('Estimation workflow completed successfully');
      return results;
      
    } catch (error) {
      console.error('Estimation workflow failed:', error);
      throw error;
    }
  }

  /**
   * Trigger floor plan analysis workflow
   * @param {Object} payload - Floor plan data with image
   * @returns {Promise<Object>} Analysis results
   */
  async triggerFloorPlanAnalysis(payload) {
    try {
      console.log('Triggering floor plan analysis workflow');
      
      const formData = new FormData();
      formData.append('projectId', payload.projectId);
      formData.append('metadata', JSON.stringify(payload.metadata));
      
      if (payload.floorPlanFile) {
        formData.append('file', payload.floorPlanFile);
      }

      const response = await this.client.post('/webhook/floor-plan-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000 // Extended timeout for image processing
      });

      const results = response.data;
      
      if (!results.success) {
        throw new Error(results.message || 'Floor plan analysis failed');
      }

      console.log('Floor plan analysis completed successfully');
      return results;
      
    } catch (error) {
      console.error('Floor plan analysis failed:', error);
      throw error;
    }
  }

  /**
   * Trigger NEC compliance check workflow
   * @param {Object} payload - Project specifications for compliance check
   * @returns {Promise<Object>} Compliance results
   */
  async triggerComplianceCheck(payload) {
    try {
      console.log('Triggering NEC compliance check workflow');
      
      const response = await this.client.post('/webhook/nec-compliance-check', {
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'monday-app'
      });

      const results = response.data;
      
      if (!results.success) {
        throw new Error(results.message || 'Compliance check failed');
      }

      console.log('NEC compliance check completed successfully');
      return results;
      
    } catch (error) {
      console.error('NEC compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Trigger material cost tracking workflow
   * @param {Object} payload - Material cost data
   * @returns {Promise<Object>} Cost analysis results
   */
  async triggerMaterialCostTracking(payload) {
    try {
      console.log('Triggering material cost tracking workflow');
      
      const response = await this.client.post('/webhook/material-cost-update', {
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'monday-app'
      });

      const results = response.data;
      
      if (!results.success) {
        throw new Error(results.message || 'Material cost tracking failed');
      }

      console.log('Material cost tracking completed successfully');
      return results;
      
    } catch (error) {
      console.error('Material cost tracking failed:', error);
      throw error;
    }
  }

  /**
   * Trigger project progress monitoring workflow
   * @param {Object} payload - Progress update data
   * @returns {Promise<Object>} Progress analysis results
   */
  async triggerProgressMonitoring(payload) {
    try {
      console.log('Triggering project progress monitoring workflow');
      
      const response = await this.client.post('/webhook/project-progress-update', {
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'monday-app'
      });

      const results = response.data;
      
      if (!results.success) {
        throw new Error(results.message || 'Progress monitoring failed');
      }

      console.log('Project progress monitoring completed successfully');
      return results;
      
    } catch (error) {
      console.error('Project progress monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Get workflow execution status
   * @param {string} projectId - Project identifier
   * @returns {Promise<Object>} Workflow status information
   */
  async getWorkflowStatus(projectId) {
    try {
      console.log(`Getting workflow status for project: ${projectId}`);
      
      const response = await this.client.get(`/api/n8n/status/${projectId}`);
      return response.data;
      
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      throw error;
    }
  }

  /**
   * Get N8N system health
   * @returns {Promise<Object>} System health information
   */
  async getSystemHealth() {
    try {
      console.log('Checking N8N system health');
      
      const response = await this.client.get('/api/n8n/health');
      return response.data;
      
    } catch (error) {
      console.error('Failed to check system health:', error);
      throw error;
    }
  }

  /**
   * Batch trigger multiple workflows
   * @param {Array} workflows - Array of workflow configurations
   * @returns {Promise<Array>} Array of workflow results
   */
  async triggerBatchWorkflows(workflows) {
    try {
      console.log(`Triggering ${workflows.length} workflows in batch`);
      
      const promises = workflows.map(async (workflow) => {
        try {
          let result;
          
          switch (workflow.type) {
            case 'estimation':
              result = await this.triggerEstimationWorkflow(workflow.payload);
              break;
            case 'floor-plan':
              result = await this.triggerFloorPlanAnalysis(workflow.payload);
              break;
            case 'compliance':
              result = await this.triggerComplianceCheck(workflow.payload);
              break;
            case 'material-cost':
              result = await this.triggerMaterialCostTracking(workflow.payload);
              break;
            case 'progress':
              result = await this.triggerProgressMonitoring(workflow.payload);
              break;
            default:
              throw new Error(`Unknown workflow type: ${workflow.type}`);
          }
          
          return {
            id: workflow.id,
            type: workflow.type,
            success: true,
            result
          };
          
        } catch (error) {
          return {
            id: workflow.id,
            type: workflow.type,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.allSettled(promises);
      
      console.log('Batch workflow execution completed');
      return results.map(r => r.value || r.reason);
      
    } catch (error) {
      console.error('Batch workflow execution failed:', error);
      throw error;
    }
  }

  /**
   * Test N8N connectivity
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      console.log('Testing N8N connection');
      
      const response = await this.client.get('/healthz', {
        timeout: 5000
      });
      
      console.log('N8N connection successful');
      return true;
      
    } catch (error) {
      console.error('N8N connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const n8nService = new N8NService();
export { n8nService as N8NService };