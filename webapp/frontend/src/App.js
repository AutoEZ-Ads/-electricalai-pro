import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';

// Import components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import NewProject from './pages/NewProject';
import Calculator from './pages/Calculator';
import Components from './pages/Components';
import AICalculations from './pages/AICalculations';
import ElectricalEstimatorSuperAgent from './components/ElectricalEstimatorSuperAgent';

function App() {
  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/components" element={<Components />} />
          <Route path="/ai-calculations" element={<AICalculations />} />
          <Route path="/super-agent" element={<ElectricalEstimatorSuperAgent />} />
        </Routes>
      </Container>
    </Layout>
  );
}

export default App;