const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Validation middleware
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

// Get all projects with optional filtering
router.get('/', [
    query('status').optional().isIn(['draft', 'calculating', 'completed', 'approved']),
    query('building_type').optional().isIn(['residential', 'commercial', 'industrial']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
], handleValidationErrors, async (req, res) => {
    try {
        const { status, building_type, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT 
                p.*,
                e.total_cost,
                e.confidence_score,
                e.status as estimation_status,
                COUNT(pc.id) as component_count
            FROM projects p
            LEFT JOIN estimations e ON p.id = e.project_id AND e.status = 'completed'
            LEFT JOIN project_components pc ON p.id = pc.project_id
        `;
        
        const conditions = [];
        const values = [];
        let paramCount = 0;
        
        if (status) {
            conditions.push(`p.status = $${++paramCount}`);
            values.push(status);
        }
        
        if (building_type) {
            conditions.push(`p.building_type = $${++paramCount}`);
            values.push(building_type);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += `
            GROUP BY p.id, e.total_cost, e.confidence_score, e.status
            ORDER BY p.created_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;
        values.push(limit, offset);
        
        const result = await req.db.query(query, values);
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM projects p';
        const countConditions = [];
        const countValues = [];
        let countParamCount = 0;
        
        if (status) {
            countConditions.push(`p.status = $${++countParamCount}`);
            countValues.push(status);
        }
        
        if (building_type) {
            countConditions.push(`p.building_type = $${++countParamCount}`);
            countValues.push(building_type);
        }
        
        if (countConditions.length > 0) {
            countQuery += ` WHERE ${countConditions.join(' AND ')}`;
        }
        
        const countResult = await req.db.query(countQuery, countValues);
        const totalCount = parseInt(countResult.rows[0].count);
        
        res.json({
            projects: result.rows,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < totalCount,
            },
        });
    } catch (error) {
        req.logger.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get single project by ID
router.get('/:id', [
    param('id').isUUID(),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        const projectQuery = `
            SELECT p.*, 
                   e.id as estimation_id,
                   e.total_cost,
                   e.confidence_score,
                   e.status as estimation_status,
                   e.completed_at as estimation_completed_at
            FROM projects p
            LEFT JOIN estimations e ON p.id = e.project_id AND e.status = 'completed'
            WHERE p.id = $1
        `;
        
        const projectResult = await req.db.query(projectQuery, [id]);
        
        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const project = projectResult.rows[0];
        
        // Get project components
        const componentsQuery = `
            SELECT pc.*, ec.name, ec.category, ec.unit_type
            FROM project_components pc
            JOIN electrical_components ec ON pc.component_id = ec.id
            WHERE pc.project_id = $1
            ORDER BY ec.category, ec.name
        `;
        
        const componentsResult = await req.db.query(componentsQuery, [id]);
        project.components = componentsResult.rows;
        
        // Get NEC compliance checks
        const complianceQuery = `
            SELECT * FROM nec_compliance_checks
            WHERE project_id = $1
            ORDER BY checked_at DESC
        `;
        
        const complianceResult = await req.db.query(complianceQuery, [id]);
        project.compliance_checks = complianceResult.rows;
        
        res.json(project);
    } catch (error) {
        req.logger.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Create new project
router.post('/', [
    body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('building_type').isIn(['residential', 'commercial', 'industrial']),
    body('square_footage').optional().isInt({ min: 1 }),
    body('floors').optional().isInt({ min: 1, max: 50 }),
    body('client_name').optional().trim().isLength({ max: 255 }),
    body('client_contact').optional().isObject(),
    body('project_specifications').optional().isObject(),
], handleValidationErrors, async (req, res) => {
    try {
        const {
            name,
            description,
            building_type,
            square_footage,
            floors = 1,
            client_name,
            client_contact,
            project_specifications,
        } = req.body;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO projects (
                id, name, description, building_type, square_footage, 
                floors, client_name, client_contact, project_specifications,
                created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const values = [
            id,
            name,
            description,
            building_type,
            square_footage,
            floors,
            client_name,
            client_contact ? JSON.stringify(client_contact) : null,
            project_specifications ? JSON.stringify(project_specifications) : null,
            'api_user', // TODO: Replace with actual user from auth
        ];
        
        const result = await req.db.query(query, values);
        const project = result.rows[0];
        
        req.logger.info(`Project created: ${project.id} - ${project.name}`);
        
        res.status(201).json(project);
    } catch (error) {
        req.logger.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Update project
router.put('/:id', [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('building_type').optional().isIn(['residential', 'commercial', 'industrial']),
    body('square_footage').optional().isInt({ min: 1 }),
    body('floors').optional().isInt({ min: 1, max: 50 }),
    body('status').optional().isIn(['draft', 'calculating', 'completed', 'approved']),
    body('client_name').optional().trim().isLength({ max: 255 }),
    body('client_contact').optional().isObject(),
    body('project_specifications').optional().isObject(),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Check if project exists
        const existsQuery = 'SELECT id FROM projects WHERE id = $1';
        const existsResult = await req.db.query(existsQuery, [id]);
        
        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                updateFields.push(`${key} = $${++paramCount}`);
                if (key === 'client_contact' || key === 'project_specifications') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updateFields.push(`updated_at = NOW()`);
        values.push(id);
        
        const query = `
            UPDATE projects 
            SET ${updateFields.join(', ')}
            WHERE id = $${++paramCount}
            RETURNING *
        `;
        
        const result = await req.db.query(query, values);
        const project = result.rows[0];
        
        req.logger.info(`Project updated: ${project.id} - ${project.name}`);
        
        res.json(project);
    } catch (error) {
        req.logger.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', [
    param('id').isUUID(),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'DELETE FROM projects WHERE id = $1 RETURNING id, name';
        const result = await req.db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const deletedProject = result.rows[0];
        req.logger.info(`Project deleted: ${deletedProject.id} - ${deletedProject.name}`);
        
        res.json({ 
            message: 'Project deleted successfully',
            project: deletedProject,
        });
    } catch (error) {
        req.logger.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Start estimation workflow for project
router.post('/:id/estimate', [
    param('id').isUUID(),
    body('estimation_type').optional().isIn(['conceptual', 'preliminary', 'detailed', 'full']),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const { estimation_type = 'full' } = req.body;
        
        // Check if project exists
        const projectQuery = 'SELECT * FROM projects WHERE id = $1';
        const projectResult = await req.db.query(projectQuery, [id]);
        
        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const project = projectResult.rows[0];
        
        // Create estimation record
        const estimationId = uuidv4();
        const estimationQuery = `
            INSERT INTO estimations (id, project_id, estimation_type, status)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const estimationResult = await req.db.query(estimationQuery, [
            estimationId,
            id,
            estimation_type,
            'processing',
        ]);
        
        const estimation = estimationResult.rows[0];
        
        // Update project status
        await req.db.query(
            'UPDATE projects SET status = $1 WHERE id = $2',
            ['calculating', id]
        );
        
        // Trigger N8N workflow
        const workflowData = {
            project_id: id,
            estimation_id: estimationId,
            project_data: project,
            estimation_type,
            timestamp: new Date().toISOString(),
        };
        
        const workflowResult = await req.triggerWorkflow('electrical-estimation', workflowData);
        
        if (!workflowResult.success) {
            // Update estimation status to error
            await req.db.query(
                'UPDATE estimations SET status = $1, error_message = $2 WHERE id = $3',
                ['error', workflowResult.error, estimationId]
            );
            
            return res.status(500).json({
                error: 'Failed to start estimation workflow',
                details: workflowResult.error,
            });
        }
        
        req.logger.info(`Estimation started for project ${id}: ${estimationId}`);
        
        res.status(202).json({
            message: 'Estimation started successfully',
            estimation,
            workflow_result: workflowResult.data,
        });
    } catch (error) {
        req.logger.error('Error starting estimation:', error);
        res.status(500).json({ error: 'Failed to start estimation' });
    }
});

// Get project statistics
router.get('/:id/stats', [
    param('id').isUUID(),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if project exists
        const projectQuery = 'SELECT * FROM projects WHERE id = $1';
        const projectResult = await req.db.query(projectQuery, [id]);
        
        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Get component statistics
        const componentStatsQuery = `
            SELECT 
                ec.category,
                COUNT(pc.id) as component_count,
                SUM(pc.total_material_cost) as total_material_cost,
                SUM(pc.total_labor_cost) as total_labor_cost
            FROM project_components pc
            JOIN electrical_components ec ON pc.component_id = ec.id
            WHERE pc.project_id = $1
            GROUP BY ec.category
            ORDER BY total_material_cost DESC
        `;
        
        const componentStats = await req.db.query(componentStatsQuery, [id]);
        
        // Get estimation statistics
        const estimationStatsQuery = `
            SELECT 
                COUNT(*) as total_estimations,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_estimations,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_estimations,
                AVG(CASE WHEN status = 'completed' THEN confidence_score END) as avg_confidence_score
            FROM estimations
            WHERE project_id = $1
        `;
        
        const estimationStats = await req.db.query(estimationStatsQuery, [id]);
        
        // Get compliance statistics
        const complianceStatsQuery = `
            SELECT 
                COUNT(*) as total_checks,
                COUNT(CASE WHEN status = 'pass' THEN 1 END) as passed_checks,
                COUNT(CASE WHEN status = 'fail' THEN 1 END) as failed_checks,
                COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_checks
            FROM nec_compliance_checks
            WHERE project_id = $1
        `;
        
        const complianceStats = await req.db.query(complianceStatsQuery, [id]);
        
        res.json({
            project_id: id,
            component_breakdown: componentStats.rows,
            estimation_stats: estimationStats.rows[0],
            compliance_stats: complianceStats.rows[0],
        });
    } catch (error) {
        req.logger.error('Error fetching project statistics:', error);
        res.status(500).json({ error: 'Failed to fetch project statistics' });
    }
});

module.exports = router;