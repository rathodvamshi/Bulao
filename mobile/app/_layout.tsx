import { useFonts } from "expo-font";
import { AppFontsContext, appFonts } from "../src/components/AppText";
import "../global.css";
import { Stack, useRootNavigationState, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, useContext, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoginFontContext } from "../src/features/auth/LoginText";

import { AuthProvider } from "../src/auth";
import { set401Handler } from "../src/api/apiClient";
import { setAuthExpiredHandler } from "../src/api/client";
import { useAuth } from "../src/auth";
import { colors } from "../src/components/ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LocationSheet } from "../src/components/LocationSheet";
import { markStartupMilestone } from "../src/utils/startupMetrics";
import { SplashScreen } from "../src/components/SplashScreen";
import { PushNotificationsManager } from "../src/notifications/PushNotificationsManager";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // A backend 5xx usually signals a server/schema problem; replaying the same
      // request immediately only creates duplicate failures. Keep one retry for
      // network and rate-limit errors, where another attempt can help.
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status !== undefined && status >= 400 && status !== 408 && status !== 429) return false;
        if (status !== undefined && status >= 500) return false;
        return failureCount < 1;
      },
      staleTime: 3000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
    mutations: { retry: false },
  },
});

function AppContent() {
  const auth = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const fontsLoaded = useContext(AppFontsContext);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const isAuthRoute = segments[0] === "auth";
  const firstRouteReady =
    navigationState?.key != null &&
    segments.length > 0 &&
    segments[0] !== "index" &&
    auth.status !== "bootstrapping" &&
    fontsLoaded;
  const authRef = useRef(auth);
  
  // Keep ref up to date
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    if (auth.status !== "bootstrapping") markStartupMilestone("auth-bootstrap-complete");
  }, [auth.status]);

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

  const lastUserIdRef = useRef<string | null>(auth.user?.id || null);
  useEffect(() => {
    const currentUserId = auth.user?.id || null;
    if (lastUserIdRef.current && currentUserId && lastUserIdRef.current !== currentUserId) {
      console.log('User changed from', lastUserIdRef.current, 'to', currentUserId, '- clearing QueryClient cache');
      void client.cancelQueries();
      client.clear();
    }
    lastUserIdRef.current = currentUserId;
  }, [auth.user?.id]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      void client.cancelQueries();
      client.clear();
    }
  }, [auth.status]);

  return (
    <View style={{ flex: 1 }}>
      <PushNotificationsManager />
      <View style={{ flex: 1 }}>
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
          <Stack.Screen name="find-work" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="provider-profile" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="seeker-profile" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="service-profile" options={{ animation: "fade", animationDuration: 200 }} />
          <Stack.Screen name="service-details" options={{ animation: "slide_from_left", animationDuration: 280 }} />
          <Stack.Screen name="service-search" options={{ animation: "slide_from_bottom", animationDuration: 420 }} />

          {/* Action & Creation Flows: Native Bottom Sheet Slide-Up */}
          <Stack.Screen
            name="create-service"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              animationDuration: 280,
              gestureDirection: "vertical",
            }}
          />
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
            name="rating-received"
            options={{
              presentation: "card",
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
      </View>
      {!isAuthRoute && <LocationSheet />}
      {showStartupSplash && (
        <SplashScreen
          isReady={firstRouteReady}
          onComplete={() => {
            markStartupMilestone("first-screen-visible");
            setShowStartupSplash(false);
          }}
        />
      )}
    </View>
  );
}


interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RootErrorBoundary caught fatal startup error:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: "#FAF8F2", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#1A2421", marginBottom: 8, textAlign: "center" }}>
            Unable to start Bulao
          </Text>
          <Text style={{ fontSize: 14, color: "#6B7A6C", textAlign: "center", marginBottom: 20 }}>
            {this.state.error?.message || "An unexpected error occurred while launching the app."}
          </Text>
          <TouchableOpacity
            onPress={this.handleRestart}
            style={{ backgroundColor: "#176B58", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
          >
            <Text style={{ color: "#FAF8F2", fontWeight: "600", fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const fontsReady = fontsLoaded || fontError != null;
  useEffect(() => {
    markStartupMilestone("root-mounted");
  }, []);
  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppFontsContext.Provider value={fontsReady}>
          <LoginFontContext.Provider value={fontsReady}>
            <AuthProvider>
              <QueryClientProvider client={client}>
                <AppContent />
              </QueryClientProvider>
            </AuthProvider>
          </LoginFontContext.Provider>
          </AppFontsContext.Provider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}


