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
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 260,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        >
          {/* Root Bootstrapper */}
          <Stack.Screen name="index" options={{ animation: "none" }} />

          {/* Core Hub & Tab Screens: Silky Cross-Fade (Eliminates harsh cuts & window jumps) */}
          <Stack.Screen name="(tabs)" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="provider-home" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="find-service" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="service-home" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="activity" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="provider-profile" options={{ animation: "fade", animationDuration: 200 }} />

          {/* Action & Creation Flows: Native Bottom Sheet Slide-Up */}
          <Stack.Screen
            name="post-work"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="auth"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="location"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              animationDuration: 240,
            }}
          />
          <Stack.Screen
            name="location-search"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              animationDuration: 240,
            }}
          />

          {/* Detail Screens: Smooth Right Slide with Full-Screen Swipe-to-Back */}
          <Stack.Screen
            name="jobs/[id]"
            options={{
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="profile/[id]"
            options={{
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="safety"
            options={{
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
        </Stack>
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
