import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";
import { formatDirectPhone } from "@bulao/domain";
import { invalidateServiceQueries } from "../../src/api/serviceApi";
import { dash } from "../../src/components/provider/palette";
import { AppImage as Image } from "../../src/components/AppImage";

export type ConnectionReview = {
  id: string;
  stars: number;
  body: string;
  createdAt: number;
  authorName: string;
  authorPhotoUrl?: string | null;
  jobTitle?: string;
};

export type ConnectionDetailData = {
  id: string;
  kind: "service" | "job";
  isOwner: boolean;
  serviceId: string | null;
  jobId: string | null;
  title: string;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "REJECTED"
    | "CANCELLED"
    | "WITHDRAWN"
    | "CANCELLED_BY_SEEKER"
    | "CANCELLED_BY_PROVIDER";
  details: string;
  area: string;
  scheduledAt: number | null;
  otherName: string;
  otherId: string;
  otherPhotoUrl: string | null;
  otherPhoneVerified: boolean;
  otherCreatedAt?: number | null;
  otherRating: number | null;
  otherTotalReviews: number;
  otherCompletedCount: number;
  otherCompletionRate: number | null;
  distanceKm: number | null;
  recentReviews: ConnectionReview[];
  ownerConfirmedAt: number | null;
  workerConfirmedAt: number | null;
  ownerPaymentConfirmedAt: number | null;
  workerPaymentConfirmedAt: number | null;
  reviewed: boolean;
  phone: string | null;
  location: { latitude: number; longitude: number } | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  cancelledAt: number | null;
  acceptedAt: number | null;
  rejectedAt: number | null;
  createdAt: number;
};

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "Recently";
  const time = timestamp * (timestamp < 1e11 ? 1000 : 1);
  if (isNaN(time)) return "Recently";
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMemberSince(timestamp?: number | null): string {
  if (!timestamp) return "Member on Bulao";
  const date = new Date(timestamp * 1000);
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const year = date.getFullYear();
  return `Member since ${month} ${year}`;
}

function getBadgeMeta(status: string) {
  switch (status?.toUpperCase()) {
    case "PENDING":
      return { label: "Pending Response", bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", dot: "#D97706" };
    case "ACCEPTED":
      return { label: "Accepted", bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "#10B981" };
    case "IN_PROGRESS":
      return { label: "In Progress", bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD", dot: "#0284C7" };
    case "COMPLETED":
      return { label: "Completed", bg: "#F3E8FF", text: "#6B21A8", border: "#E9D5FF", dot: "#9333EA" };
    case "REJECTED":
      return { label: "Declined", bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5", dot: "#EF4444" };
    case "WITHDRAWN":
    case "CANCELLED_BY_SEEKER":
    case "CANCELLED_BY_PROVIDER":
    case "CANCELLED":
      return { label: "Cancelled", bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", dot: "#64748B" };
    default:
      return { label: status || "Open", bg: "#F3F4F6", text: "#374151", border: "#E5E7EB", dot: "#6B7280" };
  }
}

export default function ConnectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [reviewPromptSkipped, setReviewPromptSkipped] = useState(false);
  const [reviewPromptChecked, setReviewPromptChecked] = useState(false);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewBody, setReviewBody] = useState("");

  const detailsQuery = useQuery({
    queryKey: ["connection", id, session?.token],
    enabled: Boolean(id && session?.token),
    queryFn: () => api<ConnectionDetailData>(`/applications/${id}`),
    retry: 1,
  });

  const serviceFallbackQuery = useQuery({
    queryKey: ["service-profile-fallback", id, session?.token],
    enabled: Boolean(
      id &&
        session?.token &&
        (detailsQuery.isError || (!detailsQuery.isLoading && !detailsQuery.data)),
    ),
    queryFn: () => api<any>(`/services/${id}`),
    retry: false,
  });

  useFocusEffect(
    useCallback(() => {
      if (session?.token && id) {
        void queryClient.invalidateQueries({ queryKey: ["connection", id] });
      }
    }, [session?.token, id, queryClient])
  );

  const actionMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason?: string }) => {
      return api(`/applications/${id}/action`, { action, reason });
    },
    onSuccess: async () => {
      await detailsQuery.refetch();
      await invalidateServiceQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
      await queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
      await queryClient.invalidateQueries({ queryKey: ["connection", id] });
    },
    onError: (err: any) => {
      Alert.alert("Action Failed", err?.message || "Could not complete this action. Please retry.");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => api("/reviews", { interactionId: id, stars: reviewStars, body: reviewBody.trim() }),
    onSuccess: async () => {
      setReviewPromptSkipped(true);
      setReviewSheetVisible(false);
      if (id && Platform.OS !== "web") await SecureStore.setItemAsync(`job_review_skipped_${id}`, "1").catch(() => undefined);
      await detailsQuery.refetch();
      await invalidateServiceQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
      await queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
      await queryClient.invalidateQueries({ queryKey: ["connection", id] });
    },
  });

  const offlinePaymentMutation = useMutation({
    mutationFn: (action: "confirm" | "undo") =>
      api(`/applications/${id}/offline-payment`, { action }),
    onSuccess: async () => {
      await detailsQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
    },
    onError: (err: any) => {
      void detailsQuery.refetch();
      Alert.alert("Payment status not updated", err?.message || "Please refresh and try again.");
    },
  });

  const handleCall = (rawPhone: string | null, name: string) => {
    const clean = rawPhone ? formatDirectPhone(rawPhone) : null;
    if (!clean) {
      Alert.alert("Call Unavailable", `Direct phone calling for ${name} is unavailable.`);
      return;
    }
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert("Call Error", "Phone dialer is unavailable on this device.");
    });
  };

  const handleOpenMaps = (loc: { latitude: number; longitude: number } | null, areaName: string) => {
    let url = "";
    if (loc?.latitude && loc?.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(areaName)}`;
    }
    void Linking.openURL(url);
  };

  const item = detailsQuery.data;
  const badge = getBadgeMeta(item?.status || "PENDING");
  const isPending = item?.status === "PENDING";
  const isAccepted = item?.status === "ACCEPTED" || item?.status === "IN_PROGRESS";
  const isCompleted = item?.status === "COMPLETED";
  const myPaymentConfirmed = item && (item.isOwner ? item.ownerPaymentConfirmedAt : item.workerPaymentConfirmedAt) != null;
  const otherPaymentConfirmed = item && (item.isOwner ? item.workerPaymentConfirmedAt : item.ownerPaymentConfirmedAt) != null;
  const bothPaymentConfirmed = Boolean(item?.ownerPaymentConfirmedAt && item?.workerPaymentConfirmedAt);

  useEffect(() => {
    let current = true;
    setReviewSheetVisible(false);
    setReviewStars(0);
    setReviewBody("");
    setReviewPromptChecked(false);
    setReviewPromptSkipped(false);
    if (!id || Platform.OS === "web") {
      setReviewPromptChecked(true);
      return;
    }
    SecureStore.getItemAsync(`job_review_skipped_${id}`)
      .then((value) => {
        if (!current) return;
        setReviewPromptSkipped(value === "1");
        setReviewPromptChecked(true);
      })
      .catch(() => {
        if (current) setReviewPromptChecked(true);
      });
    return () => { current = false; };
  }, [id]);

  useEffect(() => {
    if (
      reviewPromptChecked &&
      item?.status === "COMPLETED" &&
      !item.reviewed &&
      !reviewPromptSkipped
    ) {
      setReviewSheetVisible(true);
    }
  }, [
    reviewPromptChecked,
    item?.kind,
    item?.status,
    item?.isOwner,
    item?.reviewed,
    reviewPromptSkipped,
  ]);

  const skipReviewPrompt = () => {
    setReviewSheetVisible(false);
    setReviewPromptSkipped(true);
    setReviewStars(0);
    setReviewBody("");
    if (id && Platform.OS !== "web") void SecureStore.setItemAsync(`job_review_skipped_${id}`, "1").catch(() => undefined);
  };

  const openReviewPrompt = () => {
    setReviewStars(0);
    setReviewBody("");
    reviewMutation.reset();
    setReviewSheetVisible(true);
  };

  const confirmOfflinePayment = () => {
    if (!item) return;
    const message = item.isOwner
      ? "Confirm only if you have actually received the agreed payment. Bulao does not collect or verify offline payments."
      : "Confirm only if you have actually paid the agreed amount. Bulao does not collect or verify offline payments.";
    Alert.alert("Confirm offline payment", message, [
      { text: "Not yet", style: "cancel" },
      { text: "Yes, confirm", onPress: () => offlinePaymentMutation.mutate("confirm") },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={dash.ink} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item?.title || "Request Details"}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={detailsQuery.isRefetching}
            onRefresh={() => void detailsQuery.refetch()}
            tintColor="#047857"
            colors={["#047857"]}
          />
        }
      >
        {!session?.token ? (
          <View style={styles.errorCard}>
            <Ionicons name="lock-closed-outline" size={44} color="#64748B" />
            <Text style={styles.errorTitle}>Sign in to view request</Text>
            <Text style={styles.errorSub}>
              Please sign in to track or respond to this booking request.
            </Text>
            <Pressable onPress={() => router.push("/auth")} style={styles.btnRetry}>
              <Text style={styles.btnRetryText}>Sign In Now</Text>
            </Pressable>
          </View>
        ) : detailsQuery.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.loadingText}>Loading details…</Text>
          </View>
        ) : serviceFallbackQuery.data ? (
          <View style={styles.errorCard}>
            <View style={styles.serviceFallbackIcon}>
              <Ionicons name="construct" size={34} color="#047857" />
            </View>
            <Text style={styles.errorTitle}>
              {serviceFallbackQuery.data.title || "Service Profile"}
            </Text>
            <Text style={styles.errorSub}>
              This is your listed service profile. You can view all customer bookings and requests received for this service here.
            </Text>
            <View style={{ width: "100%", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/service-requests",
                    params: { tab: "received", serviceId: String(id) },
                  })
                }
                style={[styles.btnRetry, { backgroundColor: "#047857", width: "100%" }]}
              >
                <Ionicons name="mail-unread-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnRetryText}>View Service Requests</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace("/service-requests");
                }}
                style={[styles.btnRetry, { backgroundColor: "#F1F5F9", width: "100%", borderWidth: 1, borderColor: "#CBD5E1" }]}
              >
                <Text style={[styles.btnRetryText, { color: "#334155" }]}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        ) : detailsQuery.isError || !item ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={48} color="#B91C1C" />
            <Text style={styles.errorTitle}>Job or Request Unavailable</Text>
            <Text style={styles.errorSub}>
              {detailsQuery.error?.message || "This job was deleted or is no longer available."}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace("/find-work");
                }}
                style={[styles.btnRetry, { backgroundColor: "#475569" }]}
              >
                <Text style={styles.btnRetryText}>Go Back</Text>
              </Pressable>
              <Pressable onPress={() => void detailsQuery.refetch()} style={styles.btnRetry}>
                <Text style={styles.btnRetryText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Status Card */}
            <View style={styles.mainCard}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.serviceName}>{item.title}</Text>
                  <Text style={styles.serviceKind}>
                    {item.kind === "service" ? "Service Booking" : "Work Opportunity"}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <View style={[styles.dot, { backgroundColor: badge.dot }]} />
                  <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>

              {/* Unlocked Contact Box vs Privacy Protected Box */}
              {isAccepted ? (
                <View style={styles.contactUnlockedCard}>
                  <View style={styles.unlockedHeader}>
                    <Ionicons name="checkmark-circle" size={16} color="#047857" />
                    <Text style={styles.unlockedHeaderText}>Contact Details Unlocked</Text>
                  </View>
                  <Text style={styles.unlockedNotice}>
                    {item.isOwner
                      ? "You accepted this booking. You can now coordinate directly with the customer."
                      : "The service provider accepted your request. You can now call each other directly."}
                  </Text>

                  <View style={styles.phoneActionRow}>
                    <View>
                      <Text style={styles.phoneLabel}>
                        {item.isOwner ? "CUSTOMER MOBILE" : "PROVIDER MOBILE"}
                      </Text>
                      <Text style={styles.phoneNumber}>
                        {item.phone ? `+91 ${formatDirectPhone(item.phone)}` : "Verified Contact"}
                      </Text>
                    </View>
                    {item.phone && (
                      <Pressable
                        onPress={() => handleCall(item.phone, item.otherName)}
                        style={styles.btnCallNow}
                      >
                        <Ionicons name="call" size={14} color="#FFFFFF" />
                        <Text style={styles.btnCallNowText}>Call Now</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : isPending ? (
                <View style={styles.privacyBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#B45309" />
                  <Text style={styles.privacyText}>
                    {item.isOwner
                      ? "Direct phone numbers unlock automatically when you accept this request."
                      : "Awaiting provider response. Phone numbers unlock once accepted."}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* TRUST & USER PROFILE CARD (Crucial for Provider Trust) */}
            <View style={styles.trustCard}>
              <View style={styles.trustCardTopRow}>
                <View style={styles.avatarWrap}>
                  {item.otherPhotoUrl ? (
                    <Image source={{ uri: item.otherPhotoUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetters}>
                        {(item.otherName || "U").substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {item.otherPhoneVerified && (
                    <View style={styles.avatarCheckBadge}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.nameVerifiedRow}>
                    <Text style={styles.trustPersonName} numberOfLines={1}>
                      {item.otherName || "Customer"}
                    </Text>
                    {item.otherPhoneVerified && (
                      <View style={styles.verifiedTag}>
                        <Ionicons name="shield-checkmark" size={11} color="#047857" />
                        <Text style={styles.verifiedTagText}>Verified</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.trustPersonSub} numberOfLines={1}>
                    {item.isOwner ? "Customer" : "Service Professional"} • {formatMemberSince(item.otherCreatedAt)}
                  </Text>

                  {/* Distance Away Badge */}
                  {item.distanceKm != null ? (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate-circle" size={13} color="#047857" />
                      <Text style={styles.distanceBadgeText}>
                        {item.distanceKm} km away from your base
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="location" size={13} color="#047857" />
                      <Text style={styles.distanceBadgeText}>{item.area || "Local Area"}</Text>
                    </View>
                  )}
                </View>

                {item.otherId && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: item.otherId, role: item.isOwner ? "seeker" : "provider" },
                      })
                    }
                    style={styles.btnViewProfilePill}
                  >
                    <Text style={styles.btnViewProfilePillText}>Profile</Text>
                    <Ionicons name="chevron-forward" size={12} color="#047857" />
                  </Pressable>
                )}
              </View>

              {/* 4-Pill Trust Metrics Grid */}
              <View style={styles.metricsGrid}>
                {/* 1. Rating */}
                <View style={styles.metricItem}>
                  <View style={styles.metricValRow}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.metricVal}>
                      {item.otherRating != null ? item.otherRating.toFixed(1) : "New"}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>
                    {item.otherTotalReviews > 0 ? `${item.otherTotalReviews} reviews` : "No ratings yet"}
                  </Text>
                </View>

                {/* 2. Completed Bookings / Jobs */}
                <View style={styles.metricItem}>
                  <View style={styles.metricValRow}>
                    <Ionicons name="briefcase" size={14} color="#047857" />
                    <Text style={styles.metricVal}>{item.otherCompletedCount || 0}</Text>
                  </View>
                  <Text style={styles.metricLabel}>jobs done</Text>
                </View>

                {/* 3. Reliability Rate */}
                <View style={styles.metricItem}>
                  <View style={styles.metricValRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
                    <Text style={styles.metricVal}>
                      {item.otherCompletionRate != null ? `${item.otherCompletionRate}%` : "100%"}
                    </Text>
                  </View>
                  <Text style={styles.metricLabel}>reliability</Text>
                </View>

                {/* 4. Verified Status */}
                <View style={styles.metricItem}>
                  <View style={styles.metricValRow}>
                    <Ionicons name="checkmark-done-circle" size={15} color="#059669" />
                    <Text style={[styles.metricVal, { color: "#059669" }]}>Safe</Text>
                  </View>
                  <Text style={styles.metricLabel}>phone verified</Text>
                </View>
              </View>

              {/* Recent Customer Feedbacks / Reviews */}
              {item.recentReviews && item.recentReviews.length > 0 ? (
                <View style={styles.feedbackSection}>
                  <View style={styles.feedbackSectionHeader}>
                    <Text style={styles.feedbackSectionTitle}>Previous Provider Feedbacks</Text>
                    <Text style={styles.feedbackCountText}>
                      Showing {item.recentReviews.length} of {item.otherTotalReviews}
                    </Text>
                  </View>

                  {item.recentReviews.map((rev) => (
                    <View key={rev.id} style={styles.feedbackCard}>
                      <View style={styles.feedbackTopRow}>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Ionicons
                              key={starIdx}
                              name={starIdx <= rev.stars ? "star" : "star-outline"}
                              size={12}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                        <Text style={styles.feedbackDate}>{formatRelativeTime(rev.createdAt)}</Text>
                      </View>

                      {!!rev.body && (
                        <Text style={styles.feedbackBody} numberOfLines={3}>
                          "{rev.body}"
                        </Text>
                      )}

                      <View style={styles.feedbackAuthorRow}>
                        <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                        <Text style={styles.feedbackAuthorName}>{rev.authorName || "Verified Hirer"}</Text>
                        {!!rev.jobTitle && (
                          <Text style={styles.feedbackJobTitle}>• {rev.jobTitle}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.newCustomerTrustNote}>
                  <Ionicons name="sparkles" size={16} color="#047857" />
                  <Text style={styles.newCustomerTrustNoteText}>
                    This user has a verified phone number and zero cancellation marks. Prompt communication helps ensure a 5-star experience!
                  </Text>
                </View>
              )}
            </View>

            {/* Request Details Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Request & Booking Details</Text>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color="#047857" style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Service Location</Text>
                  <Text style={styles.infoValue}>{item.area || "Local Area"}</Text>
                  {item.distanceKm != null && (
                    <Text style={styles.infoDistanceSub}>
                      Approximately {item.distanceKm} km from your registered service hub
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleOpenMaps(item.location, item.area)}
                  style={styles.mapLinkBtn}
                >
                  <Ionicons name="map-outline" size={14} color="#047857" />
                  <Text style={styles.mapLinkText}>Maps</Text>
                </Pressable>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color="#047857" style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Scheduled Time</Text>
                  <Text style={styles.infoValue}>
                    {item.scheduledAt
                      ? new Date(item.scheduledAt * 1000).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Scheduled on demand"}
                  </Text>
                </View>
              </View>

              {!!item.details && (
                <View style={styles.infoRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#047857" style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Client Notes & Requirements</Text>
                    <Text style={styles.infoDetailsText}>"{item.details}"</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Primary Action Buttons */}
            <View style={styles.actionContainer}>
              {/* Provider: Accept or Decline Pending Request */}
              {item.isOwner && isPending && (
                <View style={styles.dualActionRow}>
                  <Pressable
                    disabled={actionMutation.isPending}
                    onPress={() => actionMutation.mutate({ action: "accept" })}
                    style={styles.btnPrimaryAccept}
                  >
                    {actionMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.btnPrimaryAcceptText}>Accept Request</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={actionMutation.isPending}
                    onPress={() =>
                      Alert.alert("Decline Request", "Are you sure you want to decline this request?", [
                        { text: "No", style: "cancel" },
                        { text: "Decline", style: "destructive", onPress: () => actionMutation.mutate({ action: "reject" }) },
                      ])
                    }
                    style={styles.btnSecondaryReject}
                  >
                    <Text style={styles.btnSecondaryRejectText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {/* Seeker: Withdraw Pending Request */}
              {!item.isOwner && isPending && (
                <Pressable
                  disabled={actionMutation.isPending}
                  onPress={() =>
                    Alert.alert("Withdraw Request", "Do you want to cancel and withdraw this request?", [
                      { text: "No", style: "cancel" },
                      { text: "Withdraw", style: "destructive", onPress: () => actionMutation.mutate({ action: "withdraw" }) },
                    ])
                  }
                  style={styles.btnWithdrawFull}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#B91C1C" />
                  <Text style={styles.btnWithdrawFullText}>Withdraw Booking Request</Text>
                </Pressable>
              )}

              {/* Provider: Start Service once accepted */}
              {item.kind === "service" && item.isOwner && item.status === "ACCEPTED" && (
                <Pressable
                  disabled={actionMutation.isPending}
                  onPress={() => actionMutation.mutate({ action: "start" })}
                  style={styles.btnPrimaryAccept}
                >
                  <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryAcceptText}>Start Service</Text>
                </Pressable>
              )}

              {/* Confirm Completion for In-Progress or Accepted */}
              {(item.status === "IN_PROGRESS" || item.status === "ACCEPTED") && (
                <View style={{ gap: 8 }}>
                  {(item.isOwner ? item.ownerConfirmedAt : item.workerConfirmedAt) ? (
                    <View style={styles.waitingConfirmBox}>
                      <Ionicons name="hourglass-outline" size={16} color="#0369A1" />
                      <Text style={styles.waitingConfirmText}>
                        You marked the work complete. Waiting for the {item.isOwner ? "customer" : "provider"} to confirm.
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      disabled={actionMutation.isPending}
                      onPress={() => actionMutation.mutate({ action: "confirm" })}
                      style={styles.btnPrimaryAccept}
                    >
                      <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryAcceptText}>
                        {item.isOwner
                          ? "Mark Work Completed"
                          : item.ownerConfirmedAt
                            ? "Confirm Provider's Completion"
                            : "Confirm Work Completed"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Cancel option when accepted or in-progress */}
              {["ACCEPTED", "IN_PROGRESS"].includes(item.status) && (
                <Pressable
                  disabled={actionMutation.isPending}
                  onPress={() =>
                    Alert.alert("Cancel Service", "Are you sure you want to cancel this booking?", [
                      { text: "No", style: "cancel" },
                      { text: "Cancel Booking", style: "destructive", onPress: () => actionMutation.mutate({ action: "cancel" }) },
                    ])
                  }
                  style={styles.btnCancelLink}
                >
                  <Text style={styles.btnCancelLinkText}>Cancel this booking</Text>
                </Pressable>
              )}

              {isCompleted && item.kind === "service" && (
                <View style={styles.offlinePaymentCard}>
                  <View style={styles.offlinePaymentHeader}>
                    <View style={styles.offlinePaymentIcon}>
                      <Ionicons name="cash-outline" size={19} color="#10563F" />
                    </View>
                    <View style={styles.offlinePaymentHeading}>
                      <Text style={styles.offlinePaymentTitle}>Offline payment</Text>
                      <Text style={styles.offlinePaymentSubtitle}>Settle directly with {item.isOwner ? "the customer" : "the provider"}</Text>
                    </View>
                    <View style={[styles.paymentStatusPill, bothPaymentConfirmed ? styles.paymentStatusDone : null]}>
                      <Text style={[styles.paymentStatusText, bothPaymentConfirmed ? styles.paymentStatusDoneText : null]}>
                        {bothPaymentConfirmed ? "Confirmed" : otherPaymentConfirmed ? "Needs review" : myPaymentConfirmed ? "Waiting" : "Unconfirmed"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.offlinePaymentNote}>
                    {bothPaymentConfirmed
                      ? "Both of you marked this payment as settled. Bulao does not verify offline payments."
                      : myPaymentConfirmed
                        ? "You marked this as settled. It will be confirmed here when the other person agrees."
                        : otherPaymentConfirmed
                          ? `${item.otherName} marked this as settled. If you have not paid or received it, do not confirm; resolve it directly with them.`
                          : "Settle directly with each other first, then both confirm here. Bulao does not move money."}
                  </Text>

                  {!bothPaymentConfirmed && (
                    <View style={styles.paymentActionRow}>
                      {myPaymentConfirmed ? (
                        <Pressable
                          disabled={offlinePaymentMutation.isPending || otherPaymentConfirmed}
                          onPress={() => Alert.alert("Undo your confirmation?", "You can change your confirmation only until the other person confirms.", [
                            { text: "Keep it", style: "cancel" },
                            { text: "Undo", style: "destructive", onPress: () => offlinePaymentMutation.mutate("undo") },
                          ])}
                          style={[styles.paymentUndoButton, otherPaymentConfirmed && styles.paymentUndoDisabled]}
                        >
                          <Text style={[styles.paymentUndoText, otherPaymentConfirmed && styles.paymentUndoDisabledText]}>
                            {otherPaymentConfirmed ? "Waiting for your confirmation" : "Undo my confirmation"}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          disabled={offlinePaymentMutation.isPending}
                          onPress={confirmOfflinePayment}
                          style={styles.paymentConfirmButton}
                        >
                          {offlinePaymentMutation.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                          <Text style={styles.paymentConfirmText}>
                            {item.isOwner ? "I received payment" : "I paid offline"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Both service participants can review after completion. */}
              {isCompleted && !item.reviewed && (
                <Pressable
                  onPress={openReviewPrompt}
                  style={styles.btnLeaveReview}
                >
                  <Ionicons name="star" size={18} color="#F59E0B" />
                  <Text style={styles.btnLeaveReviewText}>Rate {item.otherName}</Text>
                </Pressable>
              )}
              {isCompleted && item.reviewed && (
                <View style={styles.reviewSubmittedNote}>
                  <Ionicons name="checkmark-circle" size={17} color="#176B4D" />
                  <Text style={styles.reviewSubmittedText}>Your feedback has been shared</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={reviewSheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={skipReviewPrompt}
      >
        <KeyboardAvoidingView
          style={styles.reviewSheetOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={skipReviewPrompt}
            accessibilityRole="button"
            accessibilityLabel="Skip review"
          />
          <View style={[styles.reviewSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.reviewSheetHandle} />
            <View style={styles.reviewSheetHeader}>
              <View style={styles.reviewSheetHeaderText}>
                <Text style={styles.reviewSheetTitle}>How was the work?</Text>
                <Text style={styles.reviewSheetSubtitle} numberOfLines={2}>
                  Rate your experience with {item?.otherName || "the provider"}.
                </Text>
              </View>
              <Pressable
                onPress={skipReviewPrompt}
                accessibilityRole="button"
                accessibilityLabel="Skip rating and feedback"
                style={styles.reviewSkipButton}
                disabled={reviewMutation.isPending}
              >
                <Text style={styles.reviewSkipText}>Skip</Text>
              </Pressable>
            </View>

            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewStars(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
                  accessibilityState={{ selected: reviewStars === star }}
                  style={styles.reviewStarButton}
                >
                  <Ionicons
                    name={reviewStars >= star ? "star" : "star-outline"}
                    size={34}
                    color={reviewStars >= star ? "#D99A28" : "#B9C5BE"}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={styles.reviewRequiredHint}>
              Choose a star rating to submit. Written feedback is optional.
            </Text>

            <TextInput
              value={reviewBody}
              onChangeText={setReviewBody}
              placeholder="Share a little about your experience (optional)"
              placeholderTextColor="#89958D"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.reviewFeedbackInput}
              accessibilityLabel="Optional written feedback"
            />

            {!!reviewMutation.error && (
              <Text style={styles.reviewErrorText} accessibilityRole="alert">
                {reviewMutation.error.message || "Couldn't submit your review. Please try again."}
              </Text>
            )}

            <Pressable
              disabled={reviewStars === 0 || reviewMutation.isPending}
              onPress={() => reviewMutation.mutate()}
              style={[styles.reviewSubmitButton, (reviewStars === 0 || reviewMutation.isPending) && styles.reviewSubmitDisabled]}
              accessibilityRole="button"
            >
              {reviewMutation.isPending && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={styles.reviewSubmitText}>Submit rating</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF8",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: dash.muted,
  },
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    marginTop: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: dash.ink,
  },
  errorSub: {
    fontSize: 13,
    color: dash.muted,
    textAlign: "center",
  },
  btnRetry: {
    marginTop: 8,
    backgroundColor: "#047857",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnRetryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2EBE5",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  serviceName: {
    fontSize: 20,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.3,
  },
  serviceKind: {
    fontSize: 12,
    fontWeight: "600",
    color: dash.muted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  contactUnlockedCard: {
    marginTop: 14,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  unlockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unlockedHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  unlockedNotice: {
    fontSize: 12,
    color: "#166534",
    lineHeight: 16,
  },
  phoneActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  phoneLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
  },
  phoneNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  btnCallNow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnCallNowText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  privacyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
  },

  /* TRUST & USER PROFILE CARD */
  trustCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2EBE5",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    gap: 16,
  },
  trustCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E2EBE5",
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E2EBE5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetters: {
    fontSize: 18,
    fontWeight: "800",
    color: "#047857",
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  nameVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustPersonName: {
    fontSize: 17,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.2,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  trustPersonSub: {
    fontSize: 12,
    color: dash.muted,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  btnViewProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  btnViewProfilePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAF8",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EEF4F0",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  metricValRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: "800",
    color: dash.ink,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: dash.muted,
    textTransform: "uppercase",
  },
  feedbackSection: {
    gap: 8,
  },
  feedbackSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feedbackSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: dash.ink,
  },
  feedbackCountText: {
    fontSize: 11,
    color: dash.muted,
    fontWeight: "600",
  },
  feedbackCard: {
    backgroundColor: "#F9FBFA",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2EBE5",
    gap: 4,
  },
  feedbackTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  feedbackDate: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  feedbackBody: {
    fontSize: 12,
    color: "#1E293B",
    fontStyle: "italic",
    lineHeight: 16,
  },
  feedbackAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  feedbackAuthorName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  feedbackJobTitle: {
    fontSize: 11,
    color: "#94A3B8",
  },
  newCustomerTrustNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  newCustomerTrustNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
    lineHeight: 16,
  },

  /* REQUEST INFO SECTION */
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2EBE5",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: dash.muted,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: dash.ink,
    marginTop: 1,
  },
  infoDistanceSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
    marginTop: 2,
  },
  infoDetailsText: {
    fontSize: 14,
    color: dash.ink,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 20,
  },
  mapLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E9F8EF",
  },
  mapLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  actionContainer: {
    gap: 10,
    marginTop: 6,
  },
  dualActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnPrimaryAccept: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
  },
  btnPrimaryAcceptText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  btnSecondaryReject: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnSecondaryRejectText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
  },
  btnWithdrawFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnWithdrawFullText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
  waitingConfirmBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    padding: 12,
  },
  waitingConfirmText: {
    flex: 1,
    fontSize: 13,
    color: "#0369A1",
    fontWeight: "600",
  },
  btnCancelLink: {
    alignItems: "center",
    paddingVertical: 10,
  },
  btnCancelLinkText: {
    fontSize: 13,
    color: "#64748B",
    textDecorationLine: "underline",
  },
  btnLeaveReview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnLeaveReviewText: {
    color: "#B45309",
    fontSize: 15,
    fontWeight: "800",
  },
  offlinePaymentCard: {
    backgroundColor: "#F5FAF6",
    borderWidth: 1,
    borderColor: "#DCEBE0",
    borderRadius: 14,
    padding: 13,
    gap: 10,
  },
  offlinePaymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  offlinePaymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#E5F2E9",
    alignItems: "center",
    justifyContent: "center",
  },
  offlinePaymentHeading: { flex: 1, minWidth: 0 },
  offlinePaymentTitle: { color: "#26332D", fontSize: 14, fontWeight: "800" },
  offlinePaymentSubtitle: { color: "#737D76", fontSize: 11, marginTop: 2 },
  paymentStatusPill: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCEBE0",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  paymentStatusDone: { backgroundColor: "#EAF4EE", borderColor: "#CFE4D6" },
  paymentStatusText: { color: "#737D76", fontSize: 10, fontWeight: "700" },
  paymentStatusDoneText: { color: "#10563F" },
  offlinePaymentNote: { color: "#66736B", fontSize: 12, lineHeight: 17 },
  paymentActionRow: { flexDirection: "row" },
  paymentConfirmButton: {
    minHeight: 42,
    flex: 1,
    borderRadius: 11,
    backgroundColor: "#10563F",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  paymentConfirmText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  paymentUndoButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  paymentUndoDisabled: { opacity: 0.65 },
  paymentUndoText: { color: "#176B4D", fontSize: 12, fontWeight: "700" },
  paymentUndoDisabledText: { color: "#737D76" },
  reviewSubmittedNote: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#EAF4EE",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  reviewSubmittedText: { color: "#10563F", fontSize: 13, fontWeight: "700" },
  reviewSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(20, 38, 29, 0.24)",
  },
  reviewSheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E3EBE5",
    elevation: 12,
    shadowColor: "#173D2D",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  reviewSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: "#CAD8CF",
    marginBottom: 2,
  },
  reviewSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewSheetHeaderText: { flex: 1, minWidth: 0, gap: 3 },
  reviewSheetTitle: { color: "#26332D", fontSize: 19, fontWeight: "800" },
  reviewSheetSubtitle: { color: "#737D76", fontSize: 13, lineHeight: 18 },
  reviewSkipButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#F1F5F2",
    justifyContent: "center",
    alignItems: "center",
  },
  reviewSkipText: { color: "#52645A", fontSize: 13, fontWeight: "700" },
  reviewStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  reviewStarButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  reviewRequiredHint: { color: "#737D76", fontSize: 12, textAlign: "center", marginTop: -7 },
  reviewFeedbackInput: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: "#E2EAE4",
    borderRadius: 13,
    backgroundColor: "#FAFCFA",
    color: "#26332D",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  reviewErrorText: { color: "#B42318", fontSize: 12, lineHeight: 17 },
  reviewSubmitButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#10563F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewSubmitDisabled: { opacity: 0.48 },
  reviewSubmitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  serviceFallbackIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
});
