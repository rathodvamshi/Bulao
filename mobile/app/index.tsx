/**
 * App Entry Point / Bootstrap Screen
 * 
 * Handles authentication bootstrap and routing:
 * - Shows splash screen during bootstrap
 * - Routes to Home if authenticated
 * - Routes to Auth if unauthenticated
 * - Shows error state for network issues
 */

import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SplashScreen } from "../src/components/SplashScreen";
import { useAuth } from "../src/auth";

const COLORS = {
  green: "#176B58",
  cream: "#FAF8F2",
  ink: "#1A2421",
  muted: "#6B7A6C",
  error: "#C8553D",
};

export default function Index() {
  const [showSplash, setShowSplash] = useState(true);
  const auth = useAuth();

  useEffect(() => {
    // Wait for splash to complete before routing
    if (showSplash) return;

    // Wait for auth bootstrap to complete
    if (auth.status === 'bootstrapping') return;

    // Route based on auth status
    if (auth.status === 'authenticated') {
      console.log('Index: Authenticated, routing to home');
      router.replace('/(tabs)');
    } else if (auth.status === 'unauthenticated') {
      console.log('Index: Unauthenticated, routing to auth');
      router.replace('/auth');
    }
    // If network_error, stay on this screen to show error + retry
  }, [showSplash, auth.status]);

  // Show splash screen during initial animation
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Splash complete - show bootstrap status
  if (auth.status === 'bootstrapping') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.green} size="large" />
      </View>
    );
  }

  // Network error during bootstrap
  if (auth.error && auth.status !== 'authenticated') {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Connection Issue</Text>
          <Text style={styles.errorMessage}>{auth.error.message}</Text>
          
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => auth.retry()}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.replace('/auth')}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Default loading state (should not be visible long)
  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.green} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: COLORS.green,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.green,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  continueButton: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: COLORS.green,
    fontSize: 15,
    fontWeight: '600',
  },
});
