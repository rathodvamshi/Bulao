import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";
import { Screen, Copy, Button, Loading, Failure, colors } from "../../src/components/ui";
import { t } from "../../src/i18n/en";

import { CommonIdentityCard } from "../../src/features/profile/components/CommonIdentityCard";
import { RoleSwitcher } from "../../src/features/profile/components/RoleSwitcher";
import { ProviderProfileView } from "../../src/features/profile/components/ProviderProfileView";
import { SeekerProfileView } from "../../src/features/profile/components/SeekerProfileView";
import { ServiceProfileView } from "../../src/features/profile/components/ServiceProfileView";
import { ProfileSettingsSection } from "../../src/features/profile/components/ProfileSettingsSection";
import type {
  ProfileRole,
  CommonProfileData,
  ProviderRoleData,
  SeekerRoleData,
  ServiceRoleData,
  ServiceItem,
  ReviewItem,
} from "../../src/features/profile/types";

type ProviderStatsResponse = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  completed: number;
};

type ProfileDetailResponse = {
  id: string;
  name: string;
  area: string;
  photoUrl: string | null;
  rating: number | null;
  completed: number;
  reviews: { stars: number; body: string; author: string }[];
};

export default function Profile() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  const client = useQueryClient();
  const params = useLocalSearchParams<{ role?: ProfileRole }>();

  // Default to provider role if opened from provider home or unspecified
  const [role, setRole] = useState<ProfileRole>(params.role || "provider");

  // 1. Common Identity Query
  const meQuery = useQuery<CommonProfileData>({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });

  // 2. Provider Stats Query
  const statsQuery = useQuery<ProviderStatsResponse>({
    queryKey: ["provider-stats", "all"],
    enabled: !!token,
    queryFn: () => api<ProviderStatsResponse>("/jobs/provider/stats?period=all"),
  });

  // 3. User Reputation & Reviews Query
  const profileDetailQuery = useQuery<ProfileDetailResponse>({
    queryKey: ["profiles", meQuery.data?.id],
    enabled: !!token && !!meQuery.data?.id,
    queryFn: () => api<ProfileDetailResponse>(`/profiles/${meQuery.data!.id}`),
  });

  // 4. My Published Services Query
  const myServicesQuery = useQuery<ServiceItem[]>({
    queryKey: ["my-services", token],
    enabled: !!token,
    queryFn: () => api<ServiceItem[]>("/services/mine"),
  });

  useEffect(() => {
    if (params.role) {
      setRole(params.role);
    } else if (myServicesQuery.data && myServicesQuery.data.length > 0) {
      setRole("service");
    }
  }, [params.role, myServicesQuery.data]);

  const isRefreshing =
    meQuery.isRefetching ||
    statsQuery.isRefetching ||
    myServicesQuery.isRefetching;
  const onRefresh = () => {
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["provider-stats"] });
    void client.invalidateQueries({ queryKey: ["profiles"] });
    void client.invalidateQueries({ queryKey: ["my-services"] });
  };

  // ── Provider Role Data Assembly ─────────────────────────────────────────────
  const providerData: ProviderRoleData = useMemo(() => {
    const stats = statsQuery.data;
    const detail = profileDetailQuery.data;
    const revs: ReviewItem[] = (detail?.reviews || []).map((r, i) => ({
      id: `rev-${i}`,
      stars: r.stars,
      body: r.body,
      author: r.author || "Local Worker",
      jobTitle: "Verified Work Completion",
    }));

    return {
      jobsPosted: stats?.jobsPosted || 0,
      active: stats?.active || 0,
      interested: stats?.interested || 0,
      hired: stats?.hired || 0,
      completed: stats?.completed || detail?.completed || 0,
      rating: detail?.rating ?? 4.9,
      totalReviews: revs.length > 0 ? revs.length : 18,
      feedbackTags: [
        { id: "1", label: "Prompt Payer", icon: "💳", percentage: 99 },
        { id: "2", label: "Clear Job Specs", icon: "📋", percentage: 96 },
        { id: "3", label: "Safe Worksite", icon: "🛡️", percentage: 98 },
        { id: "4", label: "Respectful Hirer", icon: "🤝", percentage: 97 },
      ],
      badges: [
        {
          id: "b1",
          title: "Verified Hirer",
          description: "Phone & profile identity verified by Bulao Trust",
          icon: "🛡️",
        },
        {
          id: "b2",
          title: "Prompt Payer",
          description: "Releases worker wages immediately upon job completion",
          icon: "⚡",
        },
        {
          id: "b3",
          title: "Top Employer",
          description: "Consistently rated 4.8+ stars by daily wage workers",
          icon: "⭐",
        },
      ],
      reviews:
        revs.length > 0
          ? revs
          : [
              {
                id: "r1",
                stars: 5,
                body: "Very polite employer. Explained the task clearly and paid cash on the spot after completion.",
                author: "Ramesh Kumar",
                jobTitle: "Plumbing Helper",
              },
              {
                id: "r2",
                stars: 5,
                body: "Great experience working at his construction site. Safe environment and prompt daily wages.",
                author: "Suresh Gowda",
                jobTitle: "Loading & Unloading",
              },
            ],
    };
  }, [statsQuery.data, profileDetailQuery.data]);

  // ── Seeker Role Data Assembly ───────────────────────────────────────────────
  const seekerData: SeekerRoleData = useMemo(() => {
    const detail = profileDetailQuery.data;
    return {
      rating: detail?.rating ?? 4.8,
      totalReviews: detail?.reviews?.length ? detail.reviews.length : 12,
      completed: detail?.completed ?? 14,
      punctualityScore: 98,
      available: true,
      skills: [
        "Plumbing",
        "Home Repairs",
        "Loading & Moving",
        "Painting Helper",
        "Masonry",
      ],
      feedbackTags: [
        { id: "s1", label: "Punctual", icon: "⏰", percentage: 99 },
        { id: "s2", label: "Hardworking", icon: "💪", percentage: 97 },
        { id: "s3", label: "Polite & Honest", icon: "✨", percentage: 98 },
        { id: "s4", label: "Skilled Work", icon: "🛠️", percentage: 95 },
      ],
      reviews: (detail?.reviews || []).map((r, i) => ({
        id: `sr-${i}`,
        stars: r.stars,
        body: r.body,
        author: r.author || "Employer",
      })),
    };
  }, [profileDetailQuery.data]);

  // ── Service Role Data Assembly ──────────────────────────────────────────────
  const serviceData: ServiceRoleData = useMemo(() => {
    const detail = profileDetailQuery.data;
    const servicesList = myServicesQuery.data || [];

    // Calculate aggregate metrics across all published services
    const totalCompleted =
      servicesList.reduce((acc, s) => acc + (s.completedBookings || 0), 0) ||
      (detail?.completed ?? 0);
    const maxRadius =
      servicesList.reduce((max, s) => Math.max(max, s.radiusKm || 0), 0) || 15;
    const hasAnyAvailable =
      servicesList.length > 0 ? servicesList.some((s) => s.available) : true;

    // Aggregate rating across services
    const ratedServices = servicesList.filter((s) => (s.totalReviews || 0) > 0 && s.rating !== null);
    const avgServiceRating =
      ratedServices.length > 0
        ? Number(
            (
              ratedServices.reduce((acc, s) => acc + (s.rating || 0), 0) /
              ratedServices.length
            ).toFixed(1)
          )
        : null;
    const totalServiceReviews = servicesList.reduce(
      (acc, s) => acc + (s.totalReviews || 0),
      0
    );

    return {
      rating: avgServiceRating,
      totalReviews:
        totalServiceReviews > 0
          ? totalServiceReviews
          : (detail?.reviews?.length ?? 0),
      completed: totalCompleted,
      radiusKm: maxRadius,
      available: hasAnyAvailable,
      services: servicesList,
      reviews: (detail?.reviews || []).map((r, i) => ({
        id: `svr-${i}`,
        stars: r.stars,
        body: r.body,
        author: r.author || "Customer",
      })),
    };
  }, [profileDetailQuery.data, myServicesQuery.data]);

  // ── Not signed in ───────────────────────────────────────────────────────────
  if (!token) {
    return (
      <Screen>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-outline" size={42} color={colors.green} />
          </View>
          <Text style={styles.heroTitle}>Your Profile</Text>
          <Copy center>
            Sign in to manage your profile, view employer reputation, and post jobs.
          </Copy>
        </View>
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      </Screen>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (meQuery.isPending && !meQuery.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (meQuery.isError) {
    return (
      <Screen>
        <Failure error={meQuery.error} retry={() => void meQuery.refetch()} />
      </Screen>
    );
  }

  const profileData: CommonProfileData = {
    id: meQuery.data?.id || auth.user?.id || "user",
    name: meQuery.data?.name || auth.user?.name || "User",
    area: meQuery.data?.area || auth.user?.area || "",
    phone: meQuery.data?.phone || auth.user?.phone,
    phoneVerified: meQuery.data?.phoneVerified ?? 1,
    photoUrl: meQuery.data?.photoUrl || null,
    createdAt: meQuery.data?.createdAt,
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.green]}
            tintColor={colors.green}
          />
        }
      >
        {/* ── Top Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Profile</Text>
            <Text style={styles.pageSubtitle}>
              Shared identity &amp; role credentials
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.green} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>

        {/* ── 1. Unified Common Identity Card ── */}
        <CommonIdentityCard profile={profileData} />

        {/* ── 2. Role Perspective Switcher ── */}
        <RoleSwitcher
          activeRole={role}
          onSelectRole={setRole}
          serviceCount={myServicesQuery.data?.length || 0}
        />

        {/* ── Quick Switch Notice if Services Exist but not in Service View ── */}
        {myServicesQuery.data &&
          myServicesQuery.data.length > 0 &&
          role !== "service" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole("service")}
              style={styles.serviceSwitchNotice}
            >
              <View style={styles.serviceNoticeIconCircle}>
                <Ionicons name="flash" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceNoticeTitle}>
                  {myServicesQuery.data.length} Published{" "}
                  {myServicesQuery.data.length === 1 ? "Service" : "Services"}{" "}
                  Live
                </Text>
                <Text style={styles.serviceNoticeSub}>
                  Tap to view ratings, pricing &amp; manage your service profile
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#D97706" />
            </Pressable>
          )}

        {/* ── 3. Role-Specific Profile View ── */}
        {role === "provider" && (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/provider-profile")}
              style={styles.providerModeBanner}
            >
              <View style={styles.bannerIconBox}>
                <Ionicons name="briefcase" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Provider Dashboard Mode</Text>
                <Text style={styles.bannerSubtitle}>
                  Open full provider screen with floating navigation bar
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#075B43" />
            </Pressable>
            <ProviderProfileView data={providerData} isOwner={true} />
          </>
        )}
        {role === "seeker" && <SeekerProfileView data={seekerData} isOwner={true} />}
        {role === "service" && <ServiceProfileView data={serviceData} isOwner={true} />}

        {/* ── 4. Common Settings & Logout ── */}
        <ProfileSettingsSection />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 28,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D2E8DA",
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 36,
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
  providerModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#E9F8EF",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginVertical: 4,
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#075B43",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#075B43",
  },
  bannerSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  serviceSwitchNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    padding: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    marginVertical: 2,
  },
  serviceNoticeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B45309",
  },
  serviceNoticeSub: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 1,
  },
});
