import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Chip,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

import { componentsAPI } from '../services/api';

function Components() {
  const [filters, setFilters] = useState({
    category: '',
    search: '',
  });

  const { data: components, isLoading } = useQuery(
    ['components', filters],
    () => componentsAPI.getAll(filters),
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  const { data: categories } = useQuery(
    'component-categories',
    () => componentsAPI.getCategories(),
    {
      select: (response) => response.data,
    }
  );

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
      <Typography variant="h4" component="h1" gutterBottom>
        Electrical Components
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search components..."
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories?.map((category) => (
                  <MenuItem key={category.category} value={category.category}>
                    {category.category} ({category.component_count})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Components Grid */}
      <Grid container spacing={3}>
        {components?.map((component) => (
          <Grid item xs={12} sm={6} md={4} key={component.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="h6" component="h3">
                    {component.name}
                  </Typography>
                  <Chip
                    label={component.category}
                    color="primary"
                    size="small"
                  />
                </Box>

                {component.subcategory && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {component.subcategory}
                  </Typography>
                )}

                {component.description && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {component.description}
                  </Typography>
                )}

                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Unit Cost
                    </Typography>
                    <Typography variant="body1" color="primary" fontWeight="bold">
                      ${component.unit_cost} / {component.unit_type}
                    </Typography>
                  </Grid>
                  {component.neca_labor_unit && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Labor Unit
                      </Typography>
                      <Typography variant="body1">
                        {component.neca_labor_unit} hrs
                      </Typography>
                    </Grid>
                  )}
                </Grid>

                {component.manufacturer && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Manufacturer: {component.manufacturer}
                  </Typography>
                )}

                {component.model_number && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Model: {component.model_number}
                  </Typography>
                )}

                {component.specifications && Object.keys(component.specifications).length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Specifications:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {Object.entries(component.specifications).slice(0, 3).map(([key, value]) => (
                        <Chip
                          key={key}
                          label={`${key}: ${value}`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {components?.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No components found
            </Typography>
            <Typography color="text.secondary">
              Try adjusting your search criteria or check back later.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default Components;