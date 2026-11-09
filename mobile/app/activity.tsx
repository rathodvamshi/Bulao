import { AppPressable as Pressable } from "../src/components/AppPressable";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  Linking,
  Platform,
  Animated,
  LayoutAnimation,
  Easing,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { invalidateJobLifecycleQueries } from "../src/api/jobLifecycleCache";
import { getExactRoleIcon } from "../src/utils/nameVerification";
import { ProviderBottomNav } from "../src/components/provider/ProviderBottomNav";
import { dash } from "../src/components/provider/palette";
import { ActivityJobSkeleton } from "../src/components/SkeletonLoader";
import { useJobsNotification } from "../src/store/jobsNotification";
import { JobApplicationsModal } from "../src/components/JobApplicationsModal";
import { JobCompletionConfirmationSheet, type CompletionInteraction } from "../src/components/JobCompletionConfirmationSheet";

type Applicant = {
  id: string;
  name: string;
  photoUrl?: string | null;
  phone?: string | null;
  message?: string;
  appliedAt?: number;
};

type Job = {
  id: string;
  roleId?: string;
  categoryId?: string;
  title: string;
  categoryName: string;
  area: string;
  payPaise: number;
  payUnit: string;
  status: string;
  workers?: number;
  experience?: string;
  duration?: string;
  hours?: string;
  extras?: string[] | string;
  details?: string;
  applicantCount: number;
  createdAt?: number | string;
  startsAt?: number;
  applicants?: Applicant[];
  workAwaitingProviderCount?: number;
  workAwaitingSeekerCount?: number;
  completedCount?: number;
  acceptedCount?: number;
  remainingWorkers?: number;
  lastCompletedAt?: number;
};



export function isJobCompleted(job: {
  status?: string;
  completedCount?: number;
  remainingWorkers?: number;
  workers?: number;
}): boolean {
  const status = (job.status || "").toUpperCase();
  if (status === "COMPLETED" || status === "EXPIRED" || status === "DELETED") return true;
  const completed = Number(job.completedCount || 0);
  if (completed > 0) {
    const remaining = Number(
      job.remainingWorkers ?? Math.max(0, Number(job.workers || 1) - completed),
    );
    if (remaining === 0 || completed >= Number(job.workers || 1)) return true;
  }
  return false;
}

function hasCompletedWork(job: Job): boolean {
  return isJobCompleted(job);
}

function getJobAttributeTags(job: Job): { label: string; icon: keyof typeof Ionicons.glyphMap }[] {
  const tags: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];
  const genderMatch = job.details?.match(/gender preference:\s*(male|female|any gender)/i);
  const gender = genderMatch?.[1]?.toLowerCase();
  tags.push(
    {
      label:
        gender === "male"
          ? "Male"
          : gender === "female"
          ? "Female"
          : gender === "any gender"
          ? "Any gender"
          : "Gender not set",
      icon: "person-outline",
    },
  );

  if ((job.workers || 0) > 0) {
    tags.push({
      label: `${job.workers} ${job.workers === 1 ? "worker" : "workers"}`,
      icon: "people-outline",
    });
  }
  const experience = (job.experience || "").toLowerCase();
  if (experience === "some") tags.push({ label: "Some experience", icon: "ribbon-outline" });
  else if (experience === "expert") tags.push({ label: "Experienced", icon: "ribbon-outline" });

  let extras: string[] = [];
  if (Array.isArray(job.extras)) extras = job.extras;
  else if (typeof job.extras === "string") {
    try {
      const parsed = JSON.parse(job.extras);
      if (Array.isArray(parsed)) extras = parsed.filter((item) => typeof item === "string");
    } catch {
      extras = [];
    }
  }
  for (const extra of extras) {
    if (tags.length >= 3) break;
    const label = extra.trim();
    if (label && !tags.some((tag) => tag.label.toLowerCase() === label.toLowerCase())) {
      tags.push({ label, icon: "sparkles-outline" });
    }
  }

  return tags.slice(0, 3);
}

function getJobTypeLabel(job: Job): string {
  const duration = (job.duration || "").toLowerCase();
  if (duration === "ongoing") return "Ongoing";
  if (duration === "few") return "Fixed term";
  if ((job.hours || "").toLowerCase() === "custom") return "Flexible hours";
  return "One-time";
}

const AVATAR_PALETTES = [
  { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  { bg: "#FCE7F3", text: "#BE185D", border: "#FBCFE8" },
  { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" },
  { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
];

function formatPayUnit(unit?: string): string {
  if (!unit) return "fixed";
  switch (unit.toUpperCase()) {
    case "HOUR":
      return "hr";
    case "DAY":
      return "day";
    case "MONTH":
      return "mo";
    case "FIXED":
      return "fixed";
    default:
      return unit.toLowerCase();
  }
}

function formatPostedDate(timestamp?: string | number): string {
  if (!timestamp) return "";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp * (timestamp < 1e11 ? 1000 : 1);
  if (isNaN(time)) return "";
  return new Date(time).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function getRoleTheme(roleId?: string, roleName?: string, categoryId?: string) {
  const name = (roleName || "").toLowerCase();
  const cat = (categoryId || "").toLowerCase();
  const rId = (roleId || "").toLowerCase();

  if (
    name.includes("electr") ||
    name.includes("wire") ||
    rId.includes("electr")
  ) {
    return { bg: "#FEF3C7", border: "#FDE68A", icon: "⚡" };
  }
  if (
    name.includes("plumb") ||
    name.includes("pipe") ||
    rId.includes("plumb")
  ) {
    return { bg: "#E0F2FE", border: "#BAE6FD", icon: "🔧" };
  }
  if (
    name.includes("carpent") ||
    name.includes("wood") ||
    rId.includes("carpent")
  ) {
    return { bg: "#FFEDD5", border: "#FED7AA", icon: "🪚" };
  }
  if (
    name.includes("cook") ||
    name.includes("chef") ||
    cat.includes("food") ||
    rId.includes("cook")
  ) {
    return { bg: "#FFF7ED", border: "#FFEDD5", icon: "🍳" };
  }
  if (name.includes("paint") || rId.includes("paint")) {
    return { bg: "#FCE7F3", border: "#FBCFE8", icon: "🎨" };
  }
  if (
    name.includes("clean") ||
    name.includes("maid") ||
    name.includes("housekeep") ||
    rId.includes("clean")
  ) {
    return { bg: "#E8F5EE", border: "#C8E87A", icon: "🧹" };
  }
  if (
    name.includes("mason") ||
    name.includes("brick") ||
    cat.includes("construction") ||
    rId.includes("mason")
  ) {
    return { bg: "#F5F5F4", border: "#E7E5E4", icon: "🏗️" };
  }
  if (
    name.includes("driv") ||
    name.includes("cab") ||
    name.includes("ride") ||
    cat.includes("transport") ||
    rId.includes("driver")
  ) {
    return { bg: "#CFFAFE", border: "#A5F3FC", icon: "🚗" };
  }
  if (
    name.includes("guard") ||
    name.includes("secur") ||
    rId.includes("guard")
  ) {
    return { bg: "#EDE9FE", border: "#DDD6FE", icon: "🛡️" };
  }
  return {
    bg: "#ECFDF5",
    border: "#C8E87A",
    icon: getExactRoleIcon(roleId || "", roleName || "", categoryId),
  };
}

function SmoothPausedBanner({ isPaused }: { isPaused: boolean }) {
  const anim = useRef(new Animated.Value(isPaused ? 1 : 0)).current;
  const [rendered, setRendered] = useState(isPaused);

  useEffect(() => {
    if (isPaused) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setRendered(false);
        }
      });
    }
  }, [isPaused, anim]);

  if (!rendered && !isPaused) return null;

  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 48],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.4, 1],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Animated.View
      style={{
        maxHeight,
        opacity,
        overflow: "hidden",
        transform: [{ translateY }],
        width: "100%",
      }}
    >
      <View style={styles.pausedNoticeBar}>
        <View style={styles.pausedNoticeLeft}>
          <Ionicons name="pause-circle" size={15} color="#D97706" />
          <Text style={styles.pausedNoticeText}>
            Posting stopped • Not visible to workers
          </Text>
        </View>
        <View style={styles.pausedBadge}>
          <Text style={styles.pausedBadgeText}>STOPPED</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string; jobId?: string; completionInteractionId?: string }>();
  const completionInteractionId = params.completionInteractionId;
  const [selectedFilter, setSelectedFilter] = useState<string>(
    (params.filter === "history" ? "completed" : (params.filter || "active")),
  );

  useEffect(() => {
    if (params.filter) {
      setSelectedFilter(params.filter === "history" ? "completed" : params.filter);
    }
  }, [params.filter]);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [jobToPause, setJobToPause] = useState<Job | null>(null);
  const [jobToComplete, setJobToComplete] = useState<Job | null>(null);
  const [applicationsJob, setApplicationsJob] = useState<Job | null>(null);
  const [feedbackInteraction, setFeedbackInteraction] = useState<CompletionInteraction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);
  const lastDirection = useRef<"up" | "down">("up");
  const openedNotificationJobId = useRef<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const client = useQueryClient();
  const auth = useAuth();
  const token = auth.session?.token || null;
  const userId = auth.user?.id || auth.session?.userId || null;
  const feedbackInteractionQuery = useQuery({
    queryKey: ["provider-completion-feedback", userId, completionInteractionId],
    enabled: Boolean(token && userId && completionInteractionId),
    queryFn: () => api<{
      id: string;
      kind: string;
      jobId: string | null;
      title: string;
      status: string;
      area?: string | null;
      otherName?: string;
      isOwner?: boolean;
      scheduledAt?: number | null;
      jobOverview?: { payPaise?: number | null; payUnit?: string | null } | null;
    }>(`/interactions/${encodeURIComponent(completionInteractionId!)}`),
  });
  const openedFeedbackNotificationId = useRef<string | null>(null);

  useEffect(() => {
    const detail = feedbackInteractionQuery.data;
    const id = completionInteractionId;
    if (!id || !detail || detail.id !== id || openedFeedbackNotificationId.current === id) return;
    openedFeedbackNotificationId.current = id;
    setFeedbackInteraction({
      id: detail.id,
      kind: detail.kind,
      jobId: detail.jobId,
      status: detail.status,
      title: detail.title,
      area: detail.area || "",
      otherName: detail.otherName || "Worker",
      startsAt: detail.scheduledAt,
      payPaise: detail.jobOverview?.payPaise,
      payUnit: detail.jobOverview?.payUnit,
    });
  }, [completionInteractionId, feedbackInteractionQuery.data]);

  const { getAdjustedWorkers } = useJobsNotification();

  const showToast = useCallback(
    (msg: string) => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setToastMessage(msg);
      toastAnim.setValue(0);
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 6.5,
        tension: 50,
        useNativeDriver: true,
      }).start();

      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setToastMessage(null);
          }
        });
      }, 2600);
    },
    [toastAnim],
  );

  const [historyLimit, setHistoryLimit] = useState(15);
  const [hiddenHistoryJobIds, setHiddenHistoryJobIds] = useState<Set<string>>(new Set());

  const {
    data: jobs,
    isLoading: isJobsLoading,
    error: jobsError,
    refetch: refetchJobs,
    isRefetching: isJobsRefetching,
  } = useQuery<Job[]>({
    queryKey: ["provider-recent-jobs", userId],
    queryFn: () => api<Job[]>("/jobs/provider/recent"),
    enabled: !!token && !!userId,
  });

  const isHistorySelected = selectedFilter === "completed" || selectedFilter === "history";

  const historyQuery = useQuery<{
    items: Job[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["provider-job-history", userId, historyLimit],
    queryFn: () =>
      api<{ items: Job[]; total: number; hasMore: boolean }>(
        `/jobs/provider/history?limit=${historyLimit}&offset=0`,
      ),
    enabled: !!token && !!userId && isHistorySelected,
  });

  const refetch = useCallback(async () => {
    await refetchJobs();
    if (isHistorySelected) {
      await historyQuery.refetch();
    }
  }, [refetchJobs, isHistorySelected, historyQuery]);

  const isRefetching = isJobsRefetching || (isHistorySelected && historyQuery.isRefetching);

  const notificationJobQuery = useQuery<Job>({
    queryKey: ["job-rating-queue", userId, params.jobId],
    enabled: Boolean(
      !!token &&
      !!userId &&
      params.jobId &&
      !isJobsLoading &&
      !jobs?.some((job) => job.id === params.jobId)
    ),
    queryFn: () => api<Job>(`/jobs/${encodeURIComponent(params.jobId!)}`),
  });

  useEffect(() => {
    const jobId = params.jobId;
    if (!jobId || (openedNotificationJobId.current === jobId && applicationsJob?.id === jobId)) return;
    if (notificationJobQuery.isError) {
      showToast("This job was deleted and is no longer available.");
      openedNotificationJobId.current = jobId;
      router.setParams({ jobId: undefined });
      return;
    }
    const job = jobs?.find((item) => item.id === jobId) || notificationJobQuery.data;
    if (!job) return;
    if (job.status === "DELETED") {
      showToast("This job was deleted and is no longer available.");
      openedNotificationJobId.current = jobId;
      router.setParams({ jobId: undefined });
      return;
    }
    openedNotificationJobId.current = jobId;
    setSelectedFilter("hired");
    setApplicationsJob(job);
    router.setParams({ jobId: undefined });
  }, [params.jobId, jobs, notificationJobQuery.data, notificationJobQuery.isError, applicationsJob?.id, isJobsLoading]);


  const mergedHistoryJobs = useMemo<Job[]>(() => {
    // When historyQuery has loaded, its items are the authoritative backend source.
    const rawList = historyQuery.data?.items ?? (jobs || []).filter((job) => isJobCompleted(job));
    const list = rawList.filter((job) => !hiddenHistoryJobIds.has(job.id));
    list.sort((a, b) => {
      const timeA = Number(a.lastCompletedAt || a.createdAt || 0);
      const timeB = Number(b.lastCompletedAt || b.createdAt || 0);
      return timeB - timeA;
    });
    return list;
  }, [historyQuery.data?.items, jobs, hiddenHistoryJobIds]);

  const counts = useMemo(() => {
    if (!jobs)
      return {
        active: 0,
        interested: 0,
        hired: 0,
        completed: 0,
        total: 0,
        live: 0,
        paused: 0,
      };

    const activeList = jobs.filter((job) => !isJobCompleted(job));
    const live = activeList.filter((j) => j.status === "PUBLISHED").length;
    const paused = activeList.filter((j) => j.status === "PAUSED").length;
    const hired = activeList.filter((j) => j.status === "FILLED").length;
    const interested = activeList.filter((j) => (j.applicantCount || 0) > 0).length;
    const recentCompleted = jobs.filter((j) => isJobCompleted(j) && !hiddenHistoryJobIds.has(j.id)).length;
    const hiddenCount = Array.from(hiddenHistoryJobIds).filter(
      (id) => historyQuery.data?.items?.some((it) => it.id === id) || jobs.some((j) => j.id === id && isJobCompleted(j)),
    ).length;
    const completed = historyQuery.data?.total !== undefined
      ? Math.max(0, historyQuery.data.total - hiddenCount)
      : recentCompleted;

    return {
      total: jobs.length,
      active: live + paused + hired,
      live,
      paused,
      interested,
      hired,
      completed,
    };
  }, [jobs, historyQuery.data?.total]);

  // Removed "All" filter; defaults to Active jobs
  const filterOptions: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    count: number;
    color: string;
  }[] = [
    {
      key: "active",
      label: "All",
      icon: "flash-outline",
      activeIcon: "flash",
      count: counts.active,
      color: "#10B981",
    },
    {
      key: "interested",
      label: "With Applicants",
      icon: "people-outline",
      activeIcon: "people",
      count: counts.interested,
      color: "#3B82F6",
    },
    {
      key: "hired",
      label: "Hired",
      icon: "briefcase-outline",
      activeIcon: "briefcase",
      count: counts.hired,
      color: "#8B5CF6",
    },
    {
      key: "completed",
      label: "History",
      icon: "time-outline",
      activeIcon: "time",
      count: counts.completed,
      color: "#059669",
    },
  ];

  const filteredJobs = useMemo(() => {
    if (selectedFilter === "completed" || selectedFilter === "history") {
      return mergedHistoryJobs;
    }
    if (!jobs) return [];
    return jobs.filter((job) => {
      const completed = isJobCompleted(job);
      // When a job is completed, show it ONLY in History; do not show in All, With Applicants, or Hired
      if (completed) return false;

      if (selectedFilter === "active") {
        return job.status === "PUBLISHED" || job.status === "PAUSED" || job.status === "FILLED";
      }
      if (selectedFilter === "interested") return (job.applicantCount || 0) > 0;
      if (selectedFilter === "hired") return job.status === "FILLED";
      return true;
    });
  }, [jobs, selectedFilter, mergedHistoryJobs]);

  const displayedJobs = useMemo(() => {
    if (selectedFilter === "completed" || selectedFilter === "history") {
      return filteredJobs.slice(0, historyLimit);
    }
    return filteredJobs;
  }, [filteredJobs, selectedFilter, historyLimit]);

  const isHistoryLoading = isHistorySelected && historyQuery.isLoading && mergedHistoryJobs.length === 0;
  const isScreenLoading = isJobsLoading || isHistoryLoading;
  const isScreenError = Boolean(jobsError) || (isHistorySelected && Boolean(historyQuery.error) && mergedHistoryJobs.length === 0);

  // Job Action Mutation (pause / publish / cancel / delete)
  const actionMutation = useMutation({
    mutationFn: ({
      jobId,
      action,
    }: {
      jobId: string;
      action: "pause" | "publish" | "cancel" | "delete" | "remove-history";
    }) => {
      if (action === "remove-history") {
        return api(`/jobs/provider/history/${encodeURIComponent(jobId)}`, undefined, "DELETE");
      }
      if (action === "delete") {
        return api(`/jobs/${jobId}`, undefined, "DELETE");
      }
      return api(`/jobs/${jobId}/action`, { action });
    },
    onSuccess: (_, { action, jobId }) => {
      setJobToPause(null);
      setJobToDelete(null);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const msg = action === "remove-history"
        ? "Removed from your history."
        :
        action === "pause"
          ? "Job paused. Posting is stopped."
          : action === "publish"
            ? "Job resumed and live for workers!"
            : "Job removed from active listings. Work history and ratings retained.";
      showToast(msg);
      if (action === "remove-history") {
        setHiddenHistoryJobIds((prev) => new Set(prev).add(jobId));
        client.setQueriesData(
          { queryKey: ["provider-job-history"] },
          (old: any) => {
            if (!old || typeof old !== "object") return old;
            return {
              ...old,
              items: Array.isArray(old.items) ? old.items.filter((item: any) => item.id !== jobId) : [],
              total: Math.max(0, (old.total || 1) - 1),
            };
          }
        );
        client.setQueriesData(
          { queryKey: ["provider-recent-jobs"] },
          (old: any) => (Array.isArray(old) ? old.filter((item: any) => item.id !== jobId) : old)
        );
      } else {
        void invalidateJobLifecycleQueries(client);
      }
    },
    onError: (err: any) => {
      showToast(err?.message || "Action failed. Please try again.");
    },
  });

  const completeWorkMutation = useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      api<{ markedCount: number; completedCount: number; awaitingSeekerCount: number }>(
        `/jobs/${encodeURIComponent(jobId)}/complete-work`,
        {},
      ),
    onSuccess: async (result) => {
      await Promise.all([
        invalidateJobLifecycleQueries(client),
      ]);
      if (result.markedCount === 0) {
        showToast("No new in-progress work needed marking.");
      } else if (result.awaitingSeekerCount > 0) {
        showToast(
          result.completedCount > 0
            ? `${result.completedCount} completed; ${result.awaitingSeekerCount} seeker${result.awaitingSeekerCount === 1 ? "" : "s"} still need to confirm.`
            : `Asked ${result.awaitingSeekerCount} seeker${result.awaitingSeekerCount === 1 ? "" : "s"} to confirm completion.`,
        );
      } else {
        showToast(`${result.completedCount} hire${result.completedCount === 1 ? "" : "s"} completed. Review prompts sent.`);
      }
    },
    onError: (err: any) => showToast(err?.message || "Couldn't mark this work complete. Please retry."),
  });

  const confirmJobCompletion = (job: Job) => {
    const count = job.workAwaitingProviderCount || 0;
    if (!count || completeWorkMutation.isPending) return;
    setJobToComplete(job);
  };

  return (
    <View style={styles.container}>
      {/* Toast Feedback Banner with Smooth Spring & Fade Animation */}
      {!!toastMessage && (
        <Animated.View
          style={[
            styles.toast,
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
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Top Header */}
      <View
        style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.titleArea}>
              <Text style={styles.title}>Posted Jobs</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post a new job"
              onPress={() => router.push("/post-work")}
              style={({ pressed }) => [
                styles.postBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.postBtnText}>Post Job</Text>
            </Pressable>
          </View>
          <View style={styles.headerCountGroup}>
            <View style={styles.activeBadge} accessible accessibilityLabel={`${counts.live} active jobs`}>
              <View style={styles.statusBadgeLabelGroup}>
                <View style={styles.activeBadgeIcon}>
                  <Ionicons name="checkmark" size={14} color="#16804F" />
                </View>
                <Text style={styles.activeBadgeText} numberOfLines={1}>Active</Text>
              </View>
              <Text style={styles.statusBadgeCount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{counts.live}</Text>
            </View>
            <View
              style={[
                styles.inactiveBadge,
                counts.paused > 0 && styles.inactiveBadgeActive,
              ]}
              accessible
              accessibilityLabel={`${counts.paused} inactive jobs`}
            >
              <View style={styles.statusBadgeLabelGroup}>
                <View style={[styles.inactiveBadgeIcon, counts.paused > 0 && styles.inactiveBadgeIconActive]}>
                  <Ionicons name="pause" size={12} color={counts.paused > 0 ? "#A96810" : "#66766D"} />
                </View>
                <Text style={[styles.inactiveBadgeText, counts.paused > 0 && styles.inactiveBadgeTextActive]} numberOfLines={1}>Inactive</Text>
              </View>
              <Text style={[styles.statusBadgeCount, counts.paused > 0 && styles.inactiveBadgeCountActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{counts.paused}</Text>
            </View>
          </View>
        </View>

        {/* Horizontal Filter Tabs (Active, With Applicants, Hired, Done) */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterOptions.map((opt) => {
              const isSelected = selectedFilter === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedFilter(opt.key)}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                  ]}
                >
                  <Ionicons
                    name={isSelected ? opt.activeIcon : opt.icon}
                    size={14}
                    color={isSelected ? "#FFFFFF" : opt.color}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.count > 0 && (
                    <View
                      style={[
                        styles.filterCountBadge,
                        isSelected && styles.filterCountBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterCountText,
                          isSelected && styles.filterCountTextActive,
                        ]}
                      >
                        {opt.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Main Jobs Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={dash.primary}
            colors={[dash.primary]}
          />
        }
      >
        {isScreenLoading ? (
          <View style={styles.jobsList}>
            <ActivityJobSkeleton />
            <ActivityJobSkeleton />
            <ActivityJobSkeleton />
          </View>
        ) : isScreenError ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={40}
              color={dash.error}
            />
            <Text style={styles.errorTitle}>Failed to load jobs</Text>
            <Text style={styles.errorMessage}>
              Please check your connection and try again.
            </Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="briefcase-outline"
                size={32}
                color={dash.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedFilter === "active"
                ? "No active jobs right now"
                : `No ${selectedFilter} jobs`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === "active"
                ? "You don't have any active jobs currently. Post a new job requirement to find skilled workers nearby."
                : "Switch filter above or post a job to match with candidates."}
            </Text>
            <Pressable
              onPress={() => router.push("/post-work")}
              style={({ pressed }) => [
                styles.emptyActionBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.emptyActionBtnText}>Post a Job Now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {displayedJobs.map((job: Job) => {
              const isPaused = job.status === "PAUSED";
              const roleTheme = getRoleTheme(
                job.roleId,
                job.title,
                job.categoryName || job.categoryId,
              );
              const workersCount = getAdjustedWorkers(job.id, job.workers || 1);
              const attributeTags = getJobAttributeTags({ ...job, workers: workersCount });
              const isEducation = /education|tuition|tutor|school/i.test(
                `${job.categoryName} ${job.categoryId || ""}`,
              );
              const awaitingProvider = job.workAwaitingProviderCount || 0;
              const awaitingSeeker = job.workAwaitingSeekerCount || 0;
              const hasAcceptedSeeker = (job.acceptedCount || 0) > 0;
              const canMarkComplete = awaitingProvider > 0;
              const completionDisabledLabel = awaitingSeeker > 0
                ? `Waiting for ${awaitingSeeker} seeker${awaitingSeeker === 1 ? "" : "s"} to confirm`
                : "Available when work is ready";

              return (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.cardHeaderTop}>
                    <View style={styles.roleTitleGroup}>
                      <View
                        style={[
                          styles.roleIconBox,
                          {
                            backgroundColor: roleTheme.bg,
                            borderColor: roleTheme.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 24 }}>{roleTheme.icon}</Text>
                      </View>

                      <View style={styles.cardHeaderText}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <View style={styles.cardCategoryPill}>
                            <Ionicons
                              name={isEducation ? "school-outline" : "briefcase-outline"}
                              size={13}
                              color="#075B43"
                            />
                            <Text style={styles.cardCategoryText} numberOfLines={1}>
                              {job.categoryName || "General work"}
                            </Text>
                          </View>
                          {job.status === "FILLED" && (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#EEF3FF" }}>
                              <Text style={{ color: "#2F6FED", fontSize: 10, fontWeight: "700" }}>Hired</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.topRightActions}>
                      {!isJobCompleted(job) && job.status === "PUBLISHED" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Pause job"
                          hitSlop={6}
                          onPress={() => setJobToPause(job)}
                          style={({ pressed }) => [
                            styles.topMiniAction,
                            styles.pauseMiniAction,
                            pressed && styles.miniActionPressed,
                          ]}
                        >
                          <Ionicons name="pause" size={15} color="#047857" />
                          <Text style={styles.pauseMiniActionText}>Pause</Text>
                        </Pressable>
                      ) : !isJobCompleted(job) && job.status === "PAUSED" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Resume job"
                          hitSlop={6}
                          disabled={actionMutation.isPending}
                          onPress={() =>
                            actionMutation.mutate({ jobId: job.id, action: "publish" })
                          }
                          style={({ pressed }) => [
                            styles.topMiniAction,
                            styles.resumeMiniAction,
                            pressed && styles.miniActionPressed,
                          ]}
                        >
                          {actionMutation.isPending &&
                          (actionMutation.variables as any)?.jobId === job.id &&
                          (actionMutation.variables as any)?.action === "publish" ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Ionicons name="play" size={15} color="#DC2626" />
                          )}
                          <Text style={styles.resumeMiniActionText}>Resume</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                      accessibilityLabel={isJobCompleted(job) && isHistorySelected ? "Remove completed job from history" : "Delete job"}
                        hitSlop={6}
                        onPress={() => setJobToDelete(job)}
                        style={({ pressed }) => [
                          styles.topMiniAction,
                          styles.deleteMiniAction,
                          pressed && styles.miniActionPressed,
                        ]}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title.replace(/^Wanted:\s*/i, "")}
                  </Text>

                  <View style={styles.cardMetaRow}>
                    <View style={styles.cardMetaLocation}>
                      <Ionicons name="location-outline" size={14} color={dash.muted} />
                      <Text style={styles.cardLocationText} numberOfLines={1} ellipsizeMode="tail">
                        {job.area || "Nearby"}
                      </Text>
                    </View>
                    {!!job.createdAt && (
                      <>
                        <View style={styles.metaColumnDivider} />
                        <View style={styles.postedDateGroup}>
                          <Ionicons name="calendar-outline" size={13} color="#718178" />
                          <Text style={styles.cardTimeText} numberOfLines={1}>
                            {formatPostedDate(job.createdAt)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.cardUtilityRow}>
                    <View style={styles.attributeTags}>
                      {attributeTags.map((tag) => (
                        <View key={tag.label} style={styles.attributeTag}>
                          <Ionicons name={tag.icon} size={12} color="#52645A" />
                          <Text style={styles.attributeTagText} numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.6}>{tag.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <SmoothPausedBanner isPaused={isPaused} />

                  {isJobCompleted(job) && (
                    <View style={styles.completedNoticeBar}>
                      <Ionicons name="checkmark-circle" size={15} color="#059669" />
                      <Text style={styles.completedNoticeText} numberOfLines={1}>
                        {(job.completedCount || 0) > 0
                          ? `Work completed • ${job.completedCount} hire${job.completedCount === 1 ? "" : "s"} completed`
                          : "Job listing completed • Lifetime history retained"}
                      </Text>
                    </View>
                  )}

                  <View style={styles.essentialDataGrid}>
                    <View style={[styles.dataItem, styles.payDataItem]}>
                      <Text style={styles.dataLabel}>Pay rate</Text>
                      <View style={styles.payRow}>
                        <Text style={styles.payAmount} numberOfLines={1}>
                          ₹{((job.payPaise || 0) / 100).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.payUnit}>
                          /{formatPayUnit(job.payUnit)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dataDivider} />
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>Job type</Text>
                      <Text style={styles.workerCountText} numberOfLines={1}>
                        {getJobTypeLabel(job)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooterActions}>
                    <View style={styles.actionBtnCol}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View applications for this job"
                        onPress={() => setApplicationsJob(job)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.82 : 1,
                          width: "100%",
                        })}
                      >
                        <View style={[styles.footerBtnBase, styles.viewAppsBtn]}>
                          <View style={styles.appsLabelGroup}>
                            <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.viewAppsBtnText} numberOfLines={1}>
                              Review
                            </Text>
                          </View>
                          {(job.applicantCount || 0) > 0 && (
                            <View style={styles.appsCountBadge}>
                              <Text style={styles.appsCountBadgeText}>
                                {job.applicantCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    </View>

                    <View style={styles.actionBtnCol}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View job details"
                        onPress={() => router.push(`/jobs/${job.id}`)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.85 : 1,
                          width: "100%",
                        })}
                      >
                        <View style={[styles.footerBtnBase, styles.viewJobBtn]}>
                          <Text style={styles.viewJobBtnText} numberOfLines={1}>
                            View Details
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={15}
                            color={dash.primary}
                          />
                        </View>
                      </Pressable>
                    </View>
                  </View>

                  {hasAcceptedSeeker && (selectedFilter === "active" || selectedFilter === "hired") && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={canMarkComplete
                        ? `Mark work complete for ${awaitingProvider} seekers`
                        : completionDisabledLabel}
                      accessibilityState={{ disabled: !canMarkComplete || completeWorkMutation.isPending }}
                      disabled={!canMarkComplete || completeWorkMutation.isPending}
                      onPress={() => confirmJobCompletion(job)}
                      style={({ pressed }) => [
                        styles.completeWorkButton,
                        !canMarkComplete && styles.completeWorkButtonDisabled,
                        pressed && canMarkComplete && !completeWorkMutation.isPending && { opacity: 0.86 },
                        completeWorkMutation.isPending && { opacity: 0.72 },
                      ]}
                    >
                      {canMarkComplete ? (
                        completeWorkMutation.isPending && (completeWorkMutation.variables as any)?.jobId === job.id
                          ? <ActivityIndicator size="small" color="#FFFFFF" />
                          : <Ionicons name="checkmark-done-circle-outline" size={17} color={dash.primary} />
                      ) : (
                        <Ionicons name={awaitingSeeker > 0 ? "time-outline" : "lock-closed-outline"} size={15} color="#718078" />
                      )}
                      <Text style={[styles.completeWorkButtonText, !canMarkComplete && styles.completeWorkButtonTextDisabled]} numberOfLines={1}>
                        {canMarkComplete
                          ? `Mark work complete · ${awaitingProvider}`
                          : completionDisabledLabel}
                      </Text>
                    </Pressable>
                  )}

                  {(job.workAwaitingSeekerCount || 0) > 0 && (
                    <View style={styles.completionWaitingNote}>
                      <Ionicons name="time-outline" size={14} color="#566B60" />
                      <Text style={styles.completionWaitingText}>
                        Waiting for {job.workAwaitingSeekerCount} seeker{job.workAwaitingSeekerCount === 1 ? "" : "s"} to confirm
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            {(selectedFilter === "completed" || selectedFilter === "history") && filteredJobs.length > historyLimit ? (
              <View style={styles.historyLoadMoreBox}>
                <Text style={styles.historyCountLabel}>
                  Showing {Math.min(historyLimit, filteredJobs.length)} of {filteredJobs.length} completed postings
                </Text>
                <Pressable
                  style={styles.historyLoadMoreBtn}
                  onPress={() => setHistoryLimit((prev) => prev + 15)}
                  accessibilityRole="button"
                >
                  <Ionicons name="time-outline" size={16} color="#059669" />
                  <Text style={styles.historyLoadMoreBtnText}>Load more history</Text>
                </Pressable>
              </View>
            ) : (selectedFilter === "completed" || selectedFilter === "history") && filteredJobs.length > 0 ? (
              <View style={styles.historyLoadMoreBox}>
                <Text style={styles.historyCountLabel}>
                  Showing all {filteredJobs.length} completed postings
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!jobToComplete}
        transparent
        animationType="fade"
        onRequestClose={() => setJobToComplete(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setJobToComplete(null)} />
          <View style={styles.completeModalBox}>
            <View style={styles.completeIconCircle}>
              <Ionicons name="checkmark-done" size={24} color="#087B55" />
            </View>
            <Text style={styles.completeModalTitle}>
              Mark work complete for {jobToComplete?.workAwaitingProviderCount || 1} seeker{(jobToComplete?.workAwaitingProviderCount || 1) === 1 ? "" : "s"}?
            </Text>
            <Text style={styles.completeModalDesc}>
              They’ll be notified to confirm. Work is complete once you both confirm.
            </Text>
            <View style={styles.completeModalBtns}>
              <Pressable onPress={() => setJobToComplete(null)} style={styles.completeCancelBtn}>
                <Text style={styles.completeCancelText}>Not yet</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (jobToComplete) {
                    completeWorkMutation.mutate({ jobId: jobToComplete.id });
                    setJobToComplete(null);
                  }
                }}
                style={styles.completeConfirmBtn}
              >
                <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
                <Text style={styles.completeConfirmText}>Notify seekers</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stop Posting / Pause Confirmation Modal with Clear Explanation */}
      <Modal
        visible={!!jobToPause}
        transparent
        animationType="fade"
        onRequestClose={() => setJobToPause(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setJobToPause(null)}
          />
          <View style={styles.confirmModalBox}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="pause" size={22} color="#D97706" />
            </View>

            <Text style={styles.confirmModalTitle}>Stop Posting?</Text>
            <Text style={styles.confirmModalDesc} numberOfLines={1}>
              Workers won't see this job until you turn it back on.
            </Text>

            <View style={styles.confirmModalBtns}>
              <Pressable
                onPress={() => setJobToPause(null)}
                style={styles.cancelActionBtn}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (jobToPause) {
                    actionMutation.mutate({
                      jobId: jobToPause.id,
                      action: "pause",
                    });
                  }
                }}
                disabled={actionMutation.isPending}
                style={styles.confirmPauseBtn}
              >
                {actionMutation.isPending ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.confirmPauseText}>Stopping...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmPauseText}>Stop</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!jobToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setJobToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setJobToDelete(null)}
          />
          <View style={styles.confirmModalBox}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>

            <Text style={styles.confirmModalTitle}>{isHistorySelected && jobToDelete && isJobCompleted(jobToDelete) ? "Remove from history?" : "Remove Job Listing?"}</Text>
            <Text style={styles.confirmModalDesc} numberOfLines={3}>
              {isHistorySelected && jobToDelete && isJobCompleted(jobToDelete)
                ? "This completed job will be removed from your history. Seekers’ history and reviews will remain."
                : "This closes the listing and cancels outstanding applications. Completed work, reviews, and lifetime totals stay in your history."}
            </Text>

            <View style={styles.confirmModalBtns}>
              <Pressable
                onPress={() => setJobToDelete(null)}
                style={styles.cancelActionBtn}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (jobToDelete) {
                    actionMutation.mutate({
                      jobId: jobToDelete.id,
                      action: isHistorySelected && isJobCompleted(jobToDelete) ? "remove-history" : "delete",
                    });
                  }
                }}
                disabled={actionMutation.isPending}
                style={styles.confirmDeleteBtn}
              >
                {actionMutation.isPending ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.confirmDeleteText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dedicated Applications Bottom Sheet Modal */}
      <JobApplicationsModal
        visible={!!applicationsJob}
        jobId={applicationsJob?.id}
        initialApplicants={applicationsJob?.applicants}
        initialApplicantCount={applicationsJob?.applicantCount}
        onClose={() => setApplicationsJob(null)}
      />

      <JobCompletionConfirmationSheet
        visible={!!feedbackInteraction}
        interaction={feedbackInteraction}
        isOwner
        onClose={() => {
          setFeedbackInteraction(null);
          router.setParams({ completionInteractionId: undefined });
        }}
        onConfirm={async () => undefined}
        onReviewJob={(interaction) => {
          if (interaction.jobId) router.push(`/jobs/${interaction.jobId}`);
        }}
      />

      {/* Floating Bottom Navigation Bar */}
      <ProviderBottomNav active="jobs" visible={navVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF7",
    width: "100%",
    maxWidth: "100%",
  },
  toast: {
    position: "absolute",
    top: 52,
    maxWidth: "84%",
    alignSelf: "center",
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#EBF0EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  headerContent: {
    width: "100%",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: dash.ink,
    letterSpacing: -0.6,
  },
  headerCountGroup: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
    marginTop: 10,
  },
  activeBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#F0F8F3",
    paddingHorizontal: 9,
    paddingVertical: 7,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#D8EBDE",
  },
  activeBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF1E4",
  },
  statusBadgeLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  activeBadgeText: {
    color: "#4D705C",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  statusBadgeCount: {
    color: "#174E32",
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "800",
    letterSpacing: -0.25,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  inactiveBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#F4F6F5",
    paddingHorizontal: 9,
    paddingVertical: 7,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E4EAE6",
  },
  inactiveBadgeActive: {
    backgroundColor: "#FFF8EC",
    borderColor: "#F2DFC0",
  },
  inactiveBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7ECE9",
  },
  inactiveBadgeIconActive: {
    backgroundColor: "#F9EACD",
  },
  inactiveBadgeCountActive: {
    color: "#8E5B17",
  },
  inactiveBadgeText: {
    color: "#68766F",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  inactiveBadgeTextActive: {
    color: "#926321",
  },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: dash.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    flexShrink: 0,
    marginTop: 2,
  },
  postBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  historyLoadMoreBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 8,
  },
  historyCountLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  historyLoadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  historyLoadMoreBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  filterContainer: {
    width: "100%",
    overflow: "hidden",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F6F4",
    borderWidth: 1,
    borderColor: "#E5EBE6",
  },
  filterChipActive: {
    backgroundColor: dash.primary,
    borderColor: dash.primary,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: dash.muted,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterCountBadge: {
    backgroundColor: "#E2E8E4",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  filterCountText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: dash.ink,
  },
  filterCountTextActive: {
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 115, // clearance for floating navbar
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: dash.muted,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginTop: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#991B1B",
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6ECE8",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: dash.softGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: dash.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: dash.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  jobsList: {
    width: "100%",
    gap: 14,
  },
  jobCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    gap: 9,
    shadowColor: "#143B2B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 2,
  },
  completedNoticeBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  completedNoticeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#047857",
    flex: 1,
  },
  pausedNoticeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pausedNoticeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pausedNoticeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#B45309",
    flex: 1,
  },
  pausedBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  pausedBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 0.5,
  },
  cardHeaderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  roleTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  cardCategoryPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#E9F5ED",
  },
  cardCategoryText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#075B43",
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 9,
    marginTop: -2,
    flexShrink: 0,
  },
  topMiniAction: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  pauseMiniAction: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  resumeMiniAction: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  deleteMiniAction: {
    width: 28,
    height: 28,
    paddingHorizontal: 0,
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  pauseMiniActionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  resumeMiniActionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DC2626",
  },
  miniActionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  cardUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    width: "100%",
  },
  jobTitle: {
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.2,
    flexShrink: 1,
    marginTop: 3,
    marginBottom: 0,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
    gap: 9,
    marginTop: 2,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: "#F7F9F7",
    borderWidth: 1,
    borderColor: "#EDF1EE",
    minWidth: 0,
  },
  cardMetaLocation: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaColumnDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#E1E8E3",
  },
  postedDateGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    flexShrink: 0,
  },
  cardLocationText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    color: dash.muted,
    fontWeight: "600",
  },
  cardTimeText: {
    fontSize: 11.5,
    color: "#94A3B8",
    fontWeight: "500",
    flexShrink: 0,
  },
  attributeTags: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "stretch",
    gap: 6,
    minWidth: 0,
  },
  attributeTag: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 11,
    backgroundColor: "#F3F6F4",
    borderWidth: 1,
    borderColor: "#E7ECE8",
  },
  attributeTagText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "700",
    color: "#52645A",
    textAlign: "center",
  },
  essentialDataGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    backgroundColor: "#EEF6F0",
    paddingVertical: 9,
    paddingHorizontal: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EEE6",
  },
  dataItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  payDataItem: { flex: 1.5 },
  dataDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#E2E9E4",
    marginVertical: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: dash.muted,
    marginBottom: 3,
  },
  payRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 2,
  },
  payAmount: {
    fontSize: 12.5,
    fontWeight: "900",
    color: dash.primary,
    flexShrink: 0,
  },
  payUnit: {
    fontSize: 9,
    fontWeight: "700",
    color: dash.primarySoft,
    flexShrink: 0,
  },
  workerCountText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: dash.ink,
  },
  cardFooterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F2",
    width: "100%",
  },
  actionBtnCol: {
    flex: 1,
    minWidth: 0,
  },
  footerBtnBase: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  viewAppsBtn: {
    backgroundColor: dash.primary,
    borderRadius: 14,
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  appsLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  viewAppsBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF", flexShrink: 1 },
  appsCountBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  appsCountBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  viewJobBtn: { backgroundColor: "#EDF4EF", borderRadius: 14 },
  viewJobBtnText: { fontSize: 12.5, fontWeight: "600", color: dash.primary },
  completeWorkButton: {
    width: "100%",
    minHeight: 42,
    marginTop: 9,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: dash.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  completeWorkButtonDisabled: {
    backgroundColor: "#F1F5F2",
    borderWidth: 1,
    borderColor: "#E3EAE5",
  },
  completeWorkButtonText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  completeWorkButtonTextDisabled: { color: "#718078", fontWeight: "600" },
  completionWaitingNote: {
    width: "100%",
    minHeight: 34,
    marginTop: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F2",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  completionWaitingText: { color: "#566B60", fontSize: 11.5, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(18, 38, 29, 0.28)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  completeModalBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "flex-start",
    shadowColor: "#10251C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  completeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  completeModalTitle: {
    color: "#17221C",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.35,
  },
  completeModalDesc: {
    color: "#68756D",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
  },
  completeModalBtns: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  completeCancelBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4EAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  completeCancelText: {
    color: "#536159",
    fontSize: 14,
    fontWeight: "700",
  },
  completeConfirmBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#087B55",
    alignItems: "center",
    justifyContent: "center",
  },
  completeConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmModalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    width: "100%",
    maxWidth: 310,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    gap: 10,
  },
  pauseIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  confirmModalDesc: {
    fontSize: 12,
    color: dash.muted,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  confirmModalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    width: "100%",
  },
  cancelActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  confirmPauseBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPauseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDeleteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
