import { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { useAuth } from "../../auth";
import { useLocation } from "../../store/location";
import { Skeleton } from "../SkeletonLoader";
import { ProviderBottomNav } from "./ProviderBottomNav";
import { dash, radii } from "./palette";

const HERO = require("../../../assets/images/provider/top_2.png");

type Period = "week" | "month" | "all";

type ProviderStats = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
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
};

function initials(name?: string | null) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function pagePad(width: number) {
  if (width < 360) return 16;
  if (width > 420) return 22;
  return 20;
}

function heroHeightFor(width: number) {
  // Get image dimensions to calculate aspect ratio
  const imageAsset = Image.resolveAssetSource(HERO);
  if (imageAsset && imageAsset.width && imageAsset.height) {
    // Auto-calculate height based on image aspect ratio, reduced by 20%
    return width * (imageAsset.height / imageAsset.width) * 0.8;
  }
  // Fallback: assume standard aspect ratio if dimensions not available
  return width * 0.95;
}

function jobPriority(job: RecentJob) {
  const status = (job.status || "").toUpperCase();
  if (status === "PAUSED") return 0;
  if ((job.applicantCount || 0) > 0 && status === "PUBLISHED") return 1;
  if (status === "PUBLISHED") return 2;
  if (status === "FILLED") return 3;
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
  const { width } = useWindowDimensions();
  const pad = pagePad(width);

  const heroH = heroHeightFor(width);
  const auth = useAuth();
  const location = useLocation((s) => s.location);
  const [period, setPeriod] = useState<Period>("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [menuJob, setMenuJob] = useState<RecentJob | null>(null);
  const [headerTint, setHeaderTint] = useState(0);

  const token = auth.session?.token || null;
  const client = useQueryClient();

  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () =>
      api<{ id: string; name: string; area: string; photoUrl: string | null }>("/users/me"),
  });

  const statsQuery = useQuery<ProviderStats>({
    queryKey: ["provider-stats", period],
    queryFn: () => api<ProviderStats>(`/jobs/provider/stats?period=${period}`),
    enabled: !!token,
  });

  const jobsQuery = useQuery<RecentJob[]>({
    queryKey: ["provider-recent-jobs"],
    queryFn: () => api<RecentJob[]>("/jobs/provider/recent"),
    enabled: !!token,
  });

  const action = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "pause" | "publish" | "cancel" }) =>
      api(`/jobs/${id}/action`, { action: next }),
    onSuccess: () => {
      setMenuJob(null);
      void client.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
      void client.invalidateQueries({ queryKey: ["provider-stats"] });
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  const photoUrl = me.data?.photoUrl;
  const unread = (statsQuery.data?.pendingResponses ?? statsQuery.data?.interested ?? 0) > 0;
  const jobsPosted = statsQuery.data?.jobsPosted ?? 0;
  const isNewProvider = !jobsQuery.isLoading && (jobsQuery.data?.length ?? 0) === 0 && jobsPosted === 0;

  const rankedJobs = useMemo(() => {
    const list = [...(jobsQuery.data || [])];
    list.sort((a, b) => jobPriority(a) - jobPriority(b));
    return list.slice(0, 3);
  }, [jobsQuery.data]);

  const contentWidth = Math.min(width, 560);
  const sidePad = Math.max(pad, (width - contentWidth) / 2);

  return (
    <View style={styles.screen}>
      <StatusBar style={headerTint > 0.55 ? "dark" : "light"} translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderTint(Math.min(1, Math.max(0, y / 90)));
        }}
        contentContainerStyle={{
          paddingBottom: 118 + Math.max(insets.bottom, 8),
        }}
      >
        {/* Hero: reference image scrolls naturally with the page content */}
        <View
          style={{
            width: "100%",
            height: heroH,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Image
            source={HERO}
            accessibilityLabel="Local worker finding jobs nearby"
            resizeMode="cover"
            style={styles.heroImage}
          />
          <LinearGradient
            colors={["rgba(7,91,67,0.22)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.16 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(248,250,247,0.4)", dash.bg]}
            locations={[0.58, 0.84, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(248,250,247,0.82)"]}
            start={{ x: 0.55, y: 0.35 }}
            end={{ x: 0, y: 0.92 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

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
          />
        </View>

        <View style={{ paddingHorizontal: sidePad, marginTop: 26 }}>
          <RecentJobs
            loading={jobsQuery.isLoading}
            error={jobsQuery.isError}
            jobs={rankedJobs}
            isNewProvider={isNewProvider}
            onOpenMenu={setMenuJob}
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

        <View style={[styles.headerRow, { paddingHorizontal: sidePad }]}>
          {/* Logo + tagline — left side */}
          <View>
            <Text style={styles.logo}>
              Bulao
            </Text>
            <Text style={styles.tagline}>
              Local Help. Real People.
            </Text>
          </View>

          {/* Location pill — fills the middle */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose service area"
            onPress={() => useLocation.getState().setLocationSheetVisible(true)}
            style={styles.locationPill}
          >
            <Ionicons name="location" size={13} color={dash.primary} />
            <Text style={styles.headerLocationText} numberOfLines={1}>
              {location?.area || "Choose area"}
            </Text>
            <Ionicons name="chevron-down" size={13} color={dash.primary} />
          </Pressable>

          {/* Notification + Profile — pinned to the right corner */}
          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/activity")}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={dash.ink} />
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              onPress={() => router.push("/profile")}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials(me.data?.name || auth.user?.name)}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ProviderBottomNav active="bulao" />

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
      />
    </View>
  );
}

function PostJobCTA() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Post a new job"
      onPress={() => router.push("/post-work")}
      style={({ pressed }) => [
        styles.ctaOuter,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <View style={styles.cta}>
        <View style={styles.ctaIcon}>
          <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.ctaTextWrap}>
          <Text style={styles.ctaTitle}>Post a New Job</Text>
          <Text style={styles.ctaSub}>It takes less than 2 minutes</Text>
        </View>
        <View style={styles.ctaArrow}>
          <Ionicons name="arrow-forward" size={20} color="#03402D" />
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
}: {
  stats?: ProviderStats;
  loading: boolean;
  error: boolean;
  period: Period;
  onOpenPeriod: () => void;
}) {
  const periodLabel = period === "week" ? "This Week" : period === "all" ? "All time" : "This Month";
  const cards = [
    {
      key: "posted" as const,
      label: "Jobs Posted",
      value: stats?.jobsPosted ?? 0,
      trend: computeStatTrend("posted", stats),
      bg: "#F0FDF4",
      borderColor: "#DCFCE7",
      iconBg: "#DCFCE7",
      icon: "document-text" as const,
      iconColor: "#10B981",
      filter: "posted",
    },
    {
      key: "responses" as const,
      label: "Responses",
      value: stats?.interested ?? 0,
      trend: computeStatTrend("responses", stats),
      bg: "#EFF6FF",
      borderColor: "#DBEAFE",
      iconBg: "#DBEAFE",
      icon: "people" as const,
      iconColor: "#3B82F6",
      filter: "interested",
    },
    {
      key: "hired" as const,
      label: "Hired",
      value: stats?.hired ?? 0,
      trend: computeStatTrend("hired", stats),
      bg: "#FFFBEB",
      borderColor: "#FEF3C7",
      iconBg: "#FEF3C7",
      icon: "person" as const,
      iconColor: "#F59E0B",
      filter: "hired",
    },
    {
      key: "completed" as const,
      label: "Completed",
      value: stats?.completed ?? 0,
      trend: computeStatTrend("completed", stats),
      bg: "#FEF2F2",
      borderColor: "#FFE4E6",
      iconBg: "#FFE4E6",
      icon: "checkmark-circle" as const,
      iconColor: "#EF4444",
      filter: "active",
    },
  ];

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Pressable onPress={onOpenPeriod} style={styles.periodBtn} accessibilityRole="button">
          <Text style={styles.periodText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={dash.muted} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={22} color={dash.error} />
          <Text style={styles.errorText}>Couldn't load overview</Text>
        </View>
      ) : loading ? (
        <View style={styles.statsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: dash.white }]}>
              <Skeleton width={32} height={32} borderRadius={16} />
              <Skeleton width={28} height={20} borderRadius={6} />
              <Skeleton width="80%" height={10} borderRadius={4} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.statsRow}>
          {cards.map((card) => {
            const trendColor =
              card.trend > 0 ? "#10B981" : card.trend < 0 ? "#EF4444" : "#64748B";
            const trendText =
              card.trend > 0 ? `+${card.trend}%` : `${card.trend}%`;

            return (
              <View
                key={card.key}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: card.bg,
                    borderColor: card.borderColor,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/activity?filter=${card.filter}`)}
                  style={({ pressed }) => [
                    styles.statCardInner,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {/* Icon badge */}
                  <View style={[styles.iconBadge, { backgroundColor: card.iconBg }]}>
                    <Ionicons name={card.icon} size={18} color={card.iconColor} />
                  </View>

                  {/* Value */}
                  <Text style={styles.statValue}>{card.value}</Text>

                  {/* Label */}
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {card.label}
                  </Text>

                  {/* Trend: dynamic wave + dynamic percentage text */}
                  <View style={styles.statTrend}>
                    <SparkWave trend={card.trend} />
                    <Text style={[styles.trendPct, { color: trendColor }]}>
                      {trendText}
                    </Text>
                  </View>
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
}: {
  loading: boolean;
  error: boolean;
  jobs: RecentJob[];
  isNewProvider: boolean;
  onOpenMenu: (job: RecentJob) => void;
}) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Recent Jobs</Text>
        <Pressable onPress={() => router.push("/activity")} style={styles.seeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="arrow-forward" size={14} color={dash.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.jobCard}>
              <View style={styles.jobCardInner}>
                <Skeleton width={44} height={44} borderRadius={12} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="75%" height={14} borderRadius={4} />
                  <Skeleton width="55%" height={11} borderRadius={4} />
                </View>
                <Skeleton width={32} height={32} borderRadius={8} />
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
            {isNewProvider ? "Your work starts here." : "No jobs to show yet."}
          </Text>
          <Text style={styles.emptyCopy}>
            Post your first job and{"\n"}find trusted people nearby.
          </Text>
          <Pressable onPress={() => router.push("/post-work")} style={styles.emptyCta}>
            <Ionicons name="add" size={18} color={dash.white} />
            <Text style={styles.emptyCtaText}>Post a Job</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onMenu={() => onOpenMenu(job)} />
          ))}
        </View>
      )}
    </View>
  );
}

function JobRow({ job, onMenu }: { job: RecentJob; onMenu: () => void }) {
  const meta = statusMeta(job);
  const thumb = jobThumb(job);
  const area = (job.area || "Nearby").split(",")[0];
  const applications = job.applicantCount ?? 0;

  // Smart icon selection: Role icon > Category icon > Fallback
  const displayIcon = job.roleIcon || job.categoryIcon || "💼";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/jobs/${job.id}`)}
      style={({ pressed }) => [
        styles.jobCard,
        { 
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }
      ]}
    >
      <View style={styles.jobCardInner}>
        {/* Icon + Content */}
        <View style={styles.jobRow}>
          {/* Role/Category Icon */}
          <View style={[styles.jobIcon, { backgroundColor: thumb.bg }]}>
            <Text style={styles.jobIconEmoji}>{displayIcon}</Text>
          </View>
          
          <View style={styles.jobContent}>
            {/* Title + Status */}
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitleNew} numberOfLines={1}>
                {job.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>

            {/* Location + Applications */}
            <View style={styles.jobFooter}>
              <View style={styles.locationTag}>
                <Ionicons name="location" size={11} color={dash.secondary} />
                <Text style={styles.locationText} numberOfLines={1}>{area}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.applicationsTag}>
                <Ionicons 
                  name={applications > 0 ? "people" : "people-outline"} 
                  size={11} 
                  color={applications > 0 ? dash.primary : dash.muted} 
                />
                <Text style={[styles.applicationsText, applications > 0 && { color: dash.primary, fontWeight: "700" }]}>
                  {applications}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Vertical Menu Button */}
        <Pressable
          accessibilityRole="button"
          onPress={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          style={styles.menuBtnNew}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={dash.muted} />
        </Pressable>
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
}: {
  job: RecentJob | null;
  busy: boolean;
  onClose: () => void;
  onView: () => void;
  onResponses: () => void;
  onPause: () => void;
  onResume: () => void;
  onCloseJob: () => void;
}) {
  const status = (job?.status || "").toUpperCase();
  return (
    <Modal visible={!!job} transparent animationType="fade" onRequestClose={onClose}>
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
            <MenuRow icon="close-circle-outline" label="Close Job" onPress={onCloseJob} danger disabled={busy} />
          ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  locationPill: {
    flex: 1,
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  headerLocationText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto", // always pinned to the far right corner
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.42)",
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  avatarText: {
    color: dash.white,
    fontWeight: "800",
    fontSize: 13,
  },
  ctaOuter: {
    alignSelf: "center",
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
  ctaTextWrap: {
    marginHorizontal: 14,
  },
  ctaTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  ctaSub: {
    marginTop: 2,
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "400",
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.4,
  },
  periodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: dash.white,
    borderWidth: 1,
    borderColor: dash.border,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "700",
    color: dash.muted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
    minHeight: 110,
  },
  statCardInner: {
    flex: 1,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
    marginTop: 2,
  },
  statTrend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: 6,
  },
  trendPct: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: dash.primary,
  },
  jobCard: {
    borderRadius: 16,
    backgroundColor: dash.white,
    borderWidth: 2,
    borderColor: "#E8F5F0",
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  jobCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  jobRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
  },
  jobIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  jobIconEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  jobContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  jobTitleNew: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: dash.ink,
    letterSpacing: -0.15,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: dash.muted,
    fontWeight: "500",
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: dash.border,
  },
  applicationsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  applicationsText: {
    fontSize: 11,
    lineHeight: 15,
    color: dash.muted,
    fontWeight: "600",
  },
  menuBtnNew: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
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
