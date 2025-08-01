const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array(),
        });
    }
    next();
};

// Direct calculation endpoint (bypasses N8N for simple calculations)
router.post('/direct', [
    body('type').isIn(['load', 'wire', 'conduit', 'voltageDrop', 'panel', 'service', 'circuit']),
    body('parameters').isObject(),
], handleValidationErrors, async (req, res) => {
    try {
        const { type, parameters } = req.body;
        
        // Trigger N8N electrical calculator workflow directly
        const workflowData = {
            calculationType: type,
            ...parameters,
            direct_calculation: true,
        };
        
        const result = await req.triggerWorkflow('electrical-calculator', workflowData);
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Calculation failed',
                details: result.error,
            });
        }
        
        res.json({
            calculation_type: type,
            parameters,
            result: result.data,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        req.logger.error('Error performing calculation:', error);
        res.status(500).json({ error: 'Failed to perform calculation' });
    }
});

// Get calculation history for a project
router.get('/project/:projectId/history', async (req, res) => {
    try {
        const { projectId } = req.params;
        
        const query = `
            SELECT lc.*, cc.*, e.estimation_type
            FROM estimations e
            LEFT JOIN load_calculations lc ON e.id = lc.estimation_id
            LEFT JOIN circuit_calculations cc ON e.id = cc.estimation_id
            WHERE e.project_id = $1
            ORDER BY e.created_at DESC
        `;
        
        const result = await req.db.query(query, [projectId]);
        res.json(result.rows);
    } catch (error) {
        req.logger.error('Error fetching calculation history:', error);
        res.status(500).json({ error: 'Failed to fetch calculation history' });
    }
});

module.exports = router;