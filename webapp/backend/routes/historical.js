const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();

// Get similar projects for analogous estimating
router.get('/similar-projects', [
  query('projectType').optional().isString().withMessage('Project type must be a string'),
  query('squareFootage').optional().isNumeric().withMessage('Square footage must be numeric'),
  query('complexity').optional().isIn(['low', 'mid', 'high', 'super-high']).withMessage('Invalid complexity level'),
  query('lookbackMonths').optional().isInt({ min: 1, max: 120 }).withMessage('Lookback period must be 1-120 months'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      projectType, 
      squareFootage, 
      complexity, 
      lookbackMonths = 36,
      limit = 10 
    } = req.query;

    // Build similarity query with weighted matching
    let query = `
      SELECT 
        pph.*,
        p.name as project_name,
        p.building_type,
        p.project_specifications,
        -- Calculate similarity score based on multiple factors
        (
          CASE 
            WHEN pph.building_type = $1 THEN 30
            WHEN pph.building_type ILIKE '%' || $1 || '%' THEN 15
            ELSE 0
          END +
          CASE 
            WHEN pph.complexity_level = $2 THEN 25
            WHEN (pph.complexity_level = 'mid' AND $2 IN ('low', 'high')) THEN 15
            WHEN (pph.complexity_level IN ('low', 'high') AND $2 = 'mid') THEN 15
            ELSE 0
          END +
          CASE 
            WHEN ABS(pph.square_footage - $3) <= ($3 * 0.1) THEN 25
            WHEN ABS(pph.square_footage - $3) <= ($3 * 0.2) THEN 20
            WHEN ABS(pph.square_footage - $3) <= ($3 * 0.3) THEN 15
            WHEN ABS(pph.square_footage - $3) <= ($3 * 0.5) THEN 10
            ELSE 0
          END +
          -- Recency bonus (more recent = higher score)
          CASE 
            WHEN pph.completed_at >= NOW() - INTERVAL '12 months' THEN 20
            WHEN pph.completed_at >= NOW() - INTERVAL '24 months' THEN 15
            WHEN pph.completed_at >= NOW() - INTERVAL '36 months' THEN 10
            ELSE 5
          END
        ) as similarity_score
      FROM project_performance_history pph
      LEFT JOIN projects p ON pph.project_id = p.id
      WHERE pph.completed_at >= NOW() - INTERVAL '${lookbackMonths} months'
        AND pph.actual_total_cost > 0
        AND pph.actual_duration > 0
    `;

    const params = [];
    let paramIndex = 1;

    // Add filters if provided
    if (projectType) {
      params.push(projectType);
      paramIndex++;
    } else {
      params.push('');
    }

    if (complexity) {
      params.push(complexity);
      paramIndex++;
    } else {
      params.push('mid');
    }

    if (squareFootage) {
      params.push(parseInt(squareFootage));
      paramIndex++;
    } else {
      params.push(10000);
    }

    query += `
      ORDER BY similarity_score DESC, pph.completed_at DESC
      LIMIT $${paramIndex}
    `;
    params.push(parseInt(limit));

    const result = await req.db.query(query, params);

    // Calculate aggregate metrics
    const projects = result.rows;
    const metrics = calculateHistoricalMetrics(projects);

    res.json({
      success: true,
      data: {
        similarProjects: projects,
        totalFound: projects.length,
        searchCriteria: {
          projectType,
          squareFootage: squareFootage ? parseInt(squareFootage) : null,
          complexity,
          lookbackMonths,
          limit
        },
        aggregateMetrics: metrics
      }
    });

  } catch (error) {
    console.error('Error fetching similar projects:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch similar projects',
      details: error.message 
    });
  }
});

// Get estimation accuracy tracking data
router.get('/accuracy-tracking', [
  query('projectType').optional().isString(),
  query('complexityLevel').optional().isIn(['low', 'mid', 'high', 'super-high']),
  query('squareFootageRange').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectType, complexityLevel, squareFootageRange } = req.query;

    let query = `
      SELECT 
        eat.*,
        ROUND(eat.average_cost_variance::numeric, 2) as avg_cost_variance,
        ROUND(eat.average_schedule_variance::numeric, 2) as avg_schedule_variance,
        ROUND((eat.accurate_estimates::numeric / NULLIF(eat.total_estimates, 0)) * 100, 1) as accuracy_percentage
      FROM estimation_accuracy_tracking eat
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (projectType) {
      query += ` AND eat.project_type = $${paramIndex}`;
      params.push(projectType);
      paramIndex++;
    }

    if (complexityLevel) {
      query += ` AND eat.complexity_level = $${paramIndex}`;
      params.push(complexityLevel);
      paramIndex++;
    }

    if (squareFootageRange) {
      query += ` AND eat.square_footage_range = $${paramIndex}`;
      params.push(squareFootageRange);
      paramIndex++;
    }

    query += ` ORDER BY eat.updated_at DESC`;

    const result = await req.db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching accuracy tracking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch accuracy tracking data',
      details: error.message 
    });
  }
});

// Create or update project performance record
router.post('/project-performance', [
  body('projectId').isUUID().withMessage('Project ID must be a valid UUID'),
  body('estimationId').isUUID().withMessage('Estimation ID must be a valid UUID'),
  body('estimatedMaterialCost').isNumeric().withMessage('Estimated material cost must be numeric'),
  body('estimatedLaborCost').isNumeric().withMessage('Estimated labor cost must be numeric'),
  body('estimatedTotalCost').isNumeric().withMessage('Estimated total cost must be numeric'),
  body('estimatedDuration').isInt({ min: 1 }).withMessage('Estimated duration must be positive integer'),
  body('actualMaterialCost').optional().isNumeric().withMessage('Actual material cost must be numeric'),
  body('actualLaborCost').optional().isNumeric().withMessage('Actual labor cost must be numeric'),
  body('actualTotalCost').optional().isNumeric().withMessage('Actual total cost must be numeric'),
  body('actualDuration').optional().isInt({ min: 1 }).withMessage('Actual duration must be positive integer'),
  body('buildingType').isString().withMessage('Building type is required'),
  body('squareFootage').isInt({ min: 1 }).withMessage('Square footage must be positive integer'),
  body('complexityLevel').isIn(['low', 'mid', 'high', 'super-high']).withMessage('Invalid complexity level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      projectId,
      estimationId,
      estimatedMaterialCost,
      estimatedLaborCost,
      estimatedTotalCost,
      estimatedDuration,
      actualMaterialCost,
      actualLaborCost,
      actualTotalCost,
      actualDuration,
      buildingType,
      squareFootage,
      complexityLevel,
      projectSpecifications,
      changeOrdersCount = 0,
      changeOrdersCost = 0,
      weatherDelays = 0,
      permitDelays = 0,
      reworkPercentage = 0,
      clientSatisfactionScore,
      inspectionFailures = 0,
      lessonsLearned,
      improvementOpportunities,
      contractorName,
      electricianCrewSize,
      projectManager
    } = req.body;

    // Insert or update project performance history
    const query = `
      INSERT INTO project_performance_history (
        project_id, estimation_id, estimated_material_cost, estimated_labor_cost, 
        estimated_total_cost, estimated_duration, actual_material_cost, actual_labor_cost,
        actual_total_cost, actual_duration, building_type, square_footage, complexity_level,
        project_specifications, change_orders_count, change_orders_cost, weather_delays,
        permit_delays, rework_percentage, client_satisfaction_score, inspection_failures,
        lessons_learned, improvement_opportunities, contractor_name, electrician_crew_size,
        project_manager, completed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        CASE WHEN $9 IS NOT NULL AND $10 IS NOT NULL THEN NOW() ELSE NULL END
      )
      ON CONFLICT (project_id, estimation_id) 
      DO UPDATE SET
        actual_material_cost = COALESCE($7, project_performance_history.actual_material_cost),
        actual_labor_cost = COALESCE($8, project_performance_history.actual_labor_cost),
        actual_total_cost = COALESCE($9, project_performance_history.actual_total_cost),
        actual_duration = COALESCE($10, project_performance_history.actual_duration),
        change_orders_count = $15,
        change_orders_cost = $16,
        weather_delays = $17,
        permit_delays = $18,
        rework_percentage = $19,
        client_satisfaction_score = COALESCE($20, project_performance_history.client_satisfaction_score),
        inspection_failures = $21,
        lessons_learned = COALESCE($22, project_performance_history.lessons_learned),
        improvement_opportunities = COALESCE($23, project_performance_history.improvement_opportunities),
        contractor_name = COALESCE($24, project_performance_history.contractor_name),
        electrician_crew_size = COALESCE($25, project_performance_history.electrician_crew_size),
        project_manager = COALESCE($26, project_performance_history.project_manager),
        completed_at = CASE 
          WHEN $9 IS NOT NULL AND $10 IS NOT NULL AND project_performance_history.completed_at IS NULL 
          THEN NOW() 
          ELSE project_performance_history.completed_at 
        END,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await req.db.query(query, [
      projectId, estimationId, estimatedMaterialCost, estimatedLaborCost,
      estimatedTotalCost, estimatedDuration, actualMaterialCost, actualLaborCost,
      actualTotalCost, actualDuration, buildingType, squareFootage, complexityLevel,
      JSON.stringify(projectSpecifications || {}), changeOrdersCount, changeOrdersCost,
      weatherDelays, permitDelays, reworkPercentage, clientSatisfactionScore,
      inspectionFailures, lessonsLearned, improvementOpportunities, contractorName,
      electricianCrewSize, projectManager
    ]);

    // Update accuracy tracking if project is completed
    if (actualTotalCost && actualDuration) {
      await updateAccuracyTracking(req.db, {
        buildingType,
        complexityLevel,
        squareFootage,
        costVariance: result.rows[0].cost_variance_percentage,
        scheduleVariance: result.rows[0].schedule_variance_percentage
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Project performance recorded successfully'
    });

  } catch (error) {
    console.error('Error recording project performance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record project performance',
      details: error.message 
    });
  }
});

// Get calibration factors for a project
router.post('/calibration-factors', [
  body('projectType').isString().withMessage('Project type is required'),
  body('squareFootage').isInt({ min: 1 }).withMessage('Square footage must be positive integer'),
  body('complexityLevel').isIn(['low', 'mid', 'high', 'super-high']).withMessage('Invalid complexity level'),
  body('lookbackMonths').optional().isInt({ min: 1, max: 120 }).withMessage('Lookback period must be 1-120 months')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectType, squareFootage, complexityLevel, lookbackMonths = 36 } = req.body;

    // Get similar projects
    const similarProjectsQuery = `
      SELECT 
        cost_variance_percentage,
        schedule_variance_percentage,
        actual_material_cost,
        estimated_material_cost,
        actual_labor_cost,
        estimated_labor_cost,
        client_satisfaction_score,
        change_orders_count,
        rework_percentage
      FROM project_performance_history pph
      WHERE pph.building_type = $1
        AND pph.complexity_level = $2
        AND ABS(pph.square_footage - $3) <= ($3 * 0.3)
        AND pph.completed_at >= NOW() - INTERVAL '${lookbackMonths} months'
        AND pph.actual_total_cost > 0
        AND pph.actual_duration > 0
      ORDER BY pph.completed_at DESC
      LIMIT 20
    `;

    const result = await req.db.query(similarProjectsQuery, [projectType, complexityLevel, squareFootage]);
    const projects = result.rows;

    if (projects.length === 0) {
      return res.json({
        success: true,
        data: {
          calibrationFactors: {
            costMultiplier: 1.0,
            scheduleMultiplier: 1.0,
            materialCostAdjustment: 0,
            laborCostAdjustment: 0,
            confidence: 'low'
          },
          historicalAccuracy: {
            averageCostVariance: 0,
            averageScheduleVariance: 0,
            accurateEstimatesPercentage: 0,
            projectCount: 0
          },
          riskFactors: [],
          recommendations: [{
            category: 'data_availability',
            priority: 'medium',
            recommendation: 'No similar historical projects found - use industry standards',
            rationale: 'Insufficient historical data for calibration'
          }],
          dataQuality: {
            score: 0,
            quality: 'no_data',
            issues: ['No historical data available for similar projects']
          }
        }
      });
    }

    // Calculate calibration factors
    const calibrationFactors = calculateCalibrationFactors(projects);
    const accuracy = calculateAccuracyMetrics(projects);
    const risks = identifyRisks(projects);
    const recommendations = generateRecommendations(projects, risks);
    const dataQuality = assessDataQuality(projects);

    res.json({
      success: true,
      data: {
        calibrationFactors,
        historicalAccuracy: accuracy,
        riskFactors: risks,
        recommendations,
        dataQuality,
        similarProjectsAnalyzed: projects.length
      }
    });

  } catch (error) {
    console.error('Error calculating calibration factors:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate calibration factors',
      details: error.message 
    });
  }
});

// Helper functions
function calculateHistoricalMetrics(projects) {
  if (projects.length === 0) {
    return {
      averageCostVariance: 0,
      averageScheduleVariance: 0,
      averageCostPerSqft: 0,
      averageDurationPerSqft: 0,
      successRate: 0
    };
  }

  const totalCostVariance = projects.reduce((sum, p) => sum + Math.abs(parseFloat(p.cost_variance_percentage) || 0), 0);
  const totalScheduleVariance = projects.reduce((sum, p) => sum + Math.abs(parseFloat(p.schedule_variance_percentage) || 0), 0);
  const totalCostPerSqft = projects.reduce((sum, p) => sum + (parseFloat(p.actual_total_cost) / parseInt(p.square_footage)), 0);
  const totalDurationPerSqft = projects.reduce((sum, p) => sum + (parseFloat(p.actual_duration) / parseInt(p.square_footage)), 0);
  
  const successfulProjects = projects.filter(p => 
    Math.abs(parseFloat(p.cost_variance_percentage) || 0) <= 5 && 
    Math.abs(parseFloat(p.schedule_variance_percentage) || 0) <= 10 &&
    (parseInt(p.client_satisfaction_score) || 0) >= 7
  );

  return {
    averageCostVariance: totalCostVariance / projects.length,
    averageScheduleVariance: totalScheduleVariance / projects.length,
    averageCostPerSqft: totalCostPerSqft / projects.length,
    averageDurationPerSqft: totalDurationPerSqft / projects.length,
    successRate: (successfulProjects.length / projects.length) * 100
  };
}

function calculateCalibrationFactors(projects) {
  const costTrend = projects.reduce((sum, p) => sum + (parseFloat(p.cost_variance_percentage) || 0), 0) / projects.length;
  const scheduleTrend = projects.reduce((sum, p) => sum + (parseFloat(p.schedule_variance_percentage) || 0), 0) / projects.length;
  
  const costCalibration = costTrend > 0 ? 1 + (costTrend / 100) * 0.5 : 1;
  const scheduleCalibration = scheduleTrend > 0 ? 1 + (scheduleTrend / 100) * 0.3 : 1;
  
  return {
    costMultiplier: Math.max(0.8, Math.min(1.3, costCalibration)),
    scheduleMultiplier: Math.max(0.8, Math.min(1.4, scheduleCalibration)),
    materialCostAdjustment: costTrend * 0.6,
    laborCostAdjustment: costTrend * 0.4,
    confidence: projects.length >= 3 ? 'high' : projects.length >= 2 ? 'medium' : 'low'
  };
}

function calculateAccuracyMetrics(projects) {
  const totalCostVariance = projects.reduce((sum, p) => sum + Math.abs(parseFloat(p.cost_variance_percentage) || 0), 0);
  const totalScheduleVariance = projects.reduce((sum, p) => sum + Math.abs(parseFloat(p.schedule_variance_percentage) || 0), 0);
  const accurateCount = projects.filter(p => 
    Math.abs(parseFloat(p.cost_variance_percentage) || 0) <= 5 && 
    Math.abs(parseFloat(p.schedule_variance_percentage) || 0) <= 10
  ).length;
  
  return {
    averageCostVariance: totalCostVariance / projects.length,
    averageScheduleVariance: totalScheduleVariance / projects.length,
    accurateEstimatesPercentage: (accurateCount / projects.length) * 100,
    projectCount: projects.length
  };
}

function identifyRisks(projects) {
  const risks = [];
  
  const highVarianceProjects = projects.filter(p => 
    Math.abs(parseFloat(p.cost_variance_percentage) || 0) > 10 || 
    Math.abs(parseFloat(p.schedule_variance_percentage) || 0) > 15
  );
  
  if (highVarianceProjects.length > projects.length * 0.3) {
    risks.push({
      type: 'estimation_accuracy',
      severity: 'high',
      description: 'Historical projects show high cost/schedule variance',
      impact: 'Budget overruns and delays likely'
    });
  }
  
  const avgChangeOrders = projects.reduce((sum, p) => sum + (parseInt(p.change_orders_count) || 0), 0) / projects.length;
  if (avgChangeOrders > 3) {
    risks.push({
      type: 'scope_changes',
      severity: 'medium',
      description: 'Similar projects experienced frequent change orders',
      impact: 'Potential for scope creep and additional costs'
    });
  }
  
  const avgRework = projects.reduce((sum, p) => sum + (parseFloat(p.rework_percentage) || 0), 0) / projects.length;
  if (avgRework > 3) {
    risks.push({
      type: 'quality_control',
      severity: 'medium',
      description: 'Historical projects required significant rework',
      impact: 'Quality control measures needed'
    });
  }
  
  const avgSatisfaction = projects.reduce((sum, p) => sum + (parseInt(p.client_satisfaction_score) || 7), 0) / projects.length;
  if (avgSatisfaction < 7) {
    risks.push({
      type: 'client_satisfaction',
      severity: 'high',
      description: 'Similar projects had below-average client satisfaction',
      impact: 'Focus on communication and quality delivery required'
    });
  }
  
  return risks;
}

function generateRecommendations(projects, risks) {
  const recommendations = [];
  
  const costVariances = projects.map(p => parseFloat(p.cost_variance_percentage) || 0);
  const avgCostVariance = costVariances.reduce((a, b) => a + b, 0) / costVariances.length;
  
  if (avgCostVariance > 5) {
    recommendations.push({
      category: 'cost_estimation',
      priority: 'high',
      recommendation: `Add ${Math.ceil(avgCostVariance * 0.5)}% contingency based on historical overruns`,
      rationale: `Similar projects exceeded budget by an average of ${avgCostVariance.toFixed(1)}%`
    });
  }
  
  const scheduleVariances = projects.map(p => parseFloat(p.schedule_variance_percentage) || 0);
  const avgScheduleVariance = scheduleVariances.reduce((a, b) => a + b, 0) / scheduleVariances.length;
  
  if (avgScheduleVariance > 10) {
    recommendations.push({
      category: 'scheduling',
      priority: 'high',
      recommendation: `Add ${Math.ceil(avgScheduleVariance * 0.3)} days schedule buffer`,
      rationale: `Similar projects were delayed by an average of ${avgScheduleVariance.toFixed(1)}%`
    });
  }
  
  // Add risk-based recommendations
  risks.forEach(risk => {
    switch (risk.type) {
      case 'scope_changes':
        recommendations.push({
          category: 'project_management',
          priority: 'medium',
          recommendation: 'Implement strict change order approval process',
          rationale: 'Historical projects experienced frequent scope changes'
        });
        break;
      case 'quality_control':
        recommendations.push({
          category: 'quality',
          priority: 'high',
          recommendation: 'Increase inspection frequency and quality checkpoints',
          rationale: 'Similar projects required significant rework'
        });
        break;
      case 'client_satisfaction':
        recommendations.push({
          category: 'communication',
          priority: 'high',
          recommendation: 'Establish weekly client progress meetings',
          rationale: 'Improve communication based on past client feedback'
        });
        break;
    }
  });
  
  return recommendations;
}

function assessDataQuality(projects) {
  const issues = [];
  let qualityScore = 1.0;
  
  const incompleteProjects = projects.filter(p => 
    !p.estimated_total_cost || !p.actual_total_cost || !p.estimated_duration || !p.actual_duration
  );
  
  if (incompleteProjects.length > 0) {
    issues.push('Some projects have incomplete cost/schedule data');
    qualityScore -= 0.2;
  }
  
  const extremeVarianceProjects = projects.filter(p => 
    Math.abs(parseFloat(p.cost_variance_percentage) || 0) > 50 || 
    Math.abs(parseFloat(p.schedule_variance_percentage) || 0) > 100
  );
  
  if (extremeVarianceProjects.length > 0) {
    issues.push('Some projects show extreme variance - data may be unreliable');
    qualityScore -= 0.2;
  }
  
  let quality;
  if (qualityScore >= 0.8) quality = 'excellent';
  else if (qualityScore >= 0.6) quality = 'good';
  else if (qualityScore >= 0.4) quality = 'fair';
  else quality = 'poor';
  
  return {
    score: Math.max(0, qualityScore),
    quality,
    issues: issues.length > 0 ? issues : ['No data quality issues identified']
  };
}

async function updateAccuracyTracking(db, data) {
  const { buildingType, complexityLevel, squareFootage, costVariance, scheduleVariance } = data;
  
  // Determine square footage range
  let sqftRange;
  if (squareFootage <= 5000) sqftRange = '0-5000';
  else if (squareFootage <= 10000) sqftRange = '5001-10000';
  else if (squareFootage <= 25000) sqftRange = '10001-25000';
  else if (squareFootage <= 50000) sqftRange = '25001-50000';
  else if (squareFootage <= 100000) sqftRange = '50001-100000';
  else sqftRange = '100000+';
  
  const isAccurate = Math.abs(costVariance) <= 5 && Math.abs(scheduleVariance) <= 10;
  
  const query = `
    INSERT INTO estimation_accuracy_tracking (
      project_type, complexity_level, square_footage_range, 
      total_estimates, accurate_estimates, average_cost_variance, average_schedule_variance
    ) VALUES ($1, $2, $3, 1, $4, $5, $6)
    ON CONFLICT (project_type, complexity_level, square_footage_range)
    DO UPDATE SET
      total_estimates = estimation_accuracy_tracking.total_estimates + 1,
      accurate_estimates = estimation_accuracy_tracking.accurate_estimates + $4,
      average_cost_variance = (
        (estimation_accuracy_tracking.average_cost_variance * estimation_accuracy_tracking.total_estimates) + $5
      ) / (estimation_accuracy_tracking.total_estimates + 1),
      average_schedule_variance = (
        (estimation_accuracy_tracking.average_schedule_variance * estimation_accuracy_tracking.total_estimates) + $6
      ) / (estimation_accuracy_tracking.total_estimates + 1),
      updated_at = NOW()
  `;
  
  await db.query(query, [
    buildingType, 
    complexityLevel, 
    sqftRange, 
    isAccurate ? 1 : 0, 
    Math.abs(costVariance), 
    Math.abs(scheduleVariance)
  ]);
}

module.exports = router;