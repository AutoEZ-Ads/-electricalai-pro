import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  permissions: [],
  subscription: {
    plan: 'starter',
    features: [],
    limits: {
      estimationsPerMonth: 5,
      projectsMax: 10,
      teamMembers: 1
    }
  },
  preferences: {
    theme: 'light',
    notifications: true,
    autoSave: true,
    defaultProjectType: 'residential'
  },
  session: {
    token: null,
    expiresAt: null,
    refreshToken: null
  },
  loading: false,
  error: null
};

// Action types
const ActionTypes = {
  SET_USER: 'SET_USER',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  SET_PERMISSIONS: 'SET_PERMISSIONS',
  SET_SUBSCRIPTION: 'SET_SUBSCRIPTION',
  SET_PREFERENCES: 'SET_PREFERENCES',
  SET_SESSION: 'SET_SESSION',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  UPDATE_PREFERENCE: 'UPDATE_PREFERENCE'
};

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    features: [
      'basic_estimation',
      'nec_compliance_basic',
      'standard_materials'
    ],
    limits: {
      estimationsPerMonth: 5,
      projectsMax: 10,
      teamMembers: 1,
      fileUploadsMax: 5,
      storageGB: 1
    }
  },
  professional: {
    name: 'Professional',
    price: 29,
    features: [
      'unlimited_estimation',
      'advanced_nec_compliance',
      'realtime_material_costs',
      'floor_plan_analysis',
      'progress_monitoring',
      'api_access',
      'priority_support'
    ],
    limits: {
      estimationsPerMonth: -1, // unlimited
      projectsMax: 100,
      teamMembers: 5,
      fileUploadsMax: 50,
      storageGB: 10
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    features: [
      'everything_professional',
      'custom_workflows',
      'bulk_processing',
      'advanced_analytics',
      'white_label',
      'dedicated_support',
      'sso_integration'
    ],
    limits: {
      estimationsPerMonth: -1, // unlimited
      projectsMax: -1, // unlimited
      teamMembers: -1, // unlimited
      fileUploadsMax: -1, // unlimited
      storageGB: 100
    }
  }
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload
      };
      
    case ActionTypes.SET_AUTHENTICATED:
      return {
        ...state,
        isAuthenticated: action.payload
      };
      
    case ActionTypes.SET_PERMISSIONS:
      return {
        ...state,
        permissions: action.payload
      };
      
    case ActionTypes.SET_SUBSCRIPTION:
      const plan = SUBSCRIPTION_PLANS[action.payload.plan] || SUBSCRIPTION_PLANS.starter;
      return {
        ...state,
        subscription: {
          ...state.subscription,
          ...action.payload,
          features: plan.features,
          limits: plan.limits
        }
      };
      
    case ActionTypes.SET_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_PREFERENCE:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          [action.payload.key]: action.payload.value
        }
      };
      
    case ActionTypes.SET_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload
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
      
    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        preferences: state.preferences // Keep preferences after logout
      };
      
    default:
      return state;
  }
};

// Create contexts
const AuthStateContext = createContext();
const AuthDispatchContext = createContext();

// Custom hooks
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within AuthContextProvider');
  }
  return context;
};

export const useAuthDispatch = () => {
  const context = useContext(AuthDispatchContext);
  if (!context) {
    throw new Error('useAuthDispatch must be used within AuthContextProvider');
  }
  return context;
};

export const useAuth = () => {
  const state = useAuthState();
  const dispatch = useAuthDispatch();
  
  return {
    ...state,
    dispatch,
    
    // Helper methods
    hasPermission: (permission) => {
      return state.permissions.includes(permission) || state.permissions.includes('admin');
    },
    
    hasFeature: (feature) => {
      return state.subscription.features.includes(feature) || 
             state.subscription.features.includes('everything_professional');
    },
    
    canPerformAction: (action, count = 0) => {
      const limits = state.subscription.limits;
      
      switch (action) {
        case 'create_estimation':
          return limits.estimationsPerMonth === -1 || count < limits.estimationsPerMonth;
        case 'create_project':
          return limits.projectsMax === -1 || count < limits.projectsMax;
        case 'add_team_member':
          return limits.teamMembers === -1 || count < limits.teamMembers;
        case 'upload_file':
          return limits.fileUploadsMax === -1 || count < limits.fileUploadsMax;
        default:
          return true;
      }
    },
    
    getRemainingLimit: (action, currentCount = 0) => {
      const limits = state.subscription.limits;
      
      switch (action) {
        case 'estimations':
          return limits.estimationsPerMonth === -1 ? -1 : limits.estimationsPerMonth - currentCount;
        case 'projects':
          return limits.projectsMax === -1 ? -1 : limits.projectsMax - currentCount;
        case 'team_members':
          return limits.teamMembers === -1 ? -1 : limits.teamMembers - currentCount;
        case 'file_uploads':
          return limits.fileUploadsMax === -1 ? -1 : limits.fileUploadsMax - currentCount;
        default:
          return -1;
      }
    },
    
    // Action creators
    setUser: (user) => dispatch({ type: ActionTypes.SET_USER, payload: user }),
    setAuthenticated: (authenticated) => dispatch({ type: ActionTypes.SET_AUTHENTICATED, payload: authenticated }),
    setPermissions: (permissions) => dispatch({ type: ActionTypes.SET_PERMISSIONS, payload: permissions }),
    setSubscription: (subscription) => dispatch({ type: ActionTypes.SET_SUBSCRIPTION, payload: subscription }),
    setPreferences: (preferences) => dispatch({ type: ActionTypes.SET_PREFERENCES, payload: preferences }),
    updatePreference: (key, value) => dispatch({ type: ActionTypes.UPDATE_PREFERENCE, payload: { key, value } }),
    setSession: (session) => dispatch({ type: ActionTypes.SET_SESSION, payload: session }),
    setLoading: (loading) => dispatch({ type: ActionTypes.SET_LOADING, payload: loading }),
    setError: (error) => dispatch({ type: ActionTypes.SET_ERROR, payload: error }),
    logout: () => dispatch({ type: ActionTypes.LOGOUT })
  };
};

// Provider component
export const AuthContextProvider = ({ children, user }) => {
  const [state, dispatch] = useReducer(authReducer, {
    ...initialState,
    user,
    isAuthenticated: !!user
  });

  // Initialize user permissions and subscription from Monday user data
  useEffect(() => {
    if (user) {
      // Set permissions based on user role
      const permissions = [];
      
      if (user.is_admin) {
        permissions.push('admin', 'manage_board', 'manage_users');
      }
      
      // All authenticated users have basic permissions
      permissions.push('view_board', 'create_item', 'edit_item');
      
      dispatch({ type: ActionTypes.SET_PERMISSIONS, payload: permissions });
      
      // Set default subscription (would normally come from backend)
      dispatch({ 
        type: ActionTypes.SET_SUBSCRIPTION, 
        payload: { 
          plan: 'starter', // Default plan
          status: 'active',
          startDate: new Date().toISOString(),
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        } 
      });
      
      // Load user preferences (would normally come from backend/localStorage)
      const savedPreferences = localStorage.getItem(`electricalai_preferences_${user.id}`);
      if (savedPreferences) {
        try {
          const preferences = JSON.parse(savedPreferences);
          dispatch({ type: ActionTypes.SET_PREFERENCES, payload: preferences });
        } catch (error) {
          console.warn('Failed to load saved preferences:', error);
        }
      }
    }
  }, [user]);

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (state.user && state.preferences) {
      localStorage.setItem(
        `electricalai_preferences_${state.user.id}`,
        JSON.stringify(state.preferences)
      );
    }
  }, [state.preferences, state.user]);

  // Session management
  useEffect(() => {
    if (state.session.token && state.session.expiresAt) {
      const expirationTime = new Date(state.session.expiresAt).getTime();
      const currentTime = Date.now();
      
      if (currentTime >= expirationTime) {
        // Session expired, logout
        dispatch({ type: ActionTypes.LOGOUT });
      } else {
        // Set up auto-logout timer
        const timeUntilExpiration = expirationTime - currentTime;
        const logoutTimer = setTimeout(() => {
          dispatch({ type: ActionTypes.LOGOUT });
        }, timeUntilExpiration);
        
        return () => clearTimeout(logoutTimer);
      }
    }
  }, [state.session]);

  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
};

// Export subscription plans for reference
export { SUBSCRIPTION_PLANS, ActionTypes };