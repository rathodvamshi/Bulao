# Testing Authentication Fix

## Issue Found

The session WAS being created successfully, but immediately logged out due to:
1. The auth expired handler being re-registered every time auth state changed
2. API calls potentially triggering the handler incorrectly

## Fixes Applied

### 1. Fixed `_layout.tsx`
- Handlers now set up ONCE on mount using refs
- Prevents re-registration on every auth state change

### 2. Fixed `api/client.ts`
- Added exclusion for `verify-widget-otp` endpoint
- Added detailed logging to trace API calls
- Won't trigger logout during the login flow itself

### 3. Added Logging
- Both `authApi.ts` and `api/client.ts` now have detailed logging
- You can see exactly what's happening during login

## Expected Log Flow (After Fix)

```
LOG  MSG91: Verifying OTP: 4595
LOG  MSG91: Verify response: {"message":"...JWT...","type":"success"}
LOG  authApi: Creating session for ...8235
LOG  authApi: Session creation response status: 200
LOG  authApi: Session creation data: {success: true, hasToken: true, hasUser: true}
LOG  authApi: Session created successfully
LOG  Auth: Creating session after OTP verification
LOG  Auth: Session saved, login complete
LOG  Auth context: Login
LOG  Index: Authenticated, routing to home  ← Should route to home
LOG  api() called: /users/me hasToken: true  ← Profile screen loads
LOG  api() response: /users/me 200
LOG  api() success: /users/me
```

## What to Test

### Test 1: Fresh Login
1. Clear app data / Uninstall and reinstall
2. Open app
3. Enter phone number
4. Enter OTP
5. **EXPECTED:** You should stay logged in and see the home/profile screen
6. **CHECK LOGS:** Look for "Auth context: Login" followed by navigation, NOT followed by "Auth context: Logout"

### Test 2: App Restart After Login
1. Complete Test 1 successfully
2. Kill the app completely
3. Reopen the app
4. **EXPECTED:** You should go directly to home/profile without OTP
5. **CHECK LOGS:** Look for "Auth bootstrap: Session found" and "authenticated"

### Test 3: Logout
1. While logged in, press Logout button
2. **EXPECTED:** Return to authentication screen
3. Close app, reopen
4. **EXPECTED:** Still on authentication screen

## If It Still Logs Out Immediately

Look for these specific log lines:

```
LOG  api() called: /SOME_ENDPOINT hasToken: true
LOG  api() response: /SOME_ENDPOINT 401
LOG  api() triggering auth expired handler  ← This shouldn't happen right after login
```

If you see this, the issue is:
- The endpoint in the logs is returning 401
- This means the backend didn't create the session properly

## Backend Check

If still having issues, verify backend:

```bash
# Check if session was created in D1
wrangler d1 execute DB --env staging --command "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1"

# Should show a session with:
# - hash: some long hex string
# - user_id: a UUID
# - expires_at: a future timestamp
# - revoked_at: NULL (not revoked)
```

## Quick Debug Commands

### Check Recent Sessions
```sql
SELECT 
  substr(hash, 1, 10) as hash_prefix,
  user_id,
  datetime(created_at, 'unixepoch') as created,
  datetime(expires_at, 'unixepoch') as expires,
  revoked_at
FROM sessions 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check User
```sql
SELECT id, phone, name, area, phone_verified, suspended
FROM users
WHERE phone = '917569408235'  -- Your phone (without +)
```

## Success Criteria

✅ User logs in with OTP  
✅ App stays logged in (doesn't immediately logout)  
✅ User sees home/profile screen  
✅ Closing and reopening app keeps user logged in  
✅ Logout works and stays logged out after restart  

## Files Changed

1. `mobile/app/_layout.tsx` - Fixed handler registration
2. `mobile/src/api/client.ts` - Added logging and endpoint exclusion
3. `mobile/src/auth/authApi.ts` - Added detailed logging

## Next Steps After Testing

Once login is working:
1. Remove or reduce the debug logging (keep only important logs)
2. Test on physical device (not just emulator)
3. Test with poor network conditions
4. Test with airplane mode during startup
