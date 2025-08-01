import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import { projectsAPI } from '../services/api';

function ProjectList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: '',
    building_type: '',
    search: '',
  });

  const { data: projectsData, isLoading } = useQuery(
    ['projects', filters],
    () => projectsAPI.getAll(filters),
    {
      select: (response) => response.data,
      keepPreviousData: true,
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

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/projects/new')}
        >
          New Project
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search projects..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="calculating">Calculating</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Building Type"
                value={filters.building_type}
                onChange={(e) => handleFilterChange('building_type', e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="residential">Residential</MenuItem>
                <MenuItem value="commercial">Commercial</MenuItem>
                <MenuItem value="industrial">Industrial</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {projectsData?.projects?.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No projects found
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first project to get started with electrical estimation.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/projects/new')}
            >
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projectsData?.projects?.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { 
                    boxShadow: (theme) => theme.shadows[4] 
                  } 
                }}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardContent>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {project.name}
                  </Typography>
                  
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                    {project.building_type?.charAt(0).toUpperCase() + 
                     project.building_type?.slice(1)}
                    {project.square_footage && ` • ${project.square_footage.toLocaleString()} sq ft`}
                  </Typography>

                  {project.description && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {project.description.length > 100 
                        ? `${project.description.substring(0, 100)}...`
                        : project.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Chip
                      label={project.status?.charAt(0).toUpperCase() + project.status?.slice(1)}
                      color={getStatusColor(project.status)}
                      size="small"
                    />
                    {project.total_cost && (
                      <Typography variant="body2" color="primary" fontWeight="bold">
                        ${project.total_cost.toLocaleString()}
                      </Typography>
                    )}
                  </Box>

                  {project.client_name && (
                    <Typography variant="caption" color="text.secondary">
                      Client: {project.client_name}
                    </Typography>
                  )}

                  <Typography variant="caption" color="text.secondary" display="block">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination Info */}
      {projectsData?.pagination && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {projectsData.projects.length} of {projectsData.pagination.total} projects
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default ProjectList;