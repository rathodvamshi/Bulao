import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Modal, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth";
import { colors } from "../../../components/ui";
import { useLocation } from "../../../store/location";

export function ProfileSettingsSection() {
  const auth = useAuth();
  const client = useQueryClient();
  const [showHelpModal, setShowHelpModal] = useState(false);

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
        <Text style={styles.sectionTitle}>Places &amp; Worksites</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => useLocation.getState().setLocationSheetVisible(true)}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="map-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Saved Worksites &amp; Addresses</Text>
            <Text style={styles.settingSubtitle}>
              Home, Construction Site, Shop, Factory
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>
      </View>

      {/* ── 2. Payments & Invoices ──────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payments &amp; Wage Settlement</Text>

        <View style={styles.settingRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="wallet-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Payout Method</Text>
            <Text style={styles.settingSubtitle}>UPI: vamshi@upi · Verified</Text>
          </View>
          <View style={styles.activeTag}>
            <Text style={styles.activeTagText}>Default</Text>
          </View>
        </View>

        <View style={styles.rowDivider} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/activity")}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="receipt-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Hiring Invoices &amp; Wage History</Text>
            <Text style={styles.settingSubtitle}>
              Download worker receipts &amp; GST invoices
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
          <Text style={styles.prefValueText}>Change</Text>
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.settingRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Job &amp; Applicant Alerts</Text>
            <Text style={styles.settingSubtitle}>
              Instant push notifications &amp; SMS enabled
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#075B43" />
        </View>
      </View>

      {/* ── 4. Safety & Support ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trust &amp; Safety</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/safety")}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Bulao Trust &amp; Safety Center</Text>
            <Text style={styles.settingSubtitle}>
              Fair wage rules, harassment policies &amp; insurance
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable
          accessibilityRole="button"
          onPress={() => setShowHelpModal(true)}
          style={styles.settingRow}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="headset-outline" size={18} color="#075B43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>24/7 Bulao Helpline</Text>
            <Text style={styles.settingSubtitle}>
              Direct call support for employers &amp; workers
            </Text>
          </View>
          <Ionicons name="call" size={16} color="#075B43" />
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
        Bulao v2.4.0 · Local Help. Real People. · Made with ❤️ for India
      </Text>

      {/* Helpline Modal */}
      <Modal visible={showHelpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Ionicons name="headset" size={28} color="#075B43" />
            </View>
            <Text style={styles.modalTitle}>Bulao Priority Helpline</Text>
            <Text style={styles.modalBody}>
              Need help with worker attendance, payment settlement, or job posting assistance?
            </Text>
            <Pressable
              onPress={() => {
                setShowHelpModal(false);
                void Linking.openURL("tel:18002008899");
              }}
              style={styles.modalCallBtn}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.modalCallText}>Call 1800-200-8899 (Toll Free)</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowHelpModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  activeTag: {
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#075B43",
  },
  prefValueText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#075B43",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  modalIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  modalCallBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#075B43",
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  modalCallText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
});
