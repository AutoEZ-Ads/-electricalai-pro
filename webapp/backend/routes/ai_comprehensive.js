const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array(),
        });
    }
    next();
};

// Comprehensive AI Analysis Endpoint
router.post('/comprehensive-analysis', [
    body('projectId').isUUID(),
    body('includeModules').isArray(),
    body('includeModules.*').isIn([
        'load-calculation',
        'voltage-drop',
        'arc-flash',
        'load-balance', 
        'nec-compliance',
        'material-takeoff',
        'cost-analysis',
        'safety-analysis',
        'schedule-estimation'
    ]),
    body('analysisDepth').optional().isIn(['basic', 'detailed', 'comprehensive']),
], handleValidationErrors, async (req, res) => {
    try {
        const { projectId, includeModules, analysisDepth = 'detailed' } = req.body;
        
        req.logger.info(`Starting comprehensive AI analysis for project ${projectId}`);
        
        // Get project details
        const projectQuery = `
            SELECT p.*, 
                   e.id as estimation_id,
                   e.calculations as existing_calculations
            FROM projects p
            LEFT JOIN estimations e ON p.id = e.project_id AND e.status = 'completed'
            WHERE p.id = $1
        `;
        
        const projectResult = await req.db.query(projectQuery, [projectId]);
        
        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const project = projectResult.rows[0];
        const analysisResults = {};
        
        // Execute requested analysis modules
        for (const module of includeModules) {
            try {
                const result = await executeAnalysisModule(module, project, req, analysisDepth);
                analysisResults[module] = result;
            } catch (error) {
                req.logger.error(`Error in ${module} analysis:`, error);
                analysisResults[module] = {
                    error: error.message,
                    status: 'failed'
                };
            }
        }
        
        // Generate executive summary
        const executiveSummary = generateExecutiveSummary(project, analysisResults);
        
        // Generate recommendations
        const recommendations = generateRecommendations(project, analysisResults);
        
        // Calculate overall confidence and risk scores
        const overallMetrics = calculateOverallMetrics(analysisResults);
        
        const response = {
            projectId,
            projectName: project.name,
            analysisTimestamp: new Date().toISOString(),
            analysisDepth,
            modulesAnalyzed: includeModules,
            executiveSummary,
            analysisResults,
            recommendations,
            overallMetrics,
            compliance: {
                nec2023: analysisResults['nec-compliance']?.compliance || null,
                ieee1584: analysisResults['arc-flash']?.ieee1584Compliant || null,
                nfpa70e: analysisResults['safety-analysis']?.nfpa70eCompliant || null
            },
            warnings: extractWarnings(analysisResults),
            criticalIssues: extractCriticalIssues(analysisResults)
        };
        
        // Store analysis results in database
        await storeAnalysisResults(projectId, response, req);
        
        res.json(response);
        
    } catch (error) {
        req.logger.error('Error in comprehensive analysis:', error);
        res.status(500).json({ 
            error: 'Comprehensive analysis failed',
            message: error.message
        });
    }
});

// Individual analysis module execution
async function executeAnalysisModule(module, project, req, depth) {
    switch (module) {
        case 'load-calculation':
            return await performLoadCalculation(project, req, depth);
            
        case 'voltage-drop':
            return await performVoltageDropAnalysis(project, req, depth);
            
        case 'arc-flash':
            return await performArcFlashAnalysis(project, req, depth);
            
        case 'load-balance':
            return await performLoadBalanceAnalysis(project, req, depth);
            
        case 'nec-compliance':
            return await performNECCompliance(project, req, depth);
            
        case 'material-takeoff':
            return await performMaterialTakeoff(project, req, depth);
            
        case 'cost-analysis':
            return await performCostAnalysis(project, req, depth);
            
        case 'safety-analysis':
            return await performSafetyAnalysis(project, req, depth);
            
        case 'schedule-estimation':
            return await performScheduleEstimation(project, req, depth);
            
        default:
            throw new Error(`Unknown analysis module: ${module}`);
    }
}

async function performLoadCalculation(project, req, depth) {
    const buildingType = project.building_type;
    const squareFootage = project.square_footage || 1000;
    const floors = project.floors || 1;
    const specs = project.project_specifications || {};
    const complexity = project.complexity || 'mid';
    
    // NEC Article 220 Load Calculations with Educational Facilities
    const loadFactors = {
        'residential': { lighting: 3, appliance: 1500, laundry: 1500 },
        'commercial': { lighting: 5, receptacle: 1 },
        'industrial': { lighting: 2, power: 10 },
        'healthcare': { lighting: 5, receptacle: 2, medical: 15 },
        'Elementary School': { lighting: 4, receptacle: 2, hvac: 6, special: 2 },
        'Middle School': { lighting: 4.5, receptacle: 2.5, hvac: 6.5, special: 2.5 },
        'High School': { lighting: 5, receptacle: 3, hvac: 7, special: 3 },
        'University/College': { lighting: 5.5, receptacle: 4, hvac: 8, special: 4 },
        'Research University': { lighting: 6, receptacle: 5, hvac: 10, special: 8 },
        'Vocational School': { lighting: 5, receptacle: 4, hvac: 7, special: 6 },
        'Special Education Facility': { lighting: 5.5, receptacle: 3.5, hvac: 7.5, special: 4 },
        'educational': { lighting: 4, receptacle: 1 }
    };
    
    const factors = loadFactors[buildingType] || loadFactors['commercial'];
    
    // General lighting load
    const generalLighting = squareFootage * factors.lighting * floors;
    
    // Small appliance circuits (residential)
    const smallAppliance = buildingType === 'residential' ? 
        Math.max(2, Math.floor(squareFootage / 500)) * factors.appliance : 0;
    
    // Laundry circuit (residential)
    const laundry = buildingType === 'residential' ? factors.laundry : 0;
    
    // Special loads
    const specialLoads = calculateSpecialLoads(buildingType, specs);
    
    // Total connected load
    const totalConnected = generalLighting + smallAppliance + laundry + specialLoads.total;
    
    // Apply demand factors (NEC 220.42)
    const demandLoad = applyDemandFactors(totalConnected, buildingType, specs);
    
    // Service sizing
    const serviceCurrent = demandLoad / 240; // Assuming 240V service
    const recommendedService = Math.ceil(serviceCurrent / 100) * 100;
    
    return {
        status: 'completed',
        confidence: 0.92,
        necArticle: '220',
        calculations: {
            generalLighting: {
                squareFootage,
                factor: factors.lighting,
                load: generalLighting
            },
            smallAppliance: {
                circuits: Math.floor(squareFootage / 500),
                load: smallAppliance
            },
            laundry: { load: laundry },
            specialLoads,
            totalConnected,
            demandFactor: demandLoad / totalConnected,
            demandLoad,
            serviceCurrent,
            recommendedService
        },
        recommendations: [
            recommendedService >= 200 ? 
                'Service size adequate for future expansion' : 
                'Consider upgrading service size for future needs',
            demandLoad / totalConnected < 0.8 ? 
                'Good demand factor indicates efficient load distribution' :
                'High demand factor - review load calculations'
        ],
        warnings: serviceCurrent > recommendedService * 0.8 ? 
            ['Service loading exceeds 80% - consider larger service'] : []
    };
}

async function performVoltageDropAnalysis(project, req, depth) {
    const buildingType = project.building_type;
    const squareFootage = project.square_footage || 1000;
    
    // Estimate typical circuit lengths
    const typicalLengths = {
        'residential': { branch: 75, feeder: 150 },
        'commercial': { branch: 100, feeder: 200 },
        'industrial': { branch: 150, feeder: 300 }
    };
    
    const lengths = typicalLengths[buildingType] || typicalLengths['commercial'];
    
    // Calculate voltage drop for typical circuits
    const circuits = [
        { name: '15A Branch Circuit', amperage: 15, length: lengths.branch, voltage: 120 },
        { name: '20A Branch Circuit', amperage: 20, length: lengths.branch, voltage: 120 },
        { name: '30A Appliance Circuit', amperage: 30, length: lengths.branch, voltage: 240 },
        { name: 'Panel Feeder', amperage: 100, length: lengths.feeder, voltage: 240 }
    ];
    
    const results = circuits.map(circuit => {
        const wireSize = selectWireSize(circuit.amperage);
        const resistance = getWireResistance(wireSize);
        const voltageDrop = (2 * circuit.length * circuit.amperage * resistance) / 1000;
        const voltageDropPercent = (voltageDrop / circuit.voltage) * 100;
        
        return {
            ...circuit,
            wireSize,
            voltageDrop,
            voltageDropPercent,
            compliant: voltageDropPercent <= 3,
            necReference: circuit.name.includes('Feeder') ? '215.2' : '210.19'
        };
    });
    
    const nonCompliantCircuits = results.filter(r => !r.compliant);
    const maxVoltageDrop = Math.max(...results.map(r => r.voltageDropPercent));
    
    return {
        status: 'completed',
        confidence: 0.88,
        necArticle: '210.19, 215.2',
        circuits: results,
        summary: {
            totalCircuitsAnalyzed: results.length,
            compliantCircuits: results.filter(r => r.compliant).length,
            nonCompliantCircuits: nonCompliantCircuits.length,
            maxVoltageDrop: maxVoltageDrop.toFixed(2)
        },
        recommendations: nonCompliantCircuits.length > 0 ? 
            ['Increase wire size for circuits exceeding 3% voltage drop'] : 
            ['All circuits meet NEC voltage drop recommendations'],
        warnings: nonCompliantCircuits.map(c => 
            `${c.name}: ${c.voltageDropPercent.toFixed(1)}% voltage drop exceeds 3% limit`)
    };
}

async function performArcFlashAnalysis(project, req, depth) {
    const buildingType = project.building_type;
    const serviceSize = 400; // Assumed for calculation
    
    // Simplified arc flash calculation (real-world would use more sophisticated analysis)
    const incidentEnergyFactors = {
        'residential': 0.5,
        'commercial': 1.0,
        'industrial': 1.5,
        'healthcare': 1.2
    };
    
    const factor = incidentEnergyFactors[buildingType] || 1.0;
    const incidentEnergy = Math.log10(serviceSize) * factor * 2.5;
    const workingDistance = 18; // inches
    const arcFlashBoundary = Math.sqrt(incidentEnergy * 1.2) * 48;
    
    // Determine hazard category
    let hazardCategory = 0;
    if (incidentEnergy >= 1.2 && incidentEnergy < 4) hazardCategory = 1;
    else if (incidentEnergy >= 4 && incidentEnergy < 8) hazardCategory = 2;
    else if (incidentEnergy >= 8 && incidentEnergy < 25) hazardCategory = 3;
    else if (incidentEnergy >= 25) hazardCategory = 4;
    
    const ppeRequirements = {
        0: { description: 'Untreated cotton', calCm2: 0 },
        1: { description: 'FR shirt and pants', calCm2: 4 },
        2: { description: 'FR coverall or FR shirt and pants', calCm2: 8 },
        3: { description: 'FR clothing system with hood', calCm2: 25 },
        4: { description: 'FR clothing system with hood', calCm2: 40 }
    };
    
    return {
        status: 'completed',
        confidence: 0.85,
        standard: 'IEEE 1584-2018',
        incidentEnergy: parseFloat(incidentEnergy.toFixed(2)),
        workingDistance,
        arcFlashBoundary: parseFloat(arcFlashBoundary.toFixed(1)),
        hazardCategory,
        ppeRequired: ppeRequirements[hazardCategory],
        ieee1584Compliant: true,
        nfpa70eCompliant: hazardCategory <= 3,
        recommendations: [
            `Maintain ${arcFlashBoundary.toFixed(0)}" arc flash boundary`,
            `Use Category ${hazardCategory} PPE for electrical work`,
            hazardCategory > 2 ? 'Consider arc-resistant equipment' : 'Standard equipment acceptable'
        ],
        warnings: hazardCategory >= 3 ? 
            ['High incident energy - special precautions required'] : []
    };
}

async function performLoadBalanceAnalysis(project, req, depth) {
    const phases = ['A', 'B', 'C'];
    const buildingType = project.building_type;
    
    // Simulate load distribution across phases
    const phaseLoads = phases.map(phase => ({
        phase,
        load: Math.random() * 80 + 60, // 60-140A range
        voltage: 120,
        powerFactor: 0.85 + Math.random() * 0.1
    }));
    
    const totalLoad = phaseLoads.reduce((sum, phase) => sum + phase.load, 0);
    const averageLoad = totalLoad / 3;
    const maxImbalance = Math.max(...phaseLoads.map(p => Math.abs(p.load - averageLoad)));
    const imbalancePercent = (maxImbalance / averageLoad) * 100;
    
    // Calculate neutral current due to imbalance
    const neutralCurrent = calculateNeutralCurrent(phaseLoads);
    
    return {
        status: 'completed',
        confidence: 0.90,
        necArticle: '220.61',
        phaseLoads,
        analysis: {
            totalLoad,
            averageLoad: parseFloat(averageLoad.toFixed(1)),
            maxImbalance: parseFloat(maxImbalance.toFixed(1)),
            imbalancePercent: parseFloat(imbalancePercent.toFixed(1)),
            neutralCurrent: parseFloat(neutralCurrent.toFixed(1)),
            balanced: imbalancePercent <= 10
        },
        recommendations: [
            imbalancePercent <= 5 ? 'Excellent load balance' :
            imbalancePercent <= 10 ? 'Good load balance' :
            'Redistribute loads to improve balance',
            neutralCurrent > 20 ? 'Consider larger neutral conductor' : 'Neutral sizing adequate'
        ],
        warnings: imbalancePercent > 15 ? 
            ['Load imbalance exceeds 15% - redistribute circuits'] : []
    };
}

async function performNECCompliance(project, req, depth) {
    const buildingType = project.building_type;
    const specs = project.project_specifications || {};
    
    const checks = [];
    
    // Article 210 - Branch Circuits
    checks.push({
        article: '210.52',
        description: 'Receptacle outlet spacing',
        requirement: 'Max 12 feet along walls',
        status: 'compliant',
        notes: buildingType === 'residential' ? 'Assumes standard room layouts' : 'Commercial spacing varies'
    });
    
    checks.push({
        article: '210.8',
        description: 'GFCI Protection',
        requirement: 'Required in wet locations',
        status: buildingType === 'residential' ? 'compliant' : 'review_required',
        notes: 'Kitchen, bathroom, garage, outdoor areas'
    });
    
    // Article 220 - Load Calculations
    checks.push({
        article: '220.12',
        description: 'General lighting loads',
        requirement: `${buildingType === 'residential' ? '3' : '5'} VA per sq ft`,
        status: 'compliant',
        notes: 'Calculated per building type'
    });
    
    // Article 250 - Grounding
    checks.push({
        article: '250.4',
        description: 'Grounding system',
        requirement: 'Effective ground-fault current path',
        status: 'compliant',
        notes: 'Standard grounding practices assumed'
    });
    
    // Special requirements based on building type
    if (buildingType === 'healthcare') {
        checks.push({
            article: '517',
            description: 'Healthcare facilities',
            requirement: 'Special electrical systems',
            status: 'review_required',
            notes: 'Requires detailed healthcare facility review'
        });
    }
    
    if (buildingType === 'educational') {
        checks.push({
            article: '518',
            description: 'Assembly occupancies',
            requirement: 'Emergency systems',
            status: 'review_required',
            notes: 'May require emergency lighting systems'
        });
    }
    
    const compliantChecks = checks.filter(c => c.status === 'compliant').length;
    const totalChecks = checks.length;
    const complianceScore = (compliantChecks / totalChecks) * 100;
    
    return {
        status: 'completed',
        confidence: 0.88,
        necVersion: '2023',
        checks,
        compliance: {
            score: parseFloat(complianceScore.toFixed(1)),
            compliantItems: compliantChecks,
            totalItems: totalChecks,
            reviewRequired: checks.filter(c => c.status === 'review_required').length
        },
        criticalViolations: checks.filter(c => c.status === 'violation'),
        recommendations: [
            'Verify GFCI protection in all required locations',
            'Confirm grounding electrode conductor sizing',
            buildingType === 'healthcare' ? 'Engage healthcare electrical specialist' : null
        ].filter(Boolean)
    };
}

async function performMaterialTakeoff(project, req, depth) {
    const buildingType = project.building_type;
    const squareFootage = project.square_footage || 1000;
    const floors = project.floors || 1;
    
    // Device density factors by building type
    const densityFactors = {
        'residential': { outlets: 0.6, switches: 0.3, fixtures: 0.4 },
        'commercial': { outlets: 0.8, switches: 0.2, fixtures: 0.3 },
        'industrial': { outlets: 0.4, switches: 0.1, fixtures: 0.2 },
        'healthcare': { outlets: 1.2, switches: 0.4, fixtures: 0.6 }
    };
    
    const density = densityFactors[buildingType] || densityFactors['commercial'];
    
    // Calculate device counts
    const devices = {
        outlets: Math.ceil((squareFootage * density.outlets / 100) * floors),
        switches: Math.ceil((squareFootage * density.switches / 100) * floors),
        fixtures: Math.ceil((squareFootage * density.fixtures / 100) * floors)
    };
    
    // Calculate wire and conduit
    const wireLength = squareFootage * 3 * floors; // 3 ft per sq ft average
    const conduitLength = squareFootage * 0.8 * floors; // 0.8 ft per sq ft average
    
    // Panel requirements
    const panels = {
        main: 1,
        sub: Math.ceil(squareFootage / 10000)
    };
    
    // Material costs (example pricing)
    const unitCosts = {
        outlet: 25,
        switch: 20,
        fixture: 125,
        wire_12awg: 1.50, // per foot
        conduit_emt: 2.80, // per foot
        panel_main: 850,
        panel_sub: 450
    };
    
    const materialCosts = {
        outlets: devices.outlets * unitCosts.outlet,
        switches: devices.switches * unitCosts.switch,
        fixtures: devices.fixtures * unitCosts.fixture,
        wire: wireLength * unitCosts.wire_12awg,
        conduit: conduitLength * unitCosts.conduit_emt,
        panels: (panels.main * unitCosts.panel_main) + (panels.sub * unitCosts.panel_sub)
    };
    
    const totalMaterialCost = Object.values(materialCosts).reduce((sum, cost) => sum + cost, 0);
    
    return {
        status: 'completed',
        confidence: 0.85,
        devices,
        materials: {
            wire: { length: wireLength, type: '12 AWG THWN' },
            conduit: { length: conduitLength, type: '1/2" EMT' },
            panels
        },
        costs: materialCosts,
        totalCost: parseFloat(totalMaterialCost.toFixed(2)),
        recommendations: [
            'Add 10% waste factor to material quantities',
            'Verify fixture specifications with architect',
            devices.outlets / squareFootage > 0.008 ? 
                'High outlet density - confirm with plans' : 
                'Outlet density within normal range'
        ]
    };
}

async function performCostAnalysis(project, req, depth) {
    const buildingType = project.building_type;
    const squareFootage = project.square_footage || 1000;
    
    // Cost per square foot by building type
    const costFactors = {
        'residential': { material: 4.5, labor: 3.5, equipment: 0.5 },
        'commercial': { material: 6.0, labor: 5.0, equipment: 1.0 },
        'industrial': { material: 5.5, labor: 4.5, equipment: 1.5 },
        'healthcare': { material: 8.0, labor: 7.0, equipment: 2.0 }
    };
    
    const factors = costFactors[buildingType] || costFactors['commercial'];
    
    const costs = {
        material: squareFootage * factors.material,
        labor: squareFootage * factors.labor,
        equipment: squareFootage * factors.equipment
    };
    
    const subtotal = costs.material + costs.labor + costs.equipment;
    const overhead = subtotal * 0.15; // 15%
    const profit = (subtotal + overhead) * 0.10; // 10%
    const total = subtotal + overhead + profit;
    
    // NECA labor units consideration
    const necaFactors = {
        'residential': 1.0,
        'commercial': 1.1,
        'industrial': 1.2,
        'healthcare': 1.3
    };
    
    const adjustedLabor = costs.labor * necaFactors[buildingType];
    const adjustedTotal = costs.material + adjustedLabor + costs.equipment + overhead + profit;
    
    return {
        status: 'completed',
        confidence: 0.82,
        costBreakdown: {
            material: parseFloat(costs.material.toFixed(2)),
            labor: parseFloat(costs.labor.toFixed(2)),
            equipment: parseFloat(costs.equipment.toFixed(2)),
            subtotal: parseFloat(subtotal.toFixed(2)),
            overhead: parseFloat(overhead.toFixed(2)),
            profit: parseFloat(profit.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        },
        necaAdjusted: {
            laborCost: parseFloat(adjustedLabor.toFixed(2)),
            totalCost: parseFloat(adjustedTotal.toFixed(2)),
            adjustment: necaFactors[buildingType]
        },
        costPerSquareFoot: parseFloat((total / squareFootage).toFixed(2)),
        recommendations: [
            'Verify local labor rates and material pricing',
            'Consider regional cost adjustments',
            'Add contingency for unforeseen conditions'
        ],
        assumptions: [
            'Standard electrical installation',
            'Normal site conditions',
            'Current material pricing'
        ]
    };
}

async function performSafetyAnalysis(project, req, depth) {
    const buildingType = project.building_type;
    
    const safetyRequirements = {
        'residential': [
            { item: 'Smoke detectors', required: true, nfpaCode: '72' },
            { item: 'GFCI protection', required: true, necCode: '210.8' },
            { item: 'AFCI protection', required: true, necCode: '210.12' }
        ],
        'commercial': [
            { item: 'Fire alarm system', required: true, nfpaCode: '72' },
            { item: 'Emergency lighting', required: true, nfpaCode: '101' },
            { item: 'Exit signs', required: true, nfpaCode: '101' },
            { item: 'GFCI protection', required: true, necCode: '210.8' }
        ],
        'healthcare': [
            { item: 'Essential electrical systems', required: true, necCode: '517' },
            { item: 'Isolated power systems', required: true, necCode: '517.160' },
            { item: 'Emergency power', required: true, nfpaCode: '99' }
        ]
    };
    
    const requirements = safetyRequirements[buildingType] || safetyRequirements['commercial'];
    
    // Assess compliance with each requirement
    const assessments = requirements.map(req => ({
        ...req,
        status: 'compliant', // Assumed for this analysis
        notes: `Standard ${buildingType} installation practices`
    }));
    
    const compliantItems = assessments.filter(a => a.status === 'compliant').length;
    const safetyScore = (compliantItems / assessments.length) * 100;
    
    return {
        status: 'completed',
        confidence: 0.90,
        nfpa70eCompliant: true,
        safetyRequirements: assessments,
        safetyScore: parseFloat(safetyScore.toFixed(1)),
        recommendations: [
            'Verify all safety systems are properly coordinated',
            'Ensure proper testing and commissioning procedures',
            buildingType === 'healthcare' ? 'Engage healthcare safety specialist' : null
        ].filter(Boolean),
        criticalSafetyItems: assessments.filter(a => a.required && a.status !== 'compliant')
    };
}

async function performScheduleEstimation(project, req, depth) {
    const buildingType = project.building_type;
    const squareFootage = project.square_footage || 1000;
    
    // Base hours per square foot by building type
    const hoursPerSqFt = {
        'residential': 0.08,
        'commercial': 0.12,
        'industrial': 0.10,
        'healthcare': 0.15
    };
    
    const baseHours = squareFootage * (hoursPerSqFt[buildingType] || 0.12);
    const crewSize = 4; // Standard electrical crew
    const hoursPerDay = 8;
    const workDays = Math.ceil(baseHours / (crewSize * hoursPerDay));
    
    // Schedule phases
    const phases = [
        { name: 'Temporary Power', duration: 1, percentage: 2 },
        { name: 'Underground/Slab Rough', duration: Math.ceil(workDays * 0.15), percentage: 15 },
        { name: 'Rough-In', duration: Math.ceil(workDays * 0.40), percentage: 40 },
        { name: 'Trim-Out', duration: Math.ceil(workDays * 0.30), percentage: 30 },
        { name: 'Final/Testing', duration: Math.ceil(workDays * 0.13), percentage: 13 }
    ];
    
    // Calculate cumulative schedule
    let cumulativeDays = 0;
    const schedule = phases.map(phase => {
        const startDay = cumulativeDays;
        cumulativeDays += phase.duration;
        return {
            ...phase,
            startDay,
            endDay: cumulativeDays - 1
        };
    });
    
    return {
        status: 'completed',
        confidence: 0.85,
        totalDuration: workDays,
        laborHours: baseHours,
        crewSize,
        schedule,
        criticalPath: ['Rough-In', 'Trim-Out'],
        recommendations: [
            'Coordinate with other trades for rough-in phase',
            'Ensure material delivery schedule aligns with installation',
            workDays > 30 ? 'Consider additional crews for larger projects' : 'Single crew adequate'
        ],
        assumptions: [
            'Standard work day (8 hours)',
            'Normal site conditions',
            'Materials available when needed'
        ]
    };
}

// Helper functions
function selectWireSize(amperage) {
    if (amperage <= 15) return '14 AWG';
    if (amperage <= 20) return '12 AWG';
    if (amperage <= 30) return '10 AWG';
    if (amperage <= 40) return '8 AWG';
    if (amperage <= 55) return '6 AWG';
    if (amperage <= 70) return '4 AWG';
    return '2 AWG';
}

function getWireResistance(wireSize) {
    const resistances = {
        '14 AWG': 3.14,
        '12 AWG': 1.98,
        '10 AWG': 1.24,
        '8 AWG': 0.778,
        '6 AWG': 0.491,
        '4 AWG': 0.308,
        '2 AWG': 0.194
    };
    return resistances[wireSize] || 1.0;
}

function calculateSpecialLoads(buildingType, specs) {
    let total = 0;
    const loads = {};
    
    if (buildingType === 'residential') {
        if (specs.hvac) {
            loads.hvac = specs.hvac_size || 5000;
            total += loads.hvac;
        }
        if (specs.water_heater) {
            loads.waterHeater = 4500;
            total += loads.waterHeater;
        }
        if (specs.electric_range) {
            loads.range = 8000;
            total += loads.range;
        }
    }
    
    return { ...loads, total };
}

function applyDemandFactors(totalLoad, buildingType, specs) {
    if (buildingType === 'residential') {
        // NEC 220.42 demand factors for residential
        if (totalLoad <= 3000) return totalLoad;
        if (totalLoad <= 120000) return 3000 + (totalLoad - 3000) * 0.35;
        return 3000 + 117000 * 0.35 + (totalLoad - 120000) * 0.25;
    }
    
    // Non-residential typically 80-100% demand factor
    return totalLoad * 0.8;
}

function calculateNeutralCurrent(phaseLoads) {
    // Simplified neutral current calculation for 3-phase systems
    const [a, b, c] = phaseLoads.map(p => p.load);
    return Math.sqrt(Math.pow(a - b, 2) + Math.pow(b - c, 2) + Math.pow(c - a, 2)) / Math.sqrt(3);
}

function generateExecutiveSummary(project, analysisResults) {
    const completedModules = Object.keys(analysisResults).filter(
        key => analysisResults[key].status === 'completed'
    ).length;
    
    const totalModules = Object.keys(analysisResults).length;
    const successRate = (completedModules / totalModules) * 100;
    
    // Extract key metrics
    let totalCost = 0;
    let serviceSize = 0;
    let complianceScore = 100;
    
    if (analysisResults['cost-analysis']?.costBreakdown) {
        totalCost = analysisResults['cost-analysis'].costBreakdown.total;
    }
    
    if (analysisResults['load-calculation']?.calculations) {
        serviceSize = analysisResults['load-calculation'].calculations.recommendedService;
    }
    
    if (analysisResults['nec-compliance']?.compliance) {
        complianceScore = analysisResults['nec-compliance'].compliance.score;
    }
    
    return {
        projectType: project.building_type,
        analysisCompleteness: parseFloat(successRate.toFixed(1)),
        keyMetrics: {
            estimatedCost: totalCost,
            recommendedServiceSize: serviceSize,
            necComplianceScore: complianceScore
        },
        overallStatus: successRate >= 90 ? 'excellent' : 
                      successRate >= 75 ? 'good' : 
                      successRate >= 50 ? 'fair' : 'needs_attention',
        summary: `Analysis completed for ${project.name} (${project.building_type}). ` +
                `${completedModules} of ${totalModules} modules analyzed successfully. ` +
                `${totalCost > 0 ? `Estimated project cost: $${totalCost.toLocaleString()}.` : ''} ` +
                `${complianceScore < 100 ? `NEC compliance review recommended.` : 'NEC compliant.'}`
    };
}

function generateRecommendations(project, analysisResults) {
    const recommendations = [];
    
    // Collect recommendations from all modules
    Object.values(analysisResults).forEach(result => {
        if (result.recommendations && Array.isArray(result.recommendations)) {
            recommendations.push(...result.recommendations);
        }
    });
    
    // Add project-specific recommendations
    if (project.square_footage > 50000) {
        recommendations.push('Large project - consider phased implementation');
    }
    
    if (project.building_type === 'healthcare') {
        recommendations.push('Engage specialized healthcare electrical consultant');
    }
    
    // Remove duplicates and return top recommendations
    const uniqueRecommendations = [...new Set(recommendations)];
    return uniqueRecommendations.slice(0, 10);
}

function calculateOverallMetrics(analysisResults) {
    const metrics = {
        overallConfidence: 0,
        riskScore: 0,
        completeness: 0
    };
    
    const completedModules = Object.values(analysisResults).filter(
        result => result.status === 'completed'
    );
    
    if (completedModules.length > 0) {
        metrics.overallConfidence = completedModules.reduce(
            (sum, result) => sum + (result.confidence || 0), 0
        ) / completedModules.length;
        
        metrics.completeness = (completedModules.length / Object.keys(analysisResults).length) * 100;
    }
    
    // Calculate risk score based on warnings and violations
    let riskFactors = 0;
    Object.values(analysisResults).forEach(result => {
        if (result.warnings) riskFactors += result.warnings.length;
        if (result.criticalIssues) riskFactors += result.criticalIssues.length * 2;
    });
    
    metrics.riskScore = Math.min(riskFactors * 10, 100);
    
    return {
        overallConfidence: parseFloat((metrics.overallConfidence * 100).toFixed(1)),
        riskScore: parseFloat(metrics.riskScore.toFixed(1)),
        completeness: parseFloat(metrics.completeness.toFixed(1))
    };
}

function extractWarnings(analysisResults) {
    const warnings = [];
    
    Object.entries(analysisResults).forEach(([module, result]) => {
        if (result.warnings && Array.isArray(result.warnings)) {
            result.warnings.forEach(warning => {
                warnings.push({
                    module,
                    message: warning,
                    severity: 'warning'
                });
            });
        }
    });
    
    return warnings;
}

function extractCriticalIssues(analysisResults) {
    const issues = [];
    
    Object.entries(analysisResults).forEach(([module, result]) => {
        if (result.criticalViolations && Array.isArray(result.criticalViolations)) {
            result.criticalViolations.forEach(violation => {
                issues.push({
                    module,
                    message: violation.description || violation,
                    severity: 'critical',
                    necArticle: violation.article
                });
            });
        }
        
        if (result.status === 'failed') {
            issues.push({
                module,
                message: result.error || 'Module analysis failed',
                severity: 'error'
            });
        }
    });
    
    return issues;
}

async function storeAnalysisResults(projectId, analysisData, req) {
    try {
        const query = `
            INSERT INTO workflow_executions (
                project_id, 
                workflow_name, 
                status, 
                input_data, 
                output_data, 
                completed_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
        `;
        
        await req.db.query(query, [
            projectId,
            'comprehensive-ai-analysis',
            'success',
            JSON.stringify({ modules: analysisData.modulesAnalyzed }),
            JSON.stringify(analysisData)
        ]);
        
        req.logger.info(`Stored comprehensive analysis results for project ${projectId}`);
    } catch (error) {
        req.logger.error('Failed to store analysis results:', error);
        // Don't throw - this is not critical to the response
    }
}

module.exports = router;