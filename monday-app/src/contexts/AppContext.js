import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state
const initialState = {
  // App configuration
  context: null,
  settings: null,
  monday: null,
  
  // User information
  user: null,
  
  // Current project data
  currentProject: null,
  
  // Workflow status
  workflowStatus: {
    estimation: 'idle',
    floorPlan: 'idle',
    compliance: 'idle',
    materialCost: 'idle',
    progress: 'idle'
  },
  
  // UI state
  loading: false,
  error: null,
  notifications: [],
  
  // N8N integration
  n8nConnected: false,
  n8nConfig: {
    baseUrl: '',
    apiKey: '',
    enabled: false
  },
  
  // Recent activity
  recentActivity: [],
  
  // Performance metrics
  metrics: {
    totalEstimations: 0,
    averageAccuracy: 0,
    totalCostSaved: 0,
    processingTime: 0
  }
};

// Action types
const ActionTypes = {
  SET_CONTEXT: 'SET_CONTEXT',
  SET_SETTINGS: 'SET_SETTINGS',
  SET_MONDAY: 'SET_MONDAY',
  SET_USER: 'SET_USER',
  SET_CURRENT_PROJECT: 'SET_CURRENT_PROJECT',
  UPDATE_WORKFLOW_STATUS: 'UPDATE_WORKFLOW_STATUS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
  SET_N8N_CONNECTION: 'SET_N8N_CONNECTION',
  SET_N8N_CONFIG: 'SET_N8N_CONFIG',
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  UPDATE_METRICS: 'UPDATE_METRICS',
  RESET_STATE: 'RESET_STATE'
};

// Reducer function
const appReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CONTEXT:
      return {
        ...state,
        context: action.payload
      };
      
    case ActionTypes.SET_SETTINGS:
      return {
        ...state,
        settings: action.payload
      };
      
    case ActionTypes.SET_MONDAY:
      return {
        ...state,
        monday: action.payload
      };
      
    case ActionTypes.SET_USER:
      return {
        ...state,
        user: action.payload
      };
      
    case ActionTypes.SET_CURRENT_PROJECT:
      return {
        ...state,
        currentProject: action.payload
      };
      
    case ActionTypes.UPDATE_WORKFLOW_STATUS:
      return {
        ...state,
        workflowStatus: {
          ...state.workflowStatus,
          [action.payload.workflow]: action.payload.status
        }
      };
      
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload
      };
      
    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            id: action.payload.id || Date.now(),
            type: action.payload.type || 'info',
            message: action.payload.message,
            timestamp: Date.now(),
            ...action.payload
          }
        ]
      };
      
    case ActionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(
          notification => notification.id !== action.payload
        )
      };
      
    case ActionTypes.CLEAR_NOTIFICATIONS:
      return {
        ...state,
        notifications: []
      };
      
    case ActionTypes.SET_N8N_CONNECTION:
      return {
        ...state,
        n8nConnected: action.payload
      };
      
    case ActionTypes.SET_N8N_CONFIG:
      return {
        ...state,
        n8nConfig: {
          ...state.n8nConfig,
          ...action.payload
        }
      };
      
    case ActionTypes.ADD_ACTIVITY:
      return {
        ...state,
        recentActivity: [
          action.payload,
          ...state.recentActivity.slice(0, 49) // Keep last 50 activities
        ]
      };
      
    case ActionTypes.UPDATE_METRICS:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          ...action.payload
        }
      };
      
    case ActionTypes.RESET_STATE:
      return initialState;
      
    default:
      return state;
  }
};

// Create contexts
const AppStateContext = createContext();
const AppDispatchContext = createContext();

// Custom hooks
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppContextProvider');
  }
  return context;
};

export const useAppDispatch = () => {
  const context = useContext(AppDispatchContext);
  if (!context) {
    throw new Error('useAppDispatch must be used within AppContextProvider');
  }
  return context;
};

export const useAppContext = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  
  return {
    ...state,
    dispatch,
    
    // Action creators
    setContext: (context) => dispatch({ type: ActionTypes.SET_CONTEXT, payload: context }),
    setSettings: (settings) => dispatch({ type: ActionTypes.SET_SETTINGS, payload: settings }),
    setMonday: (monday) => dispatch({ type: ActionTypes.SET_MONDAY, payload: monday }),
    setUser: (user) => dispatch({ type: ActionTypes.SET_USER, payload: user }),
    setCurrentProject: (project) => dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: project }),
    
    updateWorkflowStatus: (workflow, status) => 
      dispatch({ 
        type: ActionTypes.UPDATE_WORKFLOW_STATUS, 
        payload: { workflow, status } 
      }),
    
    setLoading: (loading) => dispatch({ type: ActionTypes.SET_LOADING, payload: loading }),
    setError: (error) => dispatch({ type: ActionTypes.SET_ERROR, payload: error }),
    
    addNotification: (notification) => 
      dispatch({ type: ActionTypes.ADD_NOTIFICATION, payload: notification }),
    
    removeNotification: (id) => 
      dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id }),
    
    clearNotifications: () => dispatch({ type: ActionTypes.CLEAR_NOTIFICATIONS }),
    
    setN8NConnection: (connected) => 
      dispatch({ type: ActionTypes.SET_N8N_CONNECTION, payload: connected }),
    
    setN8NConfig: (config) => 
      dispatch({ type: ActionTypes.SET_N8N_CONFIG, payload: config }),
    
    addActivity: (activity) => {
      const activityWithTimestamp = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...activity
      };
      dispatch({ type: ActionTypes.ADD_ACTIVITY, payload: activityWithTimestamp });
    },
    
    updateMetrics: (metrics) => 
      dispatch({ type: ActionTypes.UPDATE_METRICS, payload: metrics }),
    
    resetState: () => dispatch({ type: ActionTypes.RESET_STATE })
  };
};

// Provider component
export const AppContextProvider = ({ children, context, settings, monday }) => {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    context,
    settings,
    monday
  });

  // Initialize N8N config from settings
  useEffect(() => {
    if (settings) {
      dispatch({
        type: ActionTypes.SET_N8N_CONFIG,
        payload: {
          baseUrl: settings.n8n_instance_url || '',
          apiKey: settings.api_key || '',
          enabled: settings.integration_enabled || false
        }
      });
    }
  }, [settings]);

  // Auto-remove notifications after 5 seconds
  useEffect(() => {
    state.notifications.forEach(notification => {
      if (!notification.persistent) {
        setTimeout(() => {
          dispatch({
            type: ActionTypes.REMOVE_NOTIFICATION,
            payload: notification.id
          });
        }, 5000);
      }
    });
  }, [state.notifications]);

  // Log activity for important state changes
  useEffect(() => {
    if (state.currentProject) {
      dispatch({
        type: ActionTypes.ADD_ACTIVITY,
        payload: {
          type: 'project_selected',
          message: `Selected project: ${state.currentProject.name}`,
          projectId: state.currentProject.id
        }
      });
    }
  }, [state.currentProject]);

  // Log workflow status changes
  useEffect(() => {
    Object.entries(state.workflowStatus).forEach(([workflow, status]) => {
      if (status !== 'idle') {
        dispatch({
          type: ActionTypes.ADD_ACTIVITY,
          payload: {
            type: 'workflow_status',
            message: `${workflow} workflow: ${status}`,
            workflow,
            status
          }
        });
      }
    });
  }, [state.workflowStatus]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
};

// Export action types for direct usage if needed
export { ActionTypes };