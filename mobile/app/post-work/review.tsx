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
    const id = createdJobId;
    store.resetFlow();
    if (id) {
      router.replace(`/jobs/${id}`);
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
              <Text style={styles.cardTitle}>{store.title || "Job Posting"}</Text>
              <Text style={styles.cardSubTitle}>
                {store.categoryName || "Work"} • {store.roleName || "Worker"}
              </Text>
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
                Experience: <Text style={{ fontWeight: "700" }}>{store.experience.toUpperCase()}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/details")}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="pencil" size={15} color={colors.green} />
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
              {store.address ? <Text style={styles.rowSubtext}>{store.address}</Text> : null}
            </View>
            <Pressable
              onPress={() => router.push("/post-work/location")}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="pencil" size={15} color={colors.green} />
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
              <Text style={styles.rowLabel}>Date & Time</Text>
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
                  ? "Full Day Work"
                  : `${formatTime(store.startTime)} - ${formatTime(store.endTime)}`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/schedule")}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="pencil" size={15} color={colors.green} />
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
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#6B8A74" }}>
                  per {store.payUnit}
                </Text>
              </Text>
              <Text style={styles.rowSubtext}>
                Paid {store.payWhen === "after" ? "after work completes" : store.payWhen}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/post-work/pay")}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="pencil" size={15} color={colors.green} />
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
            Direct direct connect with workers • No commission fees
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

      {/* ─── SUCCESS ANIMATED POPUP ─── */}
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
            {/* Confetti & Ripple Container */}
            <View style={styles.celebrationArea}>
              {/* Radar wave */}
              <Animated.View
                style={[
                  styles.radarCircle,
                  {
                    transform: [
                      {
                        scale: rippleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 2.2],
                        }),
                      },
                    ],
                    opacity: rippleAnim.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.5, 0.15, 0],
                    }),
                  },
                ]}
              />

              {/* Animated Bouncing Checkmark Badge */}
              <Animated.View
                style={[
                  styles.successCheckBadge,
                  {
                    transform: [
                      {
                        scale: checkBounce.interpolate({
                          inputRange: [0, 0.7, 1],
                          outputRange: [0, 1.25, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </Animated.View>
            </View>

            <Text style={styles.successTitle}>Job Posted Successfully! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Your job request for{" "}
              <Text style={{ fontWeight: "800", color: "#0F1F14" }}>
                "{store.title || store.roleName}"
              </Text>{" "}
              is now active. Nearby workers will be notified instantly.
            </Text>

            {/* Quick Summary Pill */}
            <View style={styles.successPill}>
              <View style={styles.successPillItem}>
                <Ionicons name="location-sharp" size={13} color={colors.green} />
                <Text style={styles.successPillText} numberOfLines={1}>
                  {store.locality}
                </Text>
              </View>
              <View style={styles.successPillDivider} />
              <View style={styles.successPillItem}>
                <Ionicons name="cash-outline" size={13} color={colors.green} />
                <Text style={styles.successPillText}>
                  ₹{store.payAmount}/{store.payUnit}
                </Text>
              </View>
            </View>

            {/* Actions: View Job & Go Home */}
            <View style={styles.successActions}>
              <Pressable
                onPress={handleViewJob}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>View Job</Text>
              </Pressable>

              <Pressable
                onPress={handleGoHome}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { backgroundColor: "#EDFBF3", transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="home-outline" size={18} color={colors.green} />
                <Text style={styles.btnSecondaryText}>Go Home</Text>
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
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#D8E5DB",
    padding: 18,
    gap: 14,
    shadowColor: "#0B1A0F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roleIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EDFBF3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#C8EADA",
  },
  roleIconEmoji: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F1F14",
    marginBottom: 2,
  },
  cardSubTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B8A74",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rowIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EDFBF3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8FA89B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F1F14",
    lineHeight: 19,
  },
  rowSubtext: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B8A74",
    marginTop: 2,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EDFBF3",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C8EADA",
  },
  editText: {
    fontSize: 11,
    fontWeight: "700",
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
    borderRadius: 26,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  celebrationArea: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  radarCircle: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#D2F4E2",
    borderWidth: 2,
    borderColor: colors.green,
  },
  successCheckBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F1F14",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  successSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B8A74",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  successPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2FBF6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8EADA",
    marginBottom: 20,
    gap: 8,
    maxWidth: "100%",
  },
  successPillItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  successPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F1F14",
  },
  successPillDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#C8EADA",
  },
  successActions: {
    width: "100%",
    gap: 10,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D8E5DB",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.green,
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
