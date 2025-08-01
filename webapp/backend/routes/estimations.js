const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
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

// Get all estimations
router.get('/', async (req, res) => {
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

// Get single estimation
router.get('/:id', [param('id').isUUID()], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT e.*, p.name as project_name, p.building_type
            FROM estimations e
            JOIN projects p ON e.project_id = p.id
            WHERE e.id = $1
        `;
        
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estimation not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        req.logger.error('Error fetching estimation:', error);
        res.status(500).json({ error: 'Failed to fetch estimation' });
    }
});

// Update estimation (typically called by N8N workflows)
router.put('/:id', [
    param('id').isUUID(),
    body('status').optional().isIn(['pending', 'processing', 'completed', 'error']),
    body('calculations').optional().isObject(),
    body('material_cost').optional().isDecimal(),
    body('labor_cost').optional().isDecimal(),
    body('equipment_cost').optional().isDecimal(),
    body('total_cost').optional().isDecimal(),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                updateFields.push(`${key} = $${++paramCount}`);
                if (key === 'calculations') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }
        
        if (updates.status === 'completed') {
            updateFields.push(`completed_at = NOW()`);
        }
        
        updateFields.push(`updated_at = NOW()`);
        values.push(id);
        
        const query = `
            UPDATE estimations 
            SET ${updateFields.join(', ')}
            WHERE id = $${++paramCount}
            RETURNING *
        `;
        
        const result = await req.db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estimation not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        req.logger.error('Error updating estimation:', error);
        res.status(500).json({ error: 'Failed to update estimation' });
    }
});

module.exports = router;