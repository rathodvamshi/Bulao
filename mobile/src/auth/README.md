# Bulao Authentication Module

## Quick Start

### Using Authentication in Components

```typescript
import { useAuth } from '../auth';

function MyComponent() {
  const auth = useAuth();

  // Check authentication status
  if (auth.status === 'authenticated') {
    // User is logged in
    console.log('User:', auth.user);
    console.log('Token:', auth.session?.token);
  }

  // Logout
  const handleLogout = async () => {
    await auth.logout();
    // User is now logged out, navigation handled automatically
  };

  return <View>...</View>;
}
```

### Login Flow (After OTP Verification)

```typescript
import { completeLogin, useAuth } from '../auth';

async function handleOTPVerified(phone: string, requestId: string) {
  try {
    // Create session with backend
    const { user, session } = await completeLogin(phone, requestId);
    
    // Update auth context
    auth.login(user, session);
    
    // Navigate to home
    router.replace('/home');
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

### Making Authenticated API Calls

```typescript
// The existing API client automatically uses the auth token
import { api } from '../api/client';

// Token is automatically injected
const userData = await api('/users/me');
```

## Auth Status States

| Status | Meaning | UI Behavior |
|--------|---------|-------------|
| `bootstrapping` | Checking for existing session | Show splash/loading |
| `authenticated` | User logged in, session valid | Show app content |
| `unauthenticated` | No valid session | Show auth screen |

## Auth Context API

### State

```typescript
{
  status: AuthStatus;          // Current auth status
  user: UserData | null;       // Current user (if authenticated)
  session: SessionData | null; // Current session (if authenticated)
  error: Error | null;         // Network error (if any)
}
```

### Methods

```typescript
{
  login: (user, session) => void;     // Complete login
  logout: () => Promise<void>;         // Logout with server revocation
  retry: () => Promise<void>;          // Retry bootstrap (on network error)
}
```

## Error Handling

### Network Errors vs Auth Errors

```typescript
// Network error - session may still be valid
if (auth.error && auth.error.code === 'NETWORK_ERROR') {
  // Show retry button
  <Button onPress={auth.retry}>Retry</Button>
}

// Auth error - session definitely invalid
if (auth.status === 'unauthenticated') {
  // Navigate to login
  router.push('/auth');
}
```

## Storage

Sessions are stored in SecureStore:
- **iOS:** Keychain with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
- **Android:** Android Keystore
- **Web:** localStorage (development only)

### Session Data Structure

```typescript
{
  token: string;      // Raw session token (64-char hex)
  expiresAt: number;  // Unix timestamp
  userId: string;     // User UUID
}
```

## Security

### ✅ DO
- Use `useAuth()` for all auth state
- Let the auth system handle token storage
- Call `auth.logout()` for logout
- Trust backend validation over local checks

### ❌ DON'T
- Store auth tokens manually
- Store OTP codes
- Bypass auth context
- Check only local expiration

## Navigation Integration

The auth system automatically manages navigation:

```
bootstrapping → Show splash
authenticated → Allow app access
unauthenticated → Redirect to /auth
```

Protected routes automatically work once `AuthProvider` wraps the app.

## Troubleshooting

### "Session expired" on every app start
- Check backend session expiration in D1
- Verify `expiresAt` timestamp is future
- Check clock sync on device

### Network error loop
- Verify API_BASE_URL in environment
- Test `/auth/me` endpoint directly
- Check Cloudflare Worker deployment

### Token not persisting
- Check SecureStore permissions
- Verify app has keychain/keystore access
- Test on physical device (not just simulator)

### Logout not working
- Check `/auth/logout` endpoint
- Verify backend revokes session in D1
- Check console for error logs

## Module Files

| File | Purpose |
|------|---------|
| `authTypes.ts` | Type definitions |
| `authStorage.ts` | SecureStore wrapper |
| `authApi.ts` | API calls (validate, logout, create session) |
| `authService.ts` | Business logic (bootstrap, login, logout) |
| `AuthContext.tsx` | React context & state management |
| `index.ts` | Public exports |

## Examples

### Conditional Rendering Based on Auth

```typescript
function App() {
  const auth = useAuth();

  if (auth.status === 'bootstrapping') {
    return <SplashScreen />;
  }

  if (auth.status === 'unauthenticated') {
    return <AuthStack />;
  }

  return <AppStack />;
}
```

### Retry on Network Error

```typescript
function BootstrapError() {
  const auth = useAuth();

  return (
    <View>
      <Text>{auth.error?.message}</Text>
      <Button onPress={auth.retry}>
        Try Again
      </Button>
    </View>
  );
}
```

### Protected Component

```typescript
function ProtectedScreen() {
  const auth = useAuth();

  if (auth.status !== 'authenticated') {
    return <Redirect href="/auth" />;
  }

  return (
    <View>
      <Text>Welcome, {auth.user?.name}</Text>
      <Button onPress={auth.logout}>Logout</Button>
    </View>
  );
}
```

## Testing

### Test Authentication Flow

```typescript
// Mock auth for testing
import { AuthProvider } from '../auth';

<AuthProvider>
  <App />
</AuthProvider>
```

### Mock Authenticated State

```typescript
// Create test wrapper with mock auth
function createMockAuth(status: AuthStatus) {
  return {
    status,
    user: { id: '1', name: 'Test', area: 'Test Area' },
    session: { token: 'test-token', expiresAt: Date.now() + 1000000, userId: '1' },
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  };
}
```

## Performance

- Bootstrap time: < 500ms on good network
- SecureStore read: < 100ms
- Session validation: < 1s on good network
- Logout: < 1s

## Support

For issues related to authentication:
1. Check console logs for errors
2. Verify backend endpoints are accessible
3. Test on physical device (not just simulator)
4. Check SecureStore permissions

---

**Version:** 1.0.0  
**Last Updated:** January 2025
