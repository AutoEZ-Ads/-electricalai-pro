const OpenAI = require('openai');
const { trackEstimationTime, businessMetrics } = require('../middleware/advanced-monitoring');

class AIOptimizationService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Advanced electrical load calculation with AI optimization
    async optimizeLoadCalculation(blueprintData, specifications) {
        const timer = trackEstimationTime('ai_load_calculation');
        
        try {
            const cacheKey = this.generateCacheKey(blueprintData, specifications);
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                timer.end();
                return cached;
            }

            const prompt = this.buildLoadCalculationPrompt(blueprintData, specifications);
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert electrical engineer specializing in load calculations according to NEC 2023 standards. 
                        Provide detailed, accurate calculations with proper demand factors, safety margins, and code compliance.
                        Return results in JSON format with calculations, reasoning, and code references.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            });

            const result = this.parseAIResponse(response.choices[0].message.content);
            result.aiEnhanced = true;
            result.confidence = this.calculateConfidence(result);
            
            this.setCache(cacheKey, result);
            businessMetrics.estimationsCreated.inc();
            businessMetrics.estimationAccuracy.observe(result.confidence);
            
            timer.end();
            return result;
            
        } catch (error) {
            timer.end();
            console.error('AI Load Calculation Error:', error);
            return this.fallbackCalculation(blueprintData, specifications);
        }
    }

    // AI-powered material optimization
    async optimizeMaterialList(loadCalculation, preferences = {}) {
        const timer = trackEstimationTime('ai_material_optimization');
        
        try {
            const prompt = `
            Based on this electrical load calculation, optimize the material list for:
            - Cost efficiency: ${preferences.costPriority || 7}/10
            - Quality tier: ${preferences.qualityTier || 'commercial'}
            - Installation complexity: ${preferences.complexityPreference || 'standard'}
            - Future expansion: ${preferences.futureExpansion || false}
            
            Load Calculation: ${JSON.stringify(loadCalculation, null, 2)}
            
            Provide:
            1. Optimized conductor sizing with alternatives
            2. Panel and breaker recommendations
            3. Conduit and fitting specifications
            4. Cost-saving opportunities
            5. Upgrade suggestions for future-proofing
            
            Return as structured JSON with pricing estimates.
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a master electrician and purchasing specialist with 20+ years experience optimizing electrical material lists for commercial and residential projects."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 2500
            });

            const optimizedList = this.parseAIResponse(response.choices[0].message.content);
            optimizedList.optimizationApplied = true;
            optimizedList.timestamp = new Date().toISOString();
            
            timer.end();
            return optimizedList;
            
        } catch (error) {
            timer.end();
            console.error('AI Material Optimization Error:', error);
            return this.fallbackMaterialList(loadCalculation);
        }
    }

    // AI code compliance checker
    async checkCodeCompliance(estimation, jurisdiction = 'NEC2023') {
        const timer = trackEstimationTime('ai_code_compliance');
        
        try {
            const prompt = `
            Review this electrical estimation for ${jurisdiction} code compliance:
            
            ${JSON.stringify(estimation, null, 2)}
            
            Check for:
            1. Load calculation accuracy and demand factors
            2. Conductor ampacity and derating requirements
            3. GFCI/AFCI protection requirements
            4. Grounding and bonding compliance
            5. Panel sizing and space requirements
            6. Service entrance requirements
            7. Branch circuit requirements
            
            Provide:
            - Compliance status for each area
            - Specific code violations with article references
            - Recommendations for compliance
            - Risk assessment (low/medium/high)
            
            Return as structured JSON with actionable recommendations.
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: `You are a certified electrical inspector with expertise in ${jurisdiction} code enforcement. 
                        Provide thorough, accurate code compliance reviews with specific article references.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            });

            const complianceReport = this.parseAIResponse(response.choices[0].message.content);
            complianceReport.jurisdiction = jurisdiction;
            complianceReport.reviewDate = new Date().toISOString();
            
            timer.end();
            return complianceReport;
            
        } catch (error) {
            timer.end();
            console.error('AI Code Compliance Error:', error);
            return this.fallbackComplianceCheck(estimation);
        }
    }

    // Smart project scheduling with AI
    async optimizeProjectSchedule(estimation, constraints = {}) {
        const timer = trackEstimationTime('ai_schedule_optimization');
        
        try {
            const prompt = `
            Create an optimized installation schedule for this electrical project:
            
            Project Details: ${JSON.stringify(estimation, null, 2)}
            
            Constraints:
            - Crew size: ${constraints.crewSize || 2} electricians
            - Available hours per day: ${constraints.hoursPerDay || 8}
            - Weather restrictions: ${constraints.weatherRestrictions || 'standard'}
            - Material delivery lead times: ${constraints.leadTimes || 'standard'}
            - Inspection requirements: ${constraints.inspections || 'standard'}
            
            Optimize for:
            1. Minimal total project duration
            2. Efficient crew utilization
            3. Material staging and logistics
            4. Inspection scheduling
            5. Risk mitigation
            
            Provide detailed daily schedule with tasks, milestones, and critical path analysis.
            Return as structured JSON with timeline and resource allocation.
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a project manager with 15+ years experience scheduling electrical installations. Optimize for efficiency while maintaining quality and safety."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2500
            });

            const schedule = this.parseAIResponse(response.choices[0].message.content);
            schedule.optimizedSchedule = true;
            schedule.createdAt = new Date().toISOString();
            
            timer.end();
            return schedule;
            
        } catch (error) {
            timer.end();
            console.error('AI Schedule Optimization Error:', error);
            return this.fallbackSchedule(estimation);
        }
    }

    // Helper methods
    buildLoadCalculationPrompt(blueprintData, specifications) {
        return `
        Calculate electrical loads for this project:
        
        Building Details:
        - Type: ${specifications.buildingType || 'commercial'}
        - Area: ${blueprintData.totalArea || 'not specified'} sq ft
        - Occupancy: ${specifications.occupancy || 'not specified'}
        - Voltage: ${specifications.voltage || '120/240V'}
        
        Blueprint Analysis: ${JSON.stringify(blueprintData, null, 2)}
        
        Calculate:
        1. General lighting load (3 VA/sq ft minimum)
        2. Receptacle loads with demand factors
        3. HVAC and equipment loads
        4. Service entrance sizing
        5. Panel and breaker requirements
        6. Conductor sizing with derating
        
        Include NEC article references and safety margins.
        `;
    }

    parseAIResponse(content) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback: structure the text response
            return {
                rawResponse: content,
                parsed: false,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: 'Failed to parse AI response',
                rawResponse: content,
                timestamp: new Date().toISOString()
            };
        }
    }

    calculateConfidence(result) {
        let confidence = 0.7; // Base confidence
        
        if (result.calculations && result.calculations.length > 0) confidence += 0.1;
        if (result.codeReferences && result.codeReferences.length > 0) confidence += 0.1;
        if (result.safetyMargins) confidence += 0.05;
        if (result.alternatives && result.alternatives.length > 0) confidence += 0.05;
        
        return Math.min(confidence, 1.0);
    }

    generateCacheKey(blueprintData, specifications) {
        const data = JSON.stringify({ blueprintData, specifications });
        return require('crypto').createHash('md5').update(data).digest('hex');
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Fallback methods for when AI is unavailable
    fallbackCalculation(blueprintData, specifications) {
        return {
            fallback: true,
            basicCalculation: true,
            totalLoad: blueprintData.totalArea * 3, // Basic 3 VA/sq ft
            serviceSize: '200A', // Conservative estimate
            warning: 'AI optimization unavailable - using basic calculations'
        };
    }

    fallbackMaterialList(loadCalculation) {
        return {
            fallback: true,
            basicList: true,
            warning: 'AI optimization unavailable - using standard material list'
        };
    }

    fallbackComplianceCheck(estimation) {
        return {
            fallback: true,
            status: 'manual_review_required',
            warning: 'AI compliance check unavailable - manual review recommended'
        };
    }

    fallbackSchedule(estimation) {
        return {
            fallback: true,
            estimatedDays: 5, // Conservative estimate
            warning: 'AI scheduling unavailable - using standard timeline'
        };
    }
}

module.exports = AIOptimizationService;