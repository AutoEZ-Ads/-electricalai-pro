const { defaultMondayClient } = require('../utils/monday-api-client');
const winston = require('winston');

class MondayService {
    constructor(logger = winston.createLogger({
        level: 'info',
        format: winston.format.simple(),
        transports: [new winston.transports.Console()]
    })) {
        this.logger = logger;
        this.client = defaultMondayClient;
    }

    /**
     * Get access token for a user
     * @param {string} userId - Monday user ID
     * @returns {Promise<string>} Access token
     */
    async getAccessTokenForUser(userId, db) {
        const result = await db.query(
            'SELECT access_token FROM monday_users WHERE monday_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`No access token found for Monday user ${userId}`);
        }
        
        return result.rows[0].access_token;
    }

    /**
     * Create estimation project in Monday.com
     * @param {Object} projectData - Project information
     * @param {string} accessToken - Monday access token
     * @returns {Promise<Object>} Created item
     */
    async createEstimationProject(projectData, accessToken) {
        const {
            boardId,
            projectName,
            squareFootage,
            buildingType,
            priority = 'medium',
            estimationType = 'preliminary'
        } = projectData;

        this.logger.info(`Creating Monday project: ${projectName}`, {
            boardId,
            buildingType,
            estimationType
        });

        // Prepare column values based on Monday board structure
        const columnValues = {
            'text': projectName,
            'square_footage': squareFootage?.toString() || '',
            'building_type': buildingType || '',
            'priority': priority,
            'estimation_type': estimationType,
            'status': 'Planning',
            'created_date': new Date().toISOString().split('T')[0]
        };

        try {
            const response = await this.client.createItem(
                boardId,
                projectName,
                columnValues,
                accessToken,
                { requestId: `create-project-${Date.now()}` }
            );

            this.logger.info(`Monday project created successfully`, {
                itemId: response.data.create_item.id,
                projectName
            });

            return response.data.create_item;

        } catch (error) {
            this.logger.error(`Failed to create Monday project: ${projectName}`, {
                error: error.message,
                boardId,
                retryable: error.retriesExhausted !== undefined
            });
            throw error;
        }
    }

    /**
     * Update estimation results in Monday.com
     * @param {string} itemId - Monday item ID
     * @param {Object} estimationData - Estimation results
     * @param {string} accessToken - Monday access token
     */
    async updateEstimationResults(itemId, estimationData, accessToken) {
        const {
            materialCost,
            laborCost,
            totalCost,
            status = 'Completed',
            calculationDetails
        } = estimationData;

        this.logger.info(`Updating Monday item ${itemId} with estimation results`, {
            totalCost,
            status
        });

        const columnValues = {
            'material_cost': materialCost?.toString() || '0',
            'labor_cost': laborCost?.toString() || '0',
            'total_cost': totalCost?.toString() || '0',
            'status': status,
            'calculation_notes': calculationDetails ? JSON.stringify(calculationDetails) : '',
            'updated_date': new Date().toISOString().split('T')[0]
        };

        try {
            const response = await this.client.updateItem(
                itemId,
                columnValues,
                accessToken,
                { requestId: `update-estimation-${itemId}-${Date.now()}` }
            );

            this.logger.info(`Monday item ${itemId} updated successfully`, {
                totalCost,
                status
            });

            return response.data.change_multiple_column_values;

        } catch (error) {
            this.logger.error(`Failed to update Monday item ${itemId}`, {
                error: error.message,
                totalCost,
                retryable: error.retriesExhausted !== undefined
            });
            throw error;
        }
    }

    /**
     * Get project details from Monday.com
     * @param {string} boardId - Monday board ID
     * @param {string} itemId - Monday item ID (optional)
     * @param {string} accessToken - Monday access token
     */
    async getProjectDetails(boardId, accessToken, itemId = null) {
        this.logger.info(`Fetching Monday project details`, {
            boardId,
            itemId
        });

        try {
            const response = await this.client.getBoard(
                boardId,
                accessToken,
                { requestId: `get-project-${boardId}-${Date.now()}` }
            );

            const board = response.data.boards[0];
            
            if (!board) {
                throw new Error(`Board ${boardId} not found`);
            }

            // If specific item requested, filter to that item
            if (itemId) {
                const item = board.items.find(item => item.id === itemId);
                if (!item) {
                    throw new Error(`Item ${itemId} not found in board ${boardId}`);
                }
                return { board: { ...board, items: [item] } };
            }

            return { board };

        } catch (error) {
            this.logger.error(`Failed to fetch Monday project details`, {
                error: error.message,
                boardId,
                itemId,
                retryable: error.retriesExhausted !== undefined
            });
            throw error;
        }
    }

    /**
     * Sync estimation data between local database and Monday.com
     * @param {Object} db - Database connection
     * @param {string} estimationId - Local estimation ID
     * @param {string} accessToken - Monday access token
     */
    async syncEstimationData(db, estimationId, accessToken) {
        this.logger.info(`Syncing estimation data for ${estimationId}`);

        try {
            // Get local estimation data
            const estimationResult = await db.query(`
                SELECT e.*, p.name as project_name, p.monday_item_id, p.monday_board_id
                FROM estimations e
                JOIN projects p ON e.project_id = p.id
                WHERE e.id = $1
            `, [estimationId]);

            if (estimationResult.rows.length === 0) {
                throw new Error(`Estimation ${estimationId} not found`);
            }

            const estimation = estimationResult.rows[0];

            if (!estimation.monday_item_id || !estimation.monday_board_id) {
                this.logger.warn(`Estimation ${estimationId} not linked to Monday.com`, {
                    hasItemId: !!estimation.monday_item_id,
                    hasBoardId: !!estimation.monday_board_id
                });
                return null;
            }

            // Update Monday.com with latest estimation data
            await this.updateEstimationResults(
                estimation.monday_item_id,
                {
                    materialCost: estimation.material_cost,
                    laborCost: estimation.labor_cost,
                    totalCost: estimation.total_cost,
                    status: estimation.status === 'completed' ? 'Completed' : 'In Progress',
                    calculationDetails: estimation.calculations
                },
                accessToken
            );

            // Update sync timestamp
            await db.query(`
                UPDATE estimations 
                SET monday_synced_at = NOW()
                WHERE id = $1
            `, [estimationId]);

            this.logger.info(`Estimation ${estimationId} synced successfully`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to sync estimation ${estimationId}`, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Handle Monday.com webhook events with robust error handling
     * @param {Object} webhookData - Webhook payload
     * @param {Object} db - Database connection
     */
    async handleWebhookEvent(webhookData, db) {
        const { event, pulseId, boardId, userId } = webhookData;
        const eventType = event?.type;

        this.logger.info(`Processing Monday webhook event: ${eventType}`, {
            pulseId,
            boardId,
            userId
        });

        try {
            // Get access token for the user who triggered the event
            let accessToken;
            try {
                accessToken = await this.getAccessTokenForUser(userId, db);
            } catch (error) {
                this.logger.warn(`No access token for user ${userId}, using system token`);
                accessToken = process.env.MONDAY_SYSTEM_TOKEN;
            }

            switch (eventType) {
                case 'create_item':
                    return await this.handleCreateItem(webhookData, accessToken, db);
                    
                case 'change_column_value':
                    return await this.handleColumnChange(webhookData, accessToken, db);
                    
                case 'create_update':
                    return await this.handleCreateUpdate(webhookData, accessToken, db);
                    
                case 'item_deleted':
                    return await this.handleItemDeleted(webhookData, db);
                    
                default:
                    this.logger.info(`Unhandled webhook event type: ${eventType}`);
                    return { handled: false, eventType };
            }

        } catch (error) {
            this.logger.error(`Webhook event processing failed`, {
                eventType,
                pulseId,
                error: error.message,
                retryable: this.isRetryableWebhookError(error)
            });

            // Re-throw retryable errors for webhook retry mechanisms
            if (this.isRetryableWebhookError(error)) {
                throw error;
            }

            // Log non-retryable errors but don't fail the webhook
            return { 
                handled: false, 
                error: error.message,
                eventType 
            };
        }
    }

    /**
     * Determine if webhook error is retryable
     */
    isRetryableWebhookError(error) {
        // Network errors, rate limits, and server errors are retryable
        return error.code === 'ECONNREFUSED' || 
               error.code === 'ETIMEDOUT' ||
               error.statusCode >= 500 ||
               error.statusCode === 429;
    }

    /**
     * Handle item creation webhook
     */
    async handleCreateItem(webhookData, accessToken, db) {
        const { pulseId, boardId, pulseName } = webhookData;
        
        // Create local project record
        const projectResult = await db.query(`
            INSERT INTO projects (
                name, monday_item_id, monday_board_id, 
                status, created_at, updated_at
            )
            VALUES ($1, $2, $3, 'planning', NOW(), NOW())
            ON CONFLICT (monday_item_id) DO UPDATE SET
                name = EXCLUDED.name,
                updated_at = NOW()
            RETURNING id
        `, [pulseName, pulseId, boardId]);

        return { 
            handled: true, 
            projectId: projectResult.rows[0].id,
            mondayItemId: pulseId 
        };
    }

    /**
     * Handle column change webhook
     */
    async handleColumnChange(webhookData, accessToken, db) {
        const { pulseId, columnId, value } = webhookData;
        
        // Update local project data based on column changes
        const updateMap = {
            'status': 'status',
            'square_footage': 'square_footage',
            'building_type': 'building_type'
        };

        if (updateMap[columnId]) {
            await db.query(`
                UPDATE projects 
                SET ${updateMap[columnId]} = $1, updated_at = NOW()
                WHERE monday_item_id = $2
            `, [value, pulseId]);
        }

        return { handled: true, columnId, value };
    }

    /**
     * Handle update creation webhook
     */
    async handleCreateUpdate(webhookData, accessToken, db) {
        const { pulseId, updateText } = webhookData;
        
        // Store update in local database
        await db.query(`
            INSERT INTO project_updates (
                project_id, update_text, source, created_at
            )
            SELECT p.id, $2, 'monday_webhook', NOW()
            FROM projects p
            WHERE p.monday_item_id = $1
        `, [pulseId, updateText]);

        return { handled: true, updateText };
    }

    /**
     * Handle item deletion webhook
     */
    async handleItemDeleted(webhookData, db) {
        const { pulseId } = webhookData;
        
        // Soft delete local project
        await db.query(`
            UPDATE projects 
            SET deleted_at = NOW()
            WHERE monday_item_id = $1
        `, [pulseId]);

        return { handled: true, deleted: true };
    }

    /**
     * Get API client health status
     */
    getHealthStatus() {
        return this.client.getCircuitBreakerStatus();
    }

    /**
     * Reset circuit breaker (admin function)
     */
    resetCircuitBreaker() {
        return this.client.resetCircuitBreaker();
    }
}

module.exports = {
    MondayService,
    defaultMondayService: new MondayService()
};