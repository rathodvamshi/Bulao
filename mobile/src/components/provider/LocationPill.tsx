import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { radii } from "./palette";

export function LocationPill({
  area,
  accessibilityLabel,
  onPress,
  width,
}: {
  area?: string | null;
  accessibilityLabel: string;
  onPress: () => void;
  width?: number;
}) {
  return (
    <View style={[styles.slot, width != null && { width, flexBasis: width, flexGrow: 0, flexShrink: 0 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the work area selector"
        onPress={onPress}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        android_ripple={{ color: "rgba(7, 91, 67, 0.12)", borderless: false }}
        style={({ pressed }) => [styles.pill, width != null && { width }, pressed && styles.pressed]}
      >
        <BlurView
          intensity={Platform.OS === "android" ? 10 : 18}
          tint="dark"
          style={styles.blur}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={styles.glassTint} />
        <View style={styles.pinBadge}>
          <Ionicons name="location-sharp" size={15} color="#D8E9A2" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.area} numberOfLines={1} ellipsizeMode="tail">
            {area || "Set work area"}
          </Text>
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-down" size={11} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: "100%",
    height: 40,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 7,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.25,
    borderColor: "rgba(255, 255, 255, 0.3)",
    overflow: "hidden",
  },
  slot: { maxWidth: 195, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  pressed: { opacity: 0.82 },
  blur: { ...StyleSheet.absoluteFillObject, borderRadius: radii.pill },
  glassTint: { ...StyleSheet.absoluteFillObject, borderRadius: radii.pill, backgroundColor: "rgba(255, 255, 255, 0.04)" },
  pinBadge: { width: 20, height: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  textContainer: { flex: 1, minWidth: 0, justifyContent: "center" },
  area: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.1, includeFontPadding: false, textAlignVertical: "center" },
  chevronWrap: { width: 18, height: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
