#!/usr/bin/env node

/**
 * Test script for /jobs/provider/recent endpoint
 * 
 * Usage:
 *   node scripts/test-provider-recent.mjs <AUTH_TOKEN>
 * 
 * Example:
 *   node scripts/test-provider-recent.mjs "your_session_token_here"
 */

const API_BASE = 'https://bulao-api-staging.codecheck369.workers.dev/api/v1';

async function testProviderRecent(token) {
  console.log('🧪 Testing /jobs/provider/recent endpoint...\n');
  
  if (!token) {
    console.error('❌ Error: No auth token provided');
    console.log('\nUsage: node scripts/test-provider-recent.mjs <AUTH_TOKEN>');
    process.exit(1);
  }

  try {
    const url = `${API_BASE}/jobs/provider/recent`;
    console.log(`📡 Calling: ${url}`);
    console.log(`🔑 Token: ${token.substring(0, 20)}...`);
    console.log('');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('\n📦 Response:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n✅ SUCCESS! Endpoint is working correctly.');
      
      if (Array.isArray(data.data)) {
        console.log(`\n📋 Found ${data.data.length} job(s)`);
        
        if (data.data.length > 0) {
          console.log('\n📄 Sample job:');
          const sample = data.data[0];
          console.log(`  - ID: ${sample.id}`);
          console.log(`  - Title: ${sample.title}`);
          console.log(`  - Status: ${sample.status}`);
          console.log(`  - Applicants: ${sample.applicantCount || 0}`);
        } else {
          console.log('  (No jobs posted yet)');
        }
      }
    } else {
      console.log('\n❌ FAILED! Endpoint returned error.');
      if (data.error) {
        console.log(`  Error Code: ${data.error.code}`);
        console.log(`  Message: ${data.error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Request failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Get token from command line argument
const token = process.argv[2];
testProviderRecent(token);
