import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { dash } from "./palette";

type NavId = "bulao" | "jobs" | "post" | "activity" | "profile";

const ITEMS: {
  id: NavId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: string;
  center?: boolean;
}[] = [
  { id: "bulao", label: "Bulao", icon: "home-outline", activeIcon: "home", path: "/provider-home" },
  { id: "jobs", label: "Jobs", icon: "briefcase-outline", activeIcon: "briefcase", path: "/activity" },
  { id: "post", label: "Post", icon: "add", activeIcon: "add", path: "/post-work", center: true },
  { id: "activity", label: "Activity", icon: "stats-chart-outline", activeIcon: "stats-chart", path: "/activity" },
  { id: "profile", label: "Profile", icon: "person-outline", activeIcon: "person", path: "/profile" },
];

export function ProviderBottomNav({ active = "bulao" }: { active?: NavId }) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {/* Blur overlay for content below navbar */}
      <View style={styles.blurOverlay} pointerEvents="none">
        {Platform.OS === "ios" ? (
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.androidBlur} />
        )}
      </View>
      
      <View style={styles.floatingContainer}>
        <View style={styles.bar}>
          <View style={[StyleSheet.absoluteFill, styles.webFrost]} />
          <View style={styles.row}>
            {ITEMS.map((item) => {
              const isActive = item.id === active;
              if (item.center) {
                return (
                  <View key={item.id} style={styles.slot}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Post a new job"
                      onPress={() => router.push(item.path)}
                      style={({ pressed }) => [
                        styles.plus,
                        { transform: [{ scale: pressed ? 0.94 : 1 }] },
                      ]}
                    >
                      <View style={styles.plusRing}>
                        <Ionicons name="add" size={30} color={dash.white} />
                      </View>
                    </Pressable>
                    <Text style={[styles.label, styles.plusLabel]}>{item.label}</Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    if (item.id === "bulao") {
                      router.replace("/provider-home");
                      return;
                    }
                    router.push(item.path);
                  }}
                  style={styles.slot}
                >
                  {item.id === "bulao" ? (
                    // Custom "B" text for Bulao
                    <View style={[styles.bulaoIcon, isActive && styles.bulaoIconActive]}>
                      <Text style={[styles.bulaoText, isActive && styles.bulaoTextActive]}>B</Text>
                    </View>
                  ) : (
                    // Regular icons for other items
                    <Ionicons
                      name={isActive ? item.activeIcon : item.icon}
                      size={22}
                      color={isActive ? dash.primary : "#8A9699"}
                    />
                  )}
                  <Text style={[styles.label, isActive && styles.labelActive]}>
                    {item.label}
                  </Text>
                  {isActive ? <View style={styles.activeUnderline} /> : <View style={styles.dotSpacer} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "visible",
    alignItems: "center",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  blurOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    zIndex: -1,
  },
  androidBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 250, 247, 0.5)",
  },
  floatingContainer: {
    width: "100%",
    maxWidth: 420,
  },
  bar: {
    overflow: "visible",
    paddingVertical: 0,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  webFrost: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 64,
    paddingBottom: 2,
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "#8A9699",
  },
  labelActive: {
    color: dash.primary,
    fontWeight: "700",
  },
  activeUnderline: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: dash.primary,
    marginTop: 4,
  },
  dotSpacer: {
    height: 7,
    marginTop: 4,
  },
  plus: {
    marginTop: -28,
    marginBottom: 2,
  },
  plusRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: dash.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  plusLabel: {
    color: dash.primary,
    fontWeight: "700",
  },
  bulaoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bulaoIconActive: {
    backgroundColor: dash.primary,
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  bulaoText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: -0.5,
  },
  bulaoTextActive: {
    color: "#FFFFFF",
  },
});
