-- ElectricalAI Pro Database Schema for N8N Workflows
-- Creates tables for storing estimation and floor plan analysis data

-- ================================
-- ESTIMATION TABLES
-- ================================

-- Main estimations table
CREATE TABLE IF NOT EXISTS estimations (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    estimation_data JSONB NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    material_cost DECIMAL(12,2),
    labor_cost DECIMAL(12,2),
    accuracy_level VARCHAR(50),
    risk_level VARCHAR(20) DEFAULT 'medium',
    project_type VARCHAR(50),
    square_footage INTEGER,
    complexity_level VARCHAR(50),
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- Historical project performance tracking
CREATE TABLE IF NOT EXISTS project_history (
    id SERIAL PRIMARY KEY,
    original_estimate_id INTEGER REFERENCES estimations(id),
    actual_cost DECIMAL(12,2),
    actual_hours DECIMAL(8,2),
    variance_percentage DECIMAL(5,2),
    completion_date TIMESTAMP,
    lessons_learned TEXT,
    calibration_factor DECIMAL(4,3) DEFAULT 1.000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cost calibration factors by region and type
CREATE TABLE IF NOT EXISTS calibration_factors (
    id SERIAL PRIMARY KEY,
    project_type VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    complexity_level VARCHAR(50) NOT NULL,
    material_factor DECIMAL(4,3) DEFAULT 1.000,
    labor_factor DECIMAL(4,3) DEFAULT 1.000,
    risk_adjustment DECIMAL(4,3) DEFAULT 1.000,
    sample_size INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_type, location, complexity_level)
);

-- ================================
-- FLOOR PLAN ANALYSIS TABLES
-- ================================

-- Main floor plan analyses table
CREATE TABLE IF NOT EXISTS floor_plan_analyses (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    analysis_data JSONB NOT NULL,
    total_elements INTEGER NOT NULL,
    total_outlets INTEGER DEFAULT 0,
    total_switches INTEGER DEFAULT 0,
    total_fixtures INTEGER DEFAULT 0,
    estimated_load INTEGER NOT NULL,
    compliance_score INTEGER DEFAULT 0,
    room_count INTEGER DEFAULT 0,
    image_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- Electrical elements with precise coordinates
CREATE TABLE IF NOT EXISTS electrical_elements (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plan_analyses(id),
    element_type VARCHAR(50) NOT NULL, -- outlet, switch, fixture, panel
    grid_reference VARCHAR(10) NOT NULL, -- A1, B3, etc.
    x_coordinate DECIMAL(6,2) NOT NULL, -- inches from reference
    y_coordinate DECIMAL(6,2) NOT NULL, -- inches from reference
    room_name VARCHAR(100),
    specifications JSONB,
    circuit_assignment VARCHAR(50),
    installation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room specifications and requirements
CREATE TABLE IF NOT EXISTS room_specifications (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plan_analyses(id),
    room_name VARCHAR(100) NOT NULL,
    room_type VARCHAR(50) NOT NULL,
    area_sqft DECIMAL(8,2),
    load_requirement INTEGER, -- VA
    outlet_count INTEGER DEFAULT 0,
    switch_count INTEGER DEFAULT 0,
    fixture_count INTEGER DEFAULT 0,
    special_requirements JSONB,
    nec_compliance_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- WORKFLOW EXECUTION TRACKING
-- ================================

-- N8N workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_name VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255),
    input_data JSONB,
    output_data JSONB,
    execution_time_ms INTEGER,
    status VARCHAR(20) NOT NULL, -- success, failed, running
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(execution_id)
);

-- API usage tracking for rate limiting and billing
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255),
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(255),
    response_time_ms INTEGER,
    status_code INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Estimations indexes
CREATE INDEX IF NOT EXISTS idx_estimations_project_id ON estimations(project_id);
CREATE INDEX IF NOT EXISTS idx_estimations_created_at ON estimations(created_at);
CREATE INDEX IF NOT EXISTS idx_estimations_project_type ON estimations(project_type);
CREATE INDEX IF NOT EXISTS idx_estimations_status ON estimations(status);

-- Floor plan analyses indexes  
CREATE INDEX IF NOT EXISTS idx_floor_plan_analyses_project_id ON floor_plan_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_analyses_created_at ON floor_plan_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_floor_plan_analyses_status ON floor_plan_analyses(status);

-- Electrical elements indexes
CREATE INDEX IF NOT EXISTS idx_electrical_elements_floor_plan_id ON electrical_elements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_electrical_elements_type ON electrical_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_electrical_elements_grid ON electrical_elements(grid_reference);

-- Room specifications indexes
CREATE INDEX IF NOT EXISTS idx_room_specifications_floor_plan_id ON room_specifications(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_room_specifications_type ON room_specifications(room_type);

-- Workflow execution indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_project_id ON workflow_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_name ON workflow_executions(workflow_name);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- API usage indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_project_id ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- ================================
-- SAMPLE CALIBRATION DATA
-- ================================

-- Insert sample calibration factors
INSERT INTO calibration_factors (project_type, location, complexity_level, material_factor, labor_factor, risk_adjustment, sample_size) VALUES
('residential', 'suburban', 'standard', 1.000, 1.000, 1.000, 25),
('residential', 'urban', 'standard', 1.150, 1.200, 1.100, 18),
('residential', 'rural', 'standard', 0.950, 0.900, 0.950, 12),
('commercial', 'urban', 'standard', 1.200, 1.300, 1.200, 8),
('commercial', 'suburban', 'standard', 1.100, 1.150, 1.100, 6),
('industrial', 'urban', 'complex', 1.400, 1.500, 1.300, 4)
ON CONFLICT (project_type, location, complexity_level) DO NOTHING;

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_estimations_updated_at BEFORE UPDATE ON estimations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_floor_plan_analyses_updated_at BEFORE UPDATE ON floor_plan_analyses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- VIEWS FOR REPORTING
-- ================================

-- Estimation summary view
CREATE OR REPLACE VIEW estimation_summary AS
SELECT 
    e.project_id,
    e.project_type,
    e.square_footage,
    e.complexity_level,
    e.location,
    e.total_cost,
    e.accuracy_level,
    e.risk_level,
    e.created_at,
    ph.actual_cost,
    ph.variance_percentage,
    CASE 
        WHEN ph.actual_cost IS NOT NULL THEN 'Completed'
        WHEN e.valid_until < CURRENT_TIMESTAMP THEN 'Expired'
        ELSE 'Active'
    END as project_status
FROM estimations e
LEFT JOIN project_history ph ON e.id = ph.original_estimate_id;

-- Floor plan analysis summary view
CREATE OR REPLACE VIEW floor_plan_summary AS
SELECT 
    fp.project_id,
    fp.total_elements,
    fp.total_outlets,
    fp.total_switches, 
    fp.total_fixtures,
    fp.estimated_load,
    fp.compliance_score,
    fp.room_count,
    fp.created_at,
    COUNT(ee.id) as installed_elements
FROM floor_plan_analyses fp
LEFT JOIN electrical_elements ee ON fp.id = ee.floor_plan_id
GROUP BY fp.id, fp.project_id, fp.total_elements, fp.total_outlets, 
         fp.total_switches, fp.total_fixtures, fp.estimated_load, 
         fp.compliance_score, fp.room_count, fp.created_at;

-- Workflow performance view
CREATE OR REPLACE VIEW workflow_performance AS
SELECT 
    workflow_name,
    DATE_TRUNC('day', started_at) as execution_date,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(execution_time_ms) as max_execution_time_ms
FROM workflow_executions
GROUP BY workflow_name, DATE_TRUNC('day', started_at)
ORDER BY execution_date DESC;

-- ================================
-- GRANT PERMISSIONS
-- ================================

-- Grant N8N user permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO n8n_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n_user;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO n8n_user;

-- Comments for documentation
COMMENT ON TABLE estimations IS 'Stores electrical estimation calculations and project data';
COMMENT ON TABLE floor_plan_analyses IS 'Stores AI-analyzed floor plan data with electrical markup';
COMMENT ON TABLE electrical_elements IS 'Precise coordinates and specifications for electrical components';
COMMENT ON TABLE calibration_factors IS 'Regional and project-type specific cost adjustment factors';
COMMENT ON TABLE workflow_executions IS 'Tracks N8N workflow execution performance and errors';

-- Database schema setup complete
SELECT 'ElectricalAI Pro database schema created successfully!' as status;