/**
 * Authentication Service
 * 
 * Central authentication business logic and bootstrap process.
 * This is the single source of truth for authentication state management.
 */

import { AuthError, type BootstrapResult, type SessionData, type UserData } from './authTypes';
import * as authStorage from './authStorage';
import * as authApi from './authApi';

/**
 * Bootstrap authentication on app startup
 * 
 * This is the core authentication restoration flow:
 * 1. Check SecureStore for session
 * 2. If no session → unauthenticated
 * 3. If session exists → validate with backend
 * 4. If valid → authenticated
 * 5. If invalid (401) → clear and unauthenticated
 * 6. If network error → return network_error (keep session)
 */
export async function bootstrapAuth(): Promise<BootstrapResult> {
  try {
    // Step 1: Check for stored session
    const session = await authStorage.getSession();

    if (!session || !session.token) {
      console.log('Auth bootstrap: No session found');
      return { status: 'unauthenticated', reason: 'no_session' };
    }

    // Step 2: Check local expiration first (avoid unnecessary API call)
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt && session.expiresAt < now) {
      console.log('Auth bootstrap: Session expired locally');
      await authStorage.clearSession();
      return { status: 'unauthenticated', reason: 'expired' };
    }

    console.log('Auth bootstrap: Validating session with backend');

    // Step 3: Validate with backend
    try {
      const user = await authApi.validateSession(session.token);
      console.log('Auth bootstrap: Session valid');
      return {
        status: 'authenticated',
        user,
        session,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        // Network error - keep session, let user retry
        if (error.code === 'NETWORK_ERROR') {
          console.warn('Auth bootstrap: Network error during validation');
          return {
            status: 'network_error',
            error,
          };
        }

        // Session invalid/expired - clear it
        if (error.code === 'AUTH_REQUIRED' || error.code === 'SESSION_INVALID') {
          console.log('Auth bootstrap: Session invalid, clearing');
          await authStorage.clearSession();
          return { status: 'unauthenticated', reason: 'invalid' };
        }

        // Server error - treat as network error (keep session, allow retry)
        if (error.code === 'SERVER_ERROR') {
          console.warn('Auth bootstrap: Server error during validation');
          return {
            status: 'network_error',
            error,
          };
        }
      }

      // Unknown error - treat as network error to be safe
      console.error('Auth bootstrap: Unknown error', error);
      return {
        status: 'network_error',
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  } catch (error) {
    // Unexpected error in bootstrap process
    console.error('Auth bootstrap: Critical error', error);
    return {
      status: 'network_error',
      error: error instanceof Error ? error : new Error('Bootstrap failed'),
    };
  }
}

/**
 * Complete login after OTP verification
 * 
 * Called after MSG91 OTP verification succeeds.
 * Creates backend session and stores it securely.
 */
export async function completeLogin(
  identifier: string,
  requestId: string
): Promise<{ user: UserData; session: SessionData }> {
  console.log('Auth: Creating session after OTP verification');

  const result = await authApi.createSession(identifier, requestId);

  const session: SessionData = {
    token: result.token,
    expiresAt: result.expiresAt,
    userId: result.user.id,
  };

  // Store session securely
  await authStorage.saveSession(session);

  console.log('Auth: Session saved, login complete');

  return {
    user: result.user,
    session,
  };
}

/**
 * Logout user
 * 
 * Complete logout flow:
 * 1. Call backend to revoke session
 * 2. Clear local session storage
 * 3. Clear in-memory auth state (handled by caller)
 */
export async function performLogout(token: string | null): Promise<void> {
  console.log('Auth: Logging out');

  // Step 1: Revoke on server (if token exists)
  if (token) {
    try {
      await authApi.logout(token);
      console.log('Auth: Server session revoked');
    } catch (error) {
      // Non-critical - we'll clear local session anyway
      console.warn('Auth: Server logout failed (continuing anyway)', error);
    }
  }

  // Step 2: Clear local storage
  await authStorage.clearSession();
  console.log('Auth: Local session cleared');
}

/**
 * Refresh/validate current session
 * 
 * Used to check if current session is still valid.
 * Does NOT throw on network errors.
 */
export async function refreshSession(token: string): Promise<{
  valid: boolean;
  user?: UserData;
  error?: AuthError;
}> {
  try {
    const user = await authApi.validateSession(token);
    return { valid: true, user };
  } catch (error) {
    if (error instanceof AuthError) {
      // Network error - can't determine validity
      if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
        return { valid: false, error };
      }

      // Auth error - definitely invalid
      return { valid: false, error };
    }

    return {
      valid: false,
      error: new AuthError('UNKNOWN', 'Session validation failed', true),
    };
  }
}
