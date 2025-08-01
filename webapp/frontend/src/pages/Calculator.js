import React, { useState } from 'react';
import { useMutation } from 'react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Grid,
  Alert,
  Divider,
} from '@mui/material';
import { Calculate as CalculateIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';

import { calculationsAPI } from '../services/api';

const calculationTypes = [
  { value: 'load', label: 'Load Calculation' },
  { value: 'wire', label: 'Wire Sizing' },
  { value: 'conduit', label: 'Conduit Fill' },
  { value: 'voltageDrop', label: 'Voltage Drop' },
  { value: 'panel', label: 'Panel Sizing' },
  { value: 'service', label: 'Service Sizing' },
  { value: 'circuit', label: 'Circuit Analysis' },
];

function Calculator() {
  const [calculationType, setCalculationType] = useState('load');
  const [parameters, setParameters] = useState({
    area: '',
    buildingType: 'residential',
    current: '',
    distance: '',
    voltage: 120,
    phaseType: 'single',
    conduitSize: 0.5,
    wireSizes: '',
    temperatureFactor: 1.0,
    deratingFactor: 1.0,
  });
  const [result, setResult] = useState(null);

  const calculationMutation = useMutation(
    ({ type, params }) => calculationsAPI.direct(type, params),
    {
      onSuccess: (response) => {
        setResult(response.data);
        toast.success('Calculation completed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Calculation failed');
      },
    }
  );

  const handleParameterChange = (field, value) => {
    setParameters(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    // Validate required parameters based on calculation type
    const requiredFields = getRequiredFields(calculationType);
    const missingFields = requiredFields.filter(field => !parameters[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    calculationMutation.mutate({
      type: calculationType,
      params: parameters,
    });
  };

  const getRequiredFields = (type) => {
    switch (type) {
      case 'load':
      case 'service':
        return ['area', 'buildingType'];
      case 'wire':
      case 'voltageDrop':
      case 'circuit':
        return ['current', 'distance', 'voltage'];
      case 'conduit':
        return ['conduitSize', 'wireSizes'];
      case 'panel':
        return [];
      default:
        return [];
    }
  };

  const renderParameterFields = () => {
    const fields = [];

    // Common fields for load/service calculations
    if (['load', 'service'].includes(calculationType)) {
      fields.push(
        <Grid item xs={12} md={6} key="area">
          <TextField
            fullWidth
            label="Area (Square Feet)"
            type="number"
            value={parameters.area}
            onChange={(e) => handleParameterChange('area', e.target.value)}
          />
        </Grid>,
        <Grid item xs={12} md={6} key="buildingType">
          <TextField
            fullWidth
            select
            label="Building Type"
            value={parameters.buildingType}
            onChange={(e) => handleParameterChange('buildingType', e.target.value)}
          >
            <MenuItem value="residential">Residential</MenuItem>
            <MenuItem value="commercial">Commercial</MenuItem>
            <MenuItem value="industrial">Industrial</MenuItem>
          </TextField>
        </Grid>
      );
    }

    // Common fields for wire/voltage drop/circuit calculations
    if (['wire', 'voltageDrop', 'circuit'].includes(calculationType)) {
      fields.push(
        <Grid item xs={12} md={6} key="current">
          <TextField
            fullWidth
            label="Current (Amperes)"
            type="number"
            value={parameters.current}
            onChange={(e) => handleParameterChange('current', e.target.value)}
          />
        </Grid>,
        <Grid item xs={12} md={6} key="distance">
          <TextField
            fullWidth
            label="Distance (Feet)"
            type="number"
            value={parameters.distance}
            onChange={(e) => handleParameterChange('distance', e.target.value)}
          />
        </Grid>
      );
    }

    // Voltage and phase for electrical calculations
    if (['wire', 'voltageDrop', 'circuit', 'load'].includes(calculationType)) {
      fields.push(
        <Grid item xs={12} md={6} key="voltage">
          <TextField
            fullWidth
            select
            label="Voltage"
            value={parameters.voltage}
            onChange={(e) => handleParameterChange('voltage', parseInt(e.target.value))}
          >
            <MenuItem value={120}>120V</MenuItem>
            <MenuItem value={240}>240V</MenuItem>
            <MenuItem value={277}>277V</MenuItem>
            <MenuItem value={480}>480V</MenuItem>
          </TextField>
        </Grid>,
        <Grid item xs={12} md={6} key="phaseType">
          <TextField
            fullWidth
            select
            label="Phase Type"
            value={parameters.phaseType}
            onChange={(e) => handleParameterChange('phaseType', e.target.value)}
          >
            <MenuItem value="single">Single Phase</MenuItem>
            <MenuItem value="three">Three Phase</MenuItem>
          </TextField>
        </Grid>
      );
    }

    // Conduit fill specific fields
    if (calculationType === 'conduit') {
      fields.push(
        <Grid item xs={12} md={6} key="conduitSize">
          <TextField
            fullWidth
            select
            label="Conduit Size"
            value={parameters.conduitSize}
            onChange={(e) => handleParameterChange('conduitSize', parseFloat(e.target.value))}
          >
            <MenuItem value={0.5}>1/2"</MenuItem>
            <MenuItem value={0.75}>3/4"</MenuItem>
            <MenuItem value={1.0}>1"</MenuItem>
            <MenuItem value={1.25}>1-1/4"</MenuItem>
            <MenuItem value={1.5}>1-1/2"</MenuItem>
            <MenuItem value={2.0}>2"</MenuItem>
            <MenuItem value={2.5}>2-1/2"</MenuItem>
            <MenuItem value={3.0}>3"</MenuItem>
            <MenuItem value={4.0}>4"</MenuItem>
          </TextField>
        </Grid>,
        <Grid item xs={12} md={6} key="wireSizes">
          <TextField
            fullWidth
            label="Wire Sizes (AWG, comma-separated)"
            placeholder="12,12,14,14"
            value={parameters.wireSizes}
            onChange={(e) => handleParameterChange('wireSizes', e.target.value)}
          />
        </Grid>
      );
    }

    return fields;
  };

  const renderResults = () => {
    if (!result) return null;

    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Calculation Results
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(result.result).map(([key, value]) => {
              if (typeof value === 'object') return null;
              if (key === 'calculationType' || key === 'timestamp' || key === 'inputData') return null;
              
              return (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Typography>
                    <Typography variant="body1">
                      {typeof value === 'number' ? value.toLocaleString() : value.toString()}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>

          {result.result.recommendations && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Recommendations
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(result.result.recommendations).map(([key, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="primary.contrastText">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Typography>
                      <Typography variant="body1" color="primary.contrastText">
                        {value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Electrical Calculator
      </Typography>

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Calculation Type"
                value={calculationType}
                onChange={(e) => {
                  setCalculationType(e.target.value);
                  setResult(null);
                }}
              >
                {calculationTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {renderParameterFields()}

            <Grid item xs={12}>
              <Button
                variant="contained"
                size="large"
                startIcon={<CalculateIcon />}
                onClick={handleCalculate}
                disabled={calculationMutation.isLoading}
              >
                {calculationMutation.isLoading ? 'Calculating...' : 'Calculate'}
              </Button>
            </Grid>
          </Grid>

          {calculationMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {calculationMutation.error.response?.data?.message || 'Calculation failed'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {renderResults()}
    </Box>
  );
}

export default Calculator;