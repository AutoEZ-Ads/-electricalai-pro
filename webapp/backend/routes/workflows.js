const express = require('express');
const { body, param, validationResult } = require('express-validator');
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

// Get workflow execution history
router.get('/executions', async (req, res) => {
    try {
        const { project_id, workflow_name, status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT we.*, p.name as project_name
            FROM workflow_executions we
            LEFT JOIN projects p ON we.project_id = p.id
        `;
        
        const conditions = [];
        const values = [];
        let paramCount = 0;
        
        if (project_id) {
            conditions.push(`we.project_id = $${++paramCount}`);
            values.push(project_id);
        }
        
        if (workflow_name) {
            conditions.push(`we.workflow_name = $${++paramCount}`);
            values.push(workflow_name);
        }
        
        if (status) {
            conditions.push(`we.status = $${++paramCount}`);
            values.push(status);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY we.started_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        values.push(limit, offset);
        
        const result = await req.db.query(query, values);
        res.json(result.rows);
    } catch (error) {
        req.logger.error('Error fetching workflow executions:', error);
        res.status(500).json({ error: 'Failed to fetch workflow executions' });
    }
});

// Get single workflow execution
router.get('/executions/:id', [param('id').isUUID()], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT we.*, p.name as project_name
            FROM workflow_executions we
            LEFT JOIN projects p ON we.project_id = p.id
            WHERE we.id = $1
        `;
        
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow execution not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        req.logger.error('Error fetching workflow execution:', error);
        res.status(500).json({ error: 'Failed to fetch workflow execution' });
    }
});

// Trigger workflow manually
router.post('/trigger/:workflowName', [
    param('workflowName').notEmpty(),
    body('data').isObject(),
], handleValidationErrors, async (req, res) => {
    try {
        const { workflowName } = req.params;
        const { data } = req.body;
        
        const result = await req.triggerWorkflow(workflowName, data);
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to trigger workflow',
                details: result.error,
            });
        }
        
        res.json({
            message: `Workflow ${workflowName} triggered successfully`,
            result: result.data,
        });
    } catch (error) {
        req.logger.error('Error triggering workflow:', error);
        res.status(500).json({ error: 'Failed to trigger workflow' });
    }
});

module.exports = router;