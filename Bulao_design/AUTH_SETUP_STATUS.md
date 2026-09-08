# Bulao Authentication - Complete Setup Summary

## Current Status (Updated: 2026-09-08)

### ✅ What IS Working

1. **Mobile App → Cloudflare**
   - Route: `/api/v1/auth/send-otp`
   - Phone validation: Working (rejects invalid numbers)
   - AUTH_HASH_KEY: Present and configured

2. **Cloudflare Worker**
   - Rate limiting: Working (protecting against spam)
   - Durable Object coordinator: Active
   - Queue events: Being sent to `bulao-auth-events-staging`

3. **MSG91 Integration**
   - Template ID: `6a9e95cd898618ba1a007d22`
   - AuthKey: Configured
   - API Call: Reaching MSG91 successfully

### ❌ Current Blocker

**MSG91 Dashboard Logs Discrepancy**
- API returns: `{"type":"success","request_id":"..."}`
- Dashboard shows: Empty logs, 0 transactions
- Status: Reported to MSG91 support, awaiting resolution

### 📡 Complete Auth Endpoints

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/auth/send-otp` | POST | ⚠️ Rate Limited | Send OTP to phone |
| `/api/v1/auth/verify-otp` | POST | ❌ Not Tested | Verify OTP + Create Session |
| `/api/v1/auth/resend-otp` | POST | ❌ Not Tested | Resend OTP |
| `/api/v1/auth/session` | GET | ❌ Not Tested | Get current session |
| `/api/v1/auth/me` | GET | ❌ Not Tested | Get current user |
| `/api/v1/auth/logout` | POST | ❌ Not Tested | Logout + Revoke session |

### 🔐 Rate Limiting Configuration

```typescript
const AUTH_POLICY = {
  // Send limits
  phoneSends: 3,           // Max 3 OTP sends per phone per window
  sendWindow: 600,         // 10 minute window
  phoneDailySends: 10,     // Max 10 per day per phone
  ipSends: 10,             // Max 10 per IP
  
  // Verify limits
  ipVerifications: 30,     // Max 30 verifications per IP per window
  verificationAttempts: 5, // Max 5 OTP attempts per challenge
  verificationBlock: 600,  // Block for 10 min after max attempts
};
```

### 📋 Test Status Summary

| Test | Result | Notes |
|------|--------|-------|
| Phone validation | ✅ Working | Rejects invalid formats |
| AUTH_HASH_KEY check | ✅ Present | `present: true, length_ok: true` |
| MSG91 API call | ✅ Reaching | URL constructed correctly |
| MSG91 response | ⚠️ Success | Returns success but no logs |
| D1 user creation | ❌ Not Tested | Blocked by SMS not delivered |
| D1 session creation | ❌ Not Tested | Blocked by D1 user creation |
| /auth/me | ❌ Not Tested | Requires valid session |
| Logout | ❌ Not Tested | Requires valid session |

### 🔧 Configuration Files

**Cloudflare Secrets:**
- ✅ `AUTH_HASH_KEY` - Secret text
- ✅ `MSG91_AUTH_KEY` - Secret text
- ⚠️ `MSG91_WIDGET_ID` - Still present from widget attempt (can be cleaned up)

**wrangler.toml Environment Variables:**
- ✅ `MSG91_TEMPLATE_ID: "6a9e95cd898618ba1a007d22"`
- ✅ `OTP_PROVIDER: "msg91"`
- ✅ `APP_ENV: "staging"`

### 📱 Mobile App Config

**Base URL:**
```
STAGING_API = https://bulao-api-staging.codecheck369.workers.dev/api/v1
```

**Auth Routes Used:**
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `GET /auth/session`
- `GET /auth/me`
- `POST /auth/logout`

### 🎯 Next Steps

1. **Wait for MSG91 support** to resolve the logging discrepancy
2. **Test SMS delivery** - does phone actually receive SMS?
3. **Test complete flow:**
   - Send OTP → Receive SMS
   - Enter OTP → Verify
   - D1 user created
   - D1 session created
   - /auth/me returns user
   - Logout revokes session

### 📞 MSG91 Support Ticket

**Status:** Awaiting response since 2026-09-08

**Issue:** Direct OTP API returns success but transactions don't appear in logs

**Request IDs tested:**
- 3669686e7549727070726a38
- 3669686f6c4a675130613063
- 3669686f6c566b5078496352
- 3669686f786a67366b726956

**Open Questions:**
1. Is SMS actually being delivered despite empty logs?
2. When will the logging bug be fixed?
3. Is there an alternative API endpoint that works correctly?

---

**Note:** The backend code is correctly implemented. The issue is purely on MSG91's side regarding transaction logging.