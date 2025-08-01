-- Floor Plan Management Schema
-- Extends the electrical estimation system with comprehensive floor plan support

-- Floor plans table - stores uploaded floor plan files
CREATE TABLE IF NOT EXISTS floor_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- File information
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    
    -- Plan metadata
    plan_name VARCHAR(255),
    plan_type VARCHAR(50) DEFAULT 'floor_plan', -- floor_plan, electrical, plumbing, etc.
    floor_level INTEGER DEFAULT 1,
    scale VARCHAR(50), -- 1/4" = 1', 1:100, etc.
    drawing_number VARCHAR(50),
    revision VARCHAR(10),
    
    -- Processing status
    upload_status VARCHAR(20) DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'processing', 'processed', 'error')),
    processing_notes TEXT,
    
    -- Dimensions and coordinates
    plan_dimensions JSONB, -- {width: pixels, height: pixels, scale_factor: real_units_per_pixel}
    coordinate_system JSONB, -- Reference points for real-world coordinates
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Floor plan markups - annotations, measurements, electrical elements
CREATE TABLE IF NOT EXISTS floor_plan_markups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
    
    -- Markup type and category
    markup_type VARCHAR(50) NOT NULL CHECK (markup_type IN (
        'electrical_element', 'measurement', 'note', 'axis_point', 'dimension', 
        'area', 'symbol', 'conduit_run', 'wire_run', 'circuit_path'
    )),
    category VARCHAR(50), -- outlets, switches, panels, lighting, etc.
    
    -- Position and geometry
    coordinates JSONB NOT NULL, -- {x, y} or {x1, y1, x2, y2} for lines
    geometry_type VARCHAR(20) DEFAULT 'point' CHECK (geometry_type IN (
        'point', 'line', 'rectangle', 'circle', 'polygon', 'path'
    )),
    
    -- Markup data and properties
    markup_data JSONB NOT NULL, -- Element-specific data (voltage, amperage, type, etc.)
    description TEXT,
    label VARCHAR(100),
    
    -- Visual properties
    style JSONB DEFAULT '{}', -- Color, line width, font size, etc.
    layer VARCHAR(50) DEFAULT 'default',
    visible BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    
    -- Version control
    revision INTEGER DEFAULT 1,
    parent_markup_id UUID REFERENCES floor_plan_markups(id)
);

-- Electrical circuits - connects elements into circuits
CREATE TABLE IF NOT EXISTS floor_plan_circuits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Circuit identification
    circuit_number VARCHAR(20) NOT NULL,
    circuit_name VARCHAR(100),
    panel_id UUID, -- References the panel markup
    
    -- Circuit specifications
    voltage INTEGER DEFAULT 120,
    amperage INTEGER DEFAULT 15,
    phase_count INTEGER DEFAULT 1 CHECK (phase_count IN (1, 2, 3)),
    circuit_type VARCHAR(50), -- branch, feeder, service, etc.
    
    -- Wire and conduit specifications
    wire_type VARCHAR(50) DEFAULT 'THWN',
    wire_size VARCHAR(10) DEFAULT '#12',
    conduit_type VARCHAR(50) DEFAULT 'EMT',
    conduit_size VARCHAR(10) DEFAULT '1/2"',
    
    -- Path definition
    circuit_path JSONB, -- Array of coordinates defining the circuit path
    total_length DECIMAL(10,2), -- Total length in feet
    
    -- Load calculations
    connected_load DECIMAL(10,2) DEFAULT 0, -- VA
    demand_load DECIMAL(10,2) DEFAULT 0, -- VA
    load_factor DECIMAL(5,4) DEFAULT 1.0,
    
    -- Status and notes
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'approved', 'installed', 'tested')),
    installation_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit elements - links markups to circuits
CREATE TABLE IF NOT EXISTS floor_plan_circuit_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circuit_id UUID REFERENCES floor_plan_circuits(id) ON DELETE CASCADE,
    markup_id UUID REFERENCES floor_plan_markups(id) ON DELETE CASCADE,
    
    -- Element properties within circuit
    sequence_order INTEGER, -- Order in circuit
    load_contribution DECIMAL(10,2) DEFAULT 0, -- VA contributed by this element
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(circuit_id, markup_id)
);

-- Construction phases - organize work by installation phase
CREATE TABLE IF NOT EXISTS floor_plan_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
    
    -- Phase information
    phase_name VARCHAR(100) NOT NULL,
    phase_type VARCHAR(50) DEFAULT 'electrical' CHECK (phase_type IN (
        'electrical', 'rough_in', 'trim_out', 'final', 'testing', 'inspection'
    )),
    phase_order INTEGER DEFAULT 1,
    
    -- Scheduling
    estimated_start_date DATE,
    estimated_duration INTEGER, -- days
    actual_start_date DATE,
    actual_completion_date DATE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN (
        'planned', 'in_progress', 'completed', 'on_hold', 'cancelled'
    )),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Resources
    assigned_crew JSONB, -- Array of crew member assignments
    required_materials JSONB, -- Materials needed for this phase
    special_requirements TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase elements - links markups to construction phases
CREATE TABLE IF NOT EXISTS floor_plan_phase_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_id UUID REFERENCES floor_plan_phases(id) ON DELETE CASCADE,
    markup_id UUID REFERENCES floor_plan_markups(id) ON DELETE CASCADE,
    
    -- Element status within phase
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'failed_inspection', 'rework'
    )),
    
    -- Installation details
    install_priority INTEGER DEFAULT 5 CHECK (install_priority >= 1 AND install_priority <= 10),
    estimated_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    
    -- Quality control
    inspection_required BOOLEAN DEFAULT false,
    inspection_status VARCHAR(20) DEFAULT 'not_required' CHECK (inspection_status IN (
        'not_required', 'pending', 'passed', 'failed', 'conditional'
    )),
    inspection_notes TEXT,
    
    -- Worker assignments
    assigned_to VARCHAR(100),
    completed_by VARCHAR(100),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(phase_id, markup_id)
);

-- Measurement points - dimensional references and coordinates
CREATE TABLE IF NOT EXISTS floor_plan_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
    
    -- Measurement type
    measurement_type VARCHAR(50) NOT NULL CHECK (measurement_type IN (
        'dimension', 'area', 'distance', 'angle', 'elevation', 'coordinate'
    )),
    
    -- Measurement geometry
    start_point JSONB NOT NULL, -- {x, y, z?}
    end_point JSONB, -- For lines and distances
    measurement_path JSONB, -- For complex measurements
    
    -- Measurement values
    measured_value DECIMAL(12,4), -- Primary measurement
    unit VARCHAR(10) DEFAULT 'ft' CHECK (unit IN ('in', 'ft', 'mm', 'cm', 'm', 'sqft', 'sqm', 'deg')),
    precision_level INTEGER DEFAULT 2, -- Decimal places
    
    -- Real-world correlation
    real_world_value DECIMAL(12,4), -- Actual measured value
    scale_factor DECIMAL(10,6), -- Pixels to real-world ratio
    
    -- Reference information
    reference_type VARCHAR(50), -- What this measurement references
    reference_id UUID, -- Related markup or element
    label VARCHAR(100),
    description TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Construction guides - generated installation instructions
CREATE TABLE IF NOT EXISTS floor_plan_construction_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
    
    -- Guide metadata
    guide_name VARCHAR(255) NOT NULL,
    guide_type VARCHAR(50) DEFAULT 'installation' CHECK (guide_type IN (
        'installation', 'inspection', 'testing', 'maintenance', 'troubleshooting'
    )),
    guide_version VARCHAR(20) DEFAULT '1.0',
    
    -- Guide content
    guide_data JSONB NOT NULL, -- Complete guide structure
    instructions_markdown TEXT, -- Human-readable instructions
    
    -- Generation details
    generated_by VARCHAR(50) DEFAULT 'system',
    generation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generation_parameters JSONB, -- Parameters used to generate guide
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'review', 'approved', 'published', 'archived'
    )),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Symbol library - standardized electrical symbols
CREATE TABLE IF NOT EXISTS electrical_symbols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Symbol identification
    symbol_name VARCHAR(100) NOT NULL,
    symbol_code VARCHAR(50) UNIQUE,
    category VARCHAR(50) NOT NULL, -- outlet, switch, fixture, panel, etc.
    subcategory VARCHAR(50),
    
    -- Symbol graphics
    symbol_svg TEXT, -- SVG definition
    symbol_dwg_block VARCHAR(100), -- DWG block name
    icon_path TEXT, -- Path to icon file
    
    -- Symbol properties
    default_properties JSONB DEFAULT '{}', -- Default values for voltage, amperage, etc.
    required_properties JSONB DEFAULT '[]', -- Properties that must be specified
    validation_rules JSONB DEFAULT '{}', -- Validation rules for properties
    
    -- Standards compliance
    nec_reference VARCHAR(50), -- NEC article/section
    ieee_standard VARCHAR(50), -- IEEE standard reference
    ansi_standard VARCHAR(50), -- ANSI standard reference
    
    -- Symbol metadata
    description TEXT,
    installation_notes TEXT,
    safety_notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,
    replaced_by_symbol_id UUID REFERENCES electrical_symbols(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_floor_plans_project_id ON floor_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_status ON floor_plans(upload_status);
CREATE INDEX IF NOT EXISTS idx_floor_plans_type ON floor_plans(plan_type);

CREATE INDEX IF NOT EXISTS idx_floor_plan_markups_floor_plan_id ON floor_plan_markups(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_markups_type ON floor_plan_markups(markup_type);
CREATE INDEX IF NOT EXISTS idx_floor_plan_markups_category ON floor_plan_markups(category);
CREATE INDEX IF NOT EXISTS idx_floor_plan_markups_coordinates ON floor_plan_markups USING GIN (coordinates);

CREATE INDEX IF NOT EXISTS idx_floor_plan_circuits_floor_plan_id ON floor_plan_circuits(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_circuits_project_id ON floor_plan_circuits(project_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_circuits_number ON floor_plan_circuits(circuit_number);

CREATE INDEX IF NOT EXISTS idx_floor_plan_phases_floor_plan_id ON floor_plan_phases(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_phases_status ON floor_plan_phases(status);
CREATE INDEX IF NOT EXISTS idx_floor_plan_phases_type ON floor_plan_phases(phase_type);

CREATE INDEX IF NOT EXISTS idx_floor_plan_measurements_floor_plan_id ON floor_plan_measurements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_measurements_type ON floor_plan_measurements(measurement_type);

CREATE INDEX IF NOT EXISTS idx_electrical_symbols_category ON electrical_symbols(category);
CREATE INDEX IF NOT EXISTS idx_electrical_symbols_code ON electrical_symbols(symbol_code);
CREATE INDEX IF NOT EXISTS idx_electrical_symbols_active ON electrical_symbols(is_active);

-- Insert standard electrical symbols
INSERT INTO electrical_symbols (symbol_name, symbol_code, category, subcategory, default_properties, description) VALUES
-- Outlets and Receptacles
('15A Duplex Outlet', 'OUT-15A-DUP', 'outlet', 'standard', '{"voltage": 120, "amperage": 15, "configuration": "5-15R"}', 'Standard 15-amp duplex receptacle'),
('20A Duplex Outlet', 'OUT-20A-DUP', 'outlet', 'standard', '{"voltage": 120, "amperage": 20, "configuration": "5-20R"}', 'Standard 20-amp duplex receptacle'),
('GFCI Outlet', 'OUT-GFCI', 'outlet', 'protected', '{"voltage": 120, "amperage": 20, "gfci": true}', 'Ground fault circuit interrupter outlet'),
('USB Outlet', 'OUT-USB', 'outlet', 'specialty', '{"voltage": 120, "amperage": 15, "usb_ports": 2}', 'Duplex outlet with USB charging ports'),
('240V Outlet', 'OUT-240V', 'outlet', 'high_voltage', '{"voltage": 240, "amperage": 30, "configuration": "6-30R"}', '240V outlet for appliances'),

-- Switches
('Single Pole Switch', 'SW-SP', 'switch', 'standard', '{"voltage": 120, "amperage": 15, "poles": 1}', 'Standard single pole switch'),
('Three-Way Switch', 'SW-3W', 'switch', 'standard', '{"voltage": 120, "amperage": 15, "poles": 1, "three_way": true}', 'Three-way switch'),
('Four-Way Switch', 'SW-4W', 'switch', 'standard', '{"voltage": 120, "amperage": 15, "poles": 1, "four_way": true}', 'Four-way switch'),
('Dimmer Switch', 'SW-DIM', 'switch', 'control', '{"voltage": 120, "amperage": 15, "dimmable": true}', 'Dimmer switch'),
('Smart Switch', 'SW-SMART', 'switch', 'control', '{"voltage": 120, "amperage": 15, "smart": true, "wireless": true}', 'Smart wireless switch'),

-- Lighting Fixtures
('Recessed Light', 'FIX-REC', 'fixture', 'recessed', '{"voltage": 120, "wattage": 15, "diameter": 6}', 'Recessed downlight fixture'),
('Ceiling Light', 'FIX-CEIL', 'fixture', 'surface', '{"voltage": 120, "wattage": 60, "mounting": "surface"}', 'Surface mounted ceiling fixture'),
('Pendant Light', 'FIX-PEND', 'fixture', 'suspended', '{"voltage": 120, "wattage": 100, "mounting": "pendant"}', 'Pendant light fixture'),
('Track Light', 'FIX-TRACK', 'fixture', 'track', '{"voltage": 120, "wattage": 50, "track_length": 4}', 'Track lighting system'),
('Emergency Light', 'FIX-EMER', 'fixture', 'emergency', '{"voltage": 120, "battery_backup": true, "test_switch": true}', 'Emergency lighting fixture'),

-- Panels and Distribution
('Main Panel', 'PNL-MAIN', 'panel', 'main', '{"voltage": 240, "amperage": 200, "spaces": 40, "type": "main_breaker"}', 'Main electrical panel'),
('Subpanel', 'PNL-SUB', 'panel', 'sub', '{"voltage": 240, "amperage": 100, "spaces": 24, "type": "subpanel"}', 'Electrical subpanel'),
('Circuit Breaker', 'BRK-CB', 'breaker', 'standard', '{"amperage": 20, "poles": 1, "type": "standard"}', 'Circuit breaker'),
('GFCI Breaker', 'BRK-GFCI', 'breaker', 'protected', '{"amperage": 20, "poles": 1, "gfci": true}', 'GFCI circuit breaker'),
('Arc Fault Breaker', 'BRK-AFCI', 'breaker', 'protected', '{"amperage": 15, "poles": 1, "afci": true}', 'Arc fault circuit interrupter breaker'),

-- Junction and Connection
('Junction Box', 'JB-STD', 'junction', 'standard', '{"size": "4x4", "depth": 2.125, "knockouts": 8}', 'Standard junction box'),
('Pull Box', 'JB-PULL', 'junction', 'pull', '{"size": "12x12", "depth": 6, "access": "removable_cover"}', 'Pull box for wire pulling'),
('Transformer', 'XFMR-STD', 'transformer', 'standard', '{"primary_voltage": 480, "secondary_voltage": 120, "kva": 15}', 'Step-down transformer'),

-- Conduit and Raceways
('EMT Conduit', 'COND-EMT', 'conduit', 'metallic', '{"size": "3/4", "type": "EMT", "material": "steel"}', 'Electrical metallic tubing'),
('PVC Conduit', 'COND-PVC', 'conduit', 'non_metallic', '{"size": "3/4", "type": "PVC", "schedule": 40}', 'PVC conduit'),
('Flexible Conduit', 'COND-FLEX', 'conduit', 'flexible', '{"size": "3/4", "type": "flexible", "material": "steel"}', 'Flexible metal conduit'),

-- Grounding and Bonding
('Ground Rod', 'GRD-ROD', 'grounding', 'electrode', '{"length": 8, "diameter": 0.625, "material": "copper"}', 'Grounding electrode rod'),
('Ground Bus', 'GRD-BUS', 'grounding', 'bus', '{"amperage": 200, "material": "copper", "connections": 20}', 'Grounding bus bar'),
('Bonding Jumper', 'GRD-JUMP', 'grounding', 'jumper', '{"size": "#6", "material": "copper", "length": 12}', 'Equipment bonding jumper')

ON CONFLICT (symbol_code) DO NOTHING;

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_floor_plan_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_floor_plans_updated_at 
    BEFORE UPDATE ON floor_plans
    FOR EACH ROW EXECUTE FUNCTION update_floor_plan_updated_at_column();

CREATE TRIGGER update_floor_plan_markups_updated_at 
    BEFORE UPDATE ON floor_plan_markups
    FOR EACH ROW EXECUTE FUNCTION update_floor_plan_updated_at_column();

CREATE TRIGGER update_floor_plan_circuits_updated_at 
    BEFORE UPDATE ON floor_plan_circuits
    FOR EACH ROW EXECUTE FUNCTION update_floor_plan_updated_at_column();

CREATE TRIGGER update_floor_plan_phases_updated_at 
    BEFORE UPDATE ON floor_plan_phases
    FOR EACH ROW EXECUTE FUNCTION update_floor_plan_updated_at_column();

CREATE TRIGGER update_floor_plan_measurements_updated_at 
    BEFORE UPDATE ON floor_plan_measurements
    FOR EACH ROW EXECUTE FUNCTION update_floor_plan_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO n8n_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO n8n_user;

COMMENT ON TABLE floor_plans IS 'Stores uploaded floor plan files and metadata';
COMMENT ON TABLE floor_plan_markups IS 'Annotations and electrical elements on floor plans';
COMMENT ON TABLE floor_plan_circuits IS 'Electrical circuits connecting multiple elements';
COMMENT ON TABLE floor_plan_phases IS 'Construction phases for organized installation';
COMMENT ON TABLE electrical_symbols IS 'Standardized electrical symbols library';