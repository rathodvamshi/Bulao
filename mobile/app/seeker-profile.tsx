import { useCallback, useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { Button, colors, Failure } from "../src/components/ui";
import { ProfileScreenSkeleton } from "../src/components/SkeletonLoader";
import { ProviderBottomNav } from "../src/components/provider/ProviderBottomNav";
import { PageTransition } from "../src/components/PageTransition";
import { CommonIdentityCard } from "../src/features/profile/components/CommonIdentityCard";
import { SeekerProfileView } from "../src/features/profile/components/SeekerProfileView";
import type { CommonProfileData, ReviewItem, SeekerRoleData } from "../src/features/profile/types";

type SeekerProfileResponse = {
  id: string;
  name: string;
  area: string | null;
  phone?: string | null;
  phoneVerified?: number;
  photoUrl: string | null;
  createdAt?: number;
  rating: number | null;
  totalReviews: number;
  completed: number;
  stars5?: number;
  stars4?: number;
  stars3?: number;
  stars2?: number;
  stars1?: number;
  reviews: ReviewItem[];
};

export default function SeekerProfileScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const token = auth.session?.token || null;
  const userId = auth.user?.id || auth.session?.userId || null;
  const handleSeekerTabChange = useCallback((tab: "findWork" | "applications" | "profile") => {
    if (tab === "profile") return;
    router.replace({
      pathname: "/find-work",
      params: { tab: tab === "applications" ? "applications" : "jobs" },
    });
  }, []);

  const meQuery = useQuery<CommonProfileData>({
    queryKey: ["me", userId || token],
    enabled: !!token,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });

  const detailQuery = useQuery<SeekerProfileResponse>({
    queryKey: ["profiles", userId || meQuery.data?.id, "seeker"],
    enabled: !!token && !!(userId || meQuery.data?.id),
    queryFn: () => api<SeekerProfileResponse>(`/profiles/${userId || meQuery.data!.id}?role=seeker`),
  });

  useFocusEffect(
    useCallback(() => {
      const targetId = userId || meQuery.data?.id;
      if (targetId) {
        void client.invalidateQueries({ queryKey: ["profiles", targetId, "seeker"] });
      }
    }, [userId, meQuery.data?.id, client]),
  );

  const profile = useMemo<CommonProfileData>(() => ({
    id: meQuery.data?.id || auth.user?.id || "user",
    name: meQuery.data?.name || auth.user?.name || "User",
    area: meQuery.data?.area || auth.user?.area || "",
    phone: meQuery.data?.phone || auth.user?.phone,
    phoneVerified: meQuery.data?.phoneVerified ?? detailQuery.data?.phoneVerified ?? 0,
    photoUrl: meQuery.data?.photoUrl || null,
    createdAt: meQuery.data?.createdAt,
    rating: detailQuery.data?.rating ?? null,
  }), [meQuery.data, detailQuery.data, auth.user]);

  const seekerData = useMemo<SeekerRoleData>(() => ({
    rating: detailQuery.data?.rating ?? null,
    totalReviews: detailQuery.data?.totalReviews ?? 0,
    completed: detailQuery.data?.completed ?? 0,
    starDistribution: {
      stars5: detailQuery.data?.stars5 ?? 0,
      stars4: detailQuery.data?.stars4 ?? 0,
      stars3: detailQuery.data?.stars3 ?? 0,
      stars2: detailQuery.data?.stars2 ?? 0,
      stars1: detailQuery.data?.stars1 ?? 0,
    },
    reviews: detailQuery.data?.reviews ?? [],
  }), [detailQuery.data]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["profiles", meQuery.data?.id, "seeker"] });
  };

  if (!token) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top + 12 }]}>
        <PageTransition style={styles.centerContent}>
          <View style={styles.heroIcon}><Ionicons name="person-outline" size={38} color="#075B43" /></View>
          <Text style={styles.title}>Seeker profile</Text>
          <Text style={styles.helper}>Sign in to manage your worker profile and feedback.</Text>
          <Button label="Sign in to Bulao" onPress={() => router.push("/auth")} />
        </PageTransition>
        <ProviderBottomNav active="profile" variant="seeker" seekerActive="profile" onSeekerTabChange={handleSeekerTabChange} />
      </View>
    );
  }

  if (meQuery.isPending && !meQuery.data) {
    return <View style={styles.screen}><PageTransition style={{ flex: 1 }}><ProfileScreenSkeleton /></PageTransition><ProviderBottomNav active="profile" variant="seeker" seekerActive="profile" onSeekerTabChange={handleSeekerTabChange} /></View>;
  }

  if (meQuery.isError) {
    return <View style={[styles.screen, { paddingTop: insets.top + 20 }]}><PageTransition style={styles.errorContent}><Failure error={meQuery.error} retry={() => void meQuery.refetch()} /></PageTransition><ProviderBottomNav active="profile" variant="seeker" seekerActive="profile" onSeekerTabChange={handleSeekerTabChange} /></View>;
  }

  return (
    <View style={styles.screen}>
      <PageTransition style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>YOUR ACCOUNT</Text>
            <Text style={styles.title}>Seeker profile</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={20} color="#075B43" />
          </Pressable>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={meQuery.isRefetching || detailQuery.isRefetching} onRefresh={refresh} colors={["#075B43"]} tintColor="#075B43" />}
        >
          <CommonIdentityCard profile={profile} />
          <SeekerProfileView data={seekerData} profile={profile} isOwner />
        </ScrollView>
      </PageTransition>
      <ProviderBottomNav active="profile" variant="seeker" seekerActive="profile" onSeekerTabChange={handleSeekerTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAF7" },
  center: { justifyContent: "center", alignItems: "center", paddingHorizontal: 24, gap: 12 },
  centerContent: { width: "100%", alignItems: "center", justifyContent: "center", gap: 12 },
  errorContent: { flex: 1, paddingTop: 20 },
  header: { minHeight: 66, paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAF7" },
  headerCopy: { gap: 2 },
  kicker: { color: "#638174", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.5 },
  settingsButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#E2EAE4", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, gap: 14 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#E9F8EF", alignItems: "center", justifyContent: "center" },
  helper: { color: "#617067", textAlign: "center", lineHeight: 20, marginBottom: 8 },
});
