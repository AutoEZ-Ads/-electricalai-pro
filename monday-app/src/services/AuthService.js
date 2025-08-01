class AuthService {
  constructor() {
    this.monday = null;
    this.initialized = false;
  }

  initialize(mondayInstance) {
    this.monday = mondayInstance;
    this.initialized = true;
    console.log('🔧 AuthService initialized successfully');
  }

  _ensureInitialized() {
    if (!this.initialized || !this.monday) {
      throw new Error('AuthService not initialized. Call initialize() first.');
    }
  }

  /**
   * Get current user with extended information
   * @returns {Promise<Object>} User data with permissions and subscription info
   */
  async getCurrentUser() {
    this._ensureInitialized();
    
    try {
      console.log('👤 Getting current user with auth details');
      
      const query = `
        query {
          me {
            id
            name
            email
            photo_original
            created_at
            time_zone_identifier
            is_admin
            is_verified
            country_code
            mobile_phone
            birthday
            join_date
            location
            title
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      const user = response.data.me;
      
      // Enhance user data with auth-specific information
      const enhancedUser = {
        ...user,
        permissions: await this._getUserPermissions(user),
        subscription: await this._getUserSubscription(user.id),
        preferences: await this._getUserPreferences(user.id),
        session: {
          loginTime: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        }
      };

      console.log('✅ User authenticated successfully');
      return enhancedUser;

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get user permissions based on Monday.com role
   * @param {Object} user - User object
   * @returns {Promise<Array>} User permissions
   * @private
   */
  async _getUserPermissions(user) {
    const permissions = ['view_board', 'create_item', 'edit_item'];
    
    if (user.is_admin) {
      permissions.push(
        'admin',
        'manage_board',
        'manage_users',
        'view_analytics',
        'export_data',
        'manage_integrations'
      );
    }
    
    // Add more granular permissions based on user role or board access
    try {
      // You could query the user's board access here
      // const boardAccess = await this._getUserBoardAccess(user.id);
      // Add permissions based on board access level
    } catch (error) {
      console.warn('Could not determine extended permissions:', error);
    }
    
    return permissions;
  }

  /**
   * Get user subscription information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription data
   * @private
   */
  async _getUserSubscription(userId) {
    // In a real implementation, this would query your backend for subscription data
    // For now, we'll return a default subscription
    
    try {
      // Check if user has any stored subscription preferences in Monday
      const settings = await this.monday.get('settings');
      
      if (settings && settings.subscription_plan) {
        return {
          plan: settings.subscription_plan,
          status: 'active',
          startDate: settings.subscription_start || new Date().toISOString(),
          renewalDate: settings.subscription_renewal,
          features: this._getPlanFeatures(settings.subscription_plan)
        };
      }
    } catch (error) {
      console.warn('Could not load subscription data:', error);
    }
    
    // Default to starter plan
    return {
      plan: 'starter',
      status: 'active',
      startDate: new Date().toISOString(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      features: this._getPlanFeatures('starter')
    };
  }

  /**
   * Get features for a subscription plan
   * @param {string} plan - Plan name
   * @returns {Array} Plan features
   * @private
   */
  _getPlanFeatures(plan) {
    const planFeatures = {
      starter: [
        'basic_estimation',
        'nec_compliance_basic',
        'standard_materials'
      ],
      professional: [
        'unlimited_estimation',
        'advanced_nec_compliance',
        'realtime_material_costs',
        'floor_plan_analysis',
        'progress_monitoring',
        'api_access',
        'priority_support'
      ],
      enterprise: [
        'everything_professional',
        'custom_workflows',
        'bulk_processing',
        'advanced_analytics',
        'white_label',
        'dedicated_support',
        'sso_integration'
      ]
    };
    
    return planFeatures[plan] || planFeatures.starter;
  }

  /**
   * Get user preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   * @private
   */
  async _getUserPreferences(userId) {
    const defaultPreferences = {
      theme: 'light',
      notifications: true,
      autoSave: true,
      defaultProjectType: 'residential',
      units: 'imperial',
      currency: 'USD',
      timezone: 'America/New_York',
      emailNotifications: true,
      workflowAlerts: true
    };
    
    try {
      // Try to load preferences from Monday app storage
      const settings = await this.monday.get('settings');
      
      if (settings && settings.user_preferences) {
        return {
          ...defaultPreferences,
          ...settings.user_preferences
        };
      }
    } catch (error) {
      console.warn('Could not load user preferences:', error);
    }
    
    return defaultPreferences;
  }

  /**
   * Update user preferences
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<boolean>} Success status
   */
  async updateUserPreferences(preferences) {
    this._ensureInitialized();
    
    try {
      console.log('🔧 Updating user preferences');
      
      const currentSettings = await this.monday.get('settings');
      
      const updatedSettings = {
        ...currentSettings,
        user_preferences: {
          ...currentSettings.user_preferences,
          ...preferences
        }
      };
      
      await this.monday.set('settings', updatedSettings);
      
      console.log('✅ User preferences updated successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Update user subscription
   * @param {Object} subscriptionData - Subscription data to update
   * @returns {Promise<boolean>} Success status
   */
  async updateUserSubscription(subscriptionData) {
    this._ensureInitialized();
    
    try {
      console.log('💳 Updating user subscription');
      
      const currentSettings = await this.monday.get('settings');
      
      const updatedSettings = {
        ...currentSettings,
        subscription_plan: subscriptionData.plan,
        subscription_start: subscriptionData.startDate,
        subscription_renewal: subscriptionData.renewalDate,
        subscription_status: subscriptionData.status
      };
      
      await this.monday.set('settings', updatedSettings);
      
      console.log('✅ User subscription updated successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to update user subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   * @param {Array} userPermissions - User's permissions
   * @param {string} permission - Permission to check
   * @returns {boolean} Has permission
   */
  hasPermission(userPermissions, permission) {
    return userPermissions.includes(permission) || userPermissions.includes('admin');
  }

  /**
   * Check if user can perform action based on subscription limits
   * @param {Object} subscription - User's subscription
   * @param {string} action - Action to check
   * @param {number} currentUsage - Current usage count
   * @returns {boolean} Can perform action
   */
  canPerformAction(subscription, action, currentUsage = 0) {
    const planLimits = {
      starter: {
        estimationsPerMonth: 5,
        projectsMax: 10,
        teamMembers: 1,
        fileUploadsMax: 5
      },
      professional: {
        estimationsPerMonth: -1, // unlimited
        projectsMax: 100,
        teamMembers: 5,
        fileUploadsMax: 50
      },
      enterprise: {
        estimationsPerMonth: -1, // unlimited
        projectsMax: -1, // unlimited
        teamMembers: -1, // unlimited
        fileUploadsMax: -1 // unlimited
      }
    };
    
    const limits = planLimits[subscription.plan] || planLimits.starter;
    
    switch (action) {
      case 'create_estimation':
        return limits.estimationsPerMonth === -1 || currentUsage < limits.estimationsPerMonth;
      case 'create_project':
        return limits.projectsMax === -1 || currentUsage < limits.projectsMax;
      case 'add_team_member':
        return limits.teamMembers === -1 || currentUsage < limits.teamMembers;
      case 'upload_file':
        return limits.fileUploadsMax === -1 || currentUsage < limits.fileUploadsMax;
      default:
        return true;
    }
  }

  /**
   * Log user activity
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async logActivity(userId, action, metadata = {}) {
    try {
      const activity = {
        userId,
        action,
        timestamp: new Date().toISOString(),
        metadata,
        userAgent: navigator.userAgent,
        sessionId: this._getSessionId()
      };
      
      // In a real implementation, you would send this to your analytics service
      console.log('📊 User activity logged:', activity);
      
    } catch (error) {
      console.warn('Could not log user activity:', error);
    }
  }

  /**
   * Get or generate session ID
   * @returns {string} Session ID
   * @private
   */
  _getSessionId() {
    let sessionId = sessionStorage.getItem('electricalai_session_id');
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('electricalai_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Validate session
   * @returns {Promise<boolean>} Is session valid
   */
  async validateSession() {
    this._ensureInitialized();
    
    try {
      // Simple validation - check if we can get current user
      const user = await this.getCurrentUser();
      return !!user;
      
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Logout user (clear session data)
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      console.log('👋 Logging out user');
      
      // Clear session storage
      sessionStorage.removeItem('electricalai_session_id');
      
      // Clear any cached authentication data
      // Note: Monday.com handles the actual logout process
      
      console.log('✅ User logged out successfully');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const authService = new AuthService();
export { authService as AuthService };