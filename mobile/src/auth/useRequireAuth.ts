/**
 * Hook to require authentication for a screen
 * Redirects to auth if not authenticated
 */

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from './AuthContext';

export function useRequireAuth() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === 'bootstrapping') {
      return;
    }

    if (auth.status === 'unauthenticated') {
      console.log('useRequireAuth: Not authenticated, redirecting to auth');
      router.replace('/auth');
    }
  }, [auth.status]);

  return {
    isAuthenticated: auth.status === 'authenticated',
    isLoading: auth.status === 'bootstrapping',
    user: auth.user,
  };
}
