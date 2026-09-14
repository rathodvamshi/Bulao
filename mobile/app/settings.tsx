import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Modal, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";

export default function SettingsScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
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
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── 1. Worksites & Places ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>PLACES &amp; WORKSITES</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => useLocation.getState().setLocationSheetVisible(true)}
            style={styles.row}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="map-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Saved Addresses &amp; Worksites</Text>
              <Text style={styles.rowSub}>Home, Site, Shop, Factory</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
          </Pressable>
        </View>

        {/* ── 2. Payments & Invoices ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>PAYMENT &amp; WAGES</Text>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="card-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Payout Method</Text>
              <Text style={styles.rowSub}>UPI: vamshi@upi · Verified</Text>
            </View>
            <View style={styles.defaultPill}>
              <Text style={styles.defaultPillText}>Default</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/activity")}
            style={styles.row}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="receipt-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Hiring Invoices &amp; Wage History</Text>
              <Text style={styles.rowSub}>Download payment receipts &amp; GST</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
          </Pressable>
        </View>

        {/* ── 3. Preferences & Language ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>APP PREFERENCES</Text>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="language-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>App Language</Text>
              <Text style={styles.rowSub}>English (India)</Text>
            </View>
            <Text style={styles.actionText}>Change</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Job &amp; Applicant Alerts</Text>
              <Text style={styles.rowSub}>Push notifications &amp; SMS active</Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color="#075B43" />
          </View>
        </View>

        {/* ── 4. Safety & Support ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>HELP &amp; SUPPORT</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/safety")}
            style={styles.row}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Trust &amp; Safety Policies</Text>
              <Text style={styles.rowSub}>Fair pay standards &amp; dispute guidelines</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowHelpModal(true)}
            style={styles.row}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="headset-outline" size={18} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>24/7 Priority Helpline</Text>
              <Text style={styles.rowSub}>Call 1800-200-8899 (Toll Free)</Text>
            </View>
            <Ionicons name="call" size={16} color="#075B43" />
          </Pressable>
        </View>

        {/* ── 5. Sign Out ── */}
        <Pressable
          accessibilityRole="button"
          onPress={handleSignOut}
          disabled={logoutMutation.isPending}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>
            {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>
          Bulao v2.4.0 · Local Help. Real People.
        </Text>
      </ScrollView>

      {/* Helpline Modal */}
      <Modal visible={showHelpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Ionicons name="headset" size={28} color="#075B43" />
            </View>
            <Text style={styles.modalTitle}>Bulao Priority Helpline</Text>
            <Text style={styles.modalBody}>
              Need assistance with your job posting, payment, or worker verification?
            </Text>
            <Pressable
              onPress={() => {
                setShowHelpModal(false);
                void Linking.openURL("tel:18002008899");
              }}
              style={styles.modalCallBtn}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.modalCallText}>Call Toll Free (1800-200-8899)</Text>
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
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#F8FAF7",
    borderBottomWidth: 1,
    borderBottomColor: "#EAEFEA",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6ECE8",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.mutedLight,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
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
  rowTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  rowSub: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F4F1",
    marginVertical: 4,
  },
  defaultPill: {
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  defaultPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#075B43",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#075B43",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 16,
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
