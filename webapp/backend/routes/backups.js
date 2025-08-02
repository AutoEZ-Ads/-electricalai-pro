const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { backupManager } = require('../services/backup-manager');
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
 * Create backup for estimation data
 * POST /api/backups/estimation/:estimationId
 */
router.post('/estimation/:estimationId', [
    param('estimationId').isUUID().withMessage('Valid estimation ID required'),
    body('reason').optional().isString().isLength({ max: 255 }),
    body('source').optional().isIn(['manual', 'scheduled', 'pre_processing', 'emergency']),
    body('version').optional().isString().isLength({ max: 20 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { estimationId } = req.params;
    const { reason, source = 'manual', version } = req.body;

    req.logger.info('Creating estimation backup', { estimationId, source, reason });

    const backupResult = await backupManager.backupEstimationData(estimationId, {
        reason,
        source,
        version,
        userInitiated: true
    });

    res.status(201).json({
        success: true,
        message: 'Estimation backup created successfully',
        backup: backupResult
    });
}));

/**
 * Create backup for project data
 * POST /api/backups/project/:projectId
 */
router.post('/project/:projectId', [
    param('projectId').isUUID().withMessage('Valid project ID required'),
    body('reason').optional().isString().isLength({ max: 255 }),
    body('source').optional().isIn(['manual', 'scheduled', 'pre_processing', 'emergency']),
    body('version').optional().isString().isLength({ max: 20 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { reason, source = 'manual', version } = req.body;

    req.logger.info('Creating project backup', { projectId, source, reason });

    const backupResult = await backupManager.backupProjectData(projectId, {
        reason,
        source,
        version,
        userInitiated: true
    });

    res.status(201).json({
        success: true,
        message: 'Project backup created successfully',
        backup: backupResult
    });
}));

/**
 * Create full system backup
 * POST /api/backups/system
 */
router.post('/system', [
    body('reason').optional().isString().isLength({ max: 255 }),
    body('source').optional().isIn(['manual', 'scheduled', 'emergency']),
    body('version').optional().isString().isLength({ max: 20 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { reason, source = 'manual', version } = req.body;

    req.logger.info('Creating system backup', { source, reason });

    const backupResult = await backupManager.backupFullSystem({
        reason,
        source,
        version,
        userInitiated: true
    });

    res.status(201).json({
        success: true,
        message: 'System backup created successfully',
        backup: backupResult
    });
}));

/**
 * List backups with filtering
 * GET /api/backups
 */
router.get('/', [
    query('type').optional().isIn(['estimation', 'project', 'blueprint', 'component', 'calculation', 'full_system']),
    query('entity_id').optional().isString(),
    query('source').optional().isIn(['manual', 'scheduled', 'pre_processing', 'emergency']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('include_expired').optional().isBoolean()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { 
        type, 
        entity_id, 
        source, 
        limit = 20, 
        offset = 0,
        include_expired = false
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (type) {
        whereConditions.push(`type = $${++paramCount}`);
        queryParams.push(type);
    }

    if (entity_id) {
        whereConditions.push(`entity_id = $${++paramCount}`);
        queryParams.push(entity_id);
    }

    if (source) {
        whereConditions.push(`source = $${++paramCount}`);
        queryParams.push(source);
    }

    if (!include_expired) {
        whereConditions.push(`(expires_at IS NULL OR expires_at > NOW())`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
        SELECT 
            id, type, entity_id, metadata, integrity_hash,
            compressed, encrypted, version, source,
            data_size, record_count, created_at, expires_at,
            storage_locations
        FROM estimation_backups
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const result = await req.db.query(query, queryParams);

    // Get total count
    const countQuery = `
        SELECT COUNT(*) as total
        FROM estimation_backups
        ${whereClause}
    `;

    const countResult = await req.db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
        backups: result.rows.map(backup => ({
            id: backup.id,
            type: backup.type,
            entityId: backup.entity_id,
            metadata: backup.metadata,
            integrityHash: backup.integrity_hash,
            compressed: backup.compressed,
            encrypted: backup.encrypted,
            version: backup.version,
            source: backup.source,
            dataSize: backup.data_size,
            recordCount: backup.record_count,
            createdAt: backup.created_at,
            expiresAt: backup.expires_at,
            storageLocations: backup.storage_locations,
            downloadUrl: `/api/backups/${backup.id}/download`,
            restoreUrl: `/api/backups/${backup.id}/restore`
        })),
        pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + limit < total
        }
    });
}));

/**
 * Get backup details
 * GET /api/backups/:backupId
 */
router.get('/:backupId', [
    param('backupId').isString().isLength({ min: 1 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { backupId } = req.params;

    const query = `
        SELECT 
            eb.*,
            -- Storage locations
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', bsl.id,
                        'storageType', bsl.storage_type,
                        'storagePath', bsl.storage_path,
                        'storageSize', bsl.storage_size,
                        'status', bsl.status,
                        'verifiedAt', bsl.verified_at,
                        'createdAt', bsl.created_at
                    )
                ) FILTER (WHERE bsl.id IS NOT NULL),
                '[]'
            ) as storage_locations_detail,
            
            -- Recent operations
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', bo.id,
                        'operationType', bo.operation_type,
                        'status', bo.status,
                        'createdAt', bo.created_at,
                        'durationMs', bo.duration_ms,
                        'errorMessage', bo.error_message
                    ) ORDER BY bo.created_at DESC
                ) FILTER (WHERE bo.id IS NOT NULL),
                '[]'
            ) as recent_operations
            
        FROM estimation_backups eb
        LEFT JOIN backup_storage_locations bsl ON eb.id = bsl.backup_id
        LEFT JOIN backup_operations bo ON eb.id = bo.backup_id
        WHERE eb.id = $1
        GROUP BY eb.id
    `;

    const result = await req.db.query(query, [backupId]);

    if (result.rows.length === 0) {
        const error = new Error('Backup not found');
        error.statusCode = 404;
        throw error;
    }

    const backup = result.rows[0];

    res.json({
        id: backup.id,
        type: backup.type,
        entityId: backup.entity_id,
        metadata: backup.metadata,
        integrityHash: backup.integrity_hash,
        compressed: backup.compressed,
        encrypted: backup.encrypted,
        version: backup.version,
        source: backup.source,
        dataSize: backup.data_size,
        recordCount: backup.record_count,
        createdAt: backup.created_at,
        expiresAt: backup.expires_at,
        lastAccessedAt: backup.last_accessed_at,
        storageLocations: backup.storage_locations_detail,
        recentOperations: backup.recent_operations.slice(0, 10), // Last 10 operations
        actions: {
            canRestore: true,
            canDownload: true,
            canDelete: !backup.expires_at || backup.expires_at > new Date(),
            canVerify: true
        }
    });
}));

/**
 * Download backup data
 * GET /api/backups/:backupId/download
 */
router.get('/:backupId/download', [
    param('backupId').isString().isLength({ min: 1 }),
    query('format').optional().isIn(['json', 'raw'])
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { format = 'json' } = req.query;

    const result = await req.db.query(`
        SELECT id, type, entity_id, backup_data, compressed, encrypted, created_at
        FROM estimation_backups
        WHERE id = $1
    `, [backupId]);

    if (result.rows.length === 0) {
        const error = new Error('Backup not found');
        error.statusCode = 404;
        throw error;
    }

    const backup = result.rows[0];

    // Update last accessed timestamp
    await req.db.query(`
        UPDATE estimation_backups 
        SET last_accessed_at = NOW() 
        WHERE id = $1
    `, [backupId]);

    // Set appropriate headers
    const filename = `backup_${backup.type}_${backup.entity_id}_${backup.created_at.toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'application/octet-stream');

    if (format === 'raw') {
        // Return raw backup data
        res.send(backup.backup_data);
    } else {
        // Return formatted JSON
        let data = backup.backup_data;
        
        // Note: In a real implementation, you'd need to decrypt/decompress here
        // For now, we'll return metadata about the backup
        res.json({
            backupId: backup.id,
            type: backup.type,
            entityId: backup.entity_id,
            createdAt: backup.created_at,
            compressed: backup.compressed,
            encrypted: backup.encrypted,
            note: 'Raw backup data requires special processing to decrypt/decompress'
        });
    }

    req.logger.info('Backup downloaded', { backupId, format });
}));

/**
 * Restore backup data
 * POST /api/backups/:backupId/restore
 */
router.post('/:backupId/restore', [
    param('backupId').isString().isLength({ min: 1 }),
    body('target_entity_id').optional().isString(),
    body('recovery_type').optional().isIn(['full_restore', 'partial_restore', 'data_export', 'validation']),
    body('options').optional().isObject()
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { 
        target_entity_id, 
        recovery_type = 'full_restore', 
        options = {} 
    } = req.body;

    req.logger.info('Starting backup restoration', { 
        backupId, 
        recoveryType: recovery_type,
        targetEntityId: target_entity_id 
    });

    // Verify backup exists
    const backupResult = await req.db.query(`
        SELECT id, type, entity_id FROM estimation_backups WHERE id = $1
    `, [backupId]);

    if (backupResult.rows.length === 0) {
        const error = new Error('Backup not found');
        error.statusCode = 404;
        throw error;
    }

    const backup = backupResult.rows[0];

    // Create recovery record
    const recoveryResult = await req.db.query(`
        INSERT INTO backup_recoveries (
            backup_id, recovery_type, target_entity_id,
            recovery_options, status, initiated_by, ip_address
        )
        VALUES ($1, $2, $3, $4, 'started', $5, $6)
        RETURNING id
    `, [
        backupId,
        recovery_type,
        target_entity_id || backup.entity_id,
        JSON.stringify(options),
        req.user?.id || 'system',
        req.ip
    ]);

    const recoveryId = recoveryResult.rows[0].id;

    try {
        // Perform the actual restoration
        const restoreResult = await backupManager.restoreBackup(backupId, {
            source: 'database',
            recoveryType: recovery_type,
            targetEntityId: target_entity_id,
            options
        });

        // Update recovery record with success
        await req.db.query(`
            UPDATE backup_recoveries
            SET 
                status = 'completed',
                records_recovered = $1,
                completed_at = NOW(),
                duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
                integrity_verified = TRUE
            WHERE id = $2
        `, [restoreResult.recordsRestored || 0, recoveryId]);

        res.json({
            success: true,
            message: 'Backup restoration completed successfully',
            recoveryId,
            result: restoreResult
        });

        req.logger.info('Backup restoration completed', { 
            backupId, 
            recoveryId,
            recordsRestored: restoreResult.recordsRestored 
        });

    } catch (error) {
        // Update recovery record with error
        await req.db.query(`
            UPDATE backup_recoveries
            SET 
                status = 'failed',
                completed_at = NOW(),
                duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
                error_details = $1
            WHERE id = $2
        `, [JSON.stringify({ error: error.message }), recoveryId]);

        throw error;
    }
}));

/**
 * Verify backup integrity
 * POST /api/backups/:backupId/verify
 */
router.post('/:backupId/verify', [
    param('backupId').isString().isLength({ min: 1 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { backupId } = req.params;

    req.logger.info('Starting backup verification', { backupId });

    const result = await req.db.query(`
        SELECT * FROM estimation_backups WHERE id = $1
    `, [backupId]);

    if (result.rows.length === 0) {
        const error = new Error('Backup not found');
        error.statusCode = 404;
        throw error;
    }

    const backup = result.rows[0];

    try {
        // Verify integrity using the backup manager
        const isValid = await backupManager.validateBackupIntegrity(backup);

        // Log verification operation
        await req.db.query(`
            INSERT INTO backup_operations (
                backup_id, operation_type, status, metadata, created_at
            )
            VALUES ($1, 'verify', $2, $3, NOW())
        `, [
            backupId,
            isValid ? 'completed' : 'failed',
            JSON.stringify({ integrityValid: isValid })
        ]);

        res.json({
            backupId,
            integrityValid: isValid,
            verifiedAt: new Date().toISOString(),
            details: {
                compressed: backup.compressed,
                encrypted: backup.encrypted,
                dataSize: backup.data_size,
                recordCount: backup.record_count,
                integrityHash: backup.integrity_hash
            }
        });

        req.logger.info('Backup verification completed', { 
            backupId, 
            integrityValid: isValid 
        });

    } catch (error) {
        await req.db.query(`
            INSERT INTO backup_operations (
                backup_id, operation_type, status, error_message, created_at
            )
            VALUES ($1, 'verify', 'failed', $2, NOW())
        `, [backupId, error.message]);

        throw error;
    }
}));

/**
 * Delete backup
 * DELETE /api/backups/:backupId
 */
router.delete('/:backupId', [
    param('backupId').isString().isLength({ min: 1 }),
    body('confirm').isBoolean().equals(true).withMessage('Confirmation required'),
    body('reason').optional().isString().isLength({ max: 255 })
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { reason } = req.body;

    req.logger.info('Deleting backup', { backupId, reason });

    // Verify backup exists
    const result = await req.db.query(`
        SELECT id FROM estimation_backups WHERE id = $1
    `, [backupId]);

    if (result.rows.length === 0) {
        const error = new Error('Backup not found');
        error.statusCode = 404;
        throw error;
    }

    // Log deletion operation
    await req.db.query(`
        INSERT INTO backup_operations (
            backup_id, operation_type, status, metadata, initiated_by, created_at
        )
        VALUES ($1, 'delete', 'completed', $2, $3, NOW())
    `, [
        backupId,
        JSON.stringify({ reason }),
        req.user?.id || 'system'
    ]);

    // Delete the backup (cascade will handle related records)
    await req.db.query(`
        DELETE FROM estimation_backups WHERE id = $1
    `, [backupId]);

    res.json({
        success: true,
        message: 'Backup deleted successfully',
        backupId,
        deletedAt: new Date().toISOString()
    });

    req.logger.info('Backup deleted successfully', { backupId });
}));

/**
 * Get backup statistics
 * GET /api/backups/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const statsResult = await req.db.query(`
        SELECT * FROM backup_statistics
        ORDER BY backup_count DESC
    `);

    const summaryResult = await req.db.query(`
        SELECT 
            COUNT(*) as total_backups,
            SUM(data_size) as total_size,
            AVG(data_size) as avg_size,
            COUNT(CASE WHEN compressed THEN 1 END) as compressed_count,
            COUNT(CASE WHEN encrypted THEN 1 END) as encrypted_count,
            COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END) as expired_count,
            MIN(created_at) as oldest_backup,
            MAX(created_at) as newest_backup
        FROM estimation_backups
    `);

    const healthResult = await req.db.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN health_score >= 80 THEN 1 END) as healthy,
            COUNT(CASE WHEN health_score >= 50 AND health_score < 80 THEN 1 END) as warning,
            COUNT(CASE WHEN health_score < 50 THEN 1 END) as critical,
            AVG(health_score) as avg_health_score
        FROM backup_health
    `);

    res.json({
        summary: summaryResult.rows[0],
        byType: statsResult.rows,
        health: healthResult.rows[0],
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;