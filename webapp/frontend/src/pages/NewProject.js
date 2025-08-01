import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
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
} from '@mui/material';
import toast from 'react-hot-toast';

import { projectsAPI } from '../services/api';

const validationSchema = Yup.object({
  name: Yup.string()
    .required('Project name is required')
    .min(2, 'Project name must be at least 2 characters'),
  description: Yup.string(),
  building_type: Yup.string()
    .required('Building type is required')
    .oneOf(['residential', 'commercial', 'industrial']),
  square_footage: Yup.number()
    .positive('Square footage must be positive')
    .integer('Square footage must be a whole number'),
  floors: Yup.number()
    .positive('Number of floors must be positive')
    .integer('Number of floors must be a whole number')
    .max(50, 'Maximum 50 floors allowed'),
  client_name: Yup.string(),
});

const initialValues = {
  name: '',
  description: '',
  building_type: '',
  square_footage: '',
  floors: 1,
  client_name: '',
  client_contact: {
    email: '',
    phone: '',
  },
  project_specifications: {
    bedrooms: '',
    bathrooms: '',
    garage: false,
    basement: false,
  },
};

function NewProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createProjectMutation = useMutation(projectsAPI.create, {
    onSuccess: (response) => {
      queryClient.invalidateQueries('projects');
      toast.success('Project created successfully');
      navigate(`/projects/${response.data.id}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create project');
    },
  });

  const handleSubmit = (values, { setSubmitting }) => {
    // Clean up the data
    const projectData = {
      ...values,
      square_footage: values.square_footage ? parseInt(values.square_footage) : null,
      floors: parseInt(values.floors),
      client_contact: values.client_contact.email || values.client_contact.phone 
        ? values.client_contact 
        : null,
      project_specifications: Object.keys(values.project_specifications).some(
        key => values.project_specifications[key]
      ) ? values.project_specifications : null,
    };

    createProjectMutation.mutate(projectData, {
      onSettled: () => setSubmitting(false),
    });
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Project
      </Typography>

      <Card>
        <CardContent>
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
              <Form>
                <Grid container spacing={3}>
                  {/* Basic Information */}
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="name"
                      label="Project Name"
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.name && !!errors.name}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="building_type"
                      label="Building Type"
                      select
                      value={values.building_type}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.building_type && !!errors.building_type}
                      helperText={touched.building_type && errors.building_type}
                    >
                      <MenuItem value="residential">Residential</MenuItem>
                      <MenuItem value="commercial">Commercial</MenuItem>
                      <MenuItem value="industrial">Industrial</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="description"
                      label="Description"
                      multiline
                      rows={3}
                      value={values.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.description && !!errors.description}
                      helperText={touched.description && errors.description}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="square_footage"
                      label="Square Footage"
                      type="number"
                      value={values.square_footage}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.square_footage && !!errors.square_footage}
                      helperText={touched.square_footage && errors.square_footage}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="floors"
                      label="Number of Floors"
                      type="number"
                      value={values.floors}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.floors && !!errors.floors}
                      helperText={touched.floors && errors.floors}
                    />
                  </Grid>

                  {/* Client Information */}
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Client Information
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="client_name"
                      label="Client Name"
                      value={values.client_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="client_contact.email"
                      label="Client Email"
                      type="email"
                      value={values.client_contact.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="client_contact.phone"
                      label="Client Phone"
                      value={values.client_contact.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>

                  {/* Residential Specifications */}
                  {values.building_type === 'residential' && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                          Residential Specifications
                        </Typography>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          name="project_specifications.bedrooms"
                          label="Bedrooms"
                          type="number"
                          value={values.project_specifications.bedrooms}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          name="project_specifications.bathrooms"
                          label="Bathrooms"
                          type="number"
                          value={values.project_specifications.bathrooms}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </Grid>
                    </>
                  )}

                  {/* Submit Buttons */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isSubmitting}
                        size="large"
                      >
                        {isSubmitting ? 'Creating...' : 'Create Project'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/projects')}
                        disabled={isSubmitting}
                        size="large"
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {createProjectMutation.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {createProjectMutation.error.response?.data?.message || 
                     'Failed to create project. Please try again.'}
                  </Alert>
                )}
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>
    </Box>
  );
}

export default NewProject;