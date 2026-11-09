import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth";
import { colors } from "../../../components/ui";
import { useLocation } from "../../../store/location";
import type { ProfileRole } from "../types";

export function ProfileSettingsSection({ role }: { role: ProfileRole }) {
  const auth = useAuth();
  const client = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await auth.logout();
      client.clear();
      router.replace("/(tabs)");
    },
  });

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your Bulao account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => logoutMutation.mutate(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ── 1. Places & Worksite Management ─────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your area</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => useLocation.getState().setLocationSheetVisible(true)}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="map-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Preferred work area</Text>
            <Text style={styles.settingSubtitle}>
              Change where we look for nearby opportunities
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>
      </View>

      {/* ── 2. Work activity ────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Work activity</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => role === "seeker"
            ? router.push({ pathname: "/find-work", params: { tab: "applications" } })
            : router.push("/activity")}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="briefcase-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{role === "seeker" ? "Applications & completed work" : "Requests & completed work"}</Text>
            <Text style={styles.settingSubtitle}>
              Review current activity and past jobs
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>
      </View>

      {/* ── 3. App Settings & Notifications ─────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences &amp; Language</Text>

        <View style={styles.settingRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="language-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>App Language</Text>
            <Text style={styles.settingSubtitle}>English (India)</Text>
          </View>
        </View>

        <View style={styles.rowDivider} />

        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/notifications", params: { role: role === "service" ? "provider" : role, context: role === "service" ? "service" : role === "provider" ? "hire" : "work" } })} style={styles.settingRow}>
          <View style={styles.iconCircle}><Ionicons name="notifications-outline" size={18} color="#075B43" /></View>
          <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Notifications</Text><Text style={styles.settingSubtitle}>Review application and work updates</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />
        </Pressable>
      </View>

      {/* ── 4. Safety & Support ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trust &amp; Safety</Text>

        <Pressable accessibilityRole="button" onPress={() => router.push("/safety")} style={styles.settingRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Safety &amp; reporting</Text>
            <Text style={styles.settingSubtitle}>Report a concern or block someone involved in a request</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>

      </View>

      {/* ── 5. Sign Out & Version ───────────────────────────────────────── */}
      <Pressable
        accessibilityRole="button"
        onPress={handleSignOut}
        disabled={logoutMutation.isPending}
        style={styles.logoutBtn}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={styles.logoutText}>
          {logoutMutation.isPending ? "Signing out..." : "Sign Out of Bulao"}
        </Text>
      </Pressable>

      <Text style={styles.versionText}>
        Bulao v{Constants.expoConfig?.version ?? "—"} · Local work. Real people.
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#F0F4F1",
    marginVertical: 4,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginTop: 6,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
  },
  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: colors.mutedLight,
    marginTop: 6,
    lineHeight: 16,
  },
});
