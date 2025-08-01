import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

export class ElectricalCalculator implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Electrical Calculator',
        name: 'electricalCalculator',
        icon: 'file:electricalCalculator.svg',
        group: ['electrical'],
        version: 1,
        subtitle: '={{$parameter["calculationType"]}}',
        description: 'Perform electrical calculations for estimation projects',
        defaults: {
            name: 'Electrical Calculator',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Calculation Type',
                name: 'calculationType',
                type: 'options',
                options: [
                    { name: 'Load Calculation', value: 'load' },
                    { name: 'Wire Sizing', value: 'wire' },
                    { name: 'Conduit Fill', value: 'conduit' },
                    { name: 'Voltage Drop', value: 'voltageDrop' },
                    { name: 'Panel Sizing', value: 'panel' },
                    { name: 'Service Sizing', value: 'service' },
                    { name: 'Circuit Analysis', value: 'circuit' },
                ],
                default: 'load',
                required: true,
            },
            // Load Calculation Options
            {
                displayName: 'Area (Square Feet)',
                name: 'area',
                type: 'number',
                displayOptions: {
                    show: {
                        calculationType: ['load', 'service'],
                    },
                },
                default: 0,
                description: 'Area in square feet for load calculation',
            },
            {
                displayName: 'Building Type',
                name: 'buildingType',
                type: 'options',
                options: [
                    { name: 'Residential', value: 'residential' },
                    { name: 'Commercial', value: 'commercial' },
                    { name: 'Industrial', value: 'industrial' },
                ],
                displayOptions: {
                    show: {
                        calculationType: ['load', 'service'],
                    },
                },
                default: 'residential',
            },
            // Wire Sizing Options
            {
                displayName: 'Current (Amperes)',
                name: 'current',
                type: 'number',
                displayOptions: {
                    show: {
                        calculationType: ['wire', 'voltageDrop', 'circuit'],
                    },
                },
                default: 0,
                description: 'Current in amperes',
            },
            {
                displayName: 'Distance (Feet)',
                name: 'distance',
                type: 'number',
                displayOptions: {
                    show: {
                        calculationType: ['wire', 'voltageDrop', 'circuit'],
                    },
                },
                default: 0,
                description: 'Circuit length in feet',
            },
            {
                displayName: 'Voltage',
                name: 'voltage',
                type: 'options',
                options: [
                    { name: '120V', value: 120 },
                    { name: '240V', value: 240 },
                    { name: '277V', value: 277 },
                    { name: '480V', value: 480 },
                ],
                displayOptions: {
                    show: {
                        calculationType: ['wire', 'voltageDrop', 'circuit', 'load'],
                    },
                },
                default: 120,
            },
            {
                displayName: 'Phase Type',
                name: 'phaseType',
                type: 'options',
                options: [
                    { name: 'Single Phase', value: 'single' },
                    { name: 'Three Phase', value: 'three' },
                ],
                displayOptions: {
                    show: {
                        calculationType: ['wire', 'voltageDrop', 'circuit', 'load'],
                    },
                },
                default: 'single',
            },
            // Conduit Fill Options
            {
                displayName: 'Conduit Size',
                name: 'conduitSize',
                type: 'options',
                options: [
                    { name: '1/2"', value: 0.5 },
                    { name: '3/4"', value: 0.75 },
                    { name: '1"', value: 1.0 },
                    { name: '1-1/4"', value: 1.25 },
                    { name: '1-1/2"', value: 1.5 },
                    { name: '2"', value: 2.0 },
                    { name: '2-1/2"', value: 2.5 },
                    { name: '3"', value: 3.0 },
                    { name: '4"', value: 4.0 },
                ],
                displayOptions: {
                    show: {
                        calculationType: ['conduit'],
                    },
                },
                default: 0.5,
            },
            {
                displayName: 'Wire Sizes',
                name: 'wireSizes',
                type: 'string',
                displayOptions: {
                    show: {
                        calculationType: ['conduit'],
                    },
                },
                default: '',
                placeholder: '12,12,14,14',
                description: 'Comma-separated list of wire AWG sizes',
            },
            // Additional parameters for complex calculations
            {
                displayName: 'Temperature Correction Factor',
                name: 'temperatureFactor',
                type: 'number',
                default: 1.0,
                description: 'Temperature correction factor (default 1.0)',
            },
            {
                displayName: 'Derating Factor',
                name: 'deratingFactor', 
                type: 'number',
                default: 1.0,
                description: 'Conductor derating factor (default 1.0)',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const calculationType = this.getNodeParameter('calculationType', i) as string;
                const inputData = items[i].json;

                let result: any = {};

                switch (calculationType) {
                    case 'load':
                        result = await this.calculateLoad(i, inputData);
                        break;
                    case 'wire':
                        result = await this.calculateWireSize(i, inputData);
                        break;
                    case 'conduit':
                        result = await this.calculateConduitFill(i, inputData);
                        break;
                    case 'voltageDrop':
                        result = await this.calculateVoltageDrop(i, inputData);
                        break;
                    case 'panel':
                        result = await this.calculatePanelSize(i, inputData);
                        break;
                    case 'service':
                        result = await this.calculateServiceSize(i, inputData);
                        break;
                    case 'circuit':
                        result = await this.calculateCircuitAnalysis(i, inputData);
                        break;
                    default:
                        throw new NodeOperationError(this.getNode(), `Unknown calculation type: ${calculationType}`);
                }

                result.calculationType = calculationType;
                result.timestamp = new Date().toISOString();
                result.inputData = inputData;

                returnData.push({ json: result });
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                            calculationType: this.getNodeParameter('calculationType', i),
                        },
                    });
                } else {
                    throw error;
                }
            }
        }

        return [returnData];
    }

    private async calculateLoad(index: number, inputData: any) {
        const area = this.getNodeParameter('area', index) as number;
        const buildingType = this.getNodeParameter('buildingType', index) as string;
        const voltage = this.getNodeParameter('voltage', index) as number;

        // NEC Article 220 load calculations
        let generalLightingLoad = 0;
        let smallApplianceLoad = 0;
        let laundryLoad = 0;

        switch (buildingType) {
            case 'residential':
                // 3 VA per square foot for general lighting (NEC 220.12)
                generalLightingLoad = area * 3;
                // Small appliance circuits: 1500 VA each, minimum 2 (NEC 220.52(A))
                smallApplianceLoad = 2 * 1500;
                // Laundry circuit: 1500 VA (NEC 220.52(B))
                laundryLoad = 1500;
                break;
            case 'commercial':
                // Varies by occupancy type, using general office as default
                generalLightingLoad = area * 3.5;
                break;
            case 'industrial':
                generalLightingLoad = area * 2;
                break;
        }

        const totalConnectedLoad = generalLightingLoad + smallApplianceLoad + laundryLoad;
        
        // Apply demand factors (NEC 220.42)
        let demandLoad = totalConnectedLoad;
        if (totalConnectedLoad > 3000) {
            demandLoad = 3000 + (totalConnectedLoad - 3000) * 0.35;
        }

        const totalCurrent = demandLoad / voltage;
        const recommendedServiceSize = this.getNextStandardSize(totalCurrent * 1.25); // 125% factor

        return {
            generalLightingLoad,
            smallApplianceLoad,
            laundryLoad,
            totalConnectedLoad,
            demandLoad,
            totalCurrent: Math.round(totalCurrent * 100) / 100,
            recommendedServiceSize,
            calculations: {
                loadDensity: area > 0 ? Math.round((totalConnectedLoad / area) * 100) / 100 : 0,
                demandFactor: totalConnectedLoad > 0 ? Math.round((demandLoad / totalConnectedLoad) * 10000) / 100 : 0,
            },
        };
    }

    private async calculateWireSize(index: number, inputData: any) {
        const current = this.getNodeParameter('current', index) as number;
        const distance = this.getNodeParameter('distance', index) as number;
        const voltage = this.getNodeParameter('voltage', index) as number;
        const phaseType = this.getNodeParameter('phaseType', index) as string;
        const temperatureFactor = this.getNodeParameter('temperatureFactor', index) as number;
        const deratingFactor = this.getNodeParameter('deratingFactor', index) as number;

        // Ampacity calculation with correction factors
        const adjustedCurrent = current / (temperatureFactor * deratingFactor);

        // Wire ampacity table (simplified)
        const wireAmpacities = [
            { awg: '14', ampacity: 20, resistance: 3.07 },
            { awg: '12', ampacity: 25, resistance: 1.93 },
            { awg: '10', ampacity: 35, resistance: 1.21 },
            { awg: '8', ampacity: 50, resistance: 0.764 },
            { awg: '6', ampacity: 65, resistance: 0.491 },
            { awg: '4', ampacity: 85, resistance: 0.308 },
            { awg: '2', ampacity: 115, resistance: 0.194 },
            { awg: '1', ampacity: 130, resistance: 0.154 },
            { awg: '1/0', ampacity: 150, resistance: 0.122 },
            { awg: '2/0', ampacity: 175, resistance: 0.097 },
            { awg: '3/0', ampacity: 200, resistance: 0.077 },
            { awg: '4/0', ampacity: 230, resistance: 0.061 },
        ];

        // Find minimum wire size for ampacity
        const requiredWire = wireAmpacities.find(wire => wire.ampacity >= adjustedCurrent) || wireAmpacities[wireAmpacities.length - 1];

        // Calculate voltage drop
        const multiplier = phaseType === 'three' ? Math.sqrt(3) : 2;
        const voltageDrop = (multiplier * distance * current * requiredWire.resistance) / 1000;
        const voltageDropPercentage = (voltageDrop / voltage) * 100;

        // Check if voltage drop exceeds 3% (NEC 210.19(A))
        const voltageDropCompliant = voltageDropPercentage <= 3.0;

        // If voltage drop is too high, recommend larger wire
        let recommendedWire = requiredWire;
        if (!voltageDropCompliant) {
            for (const wire of wireAmpacities) {
                const testVoltageDrop = (multiplier * distance * current * wire.resistance) / 1000;
                const testPercentage = (testVoltageDrop / voltage) * 100;
                if (testPercentage <= 3.0 && wire.ampacity >= adjustedCurrent) {
                    recommendedWire = wire;
                    break;
                }
            }
        }

        return {
            requiredCurrent: adjustedCurrent,
            minimumWireSize: requiredWire.awg,
            recommendedWireSize: recommendedWire.awg,
            voltageDrop: Math.round(voltageDrop * 100) / 100,
            voltageDropPercentage: Math.round(voltageDropPercentage * 100) / 100,
            voltageDropCompliant,
            correctionFactors: {
                temperature: temperatureFactor,
                derating: deratingFactor,
            },
        };
    }

    private async calculateConduitFill(index: number, inputData: any) {
        const conduitSize = this.getNodeParameter('conduitSize', index) as number;
        const wireSizesStr = this.getNodeParameter('wireSizes', index) as string;

        // Conduit fill areas (40% for 3+ conductors)
        const conduitAreas: { [key: number]: number } = {
            0.5: 0.125,   // 1/2" = 0.125 sq in at 40%
            0.75: 0.213,  // 3/4" = 0.213 sq in at 40%
            1.0: 0.346,   // 1" = 0.346 sq in at 40%
            1.25: 0.581,  // 1-1/4" = 0.581 sq in at 40%
            1.5: 0.814,   // 1-1/2" = 0.814 sq in at 40%
            2.0: 1.363,   // 2" = 1.363 sq in at 40%
            2.5: 2.343,   // 2-1/2" = 2.343 sq in at 40%
            3.0: 3.538,   // 3" = 3.538 sq in at 40%
            4.0: 5.901,   // 4" = 5.901 sq in at 40%
        };

        // Wire areas in square inches
        const wireAreas: { [key: string]: number } = {
            '14': 0.0097,
            '12': 0.0133,
            '10': 0.0211,
            '8': 0.0366,
            '6': 0.0507,
            '4': 0.0824,
            '2': 0.1158,
            '1': 0.1562,
            '1/0': 0.1855,
            '2/0': 0.2223,
            '3/0': 0.2679,
            '4/0': 0.3237,
        };

        const wireSizes = wireSizesStr.split(',').map(s => s.trim());
        let totalWireArea = 0;

        const wireDetails = wireSizes.map(size => {
            const area = wireAreas[size] || 0;
            totalWireArea += area;
            return { size, area };
        });

        const availableArea = conduitAreas[conduitSize] || 0;
        const fillPercentage = availableArea > 0 ? (totalWireArea / availableArea) * 100 : 0;
        const compliant = fillPercentage <= 100;

        return {
            conduitSize: `${conduitSize}"`,
            availableArea,
            totalWireArea: Math.round(totalWireArea * 10000) / 10000,
            fillPercentage: Math.round(fillPercentage * 100) / 100,
            compliant,
            wireCount: wireSizes.length,
            wireDetails,
            recommendation: compliant ? 'Conduit size adequate' : 'Increase conduit size',
        };
    }

    private async calculateVoltageDrop(index: number, inputData: any) {
        const current = this.getNodeParameter('current', index) as number;
        const distance = this.getNodeParameter('distance', index) as number;
        const voltage = this.getNodeParameter('voltage', index) as number;
        const phaseType = this.getNodeParameter('phaseType', index) as string;

        // Using #12 AWG as default for voltage drop calculation
        const resistance = 1.93; // ohms per 1000 ft for #12 AWG

        const multiplier = phaseType === 'three' ? Math.sqrt(3) : 2;
        const voltageDrop = (multiplier * distance * current * resistance) / 1000;
        const voltageDropPercentage = (voltageDrop / voltage) * 100;
        
        // NEC recommendations: 3% for branch circuits, 5% total
        const branchCircuitCompliant = voltageDropPercentage <= 3.0;
        const feederCompliant = voltageDropPercentage <= 5.0;

        return {
            voltageDrop: Math.round(voltageDrop * 100) / 100,
            voltageDropPercentage: Math.round(voltageDropPercentage * 100) / 100,
            branchCircuitCompliant,
            feederCompliant,
            voltage,
            current,
            distance,
            phaseType,
            resistance,
        };
    }

    private async calculatePanelSize(index: number, inputData: any) {
        // Simplified panel sizing based on load
        const loads = inputData.loads || [];
        const totalLoad = loads.reduce((sum: number, load: any) => sum + (load.watts || 0), 0);
        const voltage = this.getNodeParameter('voltage', index) as number || 240;

        const totalCurrent = totalLoad / voltage;
        const recommendedPanelSize = this.getNextStandardSize(totalCurrent * 1.25);

        // Estimate number of circuits needed
        const averageCircuitLoad = 1800; // watts, typical 15A circuit at 80%
        const estimatedCircuits = Math.ceil(totalLoad / averageCircuitLoad);
        const recommendedSpaces = Math.max(estimatedCircuits * 1.25, 20); // 25% spare capacity, minimum 20

        return {
            totalLoad,
            totalCurrent: Math.round(totalCurrent * 100) / 100,
            recommendedPanelSize,
            estimatedCircuits,
            recommendedSpaces: Math.ceil(recommendedSpaces / 2) * 2, // Round to even number
            loadDensity: Math.round((totalLoad / 1000) * 100) / 100, // kW
        };
    }

    private async calculateServiceSize(index: number, inputData: any) {
        const area = this.getNodeParameter('area', index) as number;
        const buildingType = this.getNodeParameter('buildingType', index) as string;

        const loadCalculation = await this.calculateLoad(index, inputData);
        const serviceCurrent = loadCalculation.totalCurrent;
        const recommendedServiceSize = this.getNextStandardSize(serviceCurrent * 1.25);

        // Additional service sizing considerations
        const minServiceSize = buildingType === 'residential' ? 100 : 200;
        const finalServiceSize = Math.max(recommendedServiceSize, minServiceSize);

        return {
            ...loadCalculation,
            serviceCurrent: Math.round(serviceCurrent * 100) / 100,
            recommendedServiceSize: finalServiceSize,
            minimumServiceSize: minServiceSize,
            serviceType: finalServiceSize <= 200 ? 'Single meter' : 'Multiple meters or transformer',
        };
    }

    private async calculateCircuitAnalysis(index: number, inputData: any) {
        const current = this.getNodeParameter('current', index) as number;
        const distance = this.getNodeParameter('distance', index) as number;
        const voltage = this.getNodeParameter('voltage', index) as number;

        const wireCalc = await this.calculateWireSize(index, inputData);
        const voltageDropCalc = await this.calculateVoltageDrop(index, inputData);

        // Breaker sizing (125% for continuous loads)
        const breakerSize = this.getNextStandardBreakerSize(current * 1.25);

        // Conduit sizing estimate
        const estimatedConduitSize = this.estimateConduitSize(wireCalc.recommendedWireSize, 3);

        return {
            ...wireCalc,
            ...voltageDropCalc,
            breakerSize,
            estimatedConduitSize,
            circuitLength: distance,
            recommendations: {
                wire: wireCalc.recommendedWireSize,
                breaker: `${breakerSize}A`,
                conduit: estimatedConduitSize,
                compliance: wireCalc.voltageDropCompliant ? 'Compliant' : 'Non-compliant voltage drop',
            },
        };
    }

    private getNextStandardSize(current: number): number {
        const standardSizes = [15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000];
        return standardSizes.find(size => size >= current) || standardSizes[standardSizes.length - 1];
    }

    private getNextStandardBreakerSize(current: number): number {
        const standardBreakers = [15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000];
        return standardBreakers.find(size => size >= current) || standardBreakers[standardBreakers.length - 1];
    }

    private estimateConduitSize(wireSize: string, conductorCount: number): string {
        // Simplified conduit sizing
        const wireSizeNum = parseFloat(wireSize.replace('/', '.'));
        
        if (conductorCount <= 3) {
            if (wireSizeNum >= 14) return '1/2"';
            if (wireSizeNum >= 10) return '3/4"';
            if (wireSizeNum >= 6) return '1"';
            if (wireSizeNum >= 2) return '1-1/4"';
            return '1-1/2"';
        } else {
            // Larger conduit for more conductors
            if (wireSizeNum >= 14) return '3/4"';
            if (wireSizeNum >= 10) return '1"';
            if (wireSizeNum >= 6) return '1-1/4"';
            if (wireSizeNum >= 2) return '1-1/2"';
            return '2"';
        }
    }
}