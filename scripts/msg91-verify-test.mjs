#!/usr/bin/env node
console.error("Disabled: direct provider testing bypasses the staging authentication protections. Use the staging app; never substitute retry for OTP verification.");
process.exit(1);
/**
 * MSG91 Verify OTP Endpoint Test
 * 
 * Tests the Verify OTP API separately since it was returning HTTP 500.
 * 
 * Usage: 
 *   set MSG91_AUTH_KEY=your_key && node scripts/msg91-verify-test.mjs
 */

const https = require('https');

function msg91Request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const authKey = process.env.MSG91_AUTH_KEY;
    
    if (!authKey) {
      reject(new Error("MSG91_AUTH_KEY environment variable not set"));
      return;
    }

    const options = {
      hostname: 'control.msg91.com',
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
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
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

async function testVerifyOTP() {
  console.log("MSG91 VERIFY OTP ENDPOINT TEST");
  console.log("=".repeat(60) + "\n");

  // First, send an OTP
  console.log("1. Sending test OTP...");
  try {
    const sendResult = await msg91Request('/api/v5/otp?mobile=919999999999&template_id=6a9e95cd898618ba1a007d22&otp_length=4&otp_expiry=5', 'POST', {});
    
    console.log(`   Status: ${sendResult.status}`);
    console.log(`   Response: ${JSON.stringify(sendResult.data)}`);
    
    if (sendResult.status === 200 && sendResult.data.type === 'success') {
      console.log("   ✓ Send successful, request_id:", sendResult.data.request_id);
      console.log("   Note: OTP is 1234 (test mode) or actual sent OTP\n");
    } else {
      console.log(`   ❌ Send failed: ${sendResult.data.message || 'Unknown error'}`);
      console.log("\nIf send is failing, the verify test won't work either.");
      return;
    }
  } catch (err) {
    console.log(`   ❌ Send error: ${err.message}`);
    return;
  }

  // Test verify with wrong OTP first (should fail)
  console.log("2. Testing verify with WRONG OTP (1234 - should fail)...");
  try {
    const verifyWrong = await msg91Request('/api/v5/otp/verify?mobile=919999999999&otp=1234', 'GET');
    
    console.log(`   Status: ${verifyWrong.status}`);
    console.log(`   Response: ${JSON.stringify(verifyWrong.data)}`);
    
    if (verifyWrong.status === 200 && verifyWrong.data.type === 'success') {
      console.log("   ⚠️  OTP verification succeeded with wrong code - this is unexpected!");
    } else if (verifyWrong.data.type === 'error') {
      console.log("   ✓ Correctly rejected wrong OTP");
      console.log(`   Error message: ${verifyWrong.data.message || verifyWrong.data.error}`);
    } else {
      console.log(`   ⚠️  Unexpected response format`);
    }
  } catch (err) {
    console.log(`   ❌ Verify error: ${err.message}`);
    console.log("   This might be the HTTP 500 issue mentioned!");
  }

  console.log("\n3. Testing verify endpoint directly (no send)...");
  try {
    const verifyDirect = await msg91Request('/api/v5/otp/verify?mobile=919999999999&otp=0000', 'GET');
    
    console.log(`   Status: ${verifyDirect.status}`);
    console.log(`   Response: ${JSON.stringify(verifyDirect.data)}`);
    
    if (verifyDirect.status === 500 || verifyDirect.status === 404) {
      console.log("   ❌ Verify endpoint returns error - THIS IS THE BUG!");
      console.log("   Possible causes:");
      console.log("   - MSG91 account doesn't have verify API enabled");
      console.log("   - Template not configured for OTP verification");
      console.log("   - API key lacks verify permission");
    } else if (verifyDirect.status === 200) {
      console.log("   ✓ Verify endpoint is working");
    } else {
      console.log("   ⚠️  Unexpected status code");
    }
  } catch (err) {
    console.log(`   ❌ Verify error: ${err.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("INVESTIGATION NOTES");
  console.log("=".repeat(60));
  console.log("If Verify OTP returns HTTP 500:");
  console.log("1. Check MSG91 Dashboard → API → Verify OTP is enabled");
  console.log("2. Verify the template supports OTP verification");
  console.log("3. Check if MSG91 account has OTP verification feature");
  console.log("4. Some MSG91 accounts only have 'Send OTP' not 'Verify OTP'");
  console.log("\nAlternative: Use MSG91's retry API instead of verify for some flows.");
  console.log("=".repeat(60));
}

testVerifyOTP().catch(err => {
  console.error("\n❌ Script Error:", err.message);
  process.exit(1);
});
