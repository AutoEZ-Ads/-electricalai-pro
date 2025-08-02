const { query, transaction } = require('../config/database');
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class BackupManager {
    constructor(options = {}) {
        this.logger = options.logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/backup.log' })
            ]
        });

        // Storage configurations
        this.config = {
            localBackupPath: options.localBackupPath || './backups',
            maxLocalBackups: parseInt(process.env.MAX_LOCAL_BACKUPS) || 50,
            maxBackupAge: parseInt(process.env.MAX_BACKUP_AGE_DAYS) || 30,
            compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
            encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
            encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
            
            // AWS S3 Configuration
            aws: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION || 'us-east-1',
                bucket: process.env.AWS_BACKUP_BUCKET,
                enabled: !!process.env.AWS_BACKUP_BUCKET
            },
            
            // Google Cloud Storage Configuration
            gcs: {
                keyFilename: process.env.GCS_KEY_FILE,
                projectId: process.env.GCS_PROJECT_ID,
                bucket: process.env.GCS_BACKUP_BUCKET,
                enabled: !!process.env.GCS_BACKUP_BUCKET
            }
        };

        // Initialize AWS S3 if configured
        if (this.config.aws.enabled) {
            this.s3 = new AWS.S3({
                accessKeyId: this.config.aws.accessKeyId,
                secretAccessKey: this.config.aws.secretAccessKey,
                region: this.config.aws.region
            });
        }

        // Initialize Google Cloud Storage if configured
        if (this.config.gcs.enabled) {
            const { Storage } = require('@google-cloud/storage');
            this.gcs = new Storage({
                keyFilename: this.config.gcs.keyFilename,
                projectId: this.config.gcs.projectId
            });
            this.gcsBucket = this.gcs.bucket(this.config.gcs.bucket);
        }

        // Backup types and their data extraction methods
        this.backupTypes = {
            estimation: this.getEstimationData.bind(this),
            project: this.getProjectData.bind(this),
            blueprint: this.getBlueprintData.bind(this),
            component: this.getComponentData.bind(this),
            calculation: this.getCalculationData.bind(this),
            full_system: this.getFullSystemData.bind(this)
        };

        this.initializeBackupSystem();
    }

    /**
     * Initialize backup system directories and validate configuration
     */
    async initializeBackupSystem() {
        try {
            // Create local backup directory
            await fs.mkdir(this.config.localBackupPath, { recursive: true });
            await fs.mkdir(path.join(this.config.localBackupPath, 'temp'), { recursive: true });
            
            this.logger.info('Backup system initialized', {
                localPath: this.config.localBackupPath,
                s3Enabled: this.config.aws.enabled,
                gcsEnabled: this.config.gcs.enabled,
                compressionEnabled: this.config.compressionEnabled,
                encryptionEnabled: this.config.encryptionEnabled
            });

            // Test cloud storage connections
            if (this.config.aws.enabled) {
                await this.testS3Connection();
            }
            if (this.config.gcs.enabled) {
                await this.testGCSConnection();
            }

        } catch (error) {
            this.logger.error('Backup system initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Create comprehensive backup of estimation data
     */
    async backupEstimationData(estimationId, options = {}) {
        const backupId = this.generateBackupId();
        const timestamp = new Date().toISOString();
        
        try {
            this.logger.info('Starting estimation backup', { estimationId, backupId });

            // Extract estimation data
            const estimationData = await this.getEstimationData(estimationId);
            
            if (!estimationData || Object.keys(estimationData).length === 0) {
                throw new Error(`No data found for estimation ${estimationId}`);
            }

            const backup = {
                id: backupId,
                type: 'estimation',
                entityId: estimationId,
                timestamp,
                version: options.version || '1.0',
                source: options.source || 'manual',
                data: estimationData,
                metadata: {
                    estimationId,
                    projectId: estimationData.estimation?.project_id,
                    projectName: estimationData.project?.name,
                    backupReason: options.reason || 'data_protection',
                    userInitiated: options.userInitiated || false,
                    dataSize: JSON.stringify(estimationData).length,
                    recordCount: this.countRecords(estimationData)
                }
            };

            // Calculate data integrity hash
            backup.integrity = {
                hash: this.calculateHash(JSON.stringify(estimationData)),
                algorithm: 'sha256'
            };

            // Store backup in multiple locations
            const results = await this.storeBackup(backup);
            
            // Log backup completion
            await this.logBackupOperation(backup, results);
            
            this.logger.info('Estimation backup completed successfully', {
                estimationId,
                backupId,
                storageResults: results,
                dataSize: backup.metadata.dataSize,
                recordCount: backup.metadata.recordCount
            });

            return {
                backupId,
                timestamp,
                storageResults: results,
                metadata: backup.metadata
            };

        } catch (error) {
            this.logger.error('Estimation backup failed', {
                estimationId,
                backupId,
                error: error.message,
                stack: error.stack
            });

            // Log failed backup attempt
            await this.logBackupOperation({ id: backupId, type: 'estimation', entityId: estimationId }, 
                { database: { success: false, error: error.message } });
            
            throw error;
        }
    }

    /**
     * Create project backup with all related data
     */
    async backupProjectData(projectId, options = {}) {
        const backupId = this.generateBackupId();
        const timestamp = new Date().toISOString();
        
        try {
            this.logger.info('Starting project backup', { projectId, backupId });

            const projectData = await this.getProjectData(projectId);
            
            const backup = {
                id: backupId,
                type: 'project',
                entityId: projectId,
                timestamp,
                version: options.version || '1.0',
                source: options.source || 'manual',
                data: projectData,
                metadata: {
                    projectId,
                    projectName: projectData.project?.name,
                    estimationCount: projectData.estimations?.length || 0,
                    blueprintCount: projectData.blueprints?.length || 0,
                    componentCount: projectData.components?.length || 0,
                    backupReason: options.reason || 'data_protection',
                    dataSize: JSON.stringify(projectData).length,
                    recordCount: this.countRecords(projectData)
                }
            };

            backup.integrity = {
                hash: this.calculateHash(JSON.stringify(projectData)),
                algorithm: 'sha256'
            };

            const results = await this.storeBackup(backup);
            await this.logBackupOperation(backup, results);
            
            this.logger.info('Project backup completed successfully', {
                projectId,
                backupId,
                storageResults: results,
                estimationCount: backup.metadata.estimationCount,
                blueprintCount: backup.metadata.blueprintCount
            });

            return {
                backupId,
                timestamp,
                storageResults: results,
                metadata: backup.metadata
            };

        } catch (error) {
            this.logger.error('Project backup failed', {
                projectId,
                backupId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Create full system backup
     */
    async backupFullSystem(options = {}) {
        const backupId = this.generateBackupId();
        const timestamp = new Date().toISOString();
        
        try {
            this.logger.info('Starting full system backup', { backupId });

            const systemData = await this.getFullSystemData();
            
            const backup = {
                id: backupId,
                type: 'full_system',
                entityId: 'system',
                timestamp,
                version: options.version || '1.0',
                source: options.source || 'scheduled',
                data: systemData,
                metadata: {
                    projectCount: systemData.projects?.length || 0,
                    estimationCount: systemData.estimations?.length || 0,
                    blueprintCount: systemData.blueprints?.length || 0,
                    componentCount: systemData.components?.length || 0,
                    userCount: systemData.users?.length || 0,
                    backupReason: options.reason || 'scheduled_backup',
                    dataSize: JSON.stringify(systemData).length,
                    recordCount: this.countRecords(systemData)
                }
            };

            backup.integrity = {
                hash: this.calculateHash(JSON.stringify(systemData)),
                algorithm: 'sha256'
            };

            const results = await this.storeBackup(backup);
            await this.logBackupOperation(backup, results);
            
            this.logger.info('Full system backup completed successfully', {
                backupId,
                storageResults: results,
                projectCount: backup.metadata.projectCount,
                estimationCount: backup.metadata.estimationCount,
                dataSize: backup.metadata.dataSize
            });

            return {
                backupId,
                timestamp,
                storageResults: results,
                metadata: backup.metadata
            };

        } catch (error) {
            this.logger.error('Full system backup failed', {
                backupId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Store backup in multiple storage locations
     */
    async storeBackup(backup) {
        const results = {
            database: { success: false },
            local: { success: false },
            s3: { success: false },
            gcs: { success: false }
        };

        // Prepare backup data
        let backupData = JSON.stringify(backup);
        
        // Compress if enabled
        if (this.config.compressionEnabled) {
            backupData = await gzip(backupData);
            backup.compressed = true;
        }

        // Encrypt if enabled
        if (this.config.encryptionEnabled && this.config.encryptionKey) {
            backupData = this.encryptData(backupData);
            backup.encrypted = true;
        }

        // Store in database
        try {
            await query(`
                INSERT INTO estimation_backups (
                    id, type, entity_id, backup_data, metadata, 
                    integrity_hash, compressed, encrypted, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
                backup.id,
                backup.type,
                backup.entityId,
                backupData,
                JSON.stringify(backup.metadata),
                backup.integrity.hash,
                backup.compressed || false,
                backup.encrypted || false
            ]);
            
            results.database = { success: true, location: 'database' };
        } catch (error) {
            results.database = { success: false, error: error.message };
            this.logger.error('Database backup storage failed', { backupId: backup.id, error: error.message });
        }

        // Store locally
        try {
            const localPath = path.join(
                this.config.localBackupPath, 
                `${backup.type}_${backup.id}_${backup.timestamp.replace(/[:.]/g, '-')}.backup`
            );
            
            await fs.writeFile(localPath, backupData);
            results.local = { success: true, location: localPath };
        } catch (error) {
            results.local = { success: false, error: error.message };
            this.logger.error('Local backup storage failed', { backupId: backup.id, error: error.message });
        }

        // Store in S3
        if (this.config.aws.enabled) {
            try {
                const s3Key = `backups/${backup.type}/${backup.timestamp.split('T')[0]}/${backup.id}.backup`;
                
                await this.s3.upload({
                    Bucket: this.config.aws.bucket,
                    Key: s3Key,
                    Body: backupData,
                    ContentType: 'application/json',
                    Metadata: {
                        backupId: backup.id,
                        type: backup.type,
                        entityId: backup.entityId,
                        timestamp: backup.timestamp,
                        compressed: backup.compressed ? 'true' : 'false',
                        encrypted: backup.encrypted ? 'true' : 'false'
                    }
                }).promise();
                
                results.s3 = { success: true, location: `s3://${this.config.aws.bucket}/${s3Key}` };
            } catch (error) {
                results.s3 = { success: false, error: error.message };
                this.logger.error('S3 backup storage failed', { backupId: backup.id, error: error.message });
            }
        }

        // Store in Google Cloud Storage
        if (this.config.gcs.enabled) {
            try {
                const gcsFileName = `backups/${backup.type}/${backup.timestamp.split('T')[0]}/${backup.id}.backup`;
                const file = this.gcsBucket.file(gcsFileName);
                
                await file.save(backupData, {
                    metadata: {
                        metadata: {
                            backupId: backup.id,
                            type: backup.type,
                            entityId: backup.entityId,
                            timestamp: backup.timestamp,
                            compressed: backup.compressed ? 'true' : 'false',
                            encrypted: backup.encrypted ? 'true' : 'false'
                        }
                    }
                });
                
                results.gcs = { success: true, location: `gs://${this.config.gcs.bucket}/${gcsFileName}` };
            } catch (error) {
                results.gcs = { success: false, error: error.message };
                this.logger.error('GCS backup storage failed', { backupId: backup.id, error: error.message });
            }
        }

        return results;
    }

    /**
     * Restore backup data
     */
    async restoreBackup(backupId, options = {}) {
        try {
            this.logger.info('Starting backup restoration', { backupId });

            // Retrieve backup data
            const backup = await this.retrieveBackup(backupId, options.source);
            
            if (!backup) {
                throw new Error(`Backup ${backupId} not found`);
            }

            // Validate backup integrity
            const isValid = await this.validateBackupIntegrity(backup);
            if (!isValid) {
                throw new Error(`Backup ${backupId} failed integrity check`);
            }

            // Decrypt if encrypted
            let backupData = backup.backup_data;
            if (backup.encrypted) {
                backupData = this.decryptData(backupData);
            }

            // Decompress if compressed
            if (backup.compressed) {
                backupData = await gunzip(backupData);
            }

            // Parse backup data
            const parsedBackup = JSON.parse(backupData.toString());
            
            // Restore based on backup type
            const restoreResult = await this.performRestore(parsedBackup, options);
            
            // Log restoration
            await this.logRestoreOperation(backupId, restoreResult);
            
            this.logger.info('Backup restoration completed successfully', {
                backupId,
                type: parsedBackup.type,
                restoreResult
            });

            return restoreResult;

        } catch (error) {
            this.logger.error('Backup restoration failed', {
                backupId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get estimation data for backup
     */
    async getEstimationData(estimationId) {
        const data = {};

        // Get main estimation record
        const estimationResult = await query(`
            SELECT e.*, p.name as project_name, p.building_type
            FROM estimations e
            JOIN projects p ON e.project_id = p.id
            WHERE e.id = $1
        `, [estimationId]);
        
        if (estimationResult.rows.length === 0) {
            throw new Error(`Estimation ${estimationId} not found`);
        }
        
        data.estimation = estimationResult.rows[0];
        data.project = { 
            id: data.estimation.project_id, 
            name: data.estimation.project_name,
            building_type: data.estimation.building_type
        };

        // Get related components
        const componentsResult = await query(`
            SELECT * FROM estimation_components 
            WHERE estimation_id = $1
        `, [estimationId]);
        data.components = componentsResult.rows;

        // Get calculation history
        const calculationsResult = await query(`
            SELECT * FROM calculation_history 
            WHERE estimation_id = $1
            ORDER BY created_at DESC
        `, [estimationId]);
        data.calculations = calculationsResult.rows;

        // Get related blueprints
        const blueprintsResult = await query(`
            SELECT * FROM blueprints 
            WHERE project_id = $1
        `, [data.estimation.project_id]);
        data.blueprints = blueprintsResult.rows;

        return data;
    }

    /**
     * Get project data for backup
     */
    async getProjectData(projectId) {
        const data = {};

        // Get main project record
        const projectResult = await query(`
            SELECT * FROM projects WHERE id = $1
        `, [projectId]);
        
        if (projectResult.rows.length === 0) {
            throw new Error(`Project ${projectId} not found`);
        }
        
        data.project = projectResult.rows[0];

        // Get all estimations
        const estimationsResult = await query(`
            SELECT * FROM estimations WHERE project_id = $1
        `, [projectId]);
        data.estimations = estimationsResult.rows;

        // Get all blueprints
        const blueprintsResult = await query(`
            SELECT * FROM blueprints WHERE project_id = $1
        `, [projectId]);
        data.blueprints = blueprintsResult.rows;

        // Get all components for this project's estimations
        if (data.estimations.length > 0) {
            const estimationIds = data.estimations.map(e => e.id);
            const componentsResult = await query(`
                SELECT * FROM estimation_components 
                WHERE estimation_id = ANY($1)
            `, [estimationIds]);
            data.components = componentsResult.rows;
        } else {
            data.components = [];
        }

        return data;
    }

    /**
     * Get blueprint data for backup
     */
    async getBlueprintData(blueprintId) {
        const blueprintResult = await query(`
            SELECT b.*, p.name as project_name
            FROM blueprints b
            JOIN projects p ON b.project_id = p.id
            WHERE b.id = $1
        `, [blueprintId]);
        
        if (blueprintResult.rows.length === 0) {
            throw new Error(`Blueprint ${blueprintId} not found`);
        }

        return {
            blueprint: blueprintResult.rows[0],
            analysisLog: await query(`
                SELECT * FROM blueprint_analysis_log 
                WHERE blueprint_id = $1 
                ORDER BY created_at DESC
            `, [blueprintId])
        };
    }

    /**
     * Get component data for backup
     */
    async getComponentData(componentId) {
        const componentResult = await query(`
            SELECT * FROM components WHERE id = $1
        `, [componentId]);
        
        if (componentResult.rows.length === 0) {
            throw new Error(`Component ${componentId} not found`);
        }

        return { component: componentResult.rows[0] };
    }

    /**
     * Get calculation data for backup
     */
    async getCalculationData(calculationId) {
        const calculationResult = await query(`
            SELECT * FROM calculation_history WHERE id = $1
        `, [calculationId]);
        
        if (calculationResult.rows.length === 0) {
            throw new Error(`Calculation ${calculationId} not found`);
        }

        return { calculation: calculationResult.rows[0] };
    }

    /**
     * Get full system data for backup
     */
    async getFullSystemData() {
        const data = {};

        // Get all projects (limited to prevent huge backups)
        const projectsResult = await query(`
            SELECT * FROM projects 
            WHERE deleted_at IS NULL 
            ORDER BY created_at DESC 
            LIMIT 1000
        `);
        data.projects = projectsResult.rows;

        // Get recent estimations
        const estimationsResult = await query(`
            SELECT * FROM estimations 
            ORDER BY created_at DESC 
            LIMIT 5000
        `);
        data.estimations = estimationsResult.rows;

        // Get recent blueprints
        const blueprintsResult = await query(`
            SELECT * FROM blueprints 
            WHERE deleted_at IS NULL 
            ORDER BY created_at DESC 
            LIMIT 2000
        `);
        data.blueprints = blueprintsResult.rows;

        // Get components
        const componentsResult = await query(`
            SELECT * FROM components 
            ORDER BY created_at DESC 
            LIMIT 10000
        `);
        data.components = componentsResult.rows;

        // Get users (without sensitive data)
        const usersResult = await query(`
            SELECT id, name, email, role, created_at, updated_at 
            FROM monday_users 
            ORDER BY created_at DESC 
            LIMIT 1000
        `);
        data.users = usersResult.rows;

        return data;
    }

    /**
     * Calculate hash for data integrity
     */
    calculateHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    encryptData(data) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not configured');
        }

        const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', key);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return JSON.stringify({
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        });
    }

    /**
     * Decrypt data
     */
    decryptData(encryptedData) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not configured');
        }

        const { encrypted, iv, authTag } = JSON.parse(encryptedData);
        const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
        
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Generate unique backup ID
     */
    generateBackupId() {
        return `backup_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Count records in backup data
     */
    countRecords(data) {
        let count = 0;
        
        Object.values(data).forEach(value => {
            if (Array.isArray(value)) {
                count += value.length;
            } else if (value && typeof value === 'object') {
                count += 1;
            }
        });
        
        return count;
    }

    /**
     * Log backup operations
     */
    async logBackupOperation(backup, results) {
        try {
            await query(`
                INSERT INTO backup_operations (
                    backup_id, operation_type, entity_type, entity_id,
                    storage_results, metadata, created_at
                )
                VALUES ($1, 'create', $2, $3, $4, $5, NOW())
            `, [
                backup.id,
                backup.type,
                backup.entityId,
                JSON.stringify(results),
                JSON.stringify(backup.metadata || {})
            ]);
        } catch (error) {
            this.logger.error('Failed to log backup operation', { error: error.message });
        }
    }

    /**
     * Log restore operations
     */
    async logRestoreOperation(backupId, result) {
        try {
            await query(`
                INSERT INTO backup_operations (
                    backup_id, operation_type, entity_type, entity_id,
                    storage_results, metadata, created_at
                )
                VALUES ($1, 'restore', 'unknown', 'unknown', $2, $3, NOW())
            `, [
                backupId,
                JSON.stringify({ success: result.success }),
                JSON.stringify(result.metadata || {})
            ]);
        } catch (error) {
            this.logger.error('Failed to log restore operation', { error: error.message });
        }
    }

    /**
     * Test S3 connection
     */
    async testS3Connection() {
        try {
            await this.s3.headBucket({ Bucket: this.config.aws.bucket }).promise();
            this.logger.info('S3 connection test successful', { bucket: this.config.aws.bucket });
        } catch (error) {
            this.logger.error('S3 connection test failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Test Google Cloud Storage connection
     */
    async testGCSConnection() {
        try {
            await this.gcsBucket.exists();
            this.logger.info('GCS connection test successful', { bucket: this.config.gcs.bucket });
        } catch (error) {
            this.logger.error('GCS connection test failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Retrieve backup from storage
     */
    async retrieveBackup(backupId, source = 'database') {
        // Implementation would depend on source
        const result = await query(`
            SELECT * FROM estimation_backups WHERE id = $1
        `, [backupId]);
        
        return result.rows[0] || null;
    }

    /**
     * Validate backup integrity
     */
    async validateBackupIntegrity(backup) {
        try {
            let data = backup.backup_data;
            
            if (backup.encrypted) {
                data = this.decryptData(data);
            }
            
            if (backup.compressed) {
                data = await gunzip(data);
            }
            
            const parsedData = JSON.parse(data.toString());
            const calculatedHash = this.calculateHash(JSON.stringify(parsedData.data));
            
            return calculatedHash === backup.integrity_hash;
        } catch (error) {
            this.logger.error('Backup integrity validation failed', { 
                backupId: backup.id, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Perform restore operation
     */
    async performRestore(backup, options) {
        // This would implement the actual restoration logic
        // For now, return a placeholder
        return {
            success: true,
            type: backup.type,
            entityId: backup.entityId,
            recordsRestored: this.countRecords(backup.data),
            metadata: backup.metadata
        };
    }

    /**
     * Clean up old backups
     */
    async cleanupOldBackups() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.maxBackupAge);
        
        try {
            // Clean up database backups
            const result = await query(`
                DELETE FROM estimation_backups 
                WHERE created_at < $1
            `, [cutoffDate]);
            
            this.logger.info('Old backups cleaned up', { 
                deletedCount: result.rowCount,
                cutoffDate: cutoffDate.toISOString()
            });
            
            // Clean up local files
            await this.cleanupLocalBackups(cutoffDate);
            
        } catch (error) {
            this.logger.error('Backup cleanup failed', { error: error.message });
        }
    }

    /**
     * Clean up local backup files
     */
    async cleanupLocalBackups(cutoffDate) {
        try {
            const files = await fs.readdir(this.config.localBackupPath);
            
            for (const file of files) {
                if (file.endsWith('.backup')) {
                    const filePath = path.join(this.config.localBackupPath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        this.logger.debug('Deleted old backup file', { file });
                    }
                }
            }
        } catch (error) {
            this.logger.error('Local backup cleanup failed', { error: error.message });
        }
    }
}

// Create singleton instance
const backupManager = new BackupManager();

module.exports = {
    BackupManager,
    backupManager
};