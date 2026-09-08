# Bulao - MSG91 OTP Setup Guide

## Quick Setup Checklist

- [ ] MSG91 Account: codecheck369@gmail.com
- [ ] Widget Created: "Bulao Auth"
- [ ] Widget ID: `3669686e4b46393237373639`
- [ ] Widget Token: `568607TBQ8oKK8IF6aa02237P1`
- [ ] Template ID: `6a9e95cd898618ba1a007d22`
- [ ] Sender ID: `Bulao` (Approved)
- [ ] Backend Auth Key: `568607ArFur3YZKEn6a9fc3a7P1`
- [ ] Webhook Configured: YES
- [ ] Mobile SDK Installed: YES

---

## MSG91 Dashboard Setup

### 1. Verify Template
- Go to: **OTP → Templates**
- Template ID: `6a9e95cd898618ba1a007d22`
- Status: **Active**
- Content: "Your Bulao verification code is ##OTP##. Do not share this code with anyone."

### 2. Verify Widget
- Go to: **OTP → Widgets**
- Widget Name: **Bulao Auth**
- Widget ID: `3669686e4b46393237373639`
- Mobile Integration: **Enabled**
- Webhook: **Enabled** with URL: `https://bulao-api-staging.codecheck369.workers.dev/api/v1/webhooks/msg91`

### 3. Get Widget Token
- Go to: **Token** (left sidebar)
- Token Name: **BulaoMobileApp**
- Token: `568607TBQ8oKK8IF6aa02237P1`
- Status: **Enabled**

### 4. Webhook Configuration
- Go to: **OTP → Widgets → Your Widget → Webhook**
- URL: `https://bulao-api-staging.codecheck369.workers.dev/api/v1/webhooks/msg91`
- Status: **Enabled**

---

## Backend Configuration (Cloudflare)

### Secrets Already Set (Staging)
```bash
MSG91_AUTH_KEY = 568607ArFur3YZKEn6a9fc3a7P1
AUTH_HASH_KEY = [generated random string]
```

### Verify Backend is Running
```bash
curl https://bulao-api-staging.codecheck369.workers.dev/api/v1/health
# Expected: {"success":true,"data":{"status":"ok"}}
```

---

## Mobile App Configuration

### 1. Environment Variables (.env)
Located: `mobile/.env`
```env
EXPO_PUBLIC_API_BASE_URL=https://bulao-api-staging.codecheck369.workers.dev/api/v1
EXPO_PUBLIC_MSG91_WIDGET_ID=3669686e4b46393237373639
EXPO_PUBLIC_MSG91_TOKEN_AUTH=568607TBQ8oKK8IF6aa02237P1
```

### 2. Install Dependencies
```bash
cd mobile
pnpm add @msg91comm/sendotp-react-native
```

### 3. Run the App
```bash
cd mobile
npx expo start
```

### 4. Test Flow
1. Open app on phone
2. Enter phone: `7569408235`
3. Tap "Continue"
4. **Check for SMS!**
5. Enter OTP
6. Verify login works

---

## Testing Scripts

### Test Direct MSG91 API
```bash
node scripts/test-msg91-direct.mjs 568607ArFur3YZKEn6a9fc3a7P1
```

### Test Backend Health
```bash
curl https://bulao-api-staging.codecheck369.workers.dev/api/v1/health
```

### Monitor Logs
```bash
cd backend
npx wrangler tail bulao-api-staging
```

---

## If SMS Not Received

### Step 1: Check Wallet Balance
- Go to MSG91 Dashboard → Wallet
- Minimum required: ₹10
- Current balance: Check dashboard

### Step 2: Check Webhook Logs
```bash
npx wrangler tail bulao-api-staging
```
Look for: `MSG91_WEBHOOK` events

### Step 3: Contact MSG91 Support
Provide:
- Request ID from logs
- Phone number: 917569408235
- Widget ID: 3669686e4b46393237373639
- Template ID: 6a9e95cd898618ba1a007d22

Message:
> "OTP requests are returning success but SMS is not delivered to phone 917569408235. Request IDs are not appearing in OTP logs. Is SMS being sent to the telecom network?"

---

## Known Issues & Solutions

| Issue | Solution |
|-------|----------|
| Widget returns 401 | Use Widget Token (568607TBQ8oKK8IF6aa02237P1), not AuthKey |
| API returns success but no SMS | Contact MSG91 support with request_id |
| Webhook not receiving events | Verify webhook URL is correct and enabled |
| Wallet balance low | Add credits in MSG91 Dashboard |

---

## Project Structure

```
New project/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Main app with webhook endpoint
│   │   ├── config/env.ts       # Environment types
│   │   └── modules/auth/       # Auth routes & logic
│   ├── wrangler.toml           # Cloudflare config
│   └── migrations/             # D1 database migrations
│
├── mobile/
│   ├── app/
│   │   └── auth.tsx            # Auth screen with MSG91 Widget
│   ├── app.config.js           # Expo config with env vars
│   ├── .env                    # Environment variables (DO NOT COMMIT)
│   └── package.json            # Dependencies
│
├── scripts/
│   └── test-msg91-direct.mjs   # Direct API test script
│
├── CREDENTIALS.md              # All credentials documentation
├── SETUP_GUIDE.md              # This file
└── wrangler.toml               # Cloudflare config
```

---

## Security Reminders

1. **Never commit `.env` to git** - Already in `.gitignore`
2. **Use different credentials for production** - Create new widget/token
3. **Keep AuthKey secret** - Only in Cloudflare Secrets
4. **Widget Token is safer** - Use for mobile SDK
5. **Rotate credentials before production** - Especially AuthKey

---

## Support Contacts

- **MSG91 Support**: Via dashboard chat
- **Cloudflare Issues**: https://dash.cloudflare.com

---

## Last Updated
2026-09-08

**Status**: ✅ All credentials configured, waiting for SMS delivery test