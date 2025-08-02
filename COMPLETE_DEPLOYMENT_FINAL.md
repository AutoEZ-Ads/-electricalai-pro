// Advanced Production Monitoring Middleware
const winston = require('winston');
const prometheus = require('prom-client');

// Create custom metrics
const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
});

const estimationProcessingTime = new prometheus.Histogram({
    name: 'estimation_processing_seconds',
    help: 'Time spent processing electrical estimations',
    buckets: [1, 5, 10, 30, 60, 120]
});

// Register metrics
prometheus.register.registerMetric(httpRequestDuration);
prometheus.register.registerMetric(httpRequestTotal);
prometheus.register.registerMetric(activeConnections);
prometheus.register.registerMetric(estimationProcessingTime);

// Advanced monitoring middleware
const advancedMonitoring = (req, res, next) => {
    const start = Date.now();
    
    // Track active connections
    activeConnections.inc();
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        // Record metrics
        httpRequestDuration
            .labels(req.method, route, res.statusCode)
            .observe(duration);
            
        httpRequestTotal
            .labels(req.method, route, res.statusCode)
            .inc();
        
        activeConnections.dec();
        
        // Log slow requests
        if (duration > 5) {
            winston.warn('Slow request detected', {
                method: req.method,
                path: req.path,
                duration: duration,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
        }
        
        originalEnd.apply(this, args);
    };
    
    next();
};

// Performance monitoring for specific operations
const trackEstimationTime = (operation) => {
    const timer = estimationProcessingTime.startTimer();
    return {
        end: () => timer(),
        operation
    };
};

// Error tracking with context
const trackError = (error, req, context = {}) => {
    winston.error('Application error', {
        error: error.message,
        stack: error.stack,
        url: req?.url,
        method: req?.method,
        userAgent: req?.get('User-Agent'),
        ip: req?.ip,
        ...context
    });
};

// Business metrics
const businessMetrics = {
    estimationsCreated: new prometheus.Counter({
        name: 'estimations_created_total',
        help: 'Total number of estimations created'
    }),
    
    estimationAccuracy: new prometheus.Histogram({
        name: 'estimation_accuracy_score',
        help: 'Accuracy score of estimations',
        buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    }),
    
    mondayIntegrations: new prometheus.Counter({
        name: 'monday_integrations_total',
        help: 'Total Monday.com integrations processed'
    })
};

// Register business metrics
Object.values(businessMetrics).forEach(metric => {
    prometheus.register.registerMetric(metric);
});

module.exports = {
    advancedMonitoring,
    trackEstimationTime,
    trackError,
    businessMetrics,
    prometheus
};