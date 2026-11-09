import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  UIManager,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Enable smooth LayoutAnimation on Android for the Legacy Architecture only.
// Guard against New Architecture (Fabric) where this call is a no-op and
// generates a console warning.
if (
  Platform.OS === "android" &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === "function" &&
  !(global as any).nativeFabricUIManager
) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Legacy API unavailable in this architecture — safe to ignore.
  }
}

export interface ServiceAboutCardProps {
  description?: string;
}

export function ServiceAboutCard({ description }: ServiceAboutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  const cleanDesc = description?.trim() || "";

  if (!cleanDesc) return null;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconHalo}>
          <Ionicons name="information-circle" size={16} color="#047857" />
        </View>
        <Text style={styles.headerTitle}>About This Service</Text>
      </View>

      <Text
        style={styles.bodyText}
        numberOfLines={expanded ? undefined : 2}
        onTextLayout={(e) => {
          // If the text naturally has more than 2 lines, enable the Read More button
          if (e.nativeEvent.lines.length > 2 && !canExpand) {
            setCanExpand(true);
          }
        }}
      >
        {cleanDesc}
      </Text>

      {(canExpand || cleanDesc.length > 90) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Read Less" : "Read More"}
          onPress={handleToggle}
          hitSlop={8}
          style={styles.toggleBtn}
        >
          <Text style={styles.toggleBtnText}>
            {expanded ? "Read Less" : "Read More"}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={13}
            color="#047857"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  bodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
});
