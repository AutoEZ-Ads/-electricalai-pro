const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const Redis = require('redis');
const axios = require('axios');
const winston = require('winston');
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

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

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

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
    req.db = pool;
    req.redis = redisClient;
    req.logger = logger;
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
        // Check Redis connection
        let redisStatus = 'disconnected';
        try {
            await redisClient.ping();
            redisStatus = 'connected';
        } catch (error) {
            logger.warn('Redis health check failed:', error.message);
        }

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                redis: redisStatus,
                n8n: await checkN8NHealth(),
            },
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
        });
    }
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

        // Get user info from Monday.com
        const userResponse = await axios.post('https://api.monday.com/v2', {
            query: 'query { me { id name email } }'
        }, {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        });

        const userData = userResponse.data.data.me;

        // Store user and token in database
        await pool.query(`
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

// Monday.com webhook endpoint
app.post('/monday-webhook', async (req, res) => {
    try {
        const webhookData = req.body;
        logger.info('Monday.com webhook received:', JSON.stringify(webhookData, null, 2));

        // Verify webhook signature if configured
        const signature = req.headers['authorization'];
        if (process.env.MONDAY_WEBHOOK_SECRET && signature) {
            // Implement signature verification here
            // const expectedSignature = createHmac('sha256', process.env.MONDAY_WEBHOOK_SECRET)
            //     .update(JSON.stringify(webhookData))
            //     .digest('hex');
        }

        // Process different webhook events
        const { event, pulseId, boardId, userId } = webhookData;

        switch (event?.type) {
            case 'create_item':
                await handleCreateItem(webhookData);
                break;
            case 'change_column_value':
                await handleColumnChange(webhookData);
                break;
            case 'create_update':
                await handleCreateUpdate(webhookData);
                break;
            case 'item_deleted':
                await handleItemDeleted(webhookData);
                break;
            default:
                logger.info(`Unhandled webhook event: ${event?.type}`);
        }

        res.json({ success: true, message: 'Webhook processed successfully' });

    } catch (error) {
        logger.error('Monday.com webhook processing error:', error);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message
        });
    }
});

// Monday.com webhook event handlers
async function handleCreateItem(webhookData) {
    const { pulseId, boardId, pulseName } = webhookData;
    
    logger.info(`New item created: ${pulseName} (ID: ${pulseId}) in board ${boardId}`);
    
    // Trigger estimation workflow for new projects
    const workflowResult = await triggerN8NWorkflow('electrical-estimation', {
        itemId: pulseId,
        boardId: boardId,
        itemName: pulseName,
        source: 'monday-webhook',
        timestamp: new Date().toISOString()
    });

    if (workflowResult.success) {
        logger.info(`Estimation workflow triggered for item ${pulseId}`);
    } else {
        logger.error(`Failed to trigger estimation workflow for item ${pulseId}: ${workflowResult.error}`);
    }
}

async function handleColumnChange(webhookData) {
    const { pulseId, columnId, value, previousValue } = webhookData;
    
    logger.info(`Column ${columnId} changed for item ${pulseId}: ${previousValue} -> ${value}`);

    // Trigger material cost update if cost-related columns changed
    if (columnId === 'cost_estimate' || columnId === 'material_list') {
        await triggerN8NWorkflow('material-cost-update', {
            itemId: pulseId,
            columnId: columnId,
            newValue: value,
            previousValue: previousValue,
            source: 'monday-webhook'
        });
    }
}

async function handleCreateUpdate(webhookData) {
    const { pulseId, updateText, userId } = webhookData;
    
    logger.info(`Update created for item ${pulseId} by user ${userId}: ${updateText}`);

    // Trigger progress monitoring workflow
    await triggerN8NWorkflow('project-progress-update', {
        itemId: pulseId,
        updateText: updateText,
        userId: userId,
        source: 'monday-webhook'
    });
}

async function handleItemDeleted(webhookData) {
    const { pulseId, boardId } = webhookData;
    
    logger.info(`Item ${pulseId} deleted from board ${boardId}`);

    // Clean up related records
    try {
        await pool.query('DELETE FROM project_estimations WHERE monday_item_id = $1', [pulseId]);
        logger.info(`Cleaned up estimation records for deleted item ${pulseId}`);
    } catch (error) {
        logger.error(`Failed to clean up records for deleted item ${pulseId}:`, error);
    }
}

// Make workflow trigger available to routes
app.use((req, res, next) => {
    req.triggerWorkflow = triggerN8NWorkflow;
    next();
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
            error: 'Duplicate entry',
            message: 'A record with this information already exists',
        });
    }
    
    if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Invalid reference',
            message: 'Referenced record does not exist',
        });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
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
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    // Close database connections
    pool.end(() => {
        logger.info('Database pool closed');
    });
    
    // Close Redis connection
    if (redisClient) {
        redisClient.quit();
    }
    
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    
    // Close database connections
    pool.end(() => {
        logger.info('Database pool closed');
    });
    
    // Close Redis connection
    if (redisClient) {
        redisClient.quit();
    }
    
    process.exit(0);
});

// Start server
app.listen(port, () => {
    logger.info(`Electrical Estimation API server running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    logger.info(`Redis: ${process.env.REDIS_URL ? 'Configured' : 'Not configured'}`);
    logger.info(`N8N: ${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'}`);
});

module.exports = app;