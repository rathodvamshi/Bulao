#!/usr/bin/env node

const BASE_URL = "https://bulao-api-staging.codecheck369.workers.dev/api/v1";

// Test job posting with correct schema
const testJobPost = async () => {
  console.log("Testing job POST endpoint...\n");
  
  const jobData = {
    categoryId: "food",
    roleId: "kitchen-helper",
    title: "Kitchen Helper needed",
    workers: 2,
    experience: "any",
    latitude: 17.4065,
    longitude: 78.4772,
    area: "Miyapur",
    address: "Near XYZ mall",
    startsAt: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
    duration: "one",
    endsAt: null,
    hours: "full",
    startTime: "09:00",
    endTime: "17:00",
    payPaise: 100000, // 1000 rupees
    payUnit: "day",
    paidWhen: "after",
    extras: ["🍽️ Meals"],
    details: "Need help with kitchen work",
    submissionKey: `test-${Date.now()}`,
  };

  console.log("Job data:", JSON.stringify(jobData, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jobData),
    });

    const result = await response.json();
    
    console.log(`\nStatus: ${response.status}`);
    console.log("Response:", JSON.stringify(result, null, 2));

    if (response.status === 401) {
      console.log("\n✓ Expected 401 (requires authentication)");
    } else if (response.status === 400) {
      console.log("\n⚠ Validation error - check the error details above");
    } else if (response.status === 500) {
      console.log("\n✗ Server error - check backend logs");
    } else if (response.status === 200) {
      console.log("\n✓ Job posted successfully!");
    }
  } catch (error) {
    console.error("Network error:", error.message);
  }
};

testJobPost();
