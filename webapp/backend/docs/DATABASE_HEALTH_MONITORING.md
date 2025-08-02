# Database & Health Monitoring System

This document describes the comprehensive database configuration and health monitoring system implemented for the electrical estimation API.

## 🗃️ Database Configuration

### Advanced Connection Pooling

The database system uses a sophisticated connection pool with automatic retry logic and performance monitoring:

```javascript
const dbConfig = {
    max: 20,                    // Maximum connections
    min: 2,                     // Minimum connections  
    idleTimeoutMillis: 30000,   // 30 second idle timeout
    connectionTimeoutMillis: 2000, // 2 second connection timeout
    acquireTimeoutMillis: 5000, // 5 seconds to get connection from pool
    ssl: {
        rejectUnauthorized: false // Production should use proper certificates
    }
};
```

### Key Features

#### 1. **Automatic Retry Logic**
- Exponential backoff for connection failures
- Maximum of 5 retry attempts before failing
- Intelligent delay calculation: `Math.min(1000 * Math.pow(2, attempt), 30000)`

#### 2. **Performance Monitoring**
```javascript
// Real-time metrics tracking
{
    totalQueries: 15234,
    failedQueries: 12,
    averageQueryTime: 45.6,
    slowQueries: 8,
    connectionErrors: 2,
    activeConnections: 5,
    idleConnections: 3
}
```

#### 3. **Query Performance Tracking**
- Automatic slow query detection (configurable threshold)
- Query statistics by fingerprint
- Top query analysis by execution count
- Failed query tracking with error details

#### 4. **Transaction Support**
```javascript
// Automatic rollback on errors
await transaction(async (client) => {
    await client.query('INSERT INTO projects...');
    await client.query('INSERT INTO estimations...');
    // Automatically commits on success, rolls back on error
});
```

## 🏥 Health Monitoring System

### Comprehensive Health Checks

The health monitoring system provides detailed insights into all system components:

#### 1. **Server Health**
- Node.js version and platform information
- Memory usage (heap, RSS, external)
- CPU usage statistics
- Process uptime

#### 2. **Database Health**
- Connection latency measurement
- Pool statistics (active, idle, waiting connections)
- Query performance metrics
- Error rate tracking

#### 3. **External Service Health**
- **N8N Integration**: Webhook endpoint availability
- **Monday.com API**: Circuit breaker status and latency
- **Redis Cache**: Connection status and performance
- **External APIs**: RSMeans, electrical codes APIs

#### 4. **System Resources**
- Memory usage (heap and system)
- Storage availability and usage
- File system permissions

### Health Check Endpoints

#### Basic Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "duration": 145,
  "checks": {
    "server": {
      "status": "healthy",
      "duration": 2,
      "details": {
        "nodeVersion": "v18.17.0",
        "platform": "linux",
        "memory": {
          "rss": 125,
          "heapUsed": 89,
          "heapTotal": 120
        }
      }
    },
    "database": {
      "status": "healthy",
      "duration": 23,
      "details": {
        "latency": 23,
        "connections": {
          "total": 8,
          "idle": 5,
          "waiting": 0,
          "max": 20
        },
        "version": "PostgreSQL 14.9"
      }
    },
    "n8n": {
      "status": "healthy",
      "duration": 156,
      "details": {
        "url": "http://n8n:5678",
        "statusCode": 200,
        "latency": 156
      }
    },
    "monday": {
      "status": "healthy",
      "duration": 287,
      "details": {
        "latency": 287,
        "user": "System User",
        "circuitBreaker": {
          "state": "CLOSED",
          "failureCount": 0
        }
      }
    }
  },
  "summary": {
    "total": 8,
    "healthy": 8,
    "degraded": 0,
    "unhealthy": 0
  }
}
```

#### Detailed Health with Trends
```http
GET /health/detailed
```
**Additional fields:**
```json
{
  "trends": {
    "availability": 99.85,
    "averageResponseTime": 156,
    "errorRate": 0.15,
    "trends": "stable"
  },
  "history": [...] // Last 10 health checks
}
```

#### Health History
```http
GET /health/history?limit=50
```

#### Kubernetes Probes
```http
GET /ready   # Readiness probe - checks critical services
GET /live    # Liveness probe - simple server status
```

### Status Codes and Meanings

| Status Code | Health Status | Description |
|-------------|---------------|-------------|
| 200 | `healthy` | All systems operational |
| 206 | `degraded` | Some non-critical issues detected |
| 503 | `unhealthy` | Critical systems failing |

### Health Status Levels

#### **Healthy** ✅
- All services responding within acceptable thresholds
- No critical errors detected
- Resource usage within normal limits

#### **Degraded** ⚠️ 
- Some services experiencing elevated latency
- Non-critical errors detected
- Resource usage approaching limits
- Circuit breakers in HALF_OPEN state

#### **Unhealthy** ❌
- Critical services unavailable
- Database connection failures
- Circuit breakers OPEN
- Resource exhaustion detected

## 📊 Monitoring and Alerting

### Performance Metrics

#### Database Metrics
```javascript
{
    totalConnections: 15,
    activeConnections: 3,
    idleConnections: 12,
    waitingConnections: 0,
    totalQueries: 45231,
    failedQueries: 12,
    averageQueryTime: 67.8,
    slowQueries: 15,
    connectionErrors: 2,
    topQueries: [
        {
            queryId: "a1b2c3d4",
            count: 1250,
            avgTime: 45.6,
            failures: 2
        }
    ]
}
```

#### System Metrics
```javascript
{
    memory: {
        heap: { used: 89, total: 120, usedPercent: 74 },
        system: { total: 8192, free: 2048, usedPercent: 75 }
    },
    storage: {
        uploadDir: "./uploads",
        writable: true,
        diskUsage: {
            total: "100G",
            used: "45G", 
            available: "55G",
            usePercent: 45
        }
    }
}
```

### Alert Thresholds

| Component | Warning | Critical |
|-----------|---------|----------|
| Database Latency | > 1000ms | > 2000ms |
| Memory Usage | > 80% | > 95% |
| Disk Usage | > 80% | > 90% |
| Query Failures | > 5% | > 10% |
| N8N Response | > 3000ms | > 10000ms |
| Monday API | > 5000ms | > 15000ms |

### Historical Analysis

The system maintains health history for trend analysis:

```javascript
{
    availability: 99.85,        // % uptime over last 20 checks
    averageResponseTime: 156,   // Average health check duration
    errorRate: 0.15,           // % of checks with errors
    trends: "improving"        // improving, degrading, stable
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Database Pool Settings
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Performance Monitoring
SLOW_QUERY_THRESHOLD=1000
LOG_ALL_QUERIES=false

# Health Check Timeouts
HEALTH_CHECK_TIMEOUT_DB=5000
HEALTH_CHECK_TIMEOUT_N8N=10000
HEALTH_CHECK_TIMEOUT_MONDAY=15000
```

### SSL Configuration

```bash
# Production SSL Settings
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
DB_SSL_CERT=/path/to/client-cert.pem
```

## 🚀 Usage Examples

### Basic Database Operations
```javascript
// Simple query
const result = await query('SELECT * FROM projects WHERE id = $1', [projectId]);

// Transaction
await transaction(async (client) => {
    const project = await client.query('INSERT INTO projects...');
    const estimation = await client.query('INSERT INTO estimations...');
    return { project, estimation };
});

// Bulk insert
await bulkInsert('components', 
    ['name', 'type', 'cost'], 
    [
        ['Wire', 'material', 2.50],
        ['Outlet', 'device', 15.00]
    ]
);
```

### Health Monitoring Integration
```javascript
// Custom health check
healthMonitor.checks.set('custom_service', async () => {
    try {
        await customService.ping();
        return { status: 'healthy', details: { responsive: true } };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
});

// Get current status
const health = await healthMonitor.runAllChecks();
console.log(`System status: ${health.status}`);
```

## 🛠️ Troubleshooting

### Common Issues

#### Database Connection Problems
```bash
# Check connection string
echo $DATABASE_URL

# Verify SSL settings
psql $DATABASE_URL -c "SELECT version();"

# Check pool status
curl http://localhost:3001/health/detailed
```

#### Performance Issues
```bash
# Enable query logging
export LOG_ALL_QUERIES=true
export SLOW_QUERY_THRESHOLD=500

# Check slow queries
curl http://localhost:3001/health/detailed | jq '.checks.database.details.metrics'
```

#### Health Check Failures
```bash
# Check individual services
curl http://localhost:3001/health/detailed

# View health history
curl http://localhost:3001/health/history?limit=10

# Check specific component
curl http://localhost:3001/health | jq '.checks.database'
```

This comprehensive system provides production-grade database management and health monitoring with detailed observability into all system components.