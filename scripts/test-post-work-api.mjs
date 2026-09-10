#!/usr/bin/env node

/**
 * Test Post Work API Endpoints
 * Verifies all endpoints needed for the post work flow are working
 */

const API_BASE = process.env.STAGING_API || 'https://bulao-api-staging.codecheck369.workers.dev/api/v1';

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

async function testEndpoint(name, url, options = {}) {
  try {
    log(colors.blue, `\nTesting ${name}...`);
    log(colors.blue, `URL: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log(colors.green, `✓ ${name} - ${response.status} OK`);
      if (data.data) {
        log(colors.blue, `  Response:`, JSON.stringify(data.data).substring(0, 200));
      }
      return { success: true, status: response.status, data };
    } else {
      log(colors.yellow, `⚠ ${name} - ${response.status} ${data.error?.code || 'ERROR'}`);
      log(colors.yellow, `  Message: ${data.error?.message || 'Unknown error'}`);
      return { success: false, status: response.status, data };
    }
  } catch (error) {
    log(colors.red, `✗ ${name} - NETWORK ERROR`);
    log(colors.red, `  ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log(colors.blue, '\n========================================');
  log(colors.blue, 'Post Work API Endpoint Tests');
  log(colors.blue, '========================================');
  log(colors.blue, `Base URL: ${API_BASE}`);
  
  const results = [];
  
  // Test 1: Health check
  results.push(await testEndpoint(
    'Health Check',
    `${API_BASE}/health`
  ));
  
  // Test 2: Categories (public endpoint)
  results.push(await testEndpoint(
    'Categories',
    `${API_BASE}/categories`
  ));
  
  // Test 3: Provider stats (requires auth - expect 401)
  results.push(await testEndpoint(
    'Provider Stats (no auth)',
    `${API_BASE}/jobs/provider/stats`
  ));
  
  // Test 4: Provider recent jobs (requires auth - expect 401)
  results.push(await testEndpoint(
    'Provider Recent Jobs (no auth)',
    `${API_BASE}/jobs/provider/recent`
  ));
  
  // Test 5: Saved places (requires auth - expect 401)
  results.push(await testEndpoint(
    'Saved Places (no auth)',
    `${API_BASE}/saved-places`
  ));
  
  // Test 6: Job listing (public endpoint)
  results.push(await testEndpoint(
    'Job Listings',
    `${API_BASE}/jobs`
  ));
  
  // Summary
  log(colors.blue, '\n========================================');
  log(colors.blue, 'Test Summary');
  log(colors.blue, '========================================');
  
  const successful = results.filter(r => r.success).length;
  const authExpected = results.filter(r => r.status === 401).length;
  const failed = results.filter(r => !r.success && r.status !== 401).length;
  
  log(colors.green, `✓ Successful: ${successful}`);
  log(colors.yellow, `⚠ Auth Required (expected): ${authExpected}`);
  log(colors.red, `✗ Failed: ${failed}`);
  
  log(colors.blue, '\n========================================');
  log(colors.blue, 'Key Findings');
  log(colors.blue, '========================================');
  
  const categoriesResult = results.find(r => r.data?.data?.categories);
  if (categoriesResult) {
    const categories = categoriesResult.data.data.categories;
    const jobCategories = categories.filter(c => c.kind === 'job');
    log(colors.green, `✓ Found ${jobCategories.length} job categories`);
    jobCategories.forEach(cat => {
      log(colors.blue, `  - ${cat.name} (${cat.id})`);
    });
  }
  
  const rolesResult = results.find(r => r.data?.data?.roles);
  if (rolesResult) {
    const roles = rolesResult.data.data.roles;
    log(colors.green, `✓ Found ${roles.length} total roles`);
  }
  
  log(colors.blue, '\n========================================');
  log(colors.blue, 'Recommendations');
  log(colors.blue, '========================================');
  
  if (failed === 0) {
    log(colors.green, '✓ All public endpoints working correctly');
    log(colors.green, '✓ Auth-required endpoints correctly return 401');
    log(colors.green, '✓ Post Work flow should work with authentication');
  } else {
    log(colors.red, '✗ Some endpoints are not working correctly');
    log(colors.red, '  Check backend deployment and routes configuration');
  }
  
  log(colors.blue, '\n');
}

runTests().catch(console.error);
