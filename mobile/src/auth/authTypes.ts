/**
 * Authentication Type Definitions
 * 
 * Central type definitions for the authentication system.
 */

export type AuthStatus = 
  | 'bootstrapping'  // Initial state, checking for existing session
  | 'authenticated'  // User has valid session
  | 'unauthenticated'; // No valid session

export type SessionData = {
  token: string;
  expiresAt: number;
  userId: string;
};

export type UserData = {
  id: string;
  name: string;
  area: string;
};

export type AuthState = {
  status: AuthStatus;
  user: UserData | null;
  session: SessionData | null;
};

export type BootstrapResult = 
  | { status: 'authenticated'; user: UserData; session: SessionData }
  | { status: 'unauthenticated'; reason?: 'no_session' | 'expired' | 'invalid' }
  | { status: 'network_error'; error: Error };

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_INVALID'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class AuthError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
