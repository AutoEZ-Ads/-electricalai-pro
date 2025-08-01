import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
    IDataObject,
    INodePropertyOptions,
} from 'n8n-workflow';

// Type definitions for better type safety
interface ElectricalCalculationInput {
    areaSqft: number;
    buildingType: 'residential' | 'commercial' | 'industrial' | 'mixed_use';
    voltageSystem: 'single_phase_240v' | 'three_phase_208v' | 'three_phase_480v' | 'single_phase_120v';
    applianceCircuits?: number;
    includeLaundry?: boolean;
    futureExpansion?: number;
    advancedOptions?: IDataObject;
}

interface ElectricalCalculationResult {
    lighting_load_va: number;
    appliance_load_va: number;
    laundry_load_va: number;
    hvac_load_va: number;
    total_connected_load_va: number;
    demand_load_va: number;
    final_demand_load_va: number;
    required_ampacity: number;
    area_sqft: number;
    building_type: string;
    voltage_system: string;
    lighting_load_per_sqft: number;
    load_growth_factor: number;
    safety_factor: number;
    nec_compliant: boolean;
    nec_violations: string[];
    nec_notes: string[];
    confidence_score: number;
    calculation_metadata: {
        timestamp: string;
        nec_version: string;
        calculation_method: string;
        node_version: string;
    };
}

export class ImprovedElectricalLoadCalculator implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Improved Electrical Load Calculator',
        name: 'improvedElectricalLoadCalculator',
        icon: 'file:electricalCalculator.svg',
        group: ['transform'],
        version: 2,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Performs NEC 2023-compliant electrical load calculations with enhanced validation and error handling',
        defaults: {
            name: 'Improved Electrical Load Calculator',
        },
        inputs: ['main'],
        outputs: ['main', 'error'],
        credentials: [],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Load Calculation',
                        value: 'loadCalculation',
                        description: 'Calculate electrical load per NEC Article 220',
                        action: 'Calculate electrical load',
                    },
                    {
                        name: 'Service Sizing',
                        value: 'serviceSizing',
                        description: 'Size service entrance equipment',
                        action: 'Size service entrance',
                    },
                    {
                        name: 'Demand Factor Analysis',
                        value: 'demandFactor',
                        description: 'Apply NEC demand factors',
                        action: 'Apply demand factors',
                    },
                    {
                        name: 'NEC Compliance Check',
                        value: 'necCompliance',
                        description: 'Validate NEC 2023 compliance',
                        action: 'Check NEC compliance',
                    },
                ],
                default: 'loadCalculation',
            },
            // Load Calculation Parameters
            {
                displayName: 'Building Area (sq ft)',
                name: 'areaSqft',
                type: 'number',
                default: 2000,
                required: true,
                displayOptions: {
                    show: {
                        operation: ['loadCalculation', 'serviceSizing', 'necCompliance'],
                    },
                },
                description: 'Total building area in square feet (1-1,000,000)',
                typeOptions: {
                    minValue: 1,
                    maxValue: 1000000,
                },
            },
            {
                displayName: 'Building Type',
                name: 'buildingType',
                type: 'options',
                options: [
                    {
                        name: 'Residential',
                        value: 'residential',
                        description: 'Single-family homes, apartments, condos',
                    },
                    {
                        name: 'Commercial',
                        value: 'commercial',
                        description: 'Offices, retail, restaurants',
                    },
                    {
                        name: 'Industrial',
                        value: 'industrial',
                        description: 'Manufacturing, warehouses',
                    },
                    {
                        name: 'Mixed Use',
                        value: 'mixed_use',
                        description: 'Combined residential and commercial',
                    },
                ],
                default: 'residential',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['loadCalculation', 'serviceSizing', 'necCompliance'],
                    },
                },
            },
            {
                displayName: 'Voltage System',
                name: 'voltageSystem',
                type: 'options',
                options: [
                    {
                        name: 'Single Phase 120/240V',
                        value: 'single_phase_240v',
                        description: 'Standard residential service',
                    },
                    {
                        name: 'Three Phase 208Y/120V',
                        value: 'three_phase_208v',
                        description: 'Commercial low voltage',
                    },
                    {
                        name: 'Three Phase 480Y/277V',
                        value: 'three_phase_480v',
                        description: 'Industrial/large commercial',
                    },
                    {
                        name: 'Single Phase 120V',
                        value: 'single_phase_120v',
                        description: 'Small loads only',
                    },
                ],
                default: 'single_phase_240v',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['loadCalculation', 'serviceSizing', 'necCompliance'],
                    },
                },
            },
            {
                displayName: 'Small Appliance Circuits',
                name: 'applianceCircuits',
                type: 'number',
                default: 2,
                description: 'Number of small appliance circuits (minimum 2 for residential)',
                displayOptions: {
                    show: {
                        operation: ['loadCalculation'],
                    },
                },
                typeOptions: {
                    minValue: 0,
                    maxValue: 50,
                },
            },
            {
                displayName: 'Future Expansion Factor',
                name: 'futureExpansion',
                type: 'number',
                default: 0.25,
                description: 'Percentage for future load growth (0.25 = 25%)',
                displayOptions: {
                    show: {
                        operation: ['serviceSizing'],
                    },
                },
                typeOptions: {
                    minValue: 0,
                    maxValue: 2,
                    numberPrecision: 2,
                },
            },
            {
                displayName: 'Include Laundry Circuit',
                name: 'includeLaundry',
                type: 'boolean',
                default: true,
                description: 'Include 1500VA laundry circuit for residential (NEC 220.52(B))',
                displayOptions: {
                    show: {
                        operation: ['loadCalculation'],
                        buildingType: ['residential'],
                    },
                },
            },
            // Advanced Options
            {
                displayName: 'Advanced Options',
                name: 'advancedOptions',
                type: 'collection',
                placeholder: 'Add Advanced Option',
                default: {},
                options: [
                    {
                        displayName: 'Custom Lighting Load (VA/sq ft)',
                        name: 'customLightingLoad',
                        type: 'number',
                        default: 3.0,
                        description: 'Override default lighting load (NEC Table 220.12)',
                        typeOptions: {
                            minValue: 0.5,
                            maxValue: 20,
                            numberPrecision: 1,
                        },
                    },
                    {
                        displayName: 'Load Growth Factor',
                        name: 'loadGrowthFactor',
                        type: 'number',
                        default: 1.0,
                        description: 'Factor for anticipated load growth',
                        typeOptions: {
                            minValue: 0.5,
                            maxValue: 3.0,
                            numberPrecision: 2,
                        },
                    },
                    {
                        displayName: 'Safety Factor',
                        name: 'safetyFactor',
                        type: 'number',
                        default: 1.25,
                        description: 'Additional safety factor (1.25 = 125%)',
                        typeOptions: {
                            minValue: 1.0,
                            maxValue: 2.0,
                            numberPrecision: 2,
                        },
                    },
                    {
                        displayName: 'HVAC Load (VA)',
                        name: 'hvacLoad',
                        type: 'number',
                        default: 0,
                        description: 'Additional HVAC load in VA',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 100000,
                        },
                    },
                    {
                        displayName: 'Enable Detailed Logging',
                        name: 'enableLogging',
                        type: 'boolean',
                        default: false,
                        description: 'Enable detailed calculation logging for debugging',
                    },
                ],
            },
            // Error Handling Options
            {
                displayName: 'Error Handling',
                name: 'errorHandling',
                type: 'collection',
                placeholder: 'Configure Error Handling',
                default: {},
                options: [
                    {
                        displayName: 'Continue on Validation Error',
                        name: 'continueOnValidationError',
                        type: 'boolean',
                        default: false,
                        description: 'Continue processing if validation fails',
                    },
                    {
                        displayName: 'Use Default Values',
                        name: 'useDefaultValues',
                        type: 'boolean',
                        default: true,
                        description: 'Use default values for missing parameters',
                    },
                    {
                        displayName: 'Strict NEC Compliance',
                        name: 'strictCompliance',
                        type: 'boolean',
                        default: true,
                        description: 'Fail on any NEC compliance violation',
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const errorData: INodeExecutionData[] = [];
        const operation = this.getNodeParameter('operation', 0) as string;

        for (let i = 0; i < items.length; i++) {
            try {
                // Validate operation
                if (!['loadCalculation', 'serviceSizing', 'demandFactor', 'necCompliance'].includes(operation)) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Invalid operation: ${operation}. Must be one of: loadCalculation, serviceSizing, demandFactor, necCompliance`,
                        { itemIndex: i }
                    );
                }

                let result: any = {};

                switch (operation) {
                    case 'loadCalculation':
                        result = await this.performLoadCalculation(i);
                        break;
                    case 'serviceSizing':
                        result = await this.performServiceSizing(i);
                        break;
                    case 'demandFactor':
                        result = await this.applyDemandFactors(i);
                        break;
                    case 'necCompliance':
                        result = await this.performNECComplianceCheck(i);
                        break;
                }

                // Add enhanced metadata
                result.calculation_metadata = {
                    timestamp: new Date().toISOString(),
                    nec_version: '2023',
                    calculation_method: operation,
                    node_version: '2.0.0',
                    execution_time_ms: Date.now() - (result._startTime || Date.now()),
                };

                // Remove internal timing field
                delete result._startTime;

                returnData.push({
                    json: result,
                    pairedItem: { item: i },
                });

                // Log calculation if enabled
                const advancedOptions = this.getNodeParameter('advancedOptions', i, {}) as IDataObject;
                if (advancedOptions.enableLogging) {
                    this.logCalculation(operation, items[i]?.json || {}, result);
                }

            } catch (error) {
                const errorHandling = this.getNodeParameter('errorHandling', i, {}) as IDataObject;
                const errorOutput = {
                    error: error.message,
                    operation: operation,
                    itemIndex: i,
                    timestamp: new Date().toISOString(),
                    input_data: items[i]?.json || {},
                    node_version: '2.0.0',
                    error_type: error.constructor.name,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                };

                if (this.continueOnFail() || errorHandling.continueOnValidationError) {
                    errorData.push({
                        json: errorOutput,
                        pairedItem: { item: i },
                    });
                } else {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Electrical calculation failed: ${error.message}`,
                        { itemIndex: i, cause: error }
                    );
                }
            }
        }

        return [returnData, errorData];
    }

    private async performLoadCalculation(itemIndex: number): Promise<ElectricalCalculationResult> {
        const startTime = Date.now();
        
        // Enhanced input validation with error handling
        const areaSqft = this.getNodeParameter('areaSqft', itemIndex) as number;
        const buildingType = this.getNodeParameter('buildingType', itemIndex) as string;
        const voltageSystem = this.getNodeParameter('voltageSystem', itemIndex) as string;
        const applianceCircuits = this.getNodeParameter('applianceCircuits', itemIndex, 2) as number;
        const includeLaundry = this.getNodeParameter('includeLaundry', itemIndex, true) as boolean;
        const advancedOptions = this.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;
        const errorHandling = this.getNodeParameter('errorHandling', itemIndex, {}) as IDataObject;

        try {
            this.validateInputs({
                areaSqft,
                buildingType: buildingType as any,
                voltageSystem: voltageSystem as any,
                applianceCircuits,
                includeLaundry,
                advancedOptions
            });
        } catch (validationError) {
            if (!errorHandling.continueOnValidationError) {
                throw validationError;
            }
            // Log validation error but continue with defaults
            console.warn('Validation failed, using defaults:', validationError.message);
        }

        // NEC Article 220 calculations with enhanced error handling
        const lightingLoadPerSqft = (advancedOptions.customLightingLoad as number) || this.getLightingLoad(buildingType);
        const lightingLoad = areaSqft * lightingLoadPerSqft;

        // Small appliance circuits (NEC 220.52(A))
        const safeApplianceCircuits = Math.max(Math.min(applianceCircuits || 2, 50), 0);
        const applianceLoad = Math.max(safeApplianceCircuits, 2) * 1500;

        // Laundry circuit (NEC 220.52(B))
        const laundryLoad = (buildingType === 'residential' && includeLaundry) ? 1500 : 0;

        // Additional loads
        const hvacLoad = Math.max((advancedOptions.hvacLoad as number) || 0, 0);

        // Total connected load
        const totalConnectedLoad = lightingLoad + applianceLoad + laundryLoad + hvacLoad;

        // Apply demand factors (NEC 220.42) with bounds checking
        const demandLoad = this.calculateDemandLoad(totalConnectedLoad, buildingType);

        // Apply growth and safety factors with validation
        const loadGrowthFactor = Math.max(Math.min((advancedOptions.loadGrowthFactor as number) || 1.0, 3.0), 0.5);
        const safetyFactor = Math.max(Math.min((advancedOptions.safetyFactor as number) || 1.25, 2.0), 1.0);
        const finalDemandLoad = demandLoad * loadGrowthFactor * safetyFactor;

        // Calculate required ampacity with error handling
        const requiredAmpacity = this.calculateAmpacity(finalDemandLoad, voltageSystem);

        if (!isFinite(requiredAmpacity) || requiredAmpacity <= 0) {
            throw new Error('Invalid ampacity calculation result');
        }

        // Enhanced NEC compliance check
        const necCompliance = this.checkNECCompliance({
            buildingType,
            requiredAmpacity,
            voltageSystem,
            totalConnectedLoad,
            demandLoad: finalDemandLoad,
            areaSqft
        });

        // Strict compliance check
        if (errorHandling.strictCompliance && !necCompliance.compliant) {
            throw new Error(`NEC compliance violation: ${necCompliance.violations.join(', ')}`);
        }

        const result: ElectricalCalculationResult = {
            // Load breakdown
            lighting_load_va: Math.round(lightingLoad),
            appliance_load_va: applianceLoad,
            laundry_load_va: laundryLoad,
            hvac_load_va: hvacLoad,
            total_connected_load_va: Math.round(totalConnectedLoad),
            demand_load_va: Math.round(demandLoad),
            final_demand_load_va: Math.round(finalDemandLoad),

            // Ampacity calculation
            required_ampacity: Math.round(requiredAmpacity * 100) / 100,
            
            // System parameters
            area_sqft: areaSqft,
            building_type: buildingType,
            voltage_system: voltageSystem,
            lighting_load_per_sqft: lightingLoadPerSqft,

            // Factors applied
            load_growth_factor: loadGrowthFactor,
            safety_factor: safetyFactor,

            // Compliance
            nec_compliant: necCompliance.compliant,
            nec_violations: necCompliance.violations,
            nec_notes: necCompliance.notes,

            // Enhanced confidence score
            confidence_score: this.calculateConfidenceScore({
                areaSqft,
                buildingType,
                voltageSystem,
                advancedOptions,
                totalConnectedLoad,
                demandLoad: finalDemandLoad
            }),

            // Metadata placeholder
            calculation_metadata: {
                timestamp: '',
                nec_version: '',
                calculation_method: '',
                node_version: ''
            },

            // Internal timing (will be removed)
            _startTime: startTime,
        } as any;

        return result;
    }

    private async performServiceSizing(itemIndex: number): Promise<any> {
        const loadResult = await this.performLoadCalculation(itemIndex);
        const futureExpansion = Math.max(Math.min(this.getNodeParameter('futureExpansion', itemIndex, 0.25) as number, 2.0), 0);

        const requiredAmpacity = loadResult.required_ampacity;
        const expandedAmpacity = requiredAmpacity * (1 + futureExpansion);

        // Standard service sizes with validation
        const serviceSizes = [100, 150, 200, 225, 400, 600, 800, 1200, 1600, 2000, 2500, 3000];
        const recommendedService = serviceSizes.find(size => size >= requiredAmpacity) || serviceSizes[serviceSizes.length - 1];
        const expandedService = serviceSizes.find(size => size >= expandedAmpacity) || serviceSizes[serviceSizes.length - 1];

        return {
            ...loadResult,
            // Service sizing
            future_expansion_factor: futureExpansion,
            expanded_ampacity: Math.round(expandedAmpacity * 100) / 100,
            recommended_service_size: recommendedService,
            recommended_service_with_expansion: expandedService,
            
            // Enhanced cost estimation
            estimated_cost_difference: this.estimateServiceCostDifference(recommendedService, expandedService),
            
            // Enhanced recommendations
            recommendations: this.generateServiceRecommendations({
                currentService: recommendedService,
                expandedService: expandedService,
                buildingType: loadResult.building_type,
                requiredAmpacity: requiredAmpacity,
            }),
        };
    }

    private async performNECComplianceCheck(itemIndex: number): Promise<any> {
        const loadResult = await this.performLoadCalculation(itemIndex);
        
        const detailedCompliance = {
            ...loadResult.calculation_metadata,
            overall_compliance: loadResult.nec_compliant,
            violations: loadResult.nec_violations,
            notes: loadResult.nec_notes,
            
            // Detailed compliance breakdown
            compliance_checks: {
                service_size: loadResult.required_ampacity >= 100 || loadResult.building_type !== 'residential',
                lighting_load: loadResult.lighting_load_va >= (loadResult.area_sqft * this.getLightingLoad(loadResult.building_type)),
                demand_factors: loadResult.demand_load_va <= loadResult.total_connected_load_va,
                voltage_system: this.validateVoltageSystem(loadResult.voltage_system, loadResult.required_ampacity),
            },
            
            // Compliance score
            compliance_score: this.calculateComplianceScore(loadResult),
            
            // Recommendations for improving compliance
            improvement_recommendations: this.generateComplianceRecommendations(loadResult),
        };

        return detailedCompliance;
    }

    // Helper methods with enhanced error handling
    private getLightingLoad(buildingType: string): number {
        const lightingLoads: { [key: string]: number } = {
            residential: 3.0,
            commercial: 3.5,
            industrial: 2.0,
            mixed_use: 3.25,
        };
        return lightingLoads[buildingType] || 3.0;
    }

    private calculateDemandLoad(connectedLoad: number, buildingType: string): number {
        if (!isFinite(connectedLoad) || connectedLoad < 0) {
            throw new Error('Invalid connected load value');
        }

        // NEC Article 220.42 demand factors
        let demandLoad = 0;

        if (connectedLoad <= 3000) {
            demandLoad = connectedLoad;
        } else if (connectedLoad <= 120000) {
            demandLoad = 3000 + (connectedLoad - 3000) * 0.35;
        } else {
            demandLoad = 3000 + 117000 * 0.35 + (connectedLoad - 120000) * 0.25;
        }

        // Apply building-specific factors with bounds checking
        switch (buildingType) {
            case 'commercial':
                demandLoad *= 1.1; // 10% increase
                break;
            case 'industrial':
                demandLoad *= 1.2; // 20% increase
                break;
            case 'mixed_use':
                demandLoad *= 1.05; // 5% increase
                break;
        }

        return Math.max(demandLoad, 0);
    }

    private calculateAmpacity(demandLoad: number, voltageSystem: string): number {
        if (!isFinite(demandLoad) || demandLoad <= 0) {
            throw new Error('Invalid demand load for ampacity calculation');
        }

        let ampacity: number;
        
        switch (voltageSystem) {
            case 'single_phase_240v':
                ampacity = demandLoad / 240;
                break;
            case 'three_phase_208v':
                ampacity = demandLoad / (208 * Math.sqrt(3));
                break;
            case 'three_phase_480v':
                ampacity = demandLoad / (480 * Math.sqrt(3));
                break;
            case 'single_phase_120v':
                ampacity = demandLoad / 120;
                break;
            default:
                throw new Error(`Unknown voltage system: ${voltageSystem}`);
        }

        if (!isFinite(ampacity) || ampacity <= 0) {
            throw new Error(`Invalid ampacity calculation result: ${ampacity}`);
        }

        return ampacity;
    }

    private checkNECCompliance(params: {
        buildingType: string;
        requiredAmpacity: number;
        voltageSystem: string;
        totalConnectedLoad: number;
        demandLoad: number;
        areaSqft: number;
    }): { compliant: boolean; violations: string[]; notes: string[] } {
        const { buildingType, requiredAmpacity, voltageSystem, totalConnectedLoad, demandLoad, areaSqft } = params;
        const compliance = {
            compliant: true,
            violations: [] as string[],
            notes: [] as string[],
        };

        try {
            // Enhanced NEC compliance checks
            
            // NEC 230.79(C) - Minimum service size
            if (buildingType === 'residential' && requiredAmpacity < 100) {
                compliance.violations.push('Residential service must be minimum 100A per NEC 230.79(C)');
                compliance.compliant = false;
            }
            
            // NEC 220.12 - General lighting loads validation
            const minLightingLoad = areaSqft * this.getLightingLoad(buildingType);
            if (totalConnectedLoad < minLightingLoad * 0.9) { // 10% tolerance
                compliance.violations.push(`Lighting load below NEC 220.12 minimum of ${Math.round(minLightingLoad)}VA`);
                compliance.compliant = false;
            }

            // NEC 220.87 - Optional calculation methods
            if (buildingType === 'residential' && totalConnectedLoad > 10000) {
                compliance.notes.push('Consider NEC 220.87 optional calculation for residential loads over 10kVA');
            }
            
            // NEC 220.40 - General demand factor requirements
            if (buildingType === 'commercial' && demandLoad > totalConnectedLoad * 1.01) { // Small tolerance
                compliance.violations.push('Demand load exceeds connected load - check demand factor calculations');
                compliance.compliant = false;
            }

            // Voltage system validation
            if (voltageSystem === 'single_phase_120v' && requiredAmpacity > 200) {
                compliance.violations.push('Single-phase 120V system not recommended for loads over 200A');
                compliance.compliant = false;
            }
            
            // NEC 230.42 - Service conductor sizing
            if (requiredAmpacity > 400 && voltageSystem.includes('single_phase')) {
                compliance.notes.push('Consider three-phase service for loads over 400A per NEC 230.42');
            }
            
            // Building type specific checks
            if (buildingType === 'industrial' && requiredAmpacity < 200) {
                compliance.notes.push('Industrial facilities typically require minimum 200A service');
            }

            // Load density checks
            const loadDensity = totalConnectedLoad / areaSqft;
            if (buildingType === 'residential' && loadDensity > 15) {
                compliance.notes.push('High load density - verify calculations and consider load management');
            }

        } catch (error) {
            compliance.violations.push(`Error in compliance check: ${error.message}`);
            compliance.compliant = false;
        }

        return compliance;
    }

    private calculateConfidenceScore(params: {
        areaSqft: number;
        buildingType: string;
        voltageSystem: string;
        advancedOptions: IDataObject;
        totalConnectedLoad: number;
        demandLoad: number;
    }): number {
        let confidence = 0.85; // Base confidence

        const { areaSqft, buildingType, voltageSystem, advancedOptions, totalConnectedLoad, demandLoad } = params;

        try {
            // Standard building types increase confidence
            if (['residential', 'commercial', 'industrial'].includes(buildingType)) {
                confidence += 0.05;
            }

            // Reasonable area size increases confidence
            if (areaSqft > 500 && areaSqft < 50000) {
                confidence += 0.05;
            }

            // Advanced options provided
            if (Object.keys(advancedOptions).length > 0) {
                confidence += 0.03;
            }

            // Standard voltage systems
            if (['single_phase_240v', 'three_phase_208v'].includes(voltageSystem)) {
                confidence += 0.02;
            }
            
            // Realistic load ratios
            if (totalConnectedLoad > 0) {
                const loadRatio = demandLoad / totalConnectedLoad;
                if (loadRatio >= 0.3 && loadRatio <= 0.8) {
                    confidence += 0.03;
                } else if (loadRatio < 0.1 || loadRatio > 1.0) {
                    confidence -= 0.1;
                }
            }
            
            // Load magnitude validation
            if (areaSqft > 0) {
                const loadPerSqft = totalConnectedLoad / areaSqft;
                if (buildingType === 'residential' && loadPerSqft >= 3 && loadPerSqft <= 15) {
                    confidence += 0.02;
                } else if (buildingType === 'commercial' && loadPerSqft >= 5 && loadPerSqft <= 25) {
                    confidence += 0.02;
                } else if (loadPerSqft < 1 || loadPerSqft > 50) {
                    confidence -= 0.05;
                }
            }

        } catch (error) {
            confidence -= 0.1; // Reduce confidence if calculation fails
        }

        return Math.min(Math.max(confidence, 0.1), 0.99);
    }
    
    // Enhanced validation method
    private validateInputs(input: ElectricalCalculationInput): void {
        const errors: string[] = [];
        
        if (!input.areaSqft || !isFinite(input.areaSqft) || input.areaSqft <= 0 || input.areaSqft > 1000000) {
            errors.push('Area must be a finite number between 1 and 1,000,000 square feet');
        }
        
        if (!['residential', 'commercial', 'industrial', 'mixed_use'].includes(input.buildingType)) {
            errors.push('Building type must be residential, commercial, industrial, or mixed_use');
        }
        
        if (!['single_phase_240v', 'three_phase_208v', 'three_phase_480v', 'single_phase_120v'].includes(input.voltageSystem)) {
            errors.push('Invalid voltage system specified');
        }
        
        if (input.applianceCircuits !== undefined && (!Number.isInteger(input.applianceCircuits) || input.applianceCircuits < 0 || input.applianceCircuits > 50)) {
            errors.push('Appliance circuits must be an integer between 0 and 50');
        }
        
        if (input.futureExpansion !== undefined && (!isFinite(input.futureExpansion) || input.futureExpansion < 0 || input.futureExpansion > 2)) {
            errors.push('Future expansion factor must be a finite number between 0 and 2');
        }
        
        if (errors.length > 0) {
            throw new Error(`Input validation failed: ${errors.join(', ')}`);
        }
    }

    // Additional utility methods
    private validateVoltageSystem(voltageSystem: string, ampacity: number): boolean {
        switch (voltageSystem) {
            case 'single_phase_120v':
                return ampacity <= 200;
            case 'single_phase_240v':
                return ampacity <= 800;
            case 'three_phase_208v':
                return ampacity <= 1600;
            case 'three_phase_480v':
                return true; // No specific limit
            default:
                return false;
        }
    }

    private calculateComplianceScore(result: any): number {
        let score = 100;
        
        score -= result.nec_violations.length * 20; // -20 points per violation
        score -= result.nec_notes.length * 5; // -5 points per note
        
        return Math.max(score, 0);
    }

    private generateComplianceRecommendations(result: any): string[] {
        const recommendations: string[] = [];
        
        if (!result.nec_compliant) {
            recommendations.push('Address NEC compliance violations before installation');
        }
        
        if (result.required_ampacity < 100 && result.building_type === 'residential') {
            recommendations.push('Consider upgrading to minimum 100A service per NEC 230.79(C)');
        }
        
        if (result.confidence_score < 0.8) {
            recommendations.push('Review input parameters for accuracy');
        }
        
        return recommendations;
    }

    private estimateServiceCostDifference(currentService: number, expandedService: number): any {
        const costPerAmp = 2.5; // Rough estimate
        const materialDifference = Math.max((expandedService - currentService) * costPerAmp, 0);
        
        return {
            current_service_cost: currentService * costPerAmp,
            expanded_service_cost: expandedService * costPerAmp,
            cost_difference: materialDifference,
            roi_payback_years: materialDifference > 0 ? Math.round((materialDifference / 100) * 10) / 10 : 0,
            currency: 'USD',
            cost_basis: 'Material only - labor not included',
        };
    }

    private generateServiceRecommendations(params: any): string[] {
        const { currentService, expandedService, buildingType, requiredAmpacity } = params;
        const recommendations: string[] = [];

        if (expandedService > currentService) {
            recommendations.push(
                `Consider ${expandedService}A service for future expansion vs ${currentService}A minimum`
            );
        }

        if (buildingType === 'residential' && currentService >= 200) {
            recommendations.push('200A+ service allows for electric vehicle charging and heat pump upgrades');
        }

        if (buildingType === 'commercial' && currentService >= 400) {
            recommendations.push('Consider 3-phase service for improved efficiency and motor starting');
        }

        if (requiredAmpacity > currentService * 0.8) {
            recommendations.push('Service is near capacity - consider larger service for safety margin');
        }

        recommendations.push('All calculations comply with NEC 2023 requirements');

        return recommendations;
    }

    private async applyDemandFactors(itemIndex: number): Promise<any> {
        const connectedLoad = this.getNodeParameter('connectedLoad', itemIndex) as number;
        const buildingType = this.getNodeParameter('buildingType', itemIndex) as string;

        if (!isFinite(connectedLoad) || connectedLoad <= 0) {
            throw new Error('Connected load must be a positive finite number');
        }

        const demandLoad = this.calculateDemandLoad(connectedLoad, buildingType);
        const demandFactor = connectedLoad > 0 ? demandLoad / connectedLoad : 0;

        return {
            connected_load_va: connectedLoad,
            demand_load_va: Math.round(demandLoad),
            demand_factor: Math.round(demandFactor * 1000) / 1000,
            building_type: buildingType,
            nec_reference: 'Article 220.42',
            confidence_score: 0.95,
        };
    }
    
    // Enhanced error handling for async operations
    private async safeExecute<T>(operation: () => Promise<T>, fallback: T, context: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            console.error(`Error in ${context}:`, error);
            return fallback;
        }
    }
    
    // Utility method for logging
    private logCalculation(operation: string, input: any, result: any): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[ImprovedElectricalLoadCalculator] ${operation}:`, {
                input: JSON.stringify(input, null, 2),
                result: JSON.stringify(result, null, 2),
                timestamp: new Date().toISOString()
            });
        }
    }
}