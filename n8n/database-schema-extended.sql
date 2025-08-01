-- ElectricalAI Pro Extended Database Schema for Complete N8N Workflow Ecosystem
-- Adds tables for NEC compliance, material costs, and project progress workflows

-- ================================
-- NEC COMPLIANCE TABLES
-- ================================

-- NEC compliance reports and certificates
CREATE TABLE IF NOT EXISTS nec_compliance_reports (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    compliance_data JSONB NOT NULL,
    compliance_status VARCHAR(50) NOT NULL, -- COMPLIANT, NON_COMPLIANT, REQUIRES_ATTENTION, COMPLIANT_WITH_WARNINGS
    compliance_score INTEGER NOT NULL CHECK (compliance_score >= 0 AND compliance_score <= 100),
    critical_violations INTEGER DEFAULT 0,
    major_violations INTEGER DEFAULT 0,
    minor_warnings INTEGER DEFAULT 0,
    certificate_id VARCHAR(255) UNIQUE,
    valid_until TIMESTAMP,
    nec_version VARCHAR(10) DEFAULT '2023',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(project_id),
    INDEX(compliance_status),
    INDEX(certificate_id)
);

-- NEC violations and recommendations tracking
CREATE TABLE IF NOT EXISTS nec_violations (
    id SERIAL PRIMARY KEY,
    compliance_report_id INTEGER REFERENCES nec_compliance_reports(id),
    nec_code VARCHAR(20) NOT NULL, -- e.g., "210.8", "220.12"
    violation_type VARCHAR(50) NOT NULL, -- gfci, afci, outlet_spacing, load_calculation
    severity VARCHAR(20) NOT NULL, -- critical, major, minor
    description TEXT NOT NULL,
    location VARCHAR(255),
    solution TEXT,
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(compliance_report_id),
    INDEX(nec_code),
    INDEX(severity),
    INDEX(status)
);

-- ================================
-- MATERIAL COST TRACKING TABLES
-- ================================

-- Material cost updates and price tracking
CREATE TABLE IF NOT EXISTS material_cost_updates (
    id SERIAL PRIMARY KEY,
    update_id VARCHAR(255) UNIQUE NOT NULL,
    project_id VARCHAR(255),
    update_data JSONB NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    materials_count INTEGER NOT NULL,
    risk_level VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    price_alerts INTEGER DEFAULT 0,
    location VARCHAR(100),
    supplier VARCHAR(255),
    update_type VARCHAR(50) NOT NULL, -- manual, supplier_api, market_data, user_report
    copper_multiplier DECIMAL(6,3) DEFAULT 1.000,
    location_multiplier DECIMAL(6,3) DEFAULT 1.000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(project_id),
    INDEX(update_type),
    INDEX(risk_level),
    INDEX(location),
    INDEX(created_at)
);

-- Individual material prices and trends
CREATE TABLE IF NOT EXISTS material_prices (
    id SERIAL PRIMARY KEY,
    cost_update_id INTEGER REFERENCES material_cost_updates(id),
    material_id VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- wire, conduit, devices, panels, fixtures, specialty
    catalog_price DECIMAL(8,3) NOT NULL,
    adjusted_price DECIMAL(8,3) NOT NULL,
    supplier_price DECIMAL(8,3),
    price_variance DECIMAL(8,3),
    variance_percentage DECIMAL(6,2),
    unit VARCHAR(20) NOT NULL, -- foot, each, 10ft_stick
    quantity INTEGER NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(255),
    location VARCHAR(100),
    reported_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(material_id),
    INDEX(category),
    INDEX(supplier),
    INDEX(created_at)
);

-- Material price alerts and notifications
CREATE TABLE IF NOT EXISTS material_price_alerts (
    id SERIAL PRIMARY KEY,
    cost_update_id INTEGER REFERENCES material_cost_updates(id),
    material_id VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- price_increase, price_decrease, volatility, shortage
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    message TEXT NOT NULL,
    variance_percentage DECIMAL(6,2),
    threshold_exceeded DECIMAL(8,3),
    action_required VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(material_id),
    INDEX(alert_type),
    INDEX(severity),
    INDEX(status)
);

-- ================================
-- PROJECT PROGRESS TRACKING TABLES
-- ================================

-- Project progress updates and analytics
CREATE TABLE IF NOT EXISTS project_progress_updates (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    update_id VARCHAR(255) UNIQUE NOT NULL,
    progress_data JSONB NOT NULL,
    overall_progress DECIMAL(5,2) NOT NULL CHECK (overall_progress >= 0 AND overall_progress <= 100),
    current_phase VARCHAR(50) NOT NULL, -- planning, design, permitting, rough_in, inspection, trim, final
    project_status VARCHAR(50) NOT NULL, -- on_track, at_risk, delayed, critical
    success_probability INTEGER NOT NULL CHECK (success_probability >= 0 AND success_probability <= 100),
    active_issues INTEGER DEFAULT 0,
    budget_status VARCHAR(20) DEFAULT 'on_budget', -- under_budget, on_budget, over_budget
    quality_score DECIMAL(5,2) DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    timeline_variance INTEGER DEFAULT 0, -- days ahead/behind schedule
    cost_variance_percentage DECIMAL(6,2) DEFAULT 0,
    team_productivity VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    update_type VARCHAR(50) NOT NULL, -- status, milestone, issue, completion, quality_check
    reported_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(project_id),
    INDEX(current_phase),
    INDEX(project_status),
    INDEX(created_at)
);

-- Project milestones and deliverables tracking
CREATE TABLE IF NOT EXISTS project_milestones (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    progress_update_id INTEGER REFERENCES project_progress_updates(id),
    milestone_name VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, in_progress, completed, delayed, cancelled
    planned_date DATE,
    actual_date DATE,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    dependencies TEXT[], -- Array of milestone names
    deliverables TEXT[],
    responsible_team VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(project_id),
    INDEX(phase),
    INDEX(status),
    INDEX(planned_date)
);

-- Project issues and risk tracking
CREATE TABLE IF NOT EXISTS project_issues (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    progress_update_id INTEGER REFERENCES project_progress_updates(id),
    issue_type VARCHAR(50) NOT NULL, -- technical, material_shortage, weather, inspection, quality_issue, schedule_delay
    severity VARCHAR(20) NOT NULL, -- minor, major, critical
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL, -- open, in_progress, resolved, cancelled
    impact_cost DECIMAL(10,2),
    impact_schedule INTEGER, -- days of delay
    assigned_to VARCHAR(255),
    reported_by VARCHAR(255),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    INDEX(project_id),
    INDEX(issue_type),
    INDEX(severity),
    INDEX(status)
);

-- Team performance and workload tracking
CREATE TABLE IF NOT EXISTS team_performance (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    progress_update_id INTEGER REFERENCES project_progress_updates(id),
    team_member VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    tasks_assigned INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    hours_worked DECIMAL(6,2) DEFAULT 0,
    productivity_score DECIMAL(5,2), -- tasks completed per hour
    utilization_percentage DECIMAL(5,2), -- percentage of capacity used
    quality_rating DECIMAL(3,2), -- 1-5 rating
    skills JSONB, -- skill assessments and certifications
    availability VARCHAR(20) DEFAULT 'available', -- available, limited, unavailable
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(project_id),
    INDEX(team_member),
    INDEX(period_start),
    INDEX(period_end)
);

-- ================================
-- WORKFLOW EXECUTION ENHANCEMENT
-- ================================

-- Enhanced workflow execution tracking with performance metrics
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(50);
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS success_metrics JSONB;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2);
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS resource_usage JSONB;

-- Workflow performance benchmarks
CREATE TABLE IF NOT EXISTS workflow_benchmarks (
    id SERIAL PRIMARY KEY,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL, -- execution_time, success_rate, resource_usage, accuracy
    benchmark_value DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20), -- ms, percentage, mb, etc.
    measurement_period VARCHAR(20) DEFAULT 'daily', -- hourly, daily, weekly, monthly
    threshold_warning DECIMAL(10,3),
    threshold_critical DECIMAL(10,3),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_name, metric_name, measurement_period),
    INDEX(workflow_name),
    INDEX(workflow_type),
    INDEX(metric_name)
);

-- ================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- ================================

-- Additional indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_nec_violations_project_severity ON nec_violations(compliance_report_id, severity);
CREATE INDEX IF NOT EXISTS idx_material_prices_category_date ON material_prices(category, created_at);
CREATE INDEX IF NOT EXISTS idx_material_alerts_active ON material_price_alerts(status, severity) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_project_progress_phase_status ON project_progress_updates(current_phase, project_status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_pending ON project_milestones(project_id, status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_project_issues_open ON project_issues(project_id, severity) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_team_performance_utilization ON team_performance(project_id, utilization_percentage);

-- Composite indexes for reporting queries
CREATE INDEX IF NOT EXISTS idx_material_cost_project_date ON material_cost_updates(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_score_date ON nec_compliance_reports(compliance_score, created_at);
CREATE INDEX IF NOT EXISTS idx_progress_timeline ON project_progress_updates(project_id, current_phase, overall_progress);

-- ================================
-- ENHANCED VIEWS FOR ANALYTICS
-- ================================

-- Comprehensive project health view
CREATE OR REPLACE VIEW project_health_dashboard AS
SELECT 
    pp.project_id,
    pp.current_phase,
    pp.overall_progress,
    pp.project_status,
    pp.success_probability,
    pp.budget_status,
    pp.quality_score,
    pp.timeline_variance,
    
    -- Compliance metrics
    nc.compliance_score,
    nc.compliance_status,
    nc.critical_violations + nc.major_violations as total_violations,
    
    -- Cost metrics
    mc.total_cost as current_material_cost,
    mc.risk_level as cost_risk_level,
    mc.price_alerts,
    
    -- Issue metrics
    COUNT(pi.id) FILTER (WHERE pi.status = 'open' AND pi.severity = 'critical') as critical_issues,
    COUNT(pi.id) FILTER (WHERE pi.status = 'open') as total_open_issues,
    
    -- Team metrics
    AVG(tp.utilization_percentage) as avg_team_utilization,
    AVG(tp.productivity_score) as avg_productivity,
    
    pp.created_at as last_updated
FROM project_progress_updates pp
LEFT JOIN nec_compliance_reports nc ON pp.project_id = nc.project_id 
    AND nc.created_at = (SELECT MAX(created_at) FROM nec_compliance_reports WHERE project_id = pp.project_id)
LEFT JOIN material_cost_updates mc ON pp.project_id = mc.project_id 
    AND mc.created_at = (SELECT MAX(created_at) FROM material_cost_updates WHERE project_id = pp.project_id)
LEFT JOIN project_issues pi ON pp.project_id = pi.project_id
LEFT JOIN team_performance tp ON pp.project_id = tp.project_id 
    AND tp.created_at = (SELECT MAX(created_at) FROM team_performance WHERE project_id = pp.project_id)
WHERE pp.created_at = (SELECT MAX(created_at) FROM project_progress_updates WHERE project_id = pp.project_id)
GROUP BY pp.id, pp.project_id, pp.current_phase, pp.overall_progress, pp.project_status, 
         pp.success_probability, pp.budget_status, pp.quality_score, pp.timeline_variance,
         nc.compliance_score, nc.compliance_status, nc.critical_violations, nc.major_violations,
         mc.total_cost, mc.risk_level, mc.price_alerts, pp.created_at;

-- Material cost trends view
CREATE OR REPLACE VIEW material_cost_trends AS
SELECT 
    mp.material_id,
    mp.category,
    mp.supplier,
    mp.location,
    AVG(mp.adjusted_price) as avg_price,
    STDDEV(mp.adjusted_price) as price_volatility,
    COUNT(*) as price_points,
    MIN(mp.created_at) as first_recorded,
    MAX(mp.created_at) as last_updated,
    
    -- Price trend calculation (simplified)
    CASE 
        WHEN COUNT(*) > 1 THEN 
            (MAX(mp.adjusted_price) - MIN(mp.adjusted_price)) / MIN(mp.adjusted_price) * 100
        ELSE 0 
    END as price_change_percentage,
    
    -- Alert summary
    COUNT(mpa.id) FILTER (WHERE mpa.status = 'active') as active_alerts,
    MAX(mpa.severity) as highest_alert_severity
    
FROM material_prices mp
LEFT JOIN material_price_alerts mpa ON mp.material_id = mpa.material_id
WHERE mp.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY mp.material_id, mp.category, mp.supplier, mp.location;

-- Workflow performance summary view
CREATE OR REPLACE VIEW workflow_performance_summary AS
SELECT 
    we.workflow_name,
    DATE_TRUNC('day', we.started_at) as execution_date,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN we.status = 'success' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    ROUND(COUNT(CASE WHEN we.status = 'success' THEN 1 END)::DECIMAL / COUNT(*) * 100, 2) as success_rate,
    AVG(we.execution_time_ms) as avg_execution_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY we.execution_time_ms) as median_execution_time,
    MAX(we.execution_time_ms) as max_execution_time,
    AVG(we.performance_score) as avg_performance_score
FROM workflow_executions we
WHERE we.started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY we.workflow_name, DATE_TRUNC('day', we.started_at)
ORDER BY execution_date DESC, workflow_name;

-- ================================
-- SAMPLE DATA FOR BENCHMARKS
-- ================================

-- Insert workflow performance benchmarks
INSERT INTO workflow_benchmarks (workflow_name, workflow_type, metric_name, benchmark_value, unit, threshold_warning, threshold_critical) VALUES
('ElectricalAI Pro - Estimation Pipeline', 'estimation', 'execution_time', 5000, 'ms', 8000, 12000),
('ElectricalAI Pro - Estimation Pipeline', 'estimation', 'success_rate', 99.5, 'percentage', 95.0, 90.0),
('ElectricalAI Pro - Estimation Pipeline', 'estimation', 'accuracy_score', 94.0, 'percentage', 90.0, 85.0),

('ElectricalAI Pro - Floor Plan Analysis', 'analysis', 'execution_time', 15000, 'ms', 25000, 35000),
('ElectricalAI Pro - Floor Plan Analysis', 'analysis', 'success_rate', 98.0, 'percentage', 92.0, 85.0),
('ElectricalAI Pro - Floor Plan Analysis', 'analysis', 'element_detection_rate', 92.0, 'percentage', 85.0, 80.0),

('ElectricalAI Pro - NEC Compliance Checker', 'compliance', 'execution_time', 8000, 'ms', 12000, 18000),
('ElectricalAI Pro - NEC Compliance Checker', 'compliance', 'success_rate', 99.8, 'percentage', 97.0, 93.0),
('ElectricalAI Pro - NEC Compliance Checker', 'compliance', 'rule_coverage', 95.0, 'percentage', 90.0, 85.0),

('ElectricalAI Pro - Material Cost Tracking', 'cost_tracking', 'execution_time', 3000, 'ms', 5000, 8000),
('ElectricalAI Pro - Material Cost Tracking', 'cost_tracking', 'success_rate', 99.9, 'percentage', 98.0, 95.0),
('ElectricalAI Pro - Material Cost Tracking', 'cost_tracking', 'price_accuracy', 96.0, 'percentage', 92.0, 88.0),

('ElectricalAI Pro - Project Progress Monitor', 'monitoring', 'execution_time', 4000, 'ms', 7000, 10000),
('ElectricalAI Pro - Project Progress Monitor', 'monitoring', 'success_rate', 99.7, 'percentage', 96.0, 92.0),
('ElectricalAI Pro - Project Progress Monitor', 'monitoring', 'prediction_accuracy', 88.0, 'percentage', 82.0, 75.0)

ON CONFLICT (workflow_name, metric_name, measurement_period) DO UPDATE SET
    benchmark_value = EXCLUDED.benchmark_value,
    threshold_warning = EXCLUDED.threshold_warning,
    threshold_critical = EXCLUDED.threshold_critical,
    last_updated = CURRENT_TIMESTAMP;

-- ================================
-- TRIGGERS FOR MAINTENANCE
-- ================================

-- Update timestamp triggers for new tables
CREATE TRIGGER update_nec_compliance_reports_updated_at 
    BEFORE UPDATE ON nec_compliance_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at 
    BEFORE UPDATE ON project_milestones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- PERMISSIONS
-- ================================

-- Grant permissions to N8N user for new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON nec_compliance_reports TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON nec_violations TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON material_cost_updates TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON material_prices TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON material_price_alerts TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_progress_updates TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_milestones TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_issues TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_performance TO n8n_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_benchmarks TO n8n_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n_user;
GRANT SELECT ON project_health_dashboard TO n8n_user;
GRANT SELECT ON material_cost_trends TO n8n_user;
GRANT SELECT ON workflow_performance_summary TO n8n_user;

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE nec_compliance_reports IS 'NEC 2023 compliance reports and certificates';
COMMENT ON TABLE material_cost_updates IS 'Real-time material cost tracking with copper pricing';
COMMENT ON TABLE project_progress_updates IS 'Project progress monitoring with predictive analytics';
COMMENT ON TABLE workflow_benchmarks IS 'Performance benchmarks and thresholds for workflow monitoring';

COMMENT ON VIEW project_health_dashboard IS 'Comprehensive project health metrics combining all workflow data';
COMMENT ON VIEW material_cost_trends IS 'Material price trends and volatility analysis';
COMMENT ON VIEW workflow_performance_summary IS 'N8N workflow execution performance metrics';

-- Database schema extension complete
SELECT 'ElectricalAI Pro extended database schema created successfully!' as status;