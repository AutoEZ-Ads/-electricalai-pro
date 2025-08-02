const axios = require('axios');
const { dbManager } = require('../config/database');
const { defaultMondayClient } = require('../utils/monday-api-client');
const winston = require('winston');

class HealthMonitor {
    constructor(options = {}) {
        this.logger = options.logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/health.log' })
            ]
        });

        this.checks = new Map();
        this.healthHistory = [];
        this.maxHistoryLength = 100;
        this.alertThresholds = {
            database: { timeout: 5000, criticalLatency: 2000 },
            n8n: { timeout: 10000, criticalLatency: 3000 },
            monday: { timeout: 15000, criticalLatency: 5000 },
            redis: { timeout: 3000, criticalLatency: 1000 },
            storage: { timeout: 2000, criticalUsagePercent: 90 }
        };

        // Register health checks
        this.registerHealthChecks();
    }

    /**
     * Register all health check functions
     */
    registerHealthChecks() {
        this.checks.set('server', this.checkServer.bind(this));
        this.checks.set('database', this.checkDatabase.bind(this));
        this.checks.set('n8n', this.checkN8N.bind(this));
        this.checks.set('monday', this.checkMondayAPI.bind(this));
        this.checks.set('redis', this.checkRedis.bind(this));
        this.checks.set('storage', this.checkStorage.bind(this));
        this.checks.set('memory', this.checkMemory.bind(this));
        this.checks.set('external_apis', this.checkExternalAPIs.bind(this));
    }

    /**
     * Run all health checks
     */
    async runAllChecks() {
        const startTime = Date.now();
        const results = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            checks: {},
            summary: {
                total: 0,
                healthy: 0,
                degraded: 0,
                unhealthy: 0
            }
        };

        const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
            try {
                const checkResult = await this.runSingleCheck(name, checkFn);
                results.checks[name] = checkResult;
                results.summary.total++;

                switch (checkResult.status) {
                    case 'healthy':
                        results.summary.healthy++;
                        break;
                    case 'degraded':
                        results.summary.degraded++;
                        break;
                    case 'unhealthy':
                        results.summary.unhealthy++;
                        if (results.status === 'healthy') results.status = 'degraded';
                        break;
                }
            } catch (error) {
                results.checks[name] = {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                results.summary.total++;
                results.summary.unhealthy++;
                results.status = 'unhealthy';
            }
        });

        await Promise.all(checkPromises);

        // Determine overall status
        if (results.summary.unhealthy > 0) {
            results.status = results.summary.unhealthy > results.summary.healthy ? 'unhealthy' : 'degraded';
        }

        results.duration = Date.now() - startTime;
        
        // Store in history
        this.addToHistory(results);
        
        // Log health status
        this.logHealthStatus(results);

        return results;
    }

    /**
     * Run a single health check with timeout
     */
    async runSingleCheck(name, checkFn) {
        const startTime = Date.now();
        const timeout = this.alertThresholds[name]?.timeout || 10000;

        try {
            const result = await Promise.race([
                checkFn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), timeout)
                )
            ]);

            const duration = Date.now() - startTime;
            
            return {
                ...result,
                duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check server health
     */
    async checkServer() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            status: 'healthy',
            details: {
                nodeVersion: process.version,
                platform: process.platform,
                uptime: process.uptime(),
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memUsage.external / 1024 / 1024)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            }
        };
    }

    /**
     * Check database health
     */
    async checkDatabase() {
        try {
            const healthResult = await dbManager.healthCheck();
            const metrics = dbManager.getMetrics();
            
            let status = 'healthy';
            if (healthResult.latency > this.alertThresholds.database.criticalLatency) {
                status = 'degraded';
            }
            if (!healthResult.status === 'healthy') {
                status = 'unhealthy';
            }

            return {
                status,
                details: {
                    ...healthResult,
                    metrics: {
                        totalQueries: metrics.totalQueries,
                        failedQueries: metrics.failedQueries,
                        averageQueryTime: Math.round(metrics.averageQueryTime),
                        slowQueries: metrics.slowQueries,
                        connectionErrors: metrics.connectionErrors
                    }
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Check N8N health
     */
    async checkN8N() {
        const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
        
        try {
            const startTime = Date.now();
            const response = await axios.get(`${n8nUrl}/healthz`, {
                timeout: this.alertThresholds.n8n.timeout,
                validateStatus: (status) => status < 500
            });
            
            const latency = Date.now() - startTime;
            let status = 'healthy';
            
            if (response.status !== 200) {
                status = 'degraded';
            }
            if (latency > this.alertThresholds.n8n.criticalLatency) {
                status = 'degraded';
            }

            return {
                status,
                details: {
                    url: n8nUrl,
                    statusCode: response.status,
                    latency,
                    version: response.data?.version || 'unknown'
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                details: {
                    url: n8nUrl
                }
            };
        }
    }

    /**
     * Check Monday.com API health
     */
    async checkMondayAPI() {
        if (!process.env.MONDAY_SYSTEM_TOKEN) {
            return {
                status: 'degraded',
                error: 'Monday.com token not configured'
            };
        }

        try {
            const startTime = Date.now();
            
            const result = await defaultMondayClient.apiCall(
                'query { me { id name } }',
                {},
                process.env.MONDAY_SYSTEM_TOKEN,
                { timeout: this.alertThresholds.monday.timeout }
            );
            
            const latency = Date.now() - startTime;
            const circuitBreakerStatus = defaultMondayClient.getCircuitBreakerStatus();
            
            let status = 'healthy';
            if (circuitBreakerStatus.state !== 'CLOSED') {
                status = 'degraded';
            }
            if (latency > this.alertThresholds.monday.criticalLatency) {
                status = 'degraded';
            }

            return {
                status,
                details: {
                    latency,
                    user: result.data?.me?.name || 'Unknown',
                    circuitBreaker: {
                        state: circuitBreakerStatus.state,
                        failureCount: circuitBreakerStatus.failureCount
                    }
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                details: {
                    circuitBreaker: defaultMondayClient.getCircuitBreakerStatus()
                }
            };
        }
    }

    /**
     * Check Redis health
     */
    async checkRedis() {
        if (!process.env.REDIS_URL) {
            return {
                status: 'degraded',
                error: 'Redis not configured'
            };
        }

        try {
            const Redis = require('redis');
            const client = Redis.createClient({ url: process.env.REDIS_URL });
            
            const startTime = Date.now();
            await client.connect();
            await client.ping();
            const latency = Date.now() - startTime;
            
            const info = await client.info();
            await client.quit();
            
            let status = 'healthy';
            if (latency > this.alertThresholds.redis.criticalLatency) {
                status = 'degraded';
            }

            return {
                status,
                details: {
                    latency,
                    connected: true,
                    info: this.parseRedisInfo(info)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Check storage health
     */
    async checkStorage() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const uploadDir = './uploads';
            const tempDir = './uploads/temp';
            
            // Check if directories exist and are writable
            await fs.access(uploadDir, fs.constants.W_OK);
            await fs.access(tempDir, fs.constants.W_OK);
            
            // Get disk usage if available
            let diskUsage = null;
            try {
                const { execSync } = require('child_process');
                const output = execSync('df -h .', { encoding: 'utf8' });
                const lines = output.split('\n');
                if (lines.length > 1) {
                    const parts = lines[1].split(/\s+/);
                    diskUsage = {
                        total: parts[1],
                        used: parts[2],
                        available: parts[3],
                        usePercent: parseInt(parts[4])
                    };
                }
            } catch (error) {
                // Disk usage check failed, but storage is still accessible
            }

            let status = 'healthy';
            if (diskUsage && diskUsage.usePercent > this.alertThresholds.storage.criticalUsagePercent) {
                status = 'degraded';
            }

            return {
                status,
                details: {
                    uploadDir,
                    writable: true,
                    diskUsage
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Check memory usage
     */
    async checkMemory() {
        const memUsage = process.memoryUsage();
        const totalMem = require('os').totalmem();
        const freeMem = require('os').freemem();
        
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        const systemMemUsedPercent = ((totalMem - freeMem) / totalMem) * 100;
        
        let status = 'healthy';
        if (heapUsedPercent > 90 || systemMemUsedPercent > 95) {
            status = 'degraded';
        }
        if (heapUsedPercent > 95 || systemMemUsedPercent > 98) {
            status = 'unhealthy';
        }

        return {
            status,
            details: {
                heap: {
                    used: Math.round(memUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memUsage.heapTotal / 1024 / 1024),
                    usedPercent: Math.round(heapUsedPercent)
                },
                system: {
                    total: Math.round(totalMem / 1024 / 1024),
                    free: Math.round(freeMem / 1024 / 1024),
                    usedPercent: Math.round(systemMemUsedPercent)
                },
                rss: Math.round(memUsage.rss / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            }
        };
    }

    /**
     * Check external APIs
     */
    async checkExternalAPIs() {
        const apis = [
            { name: 'RSMeans API', url: process.env.RSMEANS_API_URL },
            { name: 'Electrical Codes API', url: process.env.CODES_API_URL }
        ];

        const results = [];
        
        for (const api of apis) {
            if (!api.url) {
                results.push({
                    name: api.name,
                    status: 'not_configured',
                    error: 'API URL not configured'
                });
                continue;
            }

            try {
                const startTime = Date.now();
                const response = await axios.get(api.url, { timeout: 5000 });
                const latency = Date.now() - startTime;
                
                results.push({
                    name: api.name,
                    status: response.status === 200 ? 'healthy' : 'degraded',
                    latency,
                    statusCode: response.status
                });
            } catch (error) {
                results.push({
                    name: api.name,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        }

        const overallStatus = results.some(r => r.status === 'unhealthy') ? 'degraded' : 'healthy';

        return {
            status: overallStatus,
            details: results
        };
    }

    /**
     * Parse Redis info string
     */
    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const parsed = {};
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (key === 'redis_version' || key === 'connected_clients' || key === 'used_memory_human') {
                    parsed[key] = value;
                }
            }
        }
        
        return parsed;
    }

    /**
     * Add result to history
     */
    addToHistory(result) {
        this.healthHistory.push({
            timestamp: result.timestamp,
            status: result.status,
            duration: result.duration,
            summary: result.summary
        });

        // Keep only recent history
        if (this.healthHistory.length > this.maxHistoryLength) {
            this.healthHistory = this.healthHistory.slice(-this.maxHistoryLength);
        }
    }

    /**
     * Log health status
     */
    logHealthStatus(result) {
        const logLevel = result.status === 'healthy' ? 'info' : 
                        result.status === 'degraded' ? 'warn' : 'error';
        
        this.logger[logLevel]('Health check completed', {
            status: result.status,
            duration: result.duration,
            healthy: result.summary.healthy,
            degraded: result.summary.degraded,
            unhealthy: result.summary.unhealthy
        });
    }

    /**
     * Get health history
     */
    getHistory() {
        return this.healthHistory;
    }

    /**
     * Get health trends
     */
    getHealthTrends() {
        const recentChecks = this.healthHistory.slice(-20); // Last 20 checks
        
        return {
            availability: this.calculateAvailability(recentChecks),
            averageResponseTime: this.calculateAverageResponseTime(recentChecks),
            errorRate: this.calculateErrorRate(recentChecks),
            trends: this.calculateTrends(recentChecks)
        };
    }

    /**
     * Calculate system availability percentage
     */
    calculateAvailability(checks) {
        if (checks.length === 0) return 100;
        
        const healthyChecks = checks.filter(c => c.status === 'healthy').length;
        return Math.round((healthyChecks / checks.length) * 100 * 100) / 100;
    }

    /**
     * Calculate average response time
     */
    calculateAverageResponseTime(checks) {
        if (checks.length === 0) return 0;
        
        const totalTime = checks.reduce((sum, check) => sum + check.duration, 0);
        return Math.round(totalTime / checks.length);
    }

    /**
     * Calculate error rate
     */
    calculateErrorRate(checks) {
        if (checks.length === 0) return 0;
        
        const errorChecks = checks.filter(c => c.status === 'unhealthy').length;
        return Math.round((errorChecks / checks.length) * 100 * 100) / 100;
    }

    /**
     * Calculate health trends
     */
    calculateTrends(checks) {
        if (checks.length < 2) return 'stable';
        
        const recent = checks.slice(-5);
        const healthyCount = recent.filter(c => c.status === 'healthy').length;
        const previousHealthyCount = checks.slice(-10, -5).filter(c => c.status === 'healthy').length;
        
        if (healthyCount > previousHealthyCount) return 'improving';
        if (healthyCount < previousHealthyCount) return 'degrading';
        return 'stable';
    }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

module.exports = {
    HealthMonitor,
    healthMonitor
};