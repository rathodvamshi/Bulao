/**
 * Authentication Context
 * 
 * Centralized authentication state management using React Context.
 * This is the single source of truth for auth state in the app.
 * 
 * Usage:
 * - Wrap app with <AuthProvider>
 * - Access with useAuth() hook
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { AuthState, AuthStatus, UserData, SessionData } from './authTypes';
import * as authService from './authService';
import { setAuthTokenGetter } from '../api/client';

type AuthContextValue = {
  // Current auth state
  status: AuthStatus;
  user: UserData | null;
  session: SessionData | null;

  // Error state (for network errors during bootstrap)
  error: Error | null;

  // Actions
  login: (user: UserData, session: SessionData) => void;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

type AuthProviderProps = {
  children: React.ReactNode;
};

/**
 * Authentication Provider
 * 
 * Manages authentication state and bootstrap process.
 * Place this at the root of your app navigation.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [user, setUser] = useState<UserData | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Prevent multiple simultaneous bootstrap attempts
  const bootstrapInProgress = useRef(false);

  /**
   * Bootstrap authentication on mount
   */
  const bootstrap = useCallback(async () => {
    if (bootstrapInProgress.current) {
      console.log('Bootstrap already in progress, skipping');
      return;
    }

    bootstrapInProgress.current = true;
    setStatus('bootstrapping');
    setError(null);

    try {
      const result = await authService.bootstrapAuth();

      if (result.status === 'authenticated') {
        setAuthTokenGetter(() => result.session.token);
        setUser(result.user);
        setSession(result.session);
        setStatus('authenticated');
        setError(null);
      } else if (result.status === 'unauthenticated') {
        setAuthTokenGetter(() => null);
        setUser(null);
        setSession(null);
        setStatus('unauthenticated');
        setError(null);
      } else if (result.status === 'network_error') {
        // Network error - don't change authenticated state
        // Keep existing session if we had one, show error
        setError(result.error);
        // If we have a session, optimistically stay in authenticated state
        // Otherwise, go to unauthenticated
        if (session) {
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      }
    } catch (error) {
      console.error('Bootstrap error:', error);
      setError(error instanceof Error ? error : new Error('Bootstrap failed'));
      setStatus('unauthenticated');
    } finally {
      bootstrapInProgress.current = false;
    }
  }, [session]);

  /**
   * Bootstrap on mount
   */
  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Login - called after successful OTP verification
   */
  const login = useCallback((user: UserData, session: SessionData) => {
    console.log('Auth context: Login');
    // Publish the token before navigating or mounting protected queries.
    setAuthTokenGetter(() => session.token);
    setUser(user);
    setSession(session);
    setStatus('authenticated');
    setError(null);
  }, []);

  /**
   * Logout - revoke session and clear state
   */
  const logout = useCallback(async () => {
    console.log('Auth context: Logout');
    
    const currentToken = session?.token || null;
    setAuthTokenGetter(() => null);

    // Clear state immediately for responsive UX
    setUser(null);
    setSession(null);
    setStatus('unauthenticated');
    setError(null);

    // Revoke on server (async, non-blocking)
    await authService.performLogout(currentToken);
  }, [session?.token]);

  /**
   * Retry - attempt bootstrap again (for network errors)
   */
  const retry = useCallback(async () => {
    console.log('Auth context: Retry');
    await bootstrap();
  }, [bootstrap]);

  const value: AuthContextValue = {
    status,
    user,
    session,
    error,
    login,
    logout,
    retry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
