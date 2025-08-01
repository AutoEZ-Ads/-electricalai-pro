-- Advanced Database Query Optimization for Electrical Estimation System
-- Targeting sub-100ms response times for all critical queries

-- ============================================================================
-- 1. OPTIMIZED INDEXES FOR ELECTRICAL ESTIMATION QUERIES
-- ============================================================================

-- Composite indexes for electrical calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_electrical_calculations_composite 
ON electrical_calculations (project_id, calculation_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_electrical_calculations_status_priority 
ON electrical_calculations (status, priority, updated_at DESC) 
WHERE status IN ('pending', 'processing');

-- Material database optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_category_region 
ON materials (category, region_code, effective_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_search_text 
ON materials USING gin(to_tsvector('english', name || ' ' || description));

-- NEC compliance optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nec_rules_code_section 
ON nec_compliance_rules (code_section, rule_type, nec_version);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_validations_project 
ON compliance_validations (project_id, validation_status, created_at DESC);

-- Project and estimation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_created 
ON projects (status, created_at DESC) 
WHERE status IN ('active', 'estimating');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimations_project_version 
ON estimations (project_id, version DESC, is_current) 
WHERE is_current = true;

-- Workflow and integration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_n8n_executions_status_time 
ON n8n_executions (status, start_time DESC) 
WHERE status IN ('running', 'waiting');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monday_integration_sync 
ON monday_integration_log (sync_status, last_sync_at DESC, project_id);

-- Edge computing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edge_calculations_latency 
ON edge_calculations (node_id, processing_time_ms, timestamp DESC) 
WHERE processing_time_ms > 5;

-- Partial indexes for frequently filtered data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculations_recent_active 
ON electrical_calculations (created_at DESC, project_id) 
WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'active';

-- ============================================================================
-- 2. OPTIMIZED QUERY PATTERNS
-- ============================================================================

-- Fast project estimation summary (target: <50ms)
CREATE OR REPLACE FUNCTION get_project_estimation_summary(p_project_id UUID)
RETURNS TABLE (
    project_id UUID,
    total_cost DECIMAL(12,2),
    material_cost DECIMAL(12,2),
    labor_cost DECIMAL(12,2),
    calculation_count INTEGER,
    last_updated TIMESTAMP,
    compliance_status TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH project_stats AS (
        SELECT 
            p.id,
            e.total_estimated_cost,
            e.material_cost_total,
            e.labor_cost_total,
            e.updated_at,
            COUNT(ec.id) as calc_count
        FROM projects p
        LEFT JOIN estimations e ON p.id = e.project_id AND e.is_current = true
        LEFT JOIN electrical_calculations ec ON p.id = ec.project_id 
            AND ec.created_at >= NOW() - INTERVAL '7 days'
        WHERE p.id = p_project_id
        GROUP BY p.id, e.total_estimated_cost, e.material_cost_total, 
                 e.labor_cost_total, e.updated_at
    ),
    compliance_summary AS (
        SELECT 
            project_id as pid,
            CASE 
                WHEN COUNT(*) FILTER (WHERE validation_status = 'failed') > 0 THEN 'non_compliant'
                WHEN COUNT(*) FILTER (WHERE validation_status = 'pending') > 0 THEN 'pending'
                ELSE 'compliant'
            END as status
        FROM compliance_validations 
        WHERE project_id = p_project_id 
            AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY project_id
    )
    SELECT 
        ps.id,
        COALESCE(ps.total_estimated_cost, 0)::DECIMAL(12,2),
        COALESCE(ps.material_cost_total, 0)::DECIMAL(12,2),
        COALESCE(ps.labor_cost_total, 0)::DECIMAL(12,2),
        COALESCE(ps.calc_count, 0)::INTEGER,
        ps.updated_at,
        COALESCE(cs.status, 'unknown')
    FROM project_stats ps
    LEFT JOIN compliance_summary cs ON ps.id = cs.pid;
END;
$$;

-- Ultra-fast material lookup with caching (target: <25ms)
CREATE OR REPLACE FUNCTION get_material_pricing(
    p_material_ids UUID[],
    p_region_code TEXT DEFAULT 'US_NATIONAL',
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    material_id UUID,
    name TEXT,
    current_price DECIMAL(10,4),
    unit TEXT,
    price_date DATE,
    trend_7d DECIMAL(5,2)
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH current_prices AS (
        SELECT DISTINCT ON (m.id)
            m.id,
            m.name,
            mp.price,
            m.unit,
            mp.effective_date,
            mp.created_at
        FROM materials m
        JOIN material_prices mp ON m.id = mp.material_id
        WHERE m.id = ANY(p_material_ids)
            AND mp.region_code = p_region_code
            AND mp.effective_date <= p_date
        ORDER BY m.id, mp.effective_date DESC, mp.created_at DESC
    ),
    price_trends AS (
        SELECT 
            material_id,
            (AVG(price) FILTER (WHERE effective_date >= p_date - INTERVAL '7 days') - 
             AVG(price) FILTER (WHERE effective_date >= p_date - INTERVAL '14 days' 
                                AND effective_date < p_date - INTERVAL '7 days')) / 
             AVG(price) FILTER (WHERE effective_date >= p_date - INTERVAL '14 days' 
                                AND effective_date < p_date - INTERVAL '7 days') * 100 as trend
        FROM material_prices 
        WHERE material_id = ANY(p_material_ids)
            AND region_code = p_region_code
            AND effective_date >= p_date - INTERVAL '14 days'
        GROUP BY material_id
    )
    SELECT 
        cp.id,
        cp.name,
        cp.price,
        cp.unit,
        cp.effective_date,
        COALESCE(pt.trend, 0)::DECIMAL(5,2)
    FROM current_prices cp
    LEFT JOIN price_trends pt ON cp.id = pt.material_id;
END;
$$;

-- High-performance NEC compliance check (target: <30ms)
CREATE OR REPLACE FUNCTION check_nec_compliance_fast(
    p_calculation_data JSONB,
    p_nec_version TEXT DEFAULT '2023'
)
RETURNS TABLE (
    is_compliant BOOLEAN,
    violations JSONB,
    recommendations JSONB,
    check_time_ms INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    violations_array JSONB := '[]'::JSONB;
    recommendations_array JSONB := '[]'::JSONB;
    is_compliant_result BOOLEAN := true;
BEGIN
    start_time := clock_timestamp();
    
    -- Check critical NEC rules with optimized queries
    WITH rule_checks AS (
        SELECT 
            ncr.id,
            ncr.rule_description,
            ncr.violation_message,
            ncr.recommendation,
            -- Dynamic rule evaluation using JSONB operators
            CASE 
                WHEN ncr.rule_condition IS NOT NULL THEN
                    (p_calculation_data #> ncr.rule_path::text[]) @> ncr.rule_condition
                ELSE false
            END as rule_violated
        FROM nec_compliance_rules ncr
        WHERE ncr.nec_version = p_nec_version
            AND ncr.is_active = true
            AND (
                -- Only check relevant rules based on calculation type
                (p_calculation_data->>'calculation_type' = 'load_calculation' AND ncr.applies_to_load = true) OR
                (p_calculation_data->>'calculation_type' = 'wire_sizing' AND ncr.applies_to_wiring = true) OR
                (p_calculation_data->>'calculation_type' = 'panel_sizing' AND ncr.applies_to_panels = true)
            )
    )
    SELECT 
        COALESCE(bool_and(NOT rule_violated), true),
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'rule_id', id,
                'message', violation_message,
                'description', rule_description
            )
        ) FILTER (WHERE rule_violated), '[]'::JSONB),
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'recommendation', recommendation
            )
        ) FILTER (WHERE rule_violated), '[]'::JSONB)
    INTO is_compliant_result, violations_array, recommendations_array
    FROM rule_checks;
    
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        is_compliant_result,
        violations_array,
        recommendations_array,
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
END;
$$;

-- ============================================================================
-- 3. MATERIALIZED VIEWS FOR COMPLEX AGGREGATIONS
-- ============================================================================

-- Material price trends (refreshed every hour)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_material_price_trends AS
SELECT 
    m.id as material_id,
    m.name,
    m.category,
    mp.region_code,
    AVG(mp.price) as avg_price_30d,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mp.price) as median_price_30d,
    STDDEV(mp.price) as price_volatility,
    COUNT(*) as price_points,
    MAX(mp.effective_date) as latest_price_date,
    (FIRST_VALUE(mp.price) OVER (
        PARTITION BY m.id, mp.region_code 
        ORDER BY mp.effective_date DESC
    ) - FIRST_VALUE(mp.price) OVER (
        PARTITION BY m.id, mp.region_code 
        ORDER BY mp.effective_date ASC
    )) / FIRST_VALUE(mp.price) OVER (
        PARTITION BY m.id, mp.region_code 
        ORDER BY mp.effective_date ASC
    ) * 100 as trend_30d_percent
FROM materials m
JOIN material_prices mp ON m.id = mp.material_id
WHERE mp.effective_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.id, m.name, m.category, mp.region_code;

CREATE UNIQUE INDEX ON mv_material_price_trends (material_id, region_code);

-- Project performance metrics (refreshed every 15 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_performance AS
SELECT 
    p.id as project_id,
    p.name,
    p.status,
    COUNT(ec.id) as total_calculations,
    AVG(ec.processing_time_ms) as avg_processing_time,
    COUNT(ec.id) FILTER (WHERE ec.created_at >= NOW() - INTERVAL '24 hours') as calculations_24h,
    AVG(ec.processing_time_ms) FILTER (WHERE ec.created_at >= NOW() - INTERVAL '24 hours') as avg_processing_time_24h,
    COUNT(cv.id) as compliance_checks,
    COUNT(cv.id) FILTER (WHERE cv.validation_status = 'passed') as compliance_passed,
    COUNT(cv.id) FILTER (WHERE cv.validation_status = 'failed') as compliance_failed,
    COALESCE(e.total_estimated_cost, 0) as current_estimated_cost,
    p.updated_at
FROM projects p
LEFT JOIN electrical_calculations ec ON p.id = ec.project_id
LEFT JOIN compliance_validations cv ON p.id = cv.project_id
LEFT JOIN estimations e ON p.id = e.project_id AND e.is_current = true
WHERE p.status IN ('active', 'estimating', 'completed')
GROUP BY p.id, p.name, p.status, e.total_estimated_cost, p.updated_at;

CREATE UNIQUE INDEX ON mv_project_performance (project_id);

-- Edge computing performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_edge_performance AS
SELECT 
    node_id,
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as calculation_count,
    AVG(processing_time_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_latency_ms,
    COUNT(*) FILTER (WHERE processing_time_ms > 5) as slow_calculations,
    COUNT(*) FILTER (WHERE error_occurred = true) as error_count
FROM edge_calculations
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY node_id, DATE_TRUNC('hour', timestamp);

CREATE UNIQUE INDEX ON mv_edge_performance (node_id, hour);

-- ============================================================================
-- 4. AUTOMATED REFRESH PROCEDURES
-- ============================================================================

-- Refresh materialized views procedure
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh in order of dependency
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_material_price_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_edge_performance;
    
    -- Update statistics
    ANALYZE mv_material_price_trends;
    ANALYZE mv_project_performance;
    ANALYZE mv_edge_performance;
END;
$$;

-- ============================================================================
-- 5. QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Function to log slow queries
CREATE OR REPLACE FUNCTION log_slow_query(
    query_name TEXT,
    execution_time_ms INTEGER,
    query_params JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO query_performance_log (
        query_name,
        execution_time_ms,
        query_params,
        logged_at
    ) VALUES (
        query_name,
        execution_time_ms,
        query_params,
        NOW()
    );
    
    -- Alert if query is too slow
    IF execution_time_ms > 100 THEN
        INSERT INTO system_alerts (
            alert_type,
            severity,
            message,
            context,
            created_at
        ) VALUES (
            'slow_query',
            CASE 
                WHEN execution_time_ms > 1000 THEN 'critical'
                WHEN execution_time_ms > 500 THEN 'warning'
                ELSE 'info'
            END,
            format('Slow query detected: %s took %sms', query_name, execution_time_ms),
            jsonb_build_object(
                'query_name', query_name,
                'execution_time_ms', execution_time_ms,
                'query_params', query_params
            ),
            NOW()
        );
    END IF;
END;
$$;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_name TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    query_params JSONB,
    logged_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_query_performance_log_name_time 
ON query_performance_log (query_name, logged_at DESC);

-- ============================================================================
-- 6. CONNECTION POOLING AND OPTIMIZATION SETTINGS
-- ============================================================================

-- Optimized PostgreSQL settings for electrical estimation workload
-- Add these to postgresql.conf:

/*
# Memory settings
shared_buffers = '256MB'                # 25% of RAM for typical workload
effective_cache_size = '1GB'           # 75% of RAM
work_mem = '16MB'                       # Per query working memory
maintenance_work_mem = '64MB'           # For maintenance operations

# Query planner settings
random_page_cost = 1.1                 # SSD optimized
effective_io_concurrency = 200         # SSD concurrent operations
default_statistics_target = 100        # More detailed statistics

# WAL settings
wal_buffers = '16MB'
checkpoint_completion_target = 0.9
checkpoint_timeout = '10min'

# Parallel query settings
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Logging for monitoring
log_min_duration_statement = 100       # Log queries > 100ms
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
*/

-- ============================================================================
-- 7. AUTOMATED MAINTENANCE PROCEDURES
-- ============================================================================

-- Daily maintenance procedure
CREATE OR REPLACE FUNCTION daily_database_maintenance()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update table statistics
    ANALYZE electrical_calculations;
    ANALYZE materials;
    ANALYZE material_prices;
    ANALYZE projects;
    ANALYZE estimations;
    ANALYZE compliance_validations;
    
    -- Clean old log entries (keep 30 days)
    DELETE FROM query_performance_log 
    WHERE logged_at < NOW() - INTERVAL '30 days';
    
    DELETE FROM system_alerts 
    WHERE created_at < NOW() - INTERVAL '30 days' 
        AND severity NOT IN ('critical', 'error');
    
    -- Refresh materialized views
    PERFORM refresh_performance_views();
    
    -- Log maintenance completion
    INSERT INTO system_alerts (
        alert_type, severity, message, created_at
    ) VALUES (
        'maintenance', 'info', 'Daily database maintenance completed', NOW()
    );
END;
$$;

-- Schedule daily maintenance (add to cron or use pg_cron)
-- SELECT cron.schedule('daily-maintenance', '2 0 * * *', 'SELECT daily_database_maintenance();');

-- ============================================================================
-- 8. PERFORMANCE TESTING QUERIES
-- ============================================================================

-- Test query performance with timing
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTEGER;
BEGIN
    -- Test project estimation summary
    start_time := clock_timestamp();
    PERFORM * FROM get_project_estimation_summary('your-test-project-id');
    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time));
    
    PERFORM log_slow_query('get_project_estimation_summary', execution_time);
    RAISE NOTICE 'Project estimation summary: %ms', execution_time;
    
    -- Test material pricing lookup
    start_time := clock_timestamp();
    PERFORM * FROM get_material_pricing(ARRAY['test-material-id-1', 'test-material-id-2']);
    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time));
    
    PERFORM log_slow_query('get_material_pricing', execution_time);
    RAISE NOTICE 'Material pricing lookup: %ms', execution_time;
    
    -- Test NEC compliance check
    start_time := clock_timestamp();
    PERFORM * FROM check_nec_compliance_fast('{"calculation_type": "load_calculation", "area_sqft": 2500}');
    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time));
    
    PERFORM log_slow_query('check_nec_compliance_fast', execution_time);
    RAISE NOTICE 'NEC compliance check: %ms', execution_time;
END;
$$;