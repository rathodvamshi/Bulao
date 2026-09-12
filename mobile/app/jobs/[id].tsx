import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
  Linking,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { api } from "../../src/api/client";
import type { Job } from "../../src/api/types";
import { useSession } from "../../src/store/session";
import { useAuth } from "../../src/auth";
import { usePostWorkStore } from "../../src/features/post-work/store";
import {
  getExactRoleIcon,
  getExperienceOptionsForRole,
} from "../../src/utils/nameVerification";
import { JobApplicationsModal } from "../../src/components/JobApplicationsModal";

const { width } = Dimensions.get("window");

// ── Peak-Level Luxury Design System Palette ──
const pro = {
  canvas: "#F4F7F5",
  surface: "#FFFFFF",
  cardBg: "#FAFCFA",
  emeraldDark: "#022B1F",
  emeraldPrimary: "#075B43",
  emeraldMid: "#0A6E52",
  emeraldLight: "#10B981",
  emeraldSoft: "#E9F8EF",
  emeraldFrost: "#F0FDF4",
  ink: "#0D1914",
  charcoal: "#1F2E27",
  slate: "#475569",
  muted: "#64748B",
  faint: "#94A3B8",
  borderLight: "#E2EBE5",
  borderSubtle: "#EEF4F0",
  gold: "#D97706",
  goldSoft: "#FEF3C7",
  blueAccent: "#2563EB",
  blueSoft: "#EFF6FF",
  purpleAccent: "#7C3AED",
  purpleSoft: "#F3E8FF",
};

// ── Time & Date Helpers ──
function formatRelativeTime(timestamp?: string | number): string {
  if (!timestamp) return "Recently";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp * (timestamp < 1e11 ? 1000 : 1);
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
  });
}

function formatClockTime(timeStr?: string, fallback = "09:00 AM"): string {
  if (!timeStr) return fallback;
  const parts = timeStr.split(":");
  const p0 = parts[0];
  const p1 = parts[1];
  if (!p0 || !p1) return fallback;
  const hour = parseInt(p0, 10);
  const min = p1;
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min} ${ampm}`;
}

export default function JobDetailScreen() {
  const rawParams = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id;
  const insets = useSafeAreaInsets();
  const { user: authUser, session: authSession } = useAuth();
  const token = useSession((x) => x.token) || authSession?.token;
  const client = useQueryClient();
  const postWorkStore = usePostWorkStore();

  const [applicationsModalVisible, setApplicationsModalVisible] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setToastMessage(null);
        }
      });
    }, 2800);
  };

  // Current session user query as identity fallback
  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<{ id: string }>("/users/me"),
  });

  // Fetch job details
  const jobQuery = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<Job>(`/jobs/${id}`),
    enabled: !!id,
    retry: 2,
  });

  const job = jobQuery.data;

  // Multi-source owner detection (independent of seeker/provider mode)
  const currentUserId = authUser?.id || authSession?.userId || me.data?.id;
  const isOwner = Boolean(
    currentUserId &&
    job?.ownerId &&
    String(currentUserId).trim().toLowerCase() === String(job.ownerId).trim().toLowerCase()
  );

  // Candidate apply mutation with double-barrier security
  const applyMutation = useMutation({
    mutationFn: () => {
      if (isOwner) {
        throw new Error("Security Violation: You are the creator of this job posting and cannot apply to it.");
      }
      return api(`/jobs/${id}/apply`, {});
    },
    onSuccess: () => {
      setApplyModalVisible(false);
      void client.invalidateQueries({ queryKey: ["activity"] });
      void client.invalidateQueries({ queryKey: ["job", id] });
      showToast("Application submitted successfully!");
    },
    onError: (err: any) => {
      setApplyModalVisible(false);
      Alert.alert(
        "Application Restricted",
        err?.message || "Could not apply for this position."
      );
    },
  });

  const handleInitiateApply = () => {
    if (isOwner) {
      Alert.alert(
        "Action Restricted",
        "You created this job posting. Employers cannot apply to their own job postings, even when browsing in seeker mode.",
        [{ text: "OK" }]
      );
      return;
    }
    setApplyModalVisible(true);
  };

  // Edit Job Action: populates all fields into postWorkStore and launches post-work
  const handleEditJob = () => {
    if (!job) return;
    postWorkStore.initForEdit(job);
    router.push("/post-work");
  };

  // Share Poster
  const handleShare = async () => {
    if (!job) return;
    const title = job.customTitle || job.title;
    const pay = `₹${Math.round(job.payPaise / 100)} / ${job.payUnit}`;
    const text = `📢 BULAO WORK OPPORTUNITY\n💼 Role: ${job.roleName || title}\n💰 Wage: ${pay} (Direct Payout)\n👥 Workers: ${job.workers || 1}\n📍 Location: ${job.area}\n📅 Date: ${new Date(job.startsAt * 1000).toLocaleDateString("en-IN")}\n\nView details on Bulao: bulao://jobs/${job.id}`;
    try {
      await Share.share({
        title: `Work Opportunity: ${title}`,
        message: text,
      });
    } catch {
      // ignore
    }
  };

  const handleCopyAddress = () => {
    setCopiedAddress(true);
    showToast("Worksite address copied to clipboard!");
    setTimeout(() => setCopiedAddress(false), 2400);
  };

  // Parse exact coordinates given by user
  const rawLat = job?.latitude !== undefined && job?.latitude !== null ? parseFloat(String(job.latitude)) : NaN;
  const rawLng = job?.longitude !== undefined && job?.longitude !== null ? parseFloat(String(job.longitude)) : NaN;
  const hasExactCoords = !isNaN(rawLat) && !isNaN(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180 && (rawLat !== 0 || rawLng !== 0);
  const jobLat = hasExactCoords ? rawLat : 17.3850;
  const jobLng = hasExactCoords ? rawLng : 78.4867;

  const handleOpenMaps = () => {
    if (!job) return;
    let url = "";
    if (hasExactCoords) {
      url = `https://www.google.com/maps/search/?api=1&query=${jobLat},${jobLng}`;
    } else {
      const query = job.address ? `${job.address}, ${job.area}` : job.area;
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    void Linking.openURL(url);
  };

  const handleCall = (phoneNumber?: string) => {
    if (phoneNumber) {
      void Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("Contact Unavailable", "Phone number is not available.");
    }
  };

  // Contextual experience options matching the role & category
  const dynamicExperienceOptions = useMemo(() => {
    if (!job) return [];
    return getExperienceOptionsForRole(
      job.roleId || "",
      job.roleName || job.title || "",
      job.categoryId || ""
    );
  }, [job?.roleId, job?.roleName, job?.title, job?.categoryId]);

  if (jobQuery.isPending) {
    return (
      <SafeAreaView style={styles.stateCenter}>
        <ActivityIndicator size="large" color={pro.emeraldPrimary} />
        <Text style={styles.loadingLabel}>Loading Job Details...</Text>
      </SafeAreaView>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <SafeAreaView style={styles.stateCenter}>
        <Ionicons name="alert-circle-outline" size={52} color={pro.gold} />
        <Text style={styles.errorHeading}>Position Unavailable</Text>
        <Text style={styles.errorSubtext}>
          {jobQuery.error instanceof Error
            ? jobQuery.error.message
            : "This job opportunity has been closed or is temporarily unavailable."}
        </Text>
        <Pressable style={styles.errorBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const roleEmoji =
    job.roleIcon || getExactRoleIcon(job.roleId || "", job.title || "", job.categoryId || "");
  const displayTitle = job.customTitle || job.title || "Work Opportunity";
  const categoryLabel = (job.categoryName || "General Work").toUpperCase();
  const roleLabel = job.roleName || job.title || "Skilled Worker";

  // Date & Duration Calculations
  const startDate = new Date(job.startsAt * 1000);
  const formattedStartDate = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Immediate";

  let durationLabel = "1 Day";
  let durationSubLabel = "Single day shift";
  let durationIcon = "📅";
  let totalDays = 1;
  if (job.duration === "few") {
    durationIcon = "📆";
    if (job.endsAt) {
      const endDate = new Date(job.endsAt * 1000);
      const diffDays = Math.max(1, Math.round((job.endsAt - job.startsAt) / 86400));
      totalDays = diffDays;
      durationLabel = `${diffDays} Days`;
      durationSubLabel = `Until ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    } else {
      durationLabel = "Few Days";
      durationSubLabel = "Estimated 2-5 days";
      totalDays = 3;
    }
  } else if (job.duration === "ongoing") {
    durationIcon = "∞";
    durationLabel = "Ongoing";
    durationSubLabel = "Continuous work";
  }

  // Timing Formatting
  const startClock = formatClockTime(job.startTime, "09:00 AM");
  const endClock = formatClockTime(job.endTime, "05:00 PM");
  const timingLabel =
    job.hours === "custom" && job.startTime && job.endTime
      ? `${startClock} – ${endClock}`
      : "09:00 AM – 05:00 PM";
  const shiftBadge = job.hours === "custom" ? "Custom" : "8 Hours";
  const shiftSub = job.hours === "custom" ? "Custom timings" : "Standard day shift";
  const hoursIcon = job.hours === "custom" ? "⏱️" : "☀️";

  // Matched Experience details with respective icons from post-work flow
  const matchedExp =
    dynamicExperienceOptions.find((o) => o.value === job.experience) ||
    (job.experience === "expert"
      ? {
          value: "expert",
          badge: "Expert",
          label: "3+ Years",
          subtext: "Master level pro",
          icon: "👑",
        }
      : job.experience === "some"
      ? {
          value: "some",
          badge: "Skilled",
          label: "1–2 Years",
          subtext: "Independent tool work",
          icon: "⚡",
        }
      : {
          value: "any",
          badge: "Any",
          label: "Any Level",
          subtext: "Freshers welcome",
          icon: "🌱",
        });

  // Wage & Total Project Value
  const wagePerUnit = Math.round(job.payPaise / 100);
  const payWhenMap: Record<string, { label: string; icon: string; desc: string }> = {
    after: { label: "After Work", icon: "✅", desc: "Paid immediately after work completion" },
    daily: { label: "Daily Payout", icon: "📅", desc: "Paid daily at shift completion" },
    weekly: { label: "Weekly Payout", icon: "📆", desc: "Weekly bank/UPI settlement" },
    monthly: { label: "Monthly Cycle", icon: "🏦", desc: "Monthly direct billing" },
  };
  const paySchedule = payWhenMap[job.paidWhen || "after"] || {
    label: "Direct Settlement",
    icon: "✅",
    desc: "Direct payout upon shift completion",
  };

  const totalWorkers = job.workers || 1;
  const workerGenderBadge =
    (job as any).gender === "male"
      ? "Male Only"
      : (job as any).gender === "female"
      ? "Female Only"
      : "All Welcome";
  let estimatedTotalPayout = wagePerUnit * totalWorkers;
  if (job.duration === "few" && totalDays > 1 && job.payUnit === "day") {
    estimatedTotalPayout = wagePerUnit * totalDays * totalWorkers;
  }

  const extrasList = Array.isArray(job.extras) ? job.extras : [];
  const applicantsList = Array.isArray(job.applicants) ? job.applicants : [];
  const applicantsCount = job.applicantCount || applicantsList.length || 0;
  const jobReference = (job.id || "BULAO").slice(0, 8).toUpperCase();
  const isStopped = job.status === "PAUSED";
  const isFilled = job.status === "FILLED";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* ── 1. EXECUTIVE GLASS-FINISH HEADER BAR ── */}
      <View style={styles.topNav}>
        <Pressable
          style={styles.navRoundBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/find-work");
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={pro.ink} />
        </Pressable>

        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>Job Overview</Text>
          <View style={styles.navSerialPill}>
            <Text style={styles.navSerialText}>POSTER REF #{jobReference}</Text>
          </View>
        </View>

        <Pressable
          style={styles.navRoundBtn}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share Job"
        >
          <Ionicons name="share-social-outline" size={19} color={pro.ink} />
        </Pressable>
      </View>

      {/* ── FLOATING NOTIFICATION TOAST (SMOOTH SPRING IN & SILKY EASE OUT) ── */}
      {!!toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
                {
                  scale: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.93, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={17} color={pro.emeraldLight} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ── SCROLLABLE MASTER POSTER CANVAS ── */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2. HERO POSTER IDENTITY CARD ── */}
        <View style={styles.heroPosterCard}>
          {/* Top Hierarchy Row: Category Badge + Dynamic Status Indicator */}
          <View style={styles.heroMetaRow}>
            <View style={styles.categoryBadge}>
              <Ionicons name="briefcase-outline" size={12} color={pro.emeraldPrimary} />
              <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
            </View>

            {isStopped ? (
              <View style={[styles.liveStatusTag, { backgroundColor: pro.goldSoft }]}>
                <View style={[styles.statusDot, { backgroundColor: pro.gold }]} />
                <Text style={[styles.liveStatusText, { color: pro.gold }]}>
                  Posting On Hold
                </Text>
              </View>
            ) : isFilled ? (
              <View style={[styles.liveStatusTag, { backgroundColor: pro.blueSoft }]}>
                <View style={[styles.statusDot, { backgroundColor: pro.blueAccent }]} />
                <Text style={[styles.liveStatusText, { color: pro.blueAccent }]}>
                  Position Filled
                </Text>
              </View>
            ) : (
              <View style={[styles.liveStatusTag, { backgroundColor: pro.emeraldSoft }]}>
                <View style={[styles.statusDot, { backgroundColor: pro.emeraldLight }]} />
                <Text style={[styles.liveStatusText, { color: pro.emeraldPrimary }]}>
                  Active • Hiring Now
                </Text>
              </View>
            )}
          </View>

          {/* Trade Identity Spotlight */}
          <View style={styles.tradeHeaderRow}>
            <View style={styles.tradeEmblemBox}>
              <Text style={styles.tradeEmblemEmoji}>{roleEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tradeRoleName}>{roleLabel}</Text>
              <Text style={styles.tradeCustomHeadline} numberOfLines={2}>
                {displayTitle}
              </Text>
            </View>
          </View>

          {/* Poster Metadata Strip */}
          <View style={styles.heroCardFooter}>
            <View style={styles.metaIconTag}>
              <Ionicons name="time-outline" size={13} color={pro.muted} />
              <Text style={styles.metaIconText}>
                Published {formatRelativeTime(job.createdAt)}
              </Text>
            </View>

            {isOwner ? (
              <View style={styles.ownerNoticeTag}>
                <Ionicons name="person-circle" size={13} color={pro.emeraldPrimary} />
                <Text style={styles.ownerNoticeTagText}>Your Job Posting</Text>
              </View>
            ) : (
              <View style={styles.verifiedJobTag}>
                <Ionicons name="shield-checkmark" size={13} color={pro.emeraldPrimary} />
                <Text style={styles.verifiedJobTagText}>Direct Employer</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 3. COMPENSATION & REMUNERATION VAULT CARD ── */}
        <LinearGradient
          colors={[pro.emeraldDark, pro.emeraldPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.compGradientCard}
        >
          {/* Top Guarantee Pill */}
          <View style={styles.compHeaderRow}>
            <Text style={styles.compSubtitle}>OFFERED REMUNERATION</Text>
            <View style={styles.zeroFeePill}>
              <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
              <Text style={styles.zeroFeeText}>0% Platform Fee • 100% Payout</Text>
            </View>
          </View>

          {/* Wage Main Display */}
          <View style={styles.compAmountRow}>
            <Text style={styles.compCurrencySign}>₹</Text>
            <Text style={styles.compAmountNumber}>
              {wagePerUnit.toLocaleString("en-IN")}
            </Text>
            <Text style={styles.compUnitLabel}>/ {job.payUnit.toUpperCase()}</Text>
          </View>

          {/* Payout Schedule Note */}
          <View style={styles.compDivider} />

          <View style={styles.compFooterRow}>
            <View style={styles.payoutTimingChip}>
              <Text style={styles.payoutTimingChipEmoji}>{paySchedule.icon}</Text>
              <Text style={styles.payoutTimingChipText}>{paySchedule.label}</Text>
            </View>

            {/* Total Budget / Multi-worker Calculation */}
            {totalWorkers > 1 || (job.duration === "few" && totalDays > 1 && job.payUnit === "day") ? (
              <View style={styles.totalBudgetChip}>
                <Text style={styles.totalBudgetText}>
                  Est. Budget: ₹{estimatedTotalPayout.toLocaleString("en-IN")}
                </Text>
              </View>
            ) : (
              <Text style={styles.directEscrowNote}>{paySchedule.desc}</Text>
            )}
          </View>
        </LinearGradient>

        {/* ── 4. KEY SPECIFICATIONS (PREMIUM 2x2 BALANCED GRID — ZERO UNDERFLOW / NO CLIPPING) ── */}
        <View style={styles.bentoSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>KEY SPECIFICATIONS</Text>
            <View style={styles.verifiedSpecsBadge}>
              <Ionicons name="checkmark-done" size={12} color={pro.emeraldPrimary} />
              <Text style={styles.verifiedSpecsBadgeText}>Verified Requirements</Text>
            </View>
          </View>

          {/* 4 Balanced Cards with Generous Breathing Room */}
          <View style={styles.bentoGrid}>
            {/* 1. Workers */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoHeaderRow}>
                <View style={styles.bentoIconLabelGroup}>
                  <View style={[styles.bentoIconBox, { backgroundColor: pro.emeraldSoft }]}>
                    <Text style={styles.bentoEmoji}>👥</Text>
                  </View>
                  <Text style={styles.bentoLabel}>Workers</Text>
                </View>
                <View style={[styles.bentoBadgePill, { backgroundColor: pro.emeraldSoft }]}>
                  <Text style={[styles.bentoBadgePillText, { color: pro.emeraldPrimary }]}>
                    {workerGenderBadge}
                  </Text>
                </View>
              </View>

              <View style={styles.bentoBody}>
                <Text
                  style={styles.bentoPrimaryVal}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  {totalWorkers} {totalWorkers === 1 ? "Worker" : "Workers"}
                </Text>
                <Text style={styles.bentoSubVal} numberOfLines={2}>
                  On-site placement
                </Text>
              </View>
            </View>

            {/* 2. Experience */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoHeaderRow}>
                <View style={styles.bentoIconLabelGroup}>
                  <View style={[styles.bentoIconBox, { backgroundColor: pro.goldSoft }]}>
                    <Text style={styles.bentoEmoji}>{matchedExp.icon}</Text>
                  </View>
                  <Text style={styles.bentoLabel}>Experience</Text>
                </View>
                <View style={[styles.bentoBadgePill, { backgroundColor: pro.goldSoft }]}>
                  <Text style={[styles.bentoBadgePillText, { color: pro.gold }]}>
                    {matchedExp.badge}
                  </Text>
                </View>
              </View>

              <View style={styles.bentoBody}>
                <Text
                  style={styles.bentoPrimaryVal}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  {matchedExp.label}
                </Text>
                <Text style={styles.bentoSubVal} numberOfLines={2}>
                  {matchedExp.subtext}
                </Text>
              </View>
            </View>

            {/* 3. Start Date */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoHeaderRow}>
                <View style={styles.bentoIconLabelGroup}>
                  <View style={[styles.bentoIconBox, { backgroundColor: pro.blueSoft }]}>
                    <Text style={styles.bentoEmoji}>{durationIcon}</Text>
                  </View>
                  <Text style={styles.bentoLabel}>Start Date</Text>
                </View>
                <View style={[styles.bentoBadgePill, { backgroundColor: pro.blueSoft }]}>
                  <Text style={[styles.bentoBadgePillText, { color: pro.blueAccent }]}>
                    {durationLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.bentoBody}>
                <Text
                  style={styles.bentoPrimaryVal}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  {formattedStartDate}
                </Text>
                <Text style={styles.bentoSubVal} numberOfLines={2}>
                  {durationSubLabel}
                </Text>
              </View>
            </View>

            {/* 4. Timings */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoHeaderRow}>
                <View style={styles.bentoIconLabelGroup}>
                  <View style={[styles.bentoIconBox, { backgroundColor: pro.purpleSoft }]}>
                    <Text style={styles.bentoEmoji}>{hoursIcon}</Text>
                  </View>
                  <Text style={styles.bentoLabel}>Timings</Text>
                </View>
                <View style={[styles.bentoBadgePill, { backgroundColor: pro.purpleSoft }]}>
                  <Text style={[styles.bentoBadgePillText, { color: pro.purpleAccent }]}>
                    {shiftBadge}
                  </Text>
                </View>
              </View>

              <View style={styles.bentoBody}>
                <Text
                  style={styles.bentoPrimaryVal}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.80}
                >
                  {timingLabel}
                </Text>
                <Text style={styles.bentoSubVal} numberOfLines={2}>
                  {shiftSub}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 5. WORKSITE LOCATION & EXACT GOOGLE MAP PIN ── */}
        <View style={styles.venueCard}>
          <View style={styles.venueHeaderRow}>
            <View style={styles.venueIconSquare}>
              <Ionicons name="location" size={20} color={pro.emeraldPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueHeaderLabel}>WORKSITE VENUE & LOCATION</Text>
              <Text style={styles.venueAreaName}>{job.area}</Text>
            </View>

            {hasExactCoords && (
              <View style={styles.gpsCoordBadge}>
                <Ionicons name="navigate-circle" size={12} color={pro.emeraldPrimary} />
                <Text style={styles.gpsCoordText}>Exact Pin</Text>
              </View>
            )}
          </View>

          {/* Embedded Google Map View with Exact Coordinates */}
          <View style={styles.mapWrap}>
            <MapView
              key={`map-${jobLat}-${jobLng}`}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: jobLat,
                longitude: jobLng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              region={{
                latitude: jobLat,
                longitude: jobLng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={true}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
              mapType="standard"
            >
              <Marker
                coordinate={{
                  latitude: jobLat,
                  longitude: jobLng,
                }}
                title={job.area || "Worksite"}
                description={job.address || job.area || "Exact worksite location"}
                pinColor={pro.emeraldPrimary}
              />
            </MapView>

            <View style={styles.mapTopBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.mapTopBadgeText}>Exact Worksite Location</Text>
            </View>

            <View style={styles.mapFooterStrip}>
              <Ionicons name="navigate-outline" size={12} color={pro.muted} />
              <Text style={styles.mapFooterStripText}>
                {hasExactCoords
                  ? `${jobLat.toFixed(5)}° N, ${jobLng.toFixed(5)}° E • Verified GPS Point`
                  : `${job.area} • Worksite location`}
              </Text>
            </View>
          </View>

          {/* Full Street Address with Exact Venue Tag */}
          <View style={styles.addressBox}>
            <Ionicons name="business-outline" size={16} color={pro.emeraldPrimary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.venueAddressHeader}>EXACT ADDRESS</Text>
              <Text style={styles.venueFullAddress}>
                {job.address && job.address.trim().length > 0
                  ? job.address.trim()
                  : `${job.area}, Worksite`}
              </Text>
              {job.area && job.address && !job.address.toLowerCase().includes(job.area.toLowerCase()) ? (
                <Text style={styles.venueAreaSub}>{job.area}</Text>
              ) : null}
            </View>
          </View>

          {/* Action Row: Copy Address + Open in Google Maps */}
          <View style={styles.venueActionRow}>
            <Pressable
              style={styles.actionPillBtn}
              onPress={handleCopyAddress}
              accessibilityRole="button"
              accessibilityLabel="Copy address"
            >
              <Ionicons
                name={copiedAddress ? "checkmark" : "copy-outline"}
                size={14}
                color={pro.emeraldPrimary}
              />
              <Text style={styles.actionPillBtnText}>
                {copiedAddress ? "Copied" : "Copy Address"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionPillBtn, styles.actionPillBtnSecondary]}
              onPress={handleOpenMaps}
              accessibilityRole="button"
              accessibilityLabel="View directions in Google Maps"
            >
              <Ionicons name="map-outline" size={14} color={pro.ink} />
              <Text style={[styles.actionPillBtnText, { color: pro.ink }]}>
                Open in Maps
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── 6. FACILITIES & PERKS CLOUD ── */}
        {extrasList.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>PROVIDED AMENITIES & PERKS</Text>
            <View style={styles.perksWrap}>
              {extrasList.map((item: string, idx: number) => {
                let iconName: keyof typeof Ionicons.glyphMap = "checkmark-circle";
                const lower = item.toLowerCase();
                if (lower.includes("food") || lower.includes("meal")) iconName = "restaurant";
                else if (lower.includes("travel") || lower.includes("transport")) iconName = "car";
                else if (lower.includes("tool")) iconName = "hammer";
                else if (lower.includes("safety") || lower.includes("gear")) iconName = "shield";
                else if (lower.includes("stay") || lower.includes("room") || lower.includes("accom")) iconName = "bed";
                else if (lower.includes("tea") || lower.includes("coffee")) iconName = "cafe";
                else if (lower.includes("bonus") || lower.includes("overtime")) iconName = "cash";

                return (
                  <View key={idx} style={styles.perkChip}>
                    <Ionicons name={iconName} size={15} color={pro.emeraldPrimary} />
                    <Text style={styles.perkChipText}>{item}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── 7. SCOPE OF WORK & CLIENT INSTRUCTIONS ── */}
        {job.details && job.details.trim().length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>JOB SPECIFICATION & NOTES</Text>
            <View style={styles.scopeCard}>
              <View style={styles.scopeHeaderRow}>
                <Ionicons name="document-text" size={16} color={pro.emeraldPrimary} />
                <Text style={styles.scopeCardTitle}>Instructions from Client</Text>
              </View>
              <Text style={styles.scopeBodyText}>{job.details.trim()}</Text>
            </View>
          </View>
        ) : null}

        {/* ── 8. AUTHORIZED EMPLOYER CREDENTIALS ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.employerCard}>
            <View style={styles.employerAvatarSquare}>
              <Text style={styles.employerAvatarInitial}>
                {(job.ownerName || "E").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.employerSubtitle}>POSTED & VERIFIED BY</Text>
              <Text style={styles.employerNameText}>
                {job.ownerName || "Verified Employer"}
              </Text>
              <View style={styles.employerBadgeRow}>
                <Ionicons name="shield-checkmark" size={13} color={pro.emeraldLight} />
                <Text style={styles.employerBadgeText}>Identity & Phone Verified Client</Text>
              </View>
            </View>

            {!isOwner && job.ownerPhone ? (
              <Pressable
                style={styles.directCallButton}
                onPress={() => handleCall(job.ownerPhone)}
                accessibilityRole="button"
                accessibilityLabel="Call employer"
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* ============================================================
          9. STRATEGIC BOTTOM COMMAND DOCK
          ============================================================ */}
      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {isOwner ? (
          /* OWNER MODE: Side-By-Side [View Applications] & [Edit Job] */
          <View style={styles.ownerSideBySideRow}>
            {/* Left Button: View Applications */}
            <Pressable
              style={styles.viewAppsButton}
              onPress={() => setApplicationsModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="View Applications"
            >
              <View style={styles.viewAppsInner}>
                <Ionicons name="people" size={18} color={pro.emeraldPrimary} />
                <Text style={styles.viewAppsButtonText}>
                  Applications ({applicantsCount})
                </Text>
              </View>
            </Pressable>

            {/* Right Button: Edit Job */}
            <Pressable
              style={styles.editJobButton}
              onPress={handleEditJob}
              accessibilityRole="button"
              accessibilityLabel="Edit Job"
            >
              <LinearGradient
                colors={[pro.emeraldPrimary, pro.emeraldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.editGradient}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Edit Job</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          /* WORKER MODE: Full-width Apply Button */
          <View style={styles.workerApplyRow}>
            <Pressable
              style={styles.applyFullButton}
              onPress={handleInitiateApply}
              disabled={isStopped || isFilled}
              accessibilityRole="button"
              accessibilityLabel="Apply for this Job"
            >
              <LinearGradient
                colors={
                  isStopped || isFilled
                    ? ["#94A3B8", "#64748B"]
                    : [pro.emeraldPrimary, pro.emeraldDark]
                }
                style={styles.applyGradient}
              >
                <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                <Text style={styles.applyFullButtonText}>
                  {isStopped
                    ? "Position Temporarily On Hold"
                    : isFilled
                    ? "Position Filled"
                    : "Apply for this Job"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>

      {/* ============================================================
          10. APPLICATIONS BOTTOM SHEET MODAL (SMOOTH SPRING ENTRANCE & SILKY EASE EXIT)
          ============================================================ */}
      <JobApplicationsModal
        visible={applicationsModalVisible}
        jobId={id}
        jobTitle={job.customTitle || job.title}
        initialApplicants={applicantsList}
        initialApplicantCount={applicantsCount}
        onClose={() => setApplicationsModalVisible(false)}
      />

      {/* ============================================================
          11. WORKER APPLY CONFIRMATION MODAL
          ============================================================ */}
      <Modal
        visible={applyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApplyModalVisible(false)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={styles.applyPromptCard}>
            <View style={styles.applyPromptIconRing}>
              <Ionicons name="send" size={24} color={pro.emeraldPrimary} />
            </View>
            <Text style={styles.applyPromptTitle}>Apply for {roleLabel}?</Text>
            <Text style={styles.applyPromptDesc}>
              Your verified profile, phone number, and trade details will be shared with the client for immediate review.
            </Text>

            <View style={styles.applyPromptBtnRow}>
              <Pressable
                style={styles.applyPromptCancelBtn}
                onPress={() => setApplyModalVisible(false)}
              >
                <Text style={styles.applyPromptCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.applyPromptConfirmBtn}
                onPress={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.applyPromptConfirmText}>Submit Application</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Peak-Level Stylesheet ──
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: pro.canvas,
  },
  stateCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: pro.canvas,
  },
  loadingLabel: {
    marginTop: 14,
    color: pro.slate,
    fontSize: 14,
    fontWeight: "600",
  },
  errorHeading: {
    color: pro.ink,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
  },
  errorSubtext: {
    color: pro.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 270,
  },
  errorBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: pro.emeraldPrimary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 20,
  },
  errorBackBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Executive Navigation Bar ──
  topNav: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: pro.surface,
    borderBottomWidth: 1,
    borderBottomColor: pro.borderLight,
  },
  navRoundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: pro.cardBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: pro.borderLight,
  },
  navCenter: {
    alignItems: "center",
  },
  navTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: pro.ink,
    letterSpacing: -0.2,
  },
  navSerialPill: {
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  navSerialText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: pro.emeraldPrimary,
    letterSpacing: 0.6,
  },

  // ── Toast Notification ──
  toastBox: {
    position: "absolute",
    top: 66,
    left: 18,
    right: 18,
    zIndex: 99,
    backgroundColor: pro.emeraldDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  // ── Scrollable Stage ──
  scrollContainer: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 14,
  },

  // ── Hero Poster Card ──
  heroPosterCard: {
    backgroundColor: pro.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: pro.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: pro.emeraldPrimary,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  liveStatusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tradeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  tradeEmblemBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: pro.emeraldFrost,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: pro.emeraldLight + "50",
  },
  tradeEmblemEmoji: {
    fontSize: 32,
  },
  tradeRoleName: {
    fontSize: 22,
    fontWeight: "900",
    color: pro.ink,
    letterSpacing: -0.4,
  },
  tradeCustomHeadline: {
    fontSize: 14,
    fontWeight: "600",
    color: pro.slate,
    marginTop: 2,
    lineHeight: 20,
  },
  heroCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: pro.borderSubtle,
    paddingTop: 12,
    marginTop: 2,
  },
  metaIconTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaIconText: {
    fontSize: 11.5,
    color: pro.muted,
    fontWeight: "500",
  },
  ownerNoticeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  ownerNoticeTagText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: pro.emeraldPrimary,
  },
  verifiedJobTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  verifiedJobTagText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: pro.emeraldPrimary,
  },

  // ── Compensation Remuneration Card ──
  compGradientCard: {
    borderRadius: 22,
    padding: 20,
    shadowColor: pro.emeraldPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  compHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  compSubtitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#A7F3D0",
  },
  zeroFeePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  zeroFeeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  compAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginVertical: 4,
  },
  compCurrencySign: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  compAmountNumber: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  compUnitLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D1FAE5",
    marginLeft: 5,
  },
  compDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 12,
  },
  compFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payoutTimingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  payoutTimingChipEmoji: {
    fontSize: 13,
  },
  payoutTimingChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  totalBudgetChip: {
    backgroundColor: "rgba(255,255,255,0.20)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalBudgetText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  directEscrowNote: {
    fontSize: 11,
    fontWeight: "500",
    color: "#A7F3D0",
  },

  // ── Key Specifications (Horizontal: Icon Beside Details) ──
  bentoSection: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: "800",
    color: pro.muted,
    letterSpacing: 0.8,
  },
  verifiedSpecsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedSpecsBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: pro.emeraldPrimary,
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  bentoCard: {
    width: (width - 44) / 2,
    backgroundColor: pro.surface,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: pro.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.035,
    shadowRadius: 4,
    elevation: 1.5,
    justifyContent: "space-between",
    minHeight: 112,
  },
  bentoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  bentoIconLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  bentoIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  bentoEmoji: {
    fontSize: 13.5,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: pro.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bentoBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bentoBadgePillText: {
    fontSize: 9,
    fontWeight: "700",
  },
  bentoBody: {
    marginTop: "auto",
  },
  bentoPrimaryVal: {
    fontSize: 15,
    fontWeight: "900",
    color: pro.ink,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  bentoSubVal: {
    fontSize: 11,
    fontWeight: "500",
    color: pro.slate,
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Worksite Location & Google Maps Card ──
  venueCard: {
    backgroundColor: pro.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: pro.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  venueHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  venueIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: pro.emeraldSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  venueHeaderLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: pro.muted,
    letterSpacing: 0.8,
  },
  venueAreaName: {
    fontSize: 15,
    fontWeight: "800",
    color: pro.ink,
    marginTop: 1,
  },
  gpsCoordBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  gpsCoordText: {
    fontSize: 10,
    fontWeight: "700",
    color: pro.emeraldPrimary,
  },

  // Map Wrap (Exact Pinpoint View)
  mapWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: pro.borderLight,
    backgroundColor: "#E2EBE6",
    marginBottom: 12,
  },
  map: {
    width: "100%",
    height: 195,
  },
  mapTopBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: pro.emeraldPrimary,
  },
  mapTopBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: pro.ink,
  },
  mapFooterStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: pro.borderSubtle,
    backgroundColor: "#FAFCFB",
  },
  mapFooterStripText: {
    fontSize: 10.5,
    fontWeight: "500",
    color: pro.muted,
  },

  // Address Box with Clean Nested Spacing
  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: pro.cardBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pro.borderLight,
    marginBottom: 12,
  },
  venueAddressHeader: {
    fontSize: 9.5,
    fontWeight: "800",
    color: pro.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  venueFullAddress: {
    fontSize: 13,
    fontWeight: "600",
    color: pro.ink,
    lineHeight: 18,
  },
  venueAreaSub: {
    fontSize: 11.5,
    fontWeight: "500",
    color: pro.muted,
    marginTop: 2,
  },
  venueActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: pro.emeraldLight + "40",
    flex: 1,
    justifyContent: "center",
  },
  actionPillBtnSecondary: {
    backgroundColor: pro.surface,
    borderColor: pro.borderLight,
  },
  actionPillBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: pro.emeraldPrimary,
  },

  // ── General Section Wraps ──
  sectionWrap: {
    gap: 8,
  },
  perksWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  perkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: pro.surface,
    borderWidth: 1,
    borderColor: pro.emeraldLight + "50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  perkChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: pro.emeraldDark,
  },

  // ── Scope of Work Card ──
  scopeCard: {
    backgroundColor: pro.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: pro.borderLight,
  },
  scopeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  scopeCardTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: pro.emeraldPrimary,
    letterSpacing: 0.4,
  },
  scopeBodyText: {
    fontSize: 14,
    color: pro.charcoal,
    lineHeight: 22,
    fontWeight: "500",
  },

  // ── Employer Card ──
  employerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: pro.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: pro.borderLight,
  },
  employerAvatarSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: pro.emeraldPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  employerAvatarInitial: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  employerSubtitle: {
    fontSize: 9,
    fontWeight: "800",
    color: pro.muted,
    letterSpacing: 0.8,
  },
  employerNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: pro.ink,
    marginTop: 1,
  },
  employerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  employerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: pro.emeraldPrimary,
  },
  directCallButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: pro.emeraldPrimary,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Strategic Command Dock ──
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: pro.surface,
    borderTopWidth: 1,
    borderTopColor: pro.borderLight,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  ownerSideBySideRow: {
    flexDirection: "row",
    gap: 10,
  },
  viewAppsButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: pro.emeraldSoft,
    borderWidth: 1.2,
    borderColor: pro.emeraldLight + "60",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
  },
  viewAppsInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  viewAppsButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: pro.emeraldPrimary,
    letterSpacing: 0.2,
  },
  editJobButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  editGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 7,
  },
  editButtonText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  workerApplyRow: {
    flexDirection: "row",
  },
  applyFullButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  applyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    gap: 8,
  },
  applyFullButtonText: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // ── Applications Bottom Sheet Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  appsSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "82%",
  },
  sheetHandleIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: pro.borderLight,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sheetMainTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: pro.ink,
  },
  sheetSubTitle: {
    fontSize: 12.5,
    color: pro.muted,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: pro.cardBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: pro.borderLight,
  },
  candidatesScrollView: {
    marginBottom: 10,
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: pro.borderSubtle,
  },
  candidateAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: pro.emeraldSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  candidateAvatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: pro.emeraldPrimary,
  },
  candidateNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: pro.ink,
  },
  candidateAreaText: {
    fontSize: 12.5,
    color: pro.slate,
    marginTop: 1,
  },
  candidateAppliedAt: {
    fontSize: 11,
    color: pro.muted,
    marginTop: 2,
  },
  candidateCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: pro.emeraldPrimary,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyApplicantsBox: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyApplicantsRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: pro.emeraldSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyApplicantsTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: pro.ink,
    marginBottom: 6,
  },
  emptyApplicantsDesc: {
    fontSize: 13,
    color: pro.muted,
    textAlign: "center",
    lineHeight: 19,
  },

  // ── Apply Prompt Modal ──
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  applyPromptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  applyPromptIconRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: pro.emeraldSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  applyPromptTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: pro.ink,
    marginBottom: 6,
  },
  applyPromptDesc: {
    fontSize: 13,
    color: pro.slate,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  applyPromptBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  applyPromptCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  applyPromptCancelText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: pro.slate,
  },
  applyPromptConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: pro.emeraldPrimary,
    alignItems: "center",
  },
  applyPromptConfirmText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
