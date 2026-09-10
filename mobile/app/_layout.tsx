import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import { set401Handler } from "../src/api/apiClient";
import { setAuthExpiredHandler } from "../src/api/client";
import { useAuth } from "../src/auth";
import { colors } from "../src/components/ui";

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
    setAuthExpiredHandler(() => {
      console.log('API client: Session expired, logging out');
      authRef.current.logout();
    });

    set401Handler(() => {
      console.log('Global 401 handler: Session expired, logging out');
      authRef.current.logout();
    });
  }, []);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      void client.cancelQueries();
      client.clear();
    }
  }, [auth.status]);

  // Show loading during bootstrap (index.tsx will handle routing)
  if (auth.status === 'bootstrapping') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
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
