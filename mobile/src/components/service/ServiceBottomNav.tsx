import { useState } from "react";
import { Pressable, StyleSheet, Text, View, Platform, Modal, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dash } from "./palette";

type NavId = "bulao" | "home" | "jobs" | "job" | "requests" | "post" | "activity" | "profile";

const ITEMS: {
  id: "bulao" | "home" | "jobs" | "job" | "post" | "requests" | "profile";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: string;
  center?: boolean;
}[] = [
  { id: "bulao", label: "Bulao", icon: "home-outline", activeIcon: "home", path: "/(tabs)" },
  { id: "home", label: "Home", icon: "home-outline", activeIcon: "home", path: "/find-service" },
  { id: "post", label: "Create Service", icon: "add", activeIcon: "add", path: "/create-service", center: true },
  { id: "requests", label: "Requests", icon: "document-text-outline", activeIcon: "document-text", path: "/service-requests" },
  { id: "profile", label: "Profile", icon: "person-outline", activeIcon: "person", path: "/service-profile" },
];

export function ServiceBottomNav({
  active = "home",
}: {
  active?: NavId;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slotWidth = Math.min(58, Math.max(0, (width - 48) / 5));
  const bottomSpace = insets.bottom > 0 ? insets.bottom : 8;
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState("Feature");

  const showComingSoon = (name: string) => {
    setComingSoonTitle(name);
    setComingSoonVisible(true);
  };

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
            "rgba(250, 244, 236, 0.4)",
            "rgba(250, 244, 236, 0.85)",
            "rgba(250, 244, 236, 0.98)",
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
                (item.id === "requests" && (active === "job" || active === "jobs" || active === "activity" || active === "requests"));
              if (item.center) {
                return (
                  <View key={item.id} style={[styles.slot, { width: slotWidth }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Create Service"
                      onPress={() => {
                        router.push("/create-service");
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
                    <Text
                      style={[styles.label, styles.plusLabel]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {item.label}
                    </Text>
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
                    if (item.id === "jobs") {
                      showComingSoon("Jobs");
                      return;
                    }
                    if (isActive) {
                      return;
                    }

                    if (item.id === "bulao") {
                      router.replace("/(tabs)");
                      return;
                    }
                    if (item.id === "home") {
                      router.replace("/find-service");
                      return;
                    }
                    if (item.id === "requests") {
                      router.replace("/service-requests");
                      return;
                    }
                    if (item.id === "profile") {
                      router.replace("/service-profile");
                      return;
                    }
                    router.push(item.path);
                  }}
                  style={[styles.slot, { width: slotWidth }]}
                >
                  <View style={styles.iconBox}>
                    {item.id === "bulao" ? (
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

      <ComingSoonModal
        visible={comingSoonVisible}
        title={comingSoonTitle}
        onClose={() => setComingSoonVisible(false)}
      />
    </View>
  );
}

function ComingSoonModal({
  visible,
  title,
  onClose,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalIconCircle}>
            <Ionicons name="sparkles" size={28} color="#075B43" />
          </View>
          <Text style={styles.modalTitle}>{title} Coming Soon!</Text>
          <Text style={styles.modalSub}>
            We're building an incredible experience for managing service requests. Check back soon for updates!
          </Text>
          <Pressable style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
    gap: 4,
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
    width: 58,
    height: 14,
    fontSize: 9,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 42, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#102A2A",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: "#63727A",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    width: "100%",
    backgroundColor: dash.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
