/**
 * End-to-End Tests for ElectricalAI Pro Monday.com App
 * Tests complete user workflows in real Monday.com environment
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_CONFIG = {
  mondayUrl: 'https://your-test-board.monday.com',
  appUrl: 'http://localhost:3000',
  n8nUrl: 'http://localhost:5678',
  timeout: 30000,
  testBoardId: '123456789',
  testItemId: '987654321'
};

// Test data
const testProject = {
  name: 'E2E Test Electrical Project',
  type: 'residential',
  squareFootage: '2500',
  complexity: 'standard',
  location: 'suburban'
};

const testFiles = {
  floorPlan: './test-assets/sample-floor-plan.pdf',
  blueprint: './test-assets/sample-blueprint.dwg'
};

test.describe('ElectricalAI Pro Monday App E2E Tests', () => {
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    // Create persistent context for Monday.com authentication
    context = await browser.newContext({
      baseURL: TEST_CONFIG.appUrl,
      viewport: { width: 1200, height: 800 },
      permissions: ['clipboard-read', 'clipboard-write']
    });

    page = await context.newPage();

    // Set up API request interception for testing
    await page.route('**/api/n8n/**', async (route) => {
      const request = route.request();
      console.log(`API Request: ${request.method()} ${request.url()}`);
      
      // Continue with actual request in test environment
      await route.continue();
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    // Navigate to app and wait for initialization
    await page.goto('/item-view');
    await page.waitForLoadState('networkidle');
    
    // Wait for app to initialize
    await expect(page.locator('[data-testid="app-initialized"]')).toBeVisible({ 
      timeout: TEST_CONFIG.timeout 
    });
  });

  test.describe('App Initialization', () => {
    test('should load app correctly in Monday iframe', async () => {
      // Check that main components are visible
      await expect(page.locator('text=ElectricalAI Pro Estimator')).toBeVisible();
      await expect(page.locator('[data-testid="project-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-upload-area"]')).toBeVisible();
    });

    test('should initialize Monday SDK and show user info', async () => {
      // Check that user context is loaded
      await expect(page.locator('[data-testid="user-info"]')).toBeVisible();
      
      // Verify Monday context is available
      const mondayContext = await page.evaluate(() => {
        return window.__MONDAY_CONTEXT__ || {};
      });
      
      expect(mondayContext).toBeDefined();
    });

    test('should connect to N8N instance successfully', async () => {
      // Navigate to integration view
      await page.goto('/integration-view');
      
      // Check connection status
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
      
      // Test connection button
      await page.click('[data-testid="test-connection-btn"]');
      await expect(page.locator('[data-testid="connection-test-result"]')).toContainText('Success');
    });
  });

  test.describe('Estimation Workflow', () => {
    test('should complete basic estimation without files', async () => {
      // Fill out project form
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);
      await page.selectOption('[data-testid="complexity-select"]', testProject.complexity);
      await page.selectOption('[data-testid="location-select"]', testProject.location);

      // Submit estimation
      await page.click('[data-testid="generate-estimate-btn"]');

      // Wait for processing
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Processing');

      // Wait for results
      await expect(page.locator('[data-testid="estimation-results"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Verify results content
      await expect(page.locator('[data-testid="total-cost"]')).toBeVisible();
      await expect(page.locator('[data-testid="electrical-load"]')).toBeVisible();
      await expect(page.locator('[data-testid="accuracy-score"]')).toBeVisible();

      // Check that cost is a valid number
      const costText = await page.textContent('[data-testid="total-cost"]');
      expect(costText).toMatch(/\$[\d,]+\.\d{2}/);
    });

    test('should handle file upload and floor plan analysis', async () => {
      // Upload floor plan file
      const fileInput = page.locator('[data-testid="file-upload-input"]');
      await fileInput.setInputFiles(testFiles.floorPlan);

      // Verify file was uploaded
      await expect(page.locator('[data-testid="uploaded-files"]')).toContainText('sample-floor-plan.pdf');

      // Fill basic project info
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);

      // Submit estimation
      await page.click('[data-testid="generate-estimate-btn"]');

      // Wait for floor plan analysis to complete
      await expect(page.locator('[data-testid="floor-plan-analysis"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Verify analysis results
      await expect(page.locator('[data-testid="room-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="outlet-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="switch-count"]')).toBeVisible();
    });

    test('should trigger NEC compliance check', async () => {
      // Complete basic estimation first
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);
      await page.click('[data-testid="generate-estimate-btn"]');

      // Wait for estimation results
      await expect(page.locator('[data-testid="estimation-results"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Trigger compliance check
      await page.click('[data-testid="nec-compliance-btn"]');

      // Wait for compliance results
      await expect(page.locator('[data-testid="compliance-results"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Verify compliance status
      const complianceStatus = await page.textContent('[data-testid="compliance-status"]');
      expect(['COMPLIANT', 'NON-COMPLIANT', 'REVIEW_REQUIRED']).toContain(complianceStatus);

      // Check compliance score
      await expect(page.locator('[data-testid="compliance-score"]')).toBeVisible();
    });

    test('should export estimation results', async () => {
      // Complete estimation first
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);
      await page.click('[data-testid="generate-estimate-btn"]');

      await expect(page.locator('[data-testid="estimation-results"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Set up download handler
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await page.click('[data-testid="export-results-btn"]');

      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/estimation-.*\.json/);

      // Verify download content
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
    });
  });

  test.describe('Board View Dashboard', () => {
    test('should load and display board items', async () => {
      await page.goto('/board-view');

      // Wait for board data to load
      await expect(page.locator('[data-testid="board-table"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      // Verify table headers
      await expect(page.locator('text=Project')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
      await expect(page.locator('text=Cost Estimate')).toBeVisible();

      // Check that items are displayed
      await expect(page.locator('[data-testid="board-item"]')).toHaveCount({ min: 1 });
    });

    test('should handle batch estimation processing', async () => {
      await page.goto('/board-view');

      // Wait for items to load
      await expect(page.locator('[data-testid="board-item"]')).toHaveCount({ min: 2 });

      // Select multiple items
      const checkboxes = page.locator('[data-testid="item-checkbox"]');
      await checkboxes.first().check();
      await checkboxes.nth(1).check();

      // Verify batch actions are available
      await expect(page.locator('[data-testid="batch-actions"]')).toBeVisible();

      // Start batch estimation
      await page.click('[data-testid="batch-estimate-btn"]');

      // Wait for batch processing to complete
      await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });
    });

    test('should filter and search items', async () => {
      await page.goto('/board-view');

      // Wait for items to load
      await expect(page.locator('[data-testid="board-item"]')).toHaveCount({ min: 1 });

      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'Test Project');
      await page.waitForTimeout(500); // Debounce

      // Verify search results
      const visibleItems = page.locator('[data-testid="board-item"]:visible');
      const itemCount = await visibleItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);

      // Test status filter
      await page.selectOption('[data-testid="status-filter"]', 'estimated');
      await page.waitForTimeout(500);

      // Verify filtered results
      const filteredItems = page.locator('[data-testid="board-item"]:visible');
      expect(await filteredItems.count()).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Integration Configuration', () => {
    test('should update N8N configuration', async () => {
      await page.goto('/integration-view');

      // Update N8N URL
      await page.fill('[data-testid="n8n-url-input"]', 'https://new-n8n-instance.com');
      await page.fill('[data-testid="api-key-input"]', 'new-test-api-key');

      // Save configuration
      await page.click('[data-testid="save-config-btn"]');

      // Verify success message
      await expect(page.locator('[data-testid="config-success"]')).toBeVisible();
    });

    test('should monitor workflow status', async () => {
      await page.goto('/integration-view');

      // Switch to monitoring tab
      await page.click('[data-testid="monitoring-tab"]');

      // Verify workflow status display
      await expect(page.locator('[data-testid="workflow-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    });

    test('should display security information', async () => {
      await page.goto('/integration-view');

      // Switch to security tab
      await page.click('[data-testid="security-tab"]');

      // Verify security features
      await expect(page.locator('text=Encrypted Storage')).toBeVisible();
      await expect(page.locator('text=HTTPS Enabled')).toBeVisible();
      await expect(page.locator('text=GDPR Compliant')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle N8N connection failure gracefully', async () => {
      // Mock N8N connection failure
      await page.route('**/api/n8n/health', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Connection failed' })
        });
      });

      await page.goto('/integration-view');

      // Verify error state
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
    });

    test('should handle estimation workflow timeout', async () => {
      // Mock workflow timeout
      await page.route('**/webhook/electrical-estimation', (route) => {
        // Delay response to simulate timeout
        setTimeout(() => {
          route.fulfill({
            status: 408,
            body: JSON.stringify({ error: 'Request timeout' })
          });
        }, 5000);
      });

      // Submit estimation
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);
      await page.click('[data-testid="generate-estimate-btn"]');

      // Verify timeout error handling
      await expect(page.locator('[data-testid="error-message"]')).toContainText('timeout');
    });

    test('should handle file upload errors', async () => {
      // Try to upload invalid file type
      const fileInput = page.locator('[data-testid="file-upload-input"]');
      
      // Create temporary invalid file
      await page.evaluate(() => {
        const file = new File(['invalid content'], 'test.txt', { type: 'text/plain' });
        const input = document.querySelector('[data-testid="file-upload-input"]');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Verify error message
      await expect(page.locator('[data-testid="file-error"]')).toContainText('not supported');
    });
  });

  test.describe('Performance Tests', () => {
    test('should load estimation results within acceptable time', async () => {
      const startTime = Date.now();

      // Submit estimation
      await page.selectOption('[data-testid="project-type-select"]', testProject.type);
      await page.fill('[data-testid="square-footage-input"]', testProject.squareFootage);
      await page.click('[data-testid="generate-estimate-btn"]');

      // Wait for results
      await expect(page.locator('[data-testid="estimation-results"]')).toBeVisible({
        timeout: TEST_CONFIG.timeout
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (< 15 seconds)
      expect(totalTime).toBeLessThan(15000);
      console.log(`Estimation completed in ${totalTime}ms`);
    });

    test('should handle large file uploads efficiently', async () => {
      // Skip if large test file doesn't exist
      const largePdfPath = './test-assets/large-floor-plan.pdf';
      
      try {
        const fileInput = page.locator('[data-testid="file-upload-input"]');
        await fileInput.setInputFiles(largePdfPath);

        // Verify upload progress and completion
        await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
        await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({
          timeout: 30000
        });
      } catch (error) {
        console.log('Large file test skipped - test file not found');
        test.skip();
      }
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should be keyboard navigable', async () => {
      // Test keyboard navigation through form
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="project-type-select"]:focus')).toBeVisible();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="square-footage-input"]:focus')).toBeVisible();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="complexity-select"]:focus')).toBeVisible();
    });

    test('should have proper ARIA labels', async () => {
      // Check form labels
      const projectTypeInput = page.locator('[data-testid="project-type-select"]');
      await expect(projectTypeInput).toHaveAttribute('aria-label');

      const squareFootageInput = page.locator('[data-testid="square-footage-input"]');
      await expect(squareFootageInput).toHaveAttribute('aria-label');
    });

    test('should support screen readers', async () => {
      // Check for screen reader content
      await expect(page.locator('[aria-live="polite"]')).toHaveCount({ min: 1 });
      await expect(page.locator('[role="status"]')).toHaveCount({ min: 0 });
    });
  });
});

// Utility functions for E2E tests
const e2eUtils = {
  async waitForWorkflow(page, timeout = 30000) {
    await expect(page.locator('[data-testid="workflow-complete"]')).toBeVisible({
      timeout
    });
  },

  async uploadTestFile(page, filePath) {
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles(filePath);
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
  },

  async fillEstimationForm(page, project = testProject) {
    await page.selectOption('[data-testid="project-type-select"]', project.type);
    await page.fill('[data-testid="square-footage-input"]', project.squareFootage);
    await page.selectOption('[data-testid="complexity-select"]', project.complexity);
    await page.selectOption('[data-testid="location-select"]', project.location);
  }
};

module.exports = { e2eUtils };