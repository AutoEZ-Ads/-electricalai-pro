/**
 * Integration Test Suite for ElectricalAI Pro Monday.com App
 * Tests complete workflow from Monday.com to N8N to results
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';

import App from '../App';
import { MondayService } from '../services/MondayService';
import { N8NService } from '../services/N8NService';
import { AuthService } from '../services/AuthService';

// Mock services
jest.mock('../services/MondayService');
jest.mock('../services/N8NService');
jest.mock('../services/AuthService');
jest.mock('monday-sdk-js');

// Test data
const mockUser = {
  id: '12345',
  name: 'John Electrician',
  email: 'john@electrical.com',
  is_admin: false
};

const mockContext = {
  itemId: '987654321',
  boardId: '123456789',
  userId: '12345'
};

const mockSettings = {
  n8n_instance_url: 'http://localhost:5678',
  api_key: 'test-api-key',
  integration_enabled: true,
  default_project_type: 'residential'
};

const mockBoardItem = {
  id: '987654321',
  name: 'Test Electrical Project',
  state: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z',
  board: { id: '123456789', name: 'Electrical Projects' },
  group: { id: 'group1', title: 'Active Projects' },
  column_values: [
    { id: 'text', type: 'text', text: 'Residential rewiring project', value: '"Residential rewiring project"' },
    { id: 'numbers', type: 'numeric', text: '0', value: '0' },
    { id: 'status', type: 'color', text: 'New Project', value: '{"label":"New Project"}' }
  ]
};

const mockEstimationResult = {
  success: true,
  projectId: '987654321',
  estimation: {
    totalCost: 15750.50,
    laborCost: 8500.00,
    materialCost: 6250.50,
    overhead: 1000.00
  },
  technical: {
    totalLoad: 12500,
    circuitCount: 15,
    panelSize: 200
  },
  accuracy: '94% Confidence',
  floorPlanAnalysis: {
    rooms: [
      { name: 'Living Room', outlets: 6, switches: 3 },
      { name: 'Kitchen', outlets: 8, switches: 2, gfci: 4 }
    ],
    totalOutlets: 14,
    totalSwitches: 5
  },
  compliance: {
    status: 'COMPLIANT',
    score: 98,
    violations: []
  }
};

// Setup function
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component, { queryClient = createTestQueryClient() } = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ElectricalAI Pro Monday App Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    MondayService.initialize = jest.fn();
    MondayService.getItem = jest.fn().mockResolvedValue(mockBoardItem);
    MondayService.getBoardColumns = jest.fn().mockResolvedValue([]);
    MondayService.updateItemColumns = jest.fn().mockResolvedValue(mockBoardItem);
    MondayService.uploadFile = jest.fn().mockResolvedValue({ url: 'https://files.monday.com/test.pdf' });
    
    N8NService.initialize = jest.fn();
    N8NService.triggerEstimationWorkflow = jest.fn().mockResolvedValue(mockEstimationResult);
    N8NService.testConnection = jest.fn().mockResolvedValue(true);
    N8NService.getSystemHealth = jest.fn().mockResolvedValue({ status: 'healthy', version: '1.0.0' });
    
    AuthService.initialize = jest.fn();
    AuthService.getCurrentUser = jest.fn().mockResolvedValue(mockUser);
  });

  describe('App Initialization', () => {
    test('should initialize Monday SDK and services correctly', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      // Mock monday-sdk-js
      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      await waitFor(() => {
        expect(mockMonday.setToken).toHaveBeenCalled();
        expect(MondayService.initialize).toHaveBeenCalledWith(mockMonday);
        expect(N8NService.initialize).toHaveBeenCalledWith({
          baseUrl: mockSettings.n8n_instance_url,
          apiKey: mockSettings.api_key
        });
        expect(AuthService.initialize).toHaveBeenCalledWith(mockMonday);
      });
    });

    test('should handle initialization errors gracefully', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockRejectedValue(new Error('Monday API Error')),
        api: jest.fn().mockRejectedValue(new Error('Monday API Error'))
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      });
    });
  });

  describe('ItemView Integration', () => {
    test('should complete full estimation workflow', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      // Wait for app to initialize
      await waitFor(() => {
        expect(screen.getByText(/ElectricalAI Pro Estimator/i)).toBeInTheDocument();
      });

      // Fill out estimation form
      const projectTypeDropdown = screen.getByLabelText(/Project Type/i);
      fireEvent.change(projectTypeDropdown, { target: { value: 'residential' } });

      const squareFootageInput = screen.getByLabelText(/Square Footage/i);
      fireEvent.change(squareFootageInput, { target: { value: '2500' } });

      const complexityDropdown = screen.getByLabelText(/Complexity Level/i);
      fireEvent.change(complexityDropdown, { target: { value: 'standard' } });

      // Submit estimation
      const generateButton = screen.getByRole('button', { name: /Generate Estimate/i });
      fireEvent.click(generateButton);

      // Verify N8N workflow was triggered
      await waitFor(() => {
        expect(N8NService.triggerEstimationWorkflow).toHaveBeenCalledWith({
          projectId: mockContext.itemId,
          projectType: 'residential',
          squareFootage: 2500,
          complexityLevel: 'standard',
          location: 'suburban',
          specialRequirements: [],
          uploadedFiles: [],
          requestedBy: mockUser.id,
          requestedAt: expect.any(String),
          source: 'monday-app'
        });
      });

      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText('$15,750.50')).toBeInTheDocument();
        expect(screen.getByText('94% Confidence')).toBeInTheDocument();
        expect(screen.getByText('12,500 VA')).toBeInTheDocument();
      });

      // Verify Monday item was updated
      expect(MondayService.updateItemColumns).toHaveBeenCalledWith(
        mockContext.itemId,
        expect.objectContaining({
          numbers: mockEstimationResult.estimation.totalCost,
          numbers2: mockEstimationResult.technical.totalLoad,
          text: mockEstimationResult.accuracy,
          status: { label: 'Estimated' }
        })
      );
    });

    test('should handle file upload correctly', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText(/ElectricalAI Pro Estimator/i)).toBeInTheDocument();
      });

      // Mock file upload
      const file = new File(['floor plan content'], 'floor-plan.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/Drop files here/i);
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(MondayService.uploadFile).toHaveBeenCalledWith(file, mockContext.itemId);
      });
    });

    test('should trigger NEC compliance check after estimation', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      N8NService.triggerComplianceCheck = jest.fn().mockResolvedValue({
        success: true,
        compliance: { status: 'COMPLIANT', score: 98 },
        violations: []
      });

      renderWithProviders(<App />);

      // Complete estimation first
      await waitFor(() => {
        expect(screen.getByText(/ElectricalAI Pro Estimator/i)).toBeInTheDocument();
      });

      // Trigger estimation
      const generateButton = screen.getByRole('button', { name: /Generate Estimate/i });
      fireEvent.click(generateButton);

      // Wait for estimation to complete
      await waitFor(() => {
        expect(screen.getByText('$15,750.50')).toBeInTheDocument();
      });

      // Click NEC compliance check
      const complianceButton = screen.getByRole('button', { name: /Check NEC Compliance/i });
      fireEvent.click(complianceButton);

      await waitFor(() => {
        expect(N8NService.triggerComplianceCheck).toHaveBeenCalledWith({
          projectId: mockContext.itemId,
          projectType: mockEstimationResult.input?.projectType,
          squareFootage: mockEstimationResult.input?.squareFootage,
          roomLayout: mockEstimationResult.floorPlanAnalysis?.rooms || [],
          electricalElements: mockEstimationResult.electricalMarkup || [],
          proposedCircuits: mockEstimationResult.calculations?.circuits || [],
          panelSpecifications: mockEstimationResult.calculations?.panel || {}
        });
      });
    });
  });

  describe('BoardView Integration', () => {
    const mockBoardItems = [
      { ...mockBoardItem, id: '1', name: 'Project 1' },
      { ...mockBoardItem, id: '2', name: 'Project 2' },
      { ...mockBoardItem, id: '3', name: 'Project 3' }
    ];

    test('should load and display board items', async () => {
      MondayService.getBoardItems = jest.fn().mockResolvedValue(mockBoardItems);

      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      // Navigate to BoardView
      window.history.pushState({}, 'Board View', '/board-view');
      
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText('Estimation Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Project 1')).toBeInTheDocument();
        expect(screen.getByText('Project 2')).toBeInTheDocument();
        expect(screen.getByText('Project 3')).toBeInTheDocument();
      });

      expect(MondayService.getBoardItems).toHaveBeenCalledWith(
        mockContext.boardId,
        { limit: 100 }
      );
    });

    test('should handle batch estimation workflow', async () => {
      MondayService.getBoardItems = jest.fn().mockResolvedValue(mockBoardItems);
      N8NService.triggerBatchWorkflows = jest.fn().mockResolvedValue([
        { id: '1', type: 'estimation', success: true, result: mockEstimationResult },
        { id: '2', type: 'estimation', success: true, result: mockEstimationResult },
        { id: '3', type: 'estimation', success: false, error: 'Timeout error' }
      ]);

      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      window.history.pushState({}, 'Board View', '/board-view');
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText('Estimation Dashboard')).toBeInTheDocument();
      });

      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // First item checkbox
      fireEvent.click(checkboxes[2]); // Second item checkbox

      // Trigger batch estimation
      const batchButton = screen.getByRole('button', { name: /Generate Estimates/i });
      fireEvent.click(batchButton);

      await waitFor(() => {
        expect(N8NService.triggerBatchWorkflows).toHaveBeenCalledWith([
          {
            id: '1',
            type: 'estimation',
            payload: expect.objectContaining({
              projectId: '1',
              source: 'monday-batch-board-view'
            })
          },
          {
            id: '2',
            type: 'estimation',
            payload: expect.objectContaining({
              projectId: '2',
              source: 'monday-batch-board-view'
            })
          }
        ]);
      });
    });
  });

  describe('IntegrationView Integration', () => {
    test('should test N8N connection successfully', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        set: jest.fn().mockResolvedValue({}),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      window.history.pushState({}, 'Integration View', '/integration-view');
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText('N8N Integration')).toBeInTheDocument();
      });

      // Test connection
      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(N8NService.testConnection).toHaveBeenCalled();
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    test('should save N8N configuration', async () => {
      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        set: jest.fn().mockResolvedValue({}),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      window.history.pushState({}, 'Integration View', '/integration-view');
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText('N8N Integration')).toBeInTheDocument();
      });

      // Update configuration
      const urlInput = screen.getByLabelText(/N8N Instance URL/i);
      fireEvent.change(urlInput, { target: { value: 'https://new-n8n-instance.com' } });

      const apiKeyInput = screen.getByLabelText(/API Key/i);
      fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });

      // Save configuration
      const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockMonday.set).toHaveBeenCalledWith('settings', {
          n8n_instance_url: 'https://new-n8n-instance.com',
          api_key: 'new-api-key',
          integration_enabled: true
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle N8N workflow failures gracefully', async () => {
      N8NService.triggerEstimationWorkflow = jest.fn().mockRejectedValue(
        new Error('N8N workflow timeout')
      );

      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText(/ElectricalAI Pro Estimator/i)).toBeInTheDocument();
      });

      // Submit estimation form
      const generateButton = screen.getByRole('button', { name: /Generate Estimate/i });
      fireEvent.click(generateButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Estimation failed: N8N workflow timeout/i)).toBeInTheDocument();
      });
    });

    test('should handle Monday API failures gracefully', async () => {
      MondayService.getItem = jest.fn().mockRejectedValue(
        new Error('Monday API Error: Item not found')
      );

      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Loading project data/i)).toBeInTheDocument();
      });

      // Should eventually show error state
      await waitFor(() => {
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle large board datasets efficiently', async () => {
      const largeBoardItems = Array.from({ length: 100 }, (_, i) => ({
        ...mockBoardItem,
        id: `item_${i}`,
        name: `Project ${i + 1}`
      }));

      MondayService.getBoardItems = jest.fn().mockResolvedValue(largeBoardItems);

      const mockMonday = {
        setToken: jest.fn(),
        get: jest.fn().mockImplementation((key) => {
          if (key === 'context') return Promise.resolve({ data: mockContext });
          if (key === 'settings') return Promise.resolve({ data: mockSettings });
          return Promise.resolve({ data: {} });
        }),
        api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
      };

      require('monday-sdk-js').default = jest.fn(() => mockMonday);

      window.history.pushState({}, 'Board View', '/board-view');
      
      const startTime = performance.now();
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(screen.getByText('Estimation Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Project 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large dataset in reasonable time (< 2 seconds)
      expect(renderTime).toBeLessThan(2000);
    });
  });
});

describe('End-to-End Workflow Tests', () => {
  test('should complete full estimation workflow with file upload', async () => {
    // Mock all services for complete workflow
    const mockMonday = {
      setToken: jest.fn(),
      get: jest.fn().mockImplementation((key) => {
        if (key === 'context') return Promise.resolve({ data: mockContext });
        if (key === 'settings') return Promise.resolve({ data: mockSettings });
        return Promise.resolve({ data: {} });
      }),
      api: jest.fn().mockResolvedValue({ data: { me: mockUser } })
    };

    require('monday-sdk-js').default = jest.fn(() => mockMonday);

    MondayService.uploadFile = jest.fn().mockResolvedValue({
      id: 'file_123',
      name: 'floor-plan.pdf',
      url: 'https://files.monday.com/floor-plan.pdf'
    });

    N8NService.triggerFloorPlanAnalysis = jest.fn().mockResolvedValue({
      success: true,
      analysis: {
        rooms: [
          { name: 'Living Room', outlets: 6, switches: 3 },
          { name: 'Kitchen', outlets: 8, switches: 2 }
        ],
        totalOutlets: 14,
        totalSwitches: 5
      }
    });

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByText(/ElectricalAI Pro Estimator/i)).toBeInTheDocument();
    });

    // Upload floor plan
    const file = new File(['floor plan'], 'floor-plan.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Drop files here/i);
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(MondayService.uploadFile).toHaveBeenCalledWith(file, mockContext.itemId);
      expect(screen.getByText('floor-plan.pdf')).toBeInTheDocument();
    });

    // Fill form and submit
    const squareFootageInput = screen.getByLabelText(/Square Footage/i);
    fireEvent.change(squareFootageInput, { target: { value: '2500' } });

    const generateButton = screen.getByRole('button', { name: /Generate Estimate/i });
    fireEvent.click(generateButton);

    // Verify complete workflow
    await waitFor(() => {
      expect(N8NService.triggerEstimationWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedFiles: [
            {
              name: 'floor-plan.pdf',
              url: 'https://files.monday.com/floor-plan.pdf',
              type: 'application/pdf',
              size: expect.any(Number)
            }
          ]
        })
      );
    });

    // Verify results display
    await waitFor(() => {
      expect(screen.getByText('$15,750.50')).toBeInTheDocument();
      expect(screen.getByText('COMPLIANT')).toBeInTheDocument();
    });
  });
});

// Test utilities
export const testUtils = {
  mockUser,
  mockContext,
  mockSettings,
  mockBoardItem,
  mockEstimationResult,
  renderWithProviders,
  createTestQueryClient
};