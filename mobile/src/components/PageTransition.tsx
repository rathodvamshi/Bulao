import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, ViewStyle } from "react-native";

interface PageTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  duration?: number;
  initialY?: number;
}

/**
 * PageTransition provides a silky-smooth, 60 FPS GPU-accelerated
 * entrance animation (soft fade + subtle upward glide) when a screen mounts.
 * This completely eliminates the jarring "pop-in" effect of complex pages.
 */
export function PageTransition({
  children,
  style,
  duration = 220,
  initialY = 8,
}: PageTransitionProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(initialY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8.5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
