import React from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';

import { projectsAPI } from '../services/api';

function Dashboard() {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery(
    'recent-projects',
    () => projectsAPI.getAll({ limit: 5 }),
    {
      select: (response) => response.data,
    }
  );

  const stats = [
    {
      title: 'Total Projects',
      value: projects?.pagination?.total || 0,
      icon: <AssignmentIcon />,
      color: 'primary',
    },
    {
      title: 'Active Estimations',
      value: projects?.projects?.filter(p => p.status === 'calculating').length || 0,
      icon: <CalculateIcon />,
      color: 'warning',
    },
    {
      title: 'Completed',
      value: projects?.projects?.filter(p => p.status === 'completed').length || 0,
      icon: <TrendingUpIcon />,
      color: 'success',
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'calculating': return 'warning';
      case 'completed': return 'success';
      case 'approved': return 'primary';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/projects/new')}
        >
          New Project
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 1,
                      bgcolor: `${stat.color}.light`,
                      color: `${stat.color}.main`,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                    <Typography color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Projects */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              Recent Projects
            </Typography>
            <Button
              variant="outlined"
              onClick={() => navigate('/projects')}
            >
              View All
            </Button>
          </Box>

          {projects?.projects?.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary" gutterBottom>
                No projects yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/projects/new')}
              >
                Create Your First Project
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {projects?.projects?.map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project.id}>
                  <Card variant="outlined" sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${project.id}`)}>
                    <CardContent>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {project.name}
                      </Typography>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                        {project.building_type} • {project.square_footage || 'N/A'} sq ft
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                        <Chip
                          label={project.status}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
                        {project.total_cost && (
                          <Typography variant="body2" color="primary">
                            ${project.total_cost.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default Dashboard;