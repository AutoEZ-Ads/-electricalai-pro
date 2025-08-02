const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const { fileUploadMiddleware, processFilesMiddleware, secureUpload } = require('../middleware/file-upload');
const router = express.Router();

// Import asyncHandler from main app
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

/**
 * Upload blueprints for a project
 * POST /api/blueprints/upload/:projectId
 */
router.post('/upload/:projectId', [
    param('projectId').isUUID().withMessage('Valid project ID required'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description too long'),
    body('blueprint_type').optional().isIn(['floor_plan', 'electrical_schematic', 'site_plan', 'detail_drawing'])
], handleValidationErrors, 
    fileUploadMiddleware.array('blueprints', 5),
    processFilesMiddleware,
    asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const { description, blueprint_type = 'floor_plan' } = req.body;

        // Verify project exists and user has access
        const projectResult = await req.db.query(
            'SELECT id, name FROM projects WHERE id = $1',
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }

        const project = projectResult.rows[0];

        // Check if any files were successfully processed
        if (!req.validFiles || req.validFiles.length === 0) {
            const error = new Error('No valid files were uploaded');
            error.statusCode = 400;
            if (req.rejectedFiles && req.rejectedFiles.length > 0) {
                error.rejectedFiles = req.rejectedFiles;
            }
            throw error;
        }

        try {
            // Move files to permanent storage
            const storedFiles = await secureUpload.moveToStorage(req.validFiles, projectId);
            
            // Store file information in database
            const savedBlueprints = [];
            
            for (const file of storedFiles) {
                const blueprintResult = await req.db.query(`
                    INSERT INTO blueprints (
                        project_id, original_filename, secure_filename, file_path,
                        file_size, mime_type, file_hash, blueprint_type, description,
                        upload_status, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploaded', NOW(), NOW())
                    RETURNING *
                `, [
                    projectId, 
                    file.originalName,
                    file.secureFilename,
                    file.finalPath,
                    file.size,
                    file.mimeType,
                    file.hash,
                    blueprint_type,
                    description
                ]);

                const blueprint = blueprintResult.rows[0];
                savedBlueprints.push(blueprint);

                req.logger.info('Blueprint saved to database', {
                    blueprintId: blueprint.id,
                    projectId,
                    filename: file.originalName
                });
            }

            // Clean up temporary files
            await secureUpload.cleanupTempFiles(req.processedFiles);

            // Trigger blueprint analysis workflow if available
            if (req.triggerWorkflow) {
                for (const blueprint of savedBlueprints) {
                    const workflowResult = await req.triggerWorkflow('blueprint-analysis', {
                        blueprintId: blueprint.id,
                        projectId: projectId,
                        filePath: blueprint.file_path,
                        blueprintType: blueprint.blueprint_type,
                        source: 'upload'
                    });

                    if (workflowResult.success) {
                        req.logger.info(`Blueprint analysis workflow triggered for ${blueprint.id}`);
                    } else {
                        req.logger.warn(`Failed to trigger blueprint analysis: ${workflowResult.error}`);
                    }
                }
            }

            res.status(201).json({
                success: true,
                message: `${savedBlueprints.length} blueprint(s) uploaded successfully`,
                blueprints: savedBlueprints.map(bp => ({
                    id: bp.id,
                    originalFilename: bp.original_filename,
                    blueprintType: bp.blueprint_type,
                    fileSize: bp.file_size,
                    uploadedAt: bp.created_at,
                    url: `/api/blueprints/${bp.id}/download`
                })),
                rejected: req.rejectedFiles || []
            });

        } catch (error) {
            // Clean up files on database error
            await secureUpload.cleanupTempFiles(req.processedFiles);
            throw error;
        }
    })
);

/**
 * Get blueprints for a project
 * GET /api/blueprints/project/:projectId
 */
router.get('/project/:projectId', [
    param('projectId').isUUID(),
    query('type').optional().isIn(['floor_plan', 'electrical_schematic', 'site_plan', 'detail_drawing']),
    query('status').optional().isIn(['uploaded', 'processing', 'analyzed', 'error'])
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { type, status } = req.query;

    let query = `
        SELECT 
            id, original_filename, secure_filename, file_size, mime_type,
            blueprint_type, description, upload_status, analysis_results,
            created_at, updated_at
        FROM blueprints 
        WHERE project_id = $1
    `;
    
    const conditions = [];
    const values = [projectId];
    let paramCount = 1;

    if (type) {
        conditions.push(`blueprint_type = $${++paramCount}`);
        values.push(type);
    }

    if (status) {
        conditions.push(`upload_status = $${++paramCount}`);
        values.push(status);
    }

    if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await req.db.query(query, values);

    const blueprints = result.rows.map(bp => ({
        id: bp.id,
        originalFilename: bp.original_filename,
        fileSize: bp.file_size,
        mimeType: bp.mime_type,
        blueprintType: bp.blueprint_type,
        description: bp.description,
        status: bp.upload_status,
        analysisResults: bp.analysis_results,
        uploadedAt: bp.created_at,
        updatedAt: bp.updated_at,
        downloadUrl: `/api/blueprints/${bp.id}/download`,
        thumbnailUrl: bp.mime_type.startsWith('image/') ? `/api/blueprints/${bp.id}/thumbnail` : null
    }));

    res.json({
        projectId,
        blueprints,
        total: blueprints.length
    });
}));

/**
 * Get single blueprint details
 * GET /api/blueprints/:id
 */
router.get('/:id', [
    param('id').isUUID()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await req.db.query(`
        SELECT b.*, p.name as project_name
        FROM blueprints b
        JOIN projects p ON b.project_id = p.id
        WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    const blueprint = result.rows[0];

    res.json({
        id: blueprint.id,
        projectId: blueprint.project_id,
        projectName: blueprint.project_name,
        originalFilename: blueprint.original_filename,
        fileSize: blueprint.file_size,
        mimeType: blueprint.mime_type,
        blueprintType: blueprint.blueprint_type,
        description: blueprint.description,
        status: blueprint.upload_status,
        analysisResults: blueprint.analysis_results,
        uploadedAt: blueprint.created_at,
        updatedAt: blueprint.updated_at,
        downloadUrl: `/api/blueprints/${blueprint.id}/download`,
        thumbnailUrl: blueprint.mime_type.startsWith('image/') ? `/api/blueprints/${blueprint.id}/thumbnail` : null
    });
}));

/**
 * Download blueprint file
 * GET /api/blueprints/:id/download
 */
router.get('/:id/download', [
    param('id').isUUID()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await req.db.query(
        'SELECT file_path, original_filename, mime_type FROM blueprints WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    const blueprint = result.rows[0];

    try {
        // Verify file exists
        await fs.access(blueprint.file_path);

        // Set appropriate headers
        res.setHeader('Content-Type', blueprint.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${blueprint.original_filename}"`);
        
        // Stream the file
        const fileStream = require('fs').createReadStream(blueprint.file_path);
        fileStream.pipe(res);

        req.logger.info('Blueprint downloaded', {
            blueprintId: id,
            filename: blueprint.original_filename
        });

    } catch (error) {
        req.logger.error('Blueprint file not found', {
            blueprintId: id,
            filePath: blueprint.file_path
        });
        
        const notFoundError = new Error('Blueprint file not found on disk');
        notFoundError.statusCode = 404;
        throw notFoundError;
    }
}));

/**
 * Generate and serve thumbnail for image blueprints
 * GET /api/blueprints/:id/thumbnail
 */
router.get('/:id/thumbnail', [
    param('id').isUUID(),
    query('size').optional().isInt({ min: 50, max: 500 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const size = parseInt(req.query.size) || 200;

    const result = await req.db.query(
        'SELECT file_path, mime_type FROM blueprints WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    const blueprint = result.rows[0];

    if (!blueprint.mime_type.startsWith('image/')) {
        const error = new Error('Thumbnail not available for this file type');
        error.statusCode = 400;
        throw error;
    }

    try {
        const sharp = require('sharp');
        const thumbnailBuffer = await sharp(blueprint.file_path)
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(thumbnailBuffer);

    } catch (error) {
        req.logger.error('Thumbnail generation failed', {
            blueprintId: id,
            error: error.message
        });
        
        const thumbError = new Error('Failed to generate thumbnail');
        thumbError.statusCode = 500;
        throw thumbError;
    }
}));

/**
 * Update blueprint information
 * PUT /api/blueprints/:id
 */
router.put('/:id', [
    param('id').isUUID(),
    body('description').optional().isLength({ max: 1000 }),
    body('blueprint_type').optional().isIn(['floor_plan', 'electrical_schematic', 'site_plan', 'detail_drawing'])
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { description, blueprint_type } = req.body;

    const updates = {};
    if (description !== undefined) updates.description = description;
    if (blueprint_type !== undefined) updates.blueprint_type = blueprint_type;

    if (Object.keys(updates).length === 0) {
        const error = new Error('No valid fields to update');
        error.statusCode = 400;
        throw error;
    }

    const updateFields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`);
    const values = [id, ...Object.values(updates)];

    const query = `
        UPDATE blueprints 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await req.db.query(query, values);

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    res.json({
        success: true,
        message: 'Blueprint updated successfully',
        blueprint: result.rows[0]
    });
}));

/**
 * Delete blueprint
 * DELETE /api/blueprints/:id
 */
router.delete('/:id', [
    param('id').isUUID()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get blueprint file path before deletion
    const result = await req.db.query(
        'SELECT file_path FROM blueprints WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    const filePath = result.rows[0].file_path;

    // Delete from database
    await req.db.query('DELETE FROM blueprints WHERE id = $1', [id]);

    // Delete physical file
    try {
        await fs.unlink(filePath);
        req.logger.info('Blueprint file deleted', { blueprintId: id, filePath });
    } catch (error) {
        req.logger.warn('Failed to delete blueprint file', { 
            blueprintId: id, 
            filePath, 
            error: error.message 
        });
    }

    res.json({
        success: true,
        message: 'Blueprint deleted successfully'
    });
}));

/**
 * Trigger manual analysis for a blueprint
 * POST /api/blueprints/:id/analyze
 */
router.post('/:id/analyze', [
    param('id').isUUID(),
    body('analysis_type').optional().isIn(['electrical_load', 'room_detection', 'symbol_recognition', 'compliance_check'])
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { analysis_type = 'electrical_load' } = req.body;

    const result = await req.db.query(
        'SELECT * FROM blueprints WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        const error = new Error('Blueprint not found');
        error.statusCode = 404;
        throw error;
    }

    const blueprint = result.rows[0];

    // Update status to processing
    await req.db.query(
        'UPDATE blueprints SET upload_status = $1, updated_at = NOW() WHERE id = $2',
        ['processing', id]
    );

    // Trigger analysis workflow
    if (req.triggerWorkflow) {
        const workflowResult = await req.triggerWorkflow('blueprint-analysis', {
            blueprintId: id,
            projectId: blueprint.project_id,
            filePath: blueprint.file_path,
            analysisType: analysis_type,
            blueprintType: blueprint.blueprint_type,
            source: 'manual_trigger'
        });

        if (workflowResult.success) {
            res.json({
                success: true,
                message: 'Blueprint analysis started',
                analysisType: analysis_type,
                workflowId: workflowResult.workflowId
            });
        } else {
            // Reset status on workflow failure
            await req.db.query(
                'UPDATE blueprints SET upload_status = $1 WHERE id = $2',
                ['uploaded', id]
            );
            
            throw new Error(`Failed to start analysis: ${workflowResult.error}`);
        }
    } else {
        const error = new Error('Analysis workflow not available');
        error.statusCode = 503;
        throw error;
    }
}));

module.exports = router;