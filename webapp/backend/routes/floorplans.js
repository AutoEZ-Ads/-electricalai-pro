const express = require('express');
const multer = require('multer');
const { body, validationResult, query, param } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const router = express.Router();

// Configure multer for floor plan uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/floorplans');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|dwg|dxf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files, PDFs, and CAD files are allowed'));
    }
  }
});

// Upload floor plans for a project
router.post('/upload/:projectId', [
  param('projectId').isUUID().withMessage('Project ID must be valid UUID'),
  upload.array('floorplans', 10)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify project exists
    const projectCheck = await req.db.query(
      'SELECT id FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const uploadedPlans = [];

    for (const file of files) {
      // Generate thumbnail for images
      let thumbnailPath = null;
      if (file.mimetype.startsWith('image/')) {
        thumbnailPath = file.path.replace(path.extname(file.path), '_thumb.jpg');
        await sharp(file.path)
          .resize(300, 200, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
      }

      // Insert floor plan record
      const insertQuery = `
        INSERT INTO floor_plans (
          project_id, filename, original_name, file_path, thumbnail_path,
          file_type, file_size, upload_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await req.db.query(insertQuery, [
        projectId,
        file.filename,
        file.originalname,
        file.path,
        thumbnailPath,
        file.mimetype,
        file.size,
        'uploaded'
      ]);

      uploadedPlans.push(result.rows[0]);
    }

    res.json({
      success: true,
      data: uploadedPlans,
      message: `${uploadedPlans.length} floor plan(s) uploaded successfully`
    });

  } catch (error) {
    console.error('Floor plan upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload floor plans',
      details: error.message 
    });
  }
});

// Get floor plans for a project
router.get('/project/:projectId', [
  param('projectId').isUUID().withMessage('Project ID must be valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.params;

    const query = `
      SELECT 
        fp.*,
        COUNT(fpm.id) as markup_count,
        COUNT(CASE WHEN fpm.markup_type = 'electrical_element' THEN 1 END) as electrical_elements,
        COUNT(CASE WHEN fpm.markup_type = 'measurement' THEN 1 END) as measurements,
        COUNT(CASE WHEN fpm.markup_type = 'note' THEN 1 END) as notes
      FROM floor_plans fp
      LEFT JOIN floor_plan_markups fpm ON fp.id = fpm.floor_plan_id
      WHERE fp.project_id = $1
      GROUP BY fp.id
      ORDER BY fp.created_at ASC
    `;

    const result = await req.db.query(query, [projectId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching floor plans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch floor plans',
      details: error.message 
    });
  }
});

// Add markup to floor plan
router.post('/:floorPlanId/markup', [
  param('floorPlanId').isUUID().withMessage('Floor plan ID must be valid UUID'),
  body('markupType').isIn(['electrical_element', 'measurement', 'note', 'axis_point', 'dimension']).withMessage('Invalid markup type'),
  body('coordinates').isObject().withMessage('Coordinates must be an object'),
  body('coordinates.x').isNumeric().withMessage('X coordinate must be numeric'),
  body('coordinates.y').isNumeric().withMessage('Y coordinate must be numeric'),
  body('data').isObject().withMessage('Data must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { floorPlanId } = req.params;
    const { markupType, coordinates, data, description } = req.body;

    // Verify floor plan exists
    const planCheck = await req.db.query(
      'SELECT id, project_id FROM floor_plans WHERE id = $1',
      [floorPlanId]
    );
    
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Floor plan not found' });
    }

    const insertQuery = `
      INSERT INTO floor_plan_markups (
        floor_plan_id, markup_type, coordinates, markup_data, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await req.db.query(insertQuery, [
      floorPlanId,
      markupType,
      JSON.stringify(coordinates),
      JSON.stringify(data),
      description || null,
      req.user?.id || 'system'
    ]);

    // Update floor plan modified timestamp
    await req.db.query(
      'UPDATE floor_plans SET updated_at = NOW() WHERE id = $1',
      [floorPlanId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Markup added successfully'
    });

  } catch (error) {
    console.error('Error adding markup:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add markup',
      details: error.message 
    });
  }
});

// Get markups for a floor plan
router.get('/:floorPlanId/markups', [
  param('floorPlanId').isUUID().withMessage('Floor plan ID must be valid UUID'),
  query('type').optional().isIn(['electrical_element', 'measurement', 'note', 'axis_point', 'dimension'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { floorPlanId } = req.params;
    const { type } = req.query;

    let query = `
      SELECT 
        fpm.*,
        u.name as created_by_name
      FROM floor_plan_markups fpm
      LEFT JOIN users u ON fpm.created_by = u.id
      WHERE fpm.floor_plan_id = $1
    `;

    const params = [floorPlanId];

    if (type) {
      query += ' AND fpm.markup_type = $2';
      params.push(type);
    }

    query += ' ORDER BY fpm.created_at ASC';

    const result = await req.db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching markups:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch markups',
      details: error.message 
    });
  }
});

// Generate construction guide for floor plan
router.get('/:floorPlanId/construction-guide', [
  param('floorPlanId').isUUID().withMessage('Floor plan ID must be valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { floorPlanId } = req.params;

    // Get floor plan and project info
    const planQuery = `
      SELECT 
        fp.*,
        p.name as project_name,
        p.building_type,
        p.square_footage,
        p.project_specifications
      FROM floor_plans fp
      JOIN projects p ON fp.project_id = p.id
      WHERE fp.id = $1
    `;

    const planResult = await req.db.query(planQuery, [floorPlanId]);
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Floor plan not found' });
    }

    const floorPlan = planResult.rows[0];

    // Get all markups
    const markupsQuery = `
      SELECT * FROM floor_plan_markups 
      WHERE floor_plan_id = $1 
      ORDER BY markup_type, created_at
    `;

    const markupsResult = await req.db.query(markupsQuery, [floorPlanId]);
    const markups = markupsResult.rows;

    // Generate construction guide
    const guide = await generateConstructionGuide(floorPlan, markups);

    res.json({
      success: true,
      data: guide
    });

  } catch (error) {
    console.error('Error generating construction guide:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate construction guide',
      details: error.message 
    });
  }
});

// Auto-detect electrical elements in floor plan
router.post('/:floorPlanId/auto-detect', [
  param('floorPlanId').isUUID().withMessage('Floor plan ID must be valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { floorPlanId } = req.params;

    // Get floor plan
    const planResult = await req.db.query(
      'SELECT * FROM floor_plans WHERE id = $1',
      [floorPlanId]
    );
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Floor plan not found' });
    }

    const floorPlan = planResult.rows[0];

    // Simulate AI detection (in production, this would use computer vision)
    const detectedElements = await simulateElectricalDetection(floorPlan);

    // Insert detected elements as markups
    const insertedElements = [];
    for (const element of detectedElements) {
      const insertQuery = `
        INSERT INTO floor_plan_markups (
          floor_plan_id, markup_type, coordinates, markup_data, description, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await req.db.query(insertQuery, [
        floorPlanId,
        'electrical_element',
        JSON.stringify(element.coordinates),
        JSON.stringify(element.data),
        element.description,
        'auto_detect'
      ]);

      insertedElements.push(result.rows[0]);
    }

    res.json({
      success: true,
      data: insertedElements,
      message: `${insertedElements.length} electrical elements detected and added`
    });

  } catch (error) {
    console.error('Error auto-detecting elements:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to auto-detect elements',
      details: error.message 
    });
  }
});

// Helper function to generate construction guide
async function generateConstructionGuide(floorPlan, markups) {
  const electricalElements = markups.filter(m => m.markup_type === 'electrical_element');
  const measurements = markups.filter(m => m.markup_type === 'measurement');
  const axisPoints = markups.filter(m => m.markup_type === 'axis_point');
  const notes = markups.filter(m => m.markup_type === 'note');

  // Group elements by phase
  const phases = {
    'rough_in': [],
    'trim_out': [],
    'final': []
  };

  electricalElements.forEach(element => {
    const data = JSON.parse(element.markup_data);
    const phase = determineInstallationPhase(data.element_type);
    phases[phase].push({
      id: element.id,
      type: data.element_type,
      coordinates: JSON.parse(element.coordinates),
      specifications: data,
      description: element.description
    });
  });

  // Create axis reference system
  const axisSystem = createAxisSystem(axisPoints);

  // Generate step-by-step instructions
  const instructions = generateInstallationInstructions(phases, measurements, axisSystem);

  // Create material takeoff
  const materialTakeoff = generateMaterialTakeoff(electricalElements);

  return {
    floorPlan: {
      id: floorPlan.id,
      filename: floorPlan.filename,
      project_name: floorPlan.project_name,
      building_type: floorPlan.building_type
    },
    axisSystem,
    phases,
    instructions,
    materialTakeoff,
    safetyNotes: generateSafetyNotes(floorPlan.building_type),
    qualityChecklist: generateQualityChecklist(),
    generatedAt: new Date().toISOString()
  };
}

function determineInstallationPhase(elementType) {
  const phaseMap = {
    'panel': 'rough_in',
    'conduit': 'rough_in',
    'junction_box': 'rough_in',
    'wire_rough': 'rough_in',
    'outlet': 'trim_out',
    'switch': 'trim_out',
    'fixture_rough': 'rough_in',
    'fixture_final': 'trim_out',
    'cover_plate': 'final',
    'wire_final': 'trim_out',
    'testing': 'final'
  };
  
  return phaseMap[elementType] || 'trim_out';
}

function createAxisSystem(axisPoints) {
  const axes = {
    horizontal: [],
    vertical: [],
    reference_point: null
  };

  axisPoints.forEach(point => {
    const data = JSON.parse(point.markup_data);
    const coords = JSON.parse(point.coordinates);
    
    if (data.axis_type === 'horizontal') {
      axes.horizontal.push({
        label: data.label,
        y_position: coords.y,
        description: point.description
      });
    } else if (data.axis_type === 'vertical') {
      axes.vertical.push({
        label: data.label,
        x_position: coords.x,
        description: point.description
      });
    } else if (data.axis_type === 'reference') {
      axes.reference_point = {
        x: coords.x,
        y: coords.y,
        description: point.description
      };
    }
  });

  // Sort axes
  axes.horizontal.sort((a, b) => a.y_position - b.y_position);
  axes.vertical.sort((a, b) => a.x_position - b.x_position);

  return axes;
}

function generateInstallationInstructions(phases, measurements, axisSystem) {
  const instructions = [];

  // Rough-in phase
  if (phases.rough_in.length > 0) {
    instructions.push({
      phase: 'rough_in',
      title: 'ROUGH-IN PHASE',
      description: 'Install all concealed electrical work before drywall',
      steps: phases.rough_in.map((element, index) => ({
        step: index + 1,
        element_id: element.id,
        description: `Install ${element.type} at ${formatCoordinates(element.coordinates, axisSystem)}`,
        specifications: element.specifications,
        tools_required: getRequiredTools(element.type),
        safety_notes: getSafetyNotes(element.type),
        inspection_points: getInspectionPoints(element.type)
      }))
    });
  }

  // Trim-out phase
  if (phases.trim_out.length > 0) {
    instructions.push({
      phase: 'trim_out',
      title: 'TRIM-OUT PHASE',
      description: 'Install visible electrical devices and fixtures',
      steps: phases.trim_out.map((element, index) => ({
        step: index + 1,
        element_id: element.id,
        description: `Install ${element.type} at ${formatCoordinates(element.coordinates, axisSystem)}`,
        specifications: element.specifications,
        tools_required: getRequiredTools(element.type),
        safety_notes: getSafetyNotes(element.type),
        inspection_points: getInspectionPoints(element.type)
      }))
    });
  }

  // Final phase
  if (phases.final.length > 0) {
    instructions.push({
      phase: 'final',
      title: 'FINAL PHASE',
      description: 'Complete installation and testing',
      steps: phases.final.map((element, index) => ({
        step: index + 1,
        element_id: element.id,
        description: `Complete ${element.type} at ${formatCoordinates(element.coordinates, axisSystem)}`,
        specifications: element.specifications,
        tools_required: getRequiredTools(element.type),
        safety_notes: getSafetyNotes(element.type),
        inspection_points: getInspectionPoints(element.type)
      }))
    });
  }

  return instructions;
}

function formatCoordinates(coordinates, axisSystem) {
  if (!axisSystem.reference_point) {
    return `(${coordinates.x}, ${coordinates.y})`;
  }

  // Find nearest axis lines
  const nearestVertical = axisSystem.vertical.reduce((prev, curr) => 
    Math.abs(curr.x_position - coordinates.x) < Math.abs(prev.x_position - coordinates.x) ? curr : prev
  );
  
  const nearestHorizontal = axisSystem.horizontal.reduce((prev, curr) => 
    Math.abs(curr.y_position - coordinates.y) < Math.abs(prev.y_position - coordinates.y) ? curr : prev
  );

  if (nearestVertical && nearestHorizontal) {
    const xOffset = coordinates.x - nearestVertical.x_position;
    const yOffset = coordinates.y - nearestHorizontal.y_position;
    
    return `Grid ${nearestVertical.label}${nearestHorizontal.label} + (${xOffset.toFixed(1)}", ${yOffset.toFixed(1)}")`;
  }

  return `(${coordinates.x}, ${coordinates.y})`;
}

function getRequiredTools(elementType) {
  const toolMap = {
    'panel': ['Drill', 'Level', 'Wire stripper', 'Voltage tester', 'Screwdrivers'],
    'conduit': ['Pipe bender', 'Hacksaw', 'Reamer', 'Measuring tape'],
    'junction_box': ['Drill', 'Level', 'Screwdrivers', 'Wire nuts'],
    'outlet': ['Drill', 'Wire stripper', 'Voltage tester', 'Screwdrivers'],
    'switch': ['Drill', 'Wire stripper', 'Voltage tester', 'Screwdrivers'],
    'fixture_rough': ['Drill', 'Level', 'Wire stripper', 'Wire nuts'],
    'fixture_final': ['Drill', 'Level', 'Wire stripper', 'Voltage tester']
  };

  return toolMap[elementType] || ['Basic electrical tools'];
}

function getSafetyNotes(elementType) {
  const safetyMap = {
    'panel': ['Verify power is OFF', 'Use lockout/tagout procedures', 'Wear PPE'],
    'conduit': ['Watch for existing utilities', 'Use proper lifting techniques'],
    'junction_box': ['Verify power is OFF', 'Use proper box fill calculations'],
    'outlet': ['Verify power is OFF', 'Test with voltage tester', 'Follow GFCI requirements'],
    'switch': ['Verify power is OFF', 'Test with voltage tester', 'Proper wire identification'],
    'fixture_rough': ['Verify power is OFF', 'Ensure proper support', 'Follow NEC Article 410'],
    'fixture_final': ['Verify power is OFF', 'Test functionality', 'Check grounding']
  };

  return safetyMap[elementType] || ['Follow standard electrical safety procedures'];
}

function getInspectionPoints(elementType) {
  const inspectionMap = {
    'panel': ['Proper bonding', 'Correct breaker ratings', 'Adequate working space'],
    'conduit': ['Proper support spacing', 'No sharp edges', 'Correct fill percentage'],
    'junction_box': ['Proper size for connections', 'Accessible location', 'Secure mounting'],
    'outlet': ['Correct height', 'Proper GFCI protection', 'Secure mounting'],
    'switch': ['Correct height', 'Proper operation', 'Secure mounting'],
    'fixture_rough': ['Adequate support', 'Proper box size', 'Correct location'],
    'fixture_final': ['Proper operation', 'Secure mounting', 'Correct lamping']
  };

  return inspectionMap[elementType] || ['Standard inspection requirements'];
}

function generateMaterialTakeoff(electricalElements) {
  const materials = {};

  electricalElements.forEach(element => {
    const data = JSON.parse(element.markup_data);
    const elementType = data.element_type;
    
    // Aggregate materials by type
    if (!materials[elementType]) {
      materials[elementType] = {
        count: 0,
        specifications: [],
        estimated_cost: 0
      };
    }
    
    materials[elementType].count++;
    
    // Add unique specifications
    const spec = `${data.voltage || '120V'} ${data.amperage || '15A'} ${data.type || ''}`.trim();
    if (!materials[elementType].specifications.includes(spec)) {
      materials[elementType].specifications.push(spec);
    }
    
    // Add estimated cost (simplified)
    materials[elementType].estimated_cost += getEstimatedCost(elementType);
  });

  return {
    summary: materials,
    total_estimated_cost: Object.values(materials).reduce((sum, mat) => sum + mat.estimated_cost, 0),
    notes: [
      'Costs are estimates and may vary by location and supplier',
      'Additional materials may be required for installation',
      'Consult with supplier for current pricing'
    ]
  };
}

function getEstimatedCost(elementType) {
  const costMap = {
    'panel': 500,
    'conduit': 5, // per foot
    'junction_box': 8,
    'outlet': 15,
    'switch': 12,
    'fixture_rough': 25,
    'fixture_final': 150,
    'cover_plate': 3
  };

  return costMap[elementType] || 10;
}

function generateSafetyNotes(buildingType) {
  const generalSafety = [
    'Always verify power is OFF before working',
    'Use lockout/tagout procedures',
    'Wear appropriate PPE including safety glasses and insulated gloves',
    'Test voltage before and after work',
    'Follow NEC and local code requirements'
  ];

  const buildingSpecific = {
    'residential': [
      'Be aware of AFCI and GFCI requirements',
      'Follow bedroom and bathroom outlet spacing rules',
      'Check for aluminum wiring in older homes'
    ],
    'commercial': [
      'Coordinate with other trades',
      'Follow emergency egress lighting requirements',
      'Ensure proper grounding and bonding'
    ],
    'industrial': [
      'Be aware of hazardous locations classifications',
      'Follow motor control safety procedures',
      'Use proper arc flash PPE'
    ]
  };

  return [
    ...generalSafety,
    ...(buildingSpecific[buildingType] || buildingSpecific['commercial'])
  ];
}

function generateQualityChecklist() {
  return [
    {
      category: 'Installation Quality',
      items: [
        'All connections are tight and secure',
        'Proper wire colors used throughout',
        'Junction boxes are accessible',
        'Conduit runs are neat and properly supported',
        'All devices are level and properly mounted'
      ]
    },
    {
      category: 'Code Compliance',
      items: [
        'GFCI protection where required',
        'AFCI protection in required areas',
        'Proper box fill calculations observed',
        'Working clearances maintained',
        'Grounding and bonding completed'
      ]
    },
    {
      category: 'Testing',
      items: [
        'Continuity testing completed',
        'Ground fault testing passed',
        'All circuits properly labeled',
        'Voltage testing shows correct values',
        'Load testing completed where required'
      ]
    },
    {
      category: 'Documentation',
      items: [
        'As-built drawings updated',
        'Panel schedules completed',
        'Test results documented',
        'Material certifications collected',
        'Inspection reports filed'
      ]
    }
  ];
}

// Simulate AI electrical element detection
async function simulateElectricalDetection(floorPlan) {
  // In production, this would use computer vision to analyze the floor plan image
  // For now, return simulated detected elements
  return [
    {
      coordinates: { x: 100, y: 150 },
      data: {
        element_type: 'outlet',
        voltage: '120V',
        amperage: '20A',
        type: 'GFCI',
        confidence: 0.92
      },
      description: 'Kitchen GFCI outlet detected'
    },
    {
      coordinates: { x: 250, y: 180 },
      data: {
        element_type: 'switch',
        voltage: '120V',
        amperage: '15A',
        type: 'single_pole',
        confidence: 0.88
      },
      description: 'Light switch detected'
    },
    {
      coordinates: { x: 300, y: 50 },
      data: {
        element_type: 'panel',
        voltage: '240V',
        amperage: '200A',
        type: 'main_panel',
        confidence: 0.95
      },
      description: 'Main electrical panel detected'
    }
  ];
}

module.exports = router;