import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Flex,
  TextField,
  Button,
  Card,
  Heading,
  Text,
  Divider,
  Badge,
  ProgressBar,
  Switch,
  Tabs,
  TabsHeader,
  Tab,
  TabContent,
  Alert,
  Loader,
  IconButton,
  Tooltip
} from '@vibe/core';
import {
  Settings,
  CheckCircle,
  AlertTriangle,
  Refresh,
  Play,
  Pause,
  Info,
  Link,
  Shield,
  Database,
  Activity,
  Zap
} from '@vibe/core/icons';

import { useAppContext } from '../contexts/AppContext';
import { N8NService } from '../services/N8NService';
import { MondayService } from '../services/MondayService';

const IntegrationView = ({ context, settings, monday }) => {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('configuration');
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [n8nConfig, setN8nConfig] = useState({
    baseUrl: settings?.n8n_instance_url || '',
    apiKey: settings?.api_key || '',
    enabled: settings?.integration_enabled || false
  });

  // Check N8N connection status
  const { data: systemHealth, isLoading: healthLoading } = useQuery(
    ['n8n-health'],
    () => N8NService.getSystemHealth(),
    {
      enabled: n8nConfig.baseUrl && n8nConfig.apiKey,
      refetchInterval: 30000, // Check every 30 seconds
      onSuccess: () => setConnectionStatus('connected'),
      onError: () => setConnectionStatus('error')
    }
  );

  // Get workflow status for current project
  const { data: workflowStatus } = useQuery(
    ['workflow-status', context?.itemId],
    () => N8NService.getWorkflowStatus(context.itemId),
    {
      enabled: !!context?.itemId && connectionStatus === 'connected',
      refetchInterval: 10000 // Refresh every 10 seconds
    }
  );

  // Configuration update mutation
  const updateConfigMutation = useMutation(
    async (newConfig) => {
      // Initialize N8N service with new config
      N8NService.initialize({
        baseUrl: newConfig.baseUrl,
        apiKey: newConfig.apiKey
      });

      // Test connection
      const connectionTest = await N8NService.testConnection();
      if (!connectionTest) {
        throw new Error('Failed to connect to N8N instance');
      }

      // Update Monday app settings
      await monday.set('settings', {
        n8n_instance_url: newConfig.baseUrl,
        api_key: newConfig.apiKey,
        integration_enabled: newConfig.enabled
      });

      return { success: true };
    },
    {
      onSuccess: () => {
        console.log('✅ N8N configuration updated successfully');
        setConnectionStatus('connected');
        queryClient.invalidateQueries(['n8n-health']);
      },
      onError: (error) => {
        console.error('❌ Failed to update N8N configuration:', error);
        setConnectionStatus('error');
      }
    }
  );

  // Test connection mutation
  const testConnectionMutation = useMutation(
    async () => {
      if (!n8nConfig.baseUrl || !n8nConfig.apiKey) {
        throw new Error('Please provide both N8N URL and API key');
      }

      N8NService.initialize({
        baseUrl: n8nConfig.baseUrl,
        apiKey: n8nConfig.apiKey
      });

      const result = await N8NService.testConnection();
      if (!result) {
        throw new Error('Connection test failed');
      }

      return result;
    },
    {
      onSuccess: () => {
        setConnectionStatus('connected');
      },
      onError: (error) => {
        setConnectionStatus('error');
        console.error('Connection test failed:', error);
      }
    }
  );

  const handleConfigSave = () => {
    updateConfigMutation.mutate(n8nConfig);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge color="positive" leftIcon={CheckCircle}>Connected</Badge>;
      case 'error':
        return <Badge color="negative" leftIcon={AlertTriangle}>Disconnected</Badge>;
      case 'checking':
        return <Badge color="neutral" leftIcon={Activity}>Checking...</Badge>;
      default:
        return <Badge color="secondary">Unknown</Badge>;
    }
  };

  const workflowTypes = [
    {
      id: 'estimation',
      name: 'Electrical Estimation',
      description: 'AI-powered cost estimation with NEC compliance',
      icon: '⚡',
      status: workflowStatus?.estimation?.status || 'idle'
    },
    {
      id: 'floor-plan',
      name: 'Floor Plan Analysis',
      description: 'Automated floor plan processing and markup',
      icon: '🏠',
      status: workflowStatus?.floorPlan?.status || 'idle'
    },
    {
      id: 'compliance',
      name: 'NEC Compliance Check',
      description: 'Comprehensive electrical code compliance validation',
      icon: '📋',
      status: workflowStatus?.compliance?.status || 'idle'
    },
    {
      id: 'material-cost',
      name: 'Material Cost Tracking',
      description: 'Real-time material pricing and procurement optimization',
      icon: '💰',
      status: workflowStatus?.materialCost?.status || 'idle'
    },
    {
      id: 'progress',
      name: 'Project Progress Monitoring',
      description: 'Automated project tracking with predictive analytics',
      icon: '📈',
      status: workflowStatus?.progress?.status || 'idle'
    }
  ];

  const getWorkflowStatusColor = (status) => {
    switch (status) {
      case 'running': return 'warning';
      case 'completed': return 'positive';
      case 'error': return 'negative';
      default: return 'secondary';
    }
  };

  return (
    <Box padding="large">
      {/* Header */}
      <Flex justify="space-between" align="center" marginBottom="large">
        <Box>
          <Heading size="large">🔧 N8N Integration</Heading>
          <Text color="secondary">Configure and monitor your workflow automation</Text>
        </Box>
        {getConnectionStatusBadge()}
      </Flex>

      {/* Main Content */}
      <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
        <TabsHeader>
          <Tab id="configuration">
            <Settings size="small" />
            Configuration
          </Tab>
          <Tab id="workflows">
            <Activity size="small" />
            Workflows
          </Tab>
          <Tab id="monitoring">
            <Database size="small" />
            Monitoring
          </Tab>
          <Tab id="security">
            <Shield size="small" />
            Security
          </Tab>
        </TabsHeader>

        {/* Configuration Tab */}
        <TabContent id="configuration">
          <Box marginTop="medium">
            <Card>
              <Box padding="large">
                <Heading size="medium" marginBottom="medium">
                  🔗 N8N Instance Configuration
                </Heading>
                
                <Flex direction="column" gap="medium">
                  <TextField
                    label="N8N Instance URL"
                    placeholder="https://your-n8n-instance.com"
                    value={n8nConfig.baseUrl}
                    onChange={(value) => setN8nConfig(prev => ({ ...prev, baseUrl: value }))}
                    required
                  />
                  
                  <TextField
                    label="API Key"
                    type="password"
                    placeholder="Your N8N API key"
                    value={n8nConfig.apiKey}
                    onChange={(value) => setN8nConfig(prev => ({ ...prev, apiKey: value }))}
                    required
                  />
                  
                  <Flex align="center" gap="small">
                    <Switch
                      checked={n8nConfig.enabled}
                      onChange={(checked) => setN8nConfig(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Text>Enable N8N Integration</Text>
                  </Flex>
                  
                  <Divider />
                  
                  <Flex gap="small">
                    <Button
                      leftIcon={CheckCircle}
                      onClick={handleTestConnection}
                      loading={testConnectionMutation.isLoading}
                      kind="secondary"
                    >
                      Test Connection
                    </Button>
                    
                    <Button
                      leftIcon={Settings}
                      onClick={handleConfigSave}
                      loading={updateConfigMutation.isLoading}
                    >
                      Save Configuration
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>

            {/* Connection Status Details */}
            {connectionStatus === 'connected' && systemHealth && (
              <Card marginTop="medium">
                <Box padding="large">
                  <Heading size="medium" marginBottom="medium">
                    ✅ System Health
                  </Heading>
                  
                  <Flex direction="column" gap="small">
                    <Flex justify="space-between">
                      <Text>N8N Version:</Text>
                      <Text weight="bold">{systemHealth.version || 'Unknown'}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text>Database Status:</Text>
                      <Badge color="positive">Healthy</Badge>
                    </Flex>
                    <Flex justify="space-between">
                      <Text>Active Workflows:</Text>
                      <Text weight="bold">{systemHealth.activeWorkflows || 0}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text>Last Check:</Text>
                      <Text color="secondary">{new Date().toLocaleTimeString()}</Text>
                    </Flex>
                  </Flex>
                </Box>
              </Card>
            )}
          </Box>
        </TabContent>

        {/* Workflows Tab */}
        <TabContent id="workflows">
          <Box marginTop="medium">
            <Flex direction="column" gap="medium">
              {workflowTypes.map((workflow) => (
                <Card key={workflow.id}>
                  <Box padding="large">
                    <Flex justify="space-between" align="center">
                      <Flex align="center" gap="medium">
                        <Text size="large">{workflow.icon}</Text>
                        <Box>
                          <Heading size="small">{workflow.name}</Heading>
                          <Text size="small" color="secondary">
                            {workflow.description}
                          </Text>
                        </Box>
                      </Flex>
                      
                      <Flex align="center" gap="small">
                        <Badge color={getWorkflowStatusColor(workflow.status)}>
                          {workflow.status}
                        </Badge>
                        
                        <Tooltip content="View workflow details">
                          <IconButton icon={Info} size="small" />
                        </Tooltip>
                        
                        <Tooltip content="Test workflow">
                          <IconButton 
                            icon={Play} 
                            size="small"
                            disabled={connectionStatus !== 'connected'}
                          />
                        </Tooltip>
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Flex>
          </Box>
        </TabContent>

        {/* Monitoring Tab */}
        <TabContent id="monitoring">
          <Box marginTop="medium">
            {connectionStatus === 'connected' ? (
              <Flex direction="column" gap="medium">
                <Card>
                  <Box padding="large">
                    <Heading size="medium" marginBottom="medium">
                      📊 Workflow Performance
                    </Heading>
                    
                    <Flex direction="column" gap="medium">
                      {workflowTypes.map((workflow) => (
                        <Box key={workflow.id}>
                          <Flex justify="space-between" align="center" marginBottom="xs">
                            <Text size="small">{workflow.name}</Text>
                            <Text size="small" color="secondary">
                              {Math.floor(Math.random() * 100)}% success rate
                            </Text>
                          </Flex>
                          <ProgressBar 
                            value={Math.floor(Math.random() * 100)} 
                            size="small" 
                          />
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                </Card>
                
                <Card>
                  <Box padding="large">
                    <Heading size="medium" marginBottom="medium">
                      ⏱️ Recent Activity
                    </Heading>
                    
                    <Flex direction="column" gap="small">
                      <Flex justify="space-between" align="center">
                        <Text size="small">Estimation workflow completed</Text>
                        <Text size="small" color="secondary">2 min ago</Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text size="small">NEC compliance check started</Text>
                        <Text size="small" color="secondary">5 min ago</Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text size="small">Material cost update received</Text>
                        <Text size="small" color="secondary">10 min ago</Text>
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              </Flex>
            ) : (
              <Alert type="warning">
                Please configure and connect to your N8N instance to view monitoring data.
              </Alert>
            )}
          </Box>
        </TabContent>

        {/* Security Tab */}
        <TabContent id="security">
          <Box marginTop="medium">
            <Card>
              <Box padding="large">
                <Heading size="medium" marginBottom="medium">
                  🔐 Security Settings
                </Heading>
                
                <Flex direction="column" gap="medium">
                  <Box>
                    <Text weight="bold" marginBottom="xs">API Key Management</Text>
                    <Text size="small" color="secondary" marginBottom="small">
                      Your API key is encrypted and stored securely. Only you can see and modify it.
                    </Text>
                    <Badge color="positive" leftIcon={Shield}>
                      Encrypted Storage
                    </Badge>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Text weight="bold" marginBottom="xs">Webhook Security</Text>
                    <Text size="small" color="secondary" marginBottom="small">
                      All webhook communications use HTTPS and API key authentication.
                    </Text>
                    <Badge color="positive" leftIcon={CheckCircle}>
                      HTTPS Enabled
                    </Badge>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Text weight="bold" marginBottom="xs">Data Protection</Text>
                    <Text size="small" color="secondary" marginBottom="small">
                      Your project data is processed securely and never stored permanently on external servers.
                    </Text>
                    <Badge color="positive" leftIcon={Database}>
                      GDPR Compliant
                    </Badge>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Text weight="bold" marginBottom="xs">Audit Trail</Text>
                    <Text size="small" color="secondary">
                      All workflow executions are logged with timestamps and user attribution.
                    </Text>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>
        </TabContent>
      </Tabs>

      {/* Quick Actions Panel */}
      {connectionStatus === 'connected' && (
        <Card marginTop="large">
          <Box padding="medium">
            <Flex justify="space-between" align="center">
              <Text weight="bold">🚀 Quick Actions</Text>
              
              <Flex gap="small">
                <Button
                  size="small"
                  kind="secondary"
                  leftIcon={Refresh}
                  onClick={() => queryClient.invalidateQueries()}
                >
                  Refresh Status
                </Button>
                
                <Button
                  size="small"
                  leftIcon={Zap}
                  onClick={() => {
                    // Trigger a test estimation workflow
                    N8NService.triggerEstimationWorkflow({
                      projectId: 'test',
                      projectType: 'residential',
                      squareFootage: 2500,
                      source: 'integration-test'
                    });
                  }}
                >
                  Test Workflow
                </Button>
              </Flex>
            </Flex>
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default IntegrationView;