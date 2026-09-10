import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";
import { useLocation } from "../../src/store/location";
import {
  Screen,
  Copy,
  Card,
  Field,
  Button,
  Loading,
  Failure,
  Divider,
  colors,
  s,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
import { PhotoUpload } from "../../src/features/profile/photo";

export default function Profile() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  const location = useLocation((x) => x.location);
  const [name, setName] = useState("");
  const client = useQueryClient();

  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () =>
      api<{ id: string; name: string; area: string; photoUrl: string | null }>(
        "/users/me",
      ),
  });

  useEffect(() => {
    if (me.data) setName(me.data.name);
  }, [me.data]);

  const save = useMutation({
    mutationFn: () =>
      api(
        "/users/me",
        { name, area: location?.area ?? me.data?.area },
        "PATCH",
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await auth.logout();
      client.clear();
    },
  });

  // ── Not signed in ────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <Screen>
        <View style={ps.heroSection}>
          <View style={ps.iconCircle}>
            <Ionicons name="person-outline" size={40} color={colors.green} />
          </View>
          <Text style={ps.heroTitle}>Your Profile</Text>
          <Copy center>Sign in to manage your profile, post jobs, and offer services.</Copy>
        </View>
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      </Screen>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (me.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (me.isError) {
    return (
      <Screen>
        <Failure error={me.error} retry={() => void me.refetch()} />
      </Screen>
    );
  }

  const displayArea = location?.area ?? me.data.area;
  const initials = (me.data.name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Main Profile ─────────────────────────────────────────────────────────────
  return (
    <Screen>
      {/* ── Header ── */}
      <View style={ps.header}>
        <Text style={ps.pageTitle}>My Profile</Text>
        <View style={ps.verifiedBadge}>
          <Ionicons name="shield-checkmark" size={13} color={colors.green} />
          <Text style={ps.verifiedText}>Verified</Text>
        </View>
      </View>

      {/* ── Avatar Card ── */}
      <Card>
        <View style={ps.avatarRow}>
          {me.data.photoUrl ? (
            <Image
              source={{ uri: me.data.photoUrl }}
              accessibilityLabel={me.data.name}
              style={ps.avatar}
            />
          ) : (
            <View style={ps.avatarFallback}>
              <Text style={ps.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={ps.avatarInfo}>
            <Text style={ps.userName}>
              {me.data.name || "Add your name"}
            </Text>
            <View style={ps.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.mutedLight} />
              <Text style={ps.locationText}>
                {displayArea || "Location not set"}
              </Text>
            </View>
          </View>
        </View>
        <PhotoUpload />
      </Card>

      {/* ── Edit Info Card ── */}
      <Card>
        <Text style={ps.sectionTitle}>Edit Information</Text>
        <Divider />
        <Field
          label={t("name")}
          value={name}
          onChangeText={setName}
          placeholder={t("namePlaceholder")}
        />
        <Pressable
          style={ps.locationButton}
          onPress={() => router.push("/location")}
          accessibilityRole="button"
        >
          <Ionicons name="location-outline" size={18} color={colors.green} />
          <Text style={ps.locationButtonText}>
            {displayArea || t("location")}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
        </Pressable>
        <Button
          label={t("save")}
          disabled={
            save.isPending ||
            name.trim().length < 2 ||
            !(location?.area || me.data.area)
          }
          onPress={() => save.mutate()}
        />
        {save.isSuccess && (
          <View style={ps.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={ps.successText}>{t("saved")}</Text>
          </View>
        )}
        {save.error && <Failure error={save.error} />}
      </Card>

      {/* ── Actions Card ── */}
      <Card>
        <Text style={ps.sectionTitle}>Services</Text>
        <Divider />
        <Pressable
          style={ps.actionRow}
          onPress={() => router.push("/services/offer")}
          accessibilityRole="button"
        >
          <View style={ps.actionIconBox}>
            <Ionicons name="construct-outline" size={20} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ps.actionTitle}>{t("offer")}</Text>
            <Text style={ps.actionHint}>List your skills &amp; services</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />
        </Pressable>
      </Card>

      {/* ── Logout ── */}
      <Button
        label={t("signOut")}
        secondary
        danger
        disabled={logoutMutation.isPending}
        onPress={() => logoutMutation.mutate()}
      />
      {logoutMutation.error && <Failure error={logoutMutation.error} />}
    </Screen>
  );
}

// ─── Local Styles ─────────────────────────────────────────────────────────────
const ps = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 30,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.greenLight,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.line,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.green,
  },
  avatarInfo: {
    flex: 1,
    gap: 5,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: colors.mutedLight,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.greenLight,
    borderRadius: 14,
    padding: 16,
    minHeight: 54,
  },
  locationButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.greenDark,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E6F7ED",
    borderRadius: 12,
    padding: 12,
  },
  successText: {
    color: colors.success,
    fontWeight: "600",
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 6,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  actionHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
  },
});



