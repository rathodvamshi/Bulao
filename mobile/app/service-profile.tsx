import { useCallback, useMemo, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../src/api/client";
import { useAuth } from "../src/auth";
import {
  ServiceIdentityCardSkeleton,
} from "../src/components/SkeletonLoader";
import { CommonIdentityCard } from "../src/features/profile/components/CommonIdentityCard";
import { ServiceProfileView } from "../src/features/profile/components/ServiceProfileView";
import {
  ServiceText as Text,
  serviceTheme as theme,
} from "../src/features/profile/components/serviceProfileTheme";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";
import type {
  CommonProfileData,
  ServiceItem,
  ServiceRoleData,
} from "../src/features/profile/types";

export default function ServiceProfileScreen() {
  const { session } = useAuth();
  const token = session?.token;
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });

  const services = useQuery({
    queryKey: ["my-services", token],
    enabled: !!token,
    queryFn: () => api<ServiceItem[]>("/services/mine"),
    retry: (failureCount, error) =>
      error instanceof ApiError && (error.status ?? 0) >= 500 && failureCount < 1,
    retryDelay: 800,
  });

  const stats = useQuery({
    queryKey: ["service-provider-stats", token],
    enabled: !!token,
    queryFn: () =>
      api<{
        jobsPosted: number;
        active: number;
        interested: number;
        hired: number;
        completed: number;
        pendingResponses?: number;
      }>("/services/provider/stats?period=all"),
  });

  const activityQuery = useQuery({
    queryKey: ["service-activity-summary", token],
    enabled: !!token,
    queryFn: async () => {
      try {
        const recent = await api<any[]>("/services/provider/recent");
        if (Array.isArray(recent)) {
          const userId = me.data?.id;
          const reqItems = recent
            .filter((r) => r.applicantCount === 1 || !["PUBLISHED", "PAUSED"].includes(r.status))
            .map((r) => ({
              ...r,
              kind: "service",
              ownerId: userId,
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

  const profileQuery = useQuery({
    queryKey: ["profiles", me.data?.id, "service"],
    enabled: !!token && !!me.data?.id,
    queryFn: () =>
      api<{
        rating: number | null;
        totalReviews?: number;
        stars5?: number;
        stars4?: number;
        stars3?: number;
        stars2?: number;
        stars1?: number;
        reviews?: { id?: string; stars: number; body?: string; feedback?: string; author?: string; jobTitle?: string; createdAt?: number }[];
      }>(`/profiles/${me.data!.id}?role=service`),
  });

  useFocusEffect(
    useCallback(() => {
      if (token) {
        void queryClient.invalidateQueries({ queryKey: ["my-services"] });
        void queryClient.invalidateQueries({ queryKey: ["service-provider-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["service-activity-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      }
    }, [token, queryClient]),
  );

  const serviceData: ServiceRoleData = useMemo(() => {
    const servicesList = services.data || [];
    const interactions = activityQuery.data?.interactions || [];
    const userId = me.data?.id;

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
      servicesList.reduce((acc, s) => acc + (s.completedBookings || 0), 0),
      stats.data?.completed || 0,
      completedRequestsCount,
    );

    const maxRadius =
      servicesList.length > 0
        ? servicesList.reduce((max, s) => Math.max(max, s.radiusKm || 0), 0)
        : null;

    const ratedServices = servicesList.filter(
      (s) => (s.totalReviews || 0) > 0 && s.rating !== null,
    );
    const ratedReviewCount = ratedServices.reduce(
      (acc, s) => acc + s.totalReviews,
      0,
    );
    const avgServiceRating =
      ratedReviewCount > 0
        ? Number(
            (
              ratedServices.reduce(
                (acc, s) => acc + (s.rating || 0) * s.totalReviews,
                0,
              ) / ratedReviewCount
            ).toFixed(1),
          )
        : null;

    const totalServiceReviews = servicesList.reduce(
      (acc, s) => acc + (s.totalReviews || 0),
      0,
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

    const profileData = profileQuery.data;
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
        const id = r.id || `prof-${r.createdAt}-${r.author}`;
        if (!seenReviewIds.has(id)) {
          seenReviewIds.add(id);
          allFeedback.push({
            id,
            stars: r.stars,
            body: r.body || r.feedback || "",
            createdAt: r.createdAt || Date.now(),
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
    services.data,
    stats.data,
    activityQuery.data,
    me.data?.id,
    profileQuery.data,
  ]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.title}>My Service Profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          style={s.settings}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="settings-outline" size={22} color={theme.ink} />
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingBottom: 116 + insets.bottom },
        ]}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={
                me.isRefetching ||
                services.isRefetching ||
                stats.isRefetching ||
                profileQuery.isRefetching ||
                activityQuery.isRefetching
              }
              onRefresh={() => {
                void me.refetch();
                void services.refetch();
                void stats.refetch();
                void activityQuery.refetch();
                void profileQuery.refetch();
              }}
              tintColor={theme.green}
            />
          ) : undefined
        }
      >
        {!token ? (
          <View style={s.notice}>
            <Ionicons
              name="person-circle-outline"
              size={44}
              color={theme.green}
            />
            <Text style={s.noticeTitle}>Your services, in one place</Text>
            <Text style={s.muted}>
              Sign in to manage your listings, review customer inquiries and build your business reputation.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => router.push("/auth")}
            >
              <Text style={s.buttonText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.identity}>
              {me.data ? (
                <CommonIdentityCard profile={me.data} />
              ) : me.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void me.refetch()}
                  style={s.notice}
                >
                  <Text style={s.noticeTitle}>Couldn't load your profile</Text>
                  <Text style={s.link}>Tap to retry</Text>
                </Pressable>
              ) : (
                <ServiceIdentityCardSkeleton />
              )}
            </View>

            <ServiceProfileView
              data={serviceData}
              isOwner={true}
              loading={services.isPending && !services.data}
              error={
                services.isError && !services.data
                  ? "Your service listings couldn't be loaded."
                  : undefined
              }
              onRetry={() => {
                void services.refetch();
                void stats.refetch();
                void activityQuery.refetch();
                void profileQuery.refetch();
              }}
              initialServiceId={serviceId}
            />
          </>
        )}
      </ScrollView>
      <ServiceBottomNav active="profile" />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAF8" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#F8FAF8",
    borderBottomWidth: 0,
  },
  title: {
    color: "#047857",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  settings: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2EAE4",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  identity: {
    gap: 12,
  },
  notice: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    gap: 12,
  },
  noticeTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  muted: { fontSize: 12, lineHeight: 18, color: theme.muted, textAlign: "center" },
  button: {
    backgroundColor: theme.green,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 11,
  },
  buttonText: { fontSize: 13, fontWeight: "700", color: "white" },
  link: { fontSize: 12, fontWeight: "700", color: theme.green, padding: 8 },
});
