import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

import { projectsAPI } from '../services/api';

function ProjectDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: project, isLoading, error } = useQuery(
    ['project', id],
    () => projectsAPI.getById(id),
    {
      select: (response) => response.data,
    }
  );

  const startEstimationMutation = useMutation(
    (data) => projectsAPI.startEstimation(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project', id]);
        toast.success('Estimation started successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to start estimation');
      },
    }
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'calculating': return 'warning';
      case 'completed': return 'success';
      case 'approved': return 'primary';
      default: return 'default';
    }
  };

  const handleStartEstimation = () => {
    startEstimationMutation.mutate({
      estimation_type: 'full'
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load project details
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {project.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={project.status?.charAt(0).toUpperCase() + project.status?.slice(1)}
              color={getStatusColor(project.status)}
            />
            <Typography color="text.secondary">
              {project.building_type?.charAt(0).toUpperCase() + project.building_type?.slice(1)}
            </Typography>
          </Box>
        </Box>
        
        {project.status !== 'calculating' && (
          <Button
            variant="contained"
            startIcon={<StartIcon />}
            onClick={handleStartEstimation}
            disabled={startEstimationMutation.isLoading}
          >
            {startEstimationMutation.isLoading ? 'Starting...' : 'Start Estimation'}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Project Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Information
              </Typography>
              
              {project.description && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {project.description}
                  </Typography>
                </Box>
              )}

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Square Footage
                  </Typography>
                  <Typography variant="body1">
                    {project.square_footage ? `${project.square_footage.toLocaleString()} sq ft` : 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Floors
                  </Typography>
                  <Typography variant="body1">
                    {project.floors}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {new Date(project.created_at).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>

              {project.client_name && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Client Information
                  </Typography>
                  <Typography variant="body1">
                    {project.client_name}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>

          {/* Components */}
          {project.components && project.components.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Components ({project.components.length})
                </Typography>
                <Grid container spacing={2}>
                  {project.components.map((component, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2">
                          {component.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {component.category}
                        </Typography>
                        <Typography variant="body2">
                          Qty: {component.quantity} {component.unit_type}
                        </Typography>
                        {component.total_material_cost && (
                          <Typography variant="body2" color="primary">
                            ${component.total_material_cost}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Estimation Results */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estimation Results
              </Typography>

              {project.total_cost ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" color="primary">
                      ${project.total_cost.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Project Cost
                    </Typography>
                  </Box>

                  {project.confidence_score && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6">
                        {project.confidence_score}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Confidence Score
                      </Typography>
                    </Box>
                  )}

                  <Typography variant="body2" color="text.secondary">
                    Estimation completed on{' '}
                    {new Date(project.estimation_completed_at).toLocaleDateString()}
                  </Typography>
                </>
              ) : project.status === 'calculating' ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <LinearProgress sx={{ mb: 2 }} />
                  <Typography variant="body1">
                    Estimation in progress...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This may take a few minutes
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    No estimation available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start an estimation to see results
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Compliance Checks */}
          {project.compliance_checks && project.compliance_checks.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  NEC Compliance
                </Typography>
                {project.compliance_checks.slice(0, 5).map((check, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">
                        {check.description}
                      </Typography>
                      <Chip
                        label={check.status.toUpperCase()}
                        color={check.status === 'pass' ? 'success' : check.status === 'fail' ? 'error' : 'warning'}
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default ProjectDetail;