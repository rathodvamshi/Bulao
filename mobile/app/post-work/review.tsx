import { router } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
} from "../../src/components/PostWorkUI";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";
import { getExactRoleIcon } from "../../src/utils/nameVerification";

export default function PostWorkReviewScreen() {
  const store = usePostWorkStore();
  const [posting, setPosting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  // Success Modal State & Animations
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkBounce = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Error Modal State & Animation
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const errorShake = useRef(new Animated.Value(0)).current;

  const roleIcon = getExactRoleIcon(store.role, store.roleName, store.category);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    if (!h || !m) return time;
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  // Run success animations
  const triggerSuccessAnimation = () => {
    setShowSuccessModal(true);
    successScale.setValue(0.7);
    successOpacity.setValue(0);
    checkBounce.setValue(0);
    rippleAnim.setValue(0);

    // Fade in and scale popup
    Animated.parallel([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(successScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(checkBounce, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  };

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
      if (store.duration === "few" && store.endDate) {
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
      }

      const submissionKey = `${store.category}-${store.role}-${Date.now()}`;
      const payPaise = Math.round(parseFloat(store.payAmount || "0") * 100);

      const jobData = {
        categoryId: store.category,
        roleId: store.role,
        title: store.title,
        workers: store.workers,
        experience: store.experience,
        latitude: store.latitude,
        longitude: store.longitude,
        area: store.locality,
        address: store.address,
        startsAt,
        duration: store.duration,
        endsAt,
        hours: store.hours,
        startTime: store.startTime,
        endTime: store.endTime,
        payPaise,
        payUnit: store.payUnit,
        paidWhen: store.payWhen,
        extras: [...store.extras, ...store.benefits],
        details: store.description,
        submissionKey,
      };

      const result = await api<{ id?: string }>("/jobs", jobData, "POST");
      const newJobId = result?.id || null;
      setCreatedJobId(newJobId);
      triggerSuccessAnimation();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Could not post the job. Please check your connection and details.";
      triggerErrorPopup(msg);
    } finally {
      setPosting(false);
    }
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);
    store.resetFlow();
    router.replace("/provider-home");
  };

  const handleViewJob = () => {
    setShowSuccessModal(false);
    store.resetFlow();
    if (createdJobId) {
      router.replace(`/jobs/${createdJobId}`);
    } else {
      router.replace("/activity");
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    store.resetFlow();
    router.replace("/provider-home");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header with ← Exit */}
      <PostWorkHeader
        title="Review Job"
        currentStep={7}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />

      {/* Connected Stage Progress Indicator */}
      <StageProgressIndicator
        currentStep={7}
        onStepPress={(step) => {
          if (step === 1 || step === 2) router.push("/post-work");
          else if (step === 3) router.push("/post-work/details");
          else if (step === 4) router.push("/post-work/location");
          else if (step === 5) router.push("/post-work/schedule");
          else if (step === 6) router.push("/post-work/pay");
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stageTag}>FINAL STAGE (7 OF 7)</Text>
        <Text style={styles.heading}>Review & Post Work</Text>
        <Text style={styles.subtitle}>
          Check everything below. Once posted, nearby verified workers will be notified.
        </Text>

        {/* ── Main Review Card ── */}
        <View style={styles.card}>
          {/* Header Tile */}
          <View style={styles.cardTitleRow}>
            <View style={styles.roleIconBadge}>
              <Text style={styles.roleIconEmoji}>{roleIcon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {store.title || store.roleName || "Job Request"}
              </Text>
              <View style={styles.cardSubTitleRow}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {store.categoryName || "Work"}
                  </Text>
                </View>
                <Text style={styles.cardSubTitleDot}>•</Text>
                <Text style={styles.cardSubTitle}>
                  {store.roleName || "Worker"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 1. Workers & Gender */}
          <View style={styles.row}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="people" size={17} color={colors.green} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Workers Needed</Text>
              <Text style={styles.rowValue}>
                {store.genderType === "custom"
                  ? `${store.workers} Workers (${store.maleWorkers} Men, ${store.femaleWorkers} Women)`
                  : store.genderType === "male"
                  ? `${store.workers} ${store.workers === 1 ? "Man" : "Men"} (Male only)`
                  : store.genderType === "female"
                  ? `${store.workers} ${store.workers === 1 ? "Woman" : "Women"} (Female only)`
                  : `${store.workers} ${store.workers === 1 ? "Worker" : "Workers"} (Any gender)`}
              </Text>
              <Text style={styles.rowSubtext}>
                Experience Level: <Text style={{ fontWeight: "700", color: "#0F1F14" }}>{store.experience.toUpperCase()}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/details")}
              accessibilityRole="button"
              accessibilityLabel="Edit Workers"
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            >
              <Ionicons name="pencil" size={13} color={colors.green} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* 2. Location */}
          <View style={styles.row}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="location" size={17} color={colors.green} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Work Location</Text>
              <Text style={styles.rowValue}>{store.locality || "Not selected"}</Text>
              {store.address ? (
                <Text style={styles.rowSubtext} numberOfLines={2}>
                  {store.address}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push("/post-work/location")}
              accessibilityRole="button"
              accessibilityLabel="Edit Location"
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            >
              <Ionicons name="pencil" size={13} color={colors.green} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* 3. Schedule */}
          <View style={styles.row}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="calendar" size={17} color={colors.green} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Date & Schedule</Text>
              <Text style={styles.rowValue}>
                {formatDate(store.startDate || new Date())}{" "}
                {store.duration === "few" && store.endDate
                  ? `to ${formatDate(store.endDate)}`
                  : store.duration === "ongoing"
                  ? "(Ongoing)"
                  : ""}
              </Text>
              <Text style={styles.rowSubtext}>
                {store.hours === "full"
                  ? "Full Day Work (Standard Shift)"
                  : `Working Hours: ${formatTime(store.startTime)} - ${formatTime(store.endTime)}`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/schedule")}
              accessibilityRole="button"
              accessibilityLabel="Edit Schedule"
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            >
              <Ionicons name="pencil" size={13} color={colors.green} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* 4. Payment */}
          <View style={styles.row}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="cash" size={17} color={colors.green} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Offered Pay</Text>
              <Text style={styles.rowValue}>
                ₹{store.payAmount || "0"}{" "}
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B8A74" }}>
                  per {store.payUnit}
                </Text>
              </Text>
              <Text style={styles.rowSubtext}>
                Payment terms: Paid {store.payWhen === "after" ? "after work completes" : store.payWhen}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/pay")}
              accessibilityRole="button"
              accessibilityLabel="Edit Payment"
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            >
              <Ionicons name="pencil" size={13} color={colors.green} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>

          {/* 5. Details (optional) */}
          {store.description ? (
            <>
              <View style={styles.divider} />
              <View style={styles.descSection}>
                <Text style={styles.rowLabel}>Work Instructions</Text>
                <Text style={styles.descText}>{store.description}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.guaranteeBox}>
          <Ionicons name="shield-checkmark" size={16} color={colors.green} />
          <Text style={styles.guaranteeText}>
            Direct connect with verified workers • Zero commission fees
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Nav Buttons */}
      <PostWorkFooter
        onBack={() => router.back()}
        onNext={handlePost}
        isFinalStage={true}
        loading={posting}
      />

      {/* ─── PREMIUM SUCCESS ANIMATED POPUP ─── */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleGoHome}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.successCard,
              {
                opacity: successOpacity,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            {/* Close Button Top-Right */}
            <Pressable
              onPress={handleGoHome}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.modalCloseBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
              ]}
            >
              <Ionicons name="close" size={20} color="#6B8A74" />
            </Pressable>

            <ScrollView
              style={styles.successScrollView}
              contentContainerStyle={styles.successScrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Celebration Radar & Checkmark Header */}
              <View style={styles.celebrationArea}>
                {/* Outer Pulsing Glow */}
                <Animated.View
                  style={[
                    styles.radarCircle,
                    styles.radarCircleOuter,
                    {
                      transform: [
                        {
                          scale: rippleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.85, 2.3],
                          }),
                        },
                      ],
                      opacity: rippleAnim.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [0.45, 0.15, 0],
                      }),
                    },
                  ]}
                />

                {/* Inner Pulsing Ring */}
                <Animated.View
                  style={[
                    styles.radarCircle,
                    {
                      transform: [
                        {
                          scale: rippleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1.6],
                          }),
                        },
                      ],
                      opacity: rippleAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 0.25, 0],
                      }),
                    },
                  ]}
                />

                {/* Floating Sparkles */}
                <View style={styles.sparkleTopRight}>
                  <Text style={{ fontSize: 15 }}>✨</Text>
                </View>
                <View style={styles.sparkleBottomLeft}>
                  <Text style={{ fontSize: 13 }}>🌟</Text>
                </View>

                {/* Animated Bouncing Checkmark Badge */}
                <Animated.View
                  style={[
                    styles.successCheckBadge,
                    {
                      transform: [
                        {
                          scale: checkBounce.interpolate({
                            inputRange: [0, 0.7, 1],
                            outputRange: [0, 1.2, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={34} color="#FFFFFF" />
                </Animated.View>
              </View>

              {/* Title & Status */}
              <Text style={styles.successTitle}>Job Posted Successfully!</Text>
              <View style={styles.liveBroadcastBadge}>
                <View style={styles.pulsingGreenDot} />
                <Text style={styles.liveBroadcastText}>LIVE & MATCHING WORKERS</Text>
              </View>

              {/* ── PREMIUM POSTED JOB SUMMARY CARD ── */}
              <View style={styles.postedJobSummaryCard}>
                {/* Job Header */}
                <View style={styles.postedSummaryHeader}>
                  <View style={styles.postedSummaryIconBox}>
                    <Text style={{ fontSize: 18 }}>{roleIcon || "💼"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postedSummaryTitle} numberOfLines={1}>
                      {store.title || store.roleName || "Job Request"}
                    </Text>
                    <Text style={styles.postedSummaryCategory} numberOfLines={1}>
                      {store.categoryName || "Work"} • {store.roleName || "Worker"}
                    </Text>
                  </View>
                  <View style={styles.postedPayBadge}>
                    <Text style={styles.postedPayBadgeText}>
                      ₹{store.payAmount || "0"}
                    </Text>
                    <Text style={styles.postedPayBadgeUnit}>/{store.payUnit}</Text>
                  </View>
                </View>

                <View style={styles.postedSummaryDivider} />

                {/* 2x2 Mini Info Grid */}
                <View style={styles.postedGrid}>
                  {/* Location */}
                  <View style={styles.postedGridItem}>
                    <Ionicons name="location-sharp" size={13} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postedGridLabel}>Location</Text>
                      <Text style={styles.postedGridVal} numberOfLines={1}>
                        {store.locality || "Selected Location"}
                      </Text>
                    </View>
                  </View>

                  {/* Workers Needed */}
                  <View style={styles.postedGridItem}>
                    <Ionicons name="people-sharp" size={13} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postedGridLabel}>Workers</Text>
                      <Text style={styles.postedGridVal} numberOfLines={1}>
                        {store.workers} {store.workers === 1 ? "Person" : "People"}
                      </Text>
                    </View>
                  </View>

                  {/* Schedule */}
                  <View style={styles.postedGridItem}>
                    <Ionicons name="calendar-sharp" size={13} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postedGridLabel}>Schedule</Text>
                      <Text style={styles.postedGridVal} numberOfLines={1}>
                        {formatDate(store.startDate || new Date())}
                      </Text>
                    </View>
                  </View>

                  {/* Hours */}
                  <View style={styles.postedGridItem}>
                    <Ionicons name="time-sharp" size={13} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postedGridLabel}>Timing</Text>
                      <Text style={styles.postedGridVal} numberOfLines={1}>
                        {store.hours === "full" ? "Full Day" : `${formatTime(store.startTime)} - ${formatTime(store.endTime)}`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Live Worker Broadcast Banner */}
                <View style={styles.broadcastBanner}>
                  <Ionicons name="radio" size={13} color={colors.green} />
                  <Text style={styles.broadcastBannerText} numberOfLines={1}>
                    Broadcasting to workers in {store.locality || "your area"}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* ── Always Visible Pinned Bottom Action Buttons ── */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.btnSuccessHome,
                  pressed && styles.btnSuccessHomePressed,
                ]}
                onPress={handleGoHome}
                accessibilityRole="button"
                accessibilityLabel="Go to Home"
              >
                <Ionicons name="home" size={17} color="#15803D" />
                <Text style={styles.btnSuccessHomeText}>Home</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnSuccessViewJob,
                  pressed && styles.btnSuccessViewJobPressed,
                ]}
                onPress={handleViewJob}
                accessibilityRole="button"
                accessibilityLabel="View Posted Job Details"
              >
                <Ionicons name="eye" size={17} color="#FFFFFF" />
                <Text style={styles.btnSuccessViewJobText}>View Job</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

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
            {/* Error Icon */}
            <View style={styles.errorIconBadge}>
              <Ionicons name="alert-circle" size={38} color="#DC2626" />
            </View>

            <Text style={styles.errorTitle}>Could Not Post Job</Text>
            <Text style={styles.errorDesc}>{errorMessage}</Text>

            {/* Error Actions */}
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

      {/* Exit Confirmation Modal */}
      <ExitModal
        visible={showExitModal}
        onClose={() => setShowExitModal(false)}
        onExit={handleConfirmExit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F5" },
  content: { flex: 1 },
  contentContainer: {
    padding: 18,
    paddingBottom: 36,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  stageTag: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heading: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F1F14",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B8A74",
    lineHeight: 18,
    marginBottom: 16,
  },

  // ── Main Review Card ──
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#D8E5DB",
    padding: 20,
    gap: 15,
    shadowColor: "#0B1A0F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  roleIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#EDFBF3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#C8EADA",
  },
  roleIconEmoji: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F1F14",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryPill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  cardSubTitleDot: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  cardSubTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6B8A74",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EDFBF3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#8FA89B",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F1F14",
    lineHeight: 20,
  },
  rowSubtext: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B8A74",
    marginTop: 2,
    lineHeight: 16,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F2FAF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CCE7D7",
  },
  editBtnPressed: {
    backgroundColor: "#E2F5EA",
    transform: [{ scale: 0.96 }],
  },
  editText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.green,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF5F1",
  },
  descSection: {
    gap: 4,
    backgroundColor: "#F8FAF9",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6EFEA",
  },
  descText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2D3E33",
    lineHeight: 18,
  },

  guaranteeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: "#EDFBF3",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8EADA",
  },
  guaranteeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.green,
  },

  // ── Modal Backdrop ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 20, 14, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  // ── Success Popup ──
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    width: "100%",
    maxWidth: 390,
    maxHeight: "92%",
    alignItems: "center",
    shadowColor: "#052E16",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  successScrollView: {
    width: "100%",
    flexShrink: 1,
  },
  successScrollContainer: {
    alignItems: "center",
    width: "100%",
    paddingBottom: 4,
  },
  celebrationArea: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  radarCircle: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#DCFCE7",
    borderWidth: 2,
    borderColor: colors.green,
  },
  radarCircleOuter: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  sparkleTopRight: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 10,
  },
  sparkleBottomLeft: {
    position: "absolute",
    bottom: -2,
    left: -4,
    zIndex: 10,
  },
  successCheckBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0F1F14",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  liveBroadcastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 12,
  },
  pulsingGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveBroadcastText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#047857",
    letterSpacing: 0.6,
  },

  // ── Posted Job Summary Card in Modal ──
  postedJobSummaryCard: {
    width: "100%",
    backgroundColor: "#F8FAF9",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#DCEAE2",
    padding: 12,
    marginBottom: 0,
  },
  postedSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postedSummaryIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C5E6D5",
  },
  postedSummaryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F1F14",
  },
  postedSummaryCategory: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B8A74",
    marginTop: 1,
  },
  postedPayBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  postedPayBadgeText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#047857",
  },
  postedPayBadgeUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  postedSummaryDivider: {
    height: 1,
    backgroundColor: "#E4ECE7",
    marginVertical: 8,
  },
  postedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  postedGridItem: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: "#FFFFFF",
    padding: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E9F0EB",
  },
  postedGridLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8FA89B",
    textTransform: "uppercase",
  },
  postedGridVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F1F14",
    marginTop: 1,
  },
  broadcastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginTop: 8,
  },
  broadcastBannerText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#15803D",
    flex: 1,
  },

  // ── Modal Action Buttons: Side-by-Side ──
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginTop: 14,
  },
  btnSuccessHome: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  btnSuccessHomePressed: {
    backgroundColor: "#DCFCE7",
    borderColor: "#4ADE80",
    transform: [{ scale: 0.97 }],
  },
  btnSuccessHomeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.2,
  },
  btnSuccessViewJob: {
    flex: 1.15,
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.green,
    borderWidth: 1.5,
    borderColor: "#0A4D27",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSuccessViewJobPressed: {
    backgroundColor: "#064E3B",
    transform: [{ scale: 0.97 }],
  },
  btnSuccessViewJobText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  modalCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F4F2",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },

  // ── Error Popup ──
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  errorIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F1F14",
    marginBottom: 6,
    textAlign: "center",
  },
  errorDesc: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  errorActions: {
    width: "100%",
    gap: 9,
  },
  btnRetry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    borderRadius: 13,
  },
  btnRetryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnReview: {
    paddingVertical: 12,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  btnReviewText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
});
