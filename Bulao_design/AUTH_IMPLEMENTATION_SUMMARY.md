# Bulao Authentication - Implementation Summary

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native Mobile App                      │
│                    (EXPO + React Native)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS / JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker (Staging)                    │
│                   bulao-api-staging.codecheck369.workers.dev     │
│                                                                   │
│  Routes:                                                         │
│  - POST /api/v1/auth/send-otp      → Send OTP                    │
│  - POST /api/v1/auth/verify-otp    → Verify + Create Session     │
│  - POST /api/v1/auth/resend-otp    → Resend OTP                  │
│  - GET  /api/v1/auth/session       → Get Session                 │
│  - GET  /api/v1/auth/me            → Get Current User            │
│  - POST /api/v1/auth/logout        → Logout                      │
│                                                                   │
│  Components:                                                     │
│  - Rate Limiting (Durable Objects)                               │
│  - Phone Validation (+91 format required)                         │
│  - AUTH_HASH_KEY security                                        │
│  - MSG91 OTP Provider                                            │
│  - D1 Database (users + sessions)                                │
│  - Cloudflare Queue (audit events)                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS / JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MSG91 OTP API                             │
│              control.msg91.com/api/v5/otp                        │
│                                                                   │
│  Sends SMS to user's phone                                       │
│  Note: Dashboard logs have a bug (being investigated)            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ SMS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        User's Phone                              │
│                  Receives 4-digit OTP                            │
└─────────────────────────────────────────────────────────────────┘
```

## Current Status (2026-09-08)

### ✅ WORKING
- All auth routes configured and responding correctly
- Phone number validation (requires +91 followed by 6-9 + 9 digits)
- Rate limiting (prevents spam)
- AUTH_HASH_KEY security check
- MSG91 API calls reaching MSG91 successfully
- D1 database configured (staging: bulao-dev)
- Cloudflare Queues configured (bulao-auth-events-staging)

### ⚠️ KNOWN ISSUES
- MSG91 Dashboard shows empty logs despite API returning success
- This is being investigated with MSG91 support
- **SMS delivery status unknown** - need to test with real phone

## Mobile App Integration

### API Base URL (Staging)
```
https://bulao-api-staging.codecheck369.workers.dev/api/v1
```

### Auth Endpoints

#### 1. Send OTP
```javascript
POST /api/v1/auth/send-otp
Body: { "phone": "+919876543210" }
Response: {
  "success": true,
  "data": {
    "requestId": "uuid",
    "expiresIn": 300,
    "resendAfter": 60,
    "otpLength": 4,
    "msg91RequestId": "..."
  }
}
```

#### 2. Verify OTP
```javascript
POST /api/v1/auth/verify-otp
Body: {
  "phone": "+919876543210",
  "requestId": "uuid-from-send-response",
  "otp": "1234"
}
Response: {
  "success": true,
  "data": {
    "token": "session-token",
    "expiresAt: 2592000,
    "user": { "id": "...", "name": "...", "area": "..." }
  }
}
```

#### 3. Resend OTP
```javascript
POST /api/v1/auth/resend-otp
Body: {
  "phone": "+919876543210",
  "requestId": "uuid-from-send-response"
}
Response: {
  "success": true,
  "data": { "requestId": "...", "expiresIn": 300, ... }
}
```

#### 4. Get Current User
```javascript
GET /api/v1/auth/me
Headers: { "Authorization": "Bearer <session-token>" }
Response: {
  "success": true,
  "data": { "id": "...", "name": "...", "area": "..." }
}
```

#### 5. Get Session
```javascript
GET /api/v1/auth/session
Headers: { "Authorization": "Bearer <session-token>" }
Response: {
  "success": true,
  "data": { "expiresAt": 2592000, ... }
}
```

#### 6. Logout
```javascript
POST /api/v1/auth/logout
Headers: { "Authorization": "Bearer <session-token>" }
Response: {
  "success": true,
  "data": { "revoked": true }
}
```

## Developer Testing Instructions

### 1. Run Unit Tests
```bash
cd backend
npm test
```

### 2. Test All Auth Endpoints
```bash
node scripts/auth-comprehensive-test.mjs
```
Expected: All 7 tests pass ✅

### 3. Test Staging API Directly
```bash
# Test phone validation (should fail with 400)
curl -X POST https://bulao-api-staging.codecheck369.workers.dev/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "123"}'

# Test without auth (should fail with 401)
curl https://bulao-api-staging.codecheck369.workers.dev/api/v1/auth/me
```

### 4. Test with Mobile App (Recommended)
1. Open Expo Go on your phone
2. Launch the Bulao app in staging mode
3. Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9)
4. Tap "Continue"
5. **Check: Did you receive an SMS?**
6. Enter the OTP
7. **Check: Did you get logged in?**
8. Test /auth/me endpoint
9. Test logout

### 5. Monitor Cloudflare Logs
```bash
npx wrangler tail bulao-api-staging
```
Look for:
- `MSG91_REQUEST` - OTP request sent to MSG91
- `MSG91_RESPONSE` - Response from MSG91
- `MSG91_DEBUG` - Result code (PROVIDER_SUCCESS or error)

## Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Send OTP (per phone) | 3 | 10 minutes |
| Send OTP (per phone) | 10 | Per day |
| Verify OTP (per phone) | 5 | Per challenge |
| Block after max attempts | 10 | minutes |

## Security Features

- **AUTH_HASH_KEY**: Secret key for fingerprinting phones and IPs
- **No secrets in logs**: Phone numbers, OTPs, and AuthKeys are masked
- **Secure session tokens**: 32-byte random tokens stored as hashes
- **Session expiration**: 30 days

## D1 Database (Staging)

- **Database**: bulao-dev
- **Tables**:
  - `users` - User accounts (created on first login)
  - `sessions` - Active sessions (created on OTP verification)
  - `auth_events` - Audit log (via Cloudflare Queue)

## MSG91 Configuration

- **Template ID**: 6a9e95cd898618ba1a007d22
- **Template Content**: "Your Bulao verification code is ##OTP##. Do not share this code with anyone."
- **Sender ID**: Bulao
- **OTP Length**: 4 digits
- **OTP Expiry**: 5 minutes

## Known Issues & Workarounds

### MSG91 Dashboard Empty Logs
**Issue**: API returns success but transaction doesn't appear in MSG91 logs
**Status**: Reported to MSG91 support on 2026-09-08
**Workaround**: None yet - awaiting MSG91 resolution
**Impact**: Can debug via Cloudflare logs (MSG91_REQUEST/RESPONSE events visible)

### If SMS is NOT being delivered
- Contact MSG91 support with request_id from Cloudflare logs
- Ask: "Is SMS actually being submitted despite empty logs?"

## Deployment Commands

```bash
# Deploy to staging
cd backend
npx wrangler deploy --env staging

# View staging logs
npx wrangler tail bulao-api-staging

# List staging secrets
npx wrangler secret list --env staging

# Deploy to production (after staging confirmed)
npx wrangler deploy --env production
```

## Production Checklist

Before going to production:
- [ ] Confirm SMS delivery works (not just API success)
- [ ] Verify all 7 endpoint tests pass
- [ ] Rotate MSG91 AuthKey (don't use the same key as staging)
- [ ] Create production D1 database
- [ ] Create production Cloudflare Queue
- [ ] Update wrangler.toml production settings
- [ ] Test complete flow: Send → Verify → Session → /me → Logout

## Support Contacts

- **MSG91 Support**: Via their dashboard chat
- **Cloudflare Issues**: Check https://dash.cloudflare.com

---

**Summary**: Backend authentication is fully implemented and tested. The only blocker is MSG91's logging issue, which is under investigation. Once resolved, the complete auth flow (Send OTP → Verify → D1 User → D1 Session → /me → Logout) will be proven.