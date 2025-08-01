#!/usr/bin/env python3
"""
NEC Compliance Automation Engine
Automated compliance checking against NEC 2023 standards
Focus on Articles 210 (Branch Circuits) and 215 (Feeders)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import re
from datetime import datetime
import logging
from abc import ABC, abstractmethod


class NECArticle(Enum):
    """NEC Articles covered by the compliance engine"""
    ARTICLE_210 = "210"  # Branch Circuits
    ARTICLE_215 = "215"  # Feeders
    ARTICLE_220 = "220"  # Branch-Circuit, Feeder, and Service Load Calculations
    ARTICLE_240 = "240"  # Overcurrent Protection
    ARTICLE_250 = "250"  # Grounding and Bonding
    ARTICLE_310 = "310"  # Conductors for General Wiring


class ComplianceStatus(Enum):
    """Compliance check results"""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    WARNING = "warning"
    NOT_APPLICABLE = "not_applicable"
    REQUIRES_REVIEW = "requires_review"


class LocationType(Enum):
    """Location classifications for NEC requirements"""
    DWELLING_UNIT = "dwelling_unit"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    WET_LOCATION = "wet_location"
    DAMP_LOCATION = "damp_location"
    DRY_LOCATION = "dry_location"
    HAZARDOUS_LOCATION = "hazardous_location"


@dataclass
class ElectricalLoad:
    """Electrical load specification for compliance checking"""
    load_id: str
    load_type: str  # lighting, receptacle, appliance, motor, etc.
    power_rating_va: float
    voltage: int
    phase_count: int
    location_type: LocationType
    room_type: str  # kitchen, bathroom, bedroom, etc.
    special_requirements: List[str] = field(default_factory=list)
    gfci_required: bool = False
    afci_required: bool = False
    dedicated_circuit_required: bool = False


@dataclass
class CircuitSpecification:
    """Branch circuit or feeder specification"""
    circuit_id: str
    circuit_type: str  # branch_circuit, feeder
    voltage: int
    amperage: int
    conductor_awg: str
    conductor_material: str  # copper, aluminum
    insulation_type: str
    conduit_type: str
    length_feet: float
    loads: List[ElectricalLoad]
    protection_type: str  # circuit_breaker, fuse
    protection_rating: int
    gfci_protected: bool = False
    afci_protected: bool = False


@dataclass
class ComplianceCheckResult:
    """Result of a compliance check"""
    rule_id: str
    rule_description: str
    article_section: str
    status: ComplianceStatus
    details: str
    recommendations: List[str] = field(default_factory=list)
    severity: str = "info"  # info, warning, error, critical
    affected_components: List[str] = field(default_factory=list)


class NECRule(ABC):
    """Abstract base class for NEC compliance rules"""
    
    def __init__(self, rule_id: str, article_section: str, description: str):
        self.rule_id = rule_id
        self.article_section = article_section
        self.description = description
    
    @abstractmethod
    def check_compliance(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """Check compliance for a specific circuit"""
        pass


class Article210Rules:
    """NEC Article 210 - Branch Circuits compliance rules"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def check_outlet_limitations(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 210.11(C)(1) - Maximum 12 outlets per 15A circuit
        NEC 210.11(C)(2) - Maximum 13 outlets per 20A circuit
        """
        
        outlet_count = len([load for load in circuit.loads if 'receptacle' in load.load_type.lower()])
        
        # Determine maximum outlets based on circuit amperage
        max_outlets = {
            15: 12,
            20: 13,
            30: 16,  # For larger circuits
            40: 20
        }
        
        max_allowed = max_outlets.get(circuit.amperage, 0)
        
        if max_allowed == 0:
            return ComplianceCheckResult(
                rule_id="210.11.C.1",
                rule_description="Outlet limitations for branch circuits",
                article_section="210.11(C)(1)",
                status=ComplianceStatus.REQUIRES_REVIEW,
                details=f"Unusual circuit amperage: {circuit.amperage}A",
                severity="warning"
            )
        
        if outlet_count <= max_allowed:
            status = ComplianceStatus.COMPLIANT
            details = f"Circuit has {outlet_count} outlets (max {max_allowed} allowed)"
            severity = "info"
            recommendations = []
        else:
            status = ComplianceStatus.NON_COMPLIANT
            details = f"Circuit has {outlet_count} outlets, exceeds maximum of {max_allowed}"
            severity = "error"
            recommendations = [
                f"Reduce outlet count to {max_allowed} or fewer",
                f"Consider using a {circuit.amperage + 5}A circuit",
                "Split loads across multiple circuits"
            ]
        
        return ComplianceCheckResult(
            rule_id="210.11.C.1",
            rule_description="Outlet limitations for branch circuits",
            article_section="210.11(C)(1)",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[circuit.circuit_id]
        )
    
    def check_kitchen_appliance_circuits(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 210.11(C)(1) - Dedicated circuits required for kitchen appliances
        NEC 210.52(B)(3) - At least two 20A circuits for small appliance loads
        """
        
        kitchen_loads = [load for load in circuit.loads if 'kitchen' in load.room_type.lower()]
        
        if not kitchen_loads:
            return ComplianceCheckResult(
                rule_id="210.52.B.3",
                rule_description="Kitchen small appliance circuits",
                article_section="210.52(B)(3)",
                status=ComplianceStatus.NOT_APPLICABLE,
                details="No kitchen loads on this circuit"
            )
        
        # Check for dedicated appliance circuits
        dedicated_appliances = ['dishwasher', 'garbage_disposal', 'microwave', 'range', 'cooktop', 'oven']
        
        violations = []
        recommendations = []
        
        for load in kitchen_loads:
            if any(appliance in load.load_type.lower() for appliance in dedicated_appliances):
                if not load.dedicated_circuit_required:
                    violations.append(f"{load.load_type} requires dedicated circuit")
                    recommendations.append(f"Provide dedicated circuit for {load.load_type}")
        
        # Check circuit amperage for small appliance loads
        small_appliance_loads = [load for load in kitchen_loads 
                               if 'receptacle' in load.load_type.lower()]
        
        if small_appliance_loads and circuit.amperage < 20:
            violations.append("Kitchen small appliance circuits must be 20A minimum")
            recommendations.append("Upgrade circuit to 20A for kitchen receptacles")
        
        if violations:
            status = ComplianceStatus.NON_COMPLIANT
            details = "; ".join(violations)
            severity = "error"
        else:
            status = ComplianceStatus.COMPLIANT
            details = "Kitchen appliance circuit requirements met"
            severity = "info"
        
        return ComplianceCheckResult(
            rule_id="210.52.B.3",
            rule_description="Kitchen small appliance circuits",
            article_section="210.52(B)(3)",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[load.load_id for load in kitchen_loads]
        )
    
    def check_gfci_requirements(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 210.8 - GFCI protection requirements for various locations
        """
        
        gfci_required_locations = [
            'bathroom', 'kitchen', 'garage', 'basement', 'crawl_space',
            'laundry', 'wet_bar', 'boathouse', 'swimming_pool'
        ]
        
        wet_locations = [LocationType.WET_LOCATION, LocationType.DAMP_LOCATION]
        
        violations = []
        recommendations = []
        
        for load in circuit.loads:
            requires_gfci = (
                any(location in load.room_type.lower() for location in gfci_required_locations) or
                load.location_type in wet_locations or
                load.gfci_required
            )
            
            if requires_gfci and not circuit.gfci_protected:
                violations.append(f"{load.load_type} in {load.room_type} requires GFCI protection")
                recommendations.append(f"Install GFCI protection for {load.room_type} locations")
        
        if violations:
            status = ComplianceStatus.NON_COMPLIANT
            details = "; ".join(violations)
            severity = "critical"  # GFCI is a safety requirement
        else:
            status = ComplianceStatus.COMPLIANT
            details = "GFCI requirements satisfied"
            severity = "info"
        
        return ComplianceCheckResult(
            rule_id="210.8",
            rule_description="GFCI protection requirements",
            article_section="210.8",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[circuit.circuit_id]
        )
    
    def check_afci_requirements(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 210.12 - AFCI protection requirements for dwelling units
        """
        
        afci_required_areas = [
            'family_room', 'dining_room', 'living_room', 'parlor', 'library',
            'den', 'bedroom', 'sunroom', 'recreation_room', 'closet', 'hallway',
            'laundry_area'
        ]
        
        dwelling_loads = [load for load in circuit.loads 
                         if load.location_type == LocationType.DWELLING_UNIT]
        
        violations = []
        recommendations = []
        
        for load in dwelling_loads:
            requires_afci = (
                any(area in load.room_type.lower() for area in afci_required_areas) or
                load.afci_required
            )
            
            if requires_afci and not circuit.afci_protected:
                violations.append(f"{load.load_type} in {load.room_type} requires AFCI protection")
                recommendations.append(f"Install AFCI protection for {load.room_type} circuits")
        
        if violations:
            status = ComplianceStatus.NON_COMPLIANT
            details = "; ".join(violations)
            severity = "error"
        elif dwelling_loads and not violations:
            status = ComplianceStatus.COMPLIANT
            details = "AFCI requirements satisfied"
            severity = "info"
        else:
            status = ComplianceStatus.NOT_APPLICABLE
            details = "No dwelling unit loads requiring AFCI"
            severity = "info"
        
        return ComplianceCheckResult(
            rule_id="210.12",
            rule_description="AFCI protection requirements",
            article_section="210.12",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[load.load_id for load in dwelling_loads]
        )


class Article215Rules:
    """NEC Article 215 - Feeders compliance rules"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def check_feeder_ampacity(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 215.2 - Feeder ampacity requirements
        Feeder conductors must have ampacity not less than required to supply the load
        """
        
        # Calculate total connected load
        total_load_va = sum(load.power_rating_va for load in circuit.loads)
        calculated_ampacity = total_load_va / circuit.voltage
        
        # Apply demand factors (simplified - full implementation would be more complex)
        if len(circuit.loads) > 10:
            demand_factor = 0.5  # 50% demand factor for large numbers of loads
        elif len(circuit.loads) > 5:
            demand_factor = 0.75  # 75% demand factor
        else:
            demand_factor = 1.0  # 100% demand factor
        
        required_ampacity = calculated_ampacity * demand_factor
        
        # Get conductor ampacity from NEC Table 310.16
        conductor_ampacities = {
            ('12', 'copper'): 20, ('10', 'copper'): 30, ('8', 'copper'): 50,
            ('6', 'copper'): 65, ('4', 'copper'): 85, ('3', 'copper'): 100,
            ('2', 'copper'): 115, ('1', 'copper'): 130, ('1/0', 'copper'): 150,
            ('2/0', 'copper'): 175, ('3/0', 'copper'): 200, ('4/0', 'copper'): 230,
            ('12', 'aluminum'): 15, ('10', 'aluminum'): 25, ('8', 'aluminum'): 40,
            ('6', 'aluminum'): 50, ('4', 'aluminum'): 65, ('3', 'aluminum'): 75,
            ('2', 'aluminum'): 90
        }
        
        conductor_ampacity = conductor_ampacities.get(
            (circuit.conductor_awg, circuit.conductor_material.lower()), 0
        )
        
        if conductor_ampacity == 0:
            return ComplianceCheckResult(
                rule_id="215.2",
                rule_description="Feeder ampacity requirements",
                article_section="215.2",
                status=ComplianceStatus.REQUIRES_REVIEW,
                details=f"Unknown conductor: {circuit.conductor_awg} {circuit.conductor_material}",
                severity="warning"
            )
        
        if conductor_ampacity >= required_ampacity:
            status = ComplianceStatus.COMPLIANT
            details = f"Conductor ampacity ({conductor_ampacity}A) adequate for load ({required_ampacity:.1f}A)"
            severity = "info"
            recommendations = []
        else:
            status = ComplianceStatus.NON_COMPLIANT
            details = f"Conductor ampacity ({conductor_ampacity}A) insufficient for load ({required_ampacity:.1f}A)"
            severity = "error"
            
            # Recommend larger conductor
            recommended_conductors = []
            for (awg, material), ampacity in conductor_ampacities.items():
                if material == circuit.conductor_material.lower() and ampacity >= required_ampacity:
                    recommended_conductors.append(f"{awg} AWG {material}")
            
            recommendations = [
                f"Upgrade conductor to minimum {recommended_conductors[0] if recommended_conductors else 'larger size'}",
                f"Verify load calculations and demand factors",
                f"Consider load diversity and coincidence factors"
            ]
        
        return ComplianceCheckResult(
            rule_id="215.2",
            rule_description="Feeder ampacity requirements",
            article_section="215.2",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[circuit.circuit_id]
        )
    
    def check_overcurrent_protection(self, circuit: CircuitSpecification) -> ComplianceCheckResult:
        """
        NEC 215.3 - Overcurrent protection for feeders
        """
        
        # Get conductor ampacity
        conductor_ampacities = {
            ('12', 'copper'): 20, ('10', 'copper'): 30, ('8', 'copper'): 50,
            ('6', 'copper'): 65, ('4', 'copper'): 85, ('3', 'copper'): 100,
            ('2', 'copper'): 115, ('1', 'copper'): 130, ('1/0', 'copper'): 150
        }
        
        conductor_ampacity = conductor_ampacities.get(
            (circuit.conductor_awg, circuit.conductor_material.lower()), 0
        )
        
        if conductor_ampacity == 0:
            return ComplianceCheckResult(
                rule_id="215.3",
                rule_description="Feeder overcurrent protection",
                article_section="215.3",
                status=ComplianceStatus.REQUIRES_REVIEW,
                details="Cannot determine conductor ampacity",
                severity="warning"
            )
        
        # Check if overcurrent protection rating is appropriate
        if circuit.protection_rating <= conductor_ampacity:
            status = ComplianceStatus.COMPLIANT
            details = f"Overcurrent protection ({circuit.protection_rating}A) appropriate for conductor ({conductor_ampacity}A)"
            severity = "info"
            recommendations = []
        else:
            status = ComplianceStatus.NON_COMPLIANT
            details = f"Overcurrent protection ({circuit.protection_rating}A) exceeds conductor ampacity ({conductor_ampacity}A)"
            severity = "critical"
            recommendations = [
                f"Reduce overcurrent protection to {conductor_ampacity}A or less",
                f"Upgrade conductor to support {circuit.protection_rating}A protection",
                "Verify conductor sizing calculations"
            ]
        
        return ComplianceCheckResult(
            rule_id="215.3",
            rule_description="Feeder overcurrent protection",
            article_section="215.3",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[circuit.circuit_id]
        )


class Article220Rules:
    """NEC Article 220 - Load Calculations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def check_general_lighting_load(self, loads: List[ElectricalLoad], 
                                  building_area_sqft: float) -> ComplianceCheckResult:
        """
        NEC 220.12 - General lighting load calculation
        Minimum 3 VA per square foot for dwelling units
        """
        
        lighting_loads = [load for load in loads if 'lighting' in load.load_type.lower()]
        total_lighting_va = sum(load.power_rating_va for load in lighting_loads)
        
        # Minimum lighting load based on NEC Table 220.12
        unit_loads = {
            LocationType.DWELLING_UNIT: 3.0,      # 3 VA/sq ft
            LocationType.COMMERCIAL: 3.5,         # Varies by occupancy
            LocationType.INDUSTRIAL: 2.0          # Varies by type
        }
        
        # Determine predominant location type
        location_types = [load.location_type for load in loads]
        predominant_location = max(set(location_types), key=location_types.count)
        
        required_unit_load = unit_loads.get(predominant_location, 3.0)
        minimum_lighting_va = building_area_sqft * required_unit_load
        
        if total_lighting_va >= minimum_lighting_va:
            status = ComplianceStatus.COMPLIANT
            details = f"Lighting load ({total_lighting_va}VA) meets minimum ({minimum_lighting_va:.0f}VA)"
            severity = "info"
            recommendations = []
        else:
            status = ComplianceStatus.NON_COMPLIANT
            details = f"Lighting load ({total_lighting_va}VA) below minimum ({minimum_lighting_va:.0f}VA)"
            severity = "error"
            recommendations = [
                f"Add {minimum_lighting_va - total_lighting_va:.0f}VA of lighting load",
                f"Verify building area calculation ({building_area_sqft} sq ft)",
                "Review lighting layout for adequacy"
            ]
        
        return ComplianceCheckResult(
            rule_id="220.12",
            rule_description="General lighting load requirements",
            article_section="220.12",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[load.load_id for load in lighting_loads]
        )
    
    def check_small_appliance_circuits(self, loads: List[ElectricalLoad]) -> ComplianceCheckResult:
        """
        NEC 220.52(A) - Small appliance branch circuits
        Minimum of two 20A small appliance circuits for dwelling units
        """
        
        kitchen_loads = [load for load in loads 
                        if load.location_type == LocationType.DWELLING_UNIT 
                        and 'kitchen' in load.room_type.lower()
                        and 'receptacle' in load.load_type.lower()]
        
        if not kitchen_loads:
            return ComplianceCheckResult(
                rule_id="220.52.A",
                rule_description="Small appliance circuits",
                article_section="220.52(A)",
                status=ComplianceStatus.NOT_APPLICABLE,
                details="No dwelling unit kitchen receptacle loads"
            )
        
        # Each small appliance circuit should be 1500VA minimum
        required_circuits = 2  # Minimum per NEC
        required_va_per_circuit = 1500
        total_required_va = required_circuits * required_va_per_circuit
        
        total_small_appliance_va = sum(load.power_rating_va for load in kitchen_loads)
        
        if total_small_appliance_va >= total_required_va:
            status = ComplianceStatus.COMPLIANT
            details = f"Small appliance load ({total_small_appliance_va}VA) meets minimum ({total_required_va}VA)"
            severity = "info"
            recommendations = []
        else:
            status = ComplianceStatus.NON_COMPLIANT
            details = f"Small appliance load ({total_small_appliance_va}VA) below minimum ({total_required_va}VA)"
            severity = "error"
            recommendations = [
                f"Provide minimum {required_circuits} small appliance circuits",
                f"Each circuit should be rated 1500VA minimum",
                "Ensure circuits serve only small appliance loads"
            ]
        
        return ComplianceCheckResult(
            rule_id="220.52.A",
            rule_description="Small appliance circuits",
            article_section="220.52(A)",
            status=status,
            details=details,
            recommendations=recommendations,
            severity=severity,
            affected_components=[load.load_id for load in kitchen_loads]
        )


class NECComplianceEngine:
    """Main NEC compliance checking engine"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.article_210_rules = Article210Rules()
        self.article_215_rules = Article215Rules()
        self.article_220_rules = Article220Rules()
        
        # Compliance history
        self.compliance_history = []
        
    def check_circuit_compliance(self, circuit: CircuitSpecification, 
                               building_area_sqft: Optional[float] = None) -> List[ComplianceCheckResult]:
        """
        Perform comprehensive NEC compliance check for a circuit
        """
        
        self.logger.info(f"Checking compliance for circuit {circuit.circuit_id}")
        
        results = []
        
        # Article 210 - Branch Circuit checks
        if circuit.circuit_type == 'branch_circuit':
            results.extend([
                self.article_210_rules.check_outlet_limitations(circuit),
                self.article_210_rules.check_kitchen_appliance_circuits(circuit),
                self.article_210_rules.check_gfci_requirements(circuit),
                self.article_210_rules.check_afci_requirements(circuit)
            ])
        
        # Article 215 - Feeder checks
        if circuit.circuit_type == 'feeder':
            results.extend([
                self.article_215_rules.check_feeder_ampacity(circuit),
                self.article_215_rules.check_overcurrent_protection(circuit)
            ])
        
        # Article 220 - Load calculation checks (if building area provided)
        if building_area_sqft:
            results.extend([
                self.article_220_rules.check_general_lighting_load(circuit.loads, building_area_sqft),
                self.article_220_rules.check_small_appliance_circuits(circuit.loads)
            ])
        
        # Store compliance history
        compliance_record = {
            'circuit_id': circuit.circuit_id,
            'check_date': datetime.now(),
            'results': results,
            'overall_status': self._determine_overall_status(results)
        }
        self.compliance_history.append(compliance_record)
        
        return results
    
    def check_system_compliance(self, circuits: List[CircuitSpecification],
                              building_area_sqft: Optional[float] = None) -> Dict[str, Any]:
        """
        Perform system-wide compliance check
        """
        
        self.logger.info(f"Checking compliance for {len(circuits)} circuits")
        
        all_results = {}
        summary_stats = {
            'total_circuits': len(circuits),
            'compliant_circuits': 0,
            'non_compliant_circuits': 0,
            'circuits_requiring_review': 0,
            'critical_violations': 0,
            'warnings': 0
        }
        
        # Check each circuit
        for circuit in circuits:
            circuit_results = self.check_circuit_compliance(circuit, building_area_sqft)
            all_results[circuit.circuit_id] = circuit_results
            
            # Update summary statistics
            overall_status = self._determine_overall_status(circuit_results)
            
            if overall_status == ComplianceStatus.COMPLIANT:
                summary_stats['compliant_circuits'] += 1
            elif overall_status == ComplianceStatus.NON_COMPLIANT:
                summary_stats['non_compliant_circuits'] += 1
            else:
                summary_stats['circuits_requiring_review'] += 1
            
            # Count violations by severity
            for result in circuit_results:
                if result.severity == 'critical':
                    summary_stats['critical_violations'] += 1
                elif result.severity == 'warning':
                    summary_stats['warnings'] += 1
        
        # Generate compliance report
        compliance_report = self._generate_compliance_report(all_results, summary_stats)
        
        return {
            'summary_statistics': summary_stats,
            'detailed_results': all_results,
            'compliance_report': compliance_report,
            'recommendations': self._generate_system_recommendations(all_results)
        }
    
    def _determine_overall_status(self, results: List[ComplianceCheckResult]) -> ComplianceStatus:
        """Determine overall compliance status from individual check results"""
        
        if any(result.status == ComplianceStatus.NON_COMPLIANT for result in results):
            return ComplianceStatus.NON_COMPLIANT
        elif any(result.status == ComplianceStatus.REQUIRES_REVIEW for result in results):
            return ComplianceStatus.REQUIRES_REVIEW
        elif any(result.status == ComplianceStatus.WARNING for result in results):
            return ComplianceStatus.WARNING
        else:
            return ComplianceStatus.COMPLIANT
    
    def _generate_compliance_report(self, all_results: Dict[str, List[ComplianceCheckResult]],
                                  summary_stats: Dict[str, int]) -> str:
        """Generate human-readable compliance report"""
        
        report_lines = [
            "NEC COMPLIANCE ANALYSIS REPORT",
            "=" * 50,
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "SUMMARY",
            "-" * 20,
            f"Total Circuits Analyzed: {summary_stats['total_circuits']}",
            f"Compliant Circuits: {summary_stats['compliant_circuits']}",
            f"Non-Compliant Circuits: {summary_stats['non_compliant_circuits']}",
            f"Circuits Requiring Review: {summary_stats['circuits_requiring_review']}",
            f"Critical Violations: {summary_stats['critical_violations']}",
            f"Warnings: {summary_stats['warnings']}",
            ""
        ]
        
        # Add detailed findings
        if summary_stats['critical_violations'] > 0:
            report_lines.extend([
                "CRITICAL VIOLATIONS",
                "-" * 20
            ])
            
            for circuit_id, results in all_results.items():
                critical_results = [r for r in results if r.severity == 'critical']
                if critical_results:
                    report_lines.append(f"Circuit {circuit_id}:")
                    for result in critical_results:
                        report_lines.append(f"  • {result.article_section}: {result.details}")
                    report_lines.append("")
        
        # Compliance percentage
        if summary_stats['total_circuits'] > 0:
            compliance_percentage = (summary_stats['compliant_circuits'] / summary_stats['total_circuits']) * 100
            report_lines.extend([
                f"OVERALL COMPLIANCE: {compliance_percentage:.1f}%",
                ""
            ])
        
        return "\n".join(report_lines)
    
    def _generate_system_recommendations(self, all_results: Dict[str, List[ComplianceCheckResult]]) -> List[str]:
        """Generate system-wide recommendations"""
        
        recommendations = []
        
        # Collect all recommendations
        all_recommendations = []
        for circuit_results in all_results.values():
            for result in circuit_results:
                all_recommendations.extend(result.recommendations)
        
        # Find common recommendations
        recommendation_counts = {}
        for rec in all_recommendations:
            recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1
        
        # Sort by frequency and add top recommendations
        sorted_recommendations = sorted(recommendation_counts.items(), key=lambda x: x[1], reverse=True)
        
        recommendations.extend([
            "PRIORITY RECOMMENDATIONS",
            "-" * 25
        ])
        
        for rec, count in sorted_recommendations[:10]:  # Top 10 recommendations
            recommendations.append(f"• {rec} (affects {count} circuits)")
        
        return recommendations


# Example usage and testing
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Create sample electrical loads
    loads = [
        ElectricalLoad(
            load_id="LOAD_001",
            load_type="lighting_general",
            power_rating_va=1200,
            voltage=120,
            phase_count=1,
            location_type=LocationType.DWELLING_UNIT,
            room_type="living_room"
        ),
        ElectricalLoad(
            load_id="LOAD_002",
            load_type="receptacle_general",
            power_rating_va=1800,
            voltage=120,
            phase_count=1,
            location_type=LocationType.DWELLING_UNIT,
            room_type="kitchen",
            gfci_required=True
        ),
        ElectricalLoad(
            load_id="LOAD_003",
            load_type="dishwasher",
            power_rating_va=1800,
            voltage=120,
            phase_count=1,
            location_type=LocationType.DWELLING_UNIT,
            room_type="kitchen",
            dedicated_circuit_required=True,
            gfci_required=True
        )
    ]
    
    # Create sample circuit
    circuit = CircuitSpecification(
        circuit_id="CIRCUIT_001",
        circuit_type="branch_circuit",
        voltage=120,
        amperage=20,
        conductor_awg="12",
        conductor_material="copper",
        insulation_type="THWN",
        conduit_type="EMT",
        length_feet=75,
        loads=loads,
        protection_type="circuit_breaker",
        protection_rating=20,
        gfci_protected=True,
        afci_protected=True
    )
    
    # Initialize compliance engine
    compliance_engine = NECComplianceEngine()
    
    # Check circuit compliance
    results = compliance_engine.check_circuit_compliance(circuit, building_area_sqft=2000)
    
    print("NEC Compliance Check Results:")
    print("=" * 50)
    
    for result in results:
        print(f"Rule: {result.rule_id} - {result.article_section}")
        print(f"Status: {result.status.value.upper()}")
        print(f"Details: {result.details}")
        if result.recommendations:
            print("Recommendations:")
            for rec in result.recommendations:
                print(f"  • {rec}")
        print("-" * 30)
    
    # System-wide compliance check
    system_results = compliance_engine.check_system_compliance([circuit], building_area_sqft=2000)
    print("\nSystem Compliance Report:")
    print(system_results['compliance_report'])