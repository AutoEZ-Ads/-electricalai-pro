import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    Typography,
    TextField,
    Button,
    Grid,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Box,
    Chip,
    Paper,
    List,
    ListItem,
    ListItemText,
    Divider,
    LinearProgress
} from '@mui/material';
import { 
    FlashOn as VoltageIcon,
    Security as SafetyIcon,
    Balance as LoadIcon,
    CheckCircle as ComplianceIcon,
    Calculate as CalculateIcon,
    Warning as WarningIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import apiService from '../services/api';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`ai-tabpanel-${index}`}
            aria-labelledby={`ai-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const AICalculations = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    // Voltage Drop Calculator State
    const [voltageDropData, setVoltageDropData] = useState({
        conductor_awg: '12',
        conductor_material: 'copper',
        length_feet: 100,
        current_amps: 15,
        voltage: 120,
        power_factor: 0.9
    });

    // Arc Flash Analysis State
    const [arcFlashData, setArcFlashData] = useState({
        system_voltage_kv: 0.48,
        bolted_fault_current_ka: 25,
        arc_duration_sec: 0.5,
        working_distance_mm: 610,
        gap_mm: 25,
        electrode_config: 'VCB',
        equipment_type: 'switchgear'
    });

    // NEC Compliance State
    const [necComplianceData, setNecComplianceData] = useState({
        circuits: [
            {
                circuit_id: 'CIRCUIT_001',
                circuit_type: 'branch_circuit',
                voltage: 120,
                amperage: 20,
                conductor_awg: '12',
                conductor_material: 'copper',
                loads: [
                    {
                        load_id: 'LOAD_001',
                        load_type: 'lighting_general',
                        power_rating_va: 1200,
                        room_type: 'living_room',
                        location_type: 'dwelling_unit'
                    }
                ],
                gfci_protected: true,
                afci_protected: true
            }
        ],
        building_area_sqft: 2000
    });

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setResults(null);
        setError(null);
    };

    const calculateVoltageDropAI = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await apiService.post('/ai/voltage-drop', voltageDropData);
            setResults(response.data);
        } catch (error) {
            setError('Voltage drop calculation failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateArcFlashAI = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await apiService.post('/ai/arc-flash', arcFlashData);
            setResults(response.data);
        } catch (error) {
            setError('Arc flash analysis failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const analyzeNECCompliance = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await apiService.post('/ai/nec-compliance', necComplianceData);
            setResults(response.data);
        } catch (error) {
            setError('NEC compliance analysis failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const performComprehensiveAnalysis = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const comprehensiveData = {
                project_id: 'DEMO_PROJECT',
                circuits: necComplianceData.circuits,
                building_area_sqft: necComplianceData.building_area_sqft,
                electrical_loads: necComplianceData.circuits[0].loads
            };
            
            const response = await apiService.post('/ai/comprehensive-analysis', comprehensiveData);
            setResults(response.data);
        } catch (error) {
            setError('Comprehensive analysis failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderVoltageDropResults = () => {
        if (!results || !results.results) return null;
        
        const { results: data } = results;
        
        return (
            <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                    <VoltageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Voltage Drop Analysis Results
                </Typography>
                
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1" color="primary">Classical Calculation</Typography>
                                <Typography variant="h4">{data.voltage_drop_percent?.toFixed(3)}%</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {data.voltage_drop_volts?.toFixed(2)}V drop
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {data.power_loss_watts?.toFixed(1)}W loss
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1" color="secondary">AI Prediction</Typography>
                                <Typography variant="h4">{(data.ai_prediction?.voltage_drop_volts / voltageDropData.voltage * 100)?.toFixed(3)}%</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Confidence: {data.ai_prediction?.confidence_score?.toFixed(1)}%
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Efficiency: {(data.ai_prediction?.efficiency * 100)?.toFixed(1)}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom>Compliance Status</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <Chip 
                                icon={<ComplianceIcon />}
                                label={data.compliance?.nec_compliant ? "NEC Compliant" : "NEC Non-Compliant"}
                                color={data.compliance?.nec_compliant ? "success" : "error"}
                            />
                            <Chip 
                                icon={<SafetyIcon />}
                                label={data.compliance?.ampacity_compliant ? "Ampacity OK" : "Ampacity Exceeded"}
                                color={data.compliance?.ampacity_compliant ? "success" : "error"}
                            />
                        </Box>
                        
                        <Typography variant="subtitle2" gutterBottom>Recommendations:</Typography>
                        <List dense>
                            {data.recommendations?.map((rec, index) => (
                                <ListItem key={index}>
                                    <InfoIcon sx={{ mr: 1, fontSize: 16 }} />
                                    <ListItemText primary={rec} />
                                </ListItem>
                            ))}
                        </List>
                    </Grid>
                </Grid>
            </Paper>
        );
    };

    const renderArcFlashResults = () => {
        if (!results || !results.results) return null;
        
        const { results: data } = results;
        
        return (
            <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                    <SafetyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Arc Flash Hazard Analysis Results
                </Typography>
                
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ bgcolor: data.ppe_category >= 3 ? 'error.light' : data.ppe_category >= 2 ? 'warning.light' : 'success.light' }}>
                            <CardContent>
                                <Typography variant="subtitle1">Incident Energy</Typography>
                                <Typography variant="h4">{data.incident_energy_cal_cm2?.toFixed(2)}</Typography>
                                <Typography variant="body2">cal/cm²</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">PPE Category</Typography>
                                <Typography variant="h4">{data.ppe_category}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {data.hazard_category}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Arc Flash Boundary</Typography>
                                <Typography variant="h4">{(data.arc_flash_boundary_mm / 1000)?.toFixed(2)}</Typography>
                                <Typography variant="body2">meters</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom>Required PPE</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {data.required_ppe?.map((ppe, index) => (
                                <Chip key={index} label={ppe.replace('_', ' ')} color="warning" />
                            ))}
                        </Box>
                        
                        <Typography variant="subtitle2" gutterBottom>Safety Recommendations:</Typography>
                        <List dense>
                            {results.safety_recommendations?.map((rec, index) => (
                                <ListItem key={index}>
                                    <WarningIcon color="warning" sx={{ mr: 1, fontSize: 16 }} />
                                    <ListItemText primary={rec} />
                                </ListItem>
                            ))}
                        </List>
                    </Grid>
                </Grid>
            </Paper>
        );
    };

    const renderNECComplianceResults = () => {
        if (!results || !results.results) return null;
        
        const { results: data } = results;
        const complianceScore = results.compliance_score || 0;
        
        return (
            <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                    <ComplianceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    NEC Compliance Analysis Results
                </Typography>
                
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Overall Compliance Score</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                    <Box sx={{ width: '100%', mr: 1 }}>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={complianceScore} 
                                            color={complianceScore >= 80 ? 'success' : complianceScore >= 60 ? 'warning' : 'error'}
                                            sx={{ height: 10, borderRadius: 5 }}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: 35 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {`${Math.round(complianceScore)}%`}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Summary Statistics</Typography>
                                <Typography variant="body2">
                                    Total Circuits: {data.summary_statistics?.total_circuits}
                                </Typography>
                                <Typography variant="body2" color="success.main">
                                    Compliant: {data.summary_statistics?.compliant_circuits}
                                </Typography>
                                <Typography variant="body2" color="error.main">
                                    Non-Compliant: {data.summary_statistics?.non_compliant_circuits}
                                </Typography>
                                <Typography variant="body2" color="warning.main">
                                    Critical Violations: {data.summary_statistics?.critical_violations}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom>Priority Actions</Typography>
                        <List>
                            {results.priority_actions?.slice(0, 5).map((action, index) => (
                                <React.Fragment key={index}>
                                    <ListItem>
                                        <ComplianceIcon color={index < 2 ? 'error' : 'warning'} sx={{ mr: 1 }} />
                                        <ListItemText 
                                            primary={action}
                                            secondary={`Priority ${index + 1}`}
                                        />
                                    </ListItem>
                                    {index < 4 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Grid>
                </Grid>
            </Paper>
        );
    };

    const renderComprehensiveResults = () => {
        if (!results || !results.results) return null;
        
        const { results: data } = results;
        
        return (
            <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                    <CalculateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Comprehensive Electrical Analysis Results
                </Typography>
                
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Overall Risk Level</Typography>
                                <Typography 
                                    variant="h4" 
                                    color={data.risk_level === 'Low' ? 'success.main' : data.risk_level === 'Medium' ? 'warning.main' : 'error.main'}
                                >
                                    {data.risk_level}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Risk Score: {data.overall_risk_score}/100
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Analysis Summary</Typography>
                                <Typography variant="body2">
                                    Circuits: {data.analysis_summary?.total_circuits}
                                </Typography>
                                <Typography variant="body2">
                                    Loads: {data.analysis_summary?.total_loads}
                                </Typography>
                                <Typography variant="body2">
                                    Voltage Drops Analyzed: {data.voltage_drop_analysis?.length}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1">Compliance Status</Typography>
                                <Typography variant="body2">
                                    NEC Compliant: {data.nec_compliance_results?.compliant_circuits || 0}
                                </Typography>
                                <Typography variant="body2" color="error.main">
                                    Violations: {data.nec_compliance_results?.critical_violations || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom>Risk Assessment</Typography>
                        
                        {data.risk_assessment?.compliance_risks?.length > 0 && (
                            <>
                                <Typography variant="subtitle2" color="error.main" gutterBottom>
                                    Compliance Risks:
                                </Typography>
                                <List dense>
                                    {data.risk_assessment.compliance_risks.map((risk, index) => (
                                        <ListItem key={index}>
                                            <WarningIcon color="error" sx={{ mr: 1, fontSize: 16 }} />
                                            <ListItemText primary={risk} />
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        )}
                        
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                            Recommendations:
                        </Typography>
                        <List dense>
                            {data.recommendations?.map((rec, index) => (
                                <ListItem key={index}>
                                    <InfoIcon color="primary" sx={{ mr: 1, fontSize: 16 }} />
                                    <ListItemText primary={rec} />
                                </ListItem>
                            ))}
                        </List>
                    </Grid>
                </Grid>
            </Paper>
        );
    };

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                AI-Powered Electrical Calculations
            </Typography>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Advanced electrical analysis using Physics-Informed Neural Networks and IEEE standards
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab icon={<VoltageIcon />} label="Voltage Drop" />
                    <Tab icon={<SafetyIcon />} label="Arc Flash" />
                    <Tab icon={<ComplianceIcon />} label="NEC Compliance" />
                    <Tab icon={<CalculateIcon />} label="Comprehensive" />
                </Tabs>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Voltage Drop Tab */}
            <TabPanel value={activeTab} index={0}>
                <Card>
                    <CardHeader 
                        title="Physics-Informed Neural Network Voltage Drop Calculator"
                        subheader="±2% accuracy with NEC compliance checking"
                    />
                    <CardContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Conductor AWG"
                                    value={voltageDropData.conductor_awg}
                                    onChange={(e) => setVoltageDropData({...voltageDropData, conductor_awg: e.target.value})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Length (feet)"
                                    type="number"
                                    value={voltageDropData.length_feet}
                                    onChange={(e) => setVoltageDropData({...voltageDropData, length_feet: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Current (amps)"
                                    type="number"
                                    value={voltageDropData.current_amps}
                                    onChange={(e) => setVoltageDropData({...voltageDropData, current_amps: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Voltage"
                                    type="number"
                                    value={voltageDropData.voltage}
                                    onChange={(e) => setVoltageDropData({...voltageDropData, voltage: parseInt(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    onClick={calculateVoltageDropAI}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
                                    size="large"
                                >
                                    {loading ? 'Calculating...' : 'Calculate Voltage Drop'}
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {activeTab === 0 && renderVoltageDropResults()}
                    </CardContent>
                </Card>
            </TabPanel>

            {/* Arc Flash Tab */}
            <TabPanel value={activeTab} index={1}>
                <Card>
                    <CardHeader 
                        title="IEEE 1584-2018 Arc Flash Hazard Analysis"
                        subheader="92-95% accuracy with PPE verification"
                    />
                    <CardContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="System Voltage (kV)"
                                    type="number"
                                    step="0.01"
                                    value={arcFlashData.system_voltage_kv}
                                    onChange={(e) => setArcFlashData({...arcFlashData, system_voltage_kv: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Fault Current (kA)"
                                    type="number"
                                    value={arcFlashData.bolted_fault_current_ka}
                                    onChange={(e) => setArcFlashData({...arcFlashData, bolted_fault_current_ka: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Working Distance (mm)"
                                    type="number"
                                    value={arcFlashData.working_distance_mm}
                                    onChange={(e) => setArcFlashData({...arcFlashData, working_distance_mm: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Conductor Gap (mm)"
                                    type="number"
                                    value={arcFlashData.gap_mm}
                                    onChange={(e) => setArcFlashData({...arcFlashData, gap_mm: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    onClick={calculateArcFlashAI}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <SafetyIcon />}
                                    size="large"
                                    color="warning"
                                >
                                    {loading ? 'Analyzing...' : 'Analyze Arc Flash Hazard'}
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {activeTab === 1 && renderArcFlashResults()}
                    </CardContent>
                </Card>
            </TabPanel>

            {/* NEC Compliance Tab */}
            <TabPanel value={activeTab} index={2}>
                <Card>
                    <CardHeader 
                        title="NEC 2023 Compliance Analysis"
                        subheader="Automated checking of Articles 210, 215, and 220"
                    />
                    <CardContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Building Area (sq ft)"
                                    type="number"
                                    value={necComplianceData.building_area_sqft}
                                    onChange={(e) => setNecComplianceData({...necComplianceData, building_area_sqft: parseFloat(e.target.value)})}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Number of Circuits"
                                    type="number"
                                    value={necComplianceData.circuits.length}
                                    disabled
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="body2" color="textSecondary">
                                    This demo analyzes a sample circuit configuration. In production, 
                                    you would input your complete electrical design.
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    onClick={analyzeNECCompliance}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <ComplianceIcon />}
                                    size="large"
                                    color="success"
                                >
                                    {loading ? 'Analyzing...' : 'Analyze NEC Compliance'}
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {activeTab === 2 && renderNECComplianceResults()}
                    </CardContent>
                </Card>
            </TabPanel>

            {/* Comprehensive Analysis Tab */}
            <TabPanel value={activeTab} index={3}>
                <Card>
                    <CardHeader 
                        title="Comprehensive Electrical Analysis"
                        subheader="Multi-AI system analysis with risk assessment"
                    />
                    <CardContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Alert severity="info">
                                    This comprehensive analysis combines all AI models to provide:
                                    <ul>
                                        <li>Voltage drop analysis for all circuits</li>
                                        <li>NEC compliance checking</li>
                                        <li>Risk assessment and prioritized recommendations</li>
                                        <li>Performance optimization opportunities</li>
                                    </ul>
                                </Alert>
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    onClick={performComprehensiveAnalysis}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
                                    size="large"
                                    color="primary"
                                >
                                    {loading ? 'Analyzing...' : 'Perform Comprehensive Analysis'}
                                </Button>
                            </Grid>
                        </Grid>
                        
                        {activeTab === 3 && renderComprehensiveResults()}
                    </CardContent>
                </Card>
            </TabPanel>
        </div>
    );
};

export default AICalculations;