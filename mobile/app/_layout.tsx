import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import { set401Handler } from "../src/api/apiClient";
import { setAuthExpiredHandler } from "../src/api/client";
import { useAuth } from "../src/auth";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LocationSheet } from "../src/components/LocationSheet";

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

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
      <LocationSheet />
    </View>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <AppContent />
        </QueryClientProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
