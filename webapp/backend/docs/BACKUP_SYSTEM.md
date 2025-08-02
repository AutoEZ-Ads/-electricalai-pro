# Comprehensive Backup System

This document describes the enterprise-grade backup system implemented for the electrical estimation API, providing data protection, disaster recovery, and compliance capabilities.

## 🔒 System Overview

The backup system provides multi-layered data protection with:
- **Multiple Storage Locations**: Database, local filesystem, AWS S3, Google Cloud Storage
- **Data Integrity**: SHA-256 checksums and validation
- **Compression & Encryption**: Optional data compression and AES-256 encryption
- **Automated Scheduling**: Cron-based scheduled backups
- **Recovery & Restoration**: Complete recovery capabilities

## 📊 Backup Types

### 1. **Estimation Backups**
Complete backup of estimation data including:
- Estimation records and metadata
- Related project information
- Component calculations
- Calculation history
- Associated blueprints

### 2. **Project Backups**
Comprehensive project data including:
- Project details and metadata
- All related estimations
- Blueprint files and analysis
- Component data

### 3. **Blueprint Backups**
Individual blueprint backups containing:
- Blueprint file data
- Analysis results
- Processing history
- Metadata and annotations

### 4. **Full System Backups**
Complete system state including:
- All projects (up to 1000 recent)
- All estimations (up to 5000 recent)
- All blueprints (up to 2000 recent)
- Component library (up to 10000)
- User data (non-sensitive fields)

## 🏗️ Architecture

### Core Components

#### **BackupManager** (`services/backup-manager.js`)
- Data extraction and processing
- Multi-storage coordination
- Encryption and compression
- Integrity validation

#### **BackupScheduler** (`services/backup-scheduler.js`)
- Automated backup scheduling
- Queue management
- Failure handling and retries
- Performance monitoring

#### **Storage Adapters**
- **Database Storage**: PostgreSQL BYTEA columns
- **Local Storage**: Filesystem with organized directory structure
- **AWS S3**: Cloud object storage with metadata
- **Google Cloud Storage**: Alternative cloud storage

### Database Schema

```sql
-- Main backup storage
CREATE TABLE estimation_backups (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    backup_data BYTEA NOT NULL,
    metadata JSONB DEFAULT '{}',
    integrity_hash VARCHAR(64) NOT NULL,
    compressed BOOLEAN DEFAULT FALSE,
    encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Operation tracking
CREATE TABLE backup_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) REFERENCES estimation_backups(id),
    operation_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    storage_results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled backups
CREATE TABLE backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_name VARCHAR(100) NOT NULL UNIQUE,
    backup_type VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    retention_days INTEGER DEFAULT 30
);
```

## 🚀 API Endpoints

### Create Backups

#### Create Estimation Backup
```http
POST /api/backups/estimation/:estimationId
Content-Type: application/json

{
  "reason": "Pre-processing safety backup",
  "source": "manual",
  "version": "1.0"
}
```

#### Create Project Backup
```http
POST /api/backups/project/:projectId
Content-Type: application/json

{
  "reason": "Project milestone backup",
  "source": "manual"
}
```

#### Create System Backup
```http
POST /api/backups/system
Content-Type: application/json

{
  "reason": "Monthly system backup",
  "source": "scheduled"
}
```

### Manage Backups

#### List Backups
```http
GET /api/backups?type=estimation&limit=20&offset=0
```

#### Get Backup Details
```http
GET /api/backups/:backupId
```

#### Download Backup
```http
GET /api/backups/:backupId/download?format=json
```

#### Restore Backup
```http
POST /api/backups/:backupId/restore
Content-Type: application/json

{
  "recovery_type": "full_restore",
  "target_entity_id": "new-estimation-id",
  "options": {
    "preserve_ids": false,
    "update_references": true
  }
}
```

#### Verify Backup Integrity
```http
POST /api/backups/:backupId/verify
```

#### Delete Backup
```http
DELETE /api/backups/:backupId
Content-Type: application/json

{
  "confirm": true,
  "reason": "Data retention policy"
}
```

### Statistics and Monitoring

#### Backup Statistics
```http
GET /api/backups/stats
```

**Response:**
```json
{
  "summary": {
    "total_backups": 1250,
    "total_size": 5368709120,
    "avg_size": 4294967,
    "compressed_count": 875,
    "encrypted_count": 312,
    "expired_count": 45
  },
  "byType": [
    {
      "type": "estimation",
      "source": "scheduled",
      "backup_count": 450,
      "avg_size": 2097152,
      "total_size": 943718400
    }
  ],
  "health": {
    "total": 1250,
    "healthy": 1205,
    "warning": 35,
    "critical": 10,
    "avg_health_score": 87.5
  }
}
```

## ⚙️ Configuration

### Environment Variables

```bash
# Backup System Configuration
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION=true
BACKUP_ENCRYPTION_KEY=your-32-character-encryption-key
MAX_LOCAL_BACKUPS=50
MAX_BACKUP_AGE_DAYS=30
MAX_CONCURRENT_BACKUPS=3

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BACKUP_BUCKET=electrical-estimation-backups

# Google Cloud Storage Configuration
GCS_KEY_FILE=/path/to/service-account-key.json
GCS_PROJECT_ID=your-gcs-project-id
GCS_BACKUP_BUCKET=electrical-estimation-backups-gcs
```

### Backup Schedules

Default scheduled backups:

```sql
-- Daily estimation backups at 2 AM
INSERT INTO backup_schedules VALUES (
    'daily_estimations', 'estimation', '0 2 * * *', 90,
    '{"database": true, "s3": true}'
);

-- Weekly project backups at 3 AM on Sundays
INSERT INTO backup_schedules VALUES (
    'weekly_projects', 'project', '0 3 * * 0', 365,
    '{"database": true, "s3": true, "local": true}'
);

-- Monthly full system backups at 4 AM on the 1st
INSERT INTO backup_schedules VALUES (
    'monthly_full_system', 'full_system', '0 4 1 * *', 180,
    '{"s3": true, "gcs": true}'
);
```

## 🔄 Usage Examples

### Programmatic Backup Creation

```javascript
const { backupManager } = require('./services/backup-manager');

// Backup estimation before processing
const backupEstimationData = async (estimationId) => {
  const backup = {
    timestamp: new Date().toISOString(),
    estimationId,
    version: '1.0'
  };
  
  try {
    // Create backup with multiple storage
    const result = await backupManager.backupEstimationData(estimationId, {
      reason: 'Pre-processing safety backup',
      source: 'pre_processing',
      version: '1.0'
    });
    
    console.log('Backup created:', result.backupId);
    
    // Store backup reference in database
    await query(
      'INSERT INTO estimation_backups_ref (estimation_id, backup_id) VALUES ($1, $2)',
      [estimationId, result.backupId]
    );
    
    return result;
    
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
};

// Usage in estimation processing
app.post('/api/estimations/:id/process', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Create safety backup before processing
    const backup = await backupEstimationData(id);
    
    // Proceed with estimation processing
    const result = await processEstimation(id);
    
    res.json({
      success: true,
      result,
      backup: {
        id: backup.backupId,
        timestamp: backup.timestamp
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Recovery Operations

```javascript
// Restore from backup
const restoreEstimation = async (backupId, targetId) => {
  try {
    const result = await backupManager.restoreBackup(backupId, {
      recoveryType: 'full_restore',
      targetEntityId: targetId,
      options: {
        preserveIds: false,
        updateReferences: true
      }
    });
    
    console.log('Restoration completed:', result);
    return result;
    
  } catch (error) {
    console.error('Restoration failed:', error);
    throw error;
  }
};
```

## 📈 Monitoring and Alerting

### Health Monitoring

The backup system provides comprehensive health monitoring:

```javascript
// Check backup system health
const healthStatus = await backupManager.getHealthStatus();

console.log('Backup System Health:', {
  totalBackups: healthStatus.totalBackups,
  healthyBackups: healthStatus.healthyBackups,
  failedBackups: healthStatus.failedBackups,
  storageUtilization: healthStatus.storageUtilization,
  lastBackupTime: healthStatus.lastBackupTime
});
```

### Performance Metrics

- **Backup Success Rate**: Percentage of successful backups
- **Average Backup Time**: Time taken for backup operations
- **Storage Efficiency**: Compression ratios and storage usage
- **Recovery Time Objective (RTO)**: Target time for data recovery
- **Recovery Point Objective (RPO)**: Maximum acceptable data loss

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Backup Failure Rate | > 5% | > 10% |
| Backup Age | > 24 hours | > 48 hours |
| Storage Usage | > 80% | > 95% |
| Integrity Failures | > 1% | > 5% |

## 🛡️ Security Features

### Data Protection
- **Encryption at Rest**: AES-256 encryption for sensitive backups
- **Encryption in Transit**: HTTPS/TLS for cloud storage uploads
- **Access Control**: Role-based access to backup operations
- **Audit Logging**: Complete audit trail of all backup operations

### Compliance
- **Data Retention**: Configurable retention policies
- **Geographic Replication**: Multi-region backup storage
- **Compliance Reporting**: Automated compliance reports
- **Data Anonymization**: Options for sensitive data handling

## 🔧 Troubleshooting

### Common Issues

#### Backup Creation Failures
```bash
# Check backup manager logs
tail -f logs/backup.log

# Verify storage connectivity
curl -X POST /api/backups/system/test-connectivity

# Check disk space
df -h ./backups
```

#### Storage Issues
```bash
# Test S3 connectivity
aws s3 ls s3://your-backup-bucket --profile backup-user

# Test GCS connectivity
gsutil ls gs://your-gcs-backup-bucket

# Check local storage permissions
ls -la ./backups
```

#### Recovery Problems
```bash
# Verify backup integrity
curl -X POST /api/backups/:backupId/verify

# Check recovery logs
tail -f logs/backup-scheduler.log

# List available backups
curl /api/backups?type=estimation&limit=10
```

### Performance Optimization

#### Large Backup Optimization
- Enable compression for large datasets
- Use incremental backups for frequently changing data
- Implement parallel backup processing
- Optimize storage transfer with multipart uploads

#### Storage Cost Optimization
- Implement lifecycle policies for cloud storage
- Use storage class transitions (Standard → IA → Glacier)
- Regular cleanup of expired backups
- Deduplication for similar backup content

## 📋 Best Practices

### Backup Strategy
1. **3-2-1 Rule**: 3 copies of data, 2 different media types, 1 offsite
2. **Regular Testing**: Monthly backup restoration tests
3. **Monitoring**: Continuous monitoring of backup health
4. **Documentation**: Maintain recovery procedures documentation

### Security Practices
1. **Encryption**: Always encrypt sensitive data backups
2. **Access Control**: Limit backup access to authorized personnel
3. **Key Management**: Secure encryption key storage and rotation
4. **Audit Trails**: Maintain complete audit logs

### Performance Practices
1. **Scheduling**: Schedule backups during low-traffic periods
2. **Compression**: Enable compression for storage efficiency
3. **Parallel Processing**: Use concurrent backup operations
4. **Monitoring**: Track backup performance metrics

This comprehensive backup system ensures data protection, regulatory compliance, and business continuity for the electrical estimation platform.