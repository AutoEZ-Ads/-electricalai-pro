const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();

// Import asyncHandler from the main app (you'll need to pass it to routes)
// Alternative: Create a utils file for the asyncHandler
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.details = errors.array();
        throw error;
    }
    next();
};

// BEFORE: Manual try/catch in every route
router.get('/old-way', async (req, res) => {
    try {
        const { status, project_id, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT e.*, p.name as project_name, p.building_type
            FROM estimations e
            JOIN projects p ON e.project_id = p.id
        `;
        
        const conditions = [];
        const values = [];
        let paramCount = 0;
        
        if (status) {
            conditions.push(`e.status = $${++paramCount}`);
            values.push(status);
        }
        
        if (project_id) {
            conditions.push(`e.project_id = $${++paramCount}`);
            values.push(project_id);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY e.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        values.push(limit, offset);
        
        const result = await req.db.query(query, values);
        res.json(result.rows);
    } catch (error) {
        req.logger.error('Error fetching estimations:', error);
        res.status(500).json({ error: 'Failed to fetch estimations' });
    }
});

// AFTER: Using asyncHandler - cleaner code, automatic error handling
router.get('/', asyncHandler(async (req, res) => {
    const { status, project_id, limit = 50, offset = 0 } = req.query;
    
    let query = `
        SELECT e.*, p.name as project_name, p.building_type
        FROM estimations e
        JOIN projects p ON e.project_id = p.id
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 0;
    
    if (status) {
        conditions.push(`e.status = $${++paramCount}`);
        values.push(status);
    }
    
    if (project_id) {
        conditions.push(`e.project_id = $${++paramCount}`);
        values.push(project_id);
    }
    
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY e.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);
    
    const result = await req.db.query(query, values);
    res.json(result.rows);
    // No try/catch needed! asyncHandler catches any errors and passes to global error handler
}));

// Get single estimation with validation
router.get('/:id', [
    param('id').isUUID()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT e.*, p.name as project_name, p.building_type
        FROM estimations e
        JOIN projects p ON e.project_id = p.id
        WHERE e.id = $1
    `;
    
    const result = await req.db.query(query, [id]);
    
    if (result.rows.length === 0) {
        const error = new Error('Estimation not found');
        error.statusCode = 404;
        throw error;
    }
    
    res.json(result.rows[0]);
}));

// Create new estimation with comprehensive validation
router.post('/', [
    body('project_id').isUUID().withMessage('Valid project ID required'),
    body('estimation_type').isIn(['preliminary', 'detailed', 'competitive']),
    body('square_footage').optional().isFloat({ min: 0 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], handleValidationErrors, asyncHandler(async (req, res) => {
    const {
        project_id,
        estimation_type = 'preliminary',
        square_footage,
        priority = 'medium',
        notes
    } = req.body;
    
    // Verify project exists
    const projectCheck = await req.db.query(
        'SELECT id FROM projects WHERE id = $1',
        [project_id]
    );
    
    if (projectCheck.rows.length === 0) {
        const error = new Error('Project not found');
        error.statusCode = 404;
        throw error;
    }
    
    // Create estimation
    const query = `
        INSERT INTO estimations (
            project_id, estimation_type, square_footage, 
            priority, notes, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
        RETURNING *
    `;
    
    const result = await req.db.query(query, [
        project_id,
        estimation_type,
        square_footage,
        priority,
        notes
    ]);
    
    const estimation = result.rows[0];
    
    // Trigger N8N workflow for estimation processing
    if (req.triggerWorkflow) {
        const workflowResult = await req.triggerWorkflow('electrical-estimation', {
            estimationId: estimation.id,
            projectId: project_id,
            estimationType: estimation_type,
            squareFootage: square_footage,
            priority,
            source: 'api'
        });
        
        if (!workflowResult.success) {
            req.logger.warn(`Failed to trigger estimation workflow: ${workflowResult.error}`);
        }
    }
    
    res.status(201).json(estimation);
}));

// Complex calculation endpoint with multiple potential failure points
router.post('/:id/calculate', [
    param('id').isUUID(),
    body('calculation_method').isIn(['standard', 'detailed', 'nec_compliant']),
    body('material_specifications').optional().isObject(),
    body('labor_rates').optional().isObject()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { calculation_method, material_specifications, labor_rates } = req.body;
    
    // Get estimation details
    const estimation = await req.db.query(
        'SELECT * FROM estimations WHERE id = $1',
        [id]
    );
    
    if (estimation.rows.length === 0) {
        const error = new Error('Estimation not found');
        error.statusCode = 404;
        throw error;
    }
    
    const est = estimation.rows[0];
    
    // Perform complex calculations that might fail
    const calculationData = {
        estimationId: id,
        method: calculation_method,
        squareFootage: est.square_footage,
        buildingType: est.building_type,
        materialSpecs: material_specifications,
        laborRates: labor_rates
    };
    
    // This might throw various errors (network, validation, calculation errors)
    const calculationResult = await performComplexCalculation(calculationData);
    
    // Update estimation with results
    await req.db.query(`
        UPDATE estimations 
        SET 
            calculations = $1,
            material_cost = $2,
            labor_cost = $3,
            total_cost = $4,
            status = 'completed',
            updated_at = NOW()
        WHERE id = $5
    `, [
        JSON.stringify(calculationResult.details),
        calculationResult.materialCost,
        calculationResult.laborCost,
        calculationResult.totalCost,
        id
    ]);
    
    res.json({
        estimationId: id,
        calculationResult,
        message: 'Calculation completed successfully'
    });
}));

// Simulate complex calculation function that might fail
async function performComplexCalculation(data) {
    // Simulate network call to external service
    if (Math.random() < 0.1) { // 10% chance of network error
        const error = new Error('External calculation service unavailable');
        error.statusCode = 503;
        throw error;
    }
    
    // Simulate validation error
    if (!data.squareFootage || data.squareFootage <= 0) {
        const error = new Error('Invalid square footage for calculation');
        error.statusCode = 400;
        throw error;
    }
    
    // Simulate calculation
    const baseCost = data.squareFootage * 12.50; // $12.50 per sq ft
    const materialCost = baseCost * 0.6;
    const laborCost = baseCost * 0.4;
    const totalCost = materialCost + laborCost;
    
    return {
        materialCost,
        laborCost,
        totalCost,
        details: {
            method: data.method,
            calculatedAt: new Date().toISOString(),
            baseCostPerSqFt: 12.50
        }
    };
}

module.exports = router;