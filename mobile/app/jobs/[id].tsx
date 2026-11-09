import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { UniversalMap, UniversalMapHandle } from "../../src/components/map/UniversalMap";
import { api } from "../../src/api/client";
import { locationApi } from "../../src/api/locationApi";
import type { Job } from "../../src/api/types";
import { formatDirectPhone } from "../../src/utils/phone";
import { formatJobTitle } from "../../src/utils/jobTitle";
import { useAuth } from "../../src/auth";
import { usePostWorkStore } from "../../src/features/post-work/store";
import {
  getExperienceOptionsForRole,
} from "../../src/utils/nameVerification";
import { JobApplicationsModal } from "../../src/components/JobApplicationsModal";
import { CancellationModal } from "../../src/components/CancellationModal";
import { JobDetailSkeleton, Skeleton } from "../../src/components/SkeletonLoader";
import { PageTransition } from "../../src/components/PageTransition";
import { AppImage } from "../../src/components/AppImage";

// ── Design Tokens ──
const theme = {
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  emeraldDark: "#03402D",
  emeraldPrimary: "#047857",
  emeraldLight: "#10B981",
  emeraldSoft: "#ECFDF5",
  ink: "#0F172A",
  charcoal: "#1E293B",
  slate: "#475569",
  muted: "#64748B",
  faint: "#94A3B8",
  borderLight: "#E2E8F0",
  borderSubtle: "#F1F5F9",
  gold: "#D97706",
  goldSoft: "#FEF3C7",
  blueAccent: "#2563EB",
  blueSoft: "#EFF6FF",
};

// ── Helpers ──
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
  const parts = timeStr.trim().split(":");
  const p0 = parts[0];
  const p1 = parts[1];
  if (!p0 || !p1) return timeStr;
  const hour = parseInt(p0, 10);
  const min = p1.slice(0, 2);
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min} ${ampm}`;
}

function getDateDetails(d?: Date | string | number | null) {
  let dateObj: Date;
  if (!d) {
    dateObj = new Date();
  } else if (typeof d === "number") {
    dateObj = new Date(d < 1e11 ? d * 1000 : d);
  } else {
    dateObj = new Date(d);
  }
  if (isNaN(dateObj.getTime())) {
    return {
      month: "DATE",
      day: "1",
      weekday: "Wed",
      fullDate: "Scheduled Date",
    };
  }
  return {
    month: dateObj.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    day: dateObj.toLocaleDateString("en-IN", { day: "numeric" }),
    weekday: dateObj.toLocaleDateString("en-IN", { weekday: "short" }),
    fullDate: dateObj.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

function calculateShiftDuration(start?: string, end?: string): string {
  if (!start || !end) return "Flexible Shift";
  const [shStr, smStr] = start.split(":");
  const [ehStr, emStr] = end.split(":");
  const sh = parseInt(shStr || "9", 10);
  const sm = parseInt(smStr || "0", 10);
  const eh = parseInt(ehStr || "18", 10);
  const em = parseInt(emStr || "0", 10);
  let startMinutes = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
  let endMinutes = (isNaN(eh) ? 18 : eh) * 60 + (isNaN(em) ? 0 : em);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  const diff = endMinutes - startMinutes;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs === 0 && mins === 0) return "Flexible";
  if (mins === 0) return `${hrs} hrs / shift`;
  return `${hrs}h ${mins}m / shift`;
}

function sanitizeTitleWithoutSubject(rawTitle?: string, fallback = "Job Request"): string {
  if (!rawTitle) return fallback;
  const cleaned = formatJobTitle(rawTitle.replace(/\s*\([^)]*\)\s*$/, ""));
  return cleaned || fallback;
}

const JOB_DETAIL_LABELS: Record<string, string> = {
  "gender preference": "Gender preference",
  "preferred tutor gender": "Tutor preference",
  "male tutors required": "Male tutors needed",
  "female tutors required": "Female tutors needed",
  level: "Level",
  class: "Class",
  "syllabus / board": "Board",
  subjects: "Subjects",
  "subject(s)": "Subjects",
  "subject / focus": "Subject focus",
  board: "Board",
  stream: "Stream",
  exam: "Exam",
  examination: "Exam",
  "course / qualification": "Course or qualification",
  "course / technology": "Course or technology",
  "branch / specialization": "Branch or specialization",
  "semester / year": "Semester or year",
  "target year": "Target year",
  "current level": "Current level",
  "skill level": "Skill level",
  "learning goal": "Learning goal",
  "learning objective": "Learning objective",
  "skill / course": "Skill or course",
  "language / skill": "Language or skill",
  "proficiency level": "Proficiency level",
  "experience level": "Experience level",
  students: "Students",
  "number of students": "Students",
  "teaching format": "Teaching format",
  "teaching mode": "Teaching mode",
  "demo class": "Demo class",
  "demo session": "Demo session",
  "demo preference": "Demo preference",
  specialty: "Specialty",
  materials: "Materials",
  delivery: "Delivery",
  vehicle: "Vehicle",
  languages: "Languages",
  timings: "Timings",
  schedule: "Schedule",
  "additional requirements": "Additional requirements",
  "male tutor quantity": "Male tutors needed",
  "female tutor quantity": "Female tutors needed",
};

function getJobOverviewDetails(rawDetails?: string) {
  const raw = (rawDetails || "").trim();
  const attributes: { label: string; value: string }[] = [];
  let remaining = raw;
  const skipKeys = new Set(["category", "location", "work mode", "pay", "budget", "timing", "timings", "schedule", "preferred experience", "tutors required (any gender)"]);
  const humanizeKey = (key: string) => key.replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const bracket = raw.match(/^\[([^\]]+)\]\s*/);
  if (bracket) {
    remaining = raw.slice(bracket[0].length).trim();
    for (const part of bracket[1]!.split(/\s*•\s*/)) {
      const separator = part.indexOf(":");
      if (separator < 0) continue;
      const key = part.slice(0, separator).trim().toLowerCase();
      const value = part.slice(separator + 1).trim();
      if (!skipKeys.has(key) && value) attributes.push({ label: JOB_DETAIL_LABELS[key] || humanizeKey(key), value });
    }
  }

  const descriptionLines: string[] = [];
  for (const originalLine of remaining.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line || /^interested providers can connect through bulao\.?$/i.test(line)) continue;
    if (/^category\s*:/i.test(line)) continue;
    const detailLine = line.match(/^(?:[•·]\s*)?([^:\n]{2,48}):\s*(.+)$/);
    if (detailLine) {
      const key = detailLine[1]!.trim().toLowerCase();
      const value = detailLine[2]!.trim();
      if (skipKeys.has(key)) continue;
      const label = JOB_DETAIL_LABELS[key];
      if (label) {
        attributes.push({ label, value });
        continue;
      }
    }
    descriptionLines.push(originalLine);
  }

  const uniqueAttributes = attributes.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.label === item.label && candidate.value === item.value) === index
  );
  return { attributes: uniqueAttributes, description: descriptionLines.join("\n").trim() };
}

function getRequirementIcon(label: string): keyof typeof Ionicons.glyphMap {
  const l = label.toLowerCase();
  if (l.includes("gender") || l.includes("male") || l.includes("female") || l.includes("tutor") || l.includes("worker") || l.includes("candidate")) {
    return "person-outline";
  }
  if (l.includes("class") || l.includes("grade") || l.includes("subject") || l.includes("education") || l.includes("board") || l.includes("syllabus")) {
    return "school-outline";
  }
  if (l.includes("experience") || l.includes("qualification") || l.includes("skill") || l.includes("certification")) {
    return "ribbon-outline";
  }
  if (l.includes("language") || l.includes("medium") || l.includes("communication")) {
    return "chatbubbles-outline";
  }
  if (l.includes("time") || l.includes("hour") || l.includes("shift") || l.includes("schedule") || l.includes("day") || l.includes("frequency")) {
    return "time-outline";
  }
  if (l.includes("vehicle") || l.includes("license") || l.includes("transport") || l.includes("bike") || l.includes("car")) {
    return "car-outline";
  }
  if (l.includes("tool") || l.includes("equipment") || l.includes("dress") || l.includes("uniform")) {
    return "construct-outline";
  }
  return "checkmark-circle-outline";
}

function formatApproximateDistance(distanceKm?: number) {
  if (distanceKm === undefined || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return "Under 1 km away";
  const lower = Math.floor(distanceKm);
  return `About ${lower}–${lower + 1} km away`;
}

export default function JobDetailScreen() {
  const rawParams = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user: authUser, session: authSession, status: authStatus } = useAuth();
  const token = authSession?.token || null;
  const currentUserId = authUser?.id || authSession?.userId || null;
  const client = useQueryClient();
  const postWorkStore = usePostWorkStore();

  const [applicationsModalVisible, setApplicationsModalVisible] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cancellingJobModal, setCancellingJobModal] = useState(false);
  const [mapHasEnteredView, setMapHasEnteredView] = useState(false);
  const [mapFullScreenOpen, setMapFullScreenOpen] = useState(false);
  const [mapIsReady, setMapIsReady] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);
  const mapViewRef = useRef<UniversalMapHandle>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const mapFrameRef = useRef<View>(null);
  const mapTopInScroll = useRef<number | null>(null);
  const scrollViewportHeight = useRef(0);
  const mapZoomAnimated = useRef(false);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mapZoomAnimated.current = false;
    setMapHasEnteredView(false);
  }, [id]);

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

  const jobQueryKey = ["job", id, currentUserId || "anon"];

  const me = useQuery({
    queryKey: ["me", currentUserId || token],
    enabled: !!token,
    queryFn: () => api<{ id: string }>("/users/me"),
  });

  const jobQuery = useQuery({
    queryKey: jobQueryKey,
    queryFn: () => api<Job>(`/jobs/${id}`),
    enabled: !!id,
    retry: 2,
    staleTime: 2000,
  });

  const job = jobQuery.data;
  // Older jobs can have an address but no saved coordinates. Resolve only the
  // public area name (never the street address), and cache it for a day.
  const areaMapQuery = useQuery({
    queryKey: ["job-area-map", job?.area?.trim().toLowerCase()],
    enabled: !!job &&
      !job.area?.toLowerCase().includes("online") &&
      !/work mode\s*:\s*online/i.test(job.details || "") &&
      !(typeof job.mapLatitude === "number" && Number.isFinite(job.mapLatitude) &&
        typeof job.mapLongitude === "number" && Number.isFinite(job.mapLongitude)) &&
      !!job.area?.trim(),
    queryFn: async () => {
      const matches = await locationApi.searchLocation(`${job!.area}, India`);
      return matches[0] ?? null;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  });
  const hasApproximateMapCenter =
    typeof job?.mapLatitude === "number" && Number.isFinite(job.mapLatitude) &&
    typeof job?.mapLongitude === "number" && Number.isFinite(job.mapLongitude);
  const mapLatitude = hasApproximateMapCenter ? job?.mapLatitude! : areaMapQuery.data?.latitude;
  const mapLongitude = hasApproximateMapCenter ? job?.mapLongitude! : areaMapQuery.data?.longitude;
  const hasMapCenter = typeof mapLatitude === "number" && Number.isFinite(mapLatitude) &&
    typeof mapLongitude === "number" && Number.isFinite(mapLongitude);
  const webMapUrl = hasMapCenter
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapLongitude! - 0.12}%2C${mapLatitude! - 0.08}%2C${mapLongitude! + 0.12}%2C${mapLatitude! + 0.08}&layer=mapnik`
    : null;
  const mapResourceKey = `${job?.id ?? ""}:${mapLatitude ?? ""}:${mapLongitude ?? ""}`;
  useEffect(() => {
    if (!hasMapCenter) return;
    setMapIsReady(false);
    setMapLoadTimedOut(false);
    const timeout = setTimeout(() => setMapLoadTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, [mapResourceKey, hasMapCenter]);
  const showMapLoadingSkeleton = areaMapQuery.isFetching ||
    (hasMapCenter && !mapIsReady && !mapLoadTimedOut);

  // Owner detection
  const effectiveUserId = currentUserId || me.data?.id || null;
  const isOwner = Boolean(
    effectiveUserId &&
    job?.ownerId &&
    String(effectiveUserId).trim().toLowerCase() === String(job.ownerId).trim().toLowerCase()
  );

  // Apply mutation for workers
  const applyMutation = useMutation({
    mutationFn: () => {
      if (isOwner) {
        throw new Error("You are the owner of this job posting and cannot apply to it.");
      }
      return api(`/jobs/${id}/apply`, {});
    },
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ["job", id] });
      const previousJob = client.getQueryData<Job>(jobQueryKey);
      client.setQueryData(jobQueryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          myApplication: { id: "temp", status: "PENDING" },
          applicantCount: (old.applicantCount || 0) + (old.myApplication ? 0 : 1),
        };
      });
      return { previousJob };
    },
    onSuccess: () => {
      setApplyModalVisible(false);
      void client.invalidateQueries({ queryKey: ["activity"] });
      void client.invalidateQueries({ queryKey: ["job", id] });
      void client.invalidateQueries({ queryKey: ["nearby"] });
      void client.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
      showToast("Application submitted successfully!");
    },
    onError: (err: any, _variables, context) => {
      if (context?.previousJob) {
        client.setQueryData(jobQueryKey, context.previousJob);
      }
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
        "You created this job posting. Employers cannot apply to their own job postings.",
        [{ text: "OK" }]
      );
      return;
    }
    setApplyModalVisible(true);
  };

  const handleCancelApplication = async (reason: string) => {
    if (!job?.myApplication?.id) return;
    try {
      await api(`/applications/${job.myApplication.id}/action`, {
        action: "cancel",
        reason,
      });
      void client.invalidateQueries({ queryKey: ["job", id] });
      void client.invalidateQueries({ queryKey: ["activity"] });
      void client.invalidateQueries({ queryKey: ["nearby"] });
      void client.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
      showToast("Job application cancelled.");
    } catch (err: any) {
      Alert.alert("Cancellation Failed", err?.message || "Could not cancel application.");
    }
  };

  const handleEditJob = () => {
    if (!job) return;
    postWorkStore.initForEdit(job);
    router.push("/post-work");
  };

  const handleDeleteJob = () => {
    if (!job) return;
    Alert.alert(
      "Delete Job?",
      "This job and all applicant records will be permanently removed everywhere.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/jobs/${job.id}`, undefined, "DELETE");
              void client.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
              void client.invalidateQueries({ queryKey: ["my-jobs"] });
              void client.invalidateQueries({ queryKey: ["provider-stats"] });
              void client.invalidateQueries({ queryKey: ["activity"] });
              void client.invalidateQueries({ queryKey: ["interactions"] });
              void client.invalidateQueries({ queryKey: ["jobs"] });
              showToast("Job permanently deleted.");
              router.replace("/activity");
            } catch (err: any) {
              Alert.alert("Delete Failed", err?.message || "Could not delete job.");
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!job) return;
    const title = sanitizeTitleWithoutSubject(job.customTitle || job.title);
    const pay = `₹${Math.round(job.payPaise / 100).toLocaleString("en-IN")} / ${job.payUnit}`;
    const text = `📢 BULAO WORK OPPORTUNITY\n💼 Role: ${job.roleName || title}\n💰 Wage: ${pay} (Direct Payout)\n👥 Workers: ${job.workers || 1}\n📍 Location: ${job.area}\n📅 Date: ${new Date(job.startsAt * 1000).toLocaleDateString("en-IN")}\n\nView details: bulao://jobs/${job.id}`;
    try {
      await Share.share({
        title: `Work Opportunity: ${title}`,
        message: text,
      });
    } catch {
      // ignore
    }
  };

  // Coordinates
  const rawLat = job?.latitude !== undefined && job?.latitude !== null ? parseFloat(String(job.latitude)) : NaN;
  const rawLng = job?.longitude !== undefined && job?.longitude !== null ? parseFloat(String(job.longitude)) : NaN;
  const hasExactCoords = !isNaN(rawLat) && !isNaN(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180 && (rawLat !== 0 || rawLng !== 0);
  const handleOpenMaps = async () => {
    if (!job || !canNavigateToWorksite) return;
    let url = "";
    if (hasExactCoords) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${rawLat},${rawLng}`;
    } else if (job.address?.trim()) {
      const query = job.address ? `${job.address}, ${job.area}` : job.area;
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
    } else {
      Alert.alert("Directions unavailable", "The provider has not added a precise address for this worksite.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open maps", "Your device could not open a maps app. You can still use the address shown here.");
    }
  };

  const handleCall = async (phoneNumber?: string | null) => {
    if (phoneNumber) {
      try {
        await Linking.openURL(`tel:${phoneNumber}`);
      } catch {
        Alert.alert("Unable to call", "Your device could not open the phone app. You can still use the number shown in the job details.");
      }
    } else {
      Alert.alert("Contact Unavailable", "Phone number is not available.");
    }
  };

  const dynamicExperienceOptions = useMemo(() => {
    if (!job) return [];
    return getExperienceOptionsForRole(
      job.roleId || "",
      job.roleName || job.title || "",
      job.categoryId || ""
    );
  }, [job?.roleId, job?.roleName, job?.title, job?.categoryId]);

  const waitingForIdentity = !!token && !authUser?.id && !authSession?.userId && me.isPending;
  if (authStatus === "bootstrapping" || waitingForIdentity || (jobQuery.isPending && !job)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.emeraldDark }} edges={["top"]}>
        <StatusBar style="light" />
        <JobDetailSkeleton bottomInset={insets.bottom} />
      </SafeAreaView>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <SafeAreaView style={styles.stateCenter}>
        <Ionicons name="alert-circle-outline" size={56} color="#DC2626" />
        <Text style={styles.errorHeading}>Job Unavailable</Text>
        <Text style={styles.errorSubtext}>
          {jobQuery.error instanceof Error && jobQuery.error.message
            ? jobQuery.error.message
            : "This job was deleted and is no longer available."}
        </Text>
        <Pressable
          style={styles.errorBackBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/find-work");
          }}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.errorBackBtnText}>Go to Jobs</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (job.status === "DELETED") {
    const isOwner = Boolean(
      effectiveUserId &&
      job.ownerId &&
      String(effectiveUserId).trim().toLowerCase() === String(job.ownerId).trim().toLowerCase()
    );
    return (
      <SafeAreaView style={styles.stateCenter}>
        <Ionicons name="trash-outline" size={56} color="#DC2626" />
        <Text style={styles.errorHeading}>Job Unavailable</Text>
        <Text style={styles.errorSubtext}>
          {isOwner
            ? "You deleted this job listing. It is permanently removed from active listings and is unavailable."
            : "This job was deleted by the employer and is no longer available."}
        </Text>
        <Pressable
          style={styles.errorBackBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace(isOwner ? "/activity" : "/find-work");
          }}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.errorBackBtnText}>
            {isOwner ? "Back to My Jobs" : "Find Other Jobs"}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const displayTitle = sanitizeTitleWithoutSubject(
    job.customTitle || job.title,
    job.roleName || "Work Opportunity"
  );
  const categoryLabel = job.categoryName || "General work";
  const roleLabel = job.roleName || "this job";

  // Date and duration calculations
  const startDateDetails = getDateDetails(job.startsAt);
  const endDateDetails = job.endsAt ? getDateDetails(job.endsAt) : null;
  const isMultiDay = Boolean(job.duration === "few" && job.endsAt);
  const totalDays = isMultiDay && job.endsAt ? Math.max(1, Math.round((job.endsAt - job.startsAt) / 86400)) : 1;

  // Timing Formatting
  const startClock = formatClockTime(job.startTime, "09:00 AM");
  const endClock = formatClockTime(job.endTime, "06:00 PM");
  // Experience level
  const matchedExp =
    dynamicExperienceOptions.find((o) => o.value === job.experience) ||
    (job.experience === "expert"
      ? { badge: "Expert", label: "3+ Years", icon: "👑" }
      : job.experience === "some"
      ? { badge: "Experienced", label: "1–2 Years", icon: "⚡" }
      : { badge: "Any Level", label: "Fresher / Any", icon: "🌱" });

  // Wage
  const wagePerUnit = Math.round(job.payPaise / 100).toLocaleString("en-IN");
  const payWhenMap: Record<string, string> = {
    after: "Paid upon completion",
    daily: "Paid same day / daily",
    weekly: "Paid weekly",
    monthly: "Paid monthly at month end",
  };
  const payScheduleText = payWhenMap[job.paidWhen || "after"] || "Paid upon completion";

  const totalWorkers = Math.max(1, job.workers || 1);
  const acceptedWorkers = Math.max(0, job.acceptedCount ?? (totalWorkers - (job.remainingWorkers ?? totalWorkers)));
  const remainingWorkers = Math.max(0, job.remainingWorkers ?? (totalWorkers - acceptedWorkers));
  const extrasList = Array.isArray(job.extras) ? job.extras : [];
  const applicantsList = Array.isArray(job.applicants) ? job.applicants : [];
  const applicantsCount = job.applicantCount || applicantsList.length || 0;
  const hasActiveApplication = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(job.myApplication?.status || "");
  const isStopped = job.status === "PAUSED";
  const isFilled = job.status === "FILLED" || remainingWorkers === 0;
  const isClosed = ["CANCELLED", "COMPLETED", "DELETED", "EXPIRED"].includes(job.status);
  const isUnavailable = isStopped || isFilled || isClosed;
  const isOnline = Boolean(
    job.area?.toLowerCase().includes("online") || /work mode\s*:\s*online/i.test(job.details || "")
  );
  const rawWorkMode = job.details.match(/work mode\s*:\s*(online|home|center|site|flexible)/i)?.[1]?.toLowerCase();
  const workModeLabel = isOnline
    ? "Online"
    : rawWorkMode === "center"
      ? "At a center"
      : rawWorkMode === "home"
        ? "At employer’s location"
        : rawWorkMode === "flexible"
          ? "Flexible"
          : "On site";
  const isAcceptedSeeker = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(job.myApplication?.status || "");
  const canViewExactLocation = !isOnline && (isOwner || isAcceptedSeeker);
  const hasDestination = hasExactCoords || Boolean(job.address?.trim());
  const canNavigateToWorksite = !isOwner && !isOnline &&
    ["ACCEPTED", "IN_PROGRESS"].includes(job.myApplication?.status || "") && hasDestination;

  const overviewDetails = getJobOverviewDetails(job.details);
  const approximateDistance = formatApproximateDistance(job.distanceKm);
  const hasProviderRating = typeof job.ownerRating === "number" && job.ownerRating > 0;
  const handleOverviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (mapZoomAnimated.current || mapTopInScroll.current === null || scrollViewportHeight.current === 0) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    const mapTop = mapTopInScroll.current;
    const mapBottom = mapTop + 148;
    const viewportBottom = scrollY + scrollViewportHeight.current;
    if (viewportBottom <= mapTop || scrollY >= mapBottom) return;

    mapZoomAnimated.current = true;
    setMapHasEnteredView(true);
    if (Platform.OS !== "web" && hasMapCenter) {
      mapViewRef.current?.animateToRegion({
        latitude: mapLatitude!,
        longitude: mapLongitude!,
        latitudeDelta: 0.16,
        longitudeDelta: 0.16,
      }, 900);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        pointerEvents="none"
        colors={[theme.emeraldDark, "#0B6046", theme.canvas]}
        locations={[0, 0.42, 1]}
        style={[styles.topPageGradient, { height: Math.round(windowHeight * 0.3) }]}
      />
      <View style={{ height: insets.top, backgroundColor: "transparent" }} />
      <StatusBar style="light" />
      <PageTransition style={{ flex: 1 }}>
        {/* ── 1. CLEAN APP HEADER ── */}
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
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.navCenter}>
            <Text style={styles.navTitle}>Job details</Text>
          </View>

          <View style={{ width: 36, alignItems: "flex-end" }}>
            <Pressable
              style={styles.navRoundBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share"
              hitSlop={8}
            >
              <Ionicons name="share-social-outline" size={19} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* ── Floating Toast ── */}
        {toastMessage && (
          <Animated.View
            style={[
              styles.toastBox,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}

        {/* ── JOB OVERVIEW ── */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={[styles.overviewContent, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => { scrollViewportHeight.current = event.nativeEvent.layout.height; }}
          onScroll={handleOverviewScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.introCard}>
            <View style={styles.introTopRow}>
              <Text style={styles.categoryEyebrow} numberOfLines={1}>{categoryLabel}</Text>
              <View style={[styles.statusPill, isStopped ? styles.statusPillPaused : isFilled || isClosed ? styles.statusPillClosed : styles.statusPillOpen]}>
                <View style={[styles.statusDot, isStopped ? styles.statusDotPaused : isFilled || isClosed ? styles.statusDotClosed : styles.statusDotOpen]} />
                <Text style={[styles.statusText, isStopped ? styles.statusTextPaused : isFilled || isClosed ? styles.statusTextClosed : styles.statusTextOpen]}>
                  {isStopped ? "Paused" : isFilled ? "Filled" : isClosed ? "Closed" : "Open"}
                </Text>
              </View>
            </View>

            <Text style={styles.overviewTitle}>{displayTitle}</Text>

            <View style={styles.providerRow}>
              <Pressable
                style={styles.providerProfileButton}
                onPress={() => router.push({ pathname: "/profile/[id]", params: { id: job.ownerId, jobId: job.id } })}
                accessibilityRole="button"
                accessibilityLabel={`View ${job.ownerName || "provider"}'s profile`}
                hitSlop={4}
              >
                <View style={styles.providerAvatar}>
                  {job.ownerPhotoUrl ? (
                    <AppImage source={{ uri: job.ownerPhotoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Text style={styles.providerInitial}>{(job.ownerName || "P").trim().charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.providerIdentity}>
                  <View style={styles.providerNameLine}>
                    <Text style={styles.providerName} numberOfLines={1}>{job.ownerName || "Provider"}</Text>
                    {job.ownerVerified ? <View style={styles.phoneVerifiedTag}><Ionicons name="checkmark-circle" size={12} color={theme.emeraldPrimary} /><Text style={styles.phoneVerifiedText}>Phone verified</Text></View> : null}
                  </View>
                  <View style={styles.providerRatingLine}>
                    <Ionicons name={hasProviderRating ? "star" : "star-outline"} size={12} color={hasProviderRating ? theme.gold : theme.faint} />
                    <Text style={styles.providerRatingText}>{hasProviderRating ? job.ownerRating!.toFixed(1) : "New provider"}</Text>
                    {hasProviderRating && job.ownerReviewsCount ? <Text style={styles.providerReviewText}>· {job.ownerReviewsCount} reviews</Text> : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.faint} />
              </Pressable>
              {!isOwner && job.ownerPhone ? (
                <Pressable style={styles.providerCallButton} onPress={() => handleCall(job.ownerPhone)} accessibilityRole="button" accessibilityLabel="Call provider">
                  <Ionicons name="call-outline" size={16} color={theme.emeraldDark} />
                  <Text style={styles.providerCallText}>Call</Text>
                </Pressable>
              ) : !isOwner && job.ownerId ? (
                <Pressable style={styles.reportButton} onPress={() => router.push({ pathname: "/safety", params: { targetId: job.ownerId } })} accessibilityRole="button" accessibilityLabel="Report provider">
                  <Ionicons name="flag-outline" size={16} color={theme.slate} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {isOwner ? (
            <Pressable style={styles.applicantHubCard} onPress={() => setApplicationsModalVisible(true)} accessibilityRole="button" accessibilityLabel="View applications">
              <View style={styles.applicantHubIconCircle}><Ionicons name="people" size={19} color={theme.emeraldDark} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.applicantHubCount}>{applicantsCount} {applicantsCount === 1 ? "applicant" : "applicants"}</Text>
                <Text style={styles.applicantHubSubtext}>{applicantsCount ? "Review applications for this job" : "Your posting is visible to nearby workers"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.emeraldDark} />
            </Pressable>
          ) : null}

          <View style={styles.payCard}>
            <View style={styles.payCardMain}>
              <Text style={styles.sectionEyebrow}>PAY RATE</Text>
              <View style={styles.payAmountLine}>
                <Text style={styles.payCurrency}>₹</Text>
                <Text style={styles.payAmount}>{wagePerUnit}</Text>
                <Text style={styles.payUnit}>/ {job.payUnit}</Text>
              </View>
            </View>
            <View style={styles.payDivider} />
            <View style={styles.payTimingBlock}>
              <Ionicons name="wallet-outline" size={16} color={theme.emeraldDark} />
              <Text style={styles.payTimingText}>{payScheduleText}</Text>
            </View>
          </View>

          <View style={styles.overviewSection}>
            <Text style={styles.sectionTitle}>At a glance</Text>
            <View style={styles.factsGrid}>
              <View style={styles.factCell}>
                <View style={styles.factLabelRow}><Ionicons name="calendar-outline" size={14} color={theme.emeraldPrimary} /><Text style={styles.factLabel}>WHEN</Text></View>
                <Text style={styles.factValue}>{startDateDetails.fullDate}</Text>
                <Text style={styles.factSubValue}>{startClock}{endClock ? ` – ${endClock}` : ""}</Text>
                {isMultiDay && endDateDetails ? <Text style={styles.factSubValue}>Until {endDateDetails.fullDate}</Text> : null}
              </View>
              <View style={styles.factCell}>
                <View style={styles.factLabelRow}><Ionicons name="people-outline" size={14} color={theme.emeraldPrimary} /><Text style={styles.factLabel}>MEMBERS NEEDED</Text></View>
                <Text style={styles.factValue}>{acceptedWorkers} of {totalWorkers} accepted</Text>
                <Text style={styles.factSubValue}>{remainingWorkers > 0 ? `${remainingWorkers} ${remainingWorkers === 1 ? "spot" : "spots"} remaining` : "All spots filled"}</Text>
              </View>
              <View style={styles.factCell}>
                <View style={styles.factLabelRow}><Ionicons name="sparkles-outline" size={14} color={theme.emeraldPrimary} /><Text style={styles.factLabel}>EXPERIENCE</Text></View>
                <Text style={styles.factValue}>{matchedExp.label}</Text>
                <Text style={styles.factSubValue}>{matchedExp.badge}</Text>
              </View>
              <View style={styles.factCell}>
                <View style={styles.factLabelRow}><Ionicons name={isOnline ? "laptop-outline" : "business-outline"} size={14} color={theme.emeraldPrimary} /><Text style={styles.factLabel}>WORK TYPE</Text></View>
                <Text style={styles.factValue}>{workModeLabel}</Text>
                <Text style={styles.factSubValue}>{isOnline ? "No commute" : "In person"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.overviewSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationPrivacyBadge}>
                <Ionicons name={isOnline ? "globe-outline" : canViewExactLocation ? "lock-open-outline" : "lock-closed-outline"} size={12} color={theme.emeraldDark} />
                <Text style={styles.locationPrivacyBadgeText}>{isOnline ? "Online" : canViewExactLocation ? "Shared with you" : "Private until accepted"}</Text>
              </View>
            </View>
            {!isOnline ? (
              <View
                ref={mapFrameRef}
                style={styles.areaMapFrame}
                onLayout={() => {
                  mapFrameRef.current?.measureLayout(
                    scrollViewRef.current as any,
                    (_x, y) => { mapTopInScroll.current = y; },
                    () => {},
                  );
                }}
                accessibilityLabel={`Approximate map area for ${job.area}. No exact worksite pin is shown.`}
              >
                {Platform.OS === "web" && webMapUrl ? (
                  <>
                    {React.createElement("iframe" as any, {
                      key: `map-${mapResourceKey}`,
                      title: `Approximate map of ${job.area || "work area"}`,
                      src: webMapUrl,
                      loading: "lazy",
                      onLoad: () => setMapIsReady(true),
                      referrerPolicy: "no-referrer",
                      style: {
                        position: "absolute", inset: 0, width: "100%", height: "100%", border: 0,
                        transform: mapHasEnteredView ? "scale(1.18)" : "scale(1)",
                        transition: "transform 900ms cubic-bezier(0.2, 0.75, 0.25, 1)",
                      },
                    })}
                    <View pointerEvents="none" style={styles.webMapAreaHighlight}>
                      <View style={styles.webMapAreaRing} />
                      <View style={styles.webMapAreaName}>
                        <Ionicons name="map-outline" size={13} color={theme.emeraldDark} />
                        <Text style={styles.webMapAreaNameText} numberOfLines={1}>{job.area || "Work area"}</Text>
                      </View>
                    </View>
                  </>
                ) : Platform.OS !== "web" && hasMapCenter ? (
                  <UniversalMap
                    key={`map-${mapResourceKey}`}
                    ref={mapViewRef}
                    latitude={mapLatitude!}
                    longitude={mapLongitude!}
                    locality={job.area || "Work area"}
                    radiusKm={2.8}
                    interactive={false}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <View style={styles.areaMapFallback}>
                    <Ionicons name="map-outline" size={26} color={theme.emeraldDark} />
                    <Text style={styles.areaMapFallbackText}>{job.area || "Work area"}</Text>
                    <Text style={styles.areaMapFallbackHint}>
                      {areaMapQuery.isFetching ? "Loading area map…" : "Map preview unavailable"}
                    </Text>
                  </View>
                )}
                {showMapLoadingSkeleton ? (
                  <View pointerEvents="none" style={styles.mapLoadingOverlay}>
                    <Skeleton width="100%" height={148} borderRadius={16} />
                  </View>
                ) : null}
                <View style={styles.mapPrivacyPill}>
                  <Ionicons name="shield-checkmark" size={12} color={theme.emeraldDark} />
                  <Text style={styles.mapPrivacyPillText}>Approximate area · no pin</Text>
                </View>
                {hasMapCenter ? (
                  <Pressable
                    style={styles.mapExpandButton}
                    onPress={() => setMapFullScreenOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Open approximate area map full screen"
                    hitSlop={6}
                  >
                    <Ionicons name="expand-outline" size={17} color={theme.emeraldDark} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.locationCard}>
              <View style={styles.locationPin}><Ionicons name={isOnline ? "laptop-outline" : "location"} size={18} color={theme.emeraldDark} /></View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationArea}>{isOnline ? "Online work" : job.area || "Worksite area"}</Text>
                {isOnline ? (
                  <Text style={styles.locationSupportingText}>The provider will share session details after acceptance.</Text>
                ) : canViewExactLocation ? (
                  <>
                    <Text style={styles.locationAddress}>
                      {job.address?.trim() || (hasExactCoords ? "Precise worksite location set" : "Exact worksite address not added yet")}
                    </Text>
                    {approximateDistance ? <Text style={styles.locationSupportingText}>{approximateDistance} from your selected area</Text> : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.locationSupportingText}>{approximateDistance || "Approximate area shared before acceptance"}</Text>
                    <Text style={styles.locationPrivacyText}>The exact meeting point is shared if your application is accepted.</Text>
                  </>
                )}
              </View>
            </View>
            {canNavigateToWorksite ? (
              <Pressable style={styles.directionsButton} onPress={() => void handleOpenMaps()} accessibilityRole="button" accessibilityLabel="Open directions to the exact worksite">
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                <Text style={styles.directionsButtonText}>Open directions</Text>
                <Ionicons name="arrow-up-right-box" size={14} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {overviewDetails.description || overviewDetails.attributes.length ? (
            <View style={styles.overviewSection}>
              <View style={styles.aboutHeadingRow}>
                <View style={styles.aboutHeadingIcon}>
                  <Ionicons name="document-text" size={18} color={theme.emeraldDark} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.sectionTitle}>About this job</Text>
                  <Text style={styles.aboutHeadingHint}>
                    {overviewDetails.description && overviewDetails.attributes.length
                      ? "Key requirements and role description"
                      : overviewDetails.attributes.length
                        ? "Specific requirements for this role"
                        : "What this work involves"}
                  </Text>
                </View>
                {job.categoryName ? (
                  <View style={styles.aboutCategoryTag}>
                    <Text style={styles.aboutCategoryTagText}>{job.categoryName}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.aboutCard}>
                {/* 1. Key Requirements & Attributes */}
                {overviewDetails.attributes.length ? (
                  <View style={styles.aboutSectionBlock}>
                    <View style={styles.aboutBlockHeader}>
                      <Ionicons name="sparkles" size={13} color={theme.emeraldDark} />
                      <Text style={styles.aboutBlockHeaderText}>ROLE REQUIREMENTS</Text>
                    </View>
                    <View style={styles.aboutDetailsGrid}>
                      {overviewDetails.attributes.map((item) => (
                        <View
                          key={`${item.label}-${item.value}`}
                          style={[
                            styles.aboutDetailTile,
                            overviewDetails.attributes.length === 1 && styles.aboutDetailTileWide,
                          ]}
                        >
                          <View style={styles.aboutTileIconRing}>
                            <Ionicons name={getRequirementIcon(item.label)} size={15} color={theme.emeraldDark} />
                          </View>
                          <View style={styles.aboutTileContent}>
                            <Text style={styles.requirementLabel} numberOfLines={1}>{item.label}</Text>
                            <Text style={styles.requirementValue} numberOfLines={2}>{item.value}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Divider between Attributes and Description if both exist */}
                {overviewDetails.description && overviewDetails.attributes.length ? (
                  <View style={styles.aboutDivider} />
                ) : null}

                {/* 2. Work Details & Description Bubble */}
                {overviewDetails.description ? (
                  <View style={styles.aboutDescriptionBlock}>
                    <View style={styles.aboutBlockHeader}>
                      <Ionicons name="reader-outline" size={13} color={theme.emeraldDark} />
                      <Text style={styles.aboutBlockHeaderText}>WORK DETAILS & OVERVIEW</Text>
                    </View>
                    <View style={styles.descriptionBubble}>
                      <Text style={styles.descriptionText}>{overviewDetails.description}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Trust Footnote */}
                <View style={styles.aboutTrustFootnote}>
                  <Ionicons name="shield-checkmark" size={13} color={theme.emeraldDark} />
                  <Text style={styles.aboutTrustFootnoteText}>
                    Verified requirements shared directly by the employer
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {extrasList.length ? (
            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>What’s included</Text>
              <View style={styles.extrasWrap}>
                {extrasList.map((item, index) => <View key={`${item}-${index}`} style={styles.extraChip}><Ionicons name="checkmark-circle-outline" size={14} color={theme.emeraldDark} /><Text style={styles.extraChipText}>{item}</Text></View>)}
              </View>
            </View>
          ) : null}
        </ScrollView>
        {/* ── 6. STRATEGIC BOTTOM DOCK ── */}
        <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {isOwner ? (
            <View style={styles.ownerActionRow}>
              <Pressable
                style={styles.viewAppsButton}
                onPress={() => setApplicationsModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="View Applications"
              >
                <Ionicons name="people" size={17} color="#FFFFFF" />
                <Text style={styles.viewAppsButtonText}>
                  Applications ({applicantsCount})
                </Text>
              </Pressable>

              <Pressable
                style={styles.editJobButton}
                onPress={handleEditJob}
                accessibilityRole="button"
                accessibilityLabel="Edit Job"
              >
                <Ionicons name="create-outline" size={16} color={theme.emeraldDark} />
                <Text style={styles.editJobButtonText}>Edit</Text>
              </Pressable>

              <Pressable
                style={styles.deleteJobOwnerBtn}
                onPress={handleDeleteJob}
                accessibilityRole="button"
                accessibilityLabel="Delete Job"
              >
                <Ionicons name="trash-outline" size={17} color="#DC2626" />
              </Pressable>
            </View>
          ) : job?.myApplication && hasActiveApplication ? (
            <View style={styles.workerStatusRow}>
              {job.myApplication.status === "ACCEPTED" || job.myApplication.status === "IN_PROGRESS" ? (
                <View style={styles.appStatusAcceptedBox}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.emeraldDark} />
                  <Text style={styles.appStatusAcceptedText}>{job.myApplication.status === "IN_PROGRESS" ? "Work in progress" : "Application accepted"}</Text>
                </View>
              ) : job.myApplication.status === "PENDING" ? (
                <View style={{ flex: 1, flexDirection: "row", gap: 10 }}>
                  <View style={styles.appStatusPendingBox}>
                    <Ionicons name="time-outline" size={16} color="#B45309" />
                    <Text style={styles.appStatusPendingText}>Under Review</Text>
                  </View>
                  <Pressable
                    style={styles.appWithdrawBtn}
                    onPress={() => {
                      Alert.alert(
                        "Cancel Application?",
                        "Are you sure you want to cancel your application for this job?",
                        [
                          { text: "Keep Application", style: "cancel" },
                          {
                            text: "Yes, Cancel",
                            style: "destructive",
                            onPress: () => setCancellingJobModal(true),
                          },
                        ]
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel Application"
                  >
                    <Ionicons name="close-circle-outline" size={14} color="#E11D48" />
                    <Text style={styles.appWithdrawText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.appStatusCompletedBox}>
                  <Text style={styles.appStatusCompletedText}>Application Closed</Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={[
                styles.applyFullButton,
                isUnavailable && styles.applyFullButtonDisabled,
              ]}
              onPress={handleInitiateApply}
              disabled={isUnavailable}
              accessibilityRole="button"
            >
              <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
              <Text style={styles.applyFullButtonText}>
                {isStopped
                  ? "Position On Hold"
                  : isFilled
                  ? "Position Filled"
                  : job.status === "EXPIRED"
                  ? "Applications Closed"
                  : isClosed
                  ? "Applications Closed"
                  : "Apply for this Job"}
              </Text>
            </Pressable>
          )}
        </View>

        <Modal
          visible={mapFullScreenOpen}
          animationType="slide"
          onRequestClose={() => setMapFullScreenOpen(false)}
        >
          <SafeAreaView style={styles.fullMapScreen} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.fullMapHeader}>
              <Pressable
                style={styles.fullMapCloseButton}
                onPress={() => setMapFullScreenOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close full screen map"
                hitSlop={8}
              >
                <Ionicons name="close" size={21} color="#FFFFFF" />
              </Pressable>
              <View style={styles.fullMapHeading}>
                <Text style={styles.fullMapTitle} numberOfLines={1}>{job.area || "Work area"}</Text>
                <Text style={styles.fullMapSubtitle}>Approximate area · exact location hidden</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.fullMapCanvas}>
              {Platform.OS === "web" && webMapUrl ? (
                <>
                  {React.createElement("iframe" as any, {
                    key: `full-map-${mapResourceKey}`,
                    title: `Full screen approximate map of ${job.area || "work area"}`,
                    src: webMapUrl,
                    loading: "eager",
                    referrerPolicy: "no-referrer",
                    style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 },
                  })}
                  <View pointerEvents="none" style={styles.webMapAreaHighlight}>
                    <View style={styles.webMapAreaRing} />
                    <View style={styles.webMapAreaName}>
                      <Ionicons name="map-outline" size={13} color={theme.emeraldDark} />
                      <Text style={styles.webMapAreaNameText} numberOfLines={1}>{job.area || "Work area"}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <UniversalMap
                  key={`full-map-${mapResourceKey}`}
                  latitude={mapLatitude!}
                  longitude={mapLongitude!}
                  locality={job.area || "Work area"}
                  radiusKm={2.8}
                  interactive={true}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={styles.fullMapPrivacyPill}>
                <Ionicons name="shield-checkmark" size={13} color={theme.emeraldDark} />
                <Text style={styles.mapPrivacyPillText}>Approximate area · no pin</Text>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* ── APPLICATIONS MODAL ── */}
        <JobApplicationsModal
          visible={applicationsModalVisible}
          jobId={id}
          jobTitle={displayTitle}
          initialApplicants={applicantsList}
          initialApplicantCount={applicantsCount}
          onClose={() => setApplicationsModalVisible(false)}
        />

        {/* ── CANCELLATION MODAL ── */}
        <CancellationModal
          visible={cancellingJobModal}
          title="Cancel Job Application"
          isProvider={false}
          onClose={() => setCancellingJobModal(false)}
          onConfirm={handleCancelApplication}
        />

        {/* ── APPLY PROMPT MODAL ── */}
        <Modal
          visible={applyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setApplyModalVisible(false)}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={styles.applyPromptCard}>
              <View style={styles.applyPromptIconRing}>
                <Ionicons name="paper-plane" size={22} color={theme.emeraldDark} />
              </View>
              <Text style={styles.applyPromptTitle}>Apply for {roleLabel}?</Text>
              <Text style={styles.applyPromptDesc}>
                The employer can review your application. Your phone number stays private until your application is accepted.
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
      </PageTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.canvas,
  },
  topPageGradient: { position: "absolute", top: 0, left: 0, right: 0 },
  stateCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: theme.canvas,
  },
  errorHeading: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
  },
  errorSubtext: {
    color: theme.muted,
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
    backgroundColor: theme.emeraldDark,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 20,
  },
  errorBackBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Top Nav */
  topNav: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  navRoundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  navCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  navSerialPill: {
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 2,
  },
  navSerialText: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.emeraldDark,
    letterSpacing: 0.6,
  },

  /* Toast Notification */
  toastBox: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 99,
    backgroundColor: theme.emeraldDark,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },

  /* Scroll Container */
  scrollContainer: {
    flex: 1,
  },
  overviewContent: {
    paddingHorizontal: 14,
    paddingTop: 9,
    gap: 10,
  },
  introCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.borderLight,
    padding: 14,
    shadowColor: "#10271D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 2,
  },
  introTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  categoryEyebrow: { flex: 1, color: theme.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  statusPillOpen: { backgroundColor: "#EAF5EE" },
  statusPillPaused: { backgroundColor: theme.goldSoft },
  statusPillClosed: { backgroundColor: theme.borderSubtle },
  statusDotOpen: { backgroundColor: theme.emeraldPrimary },
  statusDotPaused: { backgroundColor: theme.gold },
  statusDotClosed: { backgroundColor: theme.faint },
  statusText: { fontSize: 10.5, fontWeight: "800" },
  statusTextOpen: { color: theme.emeraldDark },
  statusTextPaused: { color: "#9A5E00" },
  statusTextClosed: { color: theme.slate },
  overviewTitle: { color: theme.ink, fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.55, marginTop: 9 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderSubtle },
  providerProfileButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  providerAvatar: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#E6F0E9" },
  providerInitial: { color: theme.emeraldDark, fontSize: 17, fontWeight: "800" },
  providerIdentity: { flex: 1, minWidth: 0, gap: 3 },
  providerNameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  providerName: { flexShrink: 1, color: theme.ink, fontSize: 13, fontWeight: "750" as any },
  phoneVerifiedTag: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0 },
  phoneVerifiedText: { color: theme.emeraldDark, fontSize: 9.5, fontWeight: "700" },
  providerRatingLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  providerRatingText: { color: theme.slate, fontSize: 11, fontWeight: "700" },
  providerReviewText: { color: theme.muted, fontSize: 10.5, fontWeight: "500" },
  providerCallButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.emeraldSoft },
  providerCallText: { color: theme.emeraldDark, fontSize: 11.5, fontWeight: "800" },
  reportButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.borderSubtle },
  payCard: { backgroundColor: "#EAF5EE", borderRadius: 16, borderWidth: 1, borderColor: "#D7E9DC", padding: 13, gap: 9 },
  payCardMain: { gap: 4 },
  sectionEyebrow: { color: "#668074", fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  payAmountLine: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  payCurrency: { color: theme.emeraldDark, fontSize: 20, fontWeight: "800" },
  payAmount: { color: theme.emeraldDark, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.7 },
  payUnit: { color: "#4C6D5C", fontSize: 14, fontWeight: "700" },
  payDivider: { height: 1, backgroundColor: "#D3E5D9" },
  payTimingBlock: { flexDirection: "row", alignItems: "center", gap: 7 },
  payTimingText: { color: "#375C49", fontSize: 12, fontWeight: "650" as any },
  overviewSection: { gap: 7 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: theme.ink, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  factsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  factCell: { width: "48%", minHeight: 86, justifyContent: "center", backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: 11, paddingVertical: 10 },
  factLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  factLabel: { color: theme.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6, flexShrink: 1 },
  factValue: { color: theme.ink, fontSize: 13, lineHeight: 18, fontWeight: "750" as any },
  factSubValue: { color: theme.slate, fontSize: 11, lineHeight: 16, marginTop: 2 },
  locationPrivacyBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.emeraldSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  locationPrivacyBadgeText: { color: theme.emeraldDark, fontSize: 9.5, fontWeight: "700" },
  areaMapFrame: { height: 148, overflow: "hidden", position: "relative", borderRadius: 15, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: "#E8EFE9" },
  mapLoadingOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 16, overflow: "hidden" },
  areaMapFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#EAF1EB" },
  areaMapFallbackText: { color: theme.emeraldDark, fontSize: 12, fontWeight: "700" },
  areaMapFallbackHint: { color: theme.slate, fontSize: 10, fontWeight: "500" },
  mapPrivacyPill: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "rgba(226,232,240,0.9)" },
  mapPrivacyPillText: { color: theme.emeraldDark, fontSize: 10, fontWeight: "800" },
  mapExpandButton: { position: "absolute", top: 9, right: 9, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: "rgba(226,232,240,0.95)", elevation: 3 },
  fullMapScreen: { flex: 1, backgroundColor: "#F8FAFC" },
  fullMapHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.emeraldDark },
  fullMapCloseButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  fullMapHeading: { flex: 1, minWidth: 0, gap: 3 },
  fullMapTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  fullMapSubtitle: { color: "rgba(255,255,255,0.72)", fontSize: 10.5, fontWeight: "600" },
  fullMapCanvas: { flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#E8EFE9" },
  fullMapPrivacyPill: { position: "absolute", top: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: "rgba(226,232,240,0.9)", elevation: 3 },
  webMapAreaHighlight: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  webMapAreaRing: { position: "absolute", width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: "rgba(4,120,87,0.8)", backgroundColor: "rgba(16,185,129,0.12)" },
  webMapAreaName: { maxWidth: "78%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: "rgba(4,120,87,0.28)", elevation: 3, shadowColor: "#0F172A", shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  webMapAreaNameText: { flexShrink: 1, color: theme.emeraldDark, fontSize: 11, fontWeight: "800" },
  nativeMapAreaName: { maxWidth: 190, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: "rgba(4,120,87,0.32)", elevation: 4 },
  nativeMapAreaNameText: { flexShrink: 1, color: theme.emeraldDark, fontSize: 11, fontWeight: "800" },
  locationCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight, borderRadius: 14, padding: 12 },
  locationPin: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: theme.emeraldSoft },
  locationCopy: { flex: 1, minWidth: 0, gap: 3 },
  locationArea: { color: theme.ink, fontSize: 13, fontWeight: "800" },
  locationAddress: { color: theme.slate, fontSize: 12, lineHeight: 17 },
  locationSupportingText: { color: theme.muted, fontSize: 11, lineHeight: 16 },
  locationPrivacyText: { color: theme.emeraldDark, fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 3 },
  directionsButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderRadius: 13, backgroundColor: theme.emeraldDark },
  directionsButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  aboutHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  aboutHeadingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1EADB",
  },
  aboutHeadingHint: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
  aboutCategoryTag: {
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#D5EADA",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aboutCategoryTagText: {
    color: theme.emeraldDark,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  aboutCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECE5",
    borderRadius: 20,
    padding: 16,
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: "#0D2318", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  aboutSectionBlock: {
    gap: 10,
  },
  aboutBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  aboutBlockHeaderText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: theme.emeraldDark,
    letterSpacing: 0.7,
  },
  aboutDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  aboutDetailTile: {
    width: "48%",
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#E5EEE8",
  },
  aboutDetailTileWide: {
    width: "100%",
  },
  aboutTileIconRing: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EBF5EF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8EBE0",
    flexShrink: 0,
  },
  aboutTileContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  requirementLabel: {
    color: "#6B7D73",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  requirementValue: {
    color: "#0F291E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  aboutDivider: {
    height: 1,
    backgroundColor: "#EEF3F0",
    marginVertical: 2,
  },
  aboutDescriptionBlock: {
    gap: 8,
  },
  descriptionBubble: {
    backgroundColor: "#F8FAF8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderLeftWidth: 3.5,
    borderLeftColor: theme.emeraldDark,
    padding: 13,
  },
  descriptionText: {
    color: "#1E3328",
    fontSize: 13.5,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  aboutTrustFootnote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F1",
  },
  aboutTrustFootnoteText: {
    color: "#657A6F",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  extrasWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  extraChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  extraChipText: { color: theme.slate, fontSize: 11.5, fontWeight: "650" as any },
  scrollInner: {
    padding: 14,
    gap: 12,
  },

  /* 1. Hero Card */
  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: theme.borderLight,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  heroCategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  heroCategoryBadgeText: {
    color: theme.emeraldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  liveStatusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  heroTradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#A7F3D0",
  },
  heroIconEmoji: {
    fontSize: 22,
  },
  heroRoleLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.muted,
    marginBottom: 1,
  },
  heroJobTitle: {
    fontSize: 15.5,
    fontWeight: "900",
    color: theme.ink,
    letterSpacing: -0.3,
  },
  heroCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.borderSubtle,
  },
  metaTimeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.muted,
  },
  ownerNoticeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  ownerNoticeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: theme.emeraldDark,
  },
  verifiedJobBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedJobText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: theme.emeraldDark,
  },

  /* 2. Applicant Hub Card */
  applicantHubCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#86EFAC",
  },
  applicantHubLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  applicantHubIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  applicantHubCount: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.ink,
  },
  reviewPill: {
    backgroundColor: theme.emeraldDark,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  reviewPillText: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  applicantHubSubtext: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.slate,
    marginTop: 1,
  },
  applicantHubActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.emeraldDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 6,
  },
  applicantHubActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* 3. Unified Master Specifications Card */
  unifiedMasterCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: theme.borderLight,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  blockMiniLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: theme.faint,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  masterSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardInternalDivider: {
    height: 1,
    backgroundColor: theme.borderSubtle,
    width: "100%",
  },

  /* Wage Display */
  wageRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  wageCurrencySign: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.emeraldDark,
  },
  wageAmountNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.ink,
    letterSpacing: -0.4,
  },
  wageUnitText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.muted,
  },
  payoutSchedulePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  payoutSchedulePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.emeraldDark,
  },

  /* Compact Tear-Sheet Calendar */
  compactTearSheet: {
    width: 48,
    height: 52,
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: theme.emeraldDark,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  compactTearSheetHeader: {
    width: "100%",
    backgroundColor: theme.emeraldDark,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTearSheetMonth: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  compactTearSheetBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    width: "100%",
  },
  compactTearSheetDay: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.ink,
    lineHeight: 18,
  },
  compactTearSheetWeekday: {
    fontSize: 8,
    fontWeight: "700",
    color: theme.muted,
  },
  scheduleFullDateText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: theme.ink,
  },
  multiDaySubText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: theme.emeraldDark,
  },
  shiftCapsuleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  shiftTimeRangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.slate,
  },
  compactDurationBadge: {
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  compactDurationBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.emeraldDark,
  },

  /* Staffing Chips */
  staffingChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  staffingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  staffingPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.ink,
  },
  staffingPillSub: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.muted,
  },

  /* Location in Master Block */
  masterLocationBlock: {
    gap: 8,
  },
  locationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.borderSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  gpsVerifiedText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: theme.muted,
  },
  onlineNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  onlineNoticeText: {
    fontSize: 11.5,
    color: theme.slate,
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
  locationDetailWrap: {
    gap: 8,
  },
  localityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  localityHeadline: {
    fontSize: 13.5,
    fontWeight: "800",
    color: theme.ink,
  },
  fullStreetAddress: {
    fontSize: 11.5,
    color: theme.muted,
    lineHeight: 16,
    marginTop: 1,
  },
  locationActionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  locationActionPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  locationActionPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.ink,
  },

  /* 4. Guidelines Master Card */
  guidelinesMasterCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: theme.borderLight,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  guidelinesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  guidelinesHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  guidelinesSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink,
  },
  guidelinesSectionHint: {
    fontSize: 11,
    color: theme.muted,
  },
  guidelinesPriorityBadge: {
    backgroundColor: theme.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  guidelinesPriorityBadgeCritical: {
    backgroundColor: theme.goldSoft,
    borderColor: "#FDE68A",
  },
  guidelinesPriorityBadgeText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: theme.emeraldDark,
    letterSpacing: 0.5,
  },
  guidelinesPriorityBadgeTextCritical: {
    color: theme.gold,
  },
  clientRemarksBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: theme.emeraldDark,
    borderWidth: 1,
    borderColor: theme.borderLight,
    gap: 6,
  },
  clientRemarksHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientRemarksLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: theme.emeraldDark,
    letterSpacing: 0.6,
  },
  clientRemarksText: {
    fontSize: 13,
    color: theme.ink,
    lineHeight: 19,
    fontWeight: "600",
    fontStyle: "italic",
  },
  clientRemarksFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.borderSubtle,
  },
  clientRemarksFooterText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.emeraldDark,
    flex: 1,
  },
  amenitiesBlock: {
    gap: 6,
  },
  perksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  perkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  perkChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.ink,
  },
  protocolPillsContainer: {
    gap: 8,
  },
  protocolGrid: {
    gap: 8,
  },
  protocolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  protocolIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  protocolCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.ink,
  },
  protocolCardDesc: {
    fontSize: 11,
    color: theme.muted,
    marginTop: 1,
  },

  /* 5. Compact Employer Card */
  employerCompactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: theme.borderLight,
  },
  employerAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.emeraldDark,
    alignItems: "center",
    justifyContent: "center",
  },
  employerAvatarText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  employerNameText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink,
  },
  employerVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  employerVerifiedText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: theme.emeraldDark,
  },
  directCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.emeraldDark,
    alignItems: "center",
    justifyContent: "center",
  },
  reportEmployerBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3ED",
    borderWidth: 1,
    borderColor: "#F1D8CE",
    marginLeft: 8,
  },

  /* 6. Bottom Dock */
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  ownerActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  viewAppsButton: {
    flex: 1.6,
    height: 46,
    borderRadius: 11,
    backgroundColor: theme.emeraldDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewAppsButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  editJobButton: {
    flex: 0.9,
    height: 46,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: theme.emeraldDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  editJobButtonText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: theme.emeraldDark,
  },
  deleteJobOwnerBtn: {
    width: 46,
    height: 46,
    borderRadius: 11,
    backgroundColor: "#FEE2E2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  applyFullButton: {
    height: 46,
    borderRadius: 11,
    backgroundColor: theme.emeraldDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  applyFullButtonDisabled: {
    backgroundColor: theme.faint,
  },
  applyFullButtonText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  workerStatusRow: {
    width: "100%",
  },
  appStatusAcceptedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.emeraldSoft,
    paddingVertical: 10,
    borderRadius: 10,
  },
  appStatusAcceptedText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: theme.emeraldDark,
  },
  appStatusPendingBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.goldSoft,
    paddingVertical: 10,
    borderRadius: 10,
  },
  appStatusPendingText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B45309",
  },
  appWithdrawBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  appWithdrawText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#E11D48",
  },
  appStatusCompletedBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.borderSubtle,
    paddingVertical: 10,
    borderRadius: 10,
  },
  appStatusCompletedText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.muted,
  },

  /* Apply Confirmation Modal */
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  applyPromptCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  applyPromptIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  applyPromptTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.ink,
    textAlign: "center",
    marginBottom: 5,
  },
  applyPromptDesc: {
    fontSize: 12,
    color: theme.muted,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
  },
  applyPromptBtnRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  applyPromptCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  applyPromptCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.slate,
  },
  applyPromptConfirmBtn: {
    flex: 1.3,
    height: 42,
    borderRadius: 9,
    backgroundColor: theme.emeraldDark,
    alignItems: "center",
    justifyContent: "center",
  },
  applyPromptConfirmText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
