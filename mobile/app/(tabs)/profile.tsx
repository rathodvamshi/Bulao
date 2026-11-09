import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  acceptedJobs?: number;
  activeJobsPosted?: number;
};

type ProfileDetailResponse = {
  id: string;
  name: string;
  area: string;
  photoUrl: string | null;
  rating: number | null;
  totalReviews?: number;
  totalFeedback?: number;
  stars5?: number;
  stars4?: number;
  stars3?: number;
  stars2?: number;
  stars1?: number;
  completed: number;
  acceptedJobs?: number;
  jobsPosted?: number;
  activeJobsPosted?: number;
  reviews: { id?: string; stars: number; body: string; author: string; jobTitle?: string }[];
};

export default function Profile() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  const userId = auth.user?.id || auth.session?.userId || null;
  const client = useQueryClient();
  const params = useLocalSearchParams<{ role?: ProfileRole }>();

  // Default to provider role if opened from provider home or unspecified
  const [role, setRole] = useState<ProfileRole>(params.role || "provider");

  // 1. Common Identity Query
  const meQuery = useQuery<CommonProfileData>({
    queryKey: ["me", userId || token],
    enabled: !!token,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });

  // 2. Provider Stats Query
  const statsQuery = useQuery<ProviderStatsResponse>({
    queryKey: ["provider-stats", userId, "all"],
    enabled: !!token && !!userId,
    queryFn: () => api<ProviderStatsResponse>("/jobs/provider/stats?period=all"),
  });

  // 3. User Reputation & Reviews Query (Role-Specific)
  const profileDetailQuery = useQuery<ProfileDetailResponse>({
    queryKey: ["profiles", userId || meQuery.data?.id, role],
    enabled: !!token && !!(userId || meQuery.data?.id),
    queryFn: () =>
      api<ProfileDetailResponse>(
        `/profiles/${userId || meQuery.data!.id}?role=${encodeURIComponent(role)}`,
      ),
  });

  useFocusEffect(
    useCallback(() => {
      const targetId = userId || meQuery.data?.id;
      if (targetId) {
        void client.invalidateQueries({ queryKey: ["profiles", targetId, role] });
      }
    }, [userId, meQuery.data?.id, role, client]),
  );

  // 4. My Published Services Query
  const myServicesQuery = useQuery<ServiceItem[]>({
    queryKey: ["my-services", token],
    enabled: !!token,
    queryFn: () => api<ServiceItem[]>("/services/mine"),
  });

  // 5. Service Provider Stats Query (for service mode metrics)
  const serviceStatsQuery = useQuery<{
    jobsPosted: number;
    active: number;
    interested: number;
    hired: number;
    completed: number;
    pendingResponses?: number;
  }>({
    queryKey: ["service-provider-stats", token],
    enabled: !!token && role === "service",
    queryFn: () => api("/services/provider/stats?period=all"),
  });

  // 6. Service Activity Interactions Query
  const serviceActivityQuery = useQuery<{ interactions?: any[] }>({
    queryKey: ["service-activity-summary", token],
    enabled: !!token && role === "service",
    queryFn: async () => {
      try {
        const recent = await api<any[]>("/services/provider/recent");
        if (Array.isArray(recent)) {
          const currentId = meQuery.data?.id;
          const reqItems = recent
            .filter((r) => r.applicantCount === 1 || !["PUBLISHED", "PAUSED"].includes(r.status))
            .map((r) => ({
              ...r,
              kind: "service",
              ownerId: currentId,
            }));
          return { interactions: reqItems };
        }
      } catch {
        // safe fallback
      }
      return { interactions: [] };
    },
    staleTime: 30 * 1000,
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
    myServicesQuery.isRefetching ||
    serviceStatsQuery.isRefetching ||
    serviceActivityQuery.isRefetching;
  const onRefresh = () => {
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["provider-stats"] });
    void client.invalidateQueries({ queryKey: ["profiles"] });
    void client.invalidateQueries({ queryKey: ["my-services"] });
    void client.invalidateQueries({ queryKey: ["service-provider-stats"] });
    void client.invalidateQueries({ queryKey: ["service-activity-summary"] });
  };

  // ── Provider Role Data Assembly ─────────────────────────────────────────────
  const providerData: ProviderRoleData = useMemo(() => {
    const stats = statsQuery.data;
    const detail = profileDetailQuery.data;
    const revs: ReviewItem[] = (detail?.reviews || []).map((r, i) => ({
      id: r.id || `rev-${i}`,
      stars: r.stars,
      body: r.body,
      author: r.author || "Local Worker",
      jobTitle: r.jobTitle || "Verified Work Completion",
    }));

    const jobsPosted = detail?.jobsPosted ?? stats?.jobsPosted ?? 0;
    const active = detail?.activeJobsPosted ?? stats?.active ?? 0;
    const hired = detail?.acceptedJobs ?? stats?.acceptedJobs ?? stats?.hired ?? 0;
    const completed = detail?.completed ?? stats?.completed ?? 0;

    const starDistribution =
      detail?.stars5 != null
        ? {
            stars5: detail.stars5,
            stars4: detail.stars4 || 0,
            stars3: detail.stars3 || 0,
            stars2: detail.stars2 || 0,
            stars1: detail.stars1 || 0,
          }
        : undefined;

    return {
      jobsPosted,
      active,
      interested: stats?.interested || 0,
      hired,
      completed,
      rating: detail?.rating ?? null,
      totalReviews: detail?.totalReviews ?? revs.length,
      starDistribution,
      feedbackTags: [],
      badges: [],
      reviews: revs,
    };
  }, [statsQuery.data, profileDetailQuery.data]);

  // ── Seeker Role Data Assembly ───────────────────────────────────────────────
  const seekerData: SeekerRoleData = useMemo(() => {
    const detail = profileDetailQuery.data;
    const starDistribution =
      detail?.stars5 != null
        ? {
            stars5: detail.stars5,
            stars4: detail.stars4 || 0,
            stars3: detail.stars3 || 0,
            stars2: detail.stars2 || 0,
            stars1: detail.stars1 || 0,
          }
        : undefined;

    return {
      rating: detail?.rating ?? null,
      totalReviews: detail?.totalReviews ?? detail?.reviews?.length ?? 0,
      completed: detail?.completed ?? 0,
      starDistribution,
      reviews: (detail?.reviews || []).map((r, i) => ({
        id: r.id || `sr-${i}`,
        stars: r.stars,
        body: r.body,
        author: r.author || "Employer",
        jobTitle: r.jobTitle || "Completed job",
      })),
    };
  }, [profileDetailQuery.data]);

  // ── Service Role Data Assembly ──────────────────────────────────────────────
  const serviceData: ServiceRoleData = useMemo(() => {
    const servicesList = myServicesQuery.data || [];
    const interactions = serviceActivityQuery.data?.interactions || [];
    const userId = meQuery.data?.id;

    // Requests for my services
    const myServiceRequests = interactions.filter(
      (i) => i.kind === "service" && i.ownerId === userId,
    );
    const activeRequests = myServiceRequests.filter(
      (i) => i.status === "ACCEPTED" || i.status === "IN_PROGRESS",
    ).length;
    const pendingRequests = myServiceRequests.filter(
      (i) => i.status === "PENDING",
    ).length;
    const completedRequestsCount = myServiceRequests.filter(
      (i) => i.status === "COMPLETED",
    ).length;

    // Aggregate completed bookings across services + interactions
    const totalCompleted = Math.max(
      servicesList.reduce(
        (acc, service) => acc + (service.completedBookings || 0),
        0,
      ),
      serviceStatsQuery.data?.completed || 0,
      completedRequestsCount,
    );
    const maxRadius =
      servicesList.length > 0
        ? servicesList.reduce((max, service) => Math.max(max, service.radiusKm || 0), 0)
        : null;
    // Aggregate rating across services
    const ratedServices = servicesList.filter((s) => (s.totalReviews || 0) > 0 && s.rating !== null);
    const ratedReviewCount = ratedServices.reduce(
      (acc, service) => acc + service.totalReviews,
      0,
    );
    const avgServiceRating = ratedReviewCount > 0
      ? Number((ratedServices.reduce(
          (acc, service) => acc + (service.rating || 0) * service.totalReviews,
          0,
        ) / ratedReviewCount).toFixed(1))
      : null;
    const totalServiceReviews = servicesList.reduce(
      (acc, s) => acc + (s.totalReviews || 0),
      0
    );

    const starDistribution = servicesList.reduce(
      (acc, s) => {
        if (s.ratingBreakdown) {
          acc.stars5 += s.ratingBreakdown.stars5 || 0;
          acc.stars4 += s.ratingBreakdown.stars4 || 0;
          acc.stars3 += s.ratingBreakdown.stars3 || 0;
          acc.stars2 += s.ratingBreakdown.stars2 || 0;
          acc.stars1 += s.ratingBreakdown.stars1 || 0;
        } else if (s.reviews?.length) {
          for (const r of s.reviews) {
            if (r.stars === 5) acc.stars5++;
            else if (r.stars === 4) acc.stars4++;
            else if (r.stars === 3) acc.stars3++;
            else if (r.stars === 2) acc.stars2++;
            else if (r.stars === 1) acc.stars1++;
          }
        }
        return acc;
      },
      { stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0 },
    );

    const profileData = role === "service" ? profileDetailQuery.data : null;
    const finalDistribution = {
      stars5: Math.max(starDistribution.stars5, profileData?.stars5 || 0),
      stars4: Math.max(starDistribution.stars4, profileData?.stars4 || 0),
      stars3: Math.max(starDistribution.stars3, profileData?.stars3 || 0),
      stars2: Math.max(starDistribution.stars2, profileData?.stars2 || 0),
      stars1: Math.max(starDistribution.stars1, profileData?.stars1 || 0),
    };

    const finalRating =
      avgServiceRating ??
      (profileData?.rating != null ? Number(profileData.rating) : null);
    const finalTotalReviews = Math.max(
      totalServiceReviews,
      profileData?.totalReviews || 0,
    );

    // Deduplicate all feedback across per-service listings & profile reviews
    const seenReviewIds = new Set<string>();
    const allFeedback: NonNullable<ServiceRoleData["recentFeedback"]> = [];

    for (const service of servicesList) {
      for (const review of service.reviews || []) {
        const id = review.id || `${service.id}-${review.createdAt}-${review.authorName}`;
        if (!seenReviewIds.has(id)) {
          seenReviewIds.add(id);
          allFeedback.push({
            ...review,
            id,
            serviceTitle: service.title || service.categoryName,
          });
        }
      }
    }

    if (profileData?.reviews) {
      for (const r of profileData.reviews) {
        const id = r.id || `prof-${r.author}`;
        if (!seenReviewIds.has(id)) {
          seenReviewIds.add(id);
          allFeedback.push({
            id,
            stars: r.stars,
            body: r.body || "",
            createdAt: Date.now(),
            authorName: r.author || "Customer",
            serviceTitle: r.jobTitle || "Verified Service",
          });
        }
      }
    }

    allFeedback.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    return {
      rating: finalRating,
      totalReviews: finalTotalReviews,
      completed: totalCompleted,
      radiusKm: maxRadius,
      services: servicesList,
      recentFeedback: allFeedback,
      starDistribution: finalDistribution,
      activeRequests,
      pendingRequests,
    };
  }, [
    myServicesQuery.data,
    serviceActivityQuery.data,
    meQuery.data?.id,
    serviceStatsQuery.data,
    role,
    profileDetailQuery.data,
  ]);

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
        {role === "service" && (
          <ServiceProfileView
            data={serviceData}
            isOwner={true}
            loading={myServicesQuery.isPending && !myServicesQuery.data}
            error={myServicesQuery.isError && !myServicesQuery.data ? "Your service listings couldn't be loaded." : undefined}
            onRetry={() => void myServicesQuery.refetch()}
          />
        )}

        {/* ── 4. Common Settings & Logout ── */}
        <ProfileSettingsSection role={role} />
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
