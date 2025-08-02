const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initializeDatabase, query, transaction, getPool } = require('./config/database');
const { healthMonitor } = require('./services/health-monitor');
const { backupManager } = require('./services/backup-manager');
const { backupScheduler } = require('./services/backup-scheduler');
const Redis = require('redis');
const axios = require('axios');
const winston = require('winston');
const fs = require('fs');
const { defaultMondayClient } = require('./utils/monday-api-client');
const { defaultMondayService } = require('./services/monday-service');
require('dotenv').config();

// Import route modules
const projectRoutes = require('./routes/projects');
const estimationRoutes = require('./routes/estimations');
const componentRoutes = require('./routes/components');
const calculationRoutes = require('./routes/calculations');
const workflowRoutes = require('./routes/workflows');
const aiCalculationsRoutes = require('./routes/ai_calculations');
const aiComprehensiveRoutes = require('./routes/ai_comprehensive');
const historicalRoutes = require('./routes/historical');
const floorplanRoutes = require('./routes/floorplans');
const blueprintRoutes = require('./routes/blueprints');
const backupRoutes = require('./routes/backups');
const aiEnhancedRoutes = require('./routes/ai-enhanced');

// Import advanced middleware
const { advancedMonitoring, prometheus } = require('./middleware/advanced-monitoring');
const { applyBasicSecurity, rateLimits } = require('./middleware/production-security');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Async handler wrapper utility
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'electrical-estimation-api' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ],
});

// Initialize database connection pool
let pool;
initializeDatabase().then(async (dbPool) => {
    pool = dbPool;
    logger.info('Database initialized successfully');
    
    // Initialize backup system
    try {
        await backupManager.initializeBackupSystem();
        logger.info('Backup manager initialized successfully');
        
        // Initialize backup scheduler
        await backupScheduler.initialize();
        logger.info('Backup scheduler initialized successfully');
        
    } catch (error) {
        logger.error('Backup system initialization failed:', error);
        // Don't exit - backup system is not critical for app startup
    }
}).catch((error) => {
    logger.error('Database initialization failed:', error);
    process.exit(1);
});

// Redis connection
let redisClient;
try {
    redisClient = Redis.createClient({
        url: process.env.REDIS_URL,
        retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                logger.error('Redis server connection refused');
                return new Error('Redis server connection refused');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Redis retry time exhausted');
            }
            if (options.attempt > 10) {
                return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
        }
    });
    
    redisClient.connect();
    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    redisClient.on('connect', () => logger.info('Redis client connected'));
} catch (error) {
    logger.error('Redis connection failed:', error);
}

// Middleware setup
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));

app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make database and redis available to routes
app.use((req, res, next) => {
    req.db = pool || getPool(); // Use pool if available, otherwise get from manager
    req.query = query; // Direct query method
    req.transaction = transaction; // Transaction method
    req.redis = redisClient;
    req.logger = logger;
    req.backupManager = backupManager; // Backup functionality
    next();
});

// Comprehensive health check endpoint
app.get('/health', asyncHandler(async (req, res) => {
    const healthResult = await healthMonitor.runAllChecks();
    
    const statusCode = healthResult.status === 'healthy' ? 200 : 
                      healthResult.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(healthResult);
}));

// Detailed health endpoint with metrics
app.get('/health/detailed', asyncHandler(async (req, res) => {
    const healthResult = await healthMonitor.runAllChecks();
    const trends = healthMonitor.getHealthTrends();
    const history = healthMonitor.getHistory();
    
    res.json({
        ...healthResult,
        trends,
        history: history.slice(-10) // Last 10 checks
    });
}));

// Health history endpoint
app.get('/health/history', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = healthMonitor.getHistory().slice(-limit);
    
    res.json({
        history,
        trends: healthMonitor.getHealthTrends()
    });
}));

// Readiness probe (for Kubernetes)
app.get('/ready', asyncHandler(async (req, res) => {
    try {
        // Quick check of critical services
        await query('SELECT 1');
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'not ready', error: error.message });
    }
}));

// Liveness probe (for Kubernetes)
app.get('/live', (req, res) => {
    res.json({ 
        status: 'alive', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString() 
    });
});

// Check N8N health
async function checkN8NHealth() {
    try {
        const response = await axios.get(`${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'}/healthz`, {
            timeout: 5000,
        });
        return response.status === 200 ? 'connected' : 'disconnected';
    } catch (error) {
        return 'disconnected';
    }
}

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/estimations', estimationRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/calculations', calculationRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/ai', aiCalculationsRoutes);
app.use('/api/ai', aiComprehensiveRoutes);
app.use('/api/historical', historicalRoutes);
app.use('/api/floorplans', floorplanRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/ai-enhanced', rateLimits.ai, aiEnhancedRoutes);

// Metrics endpoint for monitoring
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', prometheus.register.contentType);
        res.end(await prometheus.register.metrics());
    } catch (error) {
        res.status(500).end(error);
    }
});

// N8N webhook proxy endpoint
app.post('/api/webhook/:workflowName', async (req, res) => {
    try {
        const { workflowName } = req.params;
        const webhookUrl = `${process.env.N8N_WEBHOOK_URL || 'http://n8n:5678'}/webhook/${workflowName}`;
        
        logger.info(`Proxying webhook to N8N: ${webhookUrl}`);
        
        const response = await axios.post(webhookUrl, req.body, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Webhook proxy error:', error);
        res.status(500).json({
            error: 'Failed to execute workflow',
            message: error.message,
        });
    }
});

// Trigger N8N workflow helper function
async function triggerN8NWorkflow(workflowName, data) {
    try {
        const webhookUrl = `${process.env.N8N_WEBHOOK_URL || 'http://n8n:5678'}/webhook/${workflowName}`;
        
        const response = await axios.post(webhookUrl, data, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        logger.error(`N8N workflow trigger failed for ${workflowName}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// Monday.com OAuth Configuration
const mondayOAuth = {
    clientId: process.env.MONDAY_CLIENT_ID,
    clientSecret: process.env.MONDAY_CLIENT_SECRET,
    redirectUri: process.env.MONDAY_REDIRECT_URI || 'https://electricalai-pro.onrender.com/auth/callback'
};

// Monday.com OAuth Routes
app.get('/auth/monday', (req, res) => {
    const authUrl = `https://auth.monday.com/oauth2/authorize?client_id=${mondayOAuth.clientId}&redirect_uri=${mondayOAuth.redirectUri}`;
    res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://auth.monday.com/oauth2/token', {
            client_id: mondayOAuth.clientId,
            client_secret: mondayOAuth.clientSecret,
            redirect_uri: mondayOAuth.redirectUri,
            grant_type: 'authorization_code',
            code: code
        });

        const { access_token } = tokenResponse.data;

        // Get user info from Monday.com with retry logic
        const userResponse = await defaultMondayClient.apiCall(
            'query { me { id name email } }',
            {},
            access_token,
            { requestId: `auth-${Date.now()}` }
        );

        const userData = userResponse.data.me;

        // Store user and token in database
        await query(`
            INSERT INTO monday_users (monday_id, name, email, access_token, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (monday_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                access_token = EXCLUDED.access_token,
                updated_at = NOW()
        `, [userData.id, userData.name, userData.email, access_token]);

        logger.info(`Monday.com user authenticated: ${userData.email}`);

        // Redirect to success page or return token
        res.json({
            success: true,
            user: userData,
            message: 'Authentication successful'
        });

    } catch (error) {
        logger.error('Monday.com OAuth error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});

// Monday.com webhook endpoint with robust retry handling
app.post('/monday-webhook', asyncHandler(async (req, res) => {
    const webhookData = req.body;
    logger.info('Monday.com webhook received:', JSON.stringify(webhookData, null, 2));

    // Verify webhook signature if configured
    const signature = req.headers['authorization'];
    if (process.env.MONDAY_WEBHOOK_SECRET && signature) {
        // TODO: Implement signature verification
        // const expectedSignature = createHmac('sha256', process.env.MONDAY_WEBHOOK_SECRET)
        //     .update(JSON.stringify(webhookData))
        //     .digest('hex');
    }

    // Process webhook event using Monday service
    const result = await defaultMondayService.handleWebhookEvent(webhookData, { query, transaction });
    
    res.json({ 
        success: true, 
        message: 'Webhook processed successfully',
        result 
    });
}));

// Add Monday API health check to main health endpoint
app.get('/monday-health', asyncHandler(async (req, res) => {
    const healthStatus = defaultMondayService.getHealthStatus();
    
    res.json({
        mondayApi: healthStatus,
        timestamp: new Date().toISOString()
    });
}));

// Admin endpoint to reset Monday API circuit breaker
app.post('/admin/monday/reset-circuit-breaker', asyncHandler(async (req, res) => {
    // Add authentication/authorization here
    defaultMondayService.resetCircuitBreaker();
    
    res.json({
        success: true,
        message: 'Monday API circuit breaker reset',
        timestamp: new Date().toISOString()
    });
}));

// Make workflow trigger available to routes
app.use((req, res, next) => {
    req.triggerWorkflow = triggerN8NWorkflow;
    next();
});

// Enhanced global error handler
app.use(async (error, req, res, next) => {
    const timestamp = new Date().toISOString();
    const reference = Date.now();
    
    // Log comprehensive error details
    logger.error(`Error at ${timestamp}:`, {
        error: error.message,
        stack: error.stack,
        request: {
            method: req.method,
            url: req.url,
            body: req.body,
            headers: req.headers,
            ip: req.ip
        },
        reference
    });
    
    // Send error notification for critical errors
    await sendErrorNotification(error, req);
    
    // Handle specific database errors
    if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
            error: 'Duplicate entry detected',
            message: 'A record with this information already exists',
            reference
        });
    }
    
    if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Invalid reference',
            message: 'Referenced record does not exist',
            reference
        });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            message: error.message,
            reference
        });
    }
    
    // Handle rate limiting errors
    if (error.statusCode === 429) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            reference
        });
    }
    
    // Handle timeout errors
    if (error.code === 'ETIMEDOUT' || error.timeout) {
        return res.status(504).json({
            error: 'Request timeout',
            message: 'The request took too long to process',
            reference
        });
    }
    
    // Handle MongoDB/Database connection errors
    if (error.name === 'MongoError' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Database connection failed. Please try again later.',
            reference
        });
    }
    
    // Default error response
    res.status(error.statusCode || 500).json({
        error: 'An error occurred processing your estimate',
        message: process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Our team has been notified and will investigate this issue.',
        reference
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource was not found',
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    try {
        // Close database connections
        const { dbManager } = require('./config/database');
        await dbManager.gracefulShutdown();
        
        // Close Redis connection
        if (redisClient) {
            await redisClient.quit();
            logger.info('Redis connection closed');
        }
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(port, () => {
    logger.info(`Electrical Estimation API server running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    logger.info(`Redis: ${process.env.REDIS_URL ? 'Configured' : 'Not configured'}`);
    logger.info(`N8N: ${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'}`);
});

// Error notification system
async function sendErrorNotification(error, req) {
    try {
        const errorDetails = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            },
            reference: Date.now()
        };

        // Log to file for debugging
        fs.appendFileSync('logs/error.log', `
${JSON.stringify(errorDetails, null, 2)}
---
`);

        // Send to monitoring service (Slack, email, etc.)
        if (process.env.SLACK_WEBHOOK_URL) {
            await axios.post(process.env.SLACK_WEBHOOK_URL, {
                text: `🚨 Critical Error in Electrical Estimation API`,
                attachments: [{
                    color: 'danger',
                    fields: [
                        { title: 'Error', value: error.message, short: false },
                        { title: 'Endpoint', value: `${req.method} ${req.url}`, short: true },
                        { title: 'Time', value: errorDetails.timestamp, short: true },
                        { title: 'Reference', value: errorDetails.reference.toString(), short: true }
                    ]
                }]
            }).catch(slackError => {
                logger.error('Failed to send Slack notification:', slackError.message);
            });
        }

        // Send email notification for critical errors
        if (process.env.ADMIN_EMAIL && process.env.SMTP_ENABLED === 'true') {
            // Email implementation would go here
            logger.info('Email notification queued for admin');
        }

    } catch (notificationError) {
        logger.error('Error notification system failed:', notificationError);
    }
}

// Export async handler for use in routes
app.asyncHandler = asyncHandler;

module.exports = app;