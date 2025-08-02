const cron = require('node-cron');
const { backupManager } = require('./backup-manager');
const { query } = require('../config/database');
const winston = require('winston');

class BackupScheduler {
    constructor(options = {}) {
        this.logger = options.logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/backup-scheduler.log' })
            ]
        });

        this.scheduledJobs = new Map();
        this.isInitialized = false;
        this.maxConcurrentBackups = parseInt(process.env.MAX_CONCURRENT_BACKUPS) || 3;
        this.currentBackups = 0;
        this.backupQueue = [];

        // Backup job functions
        this.backupJobs = {
            estimation: this.scheduleEstimationBackups.bind(this),
            project: this.scheduleProjectBackups.bind(this),
            blueprint: this.scheduleBlueprintBackups.bind(this),
            full_system: this.scheduleSystemBackups.bind(this)
        };
    }

    /**
     * Initialize backup scheduler
     */
    async initialize() {
        try {
            this.logger.info('Initializing backup scheduler');

            // Load scheduled backup configurations
            await this.loadScheduleConfigurations();

            // Start cleanup job
            this.scheduleCleanupJob();

            // Start queue processor
            this.startQueueProcessor();

            this.isInitialized = true;
            this.logger.info('Backup scheduler initialized successfully', {
                scheduledJobs: this.scheduledJobs.size
            });

        } catch (error) {
            this.logger.error('Failed to initialize backup scheduler', { error: error.message });
            throw error;
        }
    }

    /**
     * Load backup schedule configurations from database
     */
    async loadScheduleConfigurations() {
        try {
            const result = await query(`
                SELECT * FROM backup_schedules 
                WHERE enabled = TRUE
                ORDER BY schedule_name
            `);

            for (const schedule of result.rows) {
                await this.createScheduledJob(schedule);
            }

            this.logger.info('Loaded backup schedules', { count: result.rows.length });

        } catch (error) {
            this.logger.error('Failed to load backup schedules', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a scheduled backup job
     */
    async createScheduledJob(schedule) {
        try {
            const jobName = schedule.schedule_name;
            
            // Validate cron expression
            if (!cron.validate(schedule.cron_expression)) {
                throw new Error(`Invalid cron expression: ${schedule.cron_expression}`);
            }

            // Create the scheduled job
            const job = cron.schedule(schedule.cron_expression, async () => {
                await this.executeScheduledBackup(schedule);
            }, {
                scheduled: true,
                timezone: schedule.timezone || 'UTC',
                name: jobName
            });

            this.scheduledJobs.set(jobName, {
                job,
                schedule,
                lastRun: schedule.last_run_at,
                nextRun: this.calculateNextRun(schedule.cron_expression, schedule.timezone)
            });

            // Update next run time in database
            await query(`
                UPDATE backup_schedules 
                SET next_run_at = $1
                WHERE id = $2
            `, [this.calculateNextRun(schedule.cron_expression, schedule.timezone), schedule.id]);

            this.logger.info('Created scheduled backup job', {
                jobName,
                cronExpression: schedule.cron_expression,
                backupType: schedule.backup_type,
                nextRun: this.calculateNextRun(schedule.cron_expression, schedule.timezone)
            });

        } catch (error) {
            this.logger.error('Failed to create scheduled job', {
                scheduleName: schedule.schedule_name,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Execute a scheduled backup
     */
    async executeScheduledBackup(schedule) {
        const startTime = Date.now();

        try {
            this.logger.info('Executing scheduled backup', {
                scheduleName: schedule.schedule_name,
                backupType: schedule.backup_type
            });

            // Update last run time
            await query(`
                UPDATE backup_schedules 
                SET last_run_at = NOW(), consecutive_failures = 0
                WHERE id = $1
            `, [schedule.id]);

            // Add to backup queue
            await this.queueBackup({
                scheduleId: schedule.id,
                scheduleName: schedule.schedule_name,
                backupType: schedule.backup_type,
                entityFilter: schedule.entity_filter,
                storageOptions: schedule.storage_options,
                retentionDays: schedule.retention_days,
                compressionEnabled: schedule.compression_enabled,
                encryptionEnabled: schedule.encryption_enabled
            });

            const duration = Date.now() - startTime;
            this.logger.info('Scheduled backup queued successfully', {
                scheduleName: schedule.schedule_name,
                duration
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Increment failure count
            await query(`
                UPDATE backup_schedules 
                SET consecutive_failures = consecutive_failures + 1
                WHERE id = $1
            `, [schedule.id]);

            // Disable schedule if too many failures
            if (schedule.consecutive_failures >= schedule.max_failures) {
                await query(`
                    UPDATE backup_schedules 
                    SET enabled = FALSE
                    WHERE id = $1
                `, [schedule.id]);

                this.logger.error('Disabled backup schedule due to consecutive failures', {
                    scheduleName: schedule.schedule_name,
                    failures: schedule.consecutive_failures
                });
            }

            this.logger.error('Scheduled backup execution failed', {
                scheduleName: schedule.schedule_name,
                duration,
                error: error.message
            });
        }
    }

    /**
     * Queue backup for processing
     */
    async queueBackup(backupJob) {
        this.backupQueue.push({
            ...backupJob,
            queuedAt: new Date(),
            attempts: 0,
            maxAttempts: 3
        });

        this.logger.debug('Backup job queued', {
            scheduleName: backupJob.scheduleName,
            queueLength: this.backupQueue.length
        });
    }

    /**
     * Start backup queue processor
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.currentBackups >= this.maxConcurrentBackups || this.backupQueue.length === 0) {
                return;
            }

            const backupJob = this.backupQueue.shift();
            this.processBackupJob(backupJob);

        }, 5000); // Check every 5 seconds
    }

    /**
     * Process individual backup job
     */
    async processBackupJob(backupJob) {
        this.currentBackups++;

        try {
            this.logger.info('Processing backup job', {
                scheduleName: backupJob.scheduleName,
                backupType: backupJob.backupType,
                attempt: backupJob.attempts + 1
            });

            const backupFunction = this.backupJobs[backupJob.backupType];
            if (!backupFunction) {
                throw new Error(`Unknown backup type: ${backupJob.backupType}`);
            }

            await backupFunction(backupJob);

        } catch (error) {
            backupJob.attempts++;
            
            if (backupJob.attempts < backupJob.maxAttempts) {
                // Re-queue for retry
                this.backupQueue.push({
                    ...backupJob,
                    retryAt: new Date(Date.now() + (backupJob.attempts * 60000)) // Exponential backoff
                });

                this.logger.warn('Backup job failed, retrying', {
                    scheduleName: backupJob.scheduleName,
                    attempt: backupJob.attempts,
                    error: error.message
                });
            } else {
                this.logger.error('Backup job failed permanently', {
                    scheduleName: backupJob.scheduleName,
                    attempts: backupJob.attempts,
                    error: error.message
                });
            }
        } finally {
            this.currentBackups--;
        }
    }

    /**
     * Schedule estimation backups
     */
    async scheduleEstimationBackups(backupJob) {
        // Get estimations that need backup based on filters
        let whereClause = 'WHERE 1=1';
        const queryParams = [];
        
        if (backupJob.entityFilter && backupJob.entityFilter.project_ids) {
            whereClause += ` AND project_id = ANY($${queryParams.length + 1})`;
            queryParams.push(backupJob.entityFilter.project_ids);
        }

        if (backupJob.entityFilter && backupJob.entityFilter.status) {
            whereClause += ` AND status = $${queryParams.length + 1}`;
            queryParams.push(backupJob.entityFilter.status);
        }

        // Get estimations modified since last backup
        const estimationsQuery = `
            SELECT e.id, e.project_id, e.updated_at
            FROM estimations e
            LEFT JOIN estimation_backups eb ON e.id = eb.entity_id AND eb.type = 'estimation'
            ${whereClause}
            AND (eb.created_at IS NULL OR e.updated_at > eb.created_at)
            ORDER BY e.updated_at DESC
            LIMIT 100
        `;

        const result = await query(estimationsQuery, queryParams);

        for (const estimation of result.rows) {
            try {
                await backupManager.backupEstimationData(estimation.id, {
                    source: 'scheduled',
                    reason: `Scheduled backup: ${backupJob.scheduleName}`,
                    version: '1.0'
                });

                this.logger.debug('Estimation backup completed', {
                    estimationId: estimation.id,
                    scheduleName: backupJob.scheduleName
                });

            } catch (error) {
                this.logger.error('Failed to backup estimation', {
                    estimationId: estimation.id,
                    error: error.message
                });
            }
        }

        this.logger.info('Estimation backup batch completed', {
            scheduleName: backupJob.scheduleName,
            processedCount: result.rows.length
        });
    }

    /**
     * Schedule project backups
     */
    async scheduleProjectBackups(backupJob) {
        // Get projects that need backup
        let whereClause = 'WHERE deleted_at IS NULL';
        const queryParams = [];

        if (backupJob.entityFilter && backupJob.entityFilter.building_types) {
            whereClause += ` AND building_type = ANY($${queryParams.length + 1})`;
            queryParams.push(backupJob.entityFilter.building_types);
        }

        const projectsQuery = `
            SELECT p.id, p.name, p.updated_at
            FROM projects p
            LEFT JOIN estimation_backups eb ON p.id = eb.entity_id AND eb.type = 'project'
            ${whereClause}
            AND (eb.created_at IS NULL OR p.updated_at > eb.created_at)
            ORDER BY p.updated_at DESC
            LIMIT 50
        `;

        const result = await query(projectsQuery, queryParams);

        for (const project of result.rows) {
            try {
                await backupManager.backupProjectData(project.id, {
                    source: 'scheduled',
                    reason: `Scheduled backup: ${backupJob.scheduleName}`,
                    version: '1.0'
                });

                this.logger.debug('Project backup completed', {
                    projectId: project.id,
                    projectName: project.name,
                    scheduleName: backupJob.scheduleName
                });

            } catch (error) {
                this.logger.error('Failed to backup project', {
                    projectId: project.id,
                    projectName: project.name,
                    error: error.message
                });
            }
        }

        this.logger.info('Project backup batch completed', {
            scheduleName: backupJob.scheduleName,
            processedCount: result.rows.length
        });
    }

    /**
     * Schedule blueprint backups
     */
    async scheduleBlueprintBackups(backupJob) {
        // Get blueprints that need backup
        const blueprintsQuery = `
            SELECT b.id, b.original_filename, b.project_id, b.updated_at
            FROM blueprints b
            LEFT JOIN estimation_backups eb ON b.id = eb.entity_id AND eb.type = 'blueprint'
            WHERE b.deleted_at IS NULL
            AND (eb.created_at IS NULL OR b.updated_at > eb.created_at)
            ORDER BY b.updated_at DESC
            LIMIT 200
        `;

        const result = await query(blueprintsQuery);

        for (const blueprint of result.rows) {
            try {
                const blueprintData = await backupManager.getBlueprintData(blueprint.id);
                
                const backup = {
                    id: backupManager.generateBackupId(),
                    type: 'blueprint',
                    entityId: blueprint.id,
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                    source: 'scheduled',
                    data: blueprintData,
                    metadata: {
                        blueprintId: blueprint.id,
                        projectId: blueprint.project_id,
                        originalFilename: blueprint.original_filename,
                        backupReason: `Scheduled backup: ${backupJob.scheduleName}`,
                        dataSize: JSON.stringify(blueprintData).length,
                        recordCount: backupManager.countRecords(blueprintData)
                    }
                };

                backup.integrity = {
                    hash: backupManager.calculateHash(JSON.stringify(blueprintData)),
                    algorithm: 'sha256'
                };

                await backupManager.storeBackup(backup);

                this.logger.debug('Blueprint backup completed', {
                    blueprintId: blueprint.id,
                    scheduleName: backupJob.scheduleName
                });

            } catch (error) {
                this.logger.error('Failed to backup blueprint', {
                    blueprintId: blueprint.id,
                    error: error.message
                });
            }
        }

        this.logger.info('Blueprint backup batch completed', {
            scheduleName: backupJob.scheduleName,
            processedCount: result.rows.length
        });
    }

    /**
     * Schedule system backups
     */
    async scheduleSystemBackups(backupJob) {
        try {
            await backupManager.backupFullSystem({
                source: 'scheduled',
                reason: `Scheduled system backup: ${backupJob.scheduleName}`,
                version: '1.0'
            });

            this.logger.info('System backup completed', {
                scheduleName: backupJob.scheduleName
            });

        } catch (error) {
            this.logger.error('Failed to backup system', {
                scheduleName: backupJob.scheduleName,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Schedule cleanup job
     */
    scheduleCleanupJob() {
        // Run cleanup daily at 3 AM
        cron.schedule('0 3 * * *', async () => {
            try {
                this.logger.info('Starting scheduled backup cleanup');
                await backupManager.cleanupOldBackups();
                
                // Clean up failed backup operations
                await query(`
                    DELETE FROM backup_operations 
                    WHERE status = 'failed' 
                    AND created_at < NOW() - INTERVAL '7 days'
                `);

                this.logger.info('Scheduled backup cleanup completed');

            } catch (error) {
                this.logger.error('Backup cleanup failed', { error: error.message });
            }
        }, {
            timezone: 'UTC'
        });
    }

    /**
     * Calculate next run time for cron expression
     */
    calculateNextRun(cronExpression, timezone = 'UTC') {
        try {
            // This is a simplified implementation
            // In production, you'd use a more sophisticated cron parser
            const now = new Date();
            const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
            return nextRun;
        } catch (error) {
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Add new backup schedule
     */
    async addSchedule(scheduleData) {
        try {
            const result = await query(`
                INSERT INTO backup_schedules (
                    schedule_name, backup_type, entity_filter, cron_expression,
                    timezone, retention_days, storage_options, compression_enabled,
                    encryption_enabled, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                scheduleData.scheduleName,
                scheduleData.backupType,
                JSON.stringify(scheduleData.entityFilter || {}),
                scheduleData.cronExpression,
                scheduleData.timezone || 'UTC',
                scheduleData.retentionDays || 30,
                JSON.stringify(scheduleData.storageOptions || {}),
                scheduleData.compressionEnabled || true,
                scheduleData.encryptionEnabled || false,
                scheduleData.createdBy || 'system'
            ]);

            const schedule = result.rows[0];
            await this.createScheduledJob(schedule);

            this.logger.info('New backup schedule added', {
                scheduleName: schedule.schedule_name,
                backupType: schedule.backup_type
            });

            return schedule;

        } catch (error) {
            this.logger.error('Failed to add backup schedule', { error: error.message });
            throw error;
        }
    }

    /**
     * Remove backup schedule
     */
    async removeSchedule(scheduleName) {
        try {
            // Stop the cron job
            const jobInfo = this.scheduledJobs.get(scheduleName);
            if (jobInfo) {
                jobInfo.job.stop();
                this.scheduledJobs.delete(scheduleName);
            }

            // Remove from database
            await query(`
                DELETE FROM backup_schedules WHERE schedule_name = $1
            `, [scheduleName]);

            this.logger.info('Backup schedule removed', { scheduleName });

        } catch (error) {
            this.logger.error('Failed to remove backup schedule', { 
                scheduleName, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            scheduledJobs: Array.from(this.scheduledJobs.entries()).map(([name, info]) => ({
                name,
                backupType: info.schedule.backup_type,
                cronExpression: info.schedule.cron_expression,
                enabled: info.schedule.enabled,
                lastRun: info.lastRun,
                nextRun: info.nextRun,
                consecutiveFailures: info.schedule.consecutive_failures
            })),
            currentBackups: this.currentBackups,
            queuedBackups: this.backupQueue.length,
            maxConcurrentBackups: this.maxConcurrentBackups
        };
    }
}

// Create singleton instance
const backupScheduler = new BackupScheduler();

module.exports = {
    BackupScheduler,
    backupScheduler
};