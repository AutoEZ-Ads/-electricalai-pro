import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      toast.error('Server error occurred. Please try again.');
    } else if (error.response?.status >= 400) {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const projectsAPI = {
  getAll: (params = {}) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  startEstimation: (id, data = {}) => api.post(`/projects/${id}/estimate`, data),
  getStats: (id) => api.get(`/projects/${id}/stats`),
};

export const estimationsAPI = {
  getAll: (params = {}) => api.get('/estimations', { params }),
  getById: (id) => api.get(`/estimations/${id}`),
  update: (id, data) => api.put(`/estimations/${id}`, data),
};

export const componentsAPI = {
  getAll: (params = {}) => api.get('/components', { params }),
  getById: (id) => api.get(`/components/${id}`),
  getCategories: () => api.get('/components/categories'),
};

export const calculationsAPI = {
  direct: (type, parameters) => api.post('/calculations/direct', { type, parameters }),
  getHistory: (projectId) => api.get(`/calculations/project/${projectId}/history`),
};

export const workflowsAPI = {
  getExecutions: (params = {}) => api.get('/workflows/executions', { params }),
  getExecution: (id) => api.get(`/workflows/executions/${id}`),
  trigger: (workflowName, data) => api.post(`/workflows/trigger/${workflowName}`, { data }),
};

export const aiAPI = {
  comprehensiveAnalysis: (projectId, modules, options = {}) => 
    api.post('/ai/comprehensive-analysis', {
      projectId,
      includeModules: modules,
      analysisDepth: options.depth || 'detailed',
      ...options
    }),
  loadCalculation: (projectData) => 
    api.post('/ai/load-calculation', projectData),
  voltageDropAnalysis: (circuitData) => 
    api.post('/ai/voltage-drop', circuitData),
  arcFlashAnalysis: (systemData) => 
    api.post('/ai/arc-flash', systemData),
  necCompliance: (projectData) => 
    api.post('/ai/nec-compliance', projectData),
  materialTakeoff: (projectData) => 
    api.post('/ai/material-takeoff', projectData),
  costAnalysis: (projectData) => 
    api.post('/ai/cost-analysis', projectData),
  safetyAnalysis: (projectData) => 
    api.post('/ai/safety-analysis', projectData),
  scheduleEstimation: (projectData) => 
    api.post('/ai/schedule-estimation', projectData),
};

export default api;