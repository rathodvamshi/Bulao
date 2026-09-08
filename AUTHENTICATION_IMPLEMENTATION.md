# Bulao Authentication & Session Persistence System

## Overview

Production-quality authentication system with secure session persistence, automatic restoration, and proper error handling.

## Architecture

### Core Components

#### 1. **Auth Storage** (`mobile/src/auth/authStorage.ts`)
- Secure session token storage using `expo-secure-store`
- Encrypted on-device storage (iOS Keychain, Android Keystore)
- Never stores OTP, MSG91 credentials, or sensitive secrets
- Session data structure: `{ token, expiresAt, userId }`

#### 2. **Auth API** (`mobile/src/auth/authApi.ts`)
- Session validation endpoint: `GET /auth/me`
- Session creation: `POST /auth/verify-widget-otp`
- Logout endpoint: `POST /auth/logout`
- Network error handling with retry capability
- Distinguishes between AUTH_REQUIRED and NETWORK_ERROR

#### 3. **Auth Service** (`mobile/src/auth/authService.ts`)
- Core authentication business logic
- Bootstrap authentication on app startup
- Complete login flow after OTP verification
- Proper logout with server-side session revocation
- Session refresh/validation

#### 4. **Auth Context** (`mobile/src/auth/AuthContext.tsx`)
- Centralized auth state management using React Context
- Auth status: `bootstrapping` | `authenticated` | `unauthenticated`
- Provides: `login()`, `logout()`, `retry()` methods
- Automatic session restoration on app start

#### 5. **API Client** (`mobile/src/api/apiClient.ts`)
- Automatic Authorization header injection
- Centralized 401 session expiration handling
- Network error detection and retry logic
- Request timeout management

### Backend Components

#### Session Management (`backend/src/modules/auth/`)
- Session validation: `GET /auth/me`
- Session creation with hashed tokens
- Session revocation: `POST /auth/logout`
- Session expiration checking
- Device tracking support

## App Startup Flow

```
APP LAUNCH
    ↓
Splash Screen (animation)
    ↓
Auth Bootstrap
    ↓
Check SecureStore
    ↓
Session exists?
    ├── NO → Go to Authentication
    └── YES
        ↓
    Validate with backend (GET /auth/me)
        ↓
    Valid?
        ├── YES → Restore user → Go to Home
        ├── NO (401) → Clear session → Go to Authentication
        └── NETWORK ERROR → Show error + retry (keep session)
```

## Authentication Flow

### First Time User

```
Open Bulao
    ↓
Splash
    ↓
No session found
    ↓
Authentication Screen
    ↓
Enter phone number
    ↓
MSG91 sends OTP
    ↓
Verify OTP
    ↓
Backend creates session
    ↓
Store token in SecureStore
    ↓
Update auth context
    ↓
Navigate to Home
```

### Returning User

```
Open Bulao
    ↓
Splash
    ↓
Read SecureStore
    ↓
Session found
    ↓
Validate with backend
    ↓
Session valid
    ↓
Restore user data
    ↓
Navigate directly to Home
NO OTP REQUEST
```

### Session Expired

```
Open Bulao
    ↓
Splash
    ↓
Session exists
    ↓
Backend returns 401
    ↓
Clear SecureStore
    ↓
Go to Authentication
```

### Network Failure

```
Open Bulao
    ↓
Splash
    ↓
Session exists
    ↓
Cannot reach backend
    ↓
DO NOT delete token
    ↓
Show error + Retry button
    ↓
User can retry or continue to login
```

## Logout Flow

```
User clicks Logout
    ↓
POST /auth/logout (revoke on server)
    ↓
Backend invalidates session in D1
    ↓
Mobile: Clear SecureStore
    ↓
Clear auth context
    ↓
Clear react-query cache
    ↓
Reset navigation stack
    ↓
Navigate to Authentication
```

**Important:** Logout MUST invalidate the server-side session, not just clear local storage.

## Security Features

### ✓ SecureStore for session token
- iOS: Keychain with WHEN_UNLOCKED_THIS_DEVICE_ONLY
- Android: Android Keystore
- Web: localStorage (development only)

### ✓ Server-side session validation
- Backend is source of truth
- Hashed tokens in D1 (SHA-256)
- Session expiration checking
- Session revocation on logout

### ✓ No sensitive data in client
- No OTP storage
- No MSG91 AuthKey in mobile app
- No authentication secrets in Git
- No tokens in logs

### ✓ Proper error handling
- Network errors don't falsely logout users
- 401 = session invalid (logout)
- Network timeout = retry available
- Centralized error handling

### ✓ Session lifecycle
- 30-day expiration
- Last used tracking
- Explicit revocation on logout
- Device tracking support

## Navigation Architecture

### Two-Stack System

**Auth Stack** (unauthenticated)
- Splash → Authentication → OTP Verification

**App Stack** (authenticated)  
- Home → Profile → Settings → etc.

### Root Navigator Logic

```typescript
if (authStatus === 'bootstrapping') {
  return <SplashScreen />
}

if (authStatus === 'unauthenticated') {
  return <AuthStack />
}

if (authStatus === 'authenticated') {
  return <AppStack />
}
```

This prevents:
- Login screen flashing during startup
- Users navigating back to login after authentication
- Authenticated content appearing before bootstrap completes

## API Integration

### Automatic Token Injection

```typescript
// API client automatically adds Authorization header
apiClient.get('/users/me', token)
// → Authorization: Bearer <token>
```

### Centralized 401 Handling

```typescript
// Any API returning 401 triggers automatic logout
set401Handler(() => {
  auth.logout();
  router.replace('/auth');
});
```

### Network Error Handling

```typescript
try {
  const user = await authApi.validateSession(token);
  return { status: 'authenticated', user };
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Keep session, allow retry
    return { status: 'network_error', error };
  }
  if (error.code === 'AUTH_REQUIRED') {
    // Clear session, require login
    await authStorage.clearSession();
    return { status: 'unauthenticated' };
  }
}
```

## Database Schema

### sessions table

```sql
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,           -- SHA-256 hash of token
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  revoked_at INTEGER,              -- NULL = active, timestamp = revoked
  last_used_at INTEGER,
  device_id TEXT,                  -- Optional device tracking
  platform TEXT                    -- Optional: ios, android, web
);
```

### Session Token Design

- **Client stores:** Raw session token (SecureStore)
- **D1 stores:** SHA-256 hash of token
- **Token generation:** 32 bytes of cryptographically secure random data
- **Format:** 64-character hex string

Even if D1 is compromised, raw tokens are not exposed.

## Error Messages

User-friendly error messages for all scenarios:

```typescript
"Unable to connect. Check your internet connection."  // Network error
"Your session expired. Please login again."           // Session expired
"Incorrect OTP. Please try again."                    // Invalid OTP
"Too many attempts. Please try again later."          // Rate limited
"Something went wrong. Please try again."             // Unknown error
```

Never expose:
- Raw backend errors
- MSG91 API responses
- Stack traces
- Internal error codes (to users)

## Testing Checklist

### TEST 1: Fresh Install
- [ ] Fresh install shows Authentication screen
- [ ] No session exists

### TEST 2: Successful Login
- [ ] Login with OTP succeeds
- [ ] Home screen appears
- [ ] Session stored in SecureStore

### TEST 3: App Restart
- [ ] Kill app
- [ ] Reopen app
- [ ] Home appears directly (no OTP)
- [ ] Splash → Home (no auth screen flash)

### TEST 4: Device Restart
- [ ] Restart phone
- [ ] Open app
- [ ] Home appears if session valid
- [ ] No authentication required

### TEST 5: Logout
- [ ] Logout from Home
- [ ] Authentication screen appears
- [ ] Close/reopen app
- [ ] Authentication still appears (session cleared)

### TEST 6: Session Expiration
- [ ] Expired session (manually set in DB)
- [ ] Reopen app
- [ ] Authentication screen appears
- [ ] Session cleared from SecureStore

### TEST 7: Invalid/Revoked Session
- [ ] Revoke session in DB
- [ ] API call returns 401
- [ ] User logged out automatically
- [ ] Authentication screen appears

### TEST 8: Network Error During Startup
- [ ] Disable internet
- [ ] Open app with valid session
- [ ] Error shown: "Unable to connect"
- [ ] Retry button available
- [ ] Token NOT deleted
- [ ] Re-enable internet → Retry succeeds

### TEST 9: Multiple Restarts
- [ ] Login successfully
- [ ] Kill app
- [ ] Reopen → Home (no OTP)
- [ ] Kill app again
- [ ] Reopen → Home (still no OTP)

### TEST 10: Navigation After Logout
- [ ] Login
- [ ] Navigate to Profile
- [ ] Logout
- [ ] Press Back button
- [ ] Cannot return to authenticated screens
- [ ] Stays on Authentication screen

### TEST 11: Duplicate OTP Submit
- [ ] Double tap "Verify OTP"
- [ ] Only one verification request processed
- [ ] No duplicate sessions created

### TEST 12: Multiple 401 Responses
- [ ] Make multiple API calls
- [ ] All return 401
- [ ] Only one logout/navigation reset
- [ ] No duplicate redirects

## File Structure

```
mobile/
├── src/
│   ├── auth/
│   │   ├── authTypes.ts         # Type definitions
│   │   ├── authStorage.ts       # SecureStore wrapper
│   │   ├── authApi.ts           # API calls
│   │   ├── authService.ts       # Business logic
│   │   ├── AuthContext.tsx      # React context
│   │   └── index.ts             # Exports
│   └── api/
│       ├── apiClient.ts         # New centralized client
│       └── client.ts            # Existing client (updated)
├── app/
│   ├── _layout.tsx              # Root layout with AuthProvider
│   ├── index.tsx                # Bootstrap screen
│   ├── auth.tsx                 # Authentication flow
│   └── (tabs)/
│       └── profile.tsx          # Updated with logout
```

## Migration from Old System

### Before (Zustand session store)
```typescript
const session = useSession();
const token = session.token;
await session.setToken(newToken);
```

### After (Auth Context)
```typescript
const auth = useAuth();
const token = auth.session?.token;
auth.login(user, session);
await auth.logout();
```

## Best Practices

### DO:
- ✓ Use AuthContext for all auth state
- ✓ Validate sessions on backend
- ✓ Distinguish network errors from auth errors
- ✓ Keep session tokens in SecureStore only
- ✓ Revoke sessions on server during logout
- ✓ Show user-friendly error messages
- ✓ Clear cache on logout

### DON'T:
- ✗ Store OTP in client
- ✗ Store secrets in Git
- ✗ Trust client-side expiration only
- ✗ Delete token on network errors
- ✗ Expose raw backend errors to users
- ✗ Allow navigation back to login after auth
- ✗ Create multiple auth state sources

## Performance Considerations

- **Bootstrap time:** < 500ms on good network
- **SecureStore read:** < 100ms
- **Session validation:** < 1s on good network
- **Offline detection:** Immediate (network error)

## Future Enhancements

### Multi-device Support
- View active sessions
- Logout from specific device
- Logout from all devices

### Session Extension
- Refresh tokens
- Automatic session extension
- Background session validation

### Enhanced Security
- Biometric unlock
- Device fingerprinting
- Suspicious activity detection
- IP-based rate limiting

## Support & Troubleshooting

### User can't login after restart
- Check SecureStore permissions
- Verify session expiration in D1
- Check backend /auth/me endpoint

### Session expires too quickly
- Verify P.sessionLifetime in policy.ts
- Check session.expires_at in D1
- Confirm clock sync on device

### Network error loop
- Check API_BASE_URL environment variable
- Verify Cloudflare Worker deployment
- Test backend /auth/me endpoint directly

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Status:** Production Ready ✓
