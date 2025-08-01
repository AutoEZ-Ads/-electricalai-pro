-- Electrical Estimation System Database Schema
-- This script initializes the PostgreSQL database for the N8N-based electrical estimation system

-- Create database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table - Main project information
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    building_type VARCHAR(50) CHECK (building_type IN ('residential', 'commercial', 'industrial')),
    square_footage INTEGER,
    floors INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'calculating', 'completed', 'approved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    client_name VARCHAR(255),
    client_contact JSONB,
    project_specifications JSONB,
    blueprint_files JSONB DEFAULT '[]'::jsonb
);

-- Estimations table - Store calculation results
CREATE TABLE IF NOT EXISTS estimations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_type VARCHAR(50) DEFAULT 'full' CHECK (estimation_type IN ('conceptual', 'preliminary', 'detailed', 'full')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    
    -- Calculation results
    calculations JSONB DEFAULT '{}'::jsonb,
    material_cost DECIMAL(12,2) DEFAULT 0,
    labor_cost DECIMAL(12,2) DEFAULT 0,
    equipment_cost DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    markup_percentage DECIMAL(5,2) DEFAULT 15.00,
    final_bid_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Metadata
    accuracy_level VARCHAR(20) DEFAULT 'preliminary',
    confidence_score INTEGER DEFAULT 75 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Electrical components table - Standard electrical items
CREATE TABLE IF NOT EXISTS electrical_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer VARCHAR(100),
    model_number VARCHAR(100),
    
    -- Pricing information
    unit_cost DECIMAL(10,2) NOT NULL,
    unit_type VARCHAR(20) DEFAULT 'each' CHECK (unit_type IN ('each', 'linear_foot', 'square_foot', 'hour', 'pound')),
    supplier VARCHAR(100),
    
    -- Labor information
    neca_labor_unit DECIMAL(8,4), -- Hours per unit based on NECA standards
    installation_complexity VARCHAR(20) DEFAULT 'standard' CHECK (installation_complexity IN ('simple', 'standard', 'complex')),
    
    -- Technical specifications
    specifications JSONB DEFAULT '{}'::jsonb,
    nec_references TEXT[],
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    last_price_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project components table - Components used in specific projects
CREATE TABLE IF NOT EXISTS project_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    component_id UUID REFERENCES electrical_components(id),
    
    -- Quantity and calculations
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost_override DECIMAL(10,2), -- Allow project-specific pricing
    total_material_cost DECIMAL(12,2) GENERATED ALWAYS AS (
        quantity * COALESCE(unit_cost_override, (SELECT unit_cost FROM electrical_components WHERE id = component_id))
    ) STORED,
    
    -- Labor calculations
    labor_hours DECIMAL(8,2),
    labor_rate DECIMAL(8,2) DEFAULT 75.00, -- Default electrician rate per hour
    total_labor_cost DECIMAL(12,2) GENERATED ALWAYS AS (labor_hours * labor_rate) STORED,
    
    -- Location and installation details
    location_description TEXT,
    installation_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NEC compliance checks table
CREATE TABLE IF NOT EXISTS nec_compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    
    check_type VARCHAR(100) NOT NULL,
    nec_article VARCHAR(20),
    nec_section VARCHAR(50),
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'warning')),
    details JSONB DEFAULT '{}'::jsonb,
    
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_by VARCHAR(100) DEFAULT 'automated'
);

-- Load calculations table
CREATE TABLE IF NOT EXISTS load_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    
    -- Load calculation details
    calculation_type VARCHAR(50) NOT NULL CHECK (calculation_type IN ('general_lighting', 'receptacle', 'appliance', 'motor', 'total')),
    area_served DECIMAL(10,2), -- Square footage
    load_watts DECIMAL(10,2) NOT NULL,
    demand_factor DECIMAL(5,4) DEFAULT 1.0000,
    demand_load DECIMAL(10,2) GENERATED ALWAYS AS (load_watts * demand_factor) STORED,
    
    -- Circuit information
    voltage INTEGER DEFAULT 120 CHECK (voltage IN (120, 240, 277, 480)),
    phase_type VARCHAR(20) DEFAULT 'single' CHECK (phase_type IN ('single', 'three')),
    circuit_amperage DECIMAL(8,2) GENERATED ALWAYS AS (
        CASE 
            WHEN phase_type = 'single' THEN demand_load / voltage
            WHEN phase_type = 'three' THEN demand_load / (voltage * 1.732)
        END
    ) STORED,
    
    -- NEC article references
    nec_article VARCHAR(20),
    calculation_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit calculations table
CREATE TABLE IF NOT EXISTS circuit_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    
    circuit_number VARCHAR(20),
    circuit_description TEXT,
    load_amperage DECIMAL(8,2) NOT NULL,
    circuit_length DECIMAL(10,2), -- Feet
    
    -- Wire sizing
    wire_size_awg VARCHAR(10),
    wire_type VARCHAR(50) DEFAULT 'THWN',
    conduit_size VARCHAR(10),
    conduit_type VARCHAR(50) DEFAULT 'EMT',
    
    -- Voltage drop calculations
    voltage_drop_percentage DECIMAL(5,2),
    voltage_drop_compliant BOOLEAN DEFAULT true,
    
    -- Protection
    breaker_size INTEGER,
    protection_type VARCHAR(50) DEFAULT 'Circuit Breaker',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- N8N workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    
    workflow_name VARCHAR(100) NOT NULL,
    n8n_execution_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'canceled')),
    
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Material pricing history table
CREATE TABLE IF NOT EXISTS material_pricing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES electrical_components(id) ON DELETE CASCADE,
    
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    price_change_percentage DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE 
            WHEN old_price > 0 THEN ((new_price - old_price) / old_price) * 100
            ELSE 0
        END
    ) STORED,
    
    change_reason VARCHAR(100),
    supplier VARCHAR(100),
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historical project performance table for learning
CREATE TABLE IF NOT EXISTS project_performance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    estimation_id UUID REFERENCES estimations(id) ON DELETE CASCADE,
    
    -- Original estimates
    estimated_material_cost DECIMAL(12,2),
    estimated_labor_cost DECIMAL(12,2),
    estimated_total_cost DECIMAL(12,2),
    estimated_duration INTEGER, -- days
    
    -- Actual results
    actual_material_cost DECIMAL(12,2),
    actual_labor_cost DECIMAL(12,2),
    actual_total_cost DECIMAL(12,2),
    actual_duration INTEGER, -- days
    
    -- Variance analysis
    cost_variance_percentage DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE 
            WHEN estimated_total_cost > 0 THEN 
                ((actual_total_cost - estimated_total_cost) / estimated_total_cost) * 100
            ELSE 0
        END
    ) STORED,
    
    schedule_variance_percentage DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE 
            WHEN estimated_duration > 0 THEN 
                ((actual_duration - estimated_duration)::DECIMAL / estimated_duration) * 100
            ELSE 0
        END
    ) STORED,
    
    -- Project characteristics for learning
    building_type VARCHAR(50),
    square_footage INTEGER,
    complexity_level VARCHAR(20) CHECK (complexity_level IN ('low', 'mid', 'high', 'super-high')),
    project_specifications JSONB,
    
    -- Performance factors
    change_orders_count INTEGER DEFAULT 0,
    change_orders_cost DECIMAL(12,2) DEFAULT 0,
    weather_delays INTEGER DEFAULT 0, -- days
    permit_delays INTEGER DEFAULT 0, -- days
    
    -- Quality metrics
    rework_percentage DECIMAL(5,2) DEFAULT 0,
    client_satisfaction_score INTEGER CHECK (client_satisfaction_score >= 1 AND client_satisfaction_score <= 10),
    inspection_failures INTEGER DEFAULT 0,
    
    -- Learning metadata
    lessons_learned TEXT,
    improvement_opportunities TEXT,
    contractor_name VARCHAR(100),
    electrician_crew_size INTEGER,
    project_manager VARCHAR(100),
    
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estimating accuracy tracking table
CREATE TABLE IF NOT EXISTS estimation_accuracy_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_type VARCHAR(50),
    complexity_level VARCHAR(20),
    square_footage_range VARCHAR(20), -- e.g., "10000-50000"
    
    -- Accuracy metrics
    total_estimates INTEGER DEFAULT 0,
    accurate_estimates INTEGER DEFAULT 0, -- within 5% variance
    average_cost_variance DECIMAL(8,4) DEFAULT 0,
    average_schedule_variance DECIMAL(8,4) DEFAULT 0,
    
    -- Cost breakdown accuracy
    material_cost_accuracy DECIMAL(8,4) DEFAULT 0,
    labor_cost_accuracy DECIMAL(8,4) DEFAULT 0,
    
    -- Trending data
    accuracy_trend VARCHAR(20) DEFAULT 'stable', -- improving, declining, stable
    last_calibration TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Machine learning feature store for estimation models
CREATE TABLE IF NOT EXISTS ml_estimation_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Feature vector for ML models
    features JSONB NOT NULL,
    
    -- Target variables (actual outcomes)
    target_cost DECIMAL(12,2),
    target_duration INTEGER,
    target_complexity_score DECIMAL(5,2),
    
    -- Model metadata
    feature_version VARCHAR(20) DEFAULT '1.0',
    data_quality_score DECIMAL(3,2) DEFAULT 1.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Similar projects lookup table for analogous estimating
CREATE TABLE IF NOT EXISTS similar_projects_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Similarity matching features
    building_type VARCHAR(50),
    complexity_level VARCHAR(20),
    square_footage INTEGER,
    floors INTEGER,
    
    -- Calculated similarity scores with other projects
    similar_projects JSONB DEFAULT '[]'::jsonb,
    
    -- Performance summary for quick lookup
    avg_cost_per_sqft DECIMAL(8,2),
    avg_duration_per_sqft DECIMAL(6,4),
    success_indicators JSONB,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_building_type ON projects(building_type);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

CREATE INDEX IF NOT EXISTS idx_estimations_project_id ON estimations(project_id);
CREATE INDEX IF NOT EXISTS idx_estimations_status ON estimations(status);
CREATE INDEX IF NOT EXISTS idx_estimations_created_at ON estimations(created_at);

CREATE INDEX IF NOT EXISTS idx_electrical_components_category ON electrical_components(category);
CREATE INDEX IF NOT EXISTS idx_electrical_components_active ON electrical_components(active);

CREATE INDEX IF NOT EXISTS idx_project_components_project_id ON project_components(project_id);
CREATE INDEX IF NOT EXISTS idx_project_components_estimation_id ON project_components(estimation_id);

CREATE INDEX IF NOT EXISTS idx_nec_compliance_project_id ON nec_compliance_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_nec_compliance_status ON nec_compliance_checks(status);

-- Historical data indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_performance_building_type ON project_performance_history(building_type);
CREATE INDEX IF NOT EXISTS idx_project_performance_complexity ON project_performance_history(complexity_level);
CREATE INDEX IF NOT EXISTS idx_project_performance_sqft ON project_performance_history(square_footage);
CREATE INDEX IF NOT EXISTS idx_project_performance_completed ON project_performance_history(completed_at);

CREATE INDEX IF NOT EXISTS idx_estimation_accuracy_type_complexity ON estimation_accuracy_tracking(project_type, complexity_level);
CREATE INDEX IF NOT EXISTS idx_estimation_accuracy_sqft_range ON estimation_accuracy_tracking(square_footage_range);

CREATE INDEX IF NOT EXISTS idx_similar_projects_building_type ON similar_projects_index(building_type);
CREATE INDEX IF NOT EXISTS idx_similar_projects_complexity ON similar_projects_index(complexity_level);
CREATE INDEX IF NOT EXISTS idx_similar_projects_sqft ON similar_projects_index(square_footage);

CREATE INDEX IF NOT EXISTS idx_ml_features_project_id ON ml_estimation_features(project_id);
CREATE INDEX IF NOT EXISTS idx_ml_features_version ON ml_estimation_features(feature_version);

-- Insert sample electrical components
INSERT INTO electrical_components (category, subcategory, name, description, unit_cost, unit_type, neca_labor_unit, specifications) VALUES
-- Outlets and Receptacles
('Outlets', 'Standard', '15A Duplex Receptacle', 'Standard 15-amp duplex receptacle', 2.50, 'each', 0.15, '{"voltage": 120, "amperage": 15, "configuration": "5-15R"}'),
('Outlets', 'GFCI', '20A GFCI Receptacle', '20-amp GFCI protected receptacle', 18.50, 'each', 0.25, '{"voltage": 120, "amperage": 20, "gfci": true, "configuration": "5-20R"}'),
('Outlets', 'USB', 'USB Duplex Receptacle', 'Duplex receptacle with USB charging ports', 35.00, 'each', 0.15, '{"voltage": 120, "amperage": 15, "usb_ports": 2}'),

-- Switches
('Switches', 'Toggle', 'Single Pole Switch', 'Standard single pole toggle switch', 1.75, 'each', 0.12, '{"poles": 1, "voltage": 120, "amperage": 15}'),
('Switches', 'Dimmer', 'LED Dimmer Switch', 'Dimmer switch compatible with LED fixtures', 25.00, 'each', 0.20, '{"dimmable": true, "led_compatible": true, "voltage": 120}'),
('Switches', 'Smart', 'Smart WiFi Switch', 'WiFi enabled smart switch', 45.00, 'each', 0.30, '{"smart": true, "wifi": true, "app_control": true}'),

-- Wire and Cable
('Wire', 'Building Wire', '#12 THWN Copper', '12 AWG THWN copper building wire', 0.85, 'linear_foot', 0.08, '{"awg": 12, "material": "copper", "insulation": "THWN", "voltage_rating": 600}'),
('Wire', 'Building Wire', '#14 THWN Copper', '14 AWG THWN copper building wire', 0.65, 'linear_foot', 0.08, '{"awg": 14, "material": "copper", "insulation": "THWN", "voltage_rating": 600}'),
('Wire', 'Building Wire', '#10 THWN Copper', '10 AWG THWN copper building wire', 1.25, 'linear_foot', 0.08, '{"awg": 10, "material": "copper", "insulation": "THWN", "voltage_rating": 600}'),

-- Conduit
('Conduit', 'EMT', '1/2" EMT Conduit', '1/2 inch EMT electrical metallic tubing', 1.85, 'linear_foot', 0.25, '{"size": "1/2", "type": "EMT", "material": "steel"}'),
('Conduit', 'EMT', '3/4" EMT Conduit', '3/4 inch EMT electrical metallic tubing', 2.45, 'linear_foot', 0.25, '{"size": "3/4", "type": "EMT", "material": "steel"}'),
('Conduit', 'PVC', '1/2" PVC Conduit', '1/2 inch PVC Schedule 40 conduit', 0.95, 'linear_foot', 0.20, '{"size": "1/2", "type": "PVC", "schedule": 40}'),

-- Panels and Breakers
('Panels', 'Load Center', '200A Main Panel', '200-amp main electrical panel', 485.00, 'each', 4.50, '{"amperage": 200, "spaces": 40, "voltage": 240, "type": "main_breaker"}'),
('Panels', 'Subpanel', '100A Subpanel', '100-amp electrical subpanel', 275.00, 'each', 3.00, '{"amperage": 100, "spaces": 24, "voltage": 240, "type": "subpanel"}'),
('Breakers', 'Single Pole', '20A Single Pole Breaker', '20-amp single pole circuit breaker', 12.50, 'each', 0.15, '{"amperage": 20, "poles": 1, "voltage": 120}'),
('Breakers', 'Double Pole', '40A Double Pole Breaker', '40-amp double pole circuit breaker', 35.00, 'each', 0.20, '{"amperage": 40, "poles": 2, "voltage": 240}'),

-- Fixtures
('Fixtures', 'Recessed', '6" LED Recessed Light', '6-inch LED recessed downlight', 45.00, 'each', 0.75, '{"diameter": 6, "led": true, "wattage": 15, "lumens": 1200}'),
('Fixtures', 'Ceiling', 'LED Ceiling Fixture', 'Surface mount LED ceiling fixture', 65.00, 'each', 0.50, '{"led": true, "wattage": 24, "mounting": "surface"}'),
('Fixtures', 'Exterior', 'LED Wall Pack', 'Commercial LED wall pack fixture', 125.00, 'each', 1.25, '{"led": true, "wattage": 40, "location": "exterior", "weatherproof": true}')

ON CONFLICT DO NOTHING;

-- Insert sample project for testing
INSERT INTO projects (name, description, building_type, square_footage, floors, client_name, project_specifications) VALUES
('Sample Residential Project', 'New construction single family home', 'residential', 2400, 2, 'John Smith', 
'{"bedrooms": 4, "bathrooms": 3, "kitchen": 1, "living_areas": 2, "garage": 2, "basement": false}'::jsonb)
ON CONFLICT DO NOTHING;

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimations_updated_at BEFORE UPDATE ON estimations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions for n8n user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO n8n_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO n8n_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO n8n_user;
GRANT USAGE ON SCHEMA public TO n8n_user;

-- Create views for reporting
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    p.id,
    p.name,
    p.building_type,
    p.square_footage,
    p.status,
    p.client_name,
    p.created_at,
    e.total_cost,
    e.confidence_score,
    COUNT(pc.id) as component_count
FROM projects p
LEFT JOIN estimations e ON p.id = e.project_id AND e.status = 'completed'
LEFT JOIN project_components pc ON p.id = pc.project_id
GROUP BY p.id, p.name, p.building_type, p.square_footage, p.status, p.client_name, p.created_at, e.total_cost, e.confidence_score;

COMMENT ON DATABASE electrical_estimation IS 'N8N-based Electrical Estimation System Database';