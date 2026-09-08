#!/usr/bin/env node
/**
 * Direct MSG91 API Test
 * Tests if the AuthKey works outside Cloudflare
 * 
 * Usage: node scripts/test-msg91-direct.mjs YOUR_AUTH_KEY
 */

const args = process.argv.slice(2)
const AUTH_KEY = args[0]
const PHONE = "917569408235"  // Your test number
const TEMPLATE_ID = "6a9e95cd898618ba1a007d22"

if (!AUTH_KEY) {
  console.error("❌ Error: AuthKey required")
  console.error("Usage: node scripts/test-msg91-direct.mjs YOUR_AUTH_KEY")
  console.error("\nExample:")
  console.error("  node scripts/test-msg91-direct.mjs 568607ArFur3YZKEn6a9fc3a7P1")
  process.exit(1)
}

console.log("=" .repeat(60))
console.log("MSG91 Direct API Test")
console.log("=" .repeat(60))
console.log("Template ID:", TEMPLATE_ID)
console.log("Phone:", PHONE)
console.log("AuthKey (last 8 chars):", AUTH_KEY.slice(-8))
console.log("=" .repeat(60))
console.log()

async function testSend() {
  console.log("📤 Sending OTP request...")
  
  const url = `https://control.msg91.com/api/v5/otp?mobile=${PHONE.slice(1)}&template_id=${TEMPLATE_ID}&otp_length=4&otp_expiry=5`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authkey": AUTH_KEY,
      "Content-Type": "application/json"
    }
  })
  
  const data = await response.json()
  
  console.log("HTTP Status:", response.status)
  console.log("Response:", JSON.stringify(data, null, 2))
  
  if (data.request_id && data.type === "success") {
    console.log("\n✅ MSG91 accepted the request")
    console.log("Request ID:", data.request_id)
    console.log("\n📱 Check your phone for SMS...")
    console.log("   If SMS arrives → AuthKey is working")
    console.log("   If no SMS → Check MSG91 dashboard or contact support")
    return data.request_id
  } else {
    console.log("\n❌ MSG91 rejected the request")
    console.log("Error:", data.message || "Unknown error")
    return null
  }
}

async function testVerify(requestId, otp) {
  console.log("\n📥 Verifying OTP...")
  
  const url = `https://control.msg91.com/api/v5/otp/verify?mobile=${PHONE.slice(1)}&otp=${otp}`
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "authkey": AUTH_KEY,
      "Content-Type": "application/json"
    }
  })
  
  const data = await response.json()
  
  console.log("HTTP Status:", response.status)
  console.log("Response:", JSON.stringify(data, null, 2))
  
  return data.type === "success" && data.message === "OTP verified success"
}

async function main() {
  const requestId = await testSend()
  
  if (requestId) {
    console.log("\n" + "=".repeat(60))
    console.log("OTP was sent! Now verify it:")
    console.log("=".repeat(60))
    console.log("\n1. Check your phone for the 4-digit code")
    console.log("2. Run: node scripts/test-msg91-direct.mjs", AUTH_KEY, requestId, "YOUR_OTP")
    console.log("\nOr I'll wait for you to enter it...")
    
    // Simple manual verification
    console.log("\nEnter the OTP you received (or press Enter to skip):")
    process.stdout.write("> ")
  }
}

main().catch(console.error)