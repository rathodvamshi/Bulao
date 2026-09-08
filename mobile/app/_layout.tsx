import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AuthProvider } from "../src/auth";
import { set401Handler } from "../src/api/apiClient";
import { setAuthTokenGetter, setAuthExpiredHandler } from "../src/api/client";
import { useAuth } from "../src/auth";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: false },
  },
});

function AppContent() {
  const auth = useAuth();
  const authRef = useRef(auth);
  
  // Keep ref up to date
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // Setup handlers ONCE on mount
  useEffect(() => {
    // Setup API client auth integration - use ref to get latest auth
    setAuthTokenGetter(() => authRef.current.session?.token || null);
    setAuthExpiredHandler(() => {
      console.log('API client: Session expired, logging out');
      authRef.current.logout();
    });

    // Setup new apiClient 401 handler - use ref to get latest auth
    set401Handler(() => {
      console.log('Global 401 handler: Session expired, logging out');
      authRef.current.logout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    // Clear react-query cache when auth state changes
    if (auth.status === 'unauthenticated') {
      void client.cancelQueries();
      client.clear();
    }
  }, [auth.status]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function Layout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={client}>
        <AppContent />
      </QueryClientProvider>
    </AuthProvider>
  );
}
