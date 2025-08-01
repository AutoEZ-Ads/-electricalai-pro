import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Users, Brain, Activity, Settings, Plus, Trash2, Zap, Building, FileText, DollarSign, Clock, Cable, AlertTriangle, Shield } from 'lucide-react';
import { projectsAPI, estimationsAPI } from '../services/api';

const ElectricalEstimatorSuperAgent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    completedEstimates: 0,
    totalProjectValue: 0,
    avgAccuracy: 95.2,
    necCompliance: 100
  });
  const [newAgentType, setNewAgentType] = useState('');
  const logContainerRef = useRef(null);

  // Electrical estimation-specific agent types
  const agentTypes = {
    'load-calculator': { 
      name: 'Load Calculator', 
      color: 'bg-blue-500', 
      icon: Zap,
      tasks: ['load-calculation', 'demand-factor', 'service-sizing', 'panel-scheduling'],
      specialties: ['residential-load', 'commercial-load', 'industrial-load', 'motor-load', 'educational-load', 'school-systems']
    },
    'wire-sizing': { 
      name: 'Wire Sizing Specialist', 
      color: 'bg-green-500', 
      icon: Cable,
      tasks: ['conductor-sizing', 'voltage-drop', 'ampacity-calculation', 'derating'],
      specialties: ['copper-wire', 'aluminum-wire', 'conduit-fill', 'temperature-correction', 'fire-rated-systems']
    },
    'material-estimator': { 
      name: 'Material Estimator', 
      color: 'bg-amber-500', 
      icon: Building,
      tasks: ['material-takeoff', 'device-count', 'conduit-length', 'wire-length'],
      specialties: ['fixtures', 'devices', 'panels', 'conduit-systems', 'classroom-systems', 'lab-equipment']
    },
    'nec-compliance': { 
      name: 'NEC Compliance Officer', 
      color: 'bg-red-500', 
      icon: Shield,
      tasks: ['code-review', 'gfci-requirements', 'afci-requirements', 'grounding-verification'],
      specialties: ['article-210', 'article-220', 'article-250', 'article-300', 'article-518', 'educational-codes']
    },
    'cost-analyzer': { 
      name: 'Cost Analyzer', 
      color: 'bg-purple-500', 
      icon: DollarSign,
      tasks: ['material-pricing', 'labor-estimation', 'markup-calculation', 'bid-preparation'],
      specialties: ['neca-labor-units', 'rs-means', 'local-pricing', 'union-rates', 'educational-pricing', 'complexity-adjustments']
    },
    'safety-analyzer': { 
      name: 'Safety Analyzer', 
      color: 'bg-orange-500', 
      icon: AlertTriangle,
      tasks: ['arc-flash-analysis', 'short-circuit', 'coordination-study', 'ppe-requirements'],
      specialties: ['ieee-1584', 'nfpa-70e', 'osha-compliance', 'hazard-categories', 'school-safety', 'emergency-systems']
    },
    'schedule-estimator': { 
      name: 'Schedule Estimator', 
      color: 'bg-teal-500', 
      icon: Clock,
      tasks: ['installation-sequencing', 'crew-scheduling', 'milestone-planning', 'inspection-scheduling'],
      specialties: ['rough-in', 'trim-out', 'energization', 'commissioning', 'school-schedules', 'summer-construction']
    },
    'blueprint-analyzer': { 
      name: 'Blueprint Analyzer', 
      color: 'bg-indigo-500', 
      icon: FileText,
      tasks: ['drawing-analysis', 'circuit-identification', 'device-location', 'conduit-routing'],
      specialties: ['power-plans', 'lighting-plans', 'single-line', 'panel-schedules', 'school-layouts', 'classroom-circuits']
    },
    'complexity-assessor': {
      name: 'Complexity Assessor',
      color: 'bg-pink-500',
      icon: Brain,
      tasks: ['complexity-analysis', 'risk-assessment', 'scope-evaluation', 'difficulty-rating'],
      specialties: ['project-complexity', 'technical-difficulty', 'access-challenges', 'coordination-complexity']
    },
    'educational-specialist': {
      name: 'Educational Specialist',
      color: 'bg-cyan-500',
      icon: Building,
      tasks: ['classroom-analysis', 'lab-requirements', 'av-systems', 'fire-alarm-integration'],
      specialties: ['k12-schools', 'universities', 'vocational-schools', 'special-education', 'science-labs', 'computer-labs']
    },
    'historical-analyst': {
      name: 'Historical Data Analyst',
      color: 'bg-violet-500',
      icon: Brain,
      tasks: ['historical-analysis', 'similar-project-lookup', 'accuracy-calibration', 'performance-learning'],
      specialties: ['past-performance', 'analogous-estimating', 'variance-analysis', 'ml-calibration', 'trend-analysis']
    }
  };

  // Electrical project types with complexity levels
  const projectTypes = [
    'Single Family Residential',
    'Multi-Family Residential', 
    'Commercial Office',
    'Retail Space',
    'Industrial Facility',
    'Healthcare Facility',
    'Elementary School',
    'Middle School',
    'High School',
    'University/College',
    'Vocational School',
    'Special Education Facility',
    'Community College',
    'Research University',
    'Data Center'
  ];

  // Project complexity levels
  const complexityLevels = {
    'low': {
      name: 'Low Complexity',
      color: 'bg-green-500',
      description: 'Standard installation, minimal challenges',
      multiplier: 1.0,
      examples: ['Basic residential rewire', 'Small office tenant improvement', 'Elementary classroom renovation']
    },
    'mid': {
      name: 'Mid Complexity', 
      color: 'bg-yellow-500',
      description: 'Moderate challenges, some specialty systems',
      multiplier: 1.3,
      examples: ['Multi-story commercial', 'High school renovation', 'Industrial control upgrade']
    },
    'high': {
      name: 'High Complexity',
      color: 'bg-orange-500', 
      description: 'Complex systems, coordination challenges',
      multiplier: 1.7,
      examples: ['University research lab', 'Hospital renovation', 'Data center expansion']
    },
    'super-high': {
      name: 'Super High Complexity',
      color: 'bg-red-500',
      description: 'Mission critical, extreme difficulty',
      multiplier: 2.5,
      examples: ['Live hospital surgery suite', 'Active data center hot work', 'University particle accelerator']
    }
  };

  // Electrical Estimation Super Agent Class
  class ElectricalEstimationSuperAgent {
    constructor() {
      this.subAgents = new Map();
      this.taskQueue = [];
      this.projectQueue = [];
      this.isRunning = false;
      this.completedEstimates = 0;
      this.totalProjectValue = 0;
      this.necViolations = 0;
    }

    async createSubAgent(id, type, config = {}) {
      const agentConfig = agentTypes[type];
      if (!agentConfig) throw new Error(`Unknown agent type: ${type}`);

      const subAgent = new ElectricalSubAgent(id, type, agentConfig, config);
      this.subAgents.set(id, subAgent);
      
      this.log(`Created ${agentConfig.name}: ${id}`, 'success');
      return subAgent;
    }

    async processProject(project) {
      this.log(`Starting electrical estimation for project: ${project.name}`, 'info');
      
      try {
        // Create estimation in backend
        const estimationResponse = await estimationsAPI.create({
          project_id: project.id,
          estimation_type: 'detailed',
          status: 'processing'
        });
        
        const estimationId = estimationResponse.data.id;
        
        // Generate electrical-specific tasks
        const estimationTasks = this.generateElectricalTasks(project);
        
        // Distribute tasks to specialized agents
        const results = await this.distributeElectricalTasks(estimationTasks);
        
        // Run NEC compliance checks
        const complianceResults = await this.runComplianceChecks(project, results);
        
        // Compile final electrical estimate
        const finalEstimate = await this.compileElectricalEstimate(project, results, complianceResults);
        
        // Update backend with results
        await estimationsAPI.update(estimationId, {
          status: 'completed',
          calculations: finalEstimate.breakdown,
          material_cost: finalEstimate.materialCost,
          labor_cost: finalEstimate.laborCost,
          equipment_cost: finalEstimate.equipmentCost,
          total_cost: finalEstimate.totalCost,
          confidence_score: Math.round(finalEstimate.confidence * 100)
        });
        
        this.completedEstimates++;
        this.totalProjectValue += finalEstimate.totalCost;
        
        // Update project with estimate
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, estimate: finalEstimate, status: 'completed' } : p
        ));
        
        this.log(`Completed electrical estimation for ${project.name}: $${finalEstimate.totalCost.toLocaleString()}`, 'success');
        
        return finalEstimate;
      } catch (error) {
        this.log(`Error processing project ${project.name}: ${error.message}`, 'error');
        throw error;
      }
    }

    generateElectricalTasks(project) {
      const tasks = [];
      
      // Complexity assessment (always first)
      tasks.push({
        type: 'complexity-analysis',
        description: `Assess project complexity for ${project.name}`,
        context: {
          projectType: project.building_type,
          squareFootage: project.square_footage,
          floors: project.floors,
          specifications: project.project_specifications,
          location: project.location,
          occupancy: project.occupancy_type
        },
        priority: 'critical',
        estimatedHours: 2
      });

      // Historical data analysis (always perform to calibrate estimates)
      tasks.push({
        type: 'historical-analysis',
        description: `Analyze similar past projects for ${project.name}`,
        context: {
          projectType: project.building_type,
          squareFootage: project.square_footage,
          floors: project.floors,
          specifications: project.project_specifications,
          complexity: project.complexity,
          lookbackPeriod: 36 // months
        },
        priority: 'high',
        estimatedHours: 3
      });

      // Educational facility specific assessment
      if (this.isEducationalFacility(project.building_type)) {
        tasks.push({
          type: 'classroom-analysis',
          description: `Analyze educational facility requirements for ${project.building_type}`,
          context: {
            facilityType: project.building_type,
            studentCapacity: project.student_capacity,
            classroomCount: project.classroom_count,
            labCount: project.lab_count,
            specialNeeds: project.special_education,
            avRequirements: project.av_systems,
            gradeLevel: this.getGradeLevel(project.building_type)
          },
          priority: 'high',
          necArticle: '518',
          estimatedHours: 6
        });
      }
      
      // Load calculation tasks
      tasks.push({
        type: 'load-calculation',
        description: `Calculate electrical loads for ${project.building_type}`,
        context: {
          projectType: project.building_type,
          squareFootage: project.square_footage,
          floors: project.floors,
          specifications: project.project_specifications,
          isEducational: this.isEducationalFacility(project.building_type)
        },
        priority: 'high',
        necArticle: '220',
        estimatedHours: 4
      });

      // Wire sizing tasks
      tasks.push({
        type: 'conductor-sizing',
        description: `Size feeders and branch circuits for ${project.name}`,
        context: {
          projectType: project.building_type,
          loadCalculation: 'pending',
          voltage: project.voltage || 120,
          distance: project.longest_run || 100
        },
        priority: 'high',
        necArticle: '310'
      });

      // Material takeoff
      tasks.push({
        type: 'material-takeoff',
        description: `Count devices and calculate materials for ${project.name}`,
        context: {
          projectType: project.building_type,
          squareFootage: project.square_footage,
          specifications: project.project_specifications,
          deviceDensity: this.getDeviceDensity(project.building_type)
        },
        priority: 'medium',
        necArticle: '210'
      });

      // Safety analysis
      tasks.push({
        type: 'arc-flash-analysis',
        description: `Perform arc flash study for ${project.name}`,
        context: {
          serviceSize: 'pending',
          voltage: project.voltage || 120,
          transformerSize: project.transformer_kva
        },
        priority: 'medium',
        standards: ['IEEE 1584', 'NFPA 70E']
      });

      // NEC compliance review
      tasks.push({
        type: 'code-review',
        description: `Review NEC compliance for ${project.name}`,
        context: {
          projectType: project.building_type,
          occupancy: project.occupancy_type,
          specialRequirements: project.special_requirements
        },
        priority: 'high',
        necArticles: ['210', '220', '250', '300', '700']
      });

      // Schedule estimation
      tasks.push({
        type: 'installation-sequencing',
        description: `Create installation schedule for ${project.name}`,
        context: {
          projectType: project.building_type,
          squareFootage: project.square_footage,
          complexity: project.complexity || 'medium',
          crewSize: project.crew_size || 4
        },
        priority: 'medium'
      });

      return tasks;
    }

    async distributeElectricalTasks(tasks) {
      const results = {};
      
      for (const task of tasks) {
        const suitableAgents = this.findSuitableAgents(task);
        
        if (suitableAgents.length > 0) {
          const selectedAgent = this.selectBestAgent(suitableAgents, task);
          const result = await selectedAgent.executeElectricalTask(task);
          results[task.type] = result;
          
          // Update dependent tasks with results
          this.updateDependentTasks(tasks, task.type, result);
        } else {
          this.log(`No suitable agents for task: ${task.type}`, 'warning');
        }
      }
      
      return results;
    }

    updateDependentTasks(tasks, completedType, result) {
      // Update tasks that depend on completed results
      if (completedType === 'load-calculation') {
        const wireSizingTask = tasks.find(t => t.type === 'conductor-sizing');
        if (wireSizingTask) {
          wireSizingTask.context.loadCalculation = result.totalLoad;
          wireSizingTask.context.serviceSize = result.recommendedServiceSize;
        }
      }
    }

    async runComplianceChecks(project, taskResults) {
      this.log('Running NEC compliance checks', 'info');
      
      const violations = [];
      const warnings = [];
      
      // Check GFCI requirements (NEC 210.8)
      if (project.building_type === 'residential') {
        const requiredGFCILocations = ['kitchen', 'bathroom', 'garage', 'outdoor', 'basement'];
        requiredGFCILocations.forEach(location => {
          if (!taskResults['material-takeoff']?.gfciLocations?.includes(location)) {
            violations.push({
              article: '210.8',
              description: `GFCI protection required in ${location}`,
              severity: 'high'
            });
          }
        });
      }
      
      // Check load calculations (NEC 220)
      if (taskResults['load-calculation']) {
        const load = taskResults['load-calculation'];
        if (load.demandFactor > 1.0) {
          violations.push({
            article: '220.42',
            description: 'Demand factor cannot exceed 100%',
            severity: 'high'
          });
        }
      }
      
      // Check wire sizing (NEC 310)
      if (taskResults['conductor-sizing']) {
        const sizing = taskResults['conductor-sizing'];
        if (sizing.voltageDrop > 0.03) {
          warnings.push({
            article: '210.19(A)',
            description: `Voltage drop ${(sizing.voltageDrop * 100).toFixed(1)}% exceeds recommended 3%`,
            severity: 'medium'
          });
        }
      }
      
      this.necViolations += violations.length;
      
      return {
        violations,
        warnings,
        compliant: violations.length === 0,
        complianceScore: Math.max(0, 100 - (violations.length * 10) - (warnings.length * 5))
      };
    }

    async compileElectricalEstimate(project, taskResults, complianceResults) {
      this.log(`Compiling final electrical estimate for ${project.name}`, 'info');
      
      const estimate = {
        projectId: project.id,
        projectName: project.name,
        estimationType: 'electrical',
        
        // Electrical calculations
        loadCalculation: taskResults['load-calculation'] || {},
        wireSizing: taskResults['conductor-sizing'] || {},
        
        // Costs
        materialCost: taskResults['material-takeoff']?.totalCost || 0,
        laborCost: this.calculateLaborCost(taskResults),
        equipmentCost: this.calculateEquipmentCost(project),
        
        // Schedule
        schedule: taskResults['installation-sequencing']?.schedule || {},
        totalDuration: taskResults['installation-sequencing']?.duration || 0,
        
        // Compliance
        necCompliance: complianceResults,
        safetyAnalysis: taskResults['arc-flash-analysis'] || {},
        
        // Totals
        subtotal: 0,
        overhead: 0,
        profit: 0,
        totalCost: 0,
        
        // Metadata
        confidence: this.calculateConfidence(taskResults, complianceResults),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        breakdown: taskResults
      };

      // Calculate totals
      estimate.subtotal = estimate.materialCost + estimate.laborCost + estimate.equipmentCost;
      estimate.overhead = estimate.subtotal * 0.15; // 15% overhead
      estimate.profit = (estimate.subtotal + estimate.overhead) * 0.10; // 10% profit
      estimate.totalCost = estimate.subtotal + estimate.overhead + estimate.profit;
      
      return estimate;
    }

    calculateLaborCost(taskResults) {
      const baseRate = 75; // $/hour for electrician
      let totalHours = 0;
      
      if (taskResults['material-takeoff']) {
        const devices = taskResults['material-takeoff'].deviceCount || 0;
        const necaUnits = {
          outlet: 0.15,
          switch: 0.12,
          fixture: 0.75,
          panel: 4.5
        };
        
        // Calculate hours based on NECA labor units
        totalHours = devices * 0.20; // Average labor unit
      }
      
      if (taskResults['installation-sequencing']) {
        totalHours = Math.max(totalHours, taskResults['installation-sequencing'].laborHours || 0);
      }
      
      return totalHours * baseRate;
    }

    calculateEquipmentCost(project) {
      // Basic equipment cost calculation
      const sqft = project.square_footage || 1000;
      return sqft * 0.5; // $0.50 per sq ft for equipment/tools
    }

    calculateConfidence(taskResults, complianceResults) {
      let confidence = 0.7; // Base confidence
      
      // Increase confidence for completed tasks
      const completedTasks = Object.keys(taskResults).length;
      confidence += completedTasks * 0.04;
      
      // Adjust for compliance
      if (complianceResults.compliant) {
        confidence += 0.1;
      } else {
        confidence -= complianceResults.violations.length * 0.05;
      }
      
      return Math.min(Math.max(confidence, 0.5), 0.98);
    }

    getDeviceDensity(buildingType) {
      const densities = {
        'residential': 0.5, // devices per 100 sq ft
        'commercial': 0.8,
        'industrial': 0.3,
        'healthcare': 1.2,
        'educational': 0.7,
        'data center': 1.5
      };
      return densities[buildingType] || 0.5;
    }

    findSuitableAgents(task) {
      return Array.from(this.subAgents.values())
        .filter(agent => 
          agent.canHandle(task.type) && 
          agent.status === 'idle'
        );
    }

    selectBestAgent(agents, task) {
      return agents.reduce((best, current) => {
        const currentScore = current.getExpertiseScore(task);
        const bestScore = best.getExpertiseScore(task);
        return currentScore > bestScore ? current : best;
      });
    }

    isEducationalFacility(buildingType) {
      const educationalTypes = [
        'Elementary School', 'Middle School', 'High School', 
        'University/College', 'Vocational School', 'Special Education Facility',
        'Community College', 'Research University', 'educational'
      ];
      return educationalTypes.some(type => 
        buildingType.toLowerCase().includes(type.toLowerCase()) ||
        type.toLowerCase().includes(buildingType.toLowerCase())
      );
    }

    getGradeLevel(buildingType) {
      const gradeLevels = {
        'Elementary School': 'K-5',
        'Middle School': '6-8', 
        'High School': '9-12',
        'University/College': 'undergraduate',
        'Research University': 'graduate',
        'Community College': 'post-secondary',
        'Vocational School': 'trade',
        'Special Education Facility': 'special-needs'
      };
      return gradeLevels[buildingType] || 'mixed';
    }

    determineComplexityLevel(project, assessmentResults) {
      let complexityScore = 0;
      
      // Base complexity by project type
      const typeComplexity = {
        'Elementary School': 2,
        'Middle School': 3,
        'High School': 4,
        'University/College': 5,
        'Research University': 7,
        'Vocational School': 4,
        'Special Education Facility': 6,
        'Healthcare Facility': 6,
        'Data Center': 8,
        'Industrial Facility': 5
      };
      
      complexityScore += typeComplexity[project.building_type] || 3;
      
      // Size factor
      const sqft = project.square_footage || 1000;
      if (sqft > 100000) complexityScore += 3;
      else if (sqft > 50000) complexityScore += 2;
      else if (sqft > 10000) complexityScore += 1;
      
      // Special systems
      if (project.project_specifications?.lab_count > 5) complexityScore += 2;
      if (project.project_specifications?.science_labs) complexityScore += 2;
      if (project.project_specifications?.computer_labs) complexityScore += 1;
      if (project.project_specifications?.emergency_power) complexityScore += 2;
      if (project.project_specifications?.clean_room) complexityScore += 3;
      
      // Determine level
      if (complexityScore <= 3) return 'low';
      if (complexityScore <= 6) return 'mid';
      if (complexityScore <= 9) return 'high';
      return 'super-high';
    }

    log(message, level = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = { timestamp, message, level, source: 'ElectricalSuperAgent' };
      
      setLogs(prev => [...prev.slice(-99), logEntry]);
    }

    async start() {
      this.isRunning = true;
      this.log('Electrical Estimation Super Agent system started', 'success');
      
      // Load existing projects from backend
      try {
        const response = await projectsAPI.getAll({ limit: 10 });
        const backendProjects = response.data.projects.map(p => ({
          ...p,
          status: p.estimation_status === 'completed' ? 'completed' : 'queued'
        }));
        setProjects(backendProjects);
      } catch (error) {
        this.log('Failed to load projects from backend', 'error');
      }
      
      this.mainLoop();
    }

    stop() {
      this.isRunning = false;
      this.subAgents.forEach(agent => agent.stop());
      this.log('Electrical Estimation Super Agent system stopped', 'info');
    }

    async mainLoop() {
      while (this.isRunning) {
        // Process project queue
        const queuedProjects = projects.filter(p => p.status === 'queued');
        if (queuedProjects.length > 0) {
          const project = queuedProjects[0];
          setProjects(prev => prev.map(p => 
            p.id === project.id ? { ...p, status: 'processing' } : p
          ));
          await this.processProject(project);
        }

        // Update stats
        setStats({
          totalAgents: this.subAgents.size,
          activeAgents: Array.from(this.subAgents.values()).filter(a => a.status === 'working').length,
          completedEstimates: this.completedEstimates,
          totalProjectValue: this.totalProjectValue,
          avgAccuracy: 95.2,
          necCompliance: this.necViolations === 0 ? 100 : Math.max(0, 100 - (this.necViolations * 5))
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    async addProject(projectData) {
      try {
        // Create project in backend
        const response = await projectsAPI.create(projectData);
        const project = { ...response.data, status: 'queued' };
        
        setProjects(prev => [...prev, project]);
        this.log(`Project added to queue: ${project.name}`, 'info');
        
        return project;
      } catch (error) {
        this.log(`Failed to add project: ${error.message}`, 'error');
        throw error;
      }
    }

    removeAgent(id) {
      const agent = this.subAgents.get(id);
      if (agent) {
        agent.stop();
        this.subAgents.delete(id);
        this.log(`Removed agent: ${id}`, 'info');
      }
    }
  }

  // Electrical Sub Agent Class
  class ElectricalSubAgent {
    constructor(id, type, config, customConfig = {}) {
      this.id = id;
      this.type = type;
      this.name = config.name;
      this.color = config.color;
      this.icon = config.icon;
      this.capabilities = config.tasks;
      this.specialties = config.specialties;
      this.status = 'idle';
      this.currentTask = null;
      this.tasksCompleted = 0;
      this.expertiseLevel = Math.random() * 0.3 + 0.7;
      this.config = { ...config, ...customConfig };
    }

    canHandle(taskType) {
      return this.capabilities.some(cap => taskType.includes(cap));
    }

    getExpertiseScore(task) {
      let score = this.expertiseLevel;
      
      // Boost score for NEC-related tasks
      if (task.necArticle && this.type === 'nec-compliance') {
        score += 0.3;
      }
      
      // Consider task priority
      if (task.priority === 'high') {
        score += 0.1;
      }
      
      return Math.min(score, 1.0);
    }

    async executeElectricalTask(task) {
      this.status = 'working';
      this.currentTask = task;
      
      this.log(`Starting electrical task: ${task.description}`);
      
      try {
        // Simulate electrical calculation
        const result = await this.performElectricalCalculation(task);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        this.tasksCompleted++;
        this.status = 'idle';
        this.currentTask = null;
        
        this.log(`Completed: ${task.description}`, 'success');
        return result;
        
      } catch (error) {
        this.status = 'error';
        this.log(`Failed: ${task.description} - ${error.message}`, 'error');
        throw error;
      }
    }

    async performElectricalCalculation(task) {
      switch (task.type) {
        case 'complexity-analysis':
          return this.assessComplexity(task.context);
          
        case 'classroom-analysis':
          return this.analyzeEducationalFacility(task.context);
          
        case 'load-calculation':
          return this.calculateElectricalLoad(task.context);
          
        case 'conductor-sizing':
          return this.sizeConductors(task.context);
          
        case 'material-takeoff':
          return this.calculateMaterials(task.context);
          
        case 'arc-flash-analysis':
          return this.analyzeArcFlash(task.context);
          
        case 'code-review':
          return this.reviewNECCompliance(task.context);
          
        case 'installation-sequencing':
          return this.createInstallationSchedule(task.context);
          
        case 'historical-analysis':
          return await this.analyzeHistoricalData(task.context);
          
        default:
          return { result: 'Task completed', confidence: this.expertiseLevel };
      }
    }

    assessComplexity(context) {
      const complexityFactors = [];
      let complexityScore = 0;
      
      // Project type complexity
      const typeComplexity = {
        'Elementary School': { score: 2, factor: 'Basic educational facility' },
        'Middle School': { score: 3, factor: 'Standard educational facility' },
        'High School': { score: 4, factor: 'Complex educational facility' },
        'University/College': { score: 5, factor: 'Higher education facility' },
        'Research University': { score: 7, factor: 'Research and laboratory facility' },
        'Vocational School': { score: 4, factor: 'Technical training facility' },
        'Special Education Facility': { score: 6, factor: 'Specialized accessibility requirements' },
        'Healthcare Facility': { score: 6, factor: 'Life safety critical systems' },
        'Data Center': { score: 8, factor: 'Mission critical infrastructure' },
        'Industrial Facility': { score: 5, factor: 'Heavy electrical loads' }
      };
      
      const typeInfo = typeComplexity[context.projectType] || { score: 3, factor: 'Standard facility' };
      complexityScore += typeInfo.score;
      complexityFactors.push(typeInfo.factor);
      
      // Size complexity
      const sqft = context.squareFootage || 1000;
      if (sqft > 100000) {
        complexityScore += 3;
        complexityFactors.push('Very large facility (>100k sqft)');
      } else if (sqft > 50000) {
        complexityScore += 2;
        complexityFactors.push('Large facility (50-100k sqft)');
      } else if (sqft > 10000) {
        complexityScore += 1;
        complexityFactors.push('Medium facility (10-50k sqft)');
      }
      
      // Special system complexity
      const specs = context.specifications || {};
      if (specs.science_labs) {
        complexityScore += 2;
        complexityFactors.push('Science laboratory electrical requirements');
      }
      if (specs.computer_labs) {
        complexityScore += 1;
        complexityFactors.push('Computer laboratory infrastructure');
      }
      if (specs.emergency_power) {
        complexityScore += 2;
        complexityFactors.push('Emergency power systems');
      }
      if (specs.fire_alarm) {
        complexityScore += 1;
        complexityFactors.push('Fire alarm system integration');
      }
      if (specs.security_systems) {
        complexityScore += 1;
        complexityFactors.push('Security system integration');
      }
      
      // Determine complexity level
      let complexityLevel;
      if (complexityScore <= 3) complexityLevel = 'low';
      else if (complexityScore <= 6) complexityLevel = 'mid'; 
      else if (complexityScore <= 9) complexityLevel = 'high';
      else complexityLevel = 'super-high';
      
      const multiplier = complexityLevels[complexityLevel]?.multiplier || 1.0;
      
      return {
        complexityLevel,
        complexityScore,
        multiplier,
        factors: complexityFactors,
        recommendations: this.getComplexityRecommendations(complexityLevel),
        confidence: this.expertiseLevel
      };
    }

    analyzeEducationalFacility(context) {
      const facilityType = context.facilityType;
      const gradeLevel = context.gradeLevel;
      const studentCapacity = context.studentCapacity || 500;
      const classroomCount = context.classroomCount || 20;
      const labCount = context.labCount || 0;
      
      // Educational facility specific requirements
      const requirements = {
        classroomOutlets: this.calculateClassroomOutlets(classroomCount, gradeLevel),
        specialSystems: this.getEducationalSpecialSystems(facilityType, gradeLevel),
        safetyRequirements: this.getEducationalSafetyRequirements(facilityType),
        accessibilityRequirements: this.getAccessibilityRequirements(context.specialNeeds),
        technologyRequirements: this.getTechnologyRequirements(gradeLevel, labCount)
      };
      
      // Calculate educational load factors
      const loadFactors = this.getEducationalLoadFactors(facilityType, gradeLevel);
      
      // NEC Article 518 compliance for assembly occupancies
      const assemblyRequirements = facilityType.includes('School') ? 
        this.getAssemblyOccupancyRequirements() : [];
      
      return {
        facilityType,
        gradeLevel,
        studentCapacity,
        classroomCount,
        labCount,
        requirements,
        loadFactors,
        assemblyRequirements,
        necArticles: ['518', '210.52', '210.70', '220.12'],
        recommendations: [
          'Verify classroom outlet spacing per grade level requirements',
          'Ensure adequate power for technology infrastructure', 
          'Coordinate with fire alarm and security systems',
          labCount > 0 ? 'Special attention to laboratory electrical requirements' : null
        ].filter(Boolean),
        confidence: this.expertiseLevel
      };
    }

    calculateClassroomOutlets(classroomCount, gradeLevel) {
      // Outlet requirements vary by grade level
      const outletRequirements = {
        'K-5': 6,      // Elementary - basic needs
        '6-8': 8,      // Middle - more technology
        '9-12': 10,    // High school - advanced technology
        'undergraduate': 12,  // University - high tech needs
        'graduate': 14,       // Research - very high needs
        'trade': 8,           // Vocational - equipment needs
        'special-needs': 10   // Special ed - assistive technology
      };
      
      const outletsPerClassroom = outletRequirements[gradeLevel] || 8;
      return {
        classroomCount,
        outletsPerClassroom,
        totalOutlets: classroomCount * outletsPerClassroom,
        gradeLevel
      };
    }

    getEducationalSpecialSystems(facilityType, gradeLevel) {
      const systems = [];
      
      // Standard educational systems
      systems.push('Public Address System');
      systems.push('Clock/Bell System');
      systems.push('Fire Alarm Integration');
      
      // Grade level specific systems
      if (['9-12', 'undergraduate', 'graduate'].includes(gradeLevel)) {
        systems.push('Advanced Technology Infrastructure');
        systems.push('Laboratory Equipment Power');
      }
      
      if (gradeLevel === 'graduate' || facilityType.includes('Research')) {
        systems.push('Research Equipment Power');
        systems.push('Clean Power Systems');
        systems.push('Equipment Grounding Systems');
      }
      
      if (facilityType.includes('Vocational')) {
        systems.push('Heavy Equipment Power');
        systems.push('Workshop Electrical Systems');
        systems.push('Industrial Safety Systems');
      }
      
      return systems;
    }

    getEducationalSafetyRequirements(facilityType) {
      return [
        'Emergency Lighting System',
        'Exit Sign Illumination', 
        'Fire Alarm Integration',
        'Security System Integration',
        facilityType.includes('Special Education') ? 'Assistive Technology Power' : null,
        'Playground/Outdoor Lighting'
      ].filter(Boolean);
    }

    getAccessibilityRequirements(specialNeeds) {
      if (!specialNeeds) return [];
      
      return [
        'ADA Compliant Outlet Heights',
        'Accessible Control Locations',
        'Assistive Technology Infrastructure',
        'Emergency Communication Systems',
        'Visual/Audio Alert Systems'
      ];
    }

    getTechnologyRequirements(gradeLevel, labCount) {
      const requirements = {
        networkInfrastructure: true,
        classroomTechnology: true,
        labCount: labCount
      };
      
      // Technology density by grade level
      const techDensity = {
        'K-5': 'basic',
        '6-8': 'moderate', 
        '9-12': 'high',
        'undergraduate': 'very-high',
        'graduate': 'research-grade',
        'trade': 'equipment-intensive'
      };
      
      requirements.density = techDensity[gradeLevel] || 'moderate';
      
      if (labCount > 0) {
        requirements.labSystems = [
          'Computer Lab Infrastructure',
          'Science Lab Power Systems',
          labCount > 3 ? 'Dedicated Lab Panels' : null
        ].filter(Boolean);
      }
      
      return requirements;
    }

    getAssemblyOccupancyRequirements() {
      return [
        'Emergency lighting per NEC 518.4',
        'Exit sign illumination',
        'Fire alarm system integration', 
        'Mass notification system',
        'Emergency communication systems'
      ];
    }

    getEducationalLoadFactors(facilityType, gradeLevel) {
      // Educational facilities have higher electrical loads than standard commercial
      const baseFactors = {
        'Elementary School': { lighting: 4, receptacle: 2, hvac: 6 },
        'Middle School': { lighting: 4.5, receptacle: 2.5, hvac: 6.5 },
        'High School': { lighting: 5, receptacle: 3, hvac: 7 },
        'University/College': { lighting: 5.5, receptacle: 4, hvac: 8 },
        'Research University': { lighting: 6, receptacle: 5, hvac: 10 },
        'Vocational School': { lighting: 5, receptacle: 4, hvac: 7 },
        'Special Education Facility': { lighting: 5.5, receptacle: 3.5, hvac: 7.5 }
      };
      
      return baseFactors[facilityType] || { lighting: 5, receptacle: 3, hvac: 7 };
    }

    getComplexityRecommendations(level) {
      const recommendations = {
        'low': [
          'Standard installation practices apply',
          'Normal crew size adequate',
          'Standard contingency factors'
        ],
        'mid': [
          'Consider specialized subcontractors',
          'Increase supervision requirements',
          'Add 10-15% contingency for coordination'
        ],
        'high': [
          'Require specialized expertise',
          'Extensive coordination required',
          'Consider phased implementation',
          'Add 20-25% contingency'
        ],
        'super-high': [
          'Mission critical project protocols',
          'Specialized engineering required',
          'Extensive testing and commissioning',
          'Multiple contingency planning',
          'Add 30-40% contingency'
        ]
      };
      
      return recommendations[level] || recommendations['mid'];
    }

    calculateElectricalLoad(context) {
      const sqft = context.squareFootage || 1000;
      const type = context.projectType || 'residential';
      
      // NEC 220 load calculations
      const loadFactors = {
        'residential': 3, // VA per sq ft
        'commercial': 5,
        'industrial': 4,
        'healthcare': 7,
        'Elementary School': 4,
        'Middle School': 4.5,
        'High School': 5,
        'University/College': 5.5,
        'Research University': 6,
        'Vocational School': 5,
        'Special Education Facility': 5.5,
        'educational': 5,
        'data center': 50
      };
      
      const baseFactor = loadFactors[type] || 3;
      const generalLighting = sqft * baseFactor;
      const smallAppliance = type === 'residential' ? 3000 : 0; // 2 circuits @ 1500 VA
      const laundry = type === 'residential' ? 1500 : 0;
      
      const totalLoad = generalLighting + smallAppliance + laundry;
      const demandLoad = this.applyDemandFactors(totalLoad, type);
      
      return {
        generalLighting,
        smallAppliance,
        laundry,
        totalLoad,
        demandLoad,
        demandFactor: demandLoad / totalLoad,
        recommendedServiceSize: Math.ceil(demandLoad / 240 / 0.8 / 10) * 10, // Round up to nearest 10A
        confidence: this.expertiseLevel
      };
    }

    applyDemandFactors(load, type) {
      // Simplified NEC 220.42 demand factors
      if (type === 'residential') {
        if (load <= 3000) return load;
        if (load <= 120000) return 3000 + (load - 3000) * 0.35;
        return 3000 + 117000 * 0.35 + (load - 120000) * 0.25;
      }
      return load * 0.8; // 80% for non-residential
    }

    sizeConductors(context) {
      const load = context.loadCalculation || 100;
      const voltage = context.voltage || 240;
      const distance = context.distance || 100;
      
      // Calculate current
      const current = load / voltage;
      
      // Size wire based on ampacity (simplified)
      const wireSize = this.selectWireSize(current);
      
      // Calculate voltage drop
      const vd = this.calculateVoltageDrop(current, distance, wireSize, voltage);
      
      return {
        current,
        wireSize,
        wireMaterial: 'copper',
        insulation: 'THWN',
        conduitSize: this.selectConduitSize(wireSize),
        voltageDrop: vd,
        voltageDropPercent: (vd / voltage) * 100,
        compliant: vd < 0.03,
        confidence: this.expertiseLevel
      };
    }

    selectWireSize(current) {
      // Simplified wire sizing based on NEC 310.16
      if (current <= 15) return '14 AWG';
      if (current <= 20) return '12 AWG';
      if (current <= 30) return '10 AWG';
      if (current <= 40) return '8 AWG';
      if (current <= 55) return '6 AWG';
      if (current <= 70) return '4 AWG';
      if (current <= 85) return '3 AWG';
      if (current <= 100) return '2 AWG';
      return '1/0 AWG';
    }

    selectConduitSize(wireSize) {
      // Simplified conduit sizing
      const conduitMap = {
        '14 AWG': '1/2"',
        '12 AWG': '1/2"',
        '10 AWG': '1/2"',
        '8 AWG': '3/4"',
        '6 AWG': '3/4"',
        '4 AWG': '1"',
        '3 AWG': '1"',
        '2 AWG': '1-1/4"',
        '1/0 AWG': '1-1/2"'
      };
      return conduitMap[wireSize] || '2"';
    }

    calculateVoltageDrop(current, distance, wireSize, voltage) {
      // Simplified voltage drop calculation
      const resistance = {
        '14 AWG': 3.14,
        '12 AWG': 1.98,
        '10 AWG': 1.24,
        '8 AWG': 0.778,
        '6 AWG': 0.491,
        '4 AWG': 0.308,
        '3 AWG': 0.245,
        '2 AWG': 0.194,
        '1/0 AWG': 0.122
      };
      
      const r = resistance[wireSize] || 0.1;
      const vd = (2 * distance * current * r) / 1000;
      return vd / voltage;
    }

    calculateMaterials(context) {
      const sqft = context.squareFootage || 1000;
      const density = context.deviceDensity || 0.5;
      
      const deviceCount = Math.floor(sqft * density / 100);
      const materials = {
        outlets: Math.floor(deviceCount * 0.6),
        switches: Math.floor(deviceCount * 0.3),
        fixtures: Math.floor(deviceCount * 0.1),
        panels: Math.ceil(sqft / 10000),
        wire: sqft * 3, // feet of wire
        conduit: sqft * 0.5 // feet of conduit
      };
      
      const costs = {
        outlets: materials.outlets * 25,
        switches: materials.switches * 30,
        fixtures: materials.fixtures * 150,
        panels: materials.panels * 500,
        wire: materials.wire * 1.5,
        conduit: materials.conduit * 3
      };
      
      const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
      
      return {
        deviceCount,
        materials,
        costs,
        totalCost,
        gfciLocations: ['kitchen', 'bathroom', 'garage', 'outdoor'],
        confidence: this.expertiseLevel
      };
    }

    analyzeArcFlash(context) {
      // Simplified arc flash analysis
      const voltage = context.voltage || 480;
      const transformerSize = context.transformerSize || 1000;
      
      const incidentEnergy = (voltage / 1000) * (transformerSize / 100) * Math.random() * 5;
      const workingDistance = 18; // inches
      
      let hazardCategory = 0;
      if (incidentEnergy < 1.2) hazardCategory = 0;
      else if (incidentEnergy < 4) hazardCategory = 1;
      else if (incidentEnergy < 8) hazardCategory = 2;
      else if (incidentEnergy < 25) hazardCategory = 3;
      else hazardCategory = 4;
      
      return {
        incidentEnergy,
        workingDistance,
        hazardCategory,
        ppeRequired: this.getPPERequirements(hazardCategory),
        arcFlashBoundary: Math.sqrt(incidentEnergy) * 48,
        confidence: this.expertiseLevel
      };
    }

    getPPERequirements(category) {
      const ppe = {
        0: 'Untreated cotton',
        1: 'FR shirt and pants (4 cal/cm²)',
        2: 'FR shirt, pants, and coverall (8 cal/cm²)',
        3: 'FR suit with hood (25 cal/cm²)',
        4: 'FR suit with hood (40 cal/cm²)'
      };
      return ppe[category] || ppe[4];
    }

    reviewNECCompliance(context) {
      const violations = [];
      const warnings = [];
      const recommendations = [];
      
      // Check common NEC requirements
      if (context.projectType === 'residential') {
        recommendations.push({
          article: '210.52',
          description: 'Receptacle outlets required every 12 feet along walls'
        });
        recommendations.push({
          article: '210.70',
          description: 'Lighting outlets required in habitable rooms'
        });
      }
      
      if (context.occupancy === 'healthcare') {
        recommendations.push({
          article: '517',
          description: 'Special requirements for healthcare facilities'
        });
      }
      
      return {
        violations,
        warnings,
        recommendations,
        articlesReviewed: ['210', '220', '250', '300', '410'],
        compliant: violations.length === 0,
        confidence: this.expertiseLevel
      };
    }

    createInstallationSchedule(context) {
      const sqft = context.squareFootage || 1000;
      const complexity = context.complexity || 'medium';
      const crewSize = context.crewSize || 4;
      
      const complexityFactors = {
        'low': 0.8,
        'medium': 1.0,
        'high': 1.3
      };
      
      const factor = complexityFactors[complexity];
      const baseHours = sqft * 0.1 * factor;
      const totalHours = baseHours / crewSize;
      const days = Math.ceil(totalHours / 8);
      
      const phases = [
        { name: 'Temporary Power', duration: 1, start: 0 },
        { name: 'Underground/Slab', duration: Math.ceil(days * 0.1), start: 1 },
        { name: 'Rough-In', duration: Math.ceil(days * 0.4), start: 2 },
        { name: 'Trim-Out', duration: Math.ceil(days * 0.3), start: Math.ceil(days * 0.5) },
        { name: 'Final/Testing', duration: Math.ceil(days * 0.2), start: Math.ceil(days * 0.8) }
      ];
      
      return {
        totalDays: days,
        laborHours: totalHours,
        crewSize,
        phases,
        schedule: phases,
        criticalPath: ['Rough-In', 'Trim-Out'],
        confidence: this.expertiseLevel
      };
    }

    async analyzeHistoricalData(context) {
      try {
        // Use real backend API for historical data analysis
        const projectType = context.projectType || 'commercial';
        const squareFootage = context.squareFootage || 10000;
        const complexity = context.complexity || 'mid';
        const lookbackMonths = context.lookbackPeriod || 36; // months
        
        // Call backend API for calibration factors
        const response = await fetch('/api/historical/calibration-factors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            projectType,
            squareFootage,
            complexityLevel: complexity,
            lookbackMonths
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        const apiData = await response.json();
        
        if (apiData.success) {
          return {
            similarProjectsFound: apiData.data.similarProjectsAnalyzed || 0,
            historicalAccuracy: apiData.data.historicalAccuracy,
            calibrationFactors: apiData.data.calibrationFactors,
            riskFactors: apiData.data.riskFactors,
            recommendations: apiData.data.recommendations,
            confidenceFactor: this.calculateConfidenceFromData(apiData.data),
            dataQuality: apiData.data.dataQuality,
            confidence: this.expertiseLevel
          };
        } else {
          throw new Error('API returned unsuccessful response');
        }
        
      } catch (error) {
        // Fallback to simulated data if API fails
        this.log(`Historical analysis API failed, using fallback: ${error.message}`, 'warning');
        return this.getFallbackHistoricalData(context);
      }
    }

    calculateConfidenceFromData(data) {
      const projectCount = data.similarProjectsAnalyzed || 0;
      const accuracy = data.historicalAccuracy || { accurateEstimatesPercentage: 0 };
      
      let confidenceFactor = 0.5; // Base confidence
      
      // Project count factor (more projects = higher confidence)
      if (projectCount >= 5) confidenceFactor += 0.3;
      else if (projectCount >= 3) confidenceFactor += 0.2;
      else if (projectCount >= 1) confidenceFactor += 0.1;
      
      // Accuracy factor (better historical accuracy = higher confidence)
      if (accuracy.accurateEstimatesPercentage >= 80) confidenceFactor += 0.2;
      else if (accuracy.accurateEstimatesPercentage >= 60) confidenceFactor += 0.1;
      
      return Math.min(1.0, confidenceFactor);
    }

    getFallbackHistoricalData(context) {
      // Fallback to simulated data when API is not available
      const projectType = context.projectType || 'commercial';
      const squareFootage = context.squareFootage || 10000;
      const complexity = context.complexity || 'mid';
      const lookbackPeriod = context.lookbackPeriod || 36;
      
      // Simulate finding similar projects from historical database
      const similarProjects = this.findSimilarProjects({
        projectType,
        squareFootage,
        complexity,
        lookbackPeriod
      });
      
      // Calculate historical accuracy metrics
      const accuracyMetrics = this.calculateHistoricalAccuracy(similarProjects);
      
      // Generate calibration factors based on past performance
      const calibrationFactors = this.generateCalibrationFactors(similarProjects, accuracyMetrics);
      
      // Identify risk factors from past projects
      const riskFactors = this.identifyHistoricalRisks(similarProjects);
      
      // Generate recommendations based on lessons learned
      const recommendations = this.generateHistoricalRecommendations(similarProjects, riskFactors);
      
      return {
        similarProjectsFound: similarProjects.length,
        historicalAccuracy: accuracyMetrics,
        calibrationFactors,
        riskFactors,
        recommendations,
        confidenceFactor: this.calculateConfidenceFactor(similarProjects.length, accuracyMetrics),
        dataQuality: this.assessDataQuality(similarProjects),
        confidence: this.expertiseLevel,
        fallbackMode: true
      };
    }

    findSimilarProjects(criteria) {
      // Simulate database query for similar projects
      // In production, this would query the project_performance_history table
      const mockSimilarProjects = [
        {
          id: 'proj_001',
          projectType: criteria.projectType,
          squareFootage: criteria.squareFootage * 0.9,
          complexity: criteria.complexity,
          estimatedCost: 450000,
          actualCost: 485000,
          estimatedDuration: 120,
          actualDuration: 135,
          costVariance: 7.8,
          scheduleVariance: 12.5,
          completedMonthsAgo: 8,
          clientSatisfaction: 8,
          changeOrdersCount: 3,
          reworkPercentage: 2.1
        },
        {
          id: 'proj_002', 
          projectType: criteria.projectType,
          squareFootage: criteria.squareFootage * 1.1,
          complexity: criteria.complexity,
          estimatedCost: 520000,
          actualCost: 510000,
          estimatedDuration: 135,
          actualDuration: 130,
          costVariance: -1.9,
          scheduleVariance: -3.7,
          completedMonthsAgo: 14,
          clientSatisfaction: 9,
          changeOrdersCount: 1,
          reworkPercentage: 0.5
        },
        {
          id: 'proj_003',
          projectType: criteria.projectType,
          squareFootage: criteria.squareFootage * 0.8,
          complexity: criteria.complexity,
          estimatedCost: 380000,
          actualCost: 420000,
          estimatedDuration: 100,
          actualDuration: 125,
          costVariance: 10.5,
          scheduleVariance: 25.0,
          completedMonthsAgo: 22,
          clientSatisfaction: 6,
          changeOrdersCount: 7,
          reworkPercentage: 5.2
        }
      ];
      
      // Filter projects within lookback period
      return mockSimilarProjects.filter(p => p.completedMonthsAgo <= criteria.lookbackPeriod);
    }

    calculateHistoricalAccuracy(projects) {
      if (projects.length === 0) {
        return {
          averageCostVariance: 0,
          averageScheduleVariance: 0,
          accurateEstimatesPercentage: 0,
          projectCount: 0
        };
      }
      
      const totalCostVariance = projects.reduce((sum, p) => sum + Math.abs(p.costVariance), 0);
      const totalScheduleVariance = projects.reduce((sum, p) => sum + Math.abs(p.scheduleVariance), 0);
      const accurateCount = projects.filter(p => Math.abs(p.costVariance) <= 5 && Math.abs(p.scheduleVariance) <= 10).length;
      
      return {
        averageCostVariance: totalCostVariance / projects.length,
        averageScheduleVariance: totalScheduleVariance / projects.length,
        accurateEstimatesPercentage: (accurateCount / projects.length) * 100,
        projectCount: projects.length
      };
    }

    generateCalibrationFactors(projects, accuracy) {
      const costTrend = projects.reduce((sum, p) => sum + p.costVariance, 0) / projects.length;
      const scheduleTrend = projects.reduce((sum, p) => sum + p.scheduleVariance, 0) / projects.length;
      
      // Generate adjustment factors based on historical performance
      const costCalibration = costTrend > 0 ? 1 + (costTrend / 100) * 0.5 : 1;
      const scheduleCalibration = scheduleTrend > 0 ? 1 + (scheduleTrend / 100) * 0.3 : 1;
      
      return {
        costMultiplier: Math.max(0.8, Math.min(1.3, costCalibration)), // Cap adjustments
        scheduleMultiplier: Math.max(0.8, Math.min(1.4, scheduleCalibration)),
        materialCostAdjustment: costTrend * 0.6, // Materials tend to follow 60% of cost variance
        laborCostAdjustment: costTrend * 0.4, // Labor follows 40% of cost variance
        confidence: accuracy.projectCount >= 3 ? 'high' : accuracy.projectCount >= 2 ? 'medium' : 'low'
      };
    }

    identifyHistoricalRisks(projects) {
      const risks = [];
      
      // High variance projects indicate estimation challenges
      const highVarianceProjects = projects.filter(p => Math.abs(p.costVariance) > 10 || Math.abs(p.scheduleVariance) > 15);
      if (highVarianceProjects.length > projects.length * 0.3) {
        risks.push({
          type: 'estimation_accuracy',
          severity: 'high',
          description: 'Historical projects show high cost/schedule variance',
          impact: 'Budget overruns and delays likely'
        });
      }
      
      // High change order count indicates scope uncertainty
      const avgChangeOrders = projects.reduce((sum, p) => sum + p.changeOrdersCount, 0) / projects.length;
      if (avgChangeOrders > 3) {
        risks.push({
          type: 'scope_changes',
          severity: 'medium',
          description: 'Similar projects experienced frequent change orders',
          impact: 'Potential for scope creep and additional costs'
        });
      }
      
      // High rework percentage indicates quality issues
      const avgRework = projects.reduce((sum, p) => sum + p.reworkPercentage, 0) / projects.length;
      if (avgRework > 3) {
        risks.push({
          type: 'quality_control',
          severity: 'medium',
          description: 'Historical projects required significant rework',
          impact: 'Quality control measures needed'
        });
      }
      
      // Low client satisfaction indicates delivery issues
      const avgSatisfaction = projects.reduce((sum, p) => sum + p.clientSatisfaction, 0) / projects.length;
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

    generateHistoricalRecommendations(projects, risks) {
      const recommendations = [];
      
      // Cost estimation recommendations
      const costVariances = projects.map(p => p.costVariance);
      const avgCostVariance = costVariances.reduce((a, b) => a + b, 0) / costVariances.length;
      
      if (avgCostVariance > 5) {
        recommendations.push({
          category: 'cost_estimation',
          priority: 'high',
          recommendation: `Add ${Math.ceil(avgCostVariance * 0.5)}% contingency based on historical overruns`,
          rationale: 'Similar projects exceeded budget by an average of ' + avgCostVariance.toFixed(1) + '%'
        });
      }
      
      // Schedule recommendations
      const scheduleVariances = projects.map(p => p.scheduleVariance);
      const avgScheduleVariance = scheduleVariances.reduce((a, b) => a + b, 0) / scheduleVariances.length;
      
      if (avgScheduleVariance > 10) {
        recommendations.push({
          category: 'scheduling',
          priority: 'high',
          recommendation: `Add ${Math.ceil(avgScheduleVariance * 0.3)} days schedule buffer`,
          rationale: 'Similar projects were delayed by an average of ' + avgScheduleVariance.toFixed(1) + '%'
        });
      }
      
      // Risk-based recommendations
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
      
      // Best practices from successful projects
      const successfulProjects = projects.filter(p => 
        Math.abs(p.costVariance) <= 3 && 
        Math.abs(p.scheduleVariance) <= 5 && 
        p.clientSatisfaction >= 8
      );
      
      if (successfulProjects.length > 0) {
        recommendations.push({
          category: 'best_practices',
          priority: 'medium',
          recommendation: 'Apply lessons learned from similar successful projects',
          rationale: `${successfulProjects.length} similar projects completed on-time, on-budget with high client satisfaction`
        });
      }
      
      return recommendations;
    }

    calculateConfidenceFactor(projectCount, accuracy) {
      // Confidence increases with more historical data points and better accuracy
      let confidenceFactor = 0.5; // Base confidence
      
      // Project count factor (more projects = higher confidence)
      if (projectCount >= 5) confidenceFactor += 0.3;
      else if (projectCount >= 3) confidenceFactor += 0.2;
      else if (projectCount >= 1) confidenceFactor += 0.1;
      
      // Accuracy factor (better historical accuracy = higher confidence)
      if (accuracy.accurateEstimatesPercentage >= 80) confidenceFactor += 0.2;
      else if (accuracy.accurateEstimatesPercentage >= 60) confidenceFactor += 0.1;
      
      return Math.min(1.0, confidenceFactor);
    }

    assessDataQuality(projects) {
      if (projects.length === 0) {
        return {
          score: 0,
          quality: 'no_data',
          issues: ['No historical data available']
        };
      }
      
      const issues = [];
      let qualityScore = 1.0;
      
      // Check data completeness
      const incompleteProjects = projects.filter(p => 
        !p.estimatedCost || !p.actualCost || !p.estimatedDuration || !p.actualDuration
      );
      
      if (incompleteProjects.length > 0) {
        issues.push('Some projects have incomplete cost/schedule data');
        qualityScore -= 0.2;
      }
      
      // Check data recency
      const oldProjects = projects.filter(p => p.completedMonthsAgo > 24);
      if (oldProjects.length > projects.length * 0.5) {
        issues.push('Majority of historical data is over 2 years old');
        qualityScore -= 0.1;
      }
      
      // Check data consistency
      const inconsistentProjects = projects.filter(p => 
        Math.abs(p.costVariance) > 50 || Math.abs(p.scheduleVariance) > 100
      );
      
      if (inconsistentProjects.length > 0) {
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

    stop() {
      this.status = 'stopped';
      this.currentTask = null;
    }

    log(message, level = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = { timestamp, message, level, source: this.id };
      
      setLogs(prev => [...prev.slice(-99), logEntry]);
    }
  }

  // Initialize Electrical Super Agent
  const superAgentRef = useRef(null);

  useEffect(() => {
    superAgentRef.current = new ElectricalEstimationSuperAgent();
    
    // Create initial specialized electrical agents
    const initialAgents = [
      { type: 'complexity-assessor', id: 'complex-001' },
      { type: 'educational-specialist', id: 'edu-001' },
      { type: 'load-calculator', id: 'load-001' },
      { type: 'load-calculator', id: 'load-002' },
      { type: 'wire-sizing', id: 'wire-001' },
      { type: 'material-estimator', id: 'mat-001' },
      { type: 'nec-compliance', id: 'nec-001' },
      { type: 'cost-analyzer', id: 'cost-001' },
      { type: 'safety-analyzer', id: 'safety-001' },
      { type: 'schedule-estimator', id: 'sched-001' }
    ];

    initialAgents.forEach(async ({ type, id }) => {
      const agent = await superAgentRef.current.createSubAgent(id, type);
      setAgents(prev => [...prev, {
        id,
        type,
        name: agentTypes[type].name,
        color: agentTypes[type].color,
        icon: agentTypes[type].icon,
        status: 'idle',
        tasksCompleted: 0,
        specialties: agentTypes[type].specialties
      }]);
    });

  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = () => {
    if (superAgentRef.current && !isRunning) {
      superAgentRef.current.start();
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    if (superAgentRef.current && isRunning) {
      superAgentRef.current.stop();
      setIsRunning(false);
    }
  };

  const handleAddAgent = () => {
    if (newAgentType && superAgentRef.current) {
      const id = `${newAgentType}-${Date.now().toString().slice(-6)}`;
      superAgentRef.current.createSubAgent(id, newAgentType);
      
      setAgents(prev => [...prev, {
        id,
        type: newAgentType,
        name: agentTypes[newAgentType].name,
        color: agentTypes[newAgentType].color,
        icon: agentTypes[newAgentType].icon,
        status: 'idle',
        tasksCompleted: 0,
        specialties: agentTypes[newAgentType].specialties
      }]);
      
      setNewAgentType('');
    }
  };

  const handleRemoveAgent = (id) => {
    if (superAgentRef.current) {
      superAgentRef.current.removeAgent(id);
      setAgents(prev => prev.filter(agent => agent.id !== id));
    }
  };

  const addSampleProject = async () => {
    if (superAgentRef.current) {
      const sampleProjects = [
        {
          name: 'Smith Residence Rewire',
          building_type: 'residential',
          square_footage: 2400,
          floors: 2,
          client_name: 'John Smith',
          complexity: 'low',
          project_specifications: {
            bedrooms: 4,
            bathrooms: 3,
            kitchen: 1,
            garage: 2,
            panel_upgrade: true
          }
        },
        {
          name: 'Lincoln Elementary School Renovation',
          building_type: 'Elementary School',
          square_footage: 45000,
          floors: 2,
          client_name: 'City School District',
          complexity: 'mid',
          project_specifications: {
            classroom_count: 24,
            computer_labs: 2,
            cafeteria: true,
            gymnasium: true,
            fire_alarm: true,
            security_systems: true,
            student_capacity: 600
          }
        },
        {
          name: 'Washington High School Science Wing',
          building_type: 'High School',
          square_footage: 85000,
          floors: 3,
          client_name: 'Metro School District',
          complexity: 'high',
          project_specifications: {
            classroom_count: 35,
            science_labs: 8,
            computer_labs: 4,
            auditorium: true,
            emergency_power: true,
            fire_alarm: true,
            security_systems: true,
            student_capacity: 1200,
            lab_count: 12
          }
        },
        {
          name: 'State University Research Center',
          building_type: 'Research University', 
          square_footage: 120000,
          floors: 5,
          client_name: 'State University',
          complexity: 'super-high',
          project_specifications: {
            research_labs: 15,
            clean_rooms: 3,
            computer_labs: 6,
            emergency_power: true,
            ups_systems: true,
            specialized_grounding: true,
            fire_alarm: true,
            security_systems: true,
            student_capacity: 800,
            lab_count: 21
          }
        },
        {
          name: 'Vocational Training Center',
          building_type: 'Vocational School',
          square_footage: 65000,
          floors: 2,
          client_name: 'Regional Technical College',
          complexity: 'high',
          project_specifications: {
            workshop_count: 12,
            classroom_count: 18,
            heavy_equipment: true,
            welding_labs: 4,
            automotive_bays: 6,
            emergency_power: true,
            fire_alarm: true,
            student_capacity: 800
          }
        },
        {
          name: 'Tech Office Building',
          building_type: 'Commercial Office',
          square_footage: 50000,
          floors: 5,
          client_name: 'Tech Corp',
          complexity: 'mid',
          project_specifications: {
            workstations: 200,
            server_room: true,
            conference_rooms: 10,
            cafeteria: true
          }
        },
        {
          name: 'Medical Center Expansion',
          building_type: 'Healthcare Facility',
          square_footage: 75000,
          floors: 3,
          client_name: 'Regional Medical',
          complexity: 'super-high',
          project_specifications: {
            operating_rooms: 6,
            patient_rooms: 50,
            emergency_power: true,
            isolation_panels: true,
            life_safety_systems: true
          }
        }
      ];
      
      const randomProject = sampleProjects[Math.floor(Math.random() * sampleProjects.length)];
      await superAgentRef.current.addProject(randomProject);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'working': return 'text-blue-400';
      case 'idle': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'queued': return 'text-yellow-400';
      case 'processing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Zap className="text-yellow-400" />
            Electrical Estimator Super Agent
          </h1>
          <p className="text-gray-400">NEC-compliant electrical estimation with AI-powered subagents</p>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Control Panel</h2>
            <div className="flex gap-2">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors"
              >
                <Play size={16} />
                Start System
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors"
              >
                <Square size={16} />
                Stop System
              </button>
              <button
                onClick={addSampleProject}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Project
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 mb-4">
            <Activity className={isRunning ? 'text-green-400' : 'text-gray-400'} size={20} />
            <span className={isRunning ? 'text-green-400' : 'text-gray-400'}>
              System Status: {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalAgents}</div>
              <div className="text-sm text-gray-400">Total Agents</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.activeAgents}</div>
              <div className="text-sm text-gray-400">Active</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.completedEstimates}</div>
              <div className="text-sm text-gray-400">Completed</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">${(stats.totalProjectValue / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400">Total Value</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-teal-400">{stats.avgAccuracy.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Accuracy</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.necCompliance}%</div>
              <div className="text-sm text-gray-400">NEC Compliance</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents Panel */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users size={20} />
                Electrical Agents ({agents.length})
              </h2>
              
              {/* Add Agent Controls */}
              <div className="flex gap-2">
                <select
                  value={newAgentType}
                  onChange={(e) => setNewAgentType(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                >
                  <option value="">Select Type</option>
                  {Object.entries(agentTypes).map(([key, type]) => (
                    <option key={key} value={key}>{type.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddAgent}
                  disabled={!newAgentType}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-xs transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {agents.map(agent => {
                const IconComponent = agent.icon;
                return (
                  <div key={agent.id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${agent.color}`}></div>
                        <IconComponent size={16} className="text-gray-400" />
                        <div className="font-medium text-sm">{agent.name}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveAgent(agent.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mb-1">{agent.id}</div>
                    <div className="flex justify-between items-center">
                      <div className={`text-xs ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </div>
                      <div className="text-xs text-gray-400">
                        {agent.tasksCompleted} tasks
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {agent.specialties?.slice(0, 2).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projects Panel */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Building size={20} />
              Projects ({projects.length})
            </h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {projects.map(project => (
                <div key={project.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="font-medium text-sm mb-1">{project.name}</div>
                  <div className="text-xs text-gray-400 mb-2">
                    {project.building_type} • {project.square_footage?.toLocaleString()} sq ft
                  </div>
                  {project.complexity && (
                    <div className="text-xs mb-2">
                      <span className={`px-2 py-1 rounded text-white ${complexityLevels[project.complexity]?.color || 'bg-gray-500'}`}>
                        {complexityLevels[project.complexity]?.name || project.complexity}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div className={`text-xs ${getStatusColor(project.status)}`}>
                      {project.status}
                    </div>
                    {project.estimate && (
                      <div className="text-xs text-green-400">
                        ${project.estimate.totalCost.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {project.estimate && (
                    <div className="text-xs text-gray-500 mt-1">
                      Load: {project.estimate.loadCalculation?.recommendedServiceSize}A • 
                      NEC: {project.estimate.necCompliance?.complianceScore}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} />
              System Logs
            </h2>
            
            <div 
              ref={logContainerRef}
              className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs"
            >
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{log.timestamp}]</span>
                  <span className="text-blue-400 ml-2">{log.source}:</span>
                  <span className={`ml-2 ${getLogLevelColor(log.level)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricalEstimatorSuperAgent;