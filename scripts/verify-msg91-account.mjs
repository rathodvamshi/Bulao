#!/usr/bin/env node
console.error("Disabled: this legacy helper uses an unverified account endpoint and sends to an unauthorized test number. Inspect MSG91 account metadata in the dashboard; keep credentials in Worker Secrets.");
process.exit(1);
/**
 * MSG91 Account Verification Script
 * 
 * This script verifies which MSG91 account owns an Auth Key
 * without exposing the key in logs or terminal output.
 * 
 * Usage:
 *   node scripts/verify-msg91-account.mjs YOUR_AUTH_KEY
 * 
 * The Auth Key is not printed or logged - only account details are shown.
 */

// Check if Auth Key was provided as argument or environment variable
const authKey = process.argv[2] || process.env.MSG91_AUTH_KEY;

if (!authKey) {
  console.error("Error: MSG91 Auth Key is required.");
  console.error("Provide it as:");
  console.error("  1. Command-line argument: node scripts/verify-msg91-account.mjs YOUR_AUTH_KEY");
  console.error("  2. Environment variable: set MSG91_AUTH_KEY=YOUR_AUTH_KEY && node scripts/verify-msg91-account.mjs");
  process.exit(1);
}

// Validate Auth Key format (MSG91 keys are typically 20-40 characters, alphanumeric)
if (authKey.length < 20 || authKey.length > 50) {
  console.error("Warning: Auth Key length seems unusual. MSG91 keys are typically 20-50 characters.");
}

async function verifyAccount() {
  console.log("Querying MSG91 account API...\n");
  
  try {
    // Call MSG91's account API to get account details
    // This endpoint returns account information without exposing the key
    const response = await fetch("https://api.msg91.com/api/v5/account", {
      method: "GET",
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error Response:");
      console.error(JSON.stringify(data, null, 2));
      
      // Common error codes
      if (data.type === "error" || data.code === 101) {
        console.error("\n⚠️  The Auth Key is invalid or belongs to a different account.");
      } else if (response.status === 401 || response.status === 403) {
        console.error("\n⚠️  Authentication failed. The Auth Key may be incorrect.");
      }
      process.exit(1);
    }

    console.log("✅ MSG91 Account Details:");
    console.log("=".repeat(50));
    
    // Display account information (safe fields only)
    if (data.account) {
      console.log(`Account Name: ${data.account.name || 'Not available'}`);
      console.log(`Account ID: ${data.account.id || data.account._id || 'Not available'}`);
      console.log(`Account Email: ${data.account.email || 'Not available'}`);
      console.log(`Account Type: ${data.account.type || 'Not available'}`);
    } else if (data.data && data.data.account) {
      console.log(`Account Name: ${data.data.account.name || 'Not available'}`);
      console.log(`Account ID: ${data.data.account.id || 'Not available'}`);
    } else {
      // Response format varies - display what we have
      console.log("Raw Account Response:");
      console.log(JSON.stringify(data, null, 2));
    }
    
    console.log("=".repeat(50));
    
    // Check if this matches expected account (based on user input)
    console.log("\nIf this account does not match your MSG91 dashboard, the Auth Key");
    console.log("in Cloudflare belongs to a different MSG91 account/sub-account.");
    console.log("\nTo fix:");
    console.log("1. Get the correct Auth Key from the desired MSG91 account");
    console.log("2. Update the staging Worker: npx wrangler secret put MSG91_AUTH_KEY --env staging");
    console.log("3. Deploy: npx wrangler deploy --env staging");
    
    // Verify OTP service is available
    console.log("\n" + "=".repeat(50));
    console.log("Verifying OTP service availability...\n");
    
    const otpResponse = await fetch(`https://control.msg91.com/api/v5/otp?mobile=919999999999&template_id=6a9e95cd898618ba1a007d22&otp_length=4&otp_expiry=5`, {
      method: "POST",
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json"
      }
    });
    
    const otpData = await otpResponse.json();
    
    console.log("OTP API Test Response:");
    console.log(`Status: ${otpResponse.status}`);
    console.log(`Response: ${JSON.stringify(otpData)}`);
    
    if (otpData.request_id && otpData.type === "success") {
      console.log("\n✅ OTP service is working correctly with this Auth Key.");
    } else if (otpData.type === "error") {
      console.log(`\n❌ OTP service error: ${otpData.message || otpData.error}`);
    }

  } catch (error) {
    console.error("Error connecting to MSG91 API:");
    console.error(error.message);
    console.error("\nPlease check your internet connection and try again.");
    process.exit(1);
  }
}

verifyAccount().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
