import { router, Redirect } from "expo-router";
import React, { useState, useRef, useEffect, useImperativeHandle } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import { useLocation } from "../../src/store/location";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
  PostWorkAnimatedContent,
  transitionPostWorkContent,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import {
  JobPostedSuccessModal,
  JobPostedDetails,
} from "../../src/components/JobPostedSuccessModal";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { getExactRoleIcon } from "../../src/utils/nameVerification";
import { generateDynamicJobDescription } from "../../src/features/post-work/dynamicCategories";

// Helper: Remove subjects or trailing parentheses from title to keep it clean
function sanitizeTitleWithoutSubject(rawTitle?: string, fallback = "Job Request"): string {
  if (!rawTitle) return fallback;
  // Strips trailing parenthetical expressions like " (Maths & Science)" or " (Mathematics)"
  const cleaned = rawTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cleaned || fallback;
}

// Helper: Extract calendar tear-sheet parts for high-end date card
function getDateDetails(d?: Date | string | null) {
  const dateObj = d ? new Date(d) : new Date();
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

// Helper: Calculate shift duration
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

function getDaysBetween(
  start?: Date | string | null,
  end?: Date | string | null
): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface PostWorkReviewHandle {
  submitJob: () => Promise<void>;
}

export interface PostWorkReviewProps {
  embedded?: boolean;
  onNavigateStage?: (stage: number) => void;
  onPostingChange?: (posting: boolean) => void;
}

export const PostWorkReviewScreen = React.forwardRef<PostWorkReviewHandle, PostWorkReviewProps>(
  function PostWorkReviewScreen({ embedded = false, onNavigateStage, onPostingChange }, ref) {
  const store = usePostWorkStore();
  const queryClient = useQueryClient();
  const isEditing = Boolean(store.editingJobId);
  const [posting, setPosting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [postedJobDetails, setPostedJobDetails] = useState<JobPostedDetails | null>(null);

  // Error Modal State & Animation
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const errorShake = useRef(new Animated.Value(0)).current;

  const roleIcon = getExactRoleIcon(store.role, store.roleName, store.category);

  const isEducation =
    (store.category || "").toLowerCase().includes("edu") ||
    (store.categoryName || "").toLowerCase().includes("edu") ||
    (store.roleName || "").toLowerCase().includes("tutor") ||
    (store.roleName || "").toLowerCase().includes("teach");

  // Clean title without subject per user design requirement
  const displayTitle = sanitizeTitleWithoutSubject(
    store.title || store.roleName,
    store.roleName || "Work Request"
  );

  // Calculate actual worker count (minimum 1, never 0)
  const tutorGenders = store.dynamicAnswers?.tutorGenders || (store.dynamicAnswers?.tutorGender === "both" ? ["male", "female"] : store.dynamicAnswers?.tutorGender && store.dynamicAnswers.tutorGender !== "any" ? [store.dynamicAnswers.tutorGender] : []);
  const maleTutorCount = Math.max(1, Math.min(100, Number(store.dynamicAnswers?.maleTutorCount ?? store.dynamicAnswers?.tutorCount) || 1));
  const femaleTutorCount = Math.max(1, Math.min(100, Number(store.dynamicAnswers?.femaleTutorCount ?? store.dynamicAnswers?.tutorCount) || 1));
  const anyTutorCount = Math.max(1, Math.min(100, Number(store.dynamicAnswers?.anyTutorCount ?? store.dynamicAnswers?.tutorCount) || 1));
  const hasTutorQuantity = store.role === "school-tuition" || store.role === "college-tuition";
  const tutorCount = tutorGenders.length > 0
    ? (tutorGenders.includes("male") ? maleTutorCount : 0) + (tutorGenders.includes("female") ? femaleTutorCount : 0)
    : anyTutorCount;
  const workersCount = Math.max(
    1,
    isEducation && hasTutorQuantity
      ? tutorCount
      : store.workers || 1
  );

  // Date and timing details
  const startDateDetails = getDateDetails(store.startDate);
  const endDateDetails = getDateDetails(store.endDate);
  const totalContractDays = getDaysBetween(store.startDate, store.endDate);
  const shiftDuration = calculateShiftDuration(store.startTime, store.endTime);

  const formatTime = (time?: string) => {
    if (!time) return "";
    const clean = time.trim();
    if (clean.includes("AM") || clean.includes("PM") || clean.includes("am") || clean.includes("pm")) {
      return clean;
    }
    const parts = clean.split(":");
    if (parts.length < 2 || !parts[0]) return clean;
    const hour = parseInt(parts[0], 10);
    const min = (parts[1] || "00").slice(0, 2);
    if (isNaN(hour)) return clean;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${min} ${ampm}`;
  };

  const shiftStartTime = formatTime(store.startTime || "09:00");
  const shiftEndTime = formatTime(store.endTime || "18:00");

  const formatScheduleTiming = () => {
    if (store.hours === "full") {
      return "Full Day (9:00 AM – 6:00 PM)";
    }
    if (store.startTime && store.endTime) {
      const s = formatTime(store.startTime);
      const e = formatTime(store.endTime);
      const presetLabel = store.timeSlotPreset ? store.timeSlotPreset.split("(")[0]?.trim() : "";
      if (presetLabel && presetLabel !== "Custom Timing" && presetLabel !== "Custom Hours") {
        return `${presetLabel} • ${s} – ${e}`;
      }
      return `${s} – ${e}`;
    }
    if (store.timeSlotPreset) {
      return store.timeSlotPreset.replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => {
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${m} ${ampm}`;
      });
    }
    return "Flexible Hours";
  };

  const formatBasisName = (basis?: string) => {
    switch (basis) {
      case "month":
        return "/ month";
      case "session":
        return "/ class";
      case "day":
        return "/ day";
      case "hour":
        return "/ hour";
      case "task":
        return "/ task";
      case "total":
      case "project":
        return "total";
      case "week":
        return "/ week";
      default:
        return basis ? `/${basis}` : `/${store.payUnit || "day"}`;
    }
  };

  const formatPayoutSchedule = (freq?: string, when?: string) => {
    switch (freq) {
      case "monthly":
        return "Paid monthly at month end";
      case "weekly":
        return "Paid weekly every weekend";
      case "daily":
        return "Paid same day / daily";
      case "completion":
        return "Paid upon task completion";
      default: {
        switch (when) {
          case "immediate":
          case "daily":
            return "Paid same day / daily";
          case "weekly":
            return "Paid weekly";
          case "monthly":
            return "Paid monthly";
          default:
            return freq ? `Paid ${freq}` : "Paid upon completion";
        }
      }
    }
  };

  const hasSpecifications = Boolean(
    store.categoryDetails &&
      ((store.categoryDetails.educationLevel && store.categoryDetails.educationLevel.length > 0) ||
        store.categoryDetails.board ||
        store.categoryDetails.stream ||
        store.categoryDetails.exam ||
        (store.categoryDetails.subjects && store.categoryDetails.subjects.length > 0) ||
        store.categoryDetails.customSubject ||
        store.categoryDetails.numberOfStudents ||
        store.categoryDetails.demoRequired ||
        store.categoryDetails.tradeSpecialty ||
        store.categoryDetails.materialsProvided ||
        store.categoryDetails.deliveryType ||
        store.categoryDetails.vehicleType)
  );

  // Trigger error shake animation
  const triggerErrorPopup = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
    errorShake.setValue(0);

    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Post Job Action
  const handlePost = async () => {
    setPosting(true);
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const sDate = store.startDate ? new Date(store.startDate) : new Date();
      if (store.hours === "custom" && store.startTime) {
        const [sh, sm] = store.startTime.split(":");
        if (sh && sm) {
          sDate.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);
        }
      } else {
        sDate.setHours(23, 59, 59, 0);
      }

      let startsAt = Math.floor(sDate.getTime() / 1000);
      if (startsAt <= nowSec) {
        startsAt = nowSec + 60;
      }

      let endsAt: number | null = null;
      if (store.duration === "few") {
        if (store.endDate) {
          const eDate = new Date(store.endDate);
          if (store.hours === "custom" && store.endTime) {
            const [eh, em] = store.endTime.split(":");
            if (eh && em) {
              eDate.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);
            }
          } else {
            eDate.setHours(23, 59, 59, 0);
          }
          endsAt = Math.floor(eDate.getTime() / 1000);
          if (endsAt <= startsAt) {
            endsAt = startsAt + 86400;
          }
        } else {
          endsAt = startsAt + 86400 * 3;
        }
      }

      let roleId = (store.role || "").trim();
      let categoryId = (store.category || "").trim();

      if (!roleId && store.roleName) {
        roleId = store.roleName.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-");
      }
      if (!categoryId && store.categoryName) {
        categoryId = store.categoryName.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-");
      }
      if (!categoryId) categoryId = "general";
      if (!roleId) roleId = "general-work";

      // Post clean title without subjects
      const title = displayTitle.slice(0, 100);
      const requestedTutorTotal = hasTutorQuantity ? tutorCount : store.workers || 1;
      const workers = Math.max(1, Math.min(100, requestedTutorTotal));

      const userLoc = useLocation.getState().location;
      const isOnlineWork = store.workMode === "online" || store.dynamicAnswers?.teachingMode === "online";
      const hasStoredCoordinates =
        typeof store.latitude === "number" && Number.isFinite(store.latitude) && store.latitude >= -90 && store.latitude <= 90 &&
        typeof store.longitude === "number" && Number.isFinite(store.longitude) && store.longitude >= -180 && store.longitude <= 180;
      if (!isOnlineWork && !hasStoredCoordinates) {
        throw new Error("Choose the exact worksite location before publishing this job.");
      }

      // Online work has no physical worksite. Keep its existing discovery anchor,
      // but never publish that anchor as a destination or address.
      const latitude = hasStoredCoordinates
        ? store.latitude!
        : typeof userLoc?.latitude === "number" && Number.isFinite(userLoc.latitude) ? userLoc.latitude : 17.3850;
      const longitude = hasStoredCoordinates
        ? store.longitude!
        : typeof userLoc?.longitude === "number" && Number.isFinite(userLoc.longitude) ? userLoc.longitude : 78.4867;

      const area = isOnlineWork
        ? "Online"
        : store.locality && store.locality.trim().length >= 2
          ? store.locality.trim().slice(0, 100)
          : (store.address && store.address.trim().length >= 2 ? store.address.trim().slice(0, 100) : "Location");

      const address = isOnlineWork ? "" : (store.address || "").trim().slice(0, 300);

      const parsedPay = parseFloat(store.payAmount || "0");
      const payPaise = Math.max(
        100,
        Math.min(100000000, Math.round((isNaN(parsedPay) || parsedPay <= 0 ? 1 : parsedPay) * 100))
      );

      const payUnit = ["hour", "day", "job", "month"].includes(store.payUnit)
        ? store.payUnit
        : "day";
      const paidWhen = ["after", "daily", "weekly", "monthly"].includes(store.payWhen)
        ? store.payWhen
        : "after";
      const duration = ["one", "few", "ongoing"].includes(store.duration)
        ? store.duration
        : "one";
      const hours = ["full", "custom"].includes(store.hours) ? store.hours : "full";
      const experience = ["any", "some", "expert"].includes(store.experience)
        ? store.experience
        : "any";

      const formatHHMM = (val?: string, defaultVal = "09:00") => {
        if (!val || typeof val !== "string") return defaultVal;
        const parts = val.split(":");
        if (parts.length !== 2) return defaultVal;
        const p0 = parts[0];
        const p1 = parts[1];
        if (p0 === undefined || p1 === undefined) return defaultVal;
        const h = parseInt(p0, 10);
        const m = parseInt(p1, 10);
        if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return defaultVal;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      let startTime = formatHHMM(store.startTime, "09:00");
      let endTime = formatHHMM(store.endTime, "17:00");
      if (hours === "custom" && endTime <= startTime) {
        const [sh] = startTime.split(":").map(Number);
        const nextH = Math.min(23, (sh || 9) + 4);
        endTime = `${String(nextH).padStart(2, "0")}:00`;
      }

      const submissionKey = `${categoryId}-${roleId}-${Date.now()}`;

      const extras = [...(store.extras || []), ...(store.benefits || [])]
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter((e) => e.length >= 1 && e.length <= 60)
        .slice(0, 10);

      // Build structured notes from category details
      const structuredParts: string[] = [];
      const genderLabel = store.genderType === "male"
        ? "Male"
        : store.genderType === "female"
        ? "Female"
        : "Any gender";
      const genderDetail = `Gender preference: ${genderLabel}`;
      structuredParts.push(genderDetail);
      const cd = store.categoryDetails;
      if (cd?.educationLevel?.length) {
        structuredParts.push(`Level: ${cd.educationLevel.join(", ")}`);
      }
      if (cd?.subjects?.length) {
        const subStr = cd.subjects.includes("Other") && cd.customSubject
          ? `${cd.subjects.filter(s => s !== "Other").join(", ")} & ${cd.customSubject}`
          : cd.subjects.join(", ");
        structuredParts.push(`Subjects: ${subStr}`);
      }
      if (cd?.board) structuredParts.push(`Board: ${cd.board}`);
      if (cd?.stream) structuredParts.push(`Stream: ${cd.stream}`);
      if (cd?.exam) structuredParts.push(`Exam: ${cd.exam}`);
      if (cd?.numberOfStudents) structuredParts.push(`Students: ${cd.numberOfStudents}`);
      if (cd?.teachingFormat) structuredParts.push(`Teaching Format: ${cd.teachingFormat}`);
      if (cd?.demoRequired) structuredParts.push(`Demo Class: ${cd.demoRequired}`);
      if (cd?.tradeSpecialty) structuredParts.push(`Specialty: ${cd.tradeSpecialty}`);
      if (cd?.materialsProvided) structuredParts.push(`Materials: ${cd.materialsProvided}`);
      if (cd?.deliveryType) structuredParts.push(`Delivery: ${cd.deliveryType}`);
      if (cd?.vehicleType) structuredParts.push(`Vehicle: ${cd.vehicleType}`);
      if (store.workMode) structuredParts.push(`Work Mode: ${store.workMode}`);
      if (store.scheduleType) structuredParts.push(`Schedule: ${store.scheduleType}`);
      if (store.languages && store.languages.length > 0) {
        structuredParts.push(`Languages: ${store.languages.join(", ")}`);
      }
      if (store.payMode === "demo_first") {
        structuredParts.push(`Pay: Decided after demo trial${store.payAmount && store.payAmount !== "0" ? ` (Budget: ₹${store.payAmount})` : ""}`);
        if (store.demoFeeTerms) structuredParts.push(`Demo: ${store.demoFeeTerms}`);
      } else if (store.payMode === "discuss") {
        structuredParts.push("Pay: Discuss with applicant");
      } else if (store.payMode === "negotiable") {
        structuredParts.push(`Pay: ${store.payAmount ? `₹${store.payAmount}` : "Negotiable"} / ${store.payBasis || store.payUnit} (Negotiable)`);
      } else if (store.payMode) {
        structuredParts.push(`Pay: ${store.payAmount ? `₹${store.payAmount}` : "Fixed"} / ${store.payBasis || store.payUnit}`);
      }

      const structuredHeader = structuredParts.length > 0 ? `[${structuredParts.join(" • ")}]` : "";
      const rawUserDesc = (store.description || "").trim();
      const dynamicFormatted =
        store.dynamicAnswers && Object.keys(store.dynamicAnswers).length > 0
          ? generateDynamicJobDescription(
              store.categoryName || (categoryId === "tuition" ? "Tuition" : "Education & Training"),
              store.roleName || "Tuition",
              store.dynamicAnswers,
              area
            )
          : "";
      const details = (
        dynamicFormatted
          ? [genderDetail, dynamicFormatted, rawUserDesc].filter(Boolean).join("\n\n")
          : [structuredHeader, rawUserDesc].filter(Boolean).join("\n\n")
      ).slice(0, 1000);

      const jobData = {
        categoryId,
        roleId,
        title,
        workers,
        experience,
        latitude,
        longitude,
        area,
        address,
        startsAt,
        duration,
        endsAt,
        hours,
        startTime,
        endTime,
        payPaise,
        payUnit,
        paidWhen,
        extras,
        details,
        submissionKey,
      };

      let result: { id?: string; updated?: boolean } | undefined;
      if (isEditing && store.editingJobId) {
        result = await api<{ id?: string; updated?: boolean }>(
          `/jobs/${store.editingJobId}`,
          jobData,
          "PUT"
        );
        void queryClient.invalidateQueries({ queryKey: ["job", store.editingJobId] });
        void queryClient.invalidateQueries({ queryKey: ["jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["providerJobs"] });
        void queryClient.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["activity"] });
        void queryClient.invalidateQueries({ queryKey: ["nearby"] });
        if (!isOnlineWork && Number.isFinite(latitude) && Number.isFinite(longitude)) {
          useLocation.getState().setLocation({
            latitude,
            longitude,
            area: area || "Job Location",
          });
        }
      } else {
        result = await api<{ id?: string }>("/jobs", jobData, "POST");
        void queryClient.invalidateQueries({ queryKey: ["jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["providerJobs"] });
        void queryClient.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["activity"] });
        void queryClient.invalidateQueries({ queryKey: ["nearby"] });
        if (!isOnlineWork && Number.isFinite(latitude) && Number.isFinite(longitude)) {
          useLocation.getState().setLocation({
            latitude,
            longitude,
            area: area || "Job Location",
          });
        }
      }

      // Save posted details for confirmation display
      setPostedJobDetails({
        title,
        categoryName: store.categoryName || "Work",
        roleName: store.roleName || "Worker",
        payAmount: store.payAmount || `${payPaise / 100}`,
        payUnit,
        locality: area,
        workers,
        startDate: store.startDate,
        hours,
        startTime,
        endTime,
        jobId: result?.id || store.editingJobId || undefined,
      });

      setShowSuccessModal(true);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : isEditing
          ? "Could not update the job. Please check your connection and details."
          : "Could not post the job. Please check your connection and details.";
      triggerErrorPopup(msg);
    } finally {
      setPosting(false);
    }
  };

  const handleCloseSuccess = () => {
    const targetId = postedJobDetails?.jobId || store.editingJobId;
    setShowSuccessModal(false);
    store.resetFlow();
    if (targetId) {
      router.replace(`/jobs/${targetId}`);
    } else {
      router.replace("/provider-home");
    }
  };

  const handleViewJob = (jobId?: string) => {
    const targetId = jobId || postedJobDetails?.jobId || store.editingJobId;
    setShowSuccessModal(false);
    store.resetFlow();
    if (targetId) {
      router.replace(`/jobs/${targetId}`);
    } else {
      router.replace("/provider-home");
    }
  };

  useImperativeHandle(ref, () => ({
    submitJob: handlePost,
  }));

  useEffect(() => {
    onPostingChange?.(posting);
  }, [posting, onPostingChange]);

  const handleConfirmExit = () => {
    const targetId = store.editingJobId;
    setShowExitModal(false);
    store.resetFlow();
    if (targetId) {
      router.replace(`/jobs/${targetId}`);
    } else {
      router.replace("/provider-home");
    }
  };

  const ContainerComp = embedded ? View : SafeAreaView;

  return (
    <ContainerComp style={styles.container} {...(!embedded ? { edges: ["top" as const] } : {})}>
      {!embedded && (
        <>
          {/* Header */}
          <PostWorkHeader
            title={isEditing ? "Edit Job" : "Review"}
            currentStep={7}
            totalSteps={7}
            onBack={() => router.push("/post-work/pay")}
            onExit={() => setShowExitModal(true)}
          />

          {/* Progress Indicator */}
          <StageProgressIndicator
            currentStep={7}
            onStepPress={(step) => {
              if (step === 1 || step === 2) {
                router.push({
                  pathname: "/post-work",
                  params: { stage: String(step), preserveDraft: "1" },
                });
              }
              else if (step === 3) router.push("/post-work/details");
              else if (step === 4) router.push("/post-work/location");
              else if (step === 5) router.push("/post-work/schedule");
              else if (step === 6) router.push("/post-work/pay");
            }}
          />
        </>
      )}

      <PostWorkAnimatedContent>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          {isEditing ? "Review & Update Work" : "Review & Publish"}
        </Text>
        <Text style={styles.subtitle}>
          Verify the information below. Once published, verified workers will be notified immediately.
        </Text>

        {/* ── 1. HERO JOB TITLE CARD (Clean, Subject-Free Title) ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Text style={styles.heroIconEmoji}>{roleIcon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroCategoryBadge}>
                <Text style={styles.heroCategoryBadgeText}>
                  {store.categoryName || "Category"}
                </Text>
              </View>
              <Text style={styles.heroMetaDot}>•</Text>
              <Text style={styles.heroRoleText}>
                {store.roleName || "Worker"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => (onNavigateStage ? onNavigateStage(2) : router.push({
              pathname: "/post-work",
              params: { stage: "2", preserveDraft: "1" },
            }))}
            style={styles.editPillBtn}
            hitSlop={8}
          >
            <Ionicons name="pencil" size={13} color="#03402D" />
            <Text style={styles.editPillText}>Edit</Text>
          </Pressable>
        </View>

        {/* ── 2. JOB SPECIFICATIONS & SUBJECTS (Subjects Highlighted Here) ── */}
        {hasSpecifications && (
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <Ionicons name="school-outline" size={17} color="#03402D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>Work Specifications</Text>
                <Text style={styles.cardSectionHint}>Curriculum, subjects, and parameters</Text>
              </View>
              <Pressable
                onPress={() => (onNavigateStage ? onNavigateStage(3) : router.push("/post-work/details"))}
                style={styles.editPillBtn}
                hitSlop={8}
              >
                <Ionicons name="pencil" size={13} color="#03402D" />
                <Text style={styles.editPillText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.specChipsContainer}>
              {/* Education Level / Classes */}
              {store.categoryDetails?.educationLevel?.map((lvl: string) => (
                <View key={lvl} style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>{lvl}</Text>
                </View>
              ))}

              {/* Board / Curriculum */}
              {store.categoryDetails?.board ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>Board: {store.categoryDetails.board}</Text>
                </View>
              ) : null}

              {/* Stream / Branch */}
              {store.categoryDetails?.stream ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>{store.categoryDetails.stream}</Text>
                </View>
              ) : null}

              {/* Exam */}
              {store.categoryDetails?.exam ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>{store.categoryDetails.exam}</Text>
                </View>
              ) : null}

              {/* Subjects (Dedicated Highlight Badges) */}
              {store.categoryDetails?.subjects?.map((sub: string) => (
                <View key={sub} style={styles.subjectBadge}>
                  <Ionicons name="book" size={13} color="#03402D" />
                  <Text style={styles.subjectBadgeText}>{sub}</Text>
                </View>
              ))}

              {/* Custom Subject */}
              {store.categoryDetails?.customSubject ? (
                <View style={styles.subjectBadge}>
                  <Ionicons name="book" size={13} color="#03402D" />
                  <Text style={styles.subjectBadgeText}>
                    {store.categoryDetails.customSubject}
                  </Text>
                </View>
              ) : null}

              {/* Number of Students */}
              {store.categoryDetails?.numberOfStudents ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>
                    👥 {store.categoryDetails.numberOfStudents} Student{store.categoryDetails.numberOfStudents > 1 ? "s" : ""}
                  </Text>
                </View>
              ) : null}

              {/* Demo Session */}
              {store.categoryDetails?.demoRequired ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>
                    ✨ Demo: {store.categoryDetails.demoRequired}
                  </Text>
                </View>
              ) : null}

              {/* Trade Specialty */}
              {store.categoryDetails?.tradeSpecialty ? (
                <View style={styles.subjectBadge}>
                  <Text style={styles.subjectBadgeText}>
                    {store.categoryDetails.tradeSpecialty}
                  </Text>
                </View>
              ) : null}

              {/* Materials */}
              {store.categoryDetails?.materialsProvided ? (
                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>
                    Materials: {store.categoryDetails.materialsProvided}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* ── 3. STAFFING & EXPERIENCE (FIXED: Never Shows 0, Smart Suggestions) ── */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="people-outline" size={17} color="#03402D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Staffing & Experience</Text>
              <Text style={styles.cardSectionHint}>Talent requirement and qualification</Text>
            </View>
            <Pressable
              onPress={() => (onNavigateStage ? onNavigateStage(3) : router.push("/post-work/details"))}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color="#03402D" />
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.staffingContainer}>
            {/* 2-Column Info Grid */}
            <View style={styles.infoRowGrid}>
              {/* Workers / Tutors Needed */}
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockLabel}>
                  {isEducation ? "TUTORS REQUIRED" : "WORKERS REQUIRED"}
                </Text>
                <View style={styles.infoBlockMainRow}>
                  <Ionicons
                    name={isEducation ? "school" : "person"}
                    size={16}
                    color="#03402D"
                  />
                  <Text style={styles.infoBlockValue}>
                    {workersCount} {isEducation ? (workersCount > 1 ? "Tutors" : "Tutor") : (workersCount > 1 ? "Workers" : "Worker")}
                  </Text>
                </View>
                <Text style={styles.infoBlockSub}>
                  {isEducation && (store.role === "school-tuition" || store.role === "college-tuition")
                    ? tutorGenders.length > 0
                      ? [tutorGenders.includes("male") ? `${maleTutorCount} male ${maleTutorCount === 1 ? "tutor" : "tutors"}` : "", tutorGenders.includes("female") ? `${femaleTutorCount} female ${femaleTutorCount === 1 ? "tutor" : "tutors"}` : ""].filter(Boolean).join(" + ") + " requested"
                      : `${anyTutorCount} ${anyTutorCount === 1 ? "tutor" : "tutors"} requested • Any gender`
                    : store.genderType === "male"
                    ? "Male worker preferred"
                    : store.genderType === "female"
                    ? "Female worker preferred"
                    : "Open to any gender"}
                </Text>
              </View>

              {/* Experience Level */}
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockLabel}>EXPERIENCE LEVEL</Text>
                <View style={styles.infoBlockMainRow}>
                  <Ionicons name="ribbon-outline" size={16} color="#03402D" />
                  <Text style={styles.infoBlockValue}>
                    {store.experience === "expert"
                      ? "Expert / Senior"
                      : store.experience === "some"
                      ? "Experienced"
                      : "Any Experience"}
                  </Text>
                </View>
                <Text style={styles.infoBlockSub} numberOfLines={1}>
                  {store.languages && store.languages.length > 0
                    ? `Lang: ${store.languages.join(", ")}`
                    : "Languages: Any"}
                </Text>
              </View>
            </View>

            {/* Smart Staffing Suggestion Badge */}
            <View style={styles.staffingSuggestionBox}>
              <Ionicons name="bulb-outline" size={15} color="#03402D" />
              <Text style={styles.staffingSuggestionText}>
                {isEducation
                  ? "💡 Recommendation: 1 tutor provides optimal 1-on-1 focus and best learning results."
                  : `💡 Recommendation: ${workersCount} ${workersCount > 1 ? "workers" : "worker"} is well suited for standard completion.`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 4. WORK LOCATION & MODE (High-End Map Pin & Details) ── */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons
                name={store.workMode === "online" ? "laptop-outline" : "location-outline"}
                size={17}
                color="#03402D"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Work Location</Text>
              <Text style={styles.cardSectionHint}>Service delivery address and format</Text>
            </View>
            <Pressable
              onPress={() => (onNavigateStage ? onNavigateStage(4) : router.push("/post-work/location"))}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color="#03402D" />
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.locationContainer}>
            {/* Work Mode Header */}
            <View style={styles.locationModeRow}>
              <View style={styles.locationModeBadge}>
                <Ionicons
                  name={
                    store.workMode === "online"
                      ? "videocam"
                      : store.workMode === "center"
                      ? "business"
                      : "home"
                  }
                  size={14}
                  color="#03402D"
                />
                <Text style={styles.locationModeBadgeText}>
                  {store.workMode === "online"
                    ? "Online / Remote Class"
                    : store.workMode === "center"
                    ? "At Provider's Center"
                    : "At Home / On-site Visit"}
                </Text>
              </View>
              <View style={styles.locationVerifiedPill}>
                <Text style={styles.locationVerifiedText}>
                  {store.workMode === "online" ? "Virtual Meeting" : "Exact Coordinates"}
                </Text>
              </View>
            </View>

            {/* Address & Locality Card */}
            {store.workMode !== "online" ? (
              <View style={styles.addressBox}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name="navigate" size={16} color="#03402D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLocalityText}>
                    {store.locality || "Selected Location"}
                  </Text>
                  {store.address ? (
                    <Text style={styles.addressFullText} numberOfLines={2}>
                      {store.address}
                    </Text>
                  ) : (
                    <Text style={styles.addressFullText}>
                      Locality pinned accurately on map
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.addressBox}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name="globe-outline" size={16} color="#03402D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLocalityText}>
                    Online Video Sessions
                  </Text>
                  <Text style={styles.addressFullText}>
                    Conducted via Google Meet / Zoom. No physical travel required.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── 5. WORK SCHEDULE & TIMINGS (GORGEOUS TEAR-SHEET CALENDAR & DUAL-CAPSULE DIGITAL CLOCK) ── */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="calendar-outline" size={17} color="#03402D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Schedule & Timings</Text>
              <Text style={styles.cardSectionHint}>Dates, scheduled days, and shift hours</Text>
            </View>
            <Pressable
              onPress={() => (onNavigateStage ? onNavigateStage(5) : router.push("/post-work/schedule"))}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color="#03402D" />
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.scheduleContainer}>
            {/* Format Tag */}
            <View style={styles.scheduleFormatBadge}>
              <Ionicons
                name={
                  store.scheduleType === "one_time"
                    ? "flash"
                    : store.scheduleType === "fixed_duration"
                    ? "calendar"
                    : "repeat"
                }
                size={13}
                color="#03402D"
              />
              <Text style={styles.scheduleFormatBadgeText}>
                {store.scheduleType === "one_time"
                  ? "ONE-TIME TASK"
                  : store.scheduleType === "fixed_duration"
                  ? "FIXED TERM CONTRACT"
                  : "REGULAR RECURRING SCHEDULE"}
              </Text>
            </View>

            {/* Tear-Sheet Date Display */}
            {store.scheduleType === "fixed_duration" && store.endDate ? (
              <View style={styles.calendarDualTearSheetCard}>
                <View style={styles.dualTearSheetRow}>
                  {/* Start Date */}
                  <View style={styles.tearSheetColumn}>
                    <Text style={styles.tearSheetMiniTag}>STARTS</Text>
                    <View style={styles.calendarTearSheet}>
                      <View style={styles.tearSheetHeader}>
                        <Text style={styles.tearSheetMonth}>{startDateDetails.month}</Text>
                      </View>
                      <View style={styles.tearSheetBody}>
                        <Text style={styles.tearSheetDay}>{startDateDetails.day}</Text>
                        <Text style={styles.tearSheetWeekday}>{startDateDetails.weekday}</Text>
                      </View>
                    </View>
                    <Text style={styles.tearSheetDateMiniText}>
                      {startDateDetails.month} {startDateDetails.day}
                    </Text>
                  </View>

                  {/* Connecting Timeline Arrow */}
                  <View style={styles.tearSheetConnector}>
                    <View style={styles.tearSheetConnectorLine} />
                    <View style={styles.tearSheetConnectorBadge}>
                      <Ionicons name="arrow-forward" size={13} color="#03402D" />
                    </View>
                    <View style={styles.tearSheetConnectorLine} />
                  </View>

                  {/* End Date */}
                  <View style={styles.tearSheetColumn}>
                    <Text style={styles.tearSheetMiniTag}>ENDS</Text>
                    <View style={[styles.calendarTearSheet, { borderColor: "#0284C7" }]}>
                      <View style={[styles.tearSheetHeader, { backgroundColor: "#0284C7" }]}>
                        <Text style={styles.tearSheetMonth}>{endDateDetails.month}</Text>
                      </View>
                      <View style={styles.tearSheetBody}>
                        <Text style={styles.tearSheetDay}>{endDateDetails.day}</Text>
                        <Text style={styles.tearSheetWeekday}>{endDateDetails.weekday}</Text>
                      </View>
                    </View>
                    <Text style={styles.tearSheetDateMiniText}>
                      {endDateDetails.month} {endDateDetails.day}
                    </Text>
                  </View>
                </View>

                {/* Duration & Range Footer */}
                <View style={styles.dualTearSheetFooter}>
                  <Ionicons name="calendar-outline" size={13} color="#03402D" />
                  <Text style={styles.dualTearSheetFooterText}>
                    {totalContractDays ? `${totalContractDays} Days Contract` : "Fixed Contract"} • {startDateDetails.fullDate} to {endDateDetails.fullDate}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.calendarTearSheetCard}>
                <View style={styles.calendarTearSheet}>
                  <View style={styles.tearSheetHeader}>
                    <Text style={styles.tearSheetMonth}>{startDateDetails.month}</Text>
                  </View>
                  <View style={styles.tearSheetBody}>
                    <Text style={styles.tearSheetDay}>{startDateDetails.day}</Text>
                    <Text style={styles.tearSheetWeekday}>{startDateDetails.weekday}</Text>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.tearSheetLabel}>
                    {store.scheduleType === "one_time" ? "WORK DATE" : "START DATE"}
                  </Text>
                  <Text style={styles.tearSheetFullDate}>{startDateDetails.fullDate}</Text>
                  <Text style={styles.tearSheetSubtext}>
                    {store.scheduleType === "one_time"
                      ? "Single day task"
                      : "Ongoing regular schedule"}
                  </Text>
                </View>
              </View>
            )}

            {/* Mon - Sun Working Days (For recurring jobs) */}
            {store.scheduleType !== "one_time" && (
              <View style={styles.workingDaysSection}>
                <View style={styles.workingDaysHeaderRow}>
                  <Text style={styles.workingDaysSectionLabel}>WORKING DAYS</Text>
                  <Text style={styles.workingDaysCountText}>
                    {(store.selectedDays || []).length} Days / Week
                  </Text>
                </View>
                <View style={styles.weekDaysGrid}>
                  {ALL_DAYS.map((day) => {
                    const isSelected = (store.selectedDays || []).includes(day);
                    return (
                      <View
                        key={day}
                        style={[
                          styles.dayCircle,
                          isSelected && styles.dayCircleActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCircleText,
                            isSelected && styles.dayCircleTextActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Digital Clock Shift Timing Display */}
            <View style={styles.digitalShiftCard}>
              <View style={styles.digitalShiftHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="alarm" size={16} color="#03402D" />
                  <Text style={styles.digitalShiftHeaderTitle}>SHIFT TIMINGS</Text>
                </View>
                <View style={styles.durationPillBadge}>
                  <Text style={styles.durationPillText}>{shiftDuration}</Text>
                </View>
              </View>

              <View style={styles.digitalTimeCapsulesRow}>
                {/* Start Time Capsule */}
                <View style={styles.timeCapsule}>
                  <View style={styles.timeDotGreen} />
                  <View>
                    <Text style={styles.timeCapsuleLabel}>START</Text>
                    <Text style={styles.timeCapsuleValue}>{shiftStartTime}</Text>
                  </View>
                </View>

                <View style={styles.timeArrowBox}>
                  <Ionicons name="arrow-forward" size={16} color="#03402D" />
                </View>

                {/* End Time Capsule */}
                <View style={styles.timeCapsule}>
                  <View style={styles.timeDotRed} />
                  <View>
                    <Text style={styles.timeCapsuleLabel}>FINISH</Text>
                    <Text style={styles.timeCapsuleValue}>{shiftEndTime}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.digitalShiftPresetNote}>
                <Text style={styles.digitalShiftPresetNoteText}>
                  Scheduled shift: <Text style={{ fontWeight: "800", color: "#03402D" }}>{formatScheduleTiming()}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 6. PAYMENT & TERMS (High-End Rate Display & Breakdown) ── */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderIconBox}>
              <Ionicons name="wallet-outline" size={17} color="#03402D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Payment Terms</Text>
              <Text style={styles.cardSectionHint}>Compensation rate and payout schedule</Text>
            </View>
            <Pressable
              onPress={() => (onNavigateStage ? onNavigateStage(6) : router.push("/post-work/pay"))}
              style={styles.editPillBtn}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color="#03402D" />
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.paymentContainer}>
            {/* Primary Rate Hero Box */}
            <View style={styles.payRateHeroBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payRateHeroLabel}>OFFERED RATE</Text>
                <View style={styles.payRateHeroMainRow}>
                  <Text style={styles.payRateHeroAmount}>
                    {store.payMode === "demo_first"
                      ? store.payAmount && store.payAmount !== "0"
                        ? `₹${Number(store.payAmount).toLocaleString("en-IN")}`
                        : "Decided After Demo"
                      : store.payMode === "discuss"
                      ? "Discuss Directly"
                      : store.payAmount && store.payAmount !== "0"
                      ? `₹${Number(store.payAmount).toLocaleString("en-IN")}`
                      : "Rate Upon Discussion"}
                  </Text>
                  {store.payMode !== "discuss" && Boolean(store.payAmount && store.payAmount !== "0") && (
                    <Text style={styles.payRateHeroUnit}>
                      {formatBasisName(store.payBasis)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.payModelTagPill}>
                <Text style={styles.payModelTagPillText}>
                  {store.payMode === "demo_first"
                    ? "Demo First"
                    : store.payMode === "negotiable"
                    ? "Negotiable"
                    : store.payMode === "discuss"
                    ? "Direct Negotiation"
                    : "Fixed Rate"}
                </Text>
              </View>
            </View>

            {/* Payout Schedule Row */}
            <View style={styles.payoutScheduleRow}>
              <Ionicons name="checkmark-circle" size={15} color="#03402D" />
              <Text style={styles.payoutScheduleText}>
                {formatPayoutSchedule(store.paymentFrequency, store.payWhen)}
              </Text>
            </View>

            {/* Perks & Benefits Section */}
            {store.extras && store.extras.length > 0 && (
              <View style={styles.perksBreakdownSection}>
                <Text style={styles.perksBreakdownLabel}>INCLUDED PERKS</Text>
                <View style={styles.perksChipsWrap}>
                  {store.extras.map((extra, idx) => (
                    <View key={idx} style={styles.perkBadge}>
                      <Ionicons name="gift-outline" size={12} color="#03402D" />
                      <Text style={styles.perkBadgeText}>{extra}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Zero Brokerage Assurance */}
            <View style={styles.zeroBrokerageBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#03402D" />
              <Text style={styles.zeroBrokerageText}>
                100% Direct Payout to Worker • Zero Platform Commission
              </Text>
            </View>
          </View>
        </View>

        {/* ── 7. SPECIAL INSTRUCTIONS / NOTES (Optional) ── */}
        {store.description ? (
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <Ionicons name="document-text-outline" size={17} color="#03402D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>Work Instructions</Text>
                <Text style={styles.cardSectionHint}>Notes for applicants</Text>
              </View>
            </View>
            <Text style={styles.descText}>{store.description}</Text>
          </View>
        ) : null}

        {/* ── 8. TRUST & SAFETY BANNER ── */}
        <View style={styles.trustBanner}>
          <Ionicons name="shield-checkmark" size={18} color="#03402D" />
          <Text style={styles.trustBannerText}>
            Direct connect with verified workers • 100% Free • Zero Brokerage
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </PostWorkAnimatedContent>

      {!embedded && (
        <>
          {/* Bottom Post Action Footer */}
          <PostWorkFooter
            onBack={() => router.push("/post-work/pay")}
            onNext={handlePost}
            isFinalStage={true}
            loading={posting}
            nextLabel={isEditing ? "Update Job" : "Publish Job"}
          />
        </>
      )}

      {/* ─── ERROR POPUP MODAL ─── */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.errorCard,
              {
                transform: [{ translateX: errorShake }],
              },
            ]}
          >
            <View style={styles.errorIconBadge}>
              <Ionicons name="alert-circle" size={38} color="#DC2626" />
            </View>

            <Text style={styles.errorTitle}>
              {isEditing ? "Could Not Update Job" : "Could Not Post Job"}
            </Text>
            <Text style={styles.errorDesc}>{errorMessage}</Text>

            <View style={styles.errorActions}>
              <Pressable
                onPress={() => {
                  setShowErrorModal(false);
                  handlePost();
                }}
                style={({ pressed }) => [
                  styles.btnRetry,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.btnRetryText}>Try Again</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowErrorModal(false)}
                style={({ pressed }) => [
                  styles.btnReview,
                  pressed && { backgroundColor: "#F3F4F6" },
                ]}
              >
                <Text style={styles.btnReviewText}>Review Details</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {!embedded && (
        <ExitModal
          visible={showExitModal}
          onClose={() => setShowExitModal(false)}
          onExit={handleConfirmExit}
        />
      )}

      {/* Job Posted Success Modal */}
      <JobPostedSuccessModal
        visible={showSuccessModal}
        isEditing={isEditing}
        jobDetails={postedJobDetails || undefined}
        onClose={handleCloseSuccess}
        onGoHome={handleCloseSuccess}
        onViewJob={handleViewJob}
      />
    </ContainerComp>
  );
});

export default function PostWorkReviewRoute() {
  return <Redirect href={{ pathname: "/post-work", params: { stage: "7" } }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heading: {
    fontSize: POST_WORK_TYPOGRAPHY.screenHeading,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 16,
  },

  // 1. HERO TITLE CARD
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  heroIconEmoji: {
    fontSize: 24,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroCategoryBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  heroCategoryBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
  },
  heroMetaDot: {
    color: "#CBD5E1",
    fontSize: 12,
  },
  heroRoleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },

  // SECTION CARDS
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  cardHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSectionHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  editPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  editPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
  },

  // SPECIFICATIONS & SUBJECTS
  specChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  specBadge: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  specBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  subjectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  subjectBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#03402D",
  },

  // STAFFING CONTAINER
  staffingContainer: {
    gap: 10,
  },
  infoRowGrid: {
    flexDirection: "row",
    gap: 10,
  },
  infoBlock: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoBlockLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoBlockMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoBlockValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  infoBlockSub: {
    fontSize: 11,
    color: "#64748B",
  },
  staffingSuggestionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  staffingSuggestionText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
    lineHeight: 16,
  },

  // LOCATION CONTAINER
  locationContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  locationModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  locationModeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#03402D",
  },
  locationVerifiedPill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  locationVerifiedText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#64748B",
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  addressIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  addressLocalityText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  addressFullText: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },

  // 5. HIGH-END SCHEDULE & TIMINGS
  scheduleContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  scheduleFormatBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  scheduleFormatBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 0.4,
  },

  // Tear-sheet Calendar Card
  calendarTearSheetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
  },
  calendarDualTearSheetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  dualTearSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tearSheetColumn: {
    alignItems: "center",
    gap: 4,
  },
  tearSheetMiniTag: {
    fontSize: 9,
    fontWeight: "900",
    color: "#03402D",
    letterSpacing: 0.8,
  },
  tearSheetDateMiniText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    marginTop: 2,
  },
  tearSheetConnector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  tearSheetConnectorLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#CBD5E1",
  },
  tearSheetConnectorBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  dualTearSheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dualTearSheetFooterText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
    flex: 1,
  },
  calendarTearSheet: {
    width: 52,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#03402D",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  tearSheetHeader: {
    width: "100%",
    backgroundColor: "#03402D",
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tearSheetMonth: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  tearSheetBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    width: "100%",
  },
  tearSheetDay: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 20,
  },
  tearSheetWeekday: {
    fontSize: 8.5,
    fontWeight: "700",
    color: "#64748B",
  },
  tearSheetLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tearSheetFullDate: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  tearSheetSubtext: {
    fontSize: 11,
    color: "#64748B",
  },
  endDateTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  endDateTimelineText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
  },

  // Working Days Grid
  workingDaysSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  workingDaysHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  workingDaysSectionLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  workingDaysCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03402D",
  },
  weekDaysGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayCircle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayCircleActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  dayCircleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  dayCircleTextActive: {
    color: "#FFFFFF",
  },

  // Digital Shift Card
  digitalShiftCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  digitalShiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  digitalShiftHeaderTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 0.6,
  },
  durationPillBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
  },
  digitalTimeCapsulesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timeCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  timeDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  timeCapsuleLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  timeCapsuleValue: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 1,
    letterSpacing: 0.3,
  },
  timeArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  digitalShiftPresetNote: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  digitalShiftPresetNoteText: {
    fontSize: 11,
    color: "#64748B",
  },

  // PAYMENT CONTAINER
  paymentContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  payRateHeroBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  payRateHeroLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  payRateHeroMainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  payRateHeroAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  payRateHeroUnit: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#64748B",
  },
  payModelTagPill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  payModelTagPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
  },
  payoutScheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  payoutScheduleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  perksBreakdownSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  perksBreakdownLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  perksChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  perkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  perkBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03402D",
  },
  zeroBrokerageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  zeroBrokerageText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#03402D",
  },

  // DESCRIPTION NOTE
  descText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },

  // TRUST BANNER
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  trustBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
    lineHeight: 16,
  },

  // MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  errorIconBadge: {
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "center",
  },
  errorDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  errorActions: {
    width: "100%",
    gap: 8,
  },
  btnRetry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#03402D",
    borderRadius: 10,
    paddingVertical: 11,
  },
  btnRetryText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnReview: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
  },
  btnReviewText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
});
