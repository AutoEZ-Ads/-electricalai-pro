import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

/**
 * Monday.com Enterprise Integration for Electrical Estimation System
 * 
 * Features:
 * - Full CRUD operations for boards, items, and columns
 * - Real-time webhook handling
 * - Enterprise-grade error handling and retry logic
 * - Advanced filtering and querying
 * - Bulk operations support
 * - Custom automation triggers
 * - Advanced permissions and team management
 */

interface MondayConfig {
    apiToken: string;
    baseUrl?: string;
    version?: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
    webhookSecret?: string;
    enableLogging?: boolean;
}

interface MondayBoard {
    id: string;
    name: string;
    description?: string;
    board_folder_id?: number;
    board_kind: string;
    state: string;
    permissions: string;
}

interface MondayItem {
    id: string;
    name: string;
    board: {
        id: string;
    };
    group: {
        id: string;
        title: string;
    };
    column_values: MondayColumnValue[];
    state: string;
    created_at: string;
    updated_at: string;
}

interface MondayColumnValue {
    id: string;
    title: string;
    text?: string;
    value?: any;
    type: string;
}

interface ElectricalProject {
    id?: string;
    name: string;
    description?: string;
    area_sqft: number;
    building_type: 'residential' | 'commercial' | 'industrial';
    voltage_system: string;
    estimated_load: number;
    estimated_cost?: number;
    status: 'planning' | 'design' | 'approval' | 'construction' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: string;
    due_date?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
}

interface MondayWebhookPayload {
    event: {
        type: string;
        boardId: number;
        itemId?: number;
        columnId?: string;
        userId: number;
    };
    payload: any;
}

export class MondayEnterpriseConnector extends EventEmitter {
    private client: AxiosInstance;
    private config: MondayConfig;
    private rateLimitReset: number = 0;
    private requestQueue: Array<() => Promise<any>> = [];
    private isProcessingQueue: boolean = false;

    constructor(config: MondayConfig) {
        super();
        this.config = {
            baseUrl: 'https://api.monday.com/v2',
            version: 'v2',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableLogging: false,
            ...config
        };

        this.client = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json',
                'API-Version': this.config.version,
                'User-Agent': 'ElectricalEstimationSystem/2.0'
            }
        });

        this.setupInterceptors();
        this.log('Monday.com Enterprise Connector initialized');
    }

    private setupInterceptors(): void {
        // Request interceptor for rate limiting
        this.client.interceptors.request.use(
            async (config) => {
                if (Date.now() < this.rateLimitReset) {
                    const waitTime = this.rateLimitReset - Date.now();
                    this.log(`Rate limit active, waiting ${waitTime}ms`);
                    await this.sleep(waitTime);
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling and rate limiting
        this.client.interceptors.response.use(
            (response) => {
                // Update rate limit info
                const resetTime = response.headers['x-ratelimit-reset'];
                if (resetTime) {
                    this.rateLimitReset = parseInt(resetTime) * 1000;
                }
                return response;
            },
            async (error) => {
                const { response, config: requestConfig } = error;
                
                if (response?.status === 429) {
                    // Rate limit exceeded
                    const retryAfter = parseInt(response.headers['retry-after'] || '60') * 1000;
                    this.rateLimitReset = Date.now() + retryAfter;
                    this.log(`Rate limit exceeded, retrying after ${retryAfter}ms`);
                    
                    await this.sleep(retryAfter);
                    return this.client.request(requestConfig);
                }

                if (response?.status >= 500 && requestConfig.retryCount < this.config.retryAttempts!) {
                    requestConfig.retryCount = (requestConfig.retryCount || 0) + 1;
                    const delay = this.config.retryDelay! * Math.pow(2, requestConfig.retryCount - 1);
                    
                    this.log(`Retrying request (attempt ${requestConfig.retryCount}/${this.config.retryAttempts}) after ${delay}ms`);
                    await this.sleep(delay);
                    return this.client.request(requestConfig);
                }

                return Promise.reject(error);
            }
        );
    }

    /**
     * Create a new board for electrical projects
     */
    async createElectricalProjectBoard(
        name: string, 
        description?: string,
        templateId?: string
    ): Promise<MondayBoard> {
        const mutation = `
            mutation CreateBoard($name: String!, $kind: BoardKind!, $description: String, $template_id: ID) {
                create_board(
                    board_name: $name, 
                    board_kind: $kind, 
                    description: $description,
                    template_id: $template_id
                ) {
                    id
                    name
                    description
                    board_kind
                    state
                    permissions
                }
            }
        `;

        const variables = {
            name,
            kind: 'public',
            description,
            template_id: templateId
        };

        try {
            const response = await this.executeGraphQL(mutation, variables);
            const board = response.data.create_board;

            // Create standard electrical estimation columns
            await this.createElectricalColumns(board.id);

            this.log(`Created electrical project board: ${board.name} (ID: ${board.id})`);
            this.emit('boardCreated', board);
            
            return board;
        } catch (error) {
            this.handleError('Failed to create electrical project board', error);
            throw error;
        }
    }

    /**
     * Create standard columns for electrical estimation projects
     */
    private async createElectricalColumns(boardId: string): Promise<void> {
        const columns = [
            { title: 'Area (sq ft)', type: 'numbers', settings: '{"unit":"sq ft"}' },
            { title: 'Building Type', type: 'dropdown', settings: '{"labels":{"1":"Residential","2":"Commercial","3":"Industrial","4":"Mixed Use"}}' },
            { title: 'Voltage System', type: 'dropdown', settings: '{"labels":{"1":"Single Phase 240V","2":"Three Phase 208V","3":"Three Phase 480V","4":"Single Phase 120V"}}' },
            { title: 'Estimated Load (VA)', type: 'numbers', settings: '{"unit":"VA"}' },
            { title: 'Required Ampacity', type: 'numbers', settings: '{"unit":"A"}' },
            { title: 'Service Size', type: 'numbers', settings: '{"unit":"A"}' },
            { title: 'Estimated Cost', type: 'numbers', settings: '{"unit":"$","currency":"USD"}' },
            { title: 'Status', type: 'status', settings: '{"labels":{"1":"Planning","2":"Design","3":"Approval","4":"Construction","5":"Completed"},"labels_colors":{"1":"#c4c4c4","2":"#fdab3d","3":"#e2445c","4":"#00c875","5":"#037f4c"}}' },
            { title: 'Priority', type: 'status', settings: '{"labels":{"1":"Low","2":"Medium","3":"High","4":"Urgent"},"labels_colors":{"1":"#c4c4c4","2":"#fdab3d","3":"#e2445c","4":"#bb3354"}}' },
            { title: 'NEC Compliant', type: 'checkbox' },
            { title: 'Confidence Score', type: 'rating' },
            { title: 'Assignee', type: 'people' },
            { title: 'Due Date', type: 'date' },
            { title: 'Tags', type: 'tags' },
            { title: 'Files', type: 'file' },
            { title: 'Notes', type: 'long-text' }
        ];

        const mutation = `
            mutation CreateColumn($board_id: ID!, $title: String!, $column_type: ColumnType!, $defaults: JSON) {
                create_column(
                    board_id: $board_id,
                    title: $title,
                    column_type: $column_type,
                    defaults: $defaults
                ) {
                    id
                    title
                    type
                }
            }
        `;

        for (const column of columns) {
            try {
                const variables = {
                    board_id: boardId,
                    title: column.title,
                    column_type: column.type,
                    defaults: column.settings ? JSON.parse(column.settings) : null
                };

                await this.executeGraphQL(mutation, variables);
                this.log(`Created column: ${column.title} (${column.type})`);
            } catch (error) {
                this.log(`Failed to create column ${column.title}: ${error.message}`);
            }
        }
    }

    /**
     * Create a new electrical project item
     */
    async createElectricalProject(
        boardId: string, 
        project: ElectricalProject,
        groupId?: string
    ): Promise<MondayItem> {
        const mutation = `
            mutation CreateItem($board_id: ID!, $group_id: String, $item_name: String!, $column_values: JSON) {
                create_item(
                    board_id: $board_id,
                    group_id: $group_id,
                    item_name: $item_name,
                    column_values: $column_values
                ) {
                    id
                    name
                    board {
                        id
                    }
                    group {
                        id
                        title
                    }
                    column_values {
                        id
                        title
                        text
                        value
                        type
                    }
                    state
                    created_at
                    updated_at
                }
            }
        `;

        // Map project data to Monday column values
        const columnValues = await this.mapProjectToColumnValues(boardId, project);

        const variables = {
            board_id: boardId,
            group_id: groupId,
            item_name: project.name,
            column_values: JSON.stringify(columnValues)
        };

        try {
            const response = await this.executeGraphQL(mutation, variables);
            const item = response.data.create_item;

            this.log(`Created electrical project: ${item.name} (ID: ${item.id})`);
            this.emit('projectCreated', { item, project });
            
            return item;
        } catch (error) {
            this.handleError('Failed to create electrical project', error);
            throw error;
        }
    }

    /**
     * Update an existing electrical project
     */
    async updateElectricalProject(
        itemId: string,
        updates: Partial<ElectricalProject>
    ): Promise<MondayItem> {
        // Get current item to determine board ID
        const currentItem = await this.getItem(itemId);
        const columnValues = await this.mapProjectToColumnValues(currentItem.board.id, updates);

        const mutation = `
            mutation ChangeMultipleColumnValues($item_id: ID!, $board_id: ID!, $column_values: JSON!) {
                change_multiple_column_values(
                    item_id: $item_id,
                    board_id: $board_id,
                    column_values: $column_values
                ) {
                    id
                    name
                    column_values {
                        id
                        title
                        text
                        value
                        type
                    }
                    updated_at
                }
            }
        `;

        const variables = {
            item_id: itemId,
            board_id: currentItem.board.id,
            column_values: JSON.stringify(columnValues)
        };

        try {
            const response = await this.executeGraphQL(mutation, variables);
            const item = response.data.change_multiple_column_values;

            this.log(`Updated electrical project: ${item.name} (ID: ${item.id})`);
            this.emit('projectUpdated', { item, updates });
            
            return item;
        } catch (error) {
            this.handleError('Failed to update electrical project', error);
            throw error;
        }
    }

    /**
     * Sync electrical calculation results to Monday.com
     */
    async syncCalculationResults(
        itemId: string,
        calculationResults: {
            lighting_load_va: number;
            total_connected_load_va: number;
            demand_load_va: number;
            required_ampacity: number;
            recommended_service_size: number;
            nec_compliant: boolean;
            confidence_score: number;
            estimated_cost?: number;
        }
    ): Promise<void> {
        const updates: Partial<ElectricalProject> = {
            estimated_load: calculationResults.total_connected_load_va,
            estimated_cost: calculationResults.estimated_cost,
            custom_fields: {
                lighting_load_va: calculationResults.lighting_load_va,
                demand_load_va: calculationResults.demand_load_va,
                required_ampacity: calculationResults.required_ampacity,
                recommended_service_size: calculationResults.recommended_service_size,
                nec_compliant: calculationResults.nec_compliant,
                confidence_score: calculationResults.confidence_score
            }
        };

        await this.updateElectricalProject(itemId, updates);
        this.emit('calculationSynced', { itemId, results: calculationResults });
    }

    /**
     * Get electrical projects with advanced filtering
     */
    async getElectricalProjects(
        boardId: string,
        filters?: {
            status?: string[];
            priority?: string[];
            assignee?: string[];
            buildingType?: string[];
            minArea?: number;
            maxArea?: number;
            tags?: string[];
            dateRange?: { start: string; end: string };
        }
    ): Promise<MondayItem[]> {
        let query = `
            query GetItems($board_id: [ID!]!) {
                boards(ids: $board_id) {
                    items_page {
                        cursor
                        items {
                            id
                            name
                            board {
                                id
                            }
                            group {
                                id
                                title
                            }
                            column_values {
                                id
                                title
                                text
                                value
                                type
                            }
                            state
                            created_at
                            updated_at
                        }
                    }
                }
            }
        `;

        try {
            const response = await this.executeGraphQL(query, { board_id: [boardId] });
            let items = response.data.boards[0]?.items_page?.items || [];

            // Apply client-side filtering
            if (filters) {
                items = this.applyFilters(items, filters);
            }

            this.log(`Retrieved ${items.length} electrical projects`);
            return items;
        } catch (error) {
            this.handleError('Failed to get electrical projects', error);
            throw error;
        }
    }

    /**
     * Create automation for electrical calculations
     */
    async createElectricalAutomation(
        boardId: string,
        automationType: 'calculation_trigger' | 'status_update' | 'notification',
        config: {
            triggerColumn?: string;
            actionColumn?: string;
            conditions?: Record<string, any>;
            webhookUrl?: string;
            emailRecipients?: string[];
        }
    ): Promise<any> {
        const mutation = `
            mutation CreateAutomation($board_id: ID!, $name: String!, $config: JSON!) {
                create_automation(
                    board_id: $board_id,
                    name: $name,
                    config: $config
                ) {
                    id
                    name
                    is_active
                }
            }
        `;

        const automationName = `Electrical ${automationType.replace('_', ' ')}`;
        const variables = {
            board_id: boardId,
            name: automationName,
            config: JSON.stringify(config)
        };

        try {
            const response = await this.executeGraphQL(mutation, variables);
            const automation = response.data.create_automation;

            this.log(`Created automation: ${automation.name} (ID: ${automation.id})`);
            this.emit('automationCreated', automation);
            
            return automation;
        } catch (error) {
            this.handleError('Failed to create automation', error);
            throw error;
        }
    }

    /**
     * Handle Monday.com webhooks
     */
    async handleWebhook(payload: MondayWebhookPayload, signature?: string): Promise<void> {
        // Verify webhook signature if secret is provided
        if (this.config.webhookSecret && signature) {
            const isValid = this.verifyWebhookSignature(JSON.stringify(payload), signature);
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
        }

        const { event } = payload;
        this.log(`Received webhook: ${event.type} for board ${event.boardId}`);

        try {
            switch (event.type) {
                case 'create_item':
                    await this.handleItemCreated(payload);
                    break;
                case 'change_column_value':
                    await this.handleColumnValueChanged(payload);
                    break;
                case 'change_status_column':
                    await this.handleStatusChanged(payload);
                    break;
                case 'delete_item':
                    await this.handleItemDeleted(payload);
                    break;
                default:
                    this.log(`Unhandled webhook event: ${event.type}`);
            }

            this.emit('webhookProcessed', payload);
        } catch (error) {
            this.handleError('Failed to process webhook', error);
            this.emit('webhookError', { payload, error });
        }
    }

    /**
     * Bulk operations for enterprise efficiency
     */
    async bulkCreateProjects(
        boardId: string,
        projects: ElectricalProject[],
        groupId?: string
    ): Promise<MondayItem[]> {
        const batchSize = 10; // Monday.com rate limits
        const results: MondayItem[] = [];

        for (let i = 0; i < projects.length; i += batchSize) {
            const batch = projects.slice(i, i + batchSize);
            const batchPromises = batch.map(project => 
                this.createElectricalProject(boardId, project, groupId)
            );

            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                this.log(`Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(projects.length / batchSize)}`);
                
                // Respect rate limits
                if (i + batchSize < projects.length) {
                    await this.sleep(1000);
                }
            } catch (error) {
                this.handleError(`Batch creation failed at index ${i}`, error);
                throw error;
            }
        }

        this.emit('bulkProjectsCreated', { count: results.length, items: results });
        return results;
    }

    /**
     * Generate electrical estimation reports
     */
    async generateEstimationReport(
        boardId: string,
        filters?: any
    ): Promise<{
        summary: {
            totalProjects: number;
            completedProjects: number;
            totalEstimatedLoad: number;
            totalEstimatedCost: number;
            averageConfidenceScore: number;
            necComplianceRate: number;
        };
        projects: MondayItem[];
        exportUrl?: string;
    }> {
        const projects = await this.getElectricalProjects(boardId, filters);
        
        const summary = {
            totalProjects: projects.length,
            completedProjects: projects.filter(p => 
                this.getColumnValue(p, 'Status')?.text === 'Completed'
            ).length,
            totalEstimatedLoad: projects.reduce((sum, p) => 
                sum + (parseFloat(this.getColumnValue(p, 'Estimated Load (VA)')?.text || '0') || 0), 0
            ),
            totalEstimatedCost: projects.reduce((sum, p) => 
                sum + (parseFloat(this.getColumnValue(p, 'Estimated Cost')?.text || '0') || 0), 0
            ),
            averageConfidenceScore: projects.reduce((sum, p) => 
                sum + (parseFloat(this.getColumnValue(p, 'Confidence Score')?.text || '0') || 0), 0
            ) / projects.length,
            necComplianceRate: projects.filter(p => 
                this.getColumnValue(p, 'NEC Compliant')?.value === 'true'
            ).length / projects.length * 100
        };

        this.log(`Generated report for ${summary.totalProjects} projects`);
        this.emit('reportGenerated', { summary, projects });

        return { summary, projects };
    }

    // Utility methods
    private async executeGraphQL(query: string, variables?: any): Promise<any> {
        const response = await this.client.post('/', {
            query,
            variables
        });

        if (response.data.errors) {
            throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data;
    }

    private async mapProjectToColumnValues(boardId: string, project: Partial<ElectricalProject>): Promise<Record<string, any>> {
        const columnValues: Record<string, any> = {};

        // Map project fields to Monday column values
        if (project.area_sqft !== undefined) {
            columnValues['area_sq_ft'] = project.area_sqft.toString();
        }

        if (project.building_type) {
            const buildingTypeMap = {
                'residential': '1',
                'commercial': '2', 
                'industrial': '3',
                'mixed_use': '4'
            };
            columnValues['building_type'] = { label: buildingTypeMap[project.building_type] || '1' };
        }

        if (project.voltage_system) {
            const voltageMap = {
                'single_phase_240v': '1',
                'three_phase_208v': '2',
                'three_phase_480v': '3',
                'single_phase_120v': '4'
            };
            columnValues['voltage_system'] = { label: voltageMap[project.voltage_system as any] || '1' };
        }

        if (project.estimated_load !== undefined) {
            columnValues['estimated_load_va'] = project.estimated_load.toString();
        }

        if (project.estimated_cost !== undefined) {
            columnValues['estimated_cost'] = project.estimated_cost.toString();
        }

        if (project.status) {
            const statusMap = {
                'planning': '1',
                'design': '2',
                'approval': '3',
                'construction': '4',
                'completed': '5'
            };
            columnValues['status'] = { label: statusMap[project.status] || '1' };
        }

        if (project.priority) {
            const priorityMap = {
                'low': '1',
                'medium': '2',
                'high': '3',
                'urgent': '4'
            };
            columnValues['priority'] = { label: priorityMap[project.priority] || '2' };
        }

        if (project.due_date) {
            columnValues['due_date'] = { date: project.due_date };
        }

        if (project.tags) {
            columnValues['tags'] = { tag_ids: project.tags };
        }

        if (project.custom_fields) {
            // Map custom fields
            Object.entries(project.custom_fields).forEach(([key, value]) => {
                columnValues[key] = value;
            });
        }

        return columnValues;
    }

    private applyFilters(items: MondayItem[], filters: any): MondayItem[] {
        return items.filter(item => {
            // Apply status filter
            if (filters.status && filters.status.length > 0) {
                const statusValue = this.getColumnValue(item, 'Status')?.text;
                if (!statusValue || !filters.status.includes(statusValue)) {
                    return false;
                }
            }

            // Apply priority filter
            if (filters.priority && filters.priority.length > 0) {
                const priorityValue = this.getColumnValue(item, 'Priority')?.text;
                if (!priorityValue || !filters.priority.includes(priorityValue)) {
                    return false;
                }
            }

            // Apply area range filter
            if (filters.minArea || filters.maxArea) {
                const areaValue = parseFloat(this.getColumnValue(item, 'Area (sq ft)')?.text || '0');
                if (filters.minArea && areaValue < filters.minArea) return false;
                if (filters.maxArea && areaValue > filters.maxArea) return false;
            }

            return true;
        });
    }

    private getColumnValue(item: MondayItem, columnTitle: string): MondayColumnValue | undefined {
        return item.column_values.find(cv => cv.title === columnTitle);
    }

    private async handleItemCreated(payload: MondayWebhookPayload): Promise<void> {
        // Trigger electrical calculation for new items
        const itemId = payload.event.itemId?.toString();
        if (itemId) {
            this.emit('newProjectDetected', { itemId, boardId: payload.event.boardId });
        }
    }

    private async handleColumnValueChanged(payload: MondayWebhookPayload): Promise<void> {
        // Auto-recalculate when key values change
        const triggerColumns = ['Area (sq ft)', 'Building Type', 'Voltage System'];
        const columnId = payload.event.columnId;
        
        if (triggerColumns.some(col => columnId?.includes(col.toLowerCase().replace(/[^a-z0-9]/g, '_')))) {
            this.emit('recalculationNeeded', {
                itemId: payload.event.itemId,
                boardId: payload.event.boardId,
                columnId
            });
        }
    }

    private async handleStatusChanged(payload: MondayWebhookPayload): Promise<void> {
        this.emit('statusChanged', {
            itemId: payload.event.itemId,
            boardId: payload.event.boardId,
            newStatus: payload.payload
        });
    }

    private async handleItemDeleted(payload: MondayWebhookPayload): Promise<void> {
        this.emit('projectDeleted', {
            itemId: payload.event.itemId,
            boardId: payload.event.boardId
        });
    }

    private async getItem(itemId: string): Promise<MondayItem> {
        const query = `
            query GetItem($item_id: [ID!]!) {
                items(ids: $item_id) {
                    id
                    name
                    board {
                        id
                    }
                    group {
                        id
                        title
                    }
                    column_values {
                        id
                        title
                        text
                        value
                        type
                    }
                    state
                    created_at
                    updated_at
                }
            }
        `;

        const response = await this.executeGraphQL(query, { item_id: [itemId] });
        return response.data.items[0];
    }

    private verifyWebhookSignature(payload: string, signature: string): boolean {
        // Implement HMAC signature verification
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret!)
            .update(payload)
            .digest('hex');
        
        return signature === `sha256=${expectedSignature}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private log(message: string): void {
        if (this.config.enableLogging) {
            console.log(`[MondayConnector] ${new Date().toISOString()}: ${message}`);
        }
    }

    private handleError(message: string, error: any): void {
        const errorMessage = `${message}: ${error.message || error}`;
        this.log(`ERROR: ${errorMessage}`);
        this.emit('error', { message: errorMessage, error });
    }
}