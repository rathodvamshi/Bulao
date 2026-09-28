import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface GrowYourBusinessCardProps {
  onPress: () => void;
  style?: object;
}

export function GrowYourBusinessCard({ onPress, style }: GrowYourBusinessCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Grow your business: Keep your services updated, respond to requests and get more customers."
      accessibilityHint="Opens your service growth and profile improvement actions"
      android_ripple={{ color: "rgba(0, 92, 63, 0.08)", borderless: false }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Left Circular Icon Badge */}
      <View style={styles.circleBadge}>
        <Ionicons name="trending-up" size={26} color="#005C3F" />
      </View>

      {/* Center Text Column */}
      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={1}>
          Grow your business
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          Keep your services updated, respond to requests and get more customers.
        </Text>
      </View>

      {/* Right Chevron Arrow */}
      <Ionicons name="chevron-forward" size={20} color="#101E2E" style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#E2F6EB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#C5EBD5",
    overflow: "hidden",
  },
  pressed: {
    opacity: Platform.OS === "ios" ? 0.9 : 1,
    backgroundColor: "#D4F0E0",
    transform: [{ scale: 0.995 }],
  },
  circleBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#BFEAD0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textColumn: {
    flex: 1,
    justifyContent: "center",
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B2B1D",
    letterSpacing: -0.3,
    marginBottom: 3,
    includeFontPadding: false,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 17,
    color: "#3D6352",
    fontWeight: "400",
    includeFontPadding: false,
  },
  chevron: {
    marginLeft: 4,
  },
});
