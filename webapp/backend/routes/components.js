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

// Get all electrical components
router.get('/', async (req, res) => {
    try {
        const { category, active = 'true', search, limit = 100, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM electrical_components';
        const conditions = [];
        const values = [];
        let paramCount = 0;
        
        if (category) {
            conditions.push(`category = $${++paramCount}`);
            values.push(category);
        }
        
        if (active === 'true') {
            conditions.push(`active = $${++paramCount}`);
            values.push(true);
        }
        
        if (search) {
            conditions.push(`(name ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`);
            values.push(`%${search}%`, `%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY category, name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        values.push(limit, offset);
        
        const result = await req.db.query(query, values);
        res.json(result.rows);
    } catch (error) {
        req.logger.error('Error fetching components:', error);
        res.status(500).json({ error: 'Failed to fetch components' });
    }
});

// Get component categories
router.get('/categories', async (req, res) => {
    try {
        const query = `
            SELECT category, COUNT(*) as component_count
            FROM electrical_components
            WHERE active = true
            GROUP BY category
            ORDER BY category
        `;
        
        const result = await req.db.query(query);
        res.json(result.rows);
    } catch (error) {
        req.logger.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get single component
router.get('/:id', [param('id').isUUID()], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'SELECT * FROM electrical_components WHERE id = $1';
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        req.logger.error('Error fetching component:', error);
        res.status(500).json({ error: 'Failed to fetch component' });
    }
});

module.exports = router;