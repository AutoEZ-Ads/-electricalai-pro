import winston from 'winston';

// Configure winston logger for browser and server environments
class LoggingService {
  constructor() {
    this.logger = null;
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      // Browser logging setup
      this.logger = {
        info: (message, meta) => this.browserLog('info', message, meta),
        warn: (message, meta) => this.browserLog('warn', message, meta),
        error: (message, meta) => this.browserLog('error', message, meta),
        debug: (message, meta) => this.browserLog('debug', message, meta)
      };
    } else {
      // Node.js server logging setup with winston
      this.logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
          winston.format.prettyPrint()
        ),
        defaultMeta: { 
          service: 'electricalai-monday-app',
          version: '1.0.0'
        },
        transports: [
          // Write all logs with level 'error' and below to error.log
          new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
          }),
          // Write all logs to combined.log
          new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 10
          }),
          // Write to console in development
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
            silent: process.env.NODE_ENV === 'production'
          })
        ]
      });

      // Handle uncaught exceptions
      this.logger.exceptions.handle(
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      );

      // Handle unhandled promise rejections
      this.logger.rejections.handle(
        new winston.transports.File({ filename: 'logs/rejections.log' })
      );
    }

    this.isInitialized = true;
    this.info('LoggingService initialized', { environment: isBrowser ? 'browser' : 'server' });
  }

  browserLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      service: 'electricalai-monday-app',
      ...meta
    };

    // Console logging with appropriate method
    switch (level) {
      case 'error':
        console.error(`[${timestamp}] ERROR:`, message, meta);
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN:`, message, meta);
        break;
      case 'debug':
        if (process.env.REACT_APP_ENABLE_DEBUG_LOGGING === 'true') {
          console.debug(`[${timestamp}] DEBUG:`, message, meta);
        }
        break;
      case 'info':
      default:
        console.log(`[${timestamp}] INFO:`, message, meta);
        break;
    }

    // Send to remote logging service if configured
    this.sendToRemoteLogging(logData);
  }

  async sendToRemoteLogging(logData) {
    // Only send logs in production and if remote logging is enabled
    if (process.env.NODE_ENV !== 'production' || 
        process.env.REACT_APP_ENABLE_REMOTE_LOGGING !== 'true') {
      return;
    }

    try {
      // Send to your logging service (e.g., Logtail, Datadog, etc.)
      const loggingEndpoint = process.env.REACT_APP_LOGGING_ENDPOINT;
      const loggingApiKey = process.env.REACT_APP_LOGGING_API_KEY;

      if (loggingEndpoint && loggingApiKey) {
        await fetch(loggingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loggingApiKey}`
          },
          body: JSON.stringify(logData)
        });
      }
    } catch (error) {
      // Silently fail for remote logging to avoid infinite loops
      console.error('Failed to send log to remote service:', error);
    }
  }

  info(message, meta = {}) {
    if (!this.isInitialized) return;
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    if (!this.isInitialized) return;
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    if (!this.isInitialized) return;
    this.logger.error(message, meta);
  }

  debug(message, meta = {}) {
    if (!this.isInitialized) return;
    this.logger.debug(message, meta);
  }

  // Specialized logging methods for Monday.com app
  logMondayEvent(eventType, data) {
    this.info(`Monday.com Event: ${eventType}`, {
      category: 'monday-event',
      eventType,
      data
    });
  }

  logN8NWorkflow(workflowName, status, data) {
    this.info(`N8N Workflow: ${workflowName} - ${status}`, {
      category: 'n8n-workflow',
      workflowName,
      status,
      data
    });
  }

  logApiCall(endpoint, method, status, duration) {
    this.info(`API Call: ${method} ${endpoint}`, {
      category: 'api-call',
      endpoint,
      method,
      status,
      duration
    });
  }

  logUserAction(action, userId, data) {
    this.info(`User Action: ${action}`, {
      category: 'user-action',
      action,
      userId,
      data
    });
  }

  logError(error, context) {
    this.error(`Error: ${error.message}`, {
      category: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }

  logPerformance(operation, duration, metadata) {
    this.info(`Performance: ${operation}`, {
      category: 'performance',
      operation,
      duration,
      metadata
    });
  }

  // Create child logger with additional context
  child(childMeta) {
    return {
      info: (message, meta = {}) => this.info(message, { ...childMeta, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...childMeta, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...childMeta, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...childMeta, ...meta }),
      logMondayEvent: (eventType, data) => this.logMondayEvent(eventType, { ...childMeta, ...data }),
      logN8NWorkflow: (workflowName, status, data) => this.logN8NWorkflow(workflowName, status, { ...childMeta, ...data }),
      logApiCall: (endpoint, method, status, duration) => this.logApiCall(endpoint, method, status, duration),
      logUserAction: (action, userId, data) => this.logUserAction(action, userId, { ...childMeta, ...data }),
      logError: (error, context) => this.logError(error, { ...childMeta, ...context }),
      logPerformance: (operation, duration, metadata) => this.logPerformance(operation, duration, { ...childMeta, ...metadata })
    };
  }
}

// Export singleton instance
const loggingService = new LoggingService();
export default loggingService;

// Export logger instance for direct winston usage in Node.js
export const logger = loggingService.logger;