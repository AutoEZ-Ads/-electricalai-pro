const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const validator = require('validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Advanced Rate Limiting
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use IP + User Agent for more accurate limiting
            return crypto.createHash('sha256')
                .update(req.ip + req.get('User-Agent'))
                .digest('hex');
        }
    });
};

// Tiered rate limiting
const rateLimits = {
    // General API endpoints
    general: createRateLimit(15 * 60 * 1000, 100, 'Too many requests from this IP'),
    
    // Authentication endpoints (stricter)
    auth: createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts'),
    
    // File upload endpoints
    upload: createRateLimit(60 * 60 * 1000, 10, 'Too many file uploads'),
    
    // AI processing endpoints (resource intensive)
    ai: createRateLimit(60 * 60 * 1000, 20, 'AI processing limit exceeded'),
    
    // Monday.com webhook endpoints
    webhook: createRateLimit(5 * 60 * 1000, 50, 'Webhook rate limit exceeded')
};

// Slow down middleware for gradual degradation
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 500, // add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // maximum delay of 20 seconds
    keyGenerator: (req) => {
        return crypto.createHash('sha256')
            .update(req.ip + req.get('User-Agent'))
            .digest('hex');
    }
});

// Advanced CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://electricalai-frontend.onrender.com',
            'https://electricalai-pro.onrender.com',
            /\.onrender\.com$/,
            /localhost:\d+$/ // Allow localhost for development
        ];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Monday-Signature',
        'X-API-Key'
    ]
};

// Security headers with Helmet
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.openai.com', 'https://api.monday.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for Monday.com iframe
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Input validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
        const errors = [];
        
        // Validate based on schema
        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];
            
            if (rules.required && !value) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value) {
                // Email validation
                if (rules.email && !validator.isEmail(value)) {
                    errors.push(`${field} must be a valid email`);
                }
                
                // Length validation
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }
                
                // Numeric validation
                if (rules.numeric && !validator.isNumeric(value.toString())) {
                    errors.push(`${field} must be numeric`);
                }
                
                // URL validation
                if (rules.url && !validator.isURL(value)) {
                    errors.push(`${field} must be a valid URL`);
                }
                
                // Custom sanitization
                if (rules.sanitize) {
                    req.body[field] = validator.escape(value);
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }
        
        next();
    };
};

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        
        req.user = user;
        next();
    });
};

// API Key authentication (for service-to-service)
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key required'
        });
    }
    
    // In production, store API keys securely in database
    const validApiKeys = (process.env.API_KEYS || '').split(',');
    
    if (!validApiKeys.includes(apiKey)) {
        return res.status(403).json({
            success: false,
            error: 'Invalid API key'
        });
    }
    
    next();
};

// Monday.com webhook signature verification
const verifyMondaySignature = (req, res, next) => {
    const signature = req.headers['x-monday-signature'];
    const body = JSON.stringify(req.body);
    const secret = process.env.MONDAY_SIGNING_SECRET;
    
    if (!signature || !secret) {
        return res.status(401).json({
            success: false,
            error: 'Webhook signature verification failed'
        });
    }
    
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    
    if (signature !== expectedSignature) {
        return res.status(403).json({
            success: false,
            error: 'Invalid webhook signature'
        });
    }
    
    next();
};

// Request sanitization
const sanitizeRequest = (req, res, next) => {
    // Remove potentially dangerous characters from query params
    for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
            req.query[key] = validator.escape(req.query[key]);
        }
    }
    
    // Limit request size
    if (req.body && JSON.stringify(req.body).length > 1024 * 1024) { // 1MB limit
        return res.status(413).json({
            success: false,
            error: 'Request payload too large'
        });
    }
    
    next();
};

// Advanced compression
const compressionConfig = compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
});

// Security audit logging
const securityLogger = (req, res, next) => {
    const securityEvents = ['login', 'logout', 'failed_auth', 'admin_action'];
    const path = req.path.toLowerCase();
    
    if (securityEvents.some(event => path.includes(event))) {
        console.log(`Security Event: ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            user: req.user?.id || 'anonymous'
        });
    }
    
    next();
};

// Export all security middleware
module.exports = {
    rateLimits,
    speedLimiter,
    corsOptions,
    helmetConfig,
    validateInput,
    authenticateToken,
    authenticateApiKey,
    verifyMondaySignature,
    sanitizeRequest,
    compressionConfig,
    securityLogger,
    
    // Convenience function to apply all basic security
    applyBasicSecurity: (app) => {
        app.use(helmetConfig);
        app.use(cors(corsOptions));
        app.use(compressionConfig);
        app.use(speedLimiter);
        app.use(sanitizeRequest);
        app.use(securityLogger);
        app.use(rateLimits.general);
    }
};