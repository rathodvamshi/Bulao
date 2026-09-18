import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dash } from "./palette";

type NavId = "bulao" | "home" | "jobs" | "job" | "post" | "activity" | "profile";

const ITEMS: {
  id: "bulao" | "home" | "post" | "jobs" | "profile";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: string;
  center?: boolean;
}[] = [
  { id: "bulao", label: "Bulao", icon: "home-outline", activeIcon: "home", path: "/(tabs)" },
  { id: "home", label: "Home", icon: "home-outline", activeIcon: "home", path: "/find-service" },
  { id: "post", label: "Post", icon: "add", activeIcon: "add", path: "/post-work", center: true },
  { id: "jobs", label: "Job", icon: "briefcase-outline", activeIcon: "briefcase", path: "/activity" },
  { id: "profile", label: "Profile", icon: "person-outline", activeIcon: "person", path: "/provider-profile" },
];

export function ServiceBottomNav({
  active = "home",
}: {
  active?: NavId;
}) {
  const insets = useSafeAreaInsets();
  const bottomSpace = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomSpace }]}>
      {/* Blur overlay ONLY below the bottom of the navbar (never above) */}
      <View
        style={[
          styles.blurOverlay,
          { height: bottomSpace + 4 },
        ]}
        pointerEvents="none"
      >
        <BlurView
          intensity={Platform.OS === "android" ? 50 : 80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            "rgba(248, 250, 247, 0.4)",
            "rgba(248, 250, 247, 0.85)",
            "rgba(248, 250, 247, 0.98)",
          ]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        {Platform.OS === "web" && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              } as any,
            ]}
          />
        )}
      </View>
      
      <View style={styles.floatingContainer}>
        <View style={styles.bar}>
          <View style={[StyleSheet.absoluteFill, styles.webFrost]} />
          <View style={styles.row}>
            {ITEMS.map((item) => {
              const isActive =
                item.id === active ||
                (item.id === "jobs" && (active === "job" || active === "activity"));
              if (item.center) {
                return (
                  <View key={item.id} style={styles.slot}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Post a new service request"
                      onPress={() => {
                        if (active === "post") return;
                        router.push(item.path);
                      }}
                      style={({ pressed }) => [
                        styles.plus,
                        { transform: [{ scale: pressed ? 0.94 : 1 }] },
                      ]}
                    >
                      <View style={styles.plusRing}>
                        <Ionicons name="add" size={26} color={dash.white} />
                      </View>
                    </Pressable>
                    <Text style={[styles.label, styles.plusLabel]}>{item.label}</Text>
                    <View style={styles.indicatorContainer} />
                  </View>
                );
              }

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    // Prevent reloading if already on the current page
                    if (isActive) {
                      return;
                    }

                    if (item.id === "bulao") {
                      // Redirect directly to the main Bulao home page in one tap
                      router.replace("/(tabs)");
                      return;
                    }
                    if (item.id === "home") {
                      router.replace("/find-service");
                      return;
                    }
                    if (item.id === "jobs") {
                      router.replace("/activity");
                      return;
                    }
                    if (item.id === "profile") {
                      router.replace("/provider-profile");
                      return;
                    }
                    router.push(item.path);
                  }}
                  style={styles.slot}
                >
                  <View style={styles.iconBox}>
                    {item.id === "bulao" ? (
                      // Custom "B" badge for Bulao with back arrow in front of the B char
                      <View style={[styles.bulaoIcon, isActive && styles.bulaoIconActive]}>
                        <Ionicons
                          name="arrow-back"
                          size={11}
                          color={isActive ? "#FFFFFF" : dash.primary}
                          style={styles.bulaoArrow}
                        />
                        <Text style={[styles.bulaoText, isActive && styles.bulaoTextActive]}>B</Text>
                      </View>
                    ) : (
                      // Regular icons for other items
                      <View style={styles.regularIconWrap}>
                        <Ionicons
                          name={isActive ? item.activeIcon : item.icon}
                          size={22}
                          color={isActive ? dash.primary : "#8A9699"}
                        />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.label, isActive && styles.labelActive]}>
                    {item.label}
                  </Text>
                  <View style={styles.indicatorContainer}>
                    {isActive ? <View style={styles.activeUnderline} /> : null}
                  </View>
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
    zIndex: 99,
    overflow: "visible",
    alignItems: "center",
  },
  blurOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  floatingContainer: {
    alignItems: "center",
    justifyContent: "center",
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
    alignSelf: "center",
  },
  webFrost: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  slot: {
    width: 58,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 64,
    paddingBottom: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  regularIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#8A9699",
    lineHeight: 14,
    textAlign: "center",
  },
  labelActive: {
    color: dash.primary,
    fontWeight: "700",
  },
  indicatorContainer: {
    height: 3,
    width: 20,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  activeUnderline: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: dash.primary,
  },
  plus: {
    marginTop: -22,
    marginBottom: 2,
  },
  plusRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3.5,
    borderColor: "#FFFFFF",
    shadowColor: dash.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  plusLabel: {
    color: dash.primary,
    fontWeight: "700",
  },
  bulaoIcon: {
    minWidth: 32,
    height: 28,
    borderRadius: 8,
    backgroundColor: dash.softGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
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
    fontSize: 14,
    fontWeight: "900",
    color: dash.primary,
    letterSpacing: -0.5,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  bulaoTextActive: {
    color: "#FFFFFF",
  },
  bulaoArrow: {
    marginRight: 2,
  },
});
