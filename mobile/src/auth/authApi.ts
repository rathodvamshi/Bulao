/**
 * Authentication API Module
 * 
 * Handles all authentication-related API calls.
 * Uses the centralized API client with auth token injection.
 */

import { apiBaseUrl } from '../api/config';
import { fetchWithTimeout } from '../api/network';
import { AuthError, type UserData } from './authTypes';

const API_TIMEOUT = 15000; // 15 seconds

/**
 * Validate current session and get user data
 * 
 * @throws AuthError with appropriate code
 */
export async function validateSession(token: string): Promise<UserData> {
  try {
    const response = await fetchWithTimeout(
      `${apiBaseUrl()}/auth/me`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
      API_TIMEOUT
    );

    if (response.status === 401) {
      throw new AuthError('AUTH_REQUIRED', 'Session expired or invalid', false);
    }

    if (response.status === 403) {
      throw new AuthError('AUTH_REQUIRED', 'Account suspended or unauthorized', false);
    }

    if (!response.ok) {
      throw new AuthError('SERVER_ERROR', `Server error: ${response.status}`, true);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new AuthError('SESSION_INVALID', 'Invalid session response', false);
    }

    return {
      id: data.data.id,
      name: data.data.name || 'User',
      area: data.data.area || '',
    };
  } catch (error) {
    // Network errors (timeout, connection refused, etc.)
    if (error instanceof TypeError || (error as any).name === 'AbortError') {
      throw new AuthError('NETWORK_ERROR', 'Unable to connect. Check your internet connection.', true);
    }

    // Re-throw AuthError as-is
    if (error instanceof AuthError) {
      throw error;
    }

    // Unknown error
    console.error('Session validation error:', error);
    throw new AuthError('UNKNOWN', 'Something went wrong. Please try again.', true);
  }
}

/**
 * Logout - revoke session on server
 * 
 * @throws AuthError on failure
 */
export async function logout(token: string): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${apiBaseUrl()}/auth/logout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      API_TIMEOUT
    );

    // 401 is acceptable here - session may already be invalid
    if (response.ok || response.status === 401) {
      return;
    }

    // Non-critical errors - we'll clear local session anyway
    console.warn('Logout API failed:', response.status);
  } catch (error) {
    // Network error during logout - not critical
    // We'll still clear local session
    console.warn('Logout network error:', error);
  }
}

/**
 * Create session after OTP verification
 * 
 * This is called by the auth screen after MSG91 OTP verification succeeds.
 */
export async function createSession(identifier: string, accessToken: string): Promise<{
  token: string;
  expiresAt: number;
  user: UserData;
}> {
  try {
    console.log('authApi: Creating session for', identifier.slice(-4));
    
    const response = await fetchWithTimeout(
      `${apiBaseUrl()}/auth/verify-widget-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, accessToken }),
      },
      API_TIMEOUT
    );

    console.log('authApi: Session creation response status:', response.status);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('authApi: Session creation failed:', data);
      throw new AuthError(
        data.error?.code || 'SERVER_ERROR',
        response.status === 401 || response.status === 404
          ? 'The login service needs an update. Please contact support.'
          : data.error?.message || 'Could not finish signing in. Please try again.',
        response.status >= 500
      );
    }

    const data = await response.json();
    console.log('authApi: Session creation data:', { success: data.success, hasToken: !!data.data?.token, hasUser: !!data.data?.user });

    if (!data.success || !data.data?.token) {
      throw new AuthError('SESSION_INVALID', 'Invalid session response', false);
    }

    console.log('authApi: Session created successfully');

    return {
      token: data.data.token,
      expiresAt: data.data.expiresAt,
      user: {
        id: data.data.user.id,
        name: data.data.user.name || 'User',
        area: data.data.user.area || '',
      },
    };
  } catch (error) {
    console.error('authApi: Session creation error:', error);
    
    if (error instanceof TypeError || (error as any).name === 'AbortError') {
      throw new AuthError('NETWORK_ERROR', 'Unable to connect. Check your internet connection.', true);
    }

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError('UNKNOWN', 'Something went wrong. Please try again.', true);
  }
}
