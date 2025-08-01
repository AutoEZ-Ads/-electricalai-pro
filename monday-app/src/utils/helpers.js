/**
 * Helper utility functions for the Monday.com app
 */

/**
 * Format currency values
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format date values
 * @param {string|Date} date - Date to format
 * @param {boolean} includeTime - Include time in format
 * @returns {string} Formatted date string
 */
export const formatDate = (date, includeTime = false) => {
  if (!date) return '—';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '—';
  }
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return dateObj.toLocaleDateString('en-US', options);
};

/**
 * Get status color for badges
 * @param {string} status - Status value
 * @returns {string} Color name for Monday UI
 */
export const getStatusColor = (status) => {
  const statusLower = status?.toLowerCase() || '';
  
  switch (statusLower) {
    case 'completed':
    case 'done':
    case 'success':
    case 'approved':
    case 'compliant':
      return 'positive';
      
    case 'in progress':
    case 'working':
    case 'processing':
    case 'pending':
      return 'warning';
      
    case 'stuck':
    case 'blocked':
    case 'failed':
    case 'error':
    case 'rejected':
    case 'non-compliant':
      return 'negative';
      
    case 'new project':
    case 'new':
    case 'draft':
      return 'primary';
      
    default:
      return 'secondary';
  }
};

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  
  return text.slice(0, maxLength) + '...';
};

/**
 * Generate unique ID
 * @returns {string} Unique identifier
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {};
    Object.keys(obj).forEach(key => {
      clonedObj[key] = deepClone(obj[key]);
    });
    return clonedObj;
  }
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
};

/**
 * Calculate percentage
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @returns {number} Percentage value
 */
export const calculatePercentage = (part, total) => {
  if (!total || total === 0) return 0;
  return (part / total) * 100;
};

/**
 * Parse Monday column value
 * @param {Object} column - Monday column object
 * @returns {any} Parsed value
 */
export const parseMondayColumnValue = (column) => {
  if (!column || !column.value) {
    return column?.text || null;
  }
  
  try {
    const parsed = JSON.parse(column.value);
    
    switch (column.type) {
      case 'numeric':
        return parseFloat(parsed) || 0;
        
      case 'checkbox':
        return parsed.checked || false;
        
      case 'status':
      case 'color':
        return parsed.label || column.text;
        
      case 'date':
        return parsed.date ? new Date(parsed.date) : null;
        
      case 'timeline':
        return {
          from: parsed.from ? new Date(parsed.from) : null,
          to: parsed.to ? new Date(parsed.to) : null
        };
        
      case 'multiple-person':
      case 'person':
        return parsed.personsAndTeams || [];
        
      case 'dropdown':
        return parsed.ids || [];
        
      default:
        return parsed;
    }
  } catch (error) {
    // If JSON parsing fails, return the text value
    return column.text;
  }
};

/**
 * Format Monday column value for display
 * @param {Object} column - Monday column object
 * @returns {string} Formatted display value
 */
export const formatMondayColumnValue = (column) => {
  const value = parseMondayColumnValue(column);
  
  if (value === null || value === undefined) {
    return '—';
  }
  
  switch (column.type) {
    case 'numeric':
      return value.toLocaleString();
      
    case 'checkbox':
      return value ? '✓' : '—';
      
    case 'date':
      return value instanceof Date ? formatDate(value) : '—';
      
    case 'timeline':
      if (value.from && value.to) {
        return `${formatDate(value.from)} - ${formatDate(value.to)}`;
      }
      return '—';
      
    case 'multiple-person':
    case 'person':
      if (Array.isArray(value) && value.length > 0) {
        return value.map(p => p.name || p.id).join(', ');
      }
      return '—';
      
    default:
      return String(value);
  }
};

/**
 * Get file icon based on extension
 * @param {string} filename - File name
 * @returns {string} Icon name
 */
export const getFileIcon = (filename) => {
  if (!filename) return 'FileText';
  
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return 'FilePdf';
    case 'doc':
    case 'docx':
      return 'FileWord';
    case 'xls':
    case 'xlsx':
      return 'FileExcel';
    case 'ppt':
    case 'pptx':
      return 'FilePowerpoint';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
      return 'FileImage';
    case 'zip':
    case 'rar':
    case '7z':
      return 'FileZip';
    case 'dwg':
    case 'dxf':
      return 'FileCAD';
    default:
      return 'FileText';
  }
};

/**
 * Validate project data
 * @param {Object} projectData - Project data to validate
 * @returns {Object} Validation result
 */
export const validateProjectData = (projectData) => {
  const errors = [];
  
  if (!projectData.projectType) {
    errors.push('Project type is required');
  }
  
  if (!projectData.squareFootage || projectData.squareFootage < 100) {
    errors.push('Square footage must be at least 100');
  }
  
  if (projectData.squareFootage > 50000) {
    errors.push('Square footage cannot exceed 50,000');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculate estimation confidence
 * @param {Object} estimationData - Estimation data
 * @returns {number} Confidence percentage
 */
export const calculateEstimationConfidence = (estimationData) => {
  let confidence = 50; // Base confidence
  
  // Increase confidence based on available data
  if (estimationData.floorPlanAnalysis) confidence += 20;
  if (estimationData.materialList) confidence += 15;
  if (estimationData.laborCalculations) confidence += 10;
  if (estimationData.complianceCheck) confidence += 5;
  
  return Math.min(confidence, 95); // Cap at 95%
};

/**
 * Format time duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${remainingSeconds}s`;
};

/**
 * Check if value is empty
 * @param {any} value - Value to check
 * @returns {boolean} Is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Convert camelCase to title case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
export const camelToTitle = (str) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
};