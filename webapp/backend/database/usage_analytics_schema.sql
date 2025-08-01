-- =====================================================
-- ElectricalAI Pro - Customer Success Analytics Schema
-- =====================================================
-- Real-time usage tracking for churn prediction and customer success automation

-- Usage Analytics - Track feature usage patterns
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_used VARCHAR(100) NOT NULL,
    usage_frequency INTEGER DEFAULT 1,
    session_duration INTEGER, -- in seconds
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    risk_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00 (1.00 = highest churn risk)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Health Metrics - Comprehensive customer success scoring
CREATE TABLE customer_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    health_score INTEGER DEFAULT 50, -- 0-100 scale
    nps_score INTEGER, -- Net Promoter Score (-100 to +100)
    feature_adoption_rate DECIMAL(5,2) DEFAULT 0.00, -- percentage
    support_ticket_count INTEGER DEFAULT 0,
    last_login TIMESTAMP,
    total_projects INTEGER DEFAULT 0,
    avg_project_value DECIMAL(10,2) DEFAULT 0.00,
    churn_probability DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
    expansion_probability DECIMAL(3,2) DEFAULT 0.00, -- likelihood to upgrade
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature Usage Tracking - Detailed feature analytics
CREATE TABLE feature_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    feature_category VARCHAR(50) NOT NULL, -- 'estimation', 'floor_plans', 'compliance', etc.
    action_type VARCHAR(50) NOT NULL, -- 'create', 'view', 'edit', 'delete', 'export'
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    duration_seconds INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB, -- Additional context data
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Journey Stages - Track progression through value realization
CREATE TABLE customer_journey_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- 'trial', 'onboarding', 'adoption', 'expansion', 'champion'
    stage_entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stage_completed_at TIMESTAMP,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    key_milestones JSONB, -- JSON array of completed milestones
    assigned_csm_id UUID REFERENCES users(id), -- Customer Success Manager
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automated Customer Success Actions - Track interventions and outcomes
CREATE TABLE cs_automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL, -- 'low_usage', 'support_escalation', 'expansion_opportunity'
    trigger_data JSONB, -- Context data that triggered the action
    action_type VARCHAR(50) NOT NULL, -- 'email', 'in_app_message', 'phone_call', 'meeting_request'
    action_content TEXT,
    scheduled_at TIMESTAMP,
    executed_at TIMESTAMP,
    response_received BOOLEAN DEFAULT false,
    response_data JSONB,
    outcome VARCHAR(50), -- 'positive', 'neutral', 'negative', 'no_response'
    created_by UUID REFERENCES users(id), -- System or CS team member
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Feedback and Feature Requests
CREATE TABLE product_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL, -- 'bug_report', 'feature_request', 'improvement', 'complaint'
    category VARCHAR(50), -- 'estimation', 'floor_plans', 'compliance', 'ui_ux', 'performance'
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority_score INTEGER DEFAULT 1, -- 1-5 scale
    upvotes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'reviewing', 'planned', 'in_progress', 'completed', 'declined'
    assigned_to UUID REFERENCES users(id),
    estimated_effort VARCHAR(20), -- 'small', 'medium', 'large', 'extra_large'
    business_impact VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support Tickets Integration
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
    category VARCHAR(50), -- 'technical', 'billing', 'feature_request', 'training'
    assigned_to UUID REFERENCES users(id), -- Support team member
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    satisfaction_rating INTEGER, -- 1-5 scale
    satisfaction_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage Pattern Analysis Views
CREATE VIEW customer_usage_summary AS
SELECT 
    ua.organization_id,
    COUNT(DISTINCT ua.user_id) as active_users,
    COUNT(DISTINCT ua.feature_used) as features_used,
    AVG(ua.usage_frequency) as avg_usage_frequency,
    MAX(ua.last_active) as last_activity,
    AVG(ua.risk_score) as avg_risk_score,
    SUM(CASE WHEN ua.last_active > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as weekly_active_users,
    SUM(CASE WHEN ua.last_active > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as monthly_active_users
FROM usage_analytics ua
GROUP BY ua.organization_id;

-- Churn Risk Identification View
CREATE VIEW churn_risk_analysis AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.subscription_tier,
    chm.health_score,
    chm.churn_probability,
    chm.last_login,
    chm.feature_adoption_rate,
    chm.support_ticket_count,
    cus.last_activity,
    cus.weekly_active_users,
    CASE 
        WHEN chm.churn_probability > 0.7 THEN 'Critical Risk'
        WHEN chm.churn_probability > 0.5 THEN 'High Risk'
        WHEN chm.churn_probability > 0.3 THEN 'Medium Risk'
        ELSE 'Low Risk' 
    END as risk_category
FROM organizations o
LEFT JOIN customer_health_metrics chm ON o.id = chm.organization_id
LEFT JOIN customer_usage_summary cus ON o.id = cus.organization_id
WHERE o.status = 'active';

-- Feature Adoption Analysis
CREATE VIEW feature_adoption_rates AS
SELECT 
    ful.feature_name,
    ful.feature_category,
    COUNT(DISTINCT ful.organization_id) as organizations_using,
    COUNT(DISTINCT ful.user_id) as users_using,
    AVG(ful.duration_seconds) as avg_session_duration,
    COUNT(*) as total_usage_events,
    SUM(CASE WHEN ful.success = true THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
    COUNT(DISTINCT ful.organization_id)::FLOAT / (SELECT COUNT(*) FROM organizations WHERE status = 'active') as adoption_rate
FROM feature_usage_log ful
WHERE ful.timestamp > NOW() - INTERVAL '30 days'
GROUP BY ful.feature_name, ful.feature_category
ORDER BY adoption_rate DESC;

-- Indexes for performance optimization
CREATE INDEX CONCURRENTLY idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX CONCURRENTLY idx_usage_analytics_org_id ON usage_analytics(organization_id);
CREATE INDEX CONCURRENTLY idx_usage_analytics_last_active ON usage_analytics(last_active);
CREATE INDEX CONCURRENTLY idx_usage_analytics_risk_score ON usage_analytics(risk_score DESC);

CREATE INDEX CONCURRENTLY idx_customer_health_org_id ON customer_health_metrics(organization_id);
CREATE INDEX CONCURRENTLY idx_customer_health_churn_prob ON customer_health_metrics(churn_probability DESC);
CREATE INDEX CONCURRENTLY idx_customer_health_score ON customer_health_metrics(health_score);

CREATE INDEX CONCURRENTLY idx_feature_usage_org_id ON feature_usage_log(organization_id);
CREATE INDEX CONCURRENTLY idx_feature_usage_user_id ON feature_usage_log(user_id);
CREATE INDEX CONCURRENTLY idx_feature_usage_timestamp ON feature_usage_log(timestamp);
CREATE INDEX CONCURRENTLY idx_feature_usage_feature_name ON feature_usage_log(feature_name);

CREATE INDEX CONCURRENTLY idx_journey_stages_org_id ON customer_journey_stages(organization_id);
CREATE INDEX CONCURRENTLY idx_journey_stages_stage ON customer_journey_stages(stage);

CREATE INDEX CONCURRENTLY idx_support_tickets_org_id ON support_tickets(organization_id);
CREATE INDEX CONCURRENTLY idx_support_tickets_status ON support_tickets(status);
CREATE INDEX CONCURRENTLY idx_support_tickets_priority ON support_tickets(priority);

-- Real-time triggers for automated customer success actions
CREATE OR REPLACE FUNCTION trigger_customer_success_automation()
RETURNS TRIGGER AS $$
BEGIN
    -- Trigger low usage alert if user hasn't been active for 7 days
    IF NEW.last_active < NOW() - INTERVAL '7 days' AND OLD.last_active >= NOW() - INTERVAL '7 days' THEN
        INSERT INTO cs_automation_actions (
            organization_id, 
            trigger_type, 
            trigger_data, 
            action_type, 
            action_content,
            scheduled_at
        ) VALUES (
            NEW.organization_id,
            'low_usage',
            json_build_object('user_id', NEW.user_id, 'last_active', NEW.last_active),
            'email',
            'Low usage detection - re-engagement email',
            NOW() + INTERVAL '1 hour'
        );
    END IF;
    
    -- Trigger churn risk alert if risk score increases significantly
    IF NEW.risk_score > 0.7 AND (OLD.risk_score IS NULL OR OLD.risk_score <= 0.7) THEN
        INSERT INTO cs_automation_actions (
            organization_id,
            trigger_type,
            trigger_data,
            action_type,
            action_content,
            scheduled_at
        ) VALUES (
            NEW.organization_id,
            'high_churn_risk',
            json_build_object('user_id', NEW.user_id, 'risk_score', NEW.risk_score),
            'meeting_request',
            'High churn risk - schedule success call',
            NOW() + INTERVAL '2 hours'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on usage_analytics updates
CREATE TRIGGER usage_analytics_automation_trigger
    AFTER UPDATE ON usage_analytics
    FOR EACH ROW
    EXECUTE FUNCTION trigger_customer_success_automation();

-- Function to calculate customer health score
CREATE OR REPLACE FUNCTION calculate_customer_health_score(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    health_score INTEGER := 50; -- Start with baseline
    usage_score INTEGER := 0;
    engagement_score INTEGER := 0;
    support_score INTEGER := 0;
    adoption_score INTEGER := 0;
BEGIN
    -- Usage score (0-25 points)
    SELECT 
        CASE 
            WHEN weekly_active_users >= 5 THEN 25
            WHEN weekly_active_users >= 3 THEN 20
            WHEN weekly_active_users >= 1 THEN 15
            WHEN monthly_active_users >= 1 THEN 10
            ELSE 0
        END INTO usage_score
    FROM customer_usage_summary 
    WHERE organization_id = org_id;
    
    -- Engagement score (0-25 points)
    SELECT 
        CASE 
            WHEN avg_usage_frequency >= 20 THEN 25
            WHEN avg_usage_frequency >= 10 THEN 20
            WHEN avg_usage_frequency >= 5 THEN 15
            WHEN avg_usage_frequency >= 1 THEN 10
            ELSE 0
        END INTO engagement_score
    FROM customer_usage_summary 
    WHERE organization_id = org_id;
    
    -- Support score (0-25 points) - fewer tickets = higher score
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 25
            WHEN COUNT(*) <= 2 THEN 20
            WHEN COUNT(*) <= 5 THEN 15
            WHEN COUNT(*) <= 10 THEN 10
            ELSE 5
        END INTO support_score
    FROM support_tickets 
    WHERE organization_id = org_id 
    AND created_at > NOW() - INTERVAL '30 days'
    AND status IN ('open', 'in_progress');
    
    -- Feature adoption score (0-25 points)
    SELECT 
        CASE 
            WHEN features_used >= 8 THEN 25  -- Using most features
            WHEN features_used >= 6 THEN 20
            WHEN features_used >= 4 THEN 15
            WHEN features_used >= 2 THEN 10
            ELSE 5
        END INTO adoption_score
    FROM customer_usage_summary 
    WHERE organization_id = org_id;
    
    -- Calculate final health score
    health_score := COALESCE(usage_score, 0) + 
                   COALESCE(engagement_score, 0) + 
                   COALESCE(support_score, 0) + 
                   COALESCE(adoption_score, 0);
    
    -- Ensure score is within bounds
    health_score := GREATEST(0, LEAST(100, health_score));
    
    RETURN health_score;
END;
$$ LANGUAGE plpgsql;

-- Function to update all customer health metrics (run via cron job)
CREATE OR REPLACE FUNCTION update_all_customer_health_metrics()
RETURNS INTEGER AS $$
DECLARE
    org_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    FOR org_record IN 
        SELECT id FROM organizations WHERE status = 'active'
    LOOP
        INSERT INTO customer_health_metrics (
            organization_id,
            health_score,
            feature_adoption_rate,
            total_projects,
            calculated_at
        ) VALUES (
            org_record.id,
            calculate_customer_health_score(org_record.id),
            (
                SELECT COALESCE(features_used::FLOAT / 10.0 * 100, 0) -- Assuming 10 total features
                FROM customer_usage_summary 
                WHERE organization_id = org_record.id
            ),
            (
                SELECT COUNT(*) 
                FROM projects 
                WHERE organization_id = org_record.id
            ),
            NOW()
        )
        ON CONFLICT (organization_id) 
        DO UPDATE SET
            health_score = EXCLUDED.health_score,
            feature_adoption_rate = EXCLUDED.feature_adoption_rate,
            total_projects = EXCLUDED.total_projects,
            calculated_at = EXCLUDED.calculated_at,
            updated_at = NOW();
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data for demonstration
INSERT INTO usage_analytics (user_id, organization_id, feature_used, usage_frequency, last_active, risk_score) VALUES
    (gen_random_uuid(), gen_random_uuid(), 'ai_estimation', 15, NOW() - INTERVAL '2 hours', 0.15),
    (gen_random_uuid(), gen_random_uuid(), 'floor_plan_markup', 8, NOW() - INTERVAL '1 day', 0.25),
    (gen_random_uuid(), gen_random_uuid(), 'historical_analysis', 22, NOW() - INTERVAL '30 minutes', 0.05),
    (gen_random_uuid(), gen_random_uuid(), 'nec_compliance', 5, NOW() - INTERVAL '3 days', 0.45),
    (gen_random_uuid(), gen_random_uuid(), 'construction_guides', 12, NOW() - INTERVAL '6 hours', 0.20);

-- Comments for documentation
COMMENT ON TABLE usage_analytics IS 'Tracks user engagement and feature usage patterns for churn prediction';
COMMENT ON TABLE customer_health_metrics IS 'Comprehensive customer success scoring and health tracking';
COMMENT ON TABLE feature_usage_log IS 'Detailed audit log of all feature interactions';
COMMENT ON TABLE customer_journey_stages IS 'Tracks customer progression through onboarding and adoption stages';
COMMENT ON TABLE cs_automation_actions IS 'Automated customer success interventions and their outcomes';
COMMENT ON TABLE product_feedback IS 'Customer feedback, feature requests, and bug reports';
COMMENT ON TABLE support_tickets IS 'Customer support ticket tracking and resolution';

COMMENT ON FUNCTION calculate_customer_health_score IS 'Calculates composite customer health score from usage, engagement, support, and adoption metrics';
COMMENT ON FUNCTION update_all_customer_health_metrics IS 'Batch updates all customer health metrics - should be run via cron job';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO application_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO application_user;