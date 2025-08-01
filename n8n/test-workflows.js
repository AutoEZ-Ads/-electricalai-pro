#!/usr/bin/env node

// ElectricalAI Pro N8N Workflow Testing Script
// Tests both estimation and floor plan analysis workflows

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const N8N_BASE_URL = 'http://localhost:5678';
const TEST_RESULTS_DIR = './test-results';

// Ensure test results directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

/**
 * Test the electrical estimation workflow
 */
async function testEstimationWorkflow() {
  console.log('🔍 Testing Electrical Estimation Workflow...');
  
  const testData = {
    projectId: `TEST-EST-${Date.now()}`,
    projectType: 'residential',
    squareFootage: 2500,
    complexityLevel: 'standard',
    location: 'suburban',
    specialRequirements: ['smart_home_ready', 'ev_charging']
  };

  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${N8N_BASE_URL}/webhook/electrical-estimation`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ Estimation workflow completed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Total Cost: $${response.data.estimation?.totalCost || 'N/A'}`);
    console.log(`🔧 Total Load: ${response.data.technical?.totalLoad || 'N/A'} VA`);
    console.log(`📋 Accuracy: ${response.data.accuracy || 'N/A'}`);

    // Save test results
    const testResult = {
      workflow: 'electrical-estimation',
      status: 'success',
      duration,
      input: testData,
      output: response.data,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, `estimation-test-${testData.projectId}.json`),
      JSON.stringify(testResult, null, 2)
    );

    return testResult;

  } catch (error) {
    console.error('❌ Estimation workflow failed:', error.message);
    
    if (error.response?.status === 404) {
      console.log('💡 Hint: Make sure the workflow is imported and activated in N8N');
    }

    const testResult = {
      workflow: 'electrical-estimation',
      status: 'failed',
      error: error.message,
      statusCode: error.response?.status,
      input: testData,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, `estimation-test-failed-${testData.projectId}.json`),
      JSON.stringify(testResult, null, 2)
    );

    return testResult;
  }
}

/**
 * Test the floor plan analysis workflow
 */
async function testFloorPlanWorkflow() {
  console.log('🏠 Testing Floor Plan Analysis Workflow...');
  
  // Create a simple test image (base64 encoded 1x1 pixel PNG)
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  
  const FormData = require('form-data');
  const form = new FormData();
  
  const projectId = `TEST-FP-${Date.now()}`;
  form.append('projectId', projectId);
  form.append('metadata', JSON.stringify({
    projectType: 'residential',
    description: 'Test floor plan analysis'
  }));
  
  // Convert base64 to buffer
  const base64Data = testImageBase64.split(',')[1];
  const imageBuffer = Buffer.from(base64Data, 'base64');
  form.append('file', imageBuffer, {
    filename: `test-floor-plan-${projectId}.png`,
    contentType: 'image/png'
  });

  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${N8N_BASE_URL}/webhook/floor-plan-upload`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 60000
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ Floor plan analysis workflow completed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔌 Total Elements: ${response.data.analysis?.totalElements || 'N/A'}`);
    console.log(`⚡ Estimated Load: ${response.data.analysis?.estimatedLoad || 'N/A'} VA`);
    console.log(`📋 Compliance Score: ${response.data.analysis?.complianceScore || 'N/A'}%`);

    // Save test results
    const testResult = {
      workflow: 'floor-plan-analysis',
      status: 'success',
      duration,
      input: {
        projectId,
        hasImage: true,
        imageSize: imageBuffer.length
      },
      output: response.data,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, `floor-plan-test-${projectId}.json`),
      JSON.stringify(testResult, null, 2)
    );

    return testResult;

  } catch (error) {
    console.error('❌ Floor plan analysis workflow failed:', error.message);
    
    if (error.response?.status === 404) {
      console.log('💡 Hint: Make sure the workflow is imported and activated in N8N');
    }

    const testResult = {
      workflow: 'floor-plan-analysis',
      status: 'failed',
      error: error.message,
      statusCode: error.response?.status,
      input: {
        projectId,
        hasImage: true,
        imageSize: imageBuffer.length
      },
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, `floor-plan-test-failed-${projectId}.json`),
      JSON.stringify(testResult, null, 2)
    );

    return testResult;
  }
}

/**
 * Test N8N system health
 */
async function testSystemHealth() {
  console.log('🏥 Testing N8N System Health...');
  
  try {
    const response = await axios.get(`${N8N_BASE_URL}/healthz`, {
      timeout: 5000
    });

    console.log('✅ N8N system is healthy');
    console.log(`📊 Status: ${response.status}`);
    
    return {
      status: 'healthy',
      statusCode: response.status,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ N8N system health check failed:', error.message);
    
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate test report
 */
function generateTestReport(results) {
  console.log('\n📋 TEST REPORT SUMMARY');
  console.log('='.repeat(50));
  
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.status === 'success').length;
  const failedTests = results.filter(r => r.status === 'failed').length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${Math.round((successfulTests / totalTests) * 100)}%`);
  
  if (successfulTests === totalTests) {
    console.log('\n🎉 All tests passed! N8N workflows are ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the issues above and ensure workflows are properly imported and activated.');
  }
  
  // Save comprehensive test report
  const report = {
    summary: {
      totalTests,
      successfulTests,
      failedTests,
      successRate: Math.round((successfulTests / totalTests) * 100)
    },
    results,
    timestamp: new Date().toISOString(),
    environment: {
      n8nUrl: N8N_BASE_URL,
      nodeVersion: process.version,
      platform: process.platform
    }
  };
  
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, `test-report-${Date.now()}.json`),
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n📄 Detailed test report saved to: ${TEST_RESULTS_DIR}`);
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 ElectricalAI Pro N8N Workflow Testing');
  console.log('=' .repeat(50));
  console.log(`🌐 N8N URL: ${N8N_BASE_URL}`);
  console.log(`📁 Results Dir: ${TEST_RESULTS_DIR}`);
  console.log('');

  const results = [];

  // Test system health first
  const healthResult = await testSystemHealth();
  results.push(healthResult);
  console.log('');

  // Test estimation workflow
  const estimationResult = await testEstimationWorkflow();
  results.push(estimationResult);
  console.log('');

  // Test floor plan workflow
  const floorPlanResult = await testFloorPlanWorkflow();
  results.push(floorPlanResult);
  console.log('');

  // Generate report
  generateTestReport(results);
}

// Execute tests if run directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testEstimationWorkflow,
  testFloorPlanWorkflow,
  testSystemHealth,
  runTests
};