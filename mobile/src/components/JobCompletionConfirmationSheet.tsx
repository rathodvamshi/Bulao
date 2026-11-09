import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
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
  AccessibilityInfo,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { AppPressable } from "./AppPressable";
import { api } from "../api/client";
import { invalidateJobLifecycleQueries } from "../api/jobLifecycleCache";

export type CompletionInteraction = {
  id: string;
  kind?: string;
  jobId: string | null;
  status: string;
  ownerId?: string;
  workerId?: string;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
  completionRejectedAt?: number | null;
  completionRejectedBy?: string | null;
  completionRejectionReason?: string | null;
  title: string;
  area: string;
  payPaise?: number | null;
  payUnit?: string | null;
  startsAt?: number | null;
  otherName: string;
  reviewed?: boolean;
};

export function notificationInteractionId(data: unknown): string | null {
  try {
    const value = typeof data === "string" ? JSON.parse(data) : data;
    return typeof value?.interactionId === "string" ? value.interactionId : null;
  } catch {
    return null;
  }
}

export interface JobCompletionConfirmationSheetProps {
  visible: boolean;
  interaction: CompletionInteraction | null;
  isOwner?: boolean;
  onClose: () => void;
  onReviewJob?: (interaction: CompletionInteraction) => void;
  onConfirm: (interaction: CompletionInteraction) => Promise<void | { status?: string }>;
  onSubmitReview?: (review: { interactionId: string; stars: number; body: string }) => Promise<void>;
}

type SheetStep = "prompt" | "confirm_step" | "rating" | "success";

function formatPay(paise?: number | null, unit?: string | null): string | null {
  if (paise == null || paise < 0) return null;
  const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(paise / 100);
  const suffix = unit ? ` / ${unit.toLowerCase()}` : "";
  return `₹${amount}${suffix}`;
}

const PROVIDER_FEEDBACK_TAGS = [
  "Punctual",
  "Skilled & Efficient",
  "Hardworking",
  "Polite & Respectful",
  "Completed on time",
  "Great attitude",
];

const SEEKER_FEEDBACK_TAGS = [
  "Fair employer",
  "Clear instructions",
  "Prompt payment",
  "Friendly & respectful",
  "Safe environment",
  "Would work again",
];

const STAR_LABELS: Record<number, string> = {
  1: "⭐ Needs improvement",
  2: "⭐ Fair — could be better",
  3: "⭐ Good — satisfied",
  4: "⭐ Very good — great work!",
  5: "⭐ Excellent — highly recommended!",
};

export function JobCompletionConfirmationSheet({
  visible,
  interaction,
  isOwner = true,
  onClose,
  onReviewJob,
  onConfirm,
  onSubmitReview,
}: JobCompletionConfirmationSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const sheetHeight = Math.min(height * 0.78, 560);

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
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [awaitingOtherConfirmation, setAwaitingOtherConfirmation] = useState(false);

  const closingRef = useRef(false);
  const isBusyRef = useRef(false);
  const isConfirmingRef = useRef(false);
  const isSubmittingReviewRef = useRef(false);
  isBusyRef.current = isBusy || isSubmittingReview;

  // Accessibility reduced motion check
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  // Smooth Exit Animation
  const animateOut = useCallback(
    (onComplete?: () => void) => {
      if (closingRef.current || isBusyRef.current) return;
      closingRef.current = true;

      if (reduceMotion) {
        translateY.setValue(sheetHeight);
        backdropOpacity.setValue(0);
        closingRef.current = false;
        setMounted(false);
        onComplete?.();
        return;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetHeight,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        closingRef.current = false;
        setMounted(false);
        onComplete?.();
      });
    },
    [backdropOpacity, reduceMotion, sheetHeight, translateY]
  );

  // Reset & Entrance Animation
  useEffect(() => {
    if (visible && interaction) {
      closingRef.current = false;
      const initialStep: SheetStep = interaction.status === "COMPLETED" ? "rating" : "prompt";
      setStep(initialStep);
      setIsBusy(false);
      setErrorMessage(null);
      setStars(0);
      setSelectedTags([]);
      setFeedbackText("");
      setIsSubmittingReview(false);
      setReviewError(null);
      setReviewSubmitted(false);
      setAwaitingOtherConfirmation(false);
      setMounted(true);
      stepOpacity.setValue(1);
      successScale.setValue(0.4);

      if (reduceMotion) {
        translateY.setValue(0);
        backdropOpacity.setValue(1);
      } else {
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
      }
    } else if (!visible && mounted && !closingRef.current) {
      animateOut(onClose);
    }
  }, [visible, interaction, mounted, animateOut, onClose, reduceMotion, sheetHeight, backdropOpacity, stepOpacity, successScale, translateY]);

  // Android Back Handler
  useEffect(() => {
    if (!mounted || !visible) return;

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isBusyRef.current) return true; // Don't interrupt processing
      if (step === "confirm_step") {
        transitionToStep("prompt");
        return true;
      }
      if (step === "rating") {
        // Allow skipping review on back press
        transitionToStep("success");
        return true;
      }
      animateOut(onClose);
      return true;
    });

    return () => backHandler.remove();
  }, [mounted, visible, step, animateOut, onClose]);

  // Smooth step transition helper
  const transitionToStep = (nextStep: SheetStep) => {
    setErrorMessage(null);
    setReviewError(null);
    if (reduceMotion) {
      setStep(nextStep);
      return;
    }

    Animated.timing(stepOpacity, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      if (nextStep === "success") {
        successScale.setValue(0.3);
        Animated.parallel([
          Animated.timing(stepOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(successScale, {
            toValue: 1,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
    });
  };

  // Pan Responder for Drag-to-dismiss gesture on handle & top bar
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isBusyRef.current) return false;
          // Capture downward drag only
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        },
        onPanResponderMove: (_, gestureState) => {
          if (isBusyRef.current) return;
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          } else {
            translateY.setValue(Math.max(-15, gestureState.dy * 0.2));
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
    [animateOut, onClose, translateY]
  );

  // Final completion confirmation handler -> leads into Rating step!
  const handleFinalConfirm = async () => {
    if (!interaction || isConfirmingRef.current || isBusy) return;
    isConfirmingRef.current = true;
    setIsBusy(true);
    setErrorMessage(null);

    if (Platform.OS === "android") {
      Vibration.vibrate(20);
    }

    try {
      const result = await onConfirm(interaction);
      if (Platform.OS === "android") {
        Vibration.vibrate(25);
      }
      // If already reviewed, go to success; otherwise show Rating step!
      const completionStatus = result && typeof result === "object" ? result.status : undefined;
      if (interaction.reviewed) {
        transitionToStep("success");
      } else if (interaction.status === "COMPLETED" || completionStatus === "COMPLETED") {
        transitionToStep("rating");
      } else {
        setAwaitingOtherConfirmation(true);
        transitionToStep("success");
      }
    } catch (err: any) {
      setErrorMessage(
        err instanceof Error ? err.message : "Couldn't confirm completion. Please check your connection and try again."
      );
    } finally {
      setIsBusy(false);
      isConfirmingRef.current = false;
    }
  };

  const handleRejectCompletion = async () => {
    if (!interaction || isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await api(`/applications/${encodeURIComponent(interaction.id)}/action`, {
        action: "reject_completion",
        reason: "Work is not complete yet.",
      });
      await Promise.allSettled([
        invalidateJobLifecycleQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-completion-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["seeker-completion-activity"] }),
      ]);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't report that the work is incomplete. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  // Tag toggle helper
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  // Submit Rating & Feedback handler
  const handleReviewSubmit = async () => {
    if (!interaction || stars === 0 || isSubmittingReviewRef.current || isSubmittingReview) return;
    isSubmittingReviewRef.current = true;
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
        invalidateJobLifecycleQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["provider-completion-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["seeker-completion-activity"] }),
      ]);

      if (Platform.OS === "android") {
        Vibration.vibrate([0, 30, 60, 30]);
      }
      setReviewSubmitted(true);
      transitionToStep("success");
    } catch (err: any) {
      setReviewError(
        err instanceof Error ? err.message : "Couldn't save your rating. Please try again."
      );
    } finally {
      setIsSubmittingReview(false);
      isSubmittingReviewRef.current = false;
    }
  };

  const handleDismiss = () => {
    animateOut(onClose);
  };

  const handleReview = () => {
    if (!interaction) return;
    animateOut(() => {
      onReviewJob?.(interaction);
      onClose();
    });
  };

  if (!mounted || !interaction) return null;

  const otherRoleLabel = isOwner ? "seeker" : "provider";
  const otherName = interaction.otherName || (isOwner ? "Seeker" : "Provider");
  const jobTitle = interaction.title || "Job Opportunity";
  const payDisplay = formatPay(interaction.payPaise, interaction.payUnit);
  const isNarrowScreen = width < 360;
  const feedbackTags = isOwner ? PROVIDER_FEEDBACK_TAGS : SEEKER_FEEDBACK_TAGS;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isBusyRef.current) animateOut(onClose);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isBusyRef.current) handleDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss completion prompt"
          />
        </Animated.View>

        {/* Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY }],
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          {/* Top Handle & Drag Zone */}
          <View {...panResponder.panHandlers} style={styles.dragZone}>
            <View style={styles.dragHandle} />
          </View>

          {/* Animated Sheet Body */}
          <Animated.View style={[styles.bodyAnimatedWrapper, { opacity: stepOpacity }]}>
            {/* STEP 1: Prompt State */}
            {step === "prompt" && (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Header Row: Eyebrow + Close */}
                <View style={styles.headerRow}>
                  <View style={styles.eyebrowBadge}>
                    <Ionicons name="checkmark-done-circle" size={16} color="#075B43" />
                    <Text style={styles.eyebrowText}>ACTION NEEDED</Text>
                  </View>
                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel="Close confirmation prompt"
                    disabled={isBusy}
                    onPress={handleDismiss}
                    hitSlop={12}
                    style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  >
                    <Ionicons name="close" size={18} color="#4A5C53" />
                  </AppPressable>
                </View>

                {/* Title & Description */}
                <Text style={styles.sheetTitle}>The {otherRoleLabel} says this job is done</Text>
                <Text style={styles.sheetSubtitle}>
                  Review the job, then confirm only if all agreed work is finished.
                </Text>

                {/* Job Info Card */}
                <View style={styles.jobCard}>
                  <View style={styles.jobIconBox}>
                    <Ionicons name="briefcase" size={20} color="#075B43" />
                  </View>
                  <View style={styles.jobInfoColumn}>
                    <Text style={styles.jobTitleText} numberOfLines={2}>
                      {jobTitle}
                    </Text>
                    <View style={styles.jobMetaRow}>
                      <Ionicons name="person-circle-outline" size={14} color="#64786E" />
                      <Text style={styles.seekerNameText} numberOfLines={1}>
                        {otherName}
                      </Text>
                    </View>
                    <View style={styles.jobDetailsRow}>
                      <View style={styles.jobLocationPill}>
                        <Ionicons name="location-sharp" size={12} color="#075B43" />
                        <Text style={styles.jobLocationText} numberOfLines={1}>
                          {interaction.area || "Local area"}
                        </Text>
                      </View>
                      {payDisplay ? (
                        <>
                          <Text style={styles.metaDot}>·</Text>
                          <View style={styles.jobPayPill}>
                            <Text style={styles.jobPayText}>{payDisplay}</Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Consequence Banner */}
                <View style={styles.warningBanner}>
                  <View style={styles.warningIconWrapper}>
                    <Ionicons name="shield-checkmark" size={18} color="#B45309" />
                  </View>
                  <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>Your confirmation completes the job for both of you.</Text>
                    <Text style={styles.warningSubtitle}>
                      Once confirmed, the job is marked as completed and mutual reviews unlock.
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* STEP 2: Verification Step */}
            {step === "confirm_step" && (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Back button & Eyebrow */}
                <View style={styles.headerRow}>
                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to prompt"
                    disabled={isBusy}
                    onPress={() => transitionToStep("prompt")}
                    hitSlop={10}
                    style={({ pressed }) => [styles.backStepBtn, pressed && styles.closeBtnPressed]}
                  >
                    <Ionicons name="arrow-back" size={18} color="#075B43" />
                    <Text style={styles.backStepText}>Back</Text>
                  </AppPressable>
                  <View style={styles.eyebrowBadgeNeutral}>
                    <Ionicons name="shield-outline" size={14} color="#4A5C53" />
                    <Text style={styles.eyebrowTextNeutral}>VERIFICATION</Text>
                  </View>
                </View>

                {/* Step Headline */}
                <Text style={styles.sheetTitle}>Confirm Job Completion?</Text>
                <Text style={styles.sheetSubtitle}>
                  Please verify that all work for <Text style={styles.boldText}>"{jobTitle}"</Text> was performed to your
                  satisfaction.
                </Text>

                {/* Verification points card */}
                <View style={styles.verificationCard}>
                  <View style={styles.verificationRow}>
                    <View style={styles.checkIconBox}>
                      <Ionicons name="checkmark" size={14} color="#075B43" />
                    </View>
                    <Text style={styles.verificationText}>
                      <Text style={styles.boldText}>{otherName}</Text> delivered all agreed tasks.
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <View style={styles.checkIconBox}>
                      <Ionicons name="checkmark" size={14} color="#075B43" />
                    </View>
                    <Text style={styles.verificationText}>
                      Job status will change to <Text style={styles.boldText}>Completed</Text> immediately.
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <View style={styles.checkIconBox}>
                      <Ionicons name="checkmark" size={14} color="#075B43" />
                    </View>
                    <Text style={styles.verificationText}>
                      Both parties can now leave verified ratings and feedback.
                    </Text>
                  </View>
                </View>

                {/* Error Banner if confirmation fails */}
                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* STEP 3: Rating & Feedback Step */}
            {step === "rating" && (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Header row with badge */}
                <View style={styles.headerRow}>
                  <View style={interaction.status === "COMPLETED" ? styles.eyebrowBadge : styles.ratingBadge}>
                    <Ionicons
                      name={interaction.status === "COMPLETED" ? "checkmark-done-circle" : "star"}
                      size={15}
                      color={interaction.status === "COMPLETED" ? "#075B43" : "#D97706"}
                    />
                    <Text style={interaction.status === "COMPLETED" ? styles.eyebrowText : styles.ratingBadgeText}>
                      {interaction.status === "COMPLETED" ? "JOB COMPLETED" : "SHARE FEEDBACK"}
                    </Text>
                  </View>
                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel="Skip rating for now"
                    disabled={isSubmittingReview}
                    onPress={() => (interaction.status === "COMPLETED" ? handleDismiss() : transitionToStep("success"))}
                    hitSlop={10}
                    style={({ pressed }) => [styles.skipHeaderBtn, pressed && styles.closeBtnPressed]}
                  >
                    <Text style={styles.skipHeaderText}>Skip</Text>
                  </AppPressable>
                </View>

                {/* Rating Title */}
                <Text style={styles.sheetTitle}>
                  {interaction.status === "COMPLETED"
                    ? isOwner
                      ? "Job completed — rate seeker"
                      : "Your job is completed!"
                    : "Rate your experience"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {interaction.status === "COMPLETED"
                    ? `${otherName} accepted and confirmed the completed work. How was your experience?`
                    : `How was working with ${otherName} on "${jobTitle}"?`}
                </Text>

                {/* Completed Job Info Card (Shown when reviewing an already-completed job) */}
                {interaction.status === "COMPLETED" && (
                  <View style={styles.jobCard}>
                    <View style={styles.jobIconBox}>
                      <Ionicons name="briefcase" size={16} color="#075B43" />
                    </View>
                    <View style={styles.jobInfoColumn}>
                      <Text style={styles.jobTitleText} numberOfLines={1}>
                        {jobTitle}
                      </Text>
                      <View style={styles.jobDetailsRow}>
                        <Ionicons name="person-circle-outline" size={13} color="#64786E" />
                        <Text style={styles.seekerNameText} numberOfLines={1}>
                          {otherName}
                        </Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Ionicons name="location-sharp" size={11} color="#075B43" />
                        <Text style={styles.jobLocationText} numberOfLines={1}>
                          {interaction.area || "Local area"}
                        </Text>
                        {payDisplay ? (
                          <>
                            <Text style={styles.metaDot}>·</Text>
                            <View style={styles.jobPayPill}>
                              <Text style={styles.jobPayText}>{payDisplay}</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}

                {/* 5-Star Interactive Selector */}
                <View style={styles.starsWrapper}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const filled = starIndex <= stars;
                      return (
                        <AppPressable
                          key={starIndex}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate ${starIndex} stars`}
                          onPress={() => {
                            setStars(starIndex);
                            if (Platform.OS === "android") Vibration.vibrate(15);
                          }}
                          style={({ pressed }) => [
                            styles.starTouchTarget,
                            pressed && { transform: [{ scale: 1.15 }] },
                          ]}
                        >
                          <Ionicons
                            name={filled ? "star" : "star-outline"}
                            size={30}
                            color={filled ? "#F59E0B" : "#BCCFC6"}
                          />
                        </AppPressable>
                      );
                    })}
                  </View>
                  {stars > 0 ? (
                    <Text style={styles.starDescriptor}>{STAR_LABELS[stars]}</Text>
                  ) : (
                    <Text style={styles.starDescriptorHint}>Tap a star to rate</Text>
                  )}
                </View>

                {/* Quick Compliment Tags */}
                <Text style={styles.sectionLabel}>What went well?</Text>
                <View style={styles.tagsContainer}>
                  {feedbackTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <AppPressable
                        key={tag}
                        accessibilityRole="button"
                        accessibilityLabel={tag}
                        onPress={() => toggleTag(tag)}
                        style={({ pressed }) => [
                          styles.tagChip,
                          isSelected && styles.tagChipSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark-sharp" size={13} color="#075B43" />}
                        <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                          {tag}
                        </Text>
                      </AppPressable>
                    );
                  })}
                </View>

                {/* Optional Feedback Comment Input */}
                <Text style={styles.sectionLabel}>Additional comments (optional)</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder={`Tell others about working with ${otherName}…`}
                    placeholderTextColor="#8A9E94"
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    editable={!isSubmittingReview}
                  />
                  <Text style={styles.charCount}>{feedbackText.length}/500</Text>
                </View>

                {/* Review Error Banner */}
                {reviewError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={styles.errorBannerText}>{reviewError}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* STEP 4: Success State */}
            {step === "success" && (
              <View style={styles.successContainer}>
                <Animated.View style={[styles.successIconCircle, { transform: [{ scale: successScale }] }]}>
                  <Ionicons name="checkmark-circle" size={58} color="#075B43" />
                </Animated.View>
                <Text style={styles.successTitle}>
                  {reviewSubmitted
                    ? "Thank you for your feedback!"
                    : awaitingOtherConfirmation
                      ? "Confirmation saved"
                      : "Job Successfully Completed!"}
                </Text>
                <Text style={styles.successSubtitle}>
                  {reviewSubmitted
                    ? `Your rating and review for ${otherName} have been recorded. Both profiles and job status are updated.`
                    : awaitingOtherConfirmation
                      ? `Your confirmation is saved. The job will be completed after ${otherName} confirms too; then you can leave a rating.`
                      : `The job has been marked complete across the platform. Both you and ${otherName} are verified as finished.`}
                </Text>
                <View style={[styles.successBadge, awaitingOtherConfirmation && styles.successWaitingBadge]}>
                  <Ionicons name={awaitingOtherConfirmation ? "time-outline" : "shield-checkmark"} size={15} color={awaitingOtherConfirmation ? "#9A6700" : "#075B43"} />
                  <Text style={[styles.successBadgeText, awaitingOtherConfirmation && styles.successWaitingBadgeText]}>{awaitingOtherConfirmation ? "Waiting for confirmation" : "Status: Completed"}</Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Sheet Footer Actions */}
          <View style={styles.footerContainer}>
            {step === "prompt" && (
              <View style={styles.promptActions}>
                {/* 1. Primary Action: Accept & Confirm Completed */}
                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Accept & Confirm Completed"
                  disabled={isBusy}
                  onPress={() => transitionToStep("confirm_step")}
                  style={({ pressed }) => [
                    styles.primaryConfirmBtn,
                    pressed && styles.primaryConfirmBtnPressed,
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryConfirmText}>Accept & Confirm Completed</Text>
                </AppPressable>

                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Reject completion because work is not complete"
                  disabled={isBusy}
                  onPress={() => void handleRejectCompletion()}
                  style={({ pressed }) => [styles.rejectCompletionBtn, pressed && styles.rejectCompletionBtnPressed]}
                >
                  <Ionicons name="alert-circle-outline" size={17} color="#A33B32" />
                  <Text style={styles.rejectCompletionText}>Not completed yet</Text>
                </AppPressable>

                {/* 2. Secondary Actions Row: Review job + Not now */}
                <View style={[styles.secondaryActionsRow, isNarrowScreen && styles.secondaryActionsCol]}>
                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel="Review job details"
                    disabled={isBusy}
                    onPress={handleReview}
                    style={({ pressed }) => [
                      styles.reviewJobBtn,
                      pressed && styles.reviewJobBtnPressed,
                    ]}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#075B43" />
                    <Text style={styles.reviewJobText}>Review job</Text>
                  </AppPressable>

                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel="Not now, dismiss sheet"
                    disabled={isBusy}
                    onPress={handleDismiss}
                    style={({ pressed }) => [
                      styles.notNowBtn,
                      pressed && styles.notNowBtnPressed,
                    ]}
                  >
                    <Text style={styles.notNowText}>Not now</Text>
                  </AppPressable>
                </View>
              </View>
            )}

            {step === "confirm_step" && (
              <View style={styles.promptActions}>
                {/* Final Confirmation Button */}
                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm and mark completed"
                  disabled={isBusy}
                  onPress={() => void handleFinalConfirm()}
                  style={({ pressed }) => [
                    styles.primaryConfirmBtn,
                    pressed && !isBusy && styles.primaryConfirmBtnPressed,
                    isBusy && styles.primaryConfirmBtnDisabled,
                  ]}
                >
                  {isBusy ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primaryConfirmText}>Confirming completion…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryConfirmText}>Yes, Complete Job</Text>
                    </>
                  )}
                </AppPressable>

                {/* Cancel / Back Button */}
                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel final confirmation"
                  disabled={isBusy}
                  onPress={() => transitionToStep("prompt")}
                  style={({ pressed }) => [
                    styles.notNowBtn,
                    pressed && !isBusy && styles.notNowBtnPressed,
                    isBusy && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.notNowText}>Cancel</Text>
                </AppPressable>
              </View>
            )}

            {step === "rating" && (
              <View style={styles.promptActions}>
                {/* Submit Rating Button */}
                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit rating and feedback"
                  disabled={stars === 0 || isSubmittingReview}
                  onPress={() => void handleReviewSubmit()}
                  style={({ pressed }) => [
                    styles.primaryConfirmBtn,
                    stars === 0 && styles.primaryConfirmBtnDisabled,
                    pressed && stars > 0 && !isSubmittingReview && styles.primaryConfirmBtnPressed,
                  ]}
                >
                  {isSubmittingReview ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primaryConfirmText}>Submitting rating…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="star" size={17} color="#FFFFFF" />
                      <Text style={styles.primaryConfirmText}>
                        {stars > 0 ? `Submit ${stars}-Star Rating` : "Select a Rating"}
                      </Text>
                    </>
                  )}
                </AppPressable>
              </View>
            )}

            {step === "success" && (
              <View style={styles.promptActions}>
                <AppPressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  onPress={handleDismiss}
                  style={({ pressed }) => [
                    styles.primaryConfirmBtn,
                    pressed && styles.primaryConfirmBtnPressed,
                  ]}
                >
                  <Text style={styles.primaryConfirmText}>Done</Text>
                </AppPressable>
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 26, 21, 0.48)",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    overflow: "hidden",
    shadowColor: "#061A13",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 20,
  },
  dragZone: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D3DCD6",
  },
  bodyAnimatedWrapper: {
    flexShrink: 1,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    minHeight: 28,
  },
  eyebrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E6F4ED",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
  },
  eyebrowText: {
    color: "#075B43",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  eyebrowBadgeNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F4F2",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
  },
  eyebrowTextNeutral: {
    color: "#4A5C53",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
  },
  ratingBadgeText: {
    color: "#92400E",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  skipHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  skipHeaderText: {
    color: "#5A6D63",
    fontSize: 12.5,
    fontWeight: "600",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    opacity: 0.7,
    backgroundColor: "#E6ECE9",
  },
  backStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F2",
  },
  backStepText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#075B43",
  },
  sheetTitle: {
    color: "#0F2E23",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    color: "#54685E",
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: "700",
    color: "#0F2E23",
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F6FAF7",
    borderWidth: 1,
    borderColor: "#E1ECE5",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 10,
  },
  jobIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2F2E9",
  },
  jobInfoColumn: {
    flex: 1,
    gap: 2,
  },
  jobTitleText: {
    color: "#102A2A",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  jobMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seekerNameText: {
    color: "#54685E",
    fontSize: 11.5,
    fontWeight: "600",
  },
  jobDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  jobLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  jobLocationText: {
    color: "#54685E",
    fontSize: 11.5,
    fontWeight: "500",
  },
  metaDot: {
    color: "#8B9E94",
    fontSize: 12,
  },
  jobPayPill: {
    backgroundColor: "#E6F4ED",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  jobPayText: {
    color: "#075B43",
    fontSize: 11.5,
    fontWeight: "700",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFF9EB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 10,
  },
  warningIconWrapper: {
    marginTop: 1,
  },
  warningContent: {
    flex: 1,
    gap: 1,
  },
  warningTitle: {
    color: "#92400E",
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
  },
  warningSubtitle: {
    color: "#B45309",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
  },
  verificationCard: {
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#E1ECE5",
    borderRadius: 12,
    padding: 11,
    gap: 8,
    marginBottom: 10,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkIconBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E2F2E9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  verificationText: {
    flex: 1,
    color: "#3A4D43",
    fontSize: 12,
    lineHeight: 16,
  },
  starsWrapper: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E3ECE6",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  starTouchTarget: {
    padding: 3,
  },
  starDescriptor: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#075B43",
  },
  starDescriptorHint: {
    marginTop: 4,
    fontSize: 11.5,
    color: "#73867C",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2C3D34",
    marginBottom: 5,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F7F5",
    borderWidth: 1,
    borderColor: "#DCE5DF",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagChipSelected: {
    backgroundColor: "#E6F4ED",
    borderColor: "#075B43",
    borderWidth: 1.2,
  },
  tagChipText: {
    color: "#4A5D53",
    fontSize: 11.5,
    fontWeight: "600",
  },
  tagChipTextSelected: {
    color: "#075B43",
    fontWeight: "700",
  },
  inputWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: "#F9FAF9",
    borderWidth: 1,
    borderColor: "#DCE5DF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingBottom: 20,
    fontSize: 12.5,
    color: "#102A2A",
    minHeight: 48,
    textAlignVertical: "top",
  },
  charCount: {
    position: "absolute",
    bottom: 4,
    right: 8,
    fontSize: 10,
    color: "#8B9E94",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  successIconCircle: {
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F2E23",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  successSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    color: "#4A5C53",
    textAlign: "center",
    marginBottom: 12,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E6F4ED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  successBadgeText: {
    color: "#075B43",
    fontSize: 11.5,
    fontWeight: "700",
  },
  successWaitingBadge: { backgroundColor: "#FFF4D6" },
  successWaitingBadgeText: { color: "#8A5A00" },
  footerContainer: {
    flexShrink: 0,
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EDF2EF",
    backgroundColor: "#FFFFFF",
  },
  promptActions: {
    gap: 8,
  },
  primaryConfirmBtn: {
    width: "100%",
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#075B43",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#075B43",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryConfirmBtnPressed: {
    opacity: 0.88,
    backgroundColor: "#054B37",
  },
  rejectCompletionBtn: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8C7C3",
    backgroundColor: "#FFF8F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectCompletionBtnPressed: { backgroundColor: "#FDEDEB" },
  rejectCompletionText: { color: "#A33B32", fontSize: 12.5, fontWeight: "700" },
  primaryConfirmBtnDisabled: {
    opacity: 0.55,
  },
  primaryConfirmText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionsCol: {
    flexDirection: "column",
  },
  reviewJobBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#D2E0D8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    gap: 5,
  },
  reviewJobBtnPressed: {
    backgroundColor: "#F7FAF8",
    borderColor: "#075B43",
  },
  reviewJobText: {
    color: "#075B43",
    fontSize: 12.5,
    fontWeight: "700",
  },
  notNowBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F2",
  },
  notNowBtnPressed: {
    backgroundColor: "#E5ECE8",
  },
  notNowText: {
    color: "#506159",
    fontSize: 12.5,
    fontWeight: "700",
  },
});
