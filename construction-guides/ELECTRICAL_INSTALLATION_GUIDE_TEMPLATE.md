# 🔌 Electrical Installation Guide
## Complete Field Reference for Electrical Contractors

---

## 📋 Project Information

| Field | Value |
|-------|-------|
| **Project Name** | {{project_name}} |
| **Floor Plan** | {{floor_plan_filename}} |
| **Building Type** | {{building_type}} |
| **Square Footage** | {{square_footage}} sq ft |
| **Complexity Level** | {{complexity_level}} |
| **Generated** | {{generation_date}} |
| **NEC Version** | 2023 |

---

## 📐 Coordinate Reference System

### Grid Layout
- **Reference Point**: ({{reference_x}}, {{reference_y}})
- **Scale**: {{scale_factor}}
- **Units**: {{measurement_units}}

### Horizontal Axes
{{#horizontal_axes}}
- **{{label}}**: Y={{y_position}}" - {{description}}
{{/horizontal_axes}}

### Vertical Axes  
{{#vertical_axes}}
- **{{label}}**: X={{x_position}}" - {{description}}
{{/vertical_axes}}

### Location Referencing
Use format: **Grid A1 + (offset_x", offset_y")**
- Example: "Grid B3 + (6.5", -2.0")" = 6.5" right, 2.0" up from grid B3

---

## ⚡ Phase 1: ROUGH-IN WORK
*Install all concealed electrical work before drywall*

### 🔸 Pre-Installation Checklist
- [ ] Verify power is OFF at main panel
- [ ] Confirm permit approval and inspection schedule
- [ ] Check for existing utilities (gas, water, HVAC)
- [ ] Verify structural clearances
- [ ] Review architectural changes since bid
- [ ] Material delivery confirmation

### 🔹 Step-by-Step Installation

{{#rough_in_steps}}
#### Step {{step_number}}: {{description}}
**Location**: {{location_reference}}

**Specifications:**
{{#specifications}}
- {{key}}: {{value}}
{{/specifications}}

**Tools Required:**
{{#tools_required}}
- {{tool}}
{{/tools_required}}

**⚠️ Safety Notes:**
{{#safety_notes}}
- {{note}}
{{/safety_notes}}

**Installation Procedure:**
{{#procedure_steps}}
{{step_number}}. {{instruction}}
{{/procedure_steps}}

**✅ Quality Check:**
{{#quality_checks}}
- [ ] {{check}}
{{/quality_checks}}

**📸 Photo Points:**
- Before installation
- Rough-in complete
- Testing/verification

---
{{/rough_in_steps}}

### 🔧 Rough-In Inspection Requirements

#### NEC Compliance Verification
- [ ] **Article 110.26**: Working space clearances maintained
- [ ] **Article 210.12**: AFCI protection installed where required
- [ ] **Article 210.8**: GFCI protection installed where required  
- [ ] **Article 250**: Grounding and bonding complete
- [ ] **Article 300.4**: Protection from physical damage
- [ ] **Article 314**: Box locations and support adequate
- [ ] **Article 334**: NM cable installation per code
- [ ] **Article 358**: EMT installation per code

#### Measurement Verification
{{#rough_in_measurements}}
- **{{measurement_type}}**: {{expected_value}} {{unit}}
  - Tolerance: ±{{tolerance}}
  - Critical: {{is_critical}}
{{/rough_in_measurements}}

---

## ⚡ Phase 2: TRIM-OUT WORK  
*Install visible electrical devices and fixtures*

### 🔸 Pre-Trim Checklist
- [ ] Rough-in inspection passed
- [ ] Drywall/finishing complete
- [ ] Paint complete (if applicable)
- [ ] Devices and fixtures on-site
- [ ] Verify room/area final dimensions

### 🔹 Device Installation Sequence

{{#trim_out_steps}}
#### Step {{step_number}}: {{description}}
**Location**: {{location_reference}}

**Device Specifications:**
{{#specifications}}
- {{key}}: {{value}}
{{/specifications}}

**Installation Height:** {{installation_height}}"
**Mounting:** {{mounting_method}}

**Wire Connections:**
{{#wire_connections}}
- **{{terminal}}**: {{wire_color}} ({{wire_function}})
{{/wire_connections}}

**⚠️ Safety Protocol:**
1. Turn OFF circuit breaker
2. Test with voltage tester
3. Lock out/tag out if required
4. Test again after installation

**Torque Specifications:**
{{#torque_specs}}
- {{connection_type}}: {{torque_value}} in-lbs
{{/torque_specs}}

**✅ Testing Required:**
{{#testing_requirements}}
- [ ] {{test_type}}: {{expected_result}}
{{/testing_requirements}}

---
{{/trim_out_steps}}

### 📐 Device Positioning Standards

#### Outlet Heights (AFF - Above Finished Floor)
- **Standard Outlets**: 12" to 18" AFF
- **Kitchen Counters**: 44" AFF (4" above counter)
- **Bathroom Vanity**: 44" AFF (4" above counter)  
- **Garage/Basement**: 18" minimum AFF
- **ADA Compliance**: 15" minimum, 48" maximum AFF

#### Switch Heights (AFF)
- **Standard Switches**: 48" AFF
- **ADA Compliance**: 48" maximum AFF
- **Over Counters**: 4" above counter surface
- **Child Areas**: Consider 36" AFF

#### Fixture Locations
{{#fixture_positions}}
- **{{fixture_type}}**: {{position_description}}
  - Height: {{height}}" AFF
  - Clearance: {{clearance_requirements}}
{{/fixture_positions}}

---

## ⚡ Phase 3: FINAL CONNECTIONS & TESTING
*Complete installation and perform all testing*

### 🔸 Panel Schedule Setup

#### Main Panel: {{panel_designation}}
**Location**: {{panel_location}}
**Rating**: {{panel_amperage}}A, {{panel_voltage}}V

| Circuit | Description | Load (VA) | Wire Size | Breaker |
|---------|-------------|-----------|-----------|---------|
{{#panel_schedule}}
| {{circuit_number}} | {{circuit_description}} | {{load_va}} | {{wire_size}} | {{breaker_size}}A |
{{/panel_schedule}}

#### Load Summary
- **Total Connected Load**: {{total_connected_load}} VA
- **Total Demand Load**: {{total_demand_load}} VA  
- **Service Load**: {{service_load}} VA
- **Demand Factor**: {{demand_factor}}

### 🔹 Testing Procedures

#### Continuity Testing
{{#continuity_tests}}
**{{test_name}}:**
- Circuit: {{circuit_number}}
- Expected: {{expected_result}}
- Test Points: {{test_points}}
- [ ] Pass [ ] Fail
- Notes: ___________________________
{{/continuity_tests}}

#### Insulation Resistance Testing
**Test Voltage**: {{test_voltage}}V
**Minimum Resistance**: {{min_resistance}} MΩ

{{#insulation_tests}}
- **{{circuit_description}}**: ______ MΩ [ ] Pass [ ] Fail
{{/insulation_tests}}

#### Ground Fault Testing
{{#gfci_tests}}
**{{device_location}}:**
- Test Button Function: [ ] Pass [ ] Fail
- Reset Function: [ ] Pass [ ] Fail  
- Trip Time: ______ ms (must be ≤ 25ms)
- Test Current: 5mA ± 1mA
{{/gfci_tests}}

#### Arc Fault Testing  
{{#afci_tests}}
**{{device_location}}:**
- Test Button Function: [ ] Pass [ ] Fail
- Reset Function: [ ] Pass [ ] Fail
- Parallel Arc Detection: [ ] Pass [ ] Fail
- Series Arc Detection: [ ] Pass [ ] Fail
{{/afci_tests}}

#### Load Testing
{{#load_tests}}
**{{circuit_description}}:**
- No Load Voltage: ______ V
- Full Load Voltage: ______ V  
- Voltage Drop: ______ V (______%)
- Acceptable: [ ] Yes [ ] No (Max 3% branch, 5% feeder)
{{/load_tests}}

---

## 📊 Material Takeoff & Costs

### Electrical Components

| Item | Quantity | Unit Cost | Total Cost | Supplier |
|------|----------|-----------|------------|----------|
{{#material_list}}
| {{item_description}} | {{quantity}} {{unit}} | ${{unit_cost}} | ${{total_cost}} | {{supplier}} |
{{/material_list}}

**Subtotal Materials**: ${{material_subtotal}}
**Tax**: ${{tax_amount}} ({{tax_rate}}%)
**Shipping**: ${{shipping_cost}}
**Material Total**: ${{material_total}}

### Labor Summary

| Phase | Estimated Hours | Rate | Total |
|-------|----------------|------|-------|
| Rough-In | {{rough_hours}} | ${{labor_rate}} | ${{rough_labor_cost}} |
| Trim-Out | {{trim_hours}} | ${{labor_rate}} | ${{trim_labor_cost}} |
| Final/Testing | {{final_hours}} | ${{labor_rate}} | ${{final_labor_cost}} |
| **Total Labor** | **{{total_hours}}** | | **${{total_labor_cost}}** |

### Project Totals
- **Materials**: ${{material_total}}
- **Labor**: ${{total_labor_cost}}
- **Permits**: ${{permit_cost}}
- **Subtotal**: ${{project_subtotal}}
- **Markup** ({{markup_percentage}}%): ${{markup_amount}}
- **Final Total**: ${{project_total}}

---

## 🚨 Safety Requirements

### Personal Protective Equipment (PPE)

#### Minimum Required PPE
- [ ] **Safety Glasses** - ANSI Z87.1+ rated
- [ ] **Hard Hat** - Class E (electrical) when required
- [ ] **Work Boots** - Electrical hazard rated
- [ ] **Work Gloves** - Cut resistant, non-conductive

#### Electrical Work PPE
- [ ] **Insulated Tools** - 1000V rated minimum
- [ ] **Voltage Tester** - CAT III rated minimum  
- [ ] **Insulated Gloves** - Class 0 (1000V) minimum
- [ ] **Arc Flash PPE** - When required by analysis

### Lockout/Tagout Procedures

#### Standard LOTO Steps
1. **Notify** affected personnel
2. **Shut down** equipment normally
3. **Isolate** energy sources (breakers OFF)
4. **Lock** energy isolating devices
5. **Tag** with warning labels
6. **Verify** zero energy state
7. **Test** voltage before and after work

#### LOTO Documentation  
- [ ] Energy Source Identification Complete
- [ ] LOTO Procedure Posted
- [ ] Personnel Training Verified
- [ ] Lock/Tag Inventory Available

### Electrical Safety Rules

#### Before Starting Work
- [ ] Verify all circuits are de-energized
- [ ] Test voltage measuring equipment
- [ ] Establish energized work boundaries if applicable
- [ ] Review arc flash hazard analysis
- [ ] Confirm appropriate PPE selection

#### During Work
- [ ] Maintain minimum approach distances
- [ ] Use insulated tools exclusively  
- [ ] Never work alone on energized circuits
- [ ] Re-verify de-energized state if work is interrupted
- [ ] Follow proper lifting techniques

#### Emergency Procedures
- **Electrical Shock**: Call 911, do not touch victim, turn off power if safely possible
- **Arc Flash**: Call 911, cool burns with water, remove from electrical hazard
- **Fire**: Use Class C extinguisher, evacuate if necessary
- **Emergency Contact**: {{emergency_contact_number}}

---

## ✅ Quality Control Checklist

### Installation Quality

#### Workmanship Standards
- [ ] All connections tight (proper torque applied)
- [ ] Wire colors per NEC standards
- [ ] Junction boxes accessible
- [ ] Conduit runs neat and properly supported
- [ ] Devices level and properly mounted
- [ ] Cable protection adequate
- [ ] Equipment grounding complete
- [ ] Working clearances maintained

#### Code Compliance Verification

##### Article 210 - Branch Circuits
- [ ] Circuit loading within limits
- [ ] GFCI protection where required
- [ ] AFCI protection where required  
- [ ] Outlet spacing per code
- [ ] Dedicated circuits installed where required

##### Article 220 - Load Calculations
- [ ] General lighting loads calculated correctly
- [ ] Small appliance circuits adequate
- [ ] Laundry circuit provided
- [ ] Demand factors applied correctly
- [ ] Service size adequate for calculated load

##### Article 250 - Grounding/Bonding
- [ ] Equipment grounding continuous
- [ ] Grounding electrode system complete
- [ ] Bonding jumpers installed where required
- [ ] GEC sized correctly
- [ ] EGC sized correctly for circuits

##### Header 314 - Outlet Boxes
- [ ] Box sizes adequate for conductors
- [ ] Box extensions used where needed
- [ ] Boxes securely fastened
- [ ] Box fill calculations within limits

### Testing Verification

#### Required Tests Completed
- [ ] Continuity of all circuits
- [ ] Insulation resistance ≥ 1 MΩ
- [ ] GFCI devices test/reset properly
- [ ] AFCI devices test/reset properly  
- [ ] Voltage levels within ±5%
- [ ] Voltage drop within limits
- [ ] Proper phase rotation (3Ø systems)
- [ ] Ground fault current path integrity

#### Documentation Complete
- [ ] Test results recorded
- [ ] Panel schedules updated
- [ ] As-built drawings marked up
- [ ] Material certifications collected
- [ ] Inspection reports filed

---

## 📋 Inspection Schedule

### Required Inspections

#### Rough-In Inspection
**Schedule**: After rough-in complete, before drywall
**Inspector**: {{electrical_inspector}}
**Phone**: {{inspector_phone}}

**Required for Inspection:**
- [ ] All rough-in work complete
- [ ] Temporary service operational
- [ ] All boxes installed and secured
- [ ] All conduit/cable installed
- [ ] Grounding system complete
- [ ] Load calculations submitted
- [ ] Plans and permits on site

#### Final Inspection  
**Schedule**: After all work complete
**Inspector**: {{electrical_inspector}}

**Required for Inspection:**
- [ ] All devices and fixtures installed
- [ ] Panel schedule complete and posted
- [ ] All testing complete and documented
- [ ] As-built drawings available
- [ ] Equipment manuals provided to owner
- [ ] AFCI/GFCI devices tested and operational

### Inspection Preparation

#### Documentation Required
- [ ] **Electrical Permit** - Posted and visible
- [ ] **Approved Plans** - Current revision
- [ ] **Load Calculations** - Stamped if required
- [ ] **Panel Schedule** - Complete and accurate
- [ ] **Test Results** - All required testing
- [ ] **Manufacturer Data** - Special equipment
- [ ] **As-Built Drawings** - Field changes marked

#### Common Inspection Issues
- **Box Fill Violations** - Count conductors carefully
- **Working Space** - Maintain NEC 110.26 clearances
- **GFCI/AFCI** - Install per NEC 210.8/210.12
- **Grounding** - Continuous path, proper sizing
- **Support** - Cables/conduits supported per code
- **Protection** - Through metal framing, etc.

---

## 🔧 Troubleshooting Guide

### Common Installation Issues

#### Circuit Issues
**Problem**: Circuit won't energize
**Checks**:
- [ ] Breaker ON and properly seated
- [ ] All connections tight
- [ ] GFCI/AFCI not tripped
- [ ] Continuity through circuit
- [ ] Proper neutral connections

**Problem**: GFCI trips immediately
**Checks**:
- [ ] No neutral-ground connections downstream
- [ ] Load and line wires correct
- [ ] No moisture in connections  
- [ ] Proper wire connections
- [ ] Test with no load connected

#### Voltage Issues
**Problem**: Low voltage at outlets
**Checks**:
- [ ] Connections tight at panel
- [ ] Wire size adequate for load
- [ ] Voltage drop calculations
- [ ] Neutral connections secure
- [ ] Check utility supply voltage

**Problem**: No voltage at device
**Checks**:
- [ ] Circuit breaker operational
- [ ] Continuity through circuit
- [ ] Switch positions (3-way/4-way)
- [ ] GFCI/AFCI status
- [ ] Junction box connections

### Test Equipment Calibration

#### Required Test Equipment
- **Digital Multimeter** - CAT III 600V minimum
- **Voltage Tester** - CAT III 600V minimum  
- **Insulation Tester** - 500V/1000V
- **Ground Resistance Tester** - For electrode testing
- **GFCI Tester** - UL listed
- **Outlet Tester** - 3-wire with GFCI test

#### Calibration Requirements
- [ ] Annual calibration certificates current
- [ ] Daily battery/function checks performed
- [ ] Test leads inspected for damage
- [ ] CAT ratings appropriate for application

---

## 📞 Emergency Contacts

| Contact | Name | Phone | Notes |
|---------|------|-------|-------|
| **Project Manager** | {{pm_name}} | {{pm_phone}} | Primary contact |
| **Electrical Inspector** | {{inspector_name}} | {{inspector_phone}} | Schedule inspections |
| **Utility Company** | {{utility_name}} | {{utility_phone}} | Service/outages |
| **Emergency Services** | 911 | 911 | Fire/medical/police |
| **Poison Control** | | 1-800-222-1222 | Chemical exposure |
| **Electrical Contractor** | {{contractor_name}} | {{contractor_phone}} | After hours |

---

## 📄 Document Control

| Revision | Date | Description | By |
|----------|------|-------------|-----|
| 1.0 | {{creation_date}} | Initial release | {{created_by}} |
| {{revision}} | {{revision_date}} | {{revision_description}} | {{revised_by}} |

**Document Status**: {{document_status}}
**Next Review**: {{next_review_date}}
**Approved By**: {{approved_by}}

---

*This document serves as a comprehensive field guide for electrical installation. Always consult current NEC and local codes for specific requirements. When in doubt, consult with the project engineer or local electrical inspector.*

**⚡ Stay Safe - Work Smart - Follow Code**