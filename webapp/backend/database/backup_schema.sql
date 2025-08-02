-- Backup system schema for electrical estimation system

-- Main backup storage table
CREATE TABLE IF NOT EXISTS estimation_backups (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('estimation', 'project', 'blueprint', 'component', 'calculation', 'full_system')),
    entity_id VARCHAR(255) NOT NULL,
    
    -- Backup data storage
    backup_data BYTEA NOT NULL,  -- Can store compressed/encrypted data
    metadata JSONB DEFAULT '{}',
    
    -- Data integrity
    integrity_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash
    compressed BOOLEAN DEFAULT FALSE,
    encrypted BOOLEAN DEFAULT FALSE,
    
    -- Version and source tracking
    version VARCHAR(20) DEFAULT '1.0',
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'scheduled', 'pre_processing', 'emergency')),
    
    -- Storage locations
    storage_locations JSONB DEFAULT '{}',  -- Track where backup is stored
    
    -- Size and record tracking
    data_size BIGINT,
    record_count INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_estimation_backups_type ON estimation_backups(type);
CREATE INDEX idx_estimation_backups_entity_id ON estimation_backups(entity_id);
CREATE INDEX idx_estimation_backups_created_at ON estimation_backups(created_at DESC);
CREATE INDEX idx_estimation_backups_expires_at ON estimation_backups(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_estimation_backups_source ON estimation_backups(source);

-- GIN index for metadata searches
CREATE INDEX idx_estimation_backups_metadata ON estimation_backups USING GIN (metadata);

-- Backup operations log
CREATE TABLE IF NOT EXISTS backup_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) REFERENCES estimation_backups(id) ON DELETE CASCADE,
    
    -- Operation details
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('create', 'restore', 'delete', 'verify')),
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    
    -- Results and metadata
    storage_results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    
    -- Performance tracking
    duration_ms INTEGER,
    data_size BIGINT,
    
    -- User tracking
    initiated_by VARCHAR(255),  -- User ID or system
    ip_address INET,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for backup operations
CREATE INDEX idx_backup_operations_backup_id ON backup_operations(backup_id);
CREATE INDEX idx_backup_operations_operation_type ON backup_operations(operation_type);
CREATE INDEX idx_backup_operations_entity_type ON backup_operations(entity_type);
CREATE INDEX idx_backup_operations_created_at ON backup_operations(created_at DESC);
CREATE INDEX idx_backup_operations_status ON backup_operations(status);

-- Backup schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Schedule configuration
    schedule_name VARCHAR(100) NOT NULL UNIQUE,
    backup_type VARCHAR(50) NOT NULL,
    entity_filter JSONB DEFAULT '{}',  -- Criteria for what to backup
    
    -- Schedule timing
    cron_expression VARCHAR(50) NOT NULL,  -- Cron format: "0 2 * * *" for daily at 2 AM
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Backup configuration
    retention_days INTEGER DEFAULT 30,
    storage_options JSONB DEFAULT '{}',  -- Which storage locations to use
    compression_enabled BOOLEAN DEFAULT TRUE,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    max_failures INTEGER DEFAULT 3,
    
    -- Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for backup schedules
CREATE INDEX idx_backup_schedules_enabled ON backup_schedules(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(next_run_at) WHERE enabled = TRUE;
CREATE INDEX idx_backup_schedules_backup_type ON backup_schedules(backup_type);

-- Backup recovery logs
CREATE TABLE IF NOT EXISTS backup_recoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) REFERENCES estimation_backups(id) ON DELETE SET NULL,
    
    -- Recovery details
    recovery_type VARCHAR(50) NOT NULL CHECK (recovery_type IN ('full_restore', 'partial_restore', 'data_export', 'validation')),
    target_entity_id VARCHAR(255),
    
    -- Recovery configuration
    recovery_options JSONB DEFAULT '{}',
    data_mapping JSONB DEFAULT '{}',  -- How to map restored data
    
    -- Status and results
    status VARCHAR(20) DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'cancelled')),
    records_recovered INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',
    
    -- Performance tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- User tracking
    initiated_by VARCHAR(255),
    ip_address INET,
    
    -- Verification
    integrity_verified BOOLEAN DEFAULT FALSE,
    verification_details JSONB DEFAULT '{}'
);

-- Indexes for backup recoveries
CREATE INDEX idx_backup_recoveries_backup_id ON backup_recoveries(backup_id);
CREATE INDEX idx_backup_recoveries_status ON backup_recoveries(status);
CREATE INDEX idx_backup_recoveries_started_at ON backup_recoveries(started_at DESC);
CREATE INDEX idx_backup_recoveries_initiated_by ON backup_recoveries(initiated_by);

-- Storage location tracking
CREATE TABLE IF NOT EXISTS backup_storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) REFERENCES estimation_backups(id) ON DELETE CASCADE,
    
    -- Storage details
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('database', 'local', 's3', 'gcs', 'azure')),
    storage_path TEXT NOT NULL,
    storage_size BIGINT,
    
    -- Storage metadata
    storage_metadata JSONB DEFAULT '{}',
    checksum VARCHAR(64),  -- For additional integrity checking
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'corrupted', 'deleted')),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for storage locations
CREATE INDEX idx_backup_storage_locations_backup_id ON backup_storage_locations(backup_id);
CREATE INDEX idx_backup_storage_locations_storage_type ON backup_storage_locations(storage_type);
CREATE INDEX idx_backup_storage_locations_status ON backup_storage_locations(status);

-- Update triggers
CREATE OR REPLACE FUNCTION update_backup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_backup_last_accessed
    BEFORE UPDATE ON estimation_backups
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_updated_at();

-- Backup statistics view
CREATE OR REPLACE VIEW backup_statistics AS
SELECT 
    type,
    source,
    COUNT(*) as backup_count,
    AVG(data_size) as avg_size,
    SUM(data_size) as total_size,
    AVG(record_count) as avg_records,
    MIN(created_at) as oldest_backup,
    MAX(created_at) as newest_backup,
    COUNT(CASE WHEN compressed THEN 1 END) as compressed_count,
    COUNT(CASE WHEN encrypted THEN 1 END) as encrypted_count
FROM estimation_backups
GROUP BY type, source;

-- Backup health view
CREATE OR REPLACE VIEW backup_health AS
SELECT 
    eb.id,
    eb.type,
    eb.entity_id,
    eb.created_at,
    eb.data_size,
    eb.compressed,
    eb.encrypted,
    
    -- Storage location count
    COALESCE(storage_count.locations, 0) as storage_locations,
    
    -- Last operation status
    last_op.operation_type as last_operation,
    last_op.status as last_operation_status,
    last_op.created_at as last_operation_at,
    
    -- Recovery count
    COALESCE(recovery_count.recoveries, 0) as recovery_count,
    
    -- Age and expiry
    EXTRACT(DAYS FROM NOW() - eb.created_at) as age_days,
    CASE 
        WHEN eb.expires_at IS NOT NULL AND eb.expires_at < NOW() THEN TRUE
        ELSE FALSE
    END as is_expired,
    
    -- Health score (0-100)
    CASE
        WHEN eb.expires_at IS NOT NULL AND eb.expires_at < NOW() THEN 0
        WHEN COALESCE(storage_count.locations, 0) = 0 THEN 20
        WHEN COALESCE(storage_count.locations, 0) = 1 THEN 60
        WHEN COALESCE(storage_count.locations, 0) >= 2 THEN 100
        ELSE 50
    END as health_score

FROM estimation_backups eb
LEFT JOIN LATERAL (
    SELECT COUNT(*) as locations
    FROM backup_storage_locations bsl
    WHERE bsl.backup_id = eb.id AND bsl.status = 'active'
) storage_count ON true
LEFT JOIN LATERAL (
    SELECT operation_type, status, created_at
    FROM backup_operations bo
    WHERE bo.backup_id = eb.id
    ORDER BY created_at DESC
    LIMIT 1
) last_op ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) as recoveries
    FROM backup_recoveries br
    WHERE br.backup_id = eb.id
) recovery_count ON true;

-- Functions for backup management

-- Function to calculate backup retention
CREATE OR REPLACE FUNCTION calculate_backup_expiry(backup_type VARCHAR, created_at TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN CASE backup_type
        WHEN 'estimation' THEN created_at + INTERVAL '90 days'
        WHEN 'project' THEN created_at + INTERVAL '365 days'
        WHEN 'blueprint' THEN created_at + INTERVAL '730 days'  -- 2 years
        WHEN 'full_system' THEN created_at + INTERVAL '180 days'
        ELSE created_at + INTERVAL '30 days'
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired backups
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS TABLE(cleaned_backups INTEGER) AS $$
DECLARE
    backup_count INTEGER := 0;
BEGIN
    -- Mark expired backups for deletion
    UPDATE estimation_backups 
    SET expires_at = NOW()
    WHERE expires_at IS NULL 
    AND created_at < NOW() - INTERVAL '30 days'
    AND type NOT IN ('blueprint', 'project');  -- Keep important backups longer
    
    -- Delete truly expired backups
    DELETE FROM estimation_backups 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '7 days';  -- Grace period
    
    GET DIAGNOSTICS backup_count = ROW_COUNT;
    
    RETURN QUERY SELECT backup_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate backup integrity
CREATE OR REPLACE FUNCTION validate_backup_integrity(backup_id_param VARCHAR)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    backup_record RECORD;
    storage_count INTEGER;
BEGIN
    -- Get backup record
    SELECT * INTO backup_record
    FROM estimation_backups
    WHERE id = backup_id_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Backup not found';
        RETURN;
    END IF;
    
    -- Check if backup has storage locations
    SELECT COUNT(*) INTO storage_count
    FROM backup_storage_locations
    WHERE backup_id = backup_id_param AND status = 'active';
    
    IF storage_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'No active storage locations found';
        RETURN;
    END IF;
    
    -- Additional integrity checks would go here
    -- For now, return valid if basic checks pass
    RETURN QUERY SELECT TRUE, NULL;
END;
$$ LANGUAGE plpgsql;

-- Backup size tracking function
CREATE OR REPLACE FUNCTION update_backup_statistics()
RETURNS VOID AS $$
BEGIN
    -- Update storage location sizes
    UPDATE backup_storage_locations bsl
    SET storage_size = eb.data_size
    FROM estimation_backups eb
    WHERE bsl.backup_id = eb.id
    AND bsl.storage_size IS NULL;
    
    -- Log statistics update
    INSERT INTO backup_operations (
        backup_id, operation_type, entity_type, status, 
        metadata, created_at
    )
    VALUES (
        'system', 'statistics_update', 'system', 'completed',
        jsonb_build_object('updated_at', NOW()),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Sample backup policies
INSERT INTO backup_schedules (schedule_name, backup_type, cron_expression, retention_days, storage_options) VALUES
('daily_estimations', 'estimation', '0 2 * * *', 90, '{"database": true, "s3": true}'),
('weekly_projects', 'project', '0 3 * * 0', 365, '{"database": true, "s3": true, "local": true}'),
('monthly_full_system', 'full_system', '0 4 1 * *', 180, '{"s3": true, "gcs": true}')
ON CONFLICT (schedule_name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE estimation_backups IS 'Stores backup data for critical electrical estimation system components';
COMMENT ON TABLE backup_operations IS 'Logs all backup and recovery operations for auditing';
COMMENT ON TABLE backup_schedules IS 'Defines automated backup schedules';
COMMENT ON TABLE backup_recoveries IS 'Tracks backup recovery operations';
COMMENT ON TABLE backup_storage_locations IS 'Maps backup data to physical/cloud storage locations';

COMMENT ON COLUMN estimation_backups.backup_data IS 'Compressed and/or encrypted backup data stored as binary';
COMMENT ON COLUMN estimation_backups.integrity_hash IS 'SHA-256 hash for data integrity verification';
COMMENT ON COLUMN estimation_backups.storage_locations IS 'JSON map of where this backup is physically stored';

-- Row Level Security (enable if using RLS)
-- ALTER TABLE estimation_backups ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY backup_tenant_isolation ON estimation_backups FOR ALL TO authenticated USING (tenant_id = current_setting('app.current_tenant_id')::uuid);