import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  PanResponder,
  BackHandler,
  Vibration,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { AppPressable as Pressable } from "../AppPressable";
import { api } from "../../api/client";
import { invalidateServiceQueries } from "../../api/serviceApi";

export interface ServiceCompletionInteraction {
  id: string;
  title: string;
  otherName: string;
  otherPhotoUrl?: string | null;
  area?: string;
  status: string;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
  reviewed?: boolean | number;
  myRating?: number | null;
}

export interface ServiceCompletionConfirmationSheetProps {
  visible: boolean;
  interaction: ServiceCompletionInteraction | null;
  isProvider?: boolean;
  onClose: () => void;
  onConfirm?: (interaction: ServiceCompletionInteraction) => Promise<void>;
  onSubmitReview?: (review: {
    interactionId: string;
    stars: number;
    body: string;
  }) => Promise<void>;
}

type SheetStep = "prompt" | "rating" | "success";

const PROVIDER_FEEDBACK_TAGS = [
  "Clear requirements",
  "Polite & respectful",
  "Prompt payment",
  "Safe environment",
  "Accurate location",
  "Great customer",
  "Would serve again",
];

const CUSTOMER_FEEDBACK_TAGS = [
  "On-time arrival",
  "Quality workmanship",
  "Professional & skilled",
  "Fair pricing",
  "Polite & respectful",
  "Cleaned workspace",
  "Would book again",
];

const STAR_LABELS: Record<number, string> = {
  1: "⭐ Needs improvement",
  2: "⭐ Fair — could be better",
  3: "⭐ Good — satisfied",
  4: "⭐ Very good — great work!",
  5: "⭐ Excellent — highly recommended!",
};

export function ServiceCompletionConfirmationSheet({
  visible,
  interaction,
  isProvider = true,
  onClose,
  onConfirm,
  onSubmitReview,
}: ServiceCompletionConfirmationSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const sheetHeight = Math.min(height * 0.82, 580);

  // Animation values
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.4)).current;

  // Local step & action states
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<SheetStep>("prompt");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rating & Feedback state
  const [stars, setStars] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const closingRef = useRef(false);
  const isBusyRef = useRef(false);
  isBusyRef.current = isBusy || isSubmittingReview;

  // Animate Out
  const animateOut = useCallback(
    (callback?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: sheetHeight,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
        closingRef.current = false;
        callback?.();
      });
    },
    [backdropOpacity, translateY, sheetHeight],
  );

  // Initialize and animate in
  useEffect(() => {
    if (visible && interaction) {
      closingRef.current = false;
      setMounted(true);
      setErrorMessage(null);
      setReviewError(null);
      setStars(0);
      setSelectedTags([]);
      setFeedbackText("");

      // If already completed and needs rating, start in rating step directly
      if (interaction.status === "COMPLETED") {
        setStep("rating");
      } else {
        setStep("prompt");
      }

      stepOpacity.setValue(1);
      translateY.setValue(sheetHeight);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          mass: 0.85,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!visible && mounted && !closingRef.current) {
      animateOut(onClose);
    }
  }, [visible, interaction, mounted, animateOut, onClose, sheetHeight, backdropOpacity, stepOpacity, translateY]);

  // Back handler
  useEffect(() => {
    if (!mounted || !visible) return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isBusyRef.current) return true;
      if (step === "rating" && interaction?.status !== "COMPLETED") {
        setStep("prompt");
        return true;
      }
      animateOut(onClose);
      return true;
    });
    return () => backHandler.remove();
  }, [mounted, visible, step, interaction, animateOut, onClose]);

  // Pan Responder for swipe down to dismiss
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 && Math.abs(gestureState.dx) < 20,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isBusyRef.current) return;
          if (gestureState.dy > 120 || gestureState.vy > 0.6) {
            animateOut(onClose);
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 24,
              stiffness: 240,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [animateOut, onClose, translateY],
  );

  // Transition helper
  const transitionToStep = (nextStep: SheetStep) => {
    setErrorMessage(null);
    setReviewError(null);
    Animated.timing(stepOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      if (nextStep === "success") {
        successScale.setValue(0.4);
        Animated.spring(successScale, {
          toValue: 1,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }).start();
      }
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start();
    });
  };

  // Confirm completion handler
  const handleConfirmWork = async () => {
    if (!interaction || isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);

    if (Platform.OS === "android") Vibration.vibrate(20);

    try {
      if (onConfirm) {
        await onConfirm(interaction);
      } else {
        await api(`/applications/${interaction.id}/action`, {
          action: "confirm",
        });
      }

      await Promise.allSettled([
        invalidateServiceQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-interactions"] }),
      ]);

      if (Platform.OS === "android") Vibration.vibrate(25);

      transitionToStep("rating");
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Could not confirm completion. Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  // Tag toggle helper
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Submit Rating & Feedback handler
  const handleReviewSubmit = async () => {
    if (!interaction || stars === 0 || isSubmittingReview) return;
    setIsSubmittingReview(true);
    setReviewError(null);

    const tagText = selectedTags.length > 0 ? selectedTags.join(", ") : "";
    const combinedBody = [tagText, feedbackText.trim()].filter(Boolean).join(" - ");

    try {
      if (onSubmitReview) {
        await onSubmitReview({
          interactionId: interaction.id,
          stars,
          body: combinedBody,
        });
      } else {
        await api("/reviews", {
          interactionId: interaction.id,
          stars,
          body: combinedBody,
        });
      }

      await Promise.allSettled([
        invalidateServiceQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-interactions"] }),
      ]);

      if (Platform.OS === "android") Vibration.vibrate([0, 30, 60, 30]);

      transitionToStep("success");
    } catch (err: any) {
      setReviewError(
        err?.message || "Couldn't save your rating. Please try again.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!mounted || !interaction) return null;

  const otherPersonName = interaction.otherName || (isProvider ? "Customer" : "Provider");
  const tagsList = isProvider ? PROVIDER_FEEDBACK_TAGS : CUSTOMER_FEEDBACK_TAGS;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isBusyRef.current) animateOut(onClose);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isBusyRef.current) animateOut(onClose);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: sheetHeight,
              transform: [{ translateY }],
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />

          <Animated.View style={{ flex: 1, opacity: stepOpacity }}>
            {/* 1. Prompt Step: Confirm Work Done */}
            {step === "prompt" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
              >
                <View style={styles.badgeRow}>
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#086649" />
                    <Text style={styles.statusPillText}>SERVICE COMPLETION</Text>
                  </View>
                </View>

                <Text style={styles.title}>
                  {isProvider ? "Mark service as complete?" : "Confirm service completion?"}
                </Text>
                <Text style={styles.subtitle}>
                  {isProvider
                    ? `Marking this service complete notifies ${otherPersonName} and unlocks mutual rating and feedback.`
                    : `${otherPersonName} marked this service as complete. Please confirm the work was done and rate your experience.`}
                </Text>

                {/* Service Card Summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryIconCircle}>
                    <Ionicons name="construct" size={20} color="#086649" />
                  </View>
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryTitle} numberOfLines={1}>
                      {interaction.title || "Service"}
                    </Text>
                    <View style={styles.summaryMetaRow}>
                      <Ionicons name="person-outline" size={12} color="#718078" />
                      <Text style={styles.summaryMetaText}>{otherPersonName}</Text>
                      {!!interaction.area && (
                        <>
                          <Text style={styles.summaryBullet}>•</Text>
                          <Ionicons name="location-outline" size={12} color="#718078" />
                          <Text style={styles.summaryMetaText}>{interaction.area}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>

                {!!errorMessage && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={15} color="#B42318" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <Pressable
                    onPress={handleConfirmWork}
                    disabled={isBusy}
                    style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm work completed"
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>
                          {isProvider ? "Mark Work Done & Rate" : "Confirm Completed & Rate"}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => animateOut(onClose)}
                    disabled={isBusy}
                    style={styles.cancelLink}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelLinkText}>Not yet</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}

            {/* 2. Rating Step */}
            {step === "rating" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.ratingHeaderRow}>
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#086649" />
                    <Text style={styles.statusPillText}>SERVICE COMPLETED</Text>
                  </View>
                  <Pressable
                    onPress={() => transitionToStep("success")}
                    style={styles.skipBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Skip rating"
                  >
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </Pressable>
                </View>

                <Text style={styles.title}>
                  {isProvider ? "Rate your customer" : "How was your service?"}
                </Text>
                <Text style={styles.subtitle}>
                  {isProvider
                    ? `Share your experience working with ${otherPersonName}.`
                    : `How was your experience with ${otherPersonName}? Your feedback helps the community.`}
                </Text>

                {/* Star Rating Section */}
                <View style={styles.starsContainer}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const filled = starIndex <= stars;
                      return (
                        <Pressable
                          key={starIndex}
                          onPress={() => {
                            setStars(starIndex);
                            if (Platform.OS === "android") Vibration.vibrate(12);
                          }}
                          style={styles.starTouch}
                          accessibilityRole="button"
                          accessibilityLabel={`${starIndex} star rating`}
                        >
                          <Ionicons
                            name={filled ? "star" : "star-outline"}
                            size={34}
                            color={filled ? "#F59E0B" : "#D1D5DB"}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                  {stars > 0 && (
                    <Text style={styles.starLabelText}>
                      {STAR_LABELS[stars] || ""}
                    </Text>
                  )}
                </View>

                {/* Feedback Tags */}
                <View style={styles.tagsSection}>
                  <Text style={styles.tagsHeading}>What went well?</Text>
                  <View style={styles.tagsWrapper}>
                    {tagsList.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <Pressable
                          key={tag}
                          onPress={() => toggleTag(tag)}
                          style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={13} color="#086649" />
                          )}
                          <Text
                            style={[
                              styles.tagChipText,
                              isSelected && styles.tagChipTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Comments Input */}
                <View style={styles.commentSection}>
                  <Text style={styles.commentHeading}>
                    Additional comments (optional)
                  </Text>
                  <TextInput
                    style={styles.commentInput}
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    placeholder={
                      isProvider
                        ? `Tell others about working with ${otherPersonName}...`
                        : `Share details about ${otherPersonName}'s service quality...`
                    }
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={styles.characterCount}>
                    {feedbackText.length}/500
                  </Text>
                </View>

                {!!reviewError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={15} color="#B42318" />
                    <Text style={styles.errorText}>{reviewError}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <Pressable
                    onPress={handleReviewSubmit}
                    disabled={stars === 0 || isSubmittingReview}
                    style={[
                      styles.primaryBtn,
                      (stars === 0 || isSubmittingReview) && styles.btnDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Submit rating"
                  >
                    {isSubmittingReview ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="star" size={17} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>
                          {stars > 0
                            ? `Submit ${stars}-Star Rating`
                            : "Select Stars to Rate"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}

            {/* 3. Success Step */}
            {step === "success" && (
              <View style={styles.successContainer}>
                <Animated.View
                  style={[
                    styles.successIconCircle,
                    { transform: [{ scale: successScale }] },
                  ]}
                >
                  <Ionicons name="checkmark" size={44} color="#FFFFFF" />
                </Animated.View>

                <Text style={styles.successTitle}>Thank you for your rating!</Text>
                <Text style={styles.successSubtitle}>
                  Your feedback helps maintain high standards and mutual trust across the Bulao community.
                </Text>

                <Pressable
                  onPress={() => animateOut(onClose)}
                  style={styles.primaryBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>Done</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 38, 29, 0.40)",
  },
  sheet: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#193D2D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1DCD5",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  ratingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF5EF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  statusPillText: {
    color: "#086649",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skipBtnText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    color: "#182C25",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#65756C",
    marginTop: 4,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#F7FAF8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    marginTop: 16,
  },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E8F4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryInfo: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#182C25",
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  summaryMetaText: {
    fontSize: 12,
    color: "#718078",
  },
  summaryBullet: {
    fontSize: 12,
    color: "#A0AEC0",
    marginHorizontal: 2,
  },
  starsContainer: {
    backgroundColor: "#FFFDF7",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 14,
    gap: 6,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  starTouch: {
    padding: 4,
  },
  starLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B45309",
    marginTop: 2,
  },
  tagsSection: {
    marginTop: 14,
  },
  tagsHeading: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#182C25",
    marginBottom: 8,
  },
  tagsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F3F5F4",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipSelected: {
    backgroundColor: "#EAF5EF",
    borderColor: "#086649",
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  tagChipTextSelected: {
    color: "#086649",
    fontWeight: "700",
  },
  commentSection: {
    marginTop: 14,
  },
  commentHeading: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#182C25",
    marginBottom: 6,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderRadius: 14,
    backgroundColor: "#FBFCFB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#182C25",
    minHeight: 70,
    maxHeight: 110,
  },
  characterCount: {
    fontSize: 10.5,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#B42318",
    flex: 1,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#086649",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  cancelLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  cancelLinkText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  successContainer: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#086649",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#182C25",
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#65756C",
    textAlign: "center",
    marginBottom: 8,
  },
});
