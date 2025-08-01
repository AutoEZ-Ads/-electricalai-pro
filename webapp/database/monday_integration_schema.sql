-- Monday.com Integration Database Schema
-- ElectricalAI Pro - Monday.com OAuth and Webhook Integration

-- Table for storing Monday.com authenticated users
CREATE TABLE IF NOT EXISTS monday_users (
    id SERIAL PRIMARY KEY,
    monday_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    account_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table for tracking Monday.com boards we're integrated with
CREATE TABLE IF NOT EXISTS monday_boards (
    id SERIAL PRIMARY KEY,
    board_id VARCHAR(255) UNIQUE NOT NULL,
    board_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),
    user_id INTEGER REFERENCES monday_users(id),
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for mapping Monday.com items to our project estimations
CREATE TABLE IF NOT EXISTS project_estimations (
    id SERIAL PRIMARY KEY,
    monday_item_id VARCHAR(255) UNIQUE NOT NULL,
    monday_board_id VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100) DEFAULT 'residential',
    square_footage DECIMAL(10,2),
    complexity_level VARCHAR(50) DEFAULT 'standard',
    location VARCHAR(255),
    
    -- Estimation results
    estimated_cost DECIMAL(12,2),
    labor_hours DECIMAL(8,2),
    material_cost DECIMAL(12,2),
    
    -- Status tracking
    estimation_status VARCHAR(50) DEFAULT 'pending',
    compliance_status VARCHAR(50) DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0,
    
    -- Workflow tracking
    n8n_workflow_id VARCHAR(255),
    last_workflow_run TIMESTAMP,
    workflow_status VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES monday_users(id)
);

-- Table for tracking webhook events from Monday.com
CREATE TABLE IF NOT EXISTS monday_webhook_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    board_id VARCHAR(255),
    item_id VARCHAR(255),
    user_id VARCHAR(255),
    event_data JSONB NOT NULL,
    processed_at TIMESTAMP,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing floor plan analysis results
CREATE TABLE IF NOT EXISTS floor_plan_analyses (
    id SERIAL PRIMARY KEY,
    monday_item_id VARCHAR(255) REFERENCES project_estimations(monday_item_id),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    analysis_status VARCHAR(50) DEFAULT 'pending',
    
    -- AI Analysis Results
    detected_rooms JSONB,
    electrical_points JSONB,
    load_calculations JSONB,
    nec_compliance_issues JSONB,
    
    -- Processing metadata
    analysis_started_at TIMESTAMP,
    analysis_completed_at TIMESTAMP,
    processing_time_seconds INTEGER,
    ai_model_used VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for NEC compliance reports
CREATE TABLE IF NOT EXISTS nec_compliance_reports (
    id SERIAL PRIMARY KEY,
    monday_item_id VARCHAR(255) REFERENCES project_estimations(monday_item_id),
    compliance_check_type VARCHAR(100) NOT NULL,
    nec_version VARCHAR(20) DEFAULT '2023',
    
    -- Compliance Results
    overall_compliance_score INTEGER, -- 0-100
    violations_found INTEGER DEFAULT 0,
    warnings_found INTEGER DEFAULT 0,
    compliance_details JSONB,
    
    -- Report metadata
    report_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_expires_at TIMESTAMP,
    certificate_url TEXT,
    is_certified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for material cost tracking
CREATE TABLE IF NOT EXISTS material_cost_updates (
    id SERIAL PRIMARY KEY,
    monday_item_id VARCHAR(255) REFERENCES project_estimations(monday_item_id),
    material_type VARCHAR(100) NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    
    -- Cost tracking
    current_price DECIMAL(10,4),
    previous_price DECIMAL(10,4),
    price_change_percentage DECIMAL(5,2),
    quantity_needed DECIMAL(10,2),
    unit_of_measure VARCHAR(50),
    
    -- Market data
    copper_price_lbs DECIMAL(8,4), -- COMEX copper pricing
    supplier VARCHAR(255),
    price_source VARCHAR(100),
    price_date TIMESTAMP,
    
    -- Alerts
    price_alert_threshold DECIMAL(5,2),
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for project progress tracking
CREATE TABLE IF NOT EXISTS project_progress_updates (
    id SERIAL PRIMARY KEY,
    monday_item_id VARCHAR(255) REFERENCES project_estimations(monday_item_id),
    progress_type VARCHAR(100) NOT NULL, -- 'milestone', 'percentage', 'status_change'
    
    -- Progress details
    previous_percentage INTEGER,
    current_percentage INTEGER,
    milestone_name VARCHAR(255),
    status_from VARCHAR(100),
    status_to VARCHAR(100),
    
    -- Timeline data
    estimated_completion_date DATE,
    actual_completion_date DATE,
    days_ahead_behind INTEGER, -- negative = behind, positive = ahead
    
    -- Update metadata
    update_source VARCHAR(100), -- 'monday_webhook', 'manual', 'automated'
    update_text TEXT,
    updated_by_user_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_monday_users_monday_id ON monday_users(monday_id);
CREATE INDEX IF NOT EXISTS idx_monday_users_email ON monday_users(email);
CREATE INDEX IF NOT EXISTS idx_monday_boards_board_id ON monday_boards(board_id);
CREATE INDEX IF NOT EXISTS idx_project_estimations_monday_item_id ON project_estimations(monday_item_id);
CREATE INDEX IF NOT EXISTS idx_project_estimations_board_id ON project_estimations(monday_board_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON monday_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_item_id ON monday_webhook_events(item_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_analyses_item_id ON floor_plan_analyses(monday_item_id);
CREATE INDEX IF NOT EXISTS idx_nec_compliance_item_id ON nec_compliance_reports(monday_item_id);
CREATE INDEX IF NOT EXISTS idx_material_cost_item_id ON material_cost_updates(monday_item_id);
CREATE INDEX IF NOT EXISTS idx_progress_updates_item_id ON project_progress_updates(monday_item_id);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monday_users_updated_at BEFORE UPDATE ON monday_users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_monday_boards_updated_at BEFORE UPDATE ON monday_boards FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_project_estimations_updated_at BEFORE UPDATE ON project_estimations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_floor_plan_analyses_updated_at BEFORE UPDATE ON floor_plan_analyses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_nec_compliance_updated_at BEFORE UPDATE ON nec_compliance_reports FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_material_cost_updated_at BEFORE UPDATE ON material_cost_updates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Sample data for testing (optional)
INSERT INTO monday_users (monday_id, name, email, access_token) VALUES
('test_user_1', 'Test Contractor', 'test@electricalcontractor.com', 'sample_access_token_123')
ON CONFLICT (monday_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE monday_users IS 'Stores authenticated Monday.com users with OAuth tokens';
COMMENT ON TABLE monday_boards IS 'Tracks Monday.com boards integrated with ElectricalAI Pro';
COMMENT ON TABLE project_estimations IS 'Maps Monday.com items to electrical project estimations';
COMMENT ON TABLE monday_webhook_events IS 'Logs all webhook events received from Monday.com';
COMMENT ON TABLE floor_plan_analyses IS 'Stores AI-powered floor plan analysis results';
COMMENT ON TABLE nec_compliance_reports IS 'Tracks NEC compliance checks and certificates';
COMMENT ON TABLE material_cost_updates IS 'Monitors real-time material cost changes';
COMMENT ON TABLE project_progress_updates IS 'Tracks project milestone and progress updates';

-- Grant permissions (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;