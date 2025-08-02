const { Pool } = require('pg');
const winston = require('winston');

class DatabaseManager {
    constructor(options = {}) {
        this.logger = options.logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/database.log' })
            ]
        });

        this.connectionConfig = {
            connectionString: process.env.DATABASE_URL,
            
            // Connection Pool Configuration
            max: parseInt(process.env.DB_POOL_MAX) || 20,              // Maximum connections
            min: parseInt(process.env.DB_POOL_MIN) || 2,               // Minimum connections
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,     // 30 seconds
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,  // 2 seconds
            
            // SSL Configuration
            ssl: this.getSSLConfig(),
            
            // Advanced Pool Options
            acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 5000,  // 5 seconds to acquire connection
            createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 5000,   // 5 seconds to create connection
            destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000, // 5 seconds to destroy connection
            reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL) || 1000,     // Check for idle connections every second
            createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL) || 200, // Retry connection creation
            
            // Application Name for monitoring
            application_name: process.env.DB_APPLICATION_NAME || 'electrical-estimation-api',
        };

        this.pool = null;
        this.isHealthy = false;
        this.connectionAttempts = 0;
        this.maxRetries = parseInt(process.env.DB_MAX_RETRIES) || 5;
        
        // Metrics tracking
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            waitingConnections: 0,
            totalQueries: 0,
            failedQueries: 0,
            averageQueryTime: 0,
            slowQueries: 0,
            connectionErrors: 0,
            lastHealthCheck: null,
            uptime: Date.now()
        };

        // Query performance tracking
        this.queryStats = new Map();
        this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000; // 1 second
    }

    /**
     * Configure SSL settings based on environment
     */
    getSSLConfig() {
        const nodeEnv = process.env.NODE_ENV;
        
        if (nodeEnv === 'production') {
            return {
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
                ca: process.env.DB_SSL_CA,
                key: process.env.DB_SSL_KEY,
                cert: process.env.DB_SSL_CERT,
            };
        } else if (nodeEnv === 'development' && process.env.DATABASE_URL?.includes('ssl=true')) {
            return {
                rejectUnauthorized: false
            };
        }
        
        return false; // No SSL for local development
    }

    /**
     * Initialize database connection pool with retry logic
     */
    async initialize() {
        this.connectionAttempts++;
        
        try {
            this.pool = new Pool(this.connectionConfig);
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Test the connection
            await this.testConnection();
            
            this.isHealthy = true;
            this.connectionAttempts = 0;
            
            this.logger.info('Database connection pool initialized successfully', {
                maxConnections: this.connectionConfig.max,
                minConnections: this.connectionConfig.min,
                ssl: !!this.connectionConfig.ssl,
                applicationName: this.connectionConfig.application_name
            });

            // Start metrics collection
            this.startMetricsCollection();
            
            return this.pool;
            
        } catch (error) {
            this.isHealthy = false;
            this.logger.error('Database initialization failed', {
                attempt: this.connectionAttempts,
                maxRetries: this.maxRetries,
                error: error.message,
                stack: error.stack
            });
            
            if (this.connectionAttempts < this.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
                this.logger.info(`Retrying database connection in ${delay}ms`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.initialize();
            }
            
            throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error.message}`);
        }
    }

    /**
     * Set up connection pool event handlers
     */
    setupEventHandlers() {
        this.pool.on('connect', (client) => {
            this.metrics.totalConnections++;
            this.logger.debug('New database client connected', {
                totalConnections: this.pool.totalCount,
                idleConnections: this.pool.idleCount,
                waitingConnections: this.pool.waitingCount
            });
        });

        this.pool.on('acquire', (client) => {
            this.logger.debug('Database client acquired from pool');
        });

        this.pool.on('remove', (client) => {
            this.logger.debug('Database client removed from pool');
        });

        this.pool.on('error', (error, client) => {
            this.metrics.connectionErrors++;
            this.logger.error('Database pool error', {
                error: error.message,
                client: client ? 'with client' : 'no client'
            });
            
            // Mark as unhealthy if we get connection errors
            this.isHealthy = false;
        });

        // Handle process termination
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }

    /**
     * Test database connection
     */
    async testConnection() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT NOW() as server_time, version() as server_version');
            this.logger.info('Database connection test successful', {
                serverTime: result.rows[0].server_time,
                serverVersion: result.rows[0].server_version.split(' ')[0]
            });
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    /**
     * Enhanced query method with performance tracking
     */
    async query(text, params = [], options = {}) {
        const startTime = Date.now();
        const queryId = this.generateQueryId(text);
        
        try {
            this.metrics.totalQueries++;
            
            // Log slow queries
            if (options.logQuery || process.env.LOG_ALL_QUERIES === 'true') {
                this.logger.debug('Executing query', {
                    queryId,
                    query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                    params: params?.length || 0
                });
            }
            
            const result = await this.pool.query(text, params);
            const duration = Date.now() - startTime;
            
            // Track query performance
            this.updateQueryStats(queryId, duration, true);
            
            // Log slow queries
            if (duration > this.slowQueryThreshold) {
                this.metrics.slowQueries++;
                this.logger.warn('Slow query detected', {
                    queryId,
                    duration,
                    query: text.substring(0, 200),
                    rowCount: result.rowCount
                });
            }
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.metrics.failedQueries++;
            this.updateQueryStats(queryId, duration, false);
            
            this.logger.error('Query execution failed', {
                queryId,
                duration,
                error: error.message,
                query: text.substring(0, 200),
                params: params?.length || 0
            });
            
            throw error;
        }
    }

    /**
     * Transaction wrapper with automatic rollback
     */
    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const result = await callback(client);
            
            await client.query('COMMIT');
            this.logger.debug('Transaction committed successfully');
            
            return result;
            
        } catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('Transaction rolled back', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Bulk insert with performance optimization
     */
    async bulkInsert(tableName, columns, rows, options = {}) {
        const startTime = Date.now();
        
        try {
            const columnNames = columns.join(', ');
            const placeholders = rows.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            
            const query = `
                INSERT INTO ${tableName} (${columnNames})
                VALUES ${placeholders}
                ${options.onConflict || ''}
                ${options.returning ? `RETURNING ${options.returning}` : ''}
            `;
            
            const values = rows.flat();
            const result = await this.query(query, values);
            
            const duration = Date.now() - startTime;
            this.logger.info('Bulk insert completed', {
                table: tableName,
                rows: rows.length,
                duration,
                insertedRows: result.rowCount
            });
            
            return result;
            
        } catch (error) {
            this.logger.error('Bulk insert failed', {
                table: tableName,
                rows: rows.length,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Health check with detailed diagnostics
     */
    async healthCheck() {
        const checks = {
            database: {
                status: 'checking',
                latency: null,
                connections: {},
                version: null,
                lastError: null
            }
        };
        
        const startTime = Date.now();
        
        try {
            // Test basic connectivity
            const result = await this.testConnection();
            const latency = Date.now() - startTime;
            
            // Get connection pool stats
            const poolStats = {
                total: this.pool.totalCount,
                idle: this.pool.idleCount,
                waiting: this.pool.waitingCount,
                max: this.connectionConfig.max
            };
            
            checks.database = {
                status: 'healthy',
                latency,
                connections: poolStats,
                version: result.server_version,
                serverTime: result.server_time,
                uptime: Date.now() - this.metrics.uptime,
                lastError: null
            };
            
            this.isHealthy = true;
            this.metrics.lastHealthCheck = new Date();
            
        } catch (error) {
            checks.database = {
                status: 'unhealthy',
                latency: Date.now() - startTime,
                connections: this.pool ? {
                    total: this.pool.totalCount,
                    idle: this.pool.idleCount,
                    waiting: this.pool.waitingCount,
                    max: this.connectionConfig.max
                } : null,
                version: null,
                lastError: error.message
            };
            
            this.isHealthy = false;
            this.logger.error('Database health check failed', { error: error.message });
        }
        
        return checks.database;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            pool: this.pool ? {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount,
                maxConnections: this.connectionConfig.max
            } : null,
            topQueries: this.getTopQueries(10),
            isHealthy: this.isHealthy
        };
    }

    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        setInterval(() => {
            if (this.pool) {
                this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
                this.metrics.idleConnections = this.pool.idleCount;
                this.metrics.waitingConnections = this.pool.waitingCount;
            }
        }, 5000); // Update every 5 seconds
    }

    /**
     * Generate query ID for tracking
     */
    generateQueryId(query) {
        return require('crypto')
            .createHash('md5')
            .update(query.replace(/\s+/g, ' ').trim())
            .digest('hex')
            .substring(0, 8);
    }

    /**
     * Update query statistics
     */
    updateQueryStats(queryId, duration, success) {
        if (!this.queryStats.has(queryId)) {
            this.queryStats.set(queryId, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                failures: 0,
                lastExecuted: null
            });
        }
        
        const stats = this.queryStats.get(queryId);
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.lastExecuted = new Date();
        
        if (!success) {
            stats.failures++;
        }
        
        // Update global average
        this.metrics.averageQueryTime = (
            (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) / 
            this.metrics.totalQueries
        );
    }

    /**
     * Get top queries by execution count
     */
    getTopQueries(limit = 10) {
        return Array.from(this.queryStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .map(([queryId, stats]) => ({ queryId, ...stats }));
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown() {
        this.logger.info('Shutting down database connection pool...');
        
        if (this.pool) {
            try {
                await this.pool.end();
                this.logger.info('Database connection pool closed successfully');
            } catch (error) {
                this.logger.error('Error closing database pool', { error: error.message });
            }
        }
    }

    /**
     * Get the pool instance
     */
    getPool() {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        return this.pool;
    }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = {
    DatabaseManager,
    dbManager,
    initializeDatabase: () => dbManager.initialize(),
    query: (text, params, options) => dbManager.query(text, params, options),
    transaction: (callback) => dbManager.transaction(callback),
    bulkInsert: (table, columns, rows, options) => dbManager.bulkInsert(table, columns, rows, options),
    healthCheck: () => dbManager.healthCheck(),
    getMetrics: () => dbManager.getMetrics(),
    getPool: () => dbManager.getPool()
};