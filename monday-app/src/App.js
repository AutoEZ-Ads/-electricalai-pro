import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import mondaySdk from 'monday-sdk-js';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from 'styled-components';
import { MondayProvider } from 'monday-ui-react-core';

// Import components
import ItemView from './components/ItemView';
import BoardView from './components/BoardView';
import IntegrationView from './components/IntegrationView';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Import services
import { MondayService } from './services/MondayService';
import { N8NService } from './services/N8NService';
import { AuthService } from './services/AuthService';

// Import contexts
import { AppContextProvider } from './contexts/AppContext';
import { AuthContextProvider } from './contexts/AuthContext';

// Import styles
import './App.css';

// Initialize Monday SDK
const monday = mondaySdk();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing ElectricalAI Pro Monday App');
      
      // Initialize Monday SDK
      monday.setToken(process.env.REACT_APP_MONDAY_API_TOKEN);
      
      // Get context from Monday
      const contextData = await monday.get('context');
      console.log('Monday Context:', contextData);
      
      // Get user information
      const userData = await monday.api('query { me { id name email } }');
      console.log('User Data:', userData);
      
      // Get app settings
      const settingsData = await monday.get('settings');
      console.log('App Settings:', settingsData);
      
      // Initialize services
      MondayService.initialize(monday);
      N8NService.initialize({
        baseUrl: settingsData.n8n_instance_url || process.env.REACT_APP_N8N_WEBHOOK_BASE,
        apiKey: settingsData.api_key || process.env.REACT_APP_ELECTRICALAI_API_KEY
      });
      AuthService.initialize(monday);
      
      // Set state
      setContext(contextData.data);
      setUser(userData.data.me);
      setSettings(settingsData.data);
      
      console.log('App initialized successfully');
      
    } catch (error) {
      console.error('App initialization failed:', error);
      setError(error.message || 'Failed to initialize app');
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = (error, errorInfo) => {
    console.error('App Error:', error, errorInfo);
    setError(error.message);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" />
        <p>Initializing ElectricalAI Pro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <h2>Application Error</h2>
        <p>{error}</p>
        <button onClick={initializeApp}>Retry</button>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <QueryClientProvider client={queryClient}>
        <AuthContextProvider user={user}>
          <AppContextProvider 
            context={context} 
            settings={settings}
            monday={monday}
          >
            <Router>
              <div className="app">
                <Routes>
                  {/* Item View - Project Estimator */}
                  <Route 
                    path="/item-view" 
                    element={
                      <ItemView 
                        context={context}
                        settings={settings}
                        monday={monday}
                      />
                    } 
                  />
                  
                  {/* Board View - Estimation Dashboard */}
                  <Route 
                    path="/board-view" 
                    element={
                      <BoardView 
                        context={context}
                        settings={settings}
                        monday={monday}
                      />
                    } 
                  />
                  
                  {/* Integration View - Workflow Configuration */}
                  <Route 
                    path="/integration-view" 
                    element={
                      <IntegrationView 
                        context={context}
                        settings={settings}
                        monday={monday}
                      />
                    } 
                  />
                  
                  {/* Default Route */}
                  <Route 
                    path="/" 
                    element={
                      <ItemView 
                        context={context}
                        settings={settings}
                        monday={monday}
                      />
                    } 
                  />
                </Routes>
              </div>
            </Router>
          </AppContextProvider>
        </AuthContextProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;