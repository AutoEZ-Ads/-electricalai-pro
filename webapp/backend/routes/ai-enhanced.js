const express = require('express');
const router = express.Router();
const multer = require('multer');
const AIOptimizationService = require('../services/ai-optimization');
const { trackEstimationTime, businessMetrics, trackError } = require('../middleware/advanced-monitoring');

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
        }
    }
});

const aiService = new AIOptimizationService();

// AI-Enhanced Load Calculation Endpoint
router.post('/load-calculation', upload.single('blueprint'), async (req, res) => {
    const timer = trackEstimationTime('enhanced_load_calculation');
    
    try {
        const { specifications, buildingData } = req.body;
        
        // Parse specifications if sent as string
        const parsedSpecs = typeof specifications === 'string' 
            ? JSON.parse(specifications) 
            : specifications;
            
        const parsedBuildingData = typeof buildingData === 'string'
            ? JSON.parse(buildingData)
            : buildingData;

        // Enhanced blueprint analysis
        let blueprintData = parsedBuildingData || {};
        
        if (req.file) {
            // In a real implementation, you'd use OCR/image analysis here
            blueprintData.uploadedFile = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        // AI-optimized load calculation
        const loadCalculation = await aiService.optimizeLoadCalculation(
            blueprintData, 
            parsedSpecs || {}
        );

        // Track business metrics
        businessMetrics.estimationsCreated.inc();
        businessMetrics.estimationAccuracy.observe(loadCalculation.confidence || 0.7);

        timer.end();

        res.json({
            success: true,
            data: loadCalculation,
            enhanced: true,
            processingTime: timer.operation,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        timer.end();
        trackError(error, req, { operation: 'load_calculation' });
        
        res.status(500).json({
            success: false,
            error: 'Load calculation failed',
            message: error.message,
            fallback: true
        });
    }
});

// AI Material Optimization Endpoint
router.post('/optimize-materials', async (req, res) => {
    const timer = trackEstimationTime('material_optimization');
    
    try {
        const { loadCalculation, preferences } = req.body;
        
        if (!loadCalculation) {
            return res.status(400).json({
                success: false,
                error: 'Load calculation data is required'
            });
        }

        const optimizedMaterials = await aiService.optimizeMaterialList(
            loadCalculation,
            preferences || {}
        );

        timer.end();

        res.json({
            success: true,
            data: optimizedMaterials,
            optimized: true,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        timer.end();
        trackError(error, req, { operation: 'material_optimization' });
        
        res.status(500).json({
            success: false,
            error: 'Material optimization failed',
            message: error.message
        });
    }
});

// AI Code Compliance Check
router.post('/check-compliance', async (req, res) => {
    const timer = trackEstimationTime('compliance_check');
    
    try {
        const { estimation, jurisdiction } = req.body;
        
        if (!estimation) {
            return res.status(400).json({
                success: false,
                error: 'Estimation data is required'
            });
        }

        const complianceReport = await aiService.checkCodeCompliance(
            estimation,
            jurisdiction || 'NEC2023'
        );

        timer.end();

        res.json({
            success: true,
            data: complianceReport,
            jurisdiction: jurisdiction || 'NEC2023',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        timer.end();
        trackError(error, req, { operation: 'compliance_check' });
        
        res.status(500).json({
            success: false,
            error: 'Compliance check failed',
            message: error.message
        });
    }
});

// AI Project Schedule Optimization
router.post('/optimize-schedule', async (req, res) => {
    const timer = trackEstimationTime('schedule_optimization');
    
    try {
        const { estimation, constraints } = req.body;
        
        if (!estimation) {
            return res.status(400).json({
                success: false,
                error: 'Estimation data is required'
            });
        }

        const optimizedSchedule = await aiService.optimizeProjectSchedule(
            estimation,
            constraints || {}
        );

        timer.end();

        res.json({
            success: true,
            data: optimizedSchedule,
            optimized: true,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        timer.end();
        trackError(error, req, { operation: 'schedule_optimization' });
        
        res.status(500).json({
            success: false,
            error: 'Schedule optimization failed',
            message: error.message
        });
    }
});

// Comprehensive AI Analysis (combines multiple AI services)
router.post('/comprehensive-analysis', upload.single('blueprint'), async (req, res) => {
    const timer = trackEstimationTime('comprehensive_analysis');
    
    try {
        const { specifications, buildingData, preferences, constraints } = req.body;
        
        // Parse JSON strings
        const parsedSpecs = typeof specifications === 'string' 
            ? JSON.parse(specifications) 
            : specifications || {};
            
        const parsedBuildingData = typeof buildingData === 'string'
            ? JSON.parse(buildingData)
            : buildingData || {};
            
        const parsedPreferences = typeof preferences === 'string'
            ? JSON.parse(preferences)
            : preferences || {};
            
        const parsedConstraints = typeof constraints === 'string'
            ? JSON.parse(constraints)
            : constraints || {};

        // Prepare blueprint data
        let blueprintData = parsedBuildingData;
        
        if (req.file) {
            blueprintData.uploadedFile = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        // Step 1: AI Load Calculation
        const loadCalculation = await aiService.optimizeLoadCalculation(
            blueprintData, 
            parsedSpecs
        );

        // Step 2: Material Optimization
        const materialOptimization = await aiService.optimizeMaterialList(
            loadCalculation,
            parsedPreferences
        );

        // Step 3: Code Compliance Check
        const complianceCheck = await aiService.checkCodeCompliance({
            loadCalculation,
            materials: materialOptimization
        });

        // Step 4: Schedule Optimization
        const scheduleOptimization = await aiService.optimizeProjectSchedule(
            { loadCalculation, materials: materialOptimization },
            parsedConstraints
        );

        // Compile comprehensive report
        const comprehensiveAnalysis = {
            loadCalculation,
            materialOptimization,
            complianceCheck,
            scheduleOptimization,
            summary: {
                projectViability: complianceCheck.overallCompliance !== false,
                estimatedCost: materialOptimization.totalCost || 'TBD',
                projectDuration: scheduleOptimization.totalDays || 'TBD',
                complianceScore: complianceCheck.complianceScore || 'TBD',
                riskLevel: complianceCheck.riskLevel || 'medium'
            },
            recommendations: this.generateRecommendations({
                loadCalculation,
                materialOptimization,
                complianceCheck,
                scheduleOptimization
            })
        };

        // Track comprehensive metrics
        businessMetrics.estimationsCreated.inc();
        businessMetrics.estimationAccuracy.observe(loadCalculation.confidence || 0.8);

        timer.end();

        res.json({
            success: true,
            data: comprehensiveAnalysis,
            enhanced: true,
            comprehensive: true,
            processingTime: timer.operation,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        timer.end();
        trackError(error, req, { operation: 'comprehensive_analysis' });
        
        res.status(500).json({
            success: false,
            error: 'Comprehensive analysis failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// AI Health Check endpoint
router.get('/ai-status', async (req, res) => {
    try {
        const status = {
            aiServiceAvailable: !!process.env.OPENAI_API_KEY,
            cacheSize: aiService.cache?.size || 0,
            lastUpdate: new Date().toISOString(),
            capabilities: [
                'load_calculation',
                'material_optimization',
                'compliance_checking',
                'schedule_optimization',
                'comprehensive_analysis'
            ]
        };

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'AI status check failed',
            message: error.message
        });
    }
});

// Generate intelligent recommendations
function generateRecommendations(analysis) {
    const recommendations = [];
    
    // Cost optimization recommendations
    if (analysis.materialOptimization?.costSavingOpportunities) {
        recommendations.push({
            type: 'cost_optimization',
            priority: 'high',
            description: 'Potential cost savings identified in material selection',
            details: analysis.materialOptimization.costSavingOpportunities
        });
    }
    
    // Compliance recommendations
    if (analysis.complianceCheck?.violations?.length > 0) {
        recommendations.push({
            type: 'compliance',
            priority: 'critical',
            description: 'Code compliance issues require attention',
            details: analysis.complianceCheck.violations
        });
    }
    
    // Schedule optimization recommendations
    if (analysis.scheduleOptimization?.criticalPath) {
        recommendations.push({
            type: 'schedule',
            priority: 'medium',
            description: 'Critical path optimization opportunities',
            details: analysis.scheduleOptimization.criticalPath
        });
    }
    
    return recommendations;
}

module.exports = router;