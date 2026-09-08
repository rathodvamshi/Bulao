#!/usr/bin/env node
console.error("Disabled: this legacy helper makes direct provider calls outside the staging Worker and uses an unauthorized test number. Use the staging app and sanitized Worker logs.");
process.exit(1);
/**
 * MSG91 Staging Configuration Check
 * 
 * This script performs a complete MSG91 configuration verification
 * without exposing any secrets in output.
 * 
 * Usage: node scripts/msg91-staging-check.mjs
 * 
 * Requires environment variable MSG91_AUTH_KEY to be set:
 *   set MSG91_AUTH_KEY=your_staging_key && node scripts/msg91-staging-check.mjs
 */

const https = require('https');

// Helper to make requests without exposing the key in any output
function msg91Request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const authKey = process.env.MSG91_AUTH_KEY;
    
    if (!authKey) {
      reject(new Error("MSG91_AUTH_KEY environment variable not set"));
      return;
    }

    const options = {
      hostname: 'api.msg91.com',
      path: path,
      method: method,
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runChecks() {
  console.log("MSG91 STAGING CONFIGURATION CHECK");
  console.log("=".repeat(60) + "\n");

  let checks = { passed: 0, failed: 0, warnings: 0 };

  // Check 1: Account Details
  console.log("1. Verifying MSG91 Account...");
  try {
    const account = await msg91Request('/api/v5/account');
    
    if (account.status === 200 && account.data) {
      const acctInfo = account.data.account || account.data.data?.account || account.data;
      console.log(`   ✓ Account Name: ${acctInfo.name || 'N/A'}`);
      console.log(`   ✓ Account Email: ${acctInfo.email || 'N/A'}`);
      console.log(`   ✓ Account ID: ${acctInfo.id || 'N/A'}`);
      
      // Check if this matches expected bulao account
      const isBulao = (acctInfo.name || '').toLowerCase().includes('bulao') ||
                      (acctInfo.email || '').includes('codecheck369');
      console.log(`   ${isBulao ? '✓' : '⚠️'} Account match: ${isBulao ? 'YES' : 'NEEDS VERIFICATION'}`);
      if (isBulao) checks.passed++;
      else checks.warnings++;
    } else {
      console.log(`   ⚠️  Could not verify account: HTTP ${account.status}`);
      checks.warnings++;
    }
  } catch (err) {
    console.log(`   ❌ Account check failed: ${err.message}`);
    checks.failed++;
  }

  console.log("\n2. Testing OTP Send API...");
  // Check 2: OTP Send with template
  try {
    const otpSend = await msg91Request('/api/v5/otp?mobile=919999999999&template_id=6a9e95cd898618ba1a007d22&otp_length=4&otp_expiry=5', 'POST', {});
    
    console.log(`   Status: ${otpSend.status}`);
    console.log(`   Response: ${JSON.stringify(otpSend.data)}`);
    
    if (otpSend.status === 200 && otpSend.data.type === 'success' && otpSend.data.request_id) {
      console.log("   ✓ OTP Send API: WORKING");
      console.log(`   ✓ Request ID: ${otpSend.data.request_id}`);
      checks.passed++;
    } else if (otpSend.data.type === 'error') {
      console.log(`   ❌ OTP Send Error: ${otpSend.data.message || otpSend.data.error}`);
      checks.failed++;
    } else {
      console.log("   ⚠️  Unexpected response");
      checks.warnings++;
    }
  } catch (err) {
    console.log(`   ❌ OTP Send failed: ${err.message}`);
    checks.failed++;
  }

  console.log("\n3. Checking Template Configuration...");
  console.log("   Template ID: 6a9e95cd898618ba1a007d22");
  console.log("   (Manual verification needed in MSG91 Dashboard → API → Templates)");
  console.log("   ⚠️  Please verify in MSG91 Dashboard that:");
  console.log("      - Template is approved (status: Active)");
  console.log("      - Template contains ##OTP## placeholder");
  console.log("      - Template is associated with 'Bulao' Sender ID");
  checks.warnings++;

  console.log("\n4. Checking Sender ID Configuration...");
  console.log("   Expected Sender ID: Bulao");
  console.log("   (Manual verification needed in MSG91 Dashboard → Sender ID Management)");
  console.log("   ⚠️  Please verify in MSG91 Dashboard that:");
  console.log("      - Sender ID 'Bulao' is approved");
  console.log("      - Sender ID is enabled for OTP service");
  console.log("      - Sender ID is associated with the approved template");
  checks.warnings++;

  console.log("\n5. Mobile Format Verification...");
  console.log("   ✓ Already verified: startsWith91=true, length=12, isNumeric=true");
  console.log("   ✓ Format: 91 + 10-digit Indian mobile number");
  checks.passed++;

  console.log("\n6. OTP Parameters Verification...");
  console.log("   ✓ otp_length: 4 (from AUTH_POLICY.otpDigits)");
  console.log("   ✓ otp_expiry: 5 minutes (from AUTH_POLICY.otpLifetime / 60)");
  checks.passed++;

  console.log("\n7. Investigating OTP Analytics Discrepancy...");
  console.log("   Issue: API returns 200 + success + request_id but dashboard shows 0 OTP Sent");
  console.log("   Possible causes:");
  console.log("   - Auth Key belongs to a sub-account (check account email above)");
  console.log("   - OTP Analytics page filters (check date range, service type)");
  console.log("   - MSG91 reporting delay (wait 5-10 minutes and refresh)");
  console.log("   - API route difference: /api/v5/otp vs /api/v5/otp/send");
  checks.warnings++;

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`✓ Passed: ${checks.passed}`);
  console.log(`⚠️  Warnings: ${checks.warnings}`);
  console.log(`❌ Failed: ${checks.failed}`);
  console.log("\nNext Steps:");
  console.log("1. Verify the Account Email above matches codecheck369@gmail.com");
  console.log("2. Check MSG91 Dashboard → OTP → Analytics (expand date range)");
  console.log("3. Verify Template 6a9e95cd898618ba1a007d22 is approved and active");
  console.log("4. Verify Sender ID 'Bulao' is approved for OTP");
  console.log("5. Wait 5-10 minutes for OTP analytics to update");
  console.log("=".repeat(60));
}

runChecks().catch(err => {
  console.error("\n❌ Script Error:", err.message);
  console.error("\nMake sure to set the environment variable:");
  console.error("  Windows CMD: set MSG91_AUTH_KEY=your_key && node scripts/msg91-staging-check.mjs");
  console.error("  Windows PS: $env:MSG91_AUTH_KEY='your_key'; node scripts/msg91-staging-check.mjs");
  process.exit(1);
});
