import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  Linking,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Easing,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api/client";
import { getExactRoleIcon } from "../src/utils/nameVerification";
import { ProviderBottomNav } from "../src/components/provider/ProviderBottomNav";
import { dash } from "../src/components/provider/palette";
import { useJobsNotification } from "../src/store/jobsNotification";
import { JobApplicationsModal } from "../src/components/JobApplicationsModal";

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
  applicantCount: number;
  createdAt?: number | string;
  startsAt?: number;
  applicants?: Applicant[];
};

const AVATAR_PALETTES = [
  { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  { bg: "#FCE7F3", text: "#BE185D", border: "#FBCFE8" },
  { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" },
  { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
];

function getAvatarPalette(key: string): { bg: string; text: string; border: string } {
  let hash = 0;
  for (let i = 0; i < (key || "").length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] ?? AVATAR_PALETTES[0]!;
}

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

function formatRelativeTime(timestamp?: string | number): string {
  if (!timestamp) return "";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp * (timestamp < 1e11 ? 1000 : 1);
  if (isNaN(time)) return "";
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function getRoleTheme(roleId?: string, roleName?: string, categoryId?: string) {
  const name = (roleName || "").toLowerCase();
  const cat = (categoryId || "").toLowerCase();
  const rId = (roleId || "").toLowerCase();

  if (name.includes("electr") || name.includes("wire") || rId.includes("electr")) {
    return { bg: "#FEF3C7", border: "#FDE68A", icon: "⚡" };
  }
  if (name.includes("plumb") || name.includes("pipe") || rId.includes("plumb")) {
    return { bg: "#E0F2FE", border: "#BAE6FD", icon: "🔧" };
  }
  if (name.includes("carpent") || name.includes("wood") || rId.includes("carpent")) {
    return { bg: "#FFEDD5", border: "#FED7AA", icon: "🪚" };
  }
  if (name.includes("cook") || name.includes("chef") || cat.includes("food") || rId.includes("cook")) {
    return { bg: "#FFF7ED", border: "#FFEDD5", icon: "🍳" };
  }
  if (name.includes("paint") || rId.includes("paint")) {
    return { bg: "#FCE7F3", border: "#FBCFE8", icon: "🎨" };
  }
  if (name.includes("clean") || name.includes("maid") || name.includes("housekeep") || rId.includes("clean")) {
    return { bg: "#E8F5EE", border: "#C8E87A", icon: "🧹" };
  }
  if (name.includes("mason") || name.includes("brick") || cat.includes("construction") || rId.includes("mason")) {
    return { bg: "#F5F5F4", border: "#E7E5E4", icon: "🏗️" };
  }
  if (name.includes("driv") || name.includes("cab") || name.includes("ride") || cat.includes("transport") || rId.includes("driver")) {
    return { bg: "#CFFAFE", border: "#A5F3FC", icon: "🚗" };
  }
  if (name.includes("guard") || name.includes("secur") || rId.includes("guard")) {
    return { bg: "#EDE9FE", border: "#DDD6FE", icon: "🛡️" };
  }
  return {
    bg: "#ECFDF5",
    border: "#C8E87A",
    icon: getExactRoleIcon(roleId || "", roleName || "", categoryId),
  };
}

function getJobStatusMeta(status: string) {
  switch (status?.toUpperCase()) {
    case "PUBLISHED":
      return {
        label: "Active",
        dotColor: "#10B981",
        textColor: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
      };
    case "PAUSED":
      return {
        label: "Paused",
        dotColor: "#F59E0B",
        textColor: "#D97706",
        bgColor: "#FFFBEB",
        borderColor: "#FDE68A",
      };
    case "FILLED":
      return {
        label: "Hired",
        dotColor: "#3B82F6",
        textColor: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
      };
    case "COMPLETED":
      return {
        label: "Done",
        dotColor: "#8B5CF6",
        textColor: "#7C3AED",
        bgColor: "#F5F3FF",
        borderColor: "#DDD6FE",
      };
    default:
      return {
        label: status || "Open",
        dotColor: "#6B7280",
        textColor: "#374151",
        bgColor: "#F3F4F6",
        borderColor: "#E5E7EB",
      };
  }
}

function ApplicantAvatarStack({
  applicants = [],
  totalCount = 0,
}: {
  applicants?: Applicant[];
  totalCount: number;
}) {
  const displayApplicants = applicants.slice(0, 3);
  const remaining = Math.max(0, totalCount - displayApplicants.length);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {displayApplicants.map((app, index) => {
          const palette = getAvatarPalette(app.id || app.name || `${index}`);
          const initial = (app.name || "W").trim().charAt(0).toUpperCase();

          return (
            <View
              key={app.id || index}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: palette.bg,
                borderWidth: 2,
                borderColor: "#FFFFFF",
                marginLeft: index === 0 ? 0 : -7,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
                zIndex: 10 - index,
              }}
            >
              {app.photoUrl ? (
                <Image
                  source={{ uri: app.photoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: palette.text,
                  }}
                >
                  {initial}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {remaining > 0 && (
        <View
          style={{
            marginLeft: -5,
            backgroundColor: "#EEF2FF",
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            zIndex: 1,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "800", color: "#4F46E5" }}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
  const params = useLocalSearchParams<{ filter?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<string>(params.filter || "active");
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [jobToPause, setJobToPause] = useState<Job | null>(null);
  const [applicationsJob, setApplicationsJob] = useState<Job | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const client = useQueryClient();

  const {
    getAdjustedWorkers,
    incrementWorkers,
  } = useJobsNotification();

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
    [toastAnim]
  );

  const {
    data: jobs,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Job[]>({
    queryKey: ["my-jobs"],
    queryFn: () => api<Job[]>("/jobs/provider/recent"),
  });

  const counts = useMemo(() => {
    if (!jobs) return { active: 0, interested: 0, hired: 0, completed: 0, total: 0, live: 0, paused: 0 };
    const live = jobs.filter((j) => j.status === "PUBLISHED").length;
    const paused = jobs.filter((j) => j.status === "PAUSED").length;
    return {
      total: jobs.length,
      active: live + paused,
      live,
      paused,
      interested: jobs.filter((j) => (j.applicantCount || 0) > 0).length,
      hired: jobs.filter((j) => j.status === "FILLED").length,
      completed: jobs.filter((j) => j.status === "COMPLETED").length,
    };
  }, [jobs]);

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
      label: "Active",
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
      label: "Done",
      icon: "checkmark-done-circle-outline",
      activeIcon: "checkmark-done-circle",
      count: counts.completed,
      color: "#059669",
    },
  ];

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      if (selectedFilter === "active") return job.status === "PUBLISHED" || job.status === "PAUSED";
      if (selectedFilter === "interested") return (job.applicantCount || 0) > 0;
      if (selectedFilter === "hired") return job.status === "FILLED";
      if (selectedFilter === "completed") return job.status === "COMPLETED";
      return true;
    });
  }, [jobs, selectedFilter]);

  // Job Action Mutation (pause / publish / cancel)
  const actionMutation = useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: "pause" | "publish" | "cancel" }) =>
      api(`/jobs/${jobId}/action`, { action }),
    onSuccess: (_, { action }) => {
      setJobToPause(null);
      setJobToDelete(null);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const msg =
        action === "pause"
          ? "Job paused. Posting is stopped."
          : action === "publish"
          ? "Job resumed and live for workers!"
          : "Job posting deleted.";
      showToast(msg);
      void client.invalidateQueries({ queryKey: ["my-jobs"] });
      void client.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
    },
    onError: (err: any) => {
      showToast(err?.message || "Action failed. Please try again.");
    },
  });

  const handleIncrementWorkers = (job: Job) => {
    const currentTotal = getAdjustedWorkers(job.id, job.workers || 1);
    incrementWorkers(job.id);
    showToast(`Updated to ${currentTotal + 1} workers needed for "${job.title}"`);
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.titleArea}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Posted Jobs</Text>
                <View style={styles.headerCountGroup}>
                  <View style={styles.activeBadge}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeBadgeText}>{counts.live} Active</Text>
                  </View>
                  <View style={[styles.inactiveBadge, counts.paused > 0 && styles.inactiveBadgeActive]}>
                    <View style={[styles.inactiveDot, counts.paused > 0 && styles.inactiveDotActive]} />
                    <Text style={[styles.inactiveBadgeText, counts.paused > 0 && styles.inactiveBadgeTextActive]}>
                      {counts.paused} Inactive
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.subtitle}>
                {counts.interested > 0
                  ? `${counts.interested} listing${counts.interested === 1 ? "" : "s"} with applicants waiting`
                  : "Manage your listings and track candidate responses"}
              </Text>
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
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                >
                  <Ionicons
                    name={isSelected ? opt.activeIcon : opt.icon}
                    size={14}
                    color={isSelected ? "#FFFFFF" : opt.color}
                  />
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  {opt.count > 0 && (
                    <View style={[styles.filterCountBadge, isSelected && styles.filterCountBadgeActive]}>
                      <Text style={[styles.filterCountText, isSelected && styles.filterCountTextActive]}>
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={dash.primary}
            colors={[dash.primary]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={dash.primary} />
            <Text style={styles.loadingText}>Loading jobs...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={40} color={dash.error} />
            <Text style={styles.errorTitle}>Failed to load jobs</Text>
            <Text style={styles.errorMessage}>Please check your connection and try again.</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="briefcase-outline" size={32} color={dash.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedFilter === "active" ? "No active jobs right now" : `No ${selectedFilter} jobs`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === "active"
                ? "You don't have any active jobs currently. Post a new job requirement to find skilled workers nearby."
                : "Switch filter above or post a job to match with candidates."}
            </Text>
            <Pressable
              onPress={() => router.push("/post-work")}
              style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.emptyActionBtnText}>Post a Job Now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {filteredJobs.map((job) => {
              const isPaused = job.status === "PAUSED";
              const statusMeta = getJobStatusMeta(job.status);
              const roleTheme = getRoleTheme(
                job.roleId,
                job.title,
                job.categoryName || job.categoryId
              );
              const workersCount = getAdjustedWorkers(job.id, job.workers || 1);

              return (
                <View key={job.id} style={styles.jobCard}>
                  {/* Top Row: Role Icon + Title/Status on Left; Delete Icon on Top Right */}
                  <View style={styles.cardHeaderTop}>
                    {/* Left: Icon and Title */}
                    <View style={styles.roleTitleGroup}>
                      <View
                        style={[
                          styles.roleIconBox,
                          { backgroundColor: roleTheme.bg, borderColor: roleTheme.border },
                        ]}
                      >
                        <Text style={{ fontSize: 24 }}>{roleTheme.icon}</Text>
                      </View>

                      <View style={styles.cardHeaderText}>
                        <View style={styles.titleStatusRow}>
                          <Text style={styles.jobTitle} numberOfLines={1}>
                            {job.title}
                          </Text>
                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: statusMeta.bgColor, borderColor: statusMeta.borderColor },
                            ]}
                          >
                            <View style={[styles.statusDot, { backgroundColor: statusMeta.dotColor }]} />
                            <Text style={[styles.statusText, { color: statusMeta.textColor }]}>
                              {statusMeta.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cardMetaRow}>
                          <Ionicons name="location-outline" size={13} color={dash.muted} />
                          <Text style={styles.cardLocationText} numberOfLines={1}>
                            {job.area || "Nearby"}
                          </Text>
                          {!!job.createdAt && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text style={styles.cardTimeText}>
                                {formatRelativeTime(job.createdAt)}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Top Right Corner Action Icons: Stop/Resume Pill + Delete Button */}
                    <View style={styles.topRightActions}>
                      {job.status === "PUBLISHED" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Stop posting this job"
                          onPress={() => setJobToPause(job)}
                          style={({ pressed }) => [
                            styles.topActionPill,
                            styles.topStopPill,
                            pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                          ]}
                        >
                          <Ionicons name="pause-circle" size={14} color="#D97706" />
                          <Text style={styles.topStopPillText}>Stop</Text>
                        </Pressable>
                      ) : job.status === "PAUSED" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Resume posting this job"
                          disabled={actionMutation.isPending}
                          onPress={() => actionMutation.mutate({ jobId: job.id, action: "publish" })}
                          style={({ pressed }) => [
                            styles.topActionPill,
                            styles.topResumePill,
                            pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                          ]}
                        >
                          {actionMutation.isPending &&
                          (actionMutation.variables as any)?.jobId === job.id &&
                          (actionMutation.variables as any)?.action === "publish" ? (
                            <ActivityIndicator size="small" color="#15803D" />
                          ) : (
                            <Ionicons name="play-circle" size={14} color="#15803D" />
                          )}
                          <Text style={styles.topResumePillText}>Resume</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete job"
                        onPress={() => setJobToDelete(job)}
                        style={({ pressed }) => [
                          styles.topIconBtn,
                          styles.topDeleteBtn,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                        ]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Smooth Animated Notice Banner if Job is Stopped/Paused */}
                  <SmoothPausedBanner isPaused={isPaused} />

                  {/* Essential Provider Data Grid */}
                  <View style={styles.essentialDataGrid}>
                    {/* Pay Rate */}
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>PAY RATE</Text>
                      <View style={styles.payRow}>
                        <Text style={styles.payAmount}>
                          ₹{((job.payPaise || 0) / 100).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.payUnit}>/{formatPayUnit(job.payUnit)}</Text>
                      </View>
                    </View>

                    {/* Workers Needed with Quick +1 */}
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>WORKERS NEEDED</Text>
                      <View style={styles.workerRow}>
                        <Text style={styles.workerCountText}>{workersCount} Required</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Add 1 worker"
                          onPress={() => handleIncrementWorkers(job)}
                          style={({ pressed }) => [
                            styles.inlineAddWorkerBtn,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="add" size={12} color="#FFFFFF" />
                          <Text style={styles.inlineAddWorkerText}>+1</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Category */}
                    {!!job.categoryName && (
                      <View style={styles.dataItem}>
                        <Text style={styles.dataLabel}>CATEGORY</Text>
                        <Text style={styles.dataValue} numberOfLines={1}>
                          {job.categoryName}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Applicants Summary */}
                  {(job.applicantCount || 0) > 0 ? (
                    <Pressable
                      onPress={() => setApplicationsJob(job)}
                      style={styles.applicantBar}
                    >
                      <ApplicantAvatarStack
                        applicants={job.applicants}
                        totalCount={job.applicantCount}
                      />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={styles.applicantBarTitle}>
                          {job.applicantCount} {job.applicantCount === 1 ? "Candidate Applied" : "Candidates Applied"}
                        </Text>
                        <Text style={styles.applicantBarHint}>
                          Tap to view candidate details
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color="#2563EB" />
                    </Pressable>
                  ) : (
                    <View style={styles.noApplicantBar}>
                      <Ionicons name="people-outline" size={15} color={dash.muted} />
                      <Text style={styles.noApplicantText}>
                        0 Applicants so far • Ready for workers to apply
                      </Text>
                    </View>
                  )}

                  {/* Bottom Management Actions: View Applications + View Details */}
                  <View style={styles.cardFooterActions}>
                    {/* View Applications Button Column */}
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
                          <Ionicons name="people" size={16} color={dash.primary} />
                          <Text style={styles.viewAppsBtnText} numberOfLines={1}>
                            View Applications
                          </Text>
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

                    {/* View Details Button Column */}
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
                          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Stop Posting / Pause Confirmation Modal with Clear Explanation */}
      <Modal
        visible={!!jobToPause}
        transparent
        animationType="fade"
        onRequestClose={() => setJobToPause(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setJobToPause(null)} />
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
                    actionMutation.mutate({ jobId: jobToPause.id, action: "pause" });
                  }
                }}
                disabled={actionMutation.isPending}
                style={styles.confirmPauseBtn}
              >
                {actionMutation.isPending ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
          <Pressable style={styles.modalBackdrop} onPress={() => setJobToDelete(null)} />
          <View style={styles.confirmModalBox}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>

            <Text style={styles.confirmModalTitle}>Delete Job?</Text>
            <Text style={styles.confirmModalDesc} numberOfLines={1}>
              This job will be permanently removed.
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
                    actionMutation.mutate({ jobId: jobToDelete.id, action: "cancel" });
                  }
                }}
                disabled={actionMutation.isPending}
                style={styles.confirmDeleteBtn}
              >
                {actionMutation.isPending ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
        jobTitle={applicationsJob?.title}
        initialApplicants={applicationsJob?.applicants}
        initialApplicantCount={applicationsJob?.applicantCount}
        onClose={() => setApplicationsJob(null)}
      />

      {/* Floating Bottom Navigation Bar */}
      <ProviderBottomNav active="jobs" />
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
    top: 60,
    alignSelf: "center",
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: dash.ink,
    letterSpacing: -0.6,
  },
  headerCountGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: dash.softGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1EAD8",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dash.secondary,
  },
  activeBadgeText: {
    color: dash.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  inactiveBadgeActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94A3B8",
  },
  inactiveDotActive: {
    backgroundColor: "#D97706",
  },
  inactiveBadgeText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  inactiveBadgeTextActive: {
    color: "#B45309",
  },
  subtitle: {
    fontSize: 13,
    color: dash.muted,
    marginTop: 3,
    lineHeight: 18,
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
    fontSize: 13,
    fontWeight: "700",
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
    fontSize: 12.5,
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
    fontSize: 11,
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0A281E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
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
    justifyContent: "space-between",
    gap: 10,
  },
  roleTitleGroup: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  roleIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  titleStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  jobTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.3,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  cardLocationText: {
    fontSize: 12,
    color: dash.muted,
    fontWeight: "600",
    maxWidth: "60%",
  },
  metaDot: {
    fontSize: 10,
    color: "#94A3B8",
    marginHorizontal: 2,
  },
  cardTimeText: {
    fontSize: 11.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  topActionPill: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4.5,
  },
  topStopPill: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1.2,
    borderColor: "#FDE68A",
  },
  topStopPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
  },
  topResumePill: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.2,
    borderColor: "#BBF7D0",
  },
  topResumePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  topDeleteBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.2,
    borderColor: "#FEE2E2",
  },
  essentialDataGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAF9",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2EE",
  },
  dataItem: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  payAmount: {
    fontSize: 14,
    fontWeight: "900",
    color: dash.primary,
  },
  payUnit: {
    fontSize: 10.5,
    fontWeight: "700",
    color: dash.primarySoft,
  },
  workerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  workerCountText: {
    fontSize: 12,
    fontWeight: "800",
    color: dash.ink,
  },
  inlineAddWorkerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: dash.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inlineAddWorkerText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  dataValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  applicantBar: {
    backgroundColor: "#F5F8FF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    flexDirection: "row",
    alignItems: "center",
  },
  applicantBarTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#1E40AF",
  },
  applicantBarHint: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
    marginTop: 1,
  },
  noApplicantBar: {
    backgroundColor: "#F8FAF8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EAEFEA",
  },
  noApplicantText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: dash.muted,
  },
  cardFooterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    paddingTop: 10,
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
    paddingHorizontal: 8,
  },
  viewAppsBtn: {
    backgroundColor: dash.softGreen,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 14,
  },
  viewAppsBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: dash.primary,
    letterSpacing: -0.2,
  },
  appsCountBadge: {
    backgroundColor: dash.primary,
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  appsCountBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  viewJobBtn: {
    backgroundColor: dash.primary,
    borderRadius: 14,
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  viewJobBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
