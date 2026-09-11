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
      store.resetFlow();
      router.replace("/provider-home");
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
