import { AppText as Text } from "../../src/components/AppText";
import { AppPressable as Pressable } from "../../src/components/AppPressable";
import { colors } from "../../src/components/ui";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  Linking,
  Alert,
  Share,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { serviceApi } from "../../src/api/serviceApi";
import { useAuth } from "../../src/auth";
import { AppImage } from "../../src/components/AppImage";
import { JobCard } from "../../src/components/JobCard";
import type { Job } from "../../src/api/types";

export type ActiveJobItem = {
  id: string;
  ownerId?: string;
  title: string;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  area: string;
  latitude?: number;
  longitude?: number;
  startsAt: number;
  endsAt?: number | null;
  duration?: string;
  hours?: string;
  startTime?: string;
  endTime?: string;
  workers: number;
  acceptedCount?: number;
  remainingWorkers?: number;
  payPaise: number;
  payUnit: string;
  details?: string;
  status: string;
  createdAt?: number;
  myApplicationStatus?: string | null;
};

type PublicProfileData = {
  id: string;
  name: string;
  area: string | null;
  photoUrl: string | null;
  phone: string | null;
  contactUnlocked?: boolean;
  phoneVerified: number;
  rating: number | null;
  totalReviews: number;
  totalFeedback?: number;
  stars5?: number;
  stars4?: number;
  stars3?: number;
  stars2?: number;
  stars1?: number;
  completed: number;
  jobsPosted?: number;
  activeJobsPosted?: number;
  acceptedJobs?: number;
  completionRate?: number | null;
  reliabilityScore?: number | null;
  createdAt?: number;
  activeJobs?: ActiveJobItem[];
  reviews: {
    id: string;
    stars: number;
    body: string;
    author: string;
    jobTitle?: string;
    createdAt?: number;
  }[];
};

function formatReviewDate(timestamp?: number): string {
  if (!timestamp) return "Recent";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const trimmed = name.trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.charAt(0) || "";
    const second = parts[1]?.charAt(0) || "";
    return (first + second).toUpperCase() || "U";
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export default function PublicProfile() {
  const { id, serviceId, jobId, role: queryRole } = useLocalSearchParams<{
    id: string;
    serviceId?: string;
    jobId?: string;
    role?: string;
  }>();
  const client = useQueryClient();
  const { session, user } = useAuth();
  const isOwnProfile = user?.id === id;
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [reputationWindowWidth, setReputationWindowWidth] = useState(0);
  const [reputationTab, setReputationTab] = useState<"rating" | "feedback">("rating");
  const reputationTabRef = useRef<"rating" | "feedback">("rating");
  const reputationPagerRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (reputationWindowWidth > 0) {
      reputationPagerRef.current?.scrollTo({
        x: reputationTabRef.current === "feedback" ? reputationWindowWidth : 0,
        animated: false,
      });
    }
  }, [reputationWindowWidth]);

  const queryParams = [
    jobId ? `jobId=${encodeURIComponent(jobId)}` : "",
    serviceId ? `serviceId=${encodeURIComponent(serviceId)}` : "",
    queryRole ? `role=${encodeURIComponent(queryRole)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const profileQuery = useQuery({
    queryKey: ["profile", id, session?.token, jobId, serviceId, queryRole],
    enabled: Boolean(id),
    queryFn: () =>
      api<PublicProfileData>(
        `/profiles/${encodeURIComponent(id)}${queryParams ? `?${queryParams}` : ""}`,
      ),
    staleTime: 3000,
  });

  const servicesQuery = useQuery({
    queryKey: ["profile-services", id, session?.token],
    enabled: Boolean(id),
    queryFn: () => serviceApi.providerListings(id),
    staleTime: 3000,
  });

  const isSeekerContext = queryRole === "seeker";

  const activeJobsQuery = useQuery({
    queryKey: ["provider-active-jobs", id, session?.token],
    enabled: Boolean(id && !isSeekerContext),
    queryFn: async () => {
      try {
        const res = await api<ActiveJobItem[]>(
          `/jobs/provider/${encodeURIComponent(id)}/active`,
        );
        return Array.isArray(res) ? res : [];
      } catch {
        return null;
      }
    },
    staleTime: 5000,
  });

  const currentJobQuery = useQuery({
    queryKey: ["profile-context-job", jobId],
    enabled: Boolean(jobId && !isSeekerContext),
    queryFn: async () => {
      try {
        const res = await api<any>(`/jobs/${encodeURIComponent(jobId!)}`);
        return res ? (res as ActiveJobItem) : null;
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });

  useFocusEffect(
    useCallback(() => {
      if (id) {
        void client.invalidateQueries({ queryKey: ["public-profile", id] });
        void client.invalidateQueries({ queryKey: ["profile-services", id] });
        void client.invalidateQueries({ queryKey: ["provider-active-jobs", id] });
        if (jobId) void client.invalidateQueries({ queryKey: ["profile-context-job", jobId] });
      }
    }, [id, jobId, client]),
  );

  const data = profileQuery.data;

  const activeJobs: ActiveJobItem[] = useMemo(() => {
    if (data?.activeJobs && Array.isArray(data.activeJobs)) {
      return data.activeJobs;
    }
    if (activeJobsQuery.data && Array.isArray(activeJobsQuery.data)) {
      return activeJobsQuery.data;
    }
    if (currentJobQuery.data) {
      return [currentJobQuery.data];
    }
    return [];
  }, [data?.activeJobs, activeJobsQuery.data, currentJobQuery.data]);
  // Contact unlocks only for the accepted job or service that opened this profile.
  const canCallProvider = Boolean(data?.phone) && Boolean(jobId || serviceId) &&
    data?.contactUnlocked === true;
  const services = servicesQuery.data || [];
  const primaryService =
    services.find((service) => service.id === serviceId) || services[0];

  // Derived fields
  const providerName = data?.name || "Service Provider";
  const providerPhoto = data?.photoUrl || null;
  const isVerified = Boolean(data?.phoneVerified);
  const ratingValue =
    data?.rating !== null && data?.rating !== undefined
      ? Number(data.rating).toFixed(1)
      : "New";
  const reviewCount = data?.totalReviews ?? (data?.reviews?.length || 0);
  const feedbackReviews = data?.reviews?.filter((review) => Boolean(review.body?.trim())) ?? [];
  const feedbackCount = data?.totalFeedback ?? feedbackReviews.length;
  const feedbackCountLabel = data?.totalFeedback == null && feedbackReviews.length >= 20
    ? "20+"
    : String(feedbackCount);
  const completedJobs = data?.completed ?? 0;
  const acceptedJobs = Number(data?.acceptedJobs ?? 0);
  const jobsPosted = data?.jobsPosted ?? 0;
  const activeJobsPosted = data?.activeJobsPosted ?? 0;
  const completionRate = data?.completionRate;
  const memberSince = data?.createdAt
    ? new Date(data.createdAt * 1000).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "Recently";
  const ratingBreakdown = [
    { stars: 5, count: data?.stars5 ?? 0 },
    { stars: 4, count: data?.stars4 ?? 0 },
    { stars: 3, count: data?.stars3 ?? 0 },
    { stars: 2, count: data?.stars2 ?? 0 },
    { stars: 1, count: data?.stars1 ?? 0 },
  ];
  const selectReputationTab = (tab: "rating" | "feedback") => {
    reputationTabRef.current = tab;
    setReputationTab(tab);
    reputationPagerRef.current?.scrollTo({
      x: tab === "rating" ? 0 : reputationWindowWidth,
      animated: true,
    });
  };
  const isServiceContext = Boolean(serviceId) || queryRole === "service";

  const reputationTitle = isSeekerContext
    ? "Worker reputation"
    : isServiceContext
      ? "Service reputation"
      : "Employer reputation";

  const verifiedRoleLabel = isSeekerContext
    ? "Verified worker"
    : isServiceContext
      ? "Verified provider"
      : "Verified employer";

  const ratingOverviewCaption = isSeekerContext
    ? "Ratings from employers after completed jobs"
    : isServiceContext
      ? "Ratings from completed service bookings"
      : "Ratings from hired workers after completed jobs";

  const emptyRatingCaption = isSeekerContext
    ? "No employer ratings yet"
    : isServiceContext
      ? "No client ratings yet"
      : "No worker ratings yet";

  const feedbackPanelTitle = isSeekerContext
    ? "Employer feedback"
    : isServiceContext
      ? "Customer feedback"
      : "Worker feedback";

  const feedbackPanelCaption = isSeekerContext
    ? "Reviews from employers after completed jobs"
    : isServiceContext
      ? "Reviews from verified service clients"
      : "Reviews from hired workers after completed jobs";

  const defaultReviewerName = isSeekerContext
    ? "Employer"
    : isServiceContext
      ? "Customer"
      : "Worker";

  const feedbackTagLabel = isSeekerContext
    ? "EMPLOYER FEEDBACK"
    : isServiceContext
      ? "CUSTOMER FEEDBACK"
      : "WORKER FEEDBACK";

  const emptyFeedbackTitle = isSeekerContext
    ? "No employer feedback yet"
    : isServiceContext
      ? "No customer feedback yet"
      : "No worker feedback yet";

  const emptyFeedbackText = isSeekerContext
    ? "Employer comments will appear here after completed jobs."
    : isServiceContext
      ? "Customer comments will appear here after completed services."
      : "Worker comments will appear here after completed jobs.";

  const professionalTitle =
    primaryService?.title ||
    primaryService?.categoryName ||
    "Work provider";

  const bioDescription =
    primaryService?.description ||
    "No profile introduction has been added yet.";

  // Skills chips
  const skillsList: string[] = [];
  if (
    primaryService?.offeredServices &&
    Array.isArray(primaryService.offeredServices)
  ) {
    skillsList.push(...primaryService.offeredServices);
  } else if (typeof primaryService?.offeredServices === "string") {
    try {
      const parsed = JSON.parse(primaryService.offeredServices);
      if (Array.isArray(parsed)) skillsList.push(...parsed);
    } catch {
      skillsList.push(primaryService.offeredServices);
    }
  }

  // Work photos
  const workPhotos: string[] = [];
  if (
    primaryService?.portfolioUrls &&
    Array.isArray(primaryService.portfolioUrls)
  ) {
    workPhotos.push(...primaryService.portfolioUrls);
  }
  if (
    primaryService?.wizardState?.shopPhotos &&
    Array.isArray(primaryService.wizardState.shopPhotos)
  ) {
    workPhotos.push(...primaryService.wizardState.shopPhotos);
  }
  if (
    primaryService?.wizardState?.servicePhotos &&
    Array.isArray(primaryService.wizardState.servicePhotos)
  ) {
    workPhotos.push(...primaryService.wizardState.servicePhotos);
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${providerName} on Bulao`,
        message: `Check out ${providerName}'s profile on Bulao for ${professionalTitle}.`,
      });
    } catch {
      // Ignored
    }
  };

  const handleContact = () => {
    if (!data?.phone || !canCallProvider) return;
    Linking.openURL(`tel:${data.phone}`).catch(() => {
      Alert.alert("Contact Unavailable", "Could not open phone dialer.");
    });
  };

  const handleViewAvailableJobs = () => {
    if (serviceId) {
      router.push({
        pathname: "/service-details",
        params: { id: serviceId },
      });
    } else if (services.length > 0 && services[0]?.id) {
      router.push({
        pathname: "/service-details",
        params: { id: services[0].id },
      });
    } else {
      Alert.alert(
        "Available Services",
        "This provider has no available service listings at the moment.",
      );
    }
  };

  const handleApplyJob = async (targetJob: Job) => {
    try {
      await api(`/jobs/${targetJob.id}/apply`, {});
      Alert.alert("Application Sent", "Your application has been sent to the employer.");
      void profileQuery.refetch();
    } catch (err: any) {
      throw new Error(err?.message || "Failed to submit application.");
    }
  };

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.marketplaceGreen} />
        <Text style={styles.loadingText}>Loading provider profile...</Text>
      </SafeAreaView>
    );
  }

  if (profileQuery.isError || !data) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
        <Text style={styles.errorTitle}>Profile Unavailable</Text>
        <Text style={styles.errorSubtitle}>
          Could not load provider profile details.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButtonDefault}
        >
          <Text style={styles.backButtonDefaultText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Cover Hero Header ── */}
        <View style={styles.coverContainer}>
          <View style={styles.coverPlaceholder}>
            <Ionicons name="school" size={60} color="#CBD5E1" />
          </View>
          {workPhotos[0] && (
            <AppImage
              source={{ uri: workPhotos[0] }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}

          {/* Navigation Overlay Buttons */}
          <SafeAreaView edges={["top"]} style={styles.navBarOverlay}>
            <Pressable
              onPress={() => router.back()}
              style={styles.navCircleBtn}
              accessibilityLabel="Back"
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.marketplaceInk}
              />
            </Pressable>

            <View style={styles.navRightGroup}>
              <Pressable
                onPress={handleShare}
                style={styles.navCircleBtn}
                accessibilityLabel="Share profile"
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={colors.marketplaceInk}
                />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {/* ── Main Profile Card ── */}
        <View style={styles.profileCard}>
          {/* Avatar with Verified checkmark */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              {providerPhoto ? (
                <AppImage
                  source={{ uri: providerPhoto }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(providerName)}
                  </Text>
                </View>
              )}

              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.identityText}>
              {/* Name & Title */}
              <Text style={styles.providerName}>{providerName}</Text>
              <Text style={styles.providerTitle}>{professionalTitle}</Text>
              <View style={styles.identityMetaRow}>
                {data?.area ? (
                  <View style={styles.identityMetaItem}>
                    <Ionicons name="location-outline" size={12} color="#647E72" />
                    <Text style={styles.identityMetaText} numberOfLines={1}>{data.area}</Text>
                  </View>
                ) : null}
                {data?.area ? <Text style={styles.identityMetaDot}>•</Text> : null}
                <View style={styles.identityMetaItem}>
                  <Ionicons name="calendar-outline" size={12} color="#647E72" />
                  <Text style={styles.identityMetaText}>Member since {memberSince}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Hiring overview</Text>
            <View style={styles.overviewStatus}>
              <View style={styles.overviewStatusDot} />
              <Text style={styles.overviewStatusText}>{isVerified ? "Verified provider" : "Provider profile"}</Text>
            </View>
          </View>
          <View style={styles.overviewGrid}>
            {[
              { label: "Posted", value: jobsPosted, icon: "document-text-outline" as const, tone: "#5B8C75" },
              { label: "Active", value: activeJobsPosted, icon: "pulse-outline" as const, tone: "#0C9B6A" },
              { label: "Accepted", value: acceptedJobs, icon: "people-outline" as const, tone: "#C58B18" },
              { label: "Completed", value: completedJobs, icon: "checkmark-done-outline" as const, tone: "#568271" },
            ].map((metric) => (
              <View key={metric.label} style={styles.overviewMetric}>
                <Ionicons name={metric.icon} size={19} color={metric.tone} />
                <Text style={styles.overviewMetricValue}>{metric.value}</Text>
                <Text style={styles.overviewMetricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Provider reputation ── */}
          <View style={styles.section}>
            <View style={styles.reputationHeader}>
              <Text style={styles.reputationTitle}>{reputationTitle}</Text>
              {isVerified ? (
                <View style={styles.verifiedProviderPill}>
                  <Ionicons name="shield-checkmark" size={12} color="#087653" />
                  <Text style={styles.verifiedProviderText}>{verifiedRoleLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.reputationTabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: reputationTab === "rating" }}
                onPress={() => selectReputationTab("rating")}
                style={[styles.reputationTab, reputationTab === "rating" && styles.reputationTabActive]}
              >
                <Ionicons name="star" size={16} color={reputationTab === "rating" ? "#FFFFFF" : "#557467"} />
                <Text style={[styles.reputationTabText, reputationTab === "rating" && styles.reputationTabTextActive]}>Rating ({ratingValue})</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: reputationTab === "feedback" }}
                onPress={() => selectReputationTab("feedback")}
                style={[styles.reputationTab, reputationTab === "feedback" && styles.reputationTabActive]}
              >
                <Ionicons name="chatbubble-ellipses" size={15} color={reputationTab === "feedback" ? "#FFFFFF" : "#557467"} />
                <Text style={[styles.reputationTabText, reputationTab === "feedback" && styles.reputationTabTextActive]}>Feedback ({feedbackCountLabel})</Text>
              </Pressable>
            </View>

            <View
              style={styles.reputationPagerWindow}
              onLayout={(event) => {
                setReputationWindowWidth(event.nativeEvent.layout.width);
              }}
            >
              <ScrollView
                ref={reputationPagerRef}
                horizontal
                pagingEnabled
                decelerationRate="fast"
                disableIntervalMomentum
                snapToInterval={reputationWindowWidth || undefined}
                snapToAlignment="start"
                showsHorizontalScrollIndicator={false}
                style={styles.reputationPager}
                contentContainerStyle={styles.reputationPagerContent}
                scrollEnabled={reputationWindowWidth > 0}
                onMomentumScrollEnd={(event) => {
                  if (!reputationWindowWidth) return;
                  const page = Math.round(event.nativeEvent.contentOffset.x / reputationWindowWidth);
                  const tab = page === 0 ? "rating" : "feedback";
                  reputationTabRef.current = tab;
                  setReputationTab(tab);
                }}
              >
              <View style={[styles.reputationPage, { width: reputationWindowWidth || "100%" }]}>
              <View style={styles.reputationPanel}>
                <Text style={styles.reputationPanelTitle}>Rating overview</Text>
                <Text style={styles.reputationPanelCaption}>{ratingOverviewCaption}</Text>
                <View style={styles.ratingBreakdownCard}>
                  <View style={styles.ratingBreakdownScore}>
                    <Text style={styles.ratingBreakdownValue}>{ratingValue}</Text>
                    <View style={styles.reviewStarsRow}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = Boolean(reviewCount && data?.rating && star <= Math.round(Number(data.rating)));
                        return (
                          <Ionicons key={star} name={filled ? "star" : "star-outline"} size={15} color={filled ? "#F59E0B" : "#C8D1CB"} />
                        );
                      })}
                    </View>
                    <Text style={styles.ratingBreakdownCaption}>{reviewCount ? `${reviewCount} ratings` : emptyRatingCaption}</Text>
                  </View>
                  <View style={styles.ratingBreakdownRows}>
                    {ratingBreakdown.map(({ stars, count }) => (
                      <View key={stars} style={styles.ratingBreakdownRow}>
                        <Text style={styles.ratingBreakdownStarLabel}>{stars}</Text>
                        <Ionicons name="star" size={10} color="#D99A22" />
                        <View style={styles.ratingTrack}>
                          <View style={[styles.ratingTrackFill, { width: `${reviewCount ? Math.min(100, (count / reviewCount) * 100) : 0}%` }]} />
                        </View>
                        <Text style={styles.ratingBreakdownPercent}>{reviewCount ? `${Math.round((count / reviewCount) * 100)}%` : "0%"}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.trustHighlightsLabel}>TRUST HIGHLIGHTS</Text>
                <View style={styles.trustHighlights}>
                  {completionRate != null ? <View style={styles.trustHighlight}><Ionicons name="checkmark-circle" size={14} color="#0A9B71" /><Text style={styles.trustHighlightText}>{completionRate}% completion</Text></View> : null}
                  {primaryService?.experienceYears != null ? <View style={styles.trustHighlight}><Ionicons name="flash" size={14} color="#D69A19" /><Text style={styles.trustHighlightText}>{primaryService.experienceYears}+ years experience</Text></View> : null}
                  {completedJobs > 0 ? <View style={styles.trustHighlight}><Ionicons name="briefcase" size={14} color="#5B8C75" /><Text style={styles.trustHighlightText}>{completedJobs} jobs completed</Text></View> : null}
                </View>
                <Text style={styles.trustHighlightsLabel}>VERIFIED TRUST CREDENTIALS</Text>
                <View style={styles.credentialCard}>
                  <View style={styles.credentialIcon}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={isVerified ? "#0A9B71" : "#8B9690"} />
                  </View>
                  <View style={styles.credentialCopy}>
                    <Text style={styles.credentialTitle}>{isVerified ? "Phone verified" : "Phone not verified"}</Text>
                    <Text style={styles.credentialCaption}>Phone number stays private until the job is accepted.</Text>
                  </View>
                </View>
              </View>
              </View>
              <View style={[styles.reputationPage, { width: reputationWindowWidth || "100%" }]}>
              <View style={styles.reputationPanel}>
                <Text style={styles.reputationPanelTitle}>{feedbackPanelTitle}</Text>
                <Text style={styles.reputationPanelCaption}>
                  {data.totalFeedback == null && feedbackReviews.length >= 20
                    ? `Showing latest ${feedbackReviews.length} comments`
                    : feedbackCount > feedbackReviews.length
                      ? `Showing latest ${feedbackReviews.length} of ${feedbackCount} comments`
                      : feedbackPanelCaption}
                </Text>
                  {feedbackCount > 0 ? (
                    <View style={styles.feedbackReviewList}>
                      {feedbackReviews.map((rev) => (
                        <View key={rev.id} style={[styles.reviewCard, styles.feedbackReviewItem]}>
                          <View style={styles.reviewTopRow}>
                            <View style={styles.reviewerAvatar}><Text style={styles.reviewerAvatarText}>{getInitials(rev.author)}</Text></View>
                            <View style={styles.reviewerInfo}>
                              <Text style={styles.reviewerName} numberOfLines={1}>{rev.author || defaultReviewerName}</Text>
                              <View style={styles.reviewStarsRow}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= rev.stars ? "star" : "star-outline"} size={10} color="#F59E0B" />)}</View>
                            </View>
                            <Text style={styles.reviewDate}>{formatReviewDate(rev.createdAt)}</Text>
                          </View>
                          <Text style={styles.feedbackLabel}>{feedbackTagLabel}</Text>
                          <Text style={styles.reviewBody} numberOfLines={6}>{rev.body}</Text>
                          {rev.jobTitle ? <Text style={styles.feedbackJob} numberOfLines={1}>{rev.jobTitle}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.feedbackEmpty, styles.feedbackEmptyFull]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={24} color="#93A79B" />
                      <Text style={styles.feedbackEmptyTitle}>{emptyFeedbackTitle}</Text>
                      <Text style={styles.feedbackEmptyText}>{emptyFeedbackText}</Text>
                    </View>
                  )}
              </View>
              </View>
              </ScrollView>
            </View>
          </View>

          {/* ── Active Job Openings (Placed below employer reputation) ── */}
          {!isSeekerContext && (
            <View style={styles.section}>
              <View style={styles.activeJobsHeader}>
                <View style={styles.activeJobsTitleGroup}>
                  <View style={styles.activeJobsIconWrap}>
                    <Ionicons name="briefcase" size={17} color="#087653" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeJobsHeading}>Active Job Openings</Text>
                    <Text style={styles.activeJobsSubtitle}>
                      {activeJobs.length > 0
                        ? `Currently hiring for ${activeJobs.length} open position${activeJobs.length === 1 ? "" : "s"}`
                        : "Current openings posted by this employer"}
                    </Text>
                  </View>
                </View>
                {activeJobs.length > 0 && (
                  <View style={styles.activeJobsBadge}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeJobsBadgeText}>
                      {activeJobs.length} {activeJobs.length === 1 ? "Job" : "Jobs"}
                    </Text>
                  </View>
                )}
              </View>

              {activeJobs.length > 0 ? (
                <View style={styles.activeJobsList}>
                  {activeJobs.map((item) => {
                    const isCurrentJob = jobId === item.id;
                    const jobItem: Job = {
                      id: item.id,
                      ownerId: item.ownerId || data?.id || id,
                      ownerName: data?.name || "Local provider",
                      ownerPhotoUrl: data?.photoUrl || undefined,
                      ownerRating: data?.rating,
                      ownerReviewsCount: data?.totalReviews,
                      ownerVerified: Boolean(data?.phoneVerified),
                      title: item.title,
                      area: item.area,
                      latitude: item.latitude,
                      longitude: item.longitude,
                      startsAt: item.startsAt,
                      endsAt: item.endsAt,
                      duration: item.duration,
                      hours: item.hours,
                      startTime: item.startTime,
                      endTime: item.endTime,
                      workers: item.workers,
                      acceptedCount: item.acceptedCount,
                      remainingWorkers: item.remainingWorkers,
                      payPaise: item.payPaise,
                      payUnit: item.payUnit,
                      details: item.details || "",
                      status: item.status,
                      createdAt: item.createdAt,
                      roleId: item.roleId,
                      roleName: item.roleName,
                      roleIcon: item.roleIcon,
                      categoryId: item.categoryId,
                      categoryName: item.categoryName,
                      categoryIcon: item.categoryIcon,
                      myApplication: item.myApplicationStatus
                        ? { id: `app-${item.id}`, status: item.myApplicationStatus }
                        : null,
                    };

                    return (
                      <View
                        key={item.id}
                        style={isCurrentJob ? styles.currentJobCardHighlight : undefined}
                      >
                        {isCurrentJob && (
                          <View style={styles.currentJobBanner}>
                            <Ionicons name="sparkles" size={12} color="#087653" />
                            <Text style={styles.currentJobBannerText}>
                              Currently Viewing This Job
                            </Text>
                          </View>
                        )}
                        <JobCard
                          job={jobItem}
                          onViewDetails={(j) => router.push(`/jobs/${j.id}`)}
                          onApply={handleApplyJob}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.activeJobsEmpty}>
                  <View style={styles.activeJobsEmptyIconWrap}>
                    <Ionicons name="briefcase-outline" size={24} color="#087653" />
                  </View>
                  <Text style={styles.activeJobsEmptyTitle}>
                    No active job openings right now
                  </Text>
                  <Text style={styles.activeJobsEmptySubtitle}>
                    All current job listings by {providerName} have been filled or completed.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Services Action Button (If Provider offers services) ── */}
          {services.length > 0 ? (
            <View style={styles.actionsContainer}>
              <Pressable
                onPress={handleViewAvailableJobs}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.75 : 1 }]}
                accessibilityRole="button"
              >
                <Ionicons name="briefcase-outline" size={18} color={colors.marketplaceGreen} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>View Available Services</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Section: Skills & Subjects ── */}
          {skillsList.length > 0 ? (
            <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="book-outline"
                size={18}
                color={colors.marketplaceGreen}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.sectionTitle}>Skills & Subjects</Text>
            </View>

            <View style={styles.chipsContainer}>
              {skillsList.map((skill, idx) => (
                <View key={idx} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
            </View>
            </View>
          ) : null}

          {/* ── Section: Availability ── */}
          {primaryService ? (
            <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.marketplaceGreen}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.sectionTitle}>Availability</Text>
            </View>

            <View style={styles.availabilityRow}>
              <Text style={styles.availabilityDays}>
                {primaryService?.wizardState?.selectedDays?.join(" · ") ||
                  "Schedule"}
              </Text>
              {primaryService && (
                <View style={styles.availableBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.availableBadgeText}>
                    {primaryService.available ? "Available" : "Unavailable"}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.availabilityHours}>
              {primaryService?.operatingHours ||
                "Contact provider for working hours"}
            </Text>
            </View>
          ) : null}

          {/* ── Section: Photos from past work ── */}
          {workPhotos.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderBetween}>
                <View style={styles.sectionHeader}>
                  <Ionicons
                    name="images-outline"
                    size={18}
                    color={colors.marketplaceGreen}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.sectionTitle}>Photos from past work</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedPhoto(workPhotos[0] ?? null)}
                >
                  <Text style={styles.seeAllText}>See all ›</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosScroll}
              >
                {workPhotos.map((photoUrl, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedPhoto(photoUrl)}
                    style={styles.workPhotoThumb}
                  >
                    <AppImage
                      source={{ uri: photoUrl }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Report / Safety Link */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/safety",
                params: { targetId: id },
              })
            }
            style={styles.safetyLink}
          >
            <Ionicons name="flag-outline" size={14} color="#94A3B8" />
            <Text style={styles.safetyLinkText}>Report profile or issue</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(selectedPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#10132DF2" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setSelectedPhoto(null)}
            style={{ padding: 20, alignSelf: "flex-end" }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {selectedPhoto && (
            <AppImage
              source={{ uri: selectedPhoto }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}
          {selectedPhoto && workPhotos.length > 1 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                padding: 20,
              }}
            >
              <Pressable
                accessibilityLabel="Previous work photo"
                onPress={() =>
                  setSelectedPhoto(
                    workPhotos[
                      (workPhotos.indexOf(selectedPhoto) -
                        1 +
                        workPhotos.length) %
                        workPhotos.length
                    ] ?? null,
                  )
                }
              >
                <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
              </Pressable>
              <Text style={{ color: "#FFFFFF" }}>
                {workPhotos.indexOf(selectedPhoto) + 1} / {workPhotos.length}
              </Text>
              <Pressable
                accessibilityLabel="Next work photo"
                onPress={() =>
                  setSelectedPhoto(
                    workPhotos[
                      (workPhotos.indexOf(selectedPhoto) + 1) %
                        workPhotos.length
                    ] ?? null,
                  )
                }
              >
                <Ionicons name="chevron-forward" size={32} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.marketplacePaper,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverContainer: {
    height: 205,
    backgroundColor: "#E2E8F0",
    position: "relative",
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8ECEF",
  },
  navBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  navRightGroup: {
    flexDirection: "row",
    gap: 10,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -30,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  avatarRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
    marginTop: -58,
    marginBottom: 16,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 4,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#F1F5F9",
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.marketplaceGreen,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  providerName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.marketplaceInk,
    letterSpacing: -0.4,
  },
  providerTitle: {
    fontSize: 14.5,
    fontWeight: "500",
    color: colors.marketplaceMuted,
    marginTop: 2,
    marginBottom: 0,
  },
  identityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  identityMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  identityMetaDot: {
    fontSize: 10,
    color: "#A0AEC0",
  },
  identityMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#647E72",
  },
  overviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  overviewTitle: { color: colors.marketplaceInk, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  overviewStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: "#EAF7F0" },
  overviewStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0A9B71" },
  overviewStatusText: { color: "#176A4F", fontSize: 9, fontWeight: "700" },
  overviewGrid: { flexDirection: "row", gap: 7, marginBottom: 16 },
  overviewMetric: { flex: 1, minWidth: 0, minHeight: 92, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 8, borderRadius: 15, backgroundColor: "#F9FAF9", borderWidth: 1, borderColor: "#EDF1EE" },
  overviewMetricValue: { marginTop: 5, color: colors.marketplaceInk, fontSize: 17, lineHeight: 19, fontWeight: "800" },
  overviewMetricLabel: { marginTop: 3, color: colors.marketplaceMuted, fontSize: 8.5, lineHeight: 11, fontWeight: "600", textAlign: "center" },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  onlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: colors.marketplaceGreen,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  contactLockedNotice: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F1F5F3", borderWidth: 1, borderColor: "#E2E8E4" },
  contactLockedText: { color: colors.marketplaceMuted, fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.marketplaceGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.marketplaceGreen,
  },
  section: {
    marginTop: 20,
    paddingTop: 0,
    borderTopWidth: 0,
    borderTopColor: "#F1F5F3",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeaderBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.marketplaceInk,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.marketplaceGreen,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.marketplaceMuted,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statGridCard: {
    flexBasis: "46%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDF2EE",
  },
  statGridLabel: {
    fontSize: 11,
    color: colors.marketplaceMuted,
    fontWeight: "500",
  },
  statGridValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.marketplaceInk,
    marginTop: 2,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#F3F5F4",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EBE7",
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.marketplaceInk,
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  availabilityDays: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.marketplaceInk,
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  availableBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  availabilityHours: {
    fontSize: 13,
    color: colors.marketplaceMuted,
  },
  photosScroll: {
    gap: 10,
  },
  workPhotoThumb: {
    width: 86,
    height: 86,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  reputationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  reputationTitle: { color: colors.marketplaceInk, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  verifiedProviderPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 15, backgroundColor: "#EAF7F0" },
  verifiedProviderText: { color: "#176A4F", fontSize: 9, fontWeight: "700" },
  reputationTabs: { flexDirection: "row", gap: 5, padding: 4, marginBottom: 12, borderRadius: 15, backgroundColor: "#EEF4F0" },
  reputationTab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12 },
  reputationTabActive: { backgroundColor: "#086345", shadowColor: "#064E38", shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  reputationTabText: { color: "#557467", fontSize: 12, fontWeight: "700" },
  reputationTabTextActive: { color: "#FFFFFF" },
  reputationPagerWindow: { width: "100%", overflow: "hidden" },
  reputationPager: { width: "100%", flexGrow: 0 },
  reputationPagerContent: { alignItems: "flex-start" },
  reputationPage: { flexShrink: 0 },
  reputationPanel: { padding: 14, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EFEB", shadowColor: "#123D2D", shadowOpacity: 0.04, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  reputationPanelTitle: { color: colors.marketplaceInk, fontSize: 14, fontWeight: "800" },
  reputationPanelCaption: { marginTop: 3, marginBottom: 12, color: colors.marketplaceMuted, fontSize: 10, lineHeight: 14 },
  ratingBreakdownCard: {
    width: "100%",
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#F0EFEE",
  },
  ratingBreakdownScore: { width: 105, alignItems: "center", justifyContent: "center", paddingRight: 12, borderRightWidth: 1, borderRightColor: "#E8EEE9" },
  ratingBreakdownValue: { color: colors.marketplaceInk, fontSize: 31, lineHeight: 35, fontWeight: "800" },
  ratingBreakdownCaption: { marginTop: 4, color: colors.marketplaceMuted, fontSize: 9, fontWeight: "600", textAlign: "center" },
  ratingBreakdownRows: { flex: 1, gap: 7 },
  ratingBreakdownRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingBreakdownStarLabel: { width: 9, color: colors.marketplaceMuted, fontSize: 10, textAlign: "right" },
  ratingTrack: { flex: 1, height: 6, overflow: "hidden", borderRadius: 4, backgroundColor: "#ECEDEE" },
  ratingTrackFill: { height: "100%", borderRadius: 4, backgroundColor: "#E6AA32" },
  ratingBreakdownPercent: { width: 28, color: colors.marketplaceMuted, fontSize: 9, textAlign: "right" },
  trustHighlightsLabel: { marginTop: 16, marginBottom: 8, color: "#789085", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  trustHighlights: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  trustHighlight: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 18, backgroundColor: "#F4F8F5", borderWidth: 1, borderColor: "#E6EEE8" },
  trustHighlightText: { color: "#39564A", fontSize: 9, fontWeight: "700" },
  credentialCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDF1EE" },
  credentialIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF8F3" },
  credentialCopy: { flex: 1 },
  credentialTitle: { color: colors.marketplaceInk, fontSize: 11, fontWeight: "700" },
  credentialCaption: { marginTop: 3, color: colors.marketplaceMuted, fontSize: 9, lineHeight: 13 },
  feedbackReviewList: { gap: 9 },
  feedbackReviewItem: { width: "100%", backgroundColor: "#FAFBFA" },
  feedbackEmpty: {
    flex: 1,
    minHeight: 166,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  feedbackEmptyFull: { minHeight: 150, borderRadius: 14, backgroundColor: "#F8FAF8" },
  feedbackEmptyTitle: { marginTop: 7, color: colors.marketplaceInk, fontSize: 11, fontWeight: "700", textAlign: "center" },
  feedbackEmptyText: { marginTop: 4, color: colors.marketplaceMuted, fontSize: 9, lineHeight: 13, textAlign: "center" },
  feedbackLabel: {
    marginBottom: 5,
    color: "#789085",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  feedbackJob: { marginTop: 7, color: "#648071", fontSize: 9, fontWeight: "600" },
  reviewCard: {
    backgroundColor: "#F9FAF8",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDF2EE",
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  reviewerAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.marketplaceInk,
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  reviewStarsNum: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.marketplaceInk,
    marginLeft: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: "#94A3B8",
  },
  reviewBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.marketplaceMuted,
  },
  emptyReviewsCard: {
    backgroundColor: "#F9FAF8",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  emptyReviewsText: {
    fontSize: 12.5,
    color: colors.marketplaceMuted,
    textAlign: "center",
  },
  safetyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 28,
  },
  safetyLinkText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.marketplacePaper,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.marketplaceMuted,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.marketplacePaper,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.marketplaceInk,
    marginTop: 12,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.marketplaceMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  backButtonDefault: {
    backgroundColor: colors.marketplaceGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonDefaultText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  activeJobsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  activeJobsTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  activeJobsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  activeJobsHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.marketplaceInk,
    letterSpacing: -0.2,
  },
  activeJobsSubtitle: {
    fontSize: 11,
    color: colors.marketplaceMuted,
    marginTop: 1,
  },
  activeJobsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#087653",
  },
  activeJobsBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#087653",
  },
  activeJobsList: {
    gap: 10,
  },
  currentJobCardHighlight: {
    borderWidth: 1.5,
    borderColor: "#0A9B71",
    borderRadius: 22,
    padding: 4,
    backgroundColor: "#F0FDF4",
    marginBottom: 10,
  },
  currentJobBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentJobBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#087653",
  },
  activeJobsEmpty: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECE8",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  activeJobsEmptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  activeJobsEmptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.marketplaceInk,
    textAlign: "center",
  },
  activeJobsEmptySubtitle: {
    fontSize: 11,
    color: colors.marketplaceMuted,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 240,
  },
});
