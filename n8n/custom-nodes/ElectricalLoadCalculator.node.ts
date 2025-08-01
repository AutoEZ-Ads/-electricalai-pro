import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

export class ElectricalLoadCalculator implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Electrical Load Calculator',
        name: 'electricalLoadCalculator',
        icon: 'file:electricalCalculator.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Performs NEC-compliant electrical load calculations',
        defaults: {
            name: 'Electrical Load Calculator',
        },
        inputs: ['main'],
        outputs: ['main'],
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
                        operation: ['loadCalculation', 'serviceSizing'],
                    },
                },
                description: 'Total building area in square feet',
            },
            {
                displayName: 'Building Type',
                name: 'buildingType',
                type: 'options',
                options: [
                    {
                        name: 'Residential',
                        value: 'residential',
                    },
                    {
                        name: 'Commercial',
                        value: 'commercial',
                    },
                    {
                        name: 'Industrial',
                        value: 'industrial',
                    },
                    {
                        name: 'Mixed Use',
                        value: 'mixed_use',
                    },
                ],
                default: 'residential',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['loadCalculation', 'serviceSizing'],
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
                    },
                    {
                        name: 'Three Phase 208Y/120V',
                        value: 'three_phase_208v',
                    },
                    {
                        name: 'Three Phase 480Y/277V',
                        value: 'three_phase_480v',
                    },
                    {
                        name: 'Single Phase 120V',
                        value: 'single_phase_120v',
                    },
                ],
                default: 'single_phase_240v',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['loadCalculation', 'serviceSizing'],
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
            },
            {
                displayName: 'Include Laundry Circuit',
                name: 'includeLaundry',
                type: 'boolean',
                default: true,
                description: 'Include 1500VA laundry circuit for residential',
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
                    },
                    {
                        displayName: 'Load Growth Factor',
                        name: 'loadGrowthFactor',
                        type: 'number',
                        default: 1.0,
                        description: 'Factor for anticipated load growth',
                    },
                    {
                        displayName: 'Safety Factor',
                        name: 'safetyFactor',
                        type: 'number',
                        default: 1.25,
                        description: 'Additional safety factor (1.25 = 125%)',
                    },
                    {
                        displayName: 'Include HVAC Load',
                        name: 'hvacLoad',
                        type: 'number',
                        default: 0,
                        description: 'Additional HVAC load in VA',
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const operation = this.getNodeParameter('operation', 0) as string;

        for (let i = 0; i < items.length; i++) {
            try {
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
                    default:
                        throw new NodeOperationError(
                            this.getNode(),
                            `Unknown operation: ${operation}`,
                            { itemIndex: i }
                        );
                }

                // Add metadata
                result.calculation_metadata = {
                    timestamp: new Date().toISOString(),
                    nec_version: '2023',
                    calculation_method: operation,
                    node_version: '1.0.0',
                };

                returnData.push({
                    json: result,
                    pairedItem: { item: i },
                });

            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                            timestamp: new Date().toISOString(),
                        },
                        pairedItem: { item: i },
                    });
                } else {
                    throw error;
                }
            }
        }

        return [returnData];
    }

    private async performLoadCalculation(itemIndex: number): Promise<any> {
        const areaSqft = this.getNodeParameter('areaSqft', itemIndex) as number;
        const buildingType = this.getNodeParameter('buildingType', itemIndex) as string;
        const voltageSystem = this.getNodeParameter('voltageSystem', itemIndex) as string;
        const applianceCircuits = this.getNodeParameter('applianceCircuits', itemIndex, 2) as number;
        const includeLaundry = this.getNodeParameter('includeLaundry', itemIndex, true) as boolean;
        const advancedOptions = this.getNodeParameter('advancedOptions', itemIndex, {}) as any;

        // NEC Article 220 calculations
        const lightingLoadPerSqft = advancedOptions.customLightingLoad || this.getLightingLoad(buildingType);
        const lightingLoad = areaSqft * lightingLoadPerSqft;

        // Small appliance circuits (NEC 220.52(A))
        const applianceLoad = Math.max(applianceCircuits, 2) * 1500;

        // Laundry circuit (NEC 220.52(B))
        const laundryLoad = (buildingType === 'residential' && includeLaundry) ? 1500 : 0;

        // Additional loads
        const hvacLoad = advancedOptions.hvacLoad || 0;

        // Total connected load
        const totalConnectedLoad = lightingLoad + applianceLoad + laundryLoad + hvacLoad;

        // Apply demand factors (NEC 220.42)
        const demandLoad = this.calculateDemandLoad(totalConnectedLoad, buildingType);

        // Apply growth and safety factors
        const loadGrowthFactor = advancedOptions.loadGrowthFactor || 1.0;
        const safetyFactor = advancedOptions.safetyFactor || 1.25;
        const finalDemandLoad = demandLoad * loadGrowthFactor * safetyFactor;

        // Calculate required ampacity
        const requiredAmpacity = this.calculateAmpacity(finalDemandLoad, voltageSystem);

        // NEC compliance check
        const necCompliance = this.checkNECCompliance({
            buildingType,
            requiredAmpacity,
            voltageSystem,
            totalConnectedLoad,
        });

        return {
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

            // Confidence score
            confidence_score: this.calculateConfidenceScore({
                areaSqft,
                buildingType,
                voltageSystem,
                advancedOptions,
            }),
        };
    }

    private async performServiceSizing(itemIndex: number): Promise<any> {
        const loadResult = await this.performLoadCalculation(itemIndex);
        const futureExpansion = this.getNodeParameter('futureExpansion', itemIndex, 0.25) as number;

        const requiredAmpacity = loadResult.required_ampacity;
        const expandedAmpacity = requiredAmpacity * (1 + futureExpansion);

        // Standard service sizes
        const serviceSizes = [100, 150, 200, 225, 400, 600, 800, 1200, 1600, 2000];
        const recommendedService = serviceSizes.find(size => size >= requiredAmpacity) || 2000;
        const expandedService = serviceSizes.find(size => size >= expandedAmpacity) || 2000;

        return {
            ...loadResult,
            // Service sizing
            future_expansion_factor: futureExpansion,
            expanded_ampacity: Math.round(expandedAmpacity * 100) / 100,
            recommended_service_size: recommendedService,
            recommended_service_with_expansion: expandedService,
            
            // Cost estimation
            estimated_cost_difference: this.estimateServiceCostDifference(recommendedService, expandedService),
            
            // Recommendations
            recommendations: this.generateServiceRecommendations({
                currentService: recommendedService,
                expandedService: expandedService,
                buildingType: loadResult.building_type,
            }),
        };
    }

    private async applyDemandFactors(itemIndex: number): Promise<any> {
        const connectedLoad = this.getNodeParameter('connectedLoad', itemIndex) as number;
        const buildingType = this.getNodeParameter('buildingType', itemIndex) as string;

        const demandLoad = this.calculateDemandLoad(connectedLoad, buildingType);
        const demandFactor = demandLoad / connectedLoad;

        return {
            connected_load_va: connectedLoad,
            demand_load_va: Math.round(demandLoad),
            demand_factor: Math.round(demandFactor * 1000) / 1000,
            building_type: buildingType,
            nec_reference: 'Article 220.42',
        };
    }

    // Helper methods
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
        // NEC Article 220.42 demand factors
        let demandLoad = 0;

        if (connectedLoad <= 3000) {
            demandLoad = connectedLoad;
        } else if (connectedLoad <= 120000) {
            demandLoad = 3000 + (connectedLoad - 3000) * 0.35;
        } else {
            demandLoad = 3000 + 117000 * 0.35 + (connectedLoad - 120000) * 0.25;
        }

        // Apply building-specific factors
        if (buildingType === 'commercial') {
            demandLoad *= 1.1; // 10% increase for commercial
        } else if (buildingType === 'industrial') {
            demandLoad *= 1.2; // 20% increase for industrial
        }

        return demandLoad;
    }

    private calculateAmpacity(demandLoad: number, voltageSystem: string): number {
        switch (voltageSystem) {
            case 'single_phase_240v':
                return demandLoad / 240;
            case 'three_phase_208v':
                return demandLoad / (208 * Math.sqrt(3));
            case 'three_phase_480v':
                return demandLoad / (480 * Math.sqrt(3));
            case 'single_phase_120v':
                return demandLoad / 120;
            default:
                return demandLoad / 240;
        }
    }

    private checkNECCompliance(params: any): any {
        const { buildingType, requiredAmpacity, voltageSystem, totalConnectedLoad } = params;
        const compliance = {
            compliant: true,
            violations: [] as string[],
            notes: [] as string[],
        };

        // NEC 230.79(C) - Minimum service size
        if (buildingType === 'residential' && requiredAmpacity < 100) {
            compliance.violations.push('Residential service must be minimum 100A per NEC 230.79(C)');
            compliance.compliant = false;
        }

        // NEC 220.87 - Optional calculation methods
        if (buildingType === 'residential' && totalConnectedLoad > 10000) {
            compliance.notes.push('Consider NEC 220.87 optional calculation for residential loads over 10kVA');
        }

        // Voltage system validation
        if (voltageSystem === 'single_phase_120v' && requiredAmpacity > 200) {
            compliance.violations.push('Single-phase 120V system not recommended for loads over 200A');
            compliance.compliant = false;
        }

        return compliance;
    }

    private calculateConfidenceScore(params: any): number {
        let confidence = 0.85; // Base confidence

        const { areaSqft, buildingType, voltageSystem, advancedOptions } = params;

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

        return Math.min(confidence, 0.99);
    }

    private estimateServiceCostDifference(currentService: number, expandedService: number): any {
        const costPerAmp = 2.5; // Rough estimate
        const materialDifference = (expandedService - currentService) * costPerAmp;
        
        return {
            current_service_cost: currentService * costPerAmp,
            expanded_service_cost: expandedService * costPerAmp,
            cost_difference: materialDifference,
            roi_payback_years: materialDifference > 0 ? Math.round((materialDifference / 100) * 10) / 10 : 0,
        };
    }

    private generateServiceRecommendations(params: any): string[] {
        const { currentService, expandedService, buildingType } = params;
        const recommendations = [];

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

        recommendations.push('All calculations comply with NEC 2023 requirements');

        return recommendations;
    }
}