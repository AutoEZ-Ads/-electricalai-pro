-- Blueprints table for storing uploaded electrical drawings and floor plans
CREATE TABLE IF NOT EXISTS blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- File information
    original_filename VARCHAR(255) NOT NULL,
    secure_filename VARCHAR(255) NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    
    -- Blueprint metadata
    blueprint_type VARCHAR(50) NOT NULL DEFAULT 'floor_plan'
        CHECK (blueprint_type IN ('floor_plan', 'electrical_schematic', 'site_plan', 'detail_drawing')),
    description TEXT,
    
    -- Processing status
    upload_status VARCHAR(20) NOT NULL DEFAULT 'uploaded'
        CHECK (upload_status IN ('uploaded', 'processing', 'analyzed', 'error')),
    
    -- Analysis results (JSON storage for flexibility)
    analysis_results JSONB DEFAULT '{}',
    
    -- Extracted blueprint data
    detected_rooms JSONB DEFAULT '[]',
    electrical_symbols JSONB DEFAULT '[]',
    dimensions JSONB DEFAULT '{}',
    scale_factor DECIMAL(10,6),
    
    -- Compliance and calculations
    nec_compliance_check JSONB DEFAULT '{}',
    load_calculations JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_blueprints_project_id ON blueprints(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_blueprints_type ON blueprints(blueprint_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_blueprints_status ON blueprints(upload_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_blueprints_hash ON blueprints(file_hash); -- For deduplication
CREATE INDEX idx_blueprints_created_at ON blueprints(created_at DESC) WHERE deleted_at IS NULL;

-- GIN index for JSON analysis results
CREATE INDEX idx_blueprints_analysis_results ON blueprints USING GIN (analysis_results) WHERE deleted_at IS NULL;
CREATE INDEX idx_blueprints_electrical_symbols ON blueprints USING GIN (electrical_symbols) WHERE deleted_at IS NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_blueprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_blueprints_updated_at
    BEFORE UPDATE ON blueprints
    FOR EACH ROW
    EXECUTE FUNCTION update_blueprints_updated_at();

-- Blueprint analysis log table for tracking processing history
CREATE TABLE IF NOT EXISTS blueprint_analysis_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    
    -- Analysis details
    analysis_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'started'
        CHECK (status IN ('started', 'processing', 'completed', 'failed')),
    
    -- Processing information
    processor_name VARCHAR(100),
    workflow_id VARCHAR(100),
    processing_time_ms INTEGER,
    
    -- Results and errors
    results JSONB DEFAULT '{}',
    error_message TEXT,
    error_details JSONB DEFAULT '{}',
    
    -- Metrics
    confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
    symbols_detected INTEGER DEFAULT 0,
    rooms_detected INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blueprint_analysis_log_blueprint_id ON blueprint_analysis_log(blueprint_id);
CREATE INDEX idx_blueprint_analysis_log_status ON blueprint_analysis_log(status);
CREATE INDEX idx_blueprint_analysis_log_created_at ON blueprint_analysis_log(created_at DESC);

-- Project updates table to track blueprint-related changes
CREATE TABLE IF NOT EXISTS project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
    
    -- Update content
    update_text TEXT NOT NULL,
    update_type VARCHAR(50) DEFAULT 'general'
        CHECK (update_type IN ('general', 'blueprint_upload', 'analysis_complete', 'error', 'manual')),
    
    -- Source tracking
    source VARCHAR(50) NOT NULL DEFAULT 'system'
        CHECK (source IN ('system', 'user', 'monday_webhook', 'n8n_workflow', 'analysis_engine')),
    user_id UUID, -- Reference to user if applicable
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_updates_project_id ON project_updates(project_id);
CREATE INDEX idx_project_updates_blueprint_id ON project_updates(blueprint_id) WHERE blueprint_id IS NOT NULL;
CREATE INDEX idx_project_updates_created_at ON project_updates(created_at DESC);

-- File storage tracking table for managing uploads directory
CREATE TABLE IF NOT EXISTS file_storage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File identification
    file_hash VARCHAR(64) NOT NULL UNIQUE,
    secure_filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    
    -- Storage details
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    -- Usage tracking
    reference_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Storage metadata
    storage_tier VARCHAR(20) DEFAULT 'active' -- active, archived, quarantined
        CHECK (storage_tier IN ('active', 'archived', 'quarantined')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_storage_hash ON file_storage_tracking(file_hash);
CREATE INDEX idx_file_storage_tier ON file_storage_tracking(storage_tier);
CREATE INDEX idx_file_storage_last_accessed ON file_storage_tracking(last_accessed_at);

-- Function to increment file reference count
CREATE OR REPLACE FUNCTION increment_file_reference(file_hash_param VARCHAR(64))
RETURNS VOID AS $$
BEGIN
    UPDATE file_storage_tracking 
    SET reference_count = reference_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE file_hash = file_hash_param;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement file reference count
CREATE OR REPLACE FUNCTION decrement_file_reference(file_hash_param VARCHAR(64))
RETURNS VOID AS $$
BEGIN
    UPDATE file_storage_tracking 
    SET reference_count = GREATEST(0, reference_count - 1),
        updated_at = NOW()
    WHERE file_hash = file_hash_param;
END;
$$ LANGUAGE plpgsql;

-- View for blueprint analysis summary
CREATE OR REPLACE VIEW blueprint_analysis_summary AS
SELECT 
    b.id,
    b.project_id,
    b.original_filename,
    b.blueprint_type,
    b.upload_status,
    b.created_at as uploaded_at,
    
    -- Latest analysis info
    latest_analysis.analysis_type as last_analysis_type,
    latest_analysis.status as last_analysis_status,
    latest_analysis.completed_at as last_analysis_completed_at,
    latest_analysis.confidence_score,
    latest_analysis.symbols_detected,
    latest_analysis.rooms_detected,
    
    -- Analysis counts
    COALESCE(analysis_counts.total_analyses, 0) as total_analyses,
    COALESCE(analysis_counts.successful_analyses, 0) as successful_analyses,
    COALESCE(analysis_counts.failed_analyses, 0) as failed_analyses
    
FROM blueprints b
LEFT JOIN LATERAL (
    SELECT 
        analysis_type, status, completed_at, confidence_score,
        symbols_detected, rooms_detected
    FROM blueprint_analysis_log
    WHERE blueprint_id = b.id
    ORDER BY created_at DESC
    LIMIT 1
) latest_analysis ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_analyses,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_analyses,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_analyses
    FROM blueprint_analysis_log
    WHERE blueprint_id = b.id
) analysis_counts ON true
WHERE b.deleted_at IS NULL;

-- Function to clean up orphaned files (run periodically)
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS TABLE(cleaned_files INTEGER) AS $$
DECLARE
    file_count INTEGER := 0;
BEGIN
    -- Mark files with zero references for cleanup
    UPDATE file_storage_tracking 
    SET storage_tier = 'archived'
    WHERE reference_count = 0 
    AND storage_tier = 'active'
    AND last_accessed_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS file_count = ROW_COUNT;
    
    RETURN QUERY SELECT file_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data and constraints
ALTER TABLE blueprints 
ADD CONSTRAINT chk_blueprints_file_size 
CHECK (file_size > 0 AND file_size <= 104857600); -- Max 100MB

ALTER TABLE blueprints 
ADD CONSTRAINT chk_blueprints_scale_factor 
CHECK (scale_factor IS NULL OR scale_factor > 0);

-- Security: Row Level Security policies would go here
-- (Enable if using RLS)
-- ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY blueprints_tenant_isolation ON blueprints FOR ALL TO authenticated USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMENT ON TABLE blueprints IS 'Stores uploaded electrical blueprints and floor plans with analysis results';
COMMENT ON TABLE blueprint_analysis_log IS 'Tracks all blueprint analysis attempts and results';
COMMENT ON TABLE project_updates IS 'Stores project activity feed including blueprint-related updates';
COMMENT ON TABLE file_storage_tracking IS 'Manages file deduplication and storage optimization';