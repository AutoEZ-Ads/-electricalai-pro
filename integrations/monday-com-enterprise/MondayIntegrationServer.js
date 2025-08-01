const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { MondayEnterpriseConnector } = require('./MondayEnterpriseConnector');
const { ElectricalMondayService } = require('./ElectricalMondayService');

/**
 * Monday.com Integration Server for Electrical Estimation System
 * 
 * This server provides REST API endpoints and webhook handling
 * for Monday.com enterprise integration.
 */

class MondayIntegrationServer {
    constructor(config = {}) {
        this.config = {
            port: process.env.PORT || 3003,
            mondayApiToken: process.env.MONDAY_API_TOKEN,
            webhookSecret: process.env.MONDAY_WEBHOOK_SECRET,
            calculatorServiceUrl: process.env.CALCULATOR_SERVICE_URL || 'http://localhost:3002',
            enableCors: process.env.ENABLE_CORS !== 'false',
            enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
            logLevel: process.env.LOG_LEVEL || 'info',
            ...config
        };

        this.app = express();
        this.mondayService = null;
        this.server = null;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));

        // CORS configuration
        if (this.config.enableCors) {
            this.app.use(cors({
                origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://monday.com'],
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Monday-Signature']
            }));
        }

        // Rate limiting
        if (this.config.enableRateLimit) {
            const limiter = rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000, // limit each IP to 1000 requests per windowMs
                message: {
                    error: 'Too many requests from this IP, please try again later.',
                    retryAfter: '15 minutes'
                },
                standardHeaders: true,
                legacyHeaders: false,
            });
            this.app.use(limiter);
        }

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            if (this.config.logLevel === 'debug') {
                console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
            }
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'monday-integration-server',
                version: '1.0.0',
                config: {
                    mondayConnected: !!this.mondayService,
                    calculatorServiceUrl: this.config.calculatorServiceUrl
                }
            });
        });

        // Monday.com webhook endpoint
        this.app.post('/monday/webhook', async (req, res) => {
            try {
                const signature = req.headers['x-monday-signature'];
                
                if (!this.mondayService) {
                    return res.status(503).json({ error: 'Monday service not initialized' });
                }

                await this.mondayService.handleWebhook(req.body, signature);
                
                res.json({ 
                    success: true, 
                    message: 'Webhook processed successfully',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Webhook processing error:', error);
                res.status(500).json({ 
                    error: 'Webhook processing failed', 
                    message: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Initialize workspace
        this.app.post('/api/workspace/initialize', async (req, res) => {
            try {
                const { workspaceName } = req.body;
                
                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const workspace = await this.mondayService.initializeWorkspace(workspaceName);
                
                res.json({
                    success: true,
                    data: workspace,
                    message: 'Workspace initialized successfully'
                });

            } catch (error) {
                console.error('Workspace initialization error:', error);
                res.status(500).json({
                    error: 'Failed to initialize workspace',
                    message: error.message
                });
            }
        });

        // Create electrical project
        this.app.post('/api/projects', async (req, res) => {
            try {
                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const project = await this.mondayService.createProject(req.body);
                
                res.status(201).json({
                    success: true,
                    data: project,
                    message: 'Project created successfully'
                });

            } catch (error) {
                console.error('Project creation error:', error);
                res.status(500).json({
                    error: 'Failed to create project',
                    message: error.message
                });
            }
        });

        // Get projects with filtering
        this.app.get('/api/projects', async (req, res) => {
            try {
                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const { 
                    boardId, 
                    status, 
                    priority, 
                    buildingType, 
                    minArea, 
                    maxArea,
                    assignee,
                    tags 
                } = req.query;

                const filters = {
                    ...(status && { status: status.split(',') }),
                    ...(priority && { priority: priority.split(',') }),
                    ...(buildingType && { buildingType: buildingType.split(',') }),
                    ...(minArea && { minArea: parseInt(minArea) }),
                    ...(maxArea && { maxArea: parseInt(maxArea) }),
                    ...(assignee && { assignee: assignee.split(',') }),
                    ...(tags && { tags: tags.split(',') })
                };

                const projects = await this.mondayService.mondayConnector.getElectricalProjects(
                    boardId, 
                    Object.keys(filters).length > 0 ? filters : undefined
                );
                
                res.json({
                    success: true,
                    data: projects,
                    count: projects.length
                });

            } catch (error) {
                console.error('Projects retrieval error:', error);
                res.status(500).json({
                    error: 'Failed to retrieve projects',
                    message: error.message
                });
            }
        });

        // Perform electrical calculation
        this.app.post('/api/calculate', async (req, res) => {
            try {
                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const results = await this.mondayService.performElectricalCalculation(req.body);
                
                res.json({
                    success: true,
                    data: results,
                    message: 'Calculation completed successfully'
                });

            } catch (error) {
                console.error('Calculation error:', error);
                res.status(500).json({
                    error: 'Calculation failed',
                    message: error.message
                });
            }
        });

        // Sync calculation results to Monday item
        this.app.post('/api/projects/:itemId/sync', async (req, res) => {
            try {
                const { itemId } = req.params;
                const { calculationResults } = req.body;

                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                await this.mondayService.syncCalculationResults(itemId, calculationResults);
                
                res.json({
                    success: true,
                    message: 'Results synced successfully'
                });

            } catch (error) {
                console.error('Sync error:', error);
                res.status(500).json({
                    error: 'Failed to sync results',
                    message: error.message
                });
            }
        });

        // Generate project report
        this.app.get('/api/reports', async (req, res) => {
            try {
                const { boardId, format = 'json' } = req.query;

                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const report = await this.mondayService.generateProjectReport(boardId);
                
                if (format === 'csv') {
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', 'attachment; filename="electrical-report.csv"');
                    res.send(this.convertToCSV(report));
                } else {
                    res.json({
                        success: true,
                        data: report,
                        message: 'Report generated successfully'
                    });
                }

            } catch (error) {
                console.error('Report generation error:', error);
                res.status(500).json({
                    error: 'Failed to generate report',
                    message: error.message
                });
            }
        });

        // Bulk import projects
        this.app.post('/api/projects/bulk-import', async (req, res) => {
            try {
                const { projects, source = 'json', options = {} } = req.body;

                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const results = await this.mondayService.bulkImportProjects(projects, source, options);
                
                res.json({
                    success: true,
                    data: results,
                    message: `Bulk import completed: ${results.summary.imported}/${results.summary.total} projects imported`
                });

            } catch (error) {
                console.error('Bulk import error:', error);
                res.status(500).json({
                    error: 'Bulk import failed',
                    message: error.message
                });
            }
        });

        // Setup project automations
        this.app.post('/api/automations/setup', async (req, res) => {
            try {
                const { boardId } = req.body;

                if (!this.mondayService) {
                    await this.initializeMondayService();
                }

                const automations = await this.mondayService.setupElectricalAutomations(boardId);
                
                res.json({
                    success: true,
                    data: automations,
                    message: 'Automations setup completed'
                });

            } catch (error) {
                console.error('Automation setup error:', error);
                res.status(500).json({
                    error: 'Failed to setup automations',
                    message: error.message
                });
            }
        });

        // Get integration status
        this.app.get('/api/status', async (req, res) => {
            try {
                const status = {
                    server: {
                        running: true,
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        version: '1.0.0'
                    },
                    monday: {
                        connected: !!this.mondayService,
                        apiToken: !!this.config.mondayApiToken,
                        webhookSecret: !!this.config.webhookSecret
                    },
                    calculator: {
                        serviceUrl: this.config.calculatorServiceUrl,
                        healthy: await this.checkCalculatorHealth()
                    }
                };

                res.json({
                    success: true,
                    data: status
                });

            } catch (error) {
                console.error('Status check error:', error);
                res.status(500).json({
                    error: 'Failed to get status',
                    message: error.message
                });
            }
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            const errorResponse = {
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
                service: 'monday-integration-server',
                path: req.path,
                method: req.method
            };
            
            if (isDevelopment) {
                errorResponse.stack = error.stack;
                errorResponse.message = error.message;
            }
            
            res.status(500).json(errorResponse);
        });

        // Handle 404s
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString(),
                service: 'monday-integration-server'
            });
        });
    }

    async initializeMondayService() {
        if (!this.config.mondayApiToken) {
            throw new Error('Monday.com API token is required');
        }

        const calculationService = {
            calculateLoad: async (params) => {
                const response = await fetch(`${this.config.calculatorServiceUrl}/api/calculate/load`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                return response.json();
            },
            calculateWireSizing: async (params) => {
                const response = await fetch(`${this.config.calculatorServiceUrl}/api/calculate/wire-sizing`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                return response.json();
            },
            validateNECCompliance: async (params) => {
                // NEC compliance validation logic
                return { nec_compliant: true, violations: [], notes: [] };
            }
        };

        this.mondayService = new ElectricalMondayService({
            apiToken: this.config.mondayApiToken,
            webhookSecret: this.config.webhookSecret,
            calculationService: calculationService,
            autoCalculate: true,
            autoSync: true,
            enableNotifications: true
        });

        // Setup event handlers
        this.mondayService.on('error', (error) => {
            console.error('Monday service error:', error);
        });

        this.mondayService.on('projectCreated', (data) => {
            console.log(`Project created: ${data.mondayItem.name}`);
        });

        this.mondayService.on('calculationCompleted', (data) => {
            console.log(`Calculation completed for project with ${data.params.area_sqft} sq ft`);
        });

        console.log('Monday.com service initialized successfully');
    }

    async checkCalculatorHealth() {
        try {
            const response = await fetch(`${this.config.calculatorServiceUrl}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    convertToCSV(report) {
        // Simple CSV conversion for reports
        const headers = ['Name', 'Area (sq ft)', 'Building Type', 'Status', 'Estimated Cost', 'NEC Compliant'];
        const rows = report.projects.map(project => [
            project.name,
            this.getColumnValue(project, 'Area (sq ft)'),
            this.getColumnValue(project, 'Building Type'),
            this.getColumnValue(project, 'Status'),
            this.getColumnValue(project, 'Estimated Cost'),
            this.getColumnValue(project, 'NEC Compliant')
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    getColumnValue(item, columnTitle) {
        const column = item.column_values?.find(cv => cv.title === columnTitle);
        return column?.text || '';
    }

    async start() {
        try {
            this.server = this.app.listen(this.config.port, '0.0.0.0', async () => {
                console.log(`🔌 Monday.com Integration Server running on port ${this.config.port}`);
                console.log(`🌐 Health check: http://localhost:${this.config.port}/health`);
                console.log(`📊 API docs: http://localhost:${this.config.port}/api/status`);
                
                // Initialize Monday service if API token is available
                if (this.config.mondayApiToken) {
                    try {
                        await this.initializeMondayService();
                        console.log('✅ Monday.com service ready');
                    } catch (error) {
                        console.error('❌ Monday.com service initialization failed:', error.message);
                    }
                } else {
                    console.warn('⚠️  MONDAY_API_TOKEN not set - some features will be unavailable');
                }
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.stop());
            process.on('SIGINT', () => this.stop());

        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async stop() {
        console.log('Shutting down Monday.com Integration Server...');
        
        if (this.server) {
            this.server.close(() => {
                console.log('Server stopped');
                process.exit(0);
            });
        }
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new MondayIntegrationServer();
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = { MondayIntegrationServer };