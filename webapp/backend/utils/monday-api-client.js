const axios = require('axios');
const winston = require('winston');

class MondayApiClient {
    constructor(options = {}) {
        this.baseUrl = 'https://api.monday.com/v2';
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds
        this.jitterFactor = options.jitterFactor || 0.1;
        this.logger = options.logger || winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            transports: [new winston.transports.Console()]
        });
        
        // Circuit breaker state
        this.circuitBreaker = {
            failureCount: 0,
            lastFailureTime: null,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failureThreshold: options.failureThreshold || 5,
            recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
            successThreshold: options.successThreshold || 2 // consecutive successes to close circuit
        };
        
        this.consecutiveSuccesses = 0;
    }

    /**
     * Exponential backoff with jitter
     * @param {number} attempt - Current attempt number (0-based)
     * @returns {number} Delay in milliseconds
     */
    calculateDelay(attempt) {
        const exponentialDelay = Math.min(
            this.baseDelay * Math.pow(2, attempt),
            this.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = exponentialDelay * this.jitterFactor * Math.random();
        return Math.floor(exponentialDelay + jitter);
    }

    /**
     * Check if circuit breaker allows the request
     * @returns {boolean}
     */
    canMakeRequest() {
        const now = Date.now();
        
        switch (this.circuitBreaker.state) {
            case 'CLOSED':
                return true;
                
            case 'OPEN':
                if (now - this.circuitBreaker.lastFailureTime >= this.circuitBreaker.recoveryTimeout) {
                    this.circuitBreaker.state = 'HALF_OPEN';
                    this.logger.info('Circuit breaker moving to HALF_OPEN state');
                    return true;
                }
                return false;
                
            case 'HALF_OPEN':
                return true;
                
            default:
                return true;
        }
    }

    /**
     * Record successful API call
     */
    recordSuccess() {
        this.circuitBreaker.failureCount = 0;
        this.consecutiveSuccesses++;
        
        if (this.circuitBreaker.state === 'HALF_OPEN' && 
            this.consecutiveSuccesses >= this.circuitBreaker.successThreshold) {
            this.circuitBreaker.state = 'CLOSED';
            this.consecutiveSuccesses = 0;
            this.logger.info('Circuit breaker closed after successful recovery');
        }
    }

    /**
     * Record failed API call
     */
    recordFailure() {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();
        this.consecutiveSuccesses = 0;
        
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
            this.circuitBreaker.state = 'OPEN';
            this.logger.warn(`Circuit breaker opened after ${this.circuitBreaker.failureCount} failures`);
        }
    }

    /**
     * Determine if error is retryable
     * @param {Error} error
     * @returns {boolean}
     */
    isRetryableError(error) {
        if (!error.response) {
            // Network errors are retryable
            return true;
        }
        
        const status = error.response.status;
        
        // Retry on server errors and rate limiting
        if (status >= 500 || status === 429) {
            return true;
        }
        
        // Don't retry on client errors (400-499, except 429)
        if (status >= 400 && status < 500) {
            return false;
        }
        
        return true;
    }

    /**
     * Enhanced Monday API call with exponential backoff and circuit breaker
     * @param {string} query - GraphQL query
     * @param {Object} variables - GraphQL variables
     * @param {string} accessToken - Monday.com access token
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} API response
     */
    async apiCall(query, variables = {}, accessToken, options = {}) {
        const retries = options.retries ?? this.maxRetries;
        const requestId = options.requestId || Math.random().toString(36).substring(7);
        
        // Check circuit breaker
        if (!this.canMakeRequest()) {
            const error = new Error('Circuit breaker is OPEN - Monday.com API temporarily unavailable');
            error.statusCode = 503;
            error.code = 'CIRCUIT_BREAKER_OPEN';
            throw error;
        }

        let lastError;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                this.logger.info(`Monday API call attempt ${attempt + 1}/${retries + 1}`, {
                    requestId,
                    query: query.substring(0, 100) + '...',
                    circuitState: this.circuitBreaker.state
                });

                const response = await axios.post(this.baseUrl, {
                    query,
                    variables
                }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'ElectricalEstimation/1.0'
                    },
                    timeout: options.timeout || 30000
                });

                // Check for GraphQL errors
                if (response.data.errors && response.data.errors.length > 0) {
                    const graphqlError = new Error(`Monday GraphQL Error: ${response.data.errors[0].message}`);
                    graphqlError.statusCode = 400;
                    graphqlError.graphqlErrors = response.data.errors;
                    
                    // Don't retry GraphQL errors
                    this.recordFailure();
                    throw graphqlError;
                }

                this.recordSuccess();
                
                this.logger.info(`Monday API call successful`, {
                    requestId,
                    attempt: attempt + 1,
                    responseSize: JSON.stringify(response.data).length
                });

                return response.data;
                
            } catch (error) {
                lastError = error;
                
                this.logger.warn(`Monday API call failed`, {
                    requestId,
                    attempt: attempt + 1,
                    error: error.message,
                    status: error.response?.status,
                    retryable: this.isRetryableError(error)
                });

                // If this is the last attempt or error is not retryable, throw
                if (attempt === retries || !this.isRetryableError(error)) {
                    this.recordFailure();
                    break;
                }

                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempt);
                
                this.logger.info(`Retrying Monday API call in ${delay}ms`, {
                    requestId,
                    nextAttempt: attempt + 2,
                    delay
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // If we get here, all retries failed
        this.recordFailure();
        
        // Enhance error with retry information
        lastError.retriesExhausted = true;
        lastError.totalAttempts = retries + 1;
        lastError.requestId = requestId;
        
        throw lastError;
    }

    /**
     * Convenience method for common Monday.com queries
     */
    async getBoards(accessToken, options = {}) {
        const query = `
            query GetBoards($limit: Int) {
                boards(limit: $limit) {
                    id
                    name
                    description
                    state
                    board_folder_id
                    board_kind
                    created_at
                    updated_at
                }
            }
        `;
        
        return this.apiCall(query, { limit: options.limit || 50 }, accessToken, options);
    }

    async getBoard(boardId, accessToken, options = {}) {
        const query = `
            query GetBoard($boardId: [Int!]!) {
                boards(ids: $boardId) {
                    id
                    name
                    description
                    state
                    items {
                        id
                        name
                        column_values {
                            id
                            text
                            value
                        }
                    }
                    columns {
                        id
                        title
                        type
                        settings_str
                    }
                }
            }
        `;
        
        return this.apiCall(query, { boardId: [parseInt(boardId)] }, accessToken, options);
    }

    async createItem(boardId, itemName, columnValues, accessToken, options = {}) {
        const query = `
            mutation CreateItem($boardId: Int!, $itemName: String!, $columnValues: JSON) {
                create_item(
                    board_id: $boardId,
                    item_name: $itemName,
                    column_values: $columnValues
                ) {
                    id
                    name
                    created_at
                }
            }
        `;
        
        return this.apiCall(query, {
            boardId: parseInt(boardId),
            itemName,
            columnValues: JSON.stringify(columnValues)
        }, accessToken, options);
    }

    async updateItem(itemId, columnValues, accessToken, options = {}) {
        const query = `
            mutation UpdateItem($itemId: Int!, $columnValues: JSON) {
                change_multiple_column_values(
                    item_id: $itemId,
                    column_values: $columnValues
                ) {
                    id
                    name
                    updated_at
                }
            }
        `;
        
        return this.apiCall(query, {
            itemId: parseInt(itemId),
            columnValues: JSON.stringify(columnValues)
        }, accessToken, options);
    }

    /**
     * Health check method
     */
    async healthCheck(accessToken) {
        try {
            const query = `query { me { id name email } }`;
            await this.apiCall(query, {}, accessToken, { retries: 1, timeout: 5000 });
            return {
                status: 'healthy',
                circuitState: this.circuitBreaker.state,
                failureCount: this.circuitBreaker.failureCount
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                circuitState: this.circuitBreaker.state,
                failureCount: this.circuitBreaker.failureCount
            };
        }
    }

    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        return {
            state: this.circuitBreaker.state,
            failureCount: this.circuitBreaker.failureCount,
            lastFailureTime: this.circuitBreaker.lastFailureTime,
            consecutiveSuccesses: this.consecutiveSuccesses,
            canMakeRequest: this.canMakeRequest()
        };
    }

    /**
     * Manually reset circuit breaker (for admin/testing)
     */
    resetCircuitBreaker() {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.lastFailureTime = null;
        this.consecutiveSuccesses = 0;
        this.logger.info('Circuit breaker manually reset');
    }
}

// Create singleton instance with default configuration
const defaultMondayClient = new MondayApiClient({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.1,
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 2
});

module.exports = {
    MondayApiClient,
    defaultMondayClient
};