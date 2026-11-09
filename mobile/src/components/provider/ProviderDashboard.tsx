import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  useWindowDimensions,
  Platform,
  RefreshControl,
  AppState,
  Vibration,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { invalidateJobLifecycleQueries } from "../../api/jobLifecycleCache";
import { getNotificationInbox } from "../../api/notifications";
import { useAuth } from "../../auth";
import { useLocation } from "../../store/location";
import { Skeleton } from "../SkeletonLoader";
import { ProviderBottomNav } from "./ProviderBottomNav";
import { dash, radii } from "./palette";

import { ProviderStoryHero } from "./ProviderStoryHero";
import { BulaoWordmark } from "../BulaoWordmark";
import { JobCompletionConfirmationSheet, CompletionInteraction } from "../JobCompletionConfirmationSheet";

type Period = "week" | "month" | "all";

type ProviderStats = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  currentHires?: number;
  completed: number;
  pendingResponses?: number;
  trends?: {
    jobsPosted: number | null;
    interested: number | null;
    hired: number | null;
    active: number | null;
  };
};

type RecentJob = {
  id: string;
  roleId?: string;
  categoryId?: string;
  title: string;
  categoryName: string;
  roleIcon?: string;
  categoryIcon?: string;
  area: string;
  payPaise: number;
  payUnit: string;
  status: string;
  createdAt?: string | number;
  applicantCount: number;
  completedCount?: number;
  workers?: number;
  remainingWorkers?: number;
};

function isCompletedJob(job: RecentJob): boolean {
  const status = (job.status || "").toUpperCase();
  if (status === "COMPLETED" || status === "DELETED") return true;
  const completed = Number(job.completedCount || 0);
  const workers = Number(job.workers || 0);
  if (completed > 0 && workers > 0 && completed >= workers) {
    return true;
  }
  return false;
}

function formatCompletionPay(paise?: number | null, unit?: string | null) {
  if (!paise || paise < 0) return null;
  const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(paise / 100);
  const suffix = unit ? ` / ${unit.toLowerCase()}` : "";
  return `₹${amount}${suffix}`;
}

function pagePad(width: number) {
  if (width < 300) return 12;
  if (width < 360) return 16;
  if (width > 420) return 22;
  return 20;
}

function jobPriority(job: RecentJob) {
  const status = (job.status || "").toUpperCase();
  // Keep recently hired jobs at the top of the small home preview so they
  // remain easy to find for completion and review follow-up.
  if (status === "FILLED") return 0;
  if (status === "PAUSED") return 1;
  if ((job.applicantCount || 0) > 0 && status === "PUBLISHED") return 2;
  if (status === "PUBLISHED") return 3;
  return 4;
}

function statusMeta(job: RecentJob) {
  const status = (job.status || "").toUpperCase();
  if (status === "PAUSED") {
    return { label: "Needs Action", color: dash.error, bg: "#FDECEC" };
  }
  if (status === "PUBLISHED" && (job.applicantCount || 0) > 0) {
    return { label: "Reviewing", color: dash.warning, bg: "#FFF6E8" };
  }
  if (status === "PUBLISHED") {
    return { label: "Active", color: dash.secondary, bg: dash.softGreen };
  }
  if (status === "FILLED") {
    return { label: "Hired", color: "#2F6FED", bg: "#EEF3FF" };
  }
  if (status === "COMPLETED") {
    return { label: "Done", color: dash.muted, bg: "#F1F4F2" };
  }
  if (status === "EXPIRED") {
    return { label: "Expired", color: dash.muted, bg: "#F1F4F2" };
  }
  return { label: status || "Open", color: dash.muted, bg: "#F1F4F2" };
}

function jobThumb(job: RecentJob) {
  const name = `${job.title} ${job.categoryName}`.toLowerCase();
  if (name.includes("clean")) return { bg: "#E8F6EE", icon: "sparkles-outline" as const, color: "#1A7A4A" };
  if (name.includes("cater") || name.includes("cook") || name.includes("food")) {
    return { bg: "#FFF1E4", icon: "restaurant-outline" as const, color: "#C05621" };
  }
  if (name.includes("ac ") || name.includes("repair") || name.includes("electr")) {
    return { bg: "#E8F1FF", icon: "construct-outline" as const, color: "#2B6CB0" };
  }
  if (name.includes("paint")) return { bg: "#FCE7F3", icon: "color-palette-outline" as const, color: "#BE185D" };
  if (name.includes("plumb")) return { bg: "#E0F2FE", icon: "water-outline" as const, color: "#0369A1" };
  if (name.includes("tutor") || name.includes("teach")) {
    return { bg: "#F5F3FF", icon: "book-outline" as const, color: "#6D28D9" };
  }
  return { bg: dash.softGreen, icon: "briefcase-outline" as const, color: dash.primary };
}

function formatJobDate(timestamp?: string | number) {
  if (!timestamp) return "Recent";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp > 1e11
      ? timestamp
      : timestamp * 1000;
  if (!time || isNaN(time)) return "Recent";
  const d = new Date(time);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function SparkWave({ trend }: { trend: number }) {
  const W = 38;
  const H = 14;
  const count = 26;

  // Change graph color based on percentage:
  // Positive (> 0): Vibrant Green
  // Negative (< 0): Alert Red
  // Zero (0): Neutral Slate Gray
  const color = trend > 0 ? "#10B981" : trend < 0 ? "#EF4444" : "#94A3B8";

  return (
    <View style={{ width: W, height: H }}>
      {Array.from({ length: count }, (_, i) => {
        const p = i / (count - 1);
        const wave = Math.sin(p * Math.PI * 2.2);
        // Trend up: rises left-to-right
        // Trend down: falls left-to-right
        // Trend zero: flat steady line
        const base =
          trend > 0
            ? H * 0.65 - p * (H * 0.45)
            : trend < 0
            ? H * 0.25 + p * (H * 0.45)
            : H * 0.5;

        const waveAmp = trend === 0 ? 1.2 : 3.5;
        const y = Math.max(1, Math.min(H - 3, base - wave * waveAmp));
        const x = p * (W - 2.5);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 2.5,
              height: 2.5,
              borderRadius: 1.25,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}

function computeStatTrend(
  metricKey: "posted" | "responses" | "hired" | "completed",
  stats?: ProviderStats
): number {
  if (!stats) return 0;

  // 1. If backend returned historical percentage trend, use it directly
  if (metricKey === "posted" && stats.trends?.jobsPosted != null) {
    return Math.round(stats.trends.jobsPosted);
  }
  if (metricKey === "responses" && stats.trends?.interested != null) {
    return Math.round(stats.trends.interested);
  }
  if (metricKey === "hired" && stats.trends?.hired != null) {
    return Math.round(stats.trends.hired);
  }

  // 2. Real performance calculation based on actual stats
  const posted = stats.jobsPosted || 0;
  const responses = stats.interested || 0;
  const hired = stats.hired || 0;
  const completed = stats.completed || 0;

  switch (metricKey) {
    case "posted": {
      if (posted === 0) return 0;
      const active = stats.active || 0;
      return active > 0 ? Math.min(100, Math.round((active / posted) * 100)) : 0;
    }
    case "responses": {
      if (posted === 0 || responses === 0) return 0;
      const ratio = responses / posted;
      return Math.round((ratio - 1) * 100);
    }
    case "hired": {
      if (posted === 0) return 0;
      return Math.min(100, Math.round((hired / posted) * 100));
    }
    case "completed": {
      if (hired === 0) return completed > 0 ? 100 : 0;
      return Math.min(100, Math.round((completed / hired) * 100));
    }
  }
}

export default function ProviderDashboard() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const pad = pagePad(width);
  const compactText = fontScale > 1.25 || width < 300;
  const twoColumnStats = width < 300 || compactText;
  const brandSize = width < 320 ? 20 : 23;

  const headerHeight = insets.top + 56;
  const heroH = headerHeight + Math.min(width, 440) * 0.63 + 64;
  const [heroVisible, setHeroVisible] = useState(true);
  const auth = useAuth();
  const location = useLocation((s) => s.location);
  const [period, setPeriod] = useState<Period>("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [menuJob, setMenuJob] = useState<RecentJob | null>(null);
  const [headerTint, setHeaderTint] = useState(0);
  const [navVisible, setNavVisible] = useState(true);
  const [completionPrompt, setCompletionPrompt] = useState<CompletionInteraction | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);
  const lastDirection = useRef<"up" | "down">("up");
  const dismissedCompletionIds = useRef(new Set<string>());

  const token = auth.session?.token || null;
  const userId = auth.user?.id || auth.session?.userId || null;
  const client = useQueryClient();

  useEffect(() => {
    dismissedCompletionIds.current.clear();
    setCompletionPrompt(null);
  }, [userId]);

  // AppState awareness: Pause background intervals when app is hidden; immediately sync when resuming
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  const me = useQuery({
    queryKey: ["me", userId || token],
    enabled: !!token,
    queryFn: () =>
      api<{ id: string; name: string; area: string; photoUrl: string | null }>("/users/me"),
  });

  const statsQuery = useQuery<ProviderStats>({
    queryKey: ["provider-stats", userId, period],
    queryFn: () => api<ProviderStats>(`/jobs/provider/stats?period=${period}`),
    enabled: !!token && !!userId,
    staleTime: 30000,
  });

  const jobsQuery = useQuery<RecentJob[]>({
    queryKey: ["provider-recent-jobs", userId],
    queryFn: () => api<RecentJob[]>("/jobs/provider/recent"),
    enabled: !!token && !!userId,
    staleTime: 30000,
  });

  const action = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "pause" | "publish" | "cancel" | "delete" }) => {
      if (next === "delete") {
        return api(`/jobs/${id}`, undefined, "DELETE");
      }
      return api(`/jobs/${id}/action`, { action: next });
    },
    onSuccess: () => {
      setMenuJob(null);
      void invalidateJobLifecycleQueries(client);
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["provider-notifications", userId],
    queryFn: () => getNotificationInbox("provider", "work"),
    enabled: !!token && !!userId,
    staleTime: 30000,
  });

  // The interaction row is authoritative, so stale notification history cannot
  // reopen a completion or review prompt after its state has changed.
  const completionActivityQuery = useQuery({
    queryKey: ["provider-completion-activity", userId],
    queryFn: () => api<{ interactions: CompletionInteraction[] }>("/applications/completion-pending?role=provider"),
    enabled: !!token && !!userId,
    staleTime: 30000,
  });

  // Auto-sync when app resumes from background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const isActive = state === "active";
      setAppActive(isActive);
      if (isActive && token && userId) {
        dismissedCompletionIds.current.clear();
        void Promise.allSettled([
          client.invalidateQueries({ queryKey: ["provider-recent-jobs", userId] }),
          client.invalidateQueries({ queryKey: ["provider-stats", userId] }),
          client.invalidateQueries({ queryKey: ["provider-notifications", userId] }),
          client.invalidateQueries({ queryKey: ["provider-completion-activity", userId] }),
          client.invalidateQueries({ queryKey: ["me"] }),
        ]);
      }
    });
    return () => sub.remove();
  }, [token, userId, client]);

  // Auto-refresh queries only once when screen comes into tab focus
  useFocusEffect(
    useCallback(() => {
      if (!token || !userId) return;
      dismissedCompletionIds.current.clear();
      void Promise.allSettled([
        client.invalidateQueries({ queryKey: ["provider-recent-jobs", userId] }),
        client.invalidateQueries({ queryKey: ["provider-stats", userId] }),
        client.invalidateQueries({ queryKey: ["provider-notifications", userId] }),
        client.invalidateQueries({ queryKey: ["provider-completion-activity", userId] }),
        client.invalidateQueries({ queryKey: ["me"] }),
      ]);
    }, [token, userId, client])
  );

  // Manual pull-to-refresh state and handler (with throttle & haptics)
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (refreshing || !token || !userId) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        client.refetchQueries({ queryKey: ["provider-recent-jobs", userId] }),
        client.refetchQueries({ queryKey: ["provider-stats", userId] }),
        client.refetchQueries({ queryKey: ["provider-notifications", userId] }),
        client.refetchQueries({ queryKey: ["provider-completion-activity", userId] }),
        client.refetchQueries({ queryKey: ["me"] }),
      ]);
      dismissedCompletionIds.current.clear();
      if (Platform.OS === "android") {
        Vibration.vibrate(20);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, token, userId, client]);

  const pendingCompletionPrompts = useMemo(() => {
    const unique = new Map<string, CompletionInteraction>();
    for (const item of completionActivityQuery.data?.interactions || []) {
      if (item.kind !== "job" || item.ownerId !== userId) continue;
      const needsConfirmation = item.status === "IN_PROGRESS" && item.workerConfirmedAt != null && item.ownerConfirmedAt == null;
      const needsReview = item.status === "COMPLETED" && !item.reviewed;
      if ((needsConfirmation || needsReview) && !unique.has(item.id)) unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [completionActivityQuery.data?.interactions, userId]);

  useEffect(() => {
    if (completionPrompt || completionActivityQuery.isFetching) return;
    const next = pendingCompletionPrompts.find((item) => !dismissedCompletionIds.current.has(item.id));
    if (next) setCompletionPrompt(next);
  }, [completionPrompt, pendingCompletionPrompts, completionActivityQuery.isFetching]);

  const dismissCompletionPrompt = useCallback(() => {
    if (completionPrompt) dismissedCompletionIds.current.add(completionPrompt.id);
    setCompletionPrompt(null);
  }, [completionPrompt]);

  const handleConfirmCompletion = useCallback(async (interaction: CompletionInteraction) => {
    try {
      const result = await api<{ status: string }>(`/applications/${encodeURIComponent(interaction.id)}/action`, { action: "confirm" });
      dismissedCompletionIds.current.add(interaction.id);
      await Promise.allSettled([
        invalidateJobLifecycleQueries(client),
        client.invalidateQueries({ queryKey: ["provider-completion-activity"] }),
        client.invalidateQueries({ queryKey: ["provider-notifications"] }),
        client.invalidateQueries({ queryKey: ["connection", interaction.id] }),
      ]);
      return result;
    } catch (error) {
      const latest = await completionActivityQuery.refetch();
      const current = latest.data?.interactions.find((item) => item.id === interaction.id);
      if (current && (current.ownerConfirmedAt != null || current.status === "COMPLETED")) {
        dismissedCompletionIds.current.add(interaction.id);
        void client.invalidateQueries({ queryKey: ["provider-notifications"] });
        return { status: current.status };
      }
      throw error;
    }
  }, [client, completionActivityQuery]);


  const unread = !notificationsQuery.isError && (notificationsQuery.data?.unreadCount ?? 0) > 0;
  const jobsPosted = statsQuery.data?.jobsPosted ?? 0;
  const isNewProvider = !jobsQuery.isLoading && (jobsQuery.data?.length ?? 0) === 0 && jobsPosted === 0;

  const rankedJobs = useMemo(() => {
    const list = (jobsQuery.data || []).filter((job) => !isCompletedJob(job));
    list.sort((a, b) => jobPriority(a) - jobPriority(b));
    return list.slice(0, 3);
  }, [jobsQuery.data]);

  const contentWidth = Math.min(width, 560);
  const sidePad = Math.max(pad, (width - contentWidth) / 2);
  const locationLabel = location?.area || "Choose area";
  const headerRowWidth = width - 2 * sidePad;
  const locationStart = Math.round(brandSize * 3.4) + 8;
  const locationEnd = headerRowWidth - 48;
  const availableLocationWidth = Math.max(84, locationEnd - locationStart);
  const locationPillWidth = Math.min(
    availableLocationWidth,
    Math.min(210, Math.max(96, 84 + Array.from(locationLabel).length * 7)),
  );
  const locationPillLeft = locationStart + Math.max(0, (availableLocationWidth - locationPillWidth) / 2);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[dash.primary, dash.secondary]}
            tintColor={dash.primary}
            progressBackgroundColor={dash.white}
            progressViewOffset={headerHeight + 10}
          />
        }
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderTint(Math.min(1, Math.max(0, y / 90)));
          setHeroVisible(y < heroH - headerHeight);

          // Auto-hide bottom navbar when scrolling down, smooth reveal when scrolling up
          const clampedY = Math.max(0, y);
          const delta = clampedY - lastScrollY.current;
          lastScrollY.current = clampedY;

          if (clampedY < 60) {
            setNavVisible(true);
            scrollAccumulator.current = 0;
          } else if (delta > 0) {
            if (lastDirection.current !== "down") {
              lastDirection.current = "down";
              scrollAccumulator.current = 0;
            }
            scrollAccumulator.current += delta;
            if (scrollAccumulator.current > 38) {
              setNavVisible(false);
            }
          } else if (delta < 0) {
            if (lastDirection.current !== "up") {
              lastDirection.current = "up";
              scrollAccumulator.current = 0;
            }
            scrollAccumulator.current += Math.abs(delta);
            if (scrollAccumulator.current > 22) {
              setNavVisible(true);
            }
          }
        }}
        contentContainerStyle={{
          paddingBottom: 118 + Math.max(insets.bottom, 8),
        }}
      >
        <ProviderStoryHero width={width} height={heroH} headerHeight={headerHeight} visible={heroVisible} />

        <View style={{ paddingHorizontal: sidePad, marginTop: -64, elevation: 3, zIndex: 3, alignItems: "center" }}>
          <PostJobCTA />
        </View>

        <View style={{ paddingHorizontal: sidePad, marginTop: 10 }}>
          <OverviewSection
            stats={statsQuery.data}
            loading={statsQuery.isLoading}
            error={statsQuery.isError}
            period={period}
            onOpenPeriod={() => setPeriodOpen(true)}
            compactText={compactText}
            twoColumnStats={twoColumnStats}
          />
        </View>

        <View style={[styles.recentJobsSection, { paddingHorizontal: sidePad }]}>
          <RecentJobs
            loading={jobsQuery.isLoading}
            error={jobsQuery.isError}
            jobs={rankedJobs}
            isNewProvider={isNewProvider}
            onOpenMenu={setMenuJob}
            compactText={compactText}
          />
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {headerTint > 0.08 ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(248,250,247,${0.55 + headerTint * 0.38})` },
            ]}
          />
        ) : null}

        <View style={[styles.headerRow, { marginHorizontal: sidePad }]}>
          <View style={styles.headerLeft}>
          <BulaoWordmark size={brandSize} color="#03402D" align="flex-start" />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose service area: ${location?.area || "Choose area"}`}
            accessibilityHint="Opens the work area selector"
            onPress={() => useLocation.getState().setLocationSheetVisible(true)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(7, 91, 67, 0.12)" }}
            style={[styles.providerLocationPill, { width: locationPillWidth, left: locationPillLeft }]}
          >
            <BlurView
              intensity={Platform.OS === "android" ? 10 : 20}
              tint="light"
              style={styles.providerLocationBlur}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={styles.providerLocationGlassTint} />
            <View style={styles.providerLocationPinBadge}>
              <Ionicons name="location-sharp" size={14} color={dash.primary} />
            </View>
            <Text style={styles.providerLocationText} numberOfLines={1} ellipsizeMode="tail">
              {locationLabel}
            </Text>
            <View style={styles.providerLocationChevronBadge}>
              <Ionicons name="chevron-down" size={11} color={dash.primary} />
            </View>
          </Pressable>

          {/* Notifications stay at the right edge; profile lives in the bottom nav. */}
          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push({ pathname: "/notifications", params: { role: "provider" } })}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={dash.ink} />
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          </View>
        </View>
      </View>

      <ProviderBottomNav active="home" visible={navVisible} />

      <JobCompletionConfirmationSheet
        visible={!!completionPrompt}
        interaction={completionPrompt}
        isOwner={true}
        onClose={dismissCompletionPrompt}
        onReviewJob={(item) => {
          if (item.id) router.push(`/requests/${item.id}`);
        }}
        onConfirm={handleConfirmCompletion}
      />

      <PeriodSheet
        visible={periodOpen}
        current={period}
        onClose={() => setPeriodOpen(false)}
        onSelect={(next) => {
          setPeriod(next);
          setPeriodOpen(false);
        }}
      />

      <JobMenu
        job={menuJob}
        busy={action.isPending}
        onClose={() => setMenuJob(null)}
        onView={() => {
          if (!menuJob) return;
          setMenuJob(null);
          router.push(`/jobs/${menuJob.id}`);
        }}
        onResponses={() => {
          setMenuJob(null);
          router.push("/activity");
        }}
        onPause={() => menuJob && action.mutate({ id: menuJob.id, next: "pause" })}
        onResume={() => menuJob && action.mutate({ id: menuJob.id, next: "publish" })}
        onCloseJob={() => menuJob && action.mutate({ id: menuJob.id, next: "cancel" })}
        onDeleteJob={() => {
          if (!menuJob) return;
          const target = menuJob;
          Alert.alert(
            "Delete Job?",
            "This closes the listing and cancels outstanding applications. Completed work, reviews, and lifetime totals stay in your history.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => action.mutate({ id: target.id, next: "delete" }),
              },
            ]
          );
        }}
      />
    </View>
  );
}

function PostJobCTA() {
  const compact = useWindowDimensions().width < 360;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Post a new job"
      accessibilityHint="Opens the job posting form"
      onPress={() => router.push("/post-work")}
      style={({ pressed }) => [
        styles.ctaOuter,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <View style={[styles.cta, compact && styles.ctaCompact]}>
        <View style={[styles.ctaIcon, compact && styles.ctaIconCompact]}>
          <Ionicons name="paper-plane-outline" size={compact ? 21 : 23} color="#FFFFFF" />
        </View>
        <View style={[styles.ctaTextWrap, compact && styles.ctaTextWrapCompact]}>
          <Text style={styles.ctaTitle} adjustsFontSizeToFit minimumFontScale={0.85}>Post a New Job</Text>
          <Text style={styles.ctaSub} adjustsFontSizeToFit minimumFontScale={0.8}>It takes less than 2 minutes</Text>
        </View>
        <View style={[styles.ctaArrow, compact && styles.ctaArrowCompact]}>
          <Ionicons name="arrow-forward" size={19} color="#03402D" />
        </View>
      </View>
    </Pressable>
  );
}

function OverviewSection({
  stats,
  loading,
  error,
  period,
  onOpenPeriod,
  compactText,
  twoColumnStats,
}: {
  stats?: ProviderStats;
  loading: boolean;
  error: boolean;
  period: Period;
  onOpenPeriod: () => void;
  compactText: boolean;
  twoColumnStats: boolean;
}) {
  const periodLabel = period === "week" ? "This Week" : period === "all" ? "All time" : "This Month";
  const cards = [
    {
      key: "posted" as const,
      label: "Active Jobs",
      value: stats?.active ?? 0,
      bg: "#F0F7F2",
      borderColor: "#DCEBE0",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "document-text" as const,
      iconColor: "#087653",
      filter: "active",
    },
    {
      key: "responses" as const,
      label: "Responses",
      value: stats?.interested ?? 0,
      bg: "#F0F7F2",
      borderColor: "#DCEBE0",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "people" as const,
      iconColor: "#087653",
      filter: "interested",
    },
    {
      key: "hired" as const,
      label: "Hired",
      value: stats?.hired ?? 0,
      bg: "#F0F7F2",
      borderColor: "#DCEBE0",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "person" as const,
      iconColor: "#087653",
      filter: "hired",
    },
    {
      key: "completed" as const,
      label: "Completed",
      value: stats?.completed ?? 0,
      bg: "#F0F7F2",
      borderColor: "#DCEBE0",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "checkmark" as const,
      iconColor: "#087653",
      filter: "completed",
    },
  ];

  return (
    <View>
      <View style={[styles.sectionHead, compactText && styles.sectionHeadCompact]}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
        </View>
        <Pressable
          onPress={onOpenPeriod}
          style={styles.periodBtn}
          accessibilityRole="button"
          accessibilityLabel={`Overview period: ${periodLabel}`}
          accessibilityHint="Choose which period to show"
        >
          <Text style={styles.periodText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={13} color={dash.muted} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={22} color={dash.error} />
          <Text style={styles.errorText}>Couldn't load overview</Text>
        </View>
      ) : loading ? (
        <View style={[styles.statsRow, twoColumnStats && styles.statsRowAccessible]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.statCard, twoColumnStats && styles.statCardAccessible, { backgroundColor: dash.white, borderColor: dash.border }]}>
              <View style={[styles.iconBadge, { backgroundColor: "#F3F4F6", borderColor: "#FFFFFF" }]}>
                <Skeleton width={16} height={16} borderRadius={8} />
              </View>
              <Skeleton width={28} height={20} borderRadius={6} style={{ marginBottom: 4 }} />
              <Skeleton width="80%" height={10} borderRadius={4} />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.statsRow, twoColumnStats && styles.statsRowAccessible]}>
          {cards.map((card) => {
            return (
              <View
                key={card.key}
                style={[
                  styles.statCard,
                  twoColumnStats && styles.statCardAccessible,
                  {
                    backgroundColor: card.bg,
                    borderColor: card.borderColor,
                  },
                ]}
              >
                {/* Floating Icon badge at top-left corner */}
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: card.iconBg,
                      borderColor: "#FFFFFF",
                      shadowColor: card.haloColor,
                    },
                  ]}
                >
                  <Ionicons name={card.icon} size={15} color={card.iconColor} />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${card.value} ${card.label}`}
                  onPress={() => router.push(`/activity?filter=${card.filter}`)}
                  style={({ pressed }) => [
                    styles.statCardInner,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {/* Value */}
                  <Text style={styles.statValue}>{card.value}</Text>

                  {/* Label */}
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {card.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function RecentJobs({
  loading,
  error,
  jobs,
  isNewProvider,
  onOpenMenu,
  compactText,
}: {
  loading: boolean;
  error: boolean;
  jobs: RecentJob[];
  isNewProvider: boolean;
  onOpenMenu: (job: RecentJob) => void;
  compactText: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const wrapMeta = compact || compactText;
  const titleFontSize = Math.max(13, Math.min(15, width / 28));

  return (
    <View style={styles.recentJobsContainer}>
      <View style={[styles.sectionHead, compactText && styles.sectionHeadCompact]}>
        <Text style={styles.sectionTitle}>Recent Jobs</Text>
        <Pressable onPress={() => router.push({ pathname: "/activity", params: { type: "job" } })} style={styles.seeAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="arrow-forward" size={14} color={dash.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.jobList}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.jobCard, compact && styles.jobCardCompact]}>
              <View style={styles.jobHeaderRow}>
                <View style={[styles.jobIdentity, compact && styles.jobIdentityCompact]}>
                  <Skeleton width={48} height={48} borderRadius={15} />
                </View>
                <View style={styles.centerDetails}>
                  <Skeleton width="94%" height={36} borderRadius={5} />
                </View>
                <Skeleton width={20} height={20} borderRadius={10} />
              </View>
              <View style={styles.jobMetaGrid}>
                <Skeleton width="40%" height={24} borderRadius={9} />
                <Skeleton width="22%" height={24} borderRadius={9} />
                <Skeleton width="32%" height={24} borderRadius={9} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={22} color={dash.error} />
          <Text style={styles.errorText}>Couldn’t load jobs</Text>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf-outline" size={26} color={dash.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {isNewProvider ? "Your work starts here." : "No active jobs."}
          </Text>
          <Text style={styles.emptyCopy}>
            {isNewProvider
              ? "Post your first job and find trusted people nearby."
              : "All previous jobs are completed. Post a new job whenever you need help."}
          </Text>
          <Pressable onPress={() => router.push("/post-work")} style={styles.emptyCta}>
            <Ionicons name="add" size={18} color={dash.white} />
            <Text style={styles.emptyCtaText}>Post a Job</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.jobList}>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} compact={compact} wrapMeta={wrapMeta} titleFontSize={titleFontSize} onMenu={() => onOpenMenu(job)} />
          ))}
        </View>
      )}
    </View>
  );
}

function JobRow({ job, compact, wrapMeta, titleFontSize, onMenu }: { job: RecentJob; compact: boolean; wrapMeta: boolean; titleFontSize: number; onMenu: () => void }) {
  const thumb = jobThumb(job);
  const area = (job.area || "Himayathnagar").split(",")[0]?.trim() || "Himayathnagar";
  const applications = job.applicantCount ?? 0;
  const dateStr = formatJobDate(job.createdAt);
  const categoryTitle = job.categoryName || "General";

  // Smart icon selection: Role icon > Category icon > Fallback
  const displayIcon = job.roleIcon || job.categoryIcon || "🏫";

  const status = statusMeta(job);
  const isActive = (job.status || "").toUpperCase() === "PUBLISHED";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/jobs/${job.id}`)}
      onLongPress={onMenu}
      accessibilityLabel={`${job.title}, ${categoryTitle}, ${area}, posted ${dateStr}, ${applications} ${applications === 1 ? "application" : "applications"}`}
      style={styles.jobPressable}
    >
      <View style={[styles.jobCard, compact && styles.jobCardCompact]}>
        <View style={styles.jobHeaderRow}>
          <View style={[styles.jobIdentity, compact && styles.jobIdentityCompact]}>
            <View style={[styles.iconBox, { backgroundColor: thumb.bg }]}>
              {job.roleIcon || job.categoryIcon ? (
                <Text style={styles.iconEmoji}>{displayIcon}</Text>
              ) : (
                <Ionicons name={thumb.icon} size={24} color={thumb.color} />
              )}
            </View>
          </View>

          <View style={styles.centerDetails}>
            <View style={styles.jobTitleRow}>
              <Text style={[styles.jobTitle, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.35) }]}>{job.title}</Text>
            </View>
          </View>

          <Ionicons name="arrow-forward" size={20} color="#10563F" style={styles.jobArrow} />
        </View>

        <View style={[styles.jobMetaGrid, wrapMeta && styles.jobMetaGridCompact]}>
          <View style={[styles.metaCell, styles.metaLocation, wrapMeta && styles.metaLocationCompact]}>
            <Ionicons name="location-sharp" size={14} color="#737D76" />
            <Text style={[styles.metaAreaText, compact && styles.metaTextCompact]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.8}>{area}</Text>
          </View>
          <View style={[styles.metaCell, styles.metaDate]}>
            <Ionicons name="calendar-outline" size={14} color="#737D76" />
            <Text style={[styles.metaDateText, compact && styles.metaTextCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{dateStr}</Text>
          </View>

          <View style={[styles.metaCell, styles.applicationMeta, compact && styles.applicationMetaCompact]}>
            <Ionicons name="people-outline" size={14} color="#10563F" />
            <Text style={[styles.applicationMetaText, compact && styles.applicationMetaTextCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {applications} {applications === 1 ? "Application" : "Applications"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PeriodSheet({
  visible,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: Period;
  onClose: () => void;
  onSelect: (period: Period) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Overview period</Text>
          {(
            [
              ["month", "This Month"],
              ["week", "This Week"],
              ["all", "All time"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => onSelect(id)}
              style={[styles.sheetRow, current === id && styles.sheetRowActive]}
            >
              <Text style={[styles.sheetRowText, current === id && { color: dash.primary }]}>
                {label}
              </Text>
              {current === id ? <Ionicons name="checkmark" size={18} color={dash.primary} /> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function JobMenu({
  job,
  busy,
  onClose,
  onView,
  onResponses,
  onPause,
  onResume,
  onCloseJob,
  onDeleteJob,
}: {
  job: RecentJob | null;
  busy: boolean;
  onClose: () => void;
  onView: () => void;
  onResponses: () => void;
  onPause: () => void;
  onResume: () => void;
  onCloseJob: () => void;
  onDeleteJob: () => void;
}) {
  const status = (job?.status || "").toUpperCase();
  return (
    <Modal visible={!!job} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {job?.title}
          </Text>
          <MenuRow icon="eye-outline" label="View Job" onPress={onView} />
          <MenuRow icon="chatbubbles-outline" label="View Responses" onPress={onResponses} />
          {status === "PUBLISHED" ? (
            <MenuRow icon="pause-circle-outline" label="Pause Job" onPress={onPause} disabled={busy} />
          ) : null}
          {status === "PAUSED" ? (
            <MenuRow icon="play-circle-outline" label="Resume Job" onPress={onResume} disabled={busy} />
          ) : null}
          {status === "PUBLISHED" || status === "PAUSED" || status === "FILLED" ? (
            <MenuRow icon="close-circle-outline" label="Close Job" onPress={onCloseJob} disabled={busy} />
          ) : null}
          <MenuRow icon="trash-outline" label="Delete Job" onPress={onDeleteJob} danger disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.sheetRow}>
      <Ionicons name={icon} size={18} color={danger ? dash.error : dash.ink} />
      <Text style={[styles.sheetRowText, danger && { color: dash.error }, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dash.bg,
  },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    left: 0,
    top: 0,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 8,
  },
  headerRow: {
    position: "relative",
    height: 44,
    alignItems: "center",
  },
  headerLeft: { position: "absolute", left: 0, top: 0, bottom: 0, justifyContent: "center", zIndex: 2 },
  providerLocationPill: {
    position: "absolute",
    left: "50%",
    top: 2,
    zIndex: 1,
    height: 40,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingHorizontal: 11,
    gap: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.35,
    borderColor: "rgba(255, 255, 255, 0.42)",
  },
  providerLocationBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
  providerLocationGlassTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  providerLocationPinBadge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  providerLocationText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "800",
    color: "#123A2B",
    includeFontPadding: false,
  },
  providerLocationChevronBadge: {
    width: 21,
    height: 21,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  tagline: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "600",
    color: "#03402D",
    letterSpacing: 0.2,
  },
  headerRight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E24B4B",
    borderWidth: 1,
    borderColor: "#fff",
  },
  ctaOuter: {
    alignSelf: "center",
    maxWidth: "100%",
    borderRadius: 999,
    padding: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.75)",
    shadowColor: "#03402D",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#03402D",
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 10,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaCompact: {
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  ctaIconCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  ctaTextWrap: {
    minWidth: 0,
    flexShrink: 1,
    marginHorizontal: 14,
  },
  ctaTextWrapCompact: {
    marginHorizontal: 10,
  },
  ctaTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.25,
    flexShrink: 1,
  },
  ctaSub: {
    marginTop: 1,
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
  ctaArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  ctaArrowCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeadCompact: {
    flexWrap: "wrap",
    rowGap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B3524",
    letterSpacing: -0.35,
    lineHeight: 26,
    includeFontPadding: false,
  },
  periodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "#F4F8F5",
    borderWidth: 1,
    borderColor: "#DFEAE2",
  },
  periodText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: "#234536",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    overflow: "visible",
  },
  statsRowAccessible: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 17,
    borderWidth: 1,
    overflow: "visible",
    paddingTop: 22,
    paddingBottom: 11,
    paddingHorizontal: 9,
    minHeight: 88,
    justifyContent: "center",
    shadowColor: "#123D2D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 5,
    elevation: 1,
  },
  statCardAccessible: {
    flexBasis: "47%",
    flexGrow: 0,
    minHeight: 96,
    paddingHorizontal: 12,
  },
  statCardInner: {
    flex: 1,
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    top: -14,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 2,
  },
  statValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#10291F",
    letterSpacing: -0.55,
    lineHeight: 27,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    marginTop: 3,
    lineHeight: 13,
    includeFontPadding: false,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: dash.primary,
  },
  recentJobsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  recentJobsContainer: {
    width: "100%",
  },
  jobList: {
    gap: 12,
  },
  jobPressable: {
    width: "100%",
    alignSelf: "stretch",
  },
  jobCard: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 96,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBE6",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 9,
    shadowColor: "#173D2D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 7,
    elevation: 1,
  },
  jobCardCompact: {
    paddingHorizontal: 8,
    gap: 4,
  },
  jobHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 6,
  },
  jobIdentity: {
    width: 56,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  jobIdentityCompact: {
    width: 52,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  centerDetails: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 5,
  },
  jobTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    minWidth: 0,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  jobMetaGrid: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  jobMetaGridCompact: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metaCell: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 5,
    borderWidth: 1,
    borderColor: "#E8EEE9",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
  },
  metaLocation: {
    flex: 1,
    minWidth: 0,
  },
  metaLocationCompact: {
    flexBasis: "100%",
  },
  metaDate: {
    flexShrink: 0,
  },
  applicationMeta: {
    flexShrink: 0,
    backgroundColor: "#EAF4EE",
    borderColor: "#D9E9DF",
  },
  applicationMetaCompact: {
    gap: 3,
    paddingHorizontal: 4,
  },
  applicationMetaText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
    color: "#10563F",
    flexShrink: 1,
    minWidth: 0,
  },
  applicationMetaTextCompact: {
    fontSize: 9.5,
  },
  jobArrow: {
    flexShrink: 0,
    alignSelf: "center",
  },
  metaAreaText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#737D76",
    flexShrink: 1,
    minWidth: 0,
  },
  metaDateText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#737D76",
    flexShrink: 0,
  },
  metaTextCompact: {
    fontSize: 10,
  },
  jobTitle: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    width: 0,
    minWidth: 0,
    fontWeight: "700",
    color: "#1D3028",
    letterSpacing: -0.15,
    includeFontPadding: false,
  },
  emptyCard: {
    backgroundColor: dash.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: dash.border,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: dash.softGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  emptyCopy: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: dash.muted,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyCta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: dash.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: dash.white,
    fontWeight: "800",
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: dash.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "#F8D4D4",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: dash.ink,
    fontWeight: "600",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,42,42,0.28)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: dash.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    gap: 4,
    shadowColor: "#173A2D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 18,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: dash.ink,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  sheetRowActive: {
    backgroundColor: dash.softGreen,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: "600",
    color: dash.ink,
  },
});
