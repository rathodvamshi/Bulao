#!/usr/bin/env node
/**
 * Auth endpoint smoke test. Checks health, validation and unsigned access only.
 * Does NOT prove SMS delivery, successful verification or D1 session creation.
 */

const base = 'https://bulao-api-staging.codecheck369.workers.dev';
const results = [];

async function test(name, method, path, body, expectedStatus) {
  try {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8082' },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error'
    });
    const data = await response.json().catch(() => ({}));
    results.push({
      name,
      method,
      path,
      status: response.status,
      expected: expectedStatus,
      pass: response.status === expectedStatus,
      code: data.error?.code || 'N/A'
    });
    console.log(`${response.status === expectedStatus ? '✅' : '❌'} ${method} ${path} - ${name} (got ${response.status}, expected ${expectedStatus})`);
  } catch (error) {
    results.push({ name, method, path, status: 'ERROR', expected: expectedStatus, pass: false, error: error.message });
    console.log(`❌ ${method} ${path} - ${name} (ERROR: ${error.message})`);
  }
}

async function main() {
  console.log('Bulao auth smoke checks (no SMS or authenticated login)\n');
  console.log('='.repeat(60));
  
  // Health check
  await test('Health Check', 'GET', '/api/v1/health', undefined, 200);
  
  // Auth endpoints - without auth (expect 401/400)
  await test('Send OTP (invalid phone)', 'POST', '/api/v1/auth/send-otp', { phone: '123' }, 400);
  await test('Verify OTP (invalid)', 'POST', '/api/v1/auth/verify-otp', { phone: '+919999999900', requestId: 'test-uuid', otp: '123' }, 400);
  await test('Resend OTP (missing)', 'POST', '/api/v1/auth/resend-otp', {}, 400);
  await test('Get Session (no auth)', 'GET', '/api/v1/auth/session', undefined, 401);
  await test('Get Me (no auth)', 'GET', '/api/v1/auth/me', undefined, 401);
  await test('Logout (no auth)', 'POST', '/api/v1/auth/logout', undefined, 401);
  
  console.log('='.repeat(60));
  console.log('\nSummary:');
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  console.log('Successful login, handset delivery and D1 session creation still require a real-phone integration test.');
  
  console.log('\nFailed tests:');
  results.filter(r => !r.pass).forEach(r => {
    console.log(`  - ${r.method} ${r.path}: got ${r.status}, expected ${r.expected}`);
  });
  
  process.exit(passed === total ? 0 : 1);
}

main();
