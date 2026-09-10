import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { verifyCustomName } from "../utils/nameVerification";

export const STAGES = [
  { step: 1, label: "Category", icon: "apps-outline", route: "/post-work" },
  { step: 2, label: "Role", icon: "person-outline", route: "/post-work" },
  { step: 3, label: "Details", icon: "document-text-outline", route: "/post-work/details" },
  { step: 4, label: "Location", icon: "location-outline", route: "/post-work/location" },
  { step: 5, label: "Schedule", icon: "calendar-outline", route: "/post-work/schedule" },
  { step: 6, label: "Pay", icon: "wallet-outline", route: "/post-work/pay" },
  { step: 7, label: "Review", icon: "checkmark-circle-outline", route: "/post-work/review" },
] as const;

// ----------------------------------------------------
// EXIT CONFIRMATION MODAL
// ----------------------------------------------------
export function ExitModal({
  visible,
  onClose,
  onExit,
}: {
  visible: boolean;
  onClose: () => void;
  onExit: () => void;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning-outline" size={28} color="#E53E3E" />
            </View>
            <Text style={styles.modalTitle}>Exit posting?</Text>
          </View>
          <Text style={styles.modalMessage}>
            Are you sure you want to exit? Your current job posting will be cancelled and your entered information may not be saved.
          </Text>

          <View style={styles.modalActions}>
            <Pressable style={styles.continueButton} onPress={onClose}>
              <Text style={styles.continueButtonText}>Continue Posting</Text>
            </Pressable>
            <Pressable style={styles.exitConfirmButton} onPress={onExit}>
              <Text style={styles.exitConfirmButtonText}>Exit</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ----------------------------------------------------
// CUSTOM CATEGORY / ROLE NAME INPUT POPUP MODAL
// ----------------------------------------------------
export function CustomNameModal({
  visible,
  title,
  subtitle,
  placeholder,
  value,
  minLength = 3,
  maxLength = 40,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  minLength?: number;
  maxLength?: number;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = React.useState(value);

  React.useEffect(() => {
    setText(value);
  }, [value, visible]);

  const verification = verifyCustomName(text);

  const handleDone = () => {
    if (verification.isValid) {
      onSave(verification.sanitizedName);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalKeyboardAvoiding}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable
            style={[styles.modalCard, styles.customModalCard]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.customModalIconContainer}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.green} />
              </View>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.modalMessage}>{subtitle}</Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={colors.mutedLight}
              maxLength={maxLength}
              style={[
                styles.modalInput,
                text.trim().length > 0 && !verification.isValid && styles.modalInputError,
                verification.isValid && styles.modalInputSuccess,
              ]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleDone}
            />

            <View style={styles.hintRow}>
              {text.trim().length === 0 ? (
                <Text style={styles.mandatoryHint}>
                  * Minimum {minLength} letters required (e.g. Pet Care, Gardening)
                </Text>
              ) : !verification.isValid ? (
                <Text style={styles.mandatoryHint}>
                  ⚠️ {verification.errorReason}
                </Text>
              ) : (
                <Text style={styles.validHint}>
                  ✓ Verified safe name ({verification.sanitizedName.length}/{maxLength} chars)
                </Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={onClose}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!verification.isValid}
                style={[
                  styles.modalSaveButton,
                  !verification.isValid && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleDone}
              >
                <Text style={styles.modalSaveButtonText}>Done ✓</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ----------------------------------------------------
// TOP NAVIGATION HEADER (WITH "← Exit")
// ----------------------------------------------------
export function PostWorkHeader({
  title = "Post Job",
  currentStep = 1,
  totalSteps = 7,
  onExit,
}: {
  title?: string;
  currentStep?: number;
  totalSteps?: number;
  onExit: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onExit}
        style={styles.exitNavButton}
        accessibilityRole="button"
        accessibilityLabel="Exit post job flow"
      >
        <Text style={styles.exitArrow}>←</Text>
        <Text style={styles.exitNavText}>Exit</Text>
      </Pressable>

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>
          {currentStep}/{totalSteps}
        </Text>
      </View>
    </View>
  );
}

// ----------------------------------------------------
// CONNECTED STAGE PROGRESS INDICATOR WITH SMOOTH ANIMATED LINE & TICK POP
// ----------------------------------------------------
export function StageProgressIndicator({
  currentStep = 1,
  onStepPress,
}: {
  currentStep: number;
  onStepPress?: (step: number) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  // Smooth progress track animation with easing
  const progressAnim = useRef(new Animated.Value(currentStep)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep,
      duration: 600,
      easing: (t: number) => {
        // Custom smooth easing - ease-in-out cubic
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      },
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  // Width of the smooth active green progress line
  const fillWidth = progressAnim.interpolate({
    inputRange: [1, STAGES.length],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrackWrapper}>
        {/* Background Grey Track Line */}
        <View style={styles.backgroundTrackLine} />

        {/* Smooth Animated Green Progress Line */}
        <Animated.View
          style={[
            styles.activeTrackLine,
            {
              width: fillWidth,
            },
          ]}
        />

        {/* Stage Nodes */}
        <View style={styles.nodesContainer}>
          {STAGES.map((stage) => {
            const stepNum = stage.step;
            const isCompleted = stepNum < currentStep;
            const isActive = stepNum === currentStep;

            return (
              <StageNodeItem
                key={stage.step}
                stage={stage}
                stepNum={stepNum}
                currentStep={currentStep}
                isCompleted={isCompleted}
                isActive={isActive}
                isCompact={isCompact}
                onStepPress={onStepPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function StageNodeItem({
  stage,
  stepNum,
  currentStep,
  isCompleted,
  isActive,
  isCompact,
  onStepPress,
}: {
  stage: (typeof STAGES)[number];
  stepNum: number;
  currentStep: number;
  isCompleted: boolean;
  isActive: boolean;
  isCompact: boolean;
  onStepPress?: (step: number) => void;
}) {
  // Smooth spring scale entrance animation for tick mark with better flow
  const scaleAnim = useRef(new Animated.Value(isCompleted || isActive ? 1 : 0.7)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isCompleted || isActive) {
      // Smooth pop-in animation with rotation for checkmark
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      scaleAnim.setValue(0.7);
      rotateAnim.setValue(0);
    }
  }, [isCompleted, isActive]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable
      disabled={stepNum > currentStep}
      onPress={() => onStepPress && onStepPress(stepNum)}
      style={styles.stageNodePressable}
      accessibilityRole="button"
      accessibilityLabel={`Stage ${stepNum}: ${stage.label}`}
    >
      <Animated.View
        style={[
          styles.stageIconCircle,
          isCompact && styles.stageIconCircleCompact,
          isCompleted && styles.stageCompleted,
          isActive && styles.stageActive,
          { 
            transform: [
              { scale: scaleAnim },
              ...(isCompleted ? [{ rotate: rotation }] : [])
            ] 
          },
        ]}
      >
        {isCompleted ? (
          <Text style={styles.checkmarkIcon}>✓</Text>
        ) : (
          <Ionicons
            name={stage.icon as keyof typeof Ionicons.glyphMap}
            size={isCompact ? 13 : 15}
            color={
              isActive
                ? colors.white
                : isCompleted
                ? colors.white
                : colors.muted
            }
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ----------------------------------------------------
// BOTTOM NAVIGATION BUTTONS
// ----------------------------------------------------
export function PostWorkFooter({
  onBack,
  onNext,
  onExit,
  nextDisabled = false,
  isStage1 = false,
  isFinalStage = false,
  nextLabel,
  backLabel,
  loading = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  onExit?: () => void;
  nextDisabled?: boolean;
  isStage1?: boolean;
  isFinalStage?: boolean;
  nextLabel?: string;
  backLabel?: string;
  loading?: boolean;
}) {
  const primaryText = isFinalStage
    ? nextLabel || "Post"
    : nextLabel || "Next";

  return (
    <View style={styles.footer}>
      {/* Left Action Button */}
      {isStage1 ? (
        <Pressable
          onPress={onExit || onBack}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Exit posting"
        >
          <Text style={styles.secondaryButtonText}>{backLabel || "Exit"}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onBack || (() => router.back())}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.secondaryButtonText}>
            ← {backLabel || "Back"}
          </Text>
        </Pressable>
      )}

      {/* Right Action Button */}
      <Pressable
        onPress={onNext}
        disabled={nextDisabled || loading}
        style={[
          styles.primaryButton,
          isFinalStage && styles.postPrimaryButton,
          (nextDisabled || loading) && styles.primaryButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={primaryText}
      >
        <Text
          style={[
            styles.primaryButtonText,
            nextDisabled && styles.primaryButtonTextDisabled,
          ]}
        >
          {loading ? "Posting..." : primaryText}
        </Text>
        {!isFinalStage && !loading && (
          <Ionicons
            name="arrow-forward"
            size={18}
            color={nextDisabled ? colors.muted : colors.white}
          />
        )}
      </Pressable>
    </View>
  );
}

export function PostWorkSummary({
  icon,
  text,
  subtext,
}: {
  icon: string;
  text: string;
  subtext?: string;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryText}>{text}</Text>
        {subtext && <Text style={styles.summarySubtext}>{subtext}</Text>}
      </View>
    </View>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------
const styles = StyleSheet.create({
  modalKeyboardAvoiding: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    gap: 14,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  customModalCard: {
    borderWidth: 2,
    borderColor: colors.green,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  customModalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    flex: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: colors.paper,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  modalInput: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  modalInputError: {
    borderColor: "#E53E3E",
    backgroundColor: "#FFF5F5",
  },
  modalInputSuccess: {
    borderColor: colors.green,
    backgroundColor: "#F0FDF4",
  },
  hintRow: {
    marginTop: -4,
  },
  mandatoryHint: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E53E3E",
  },
  validHint: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  continueButton: {
    flex: 1,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  exitConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FED7D7",
    alignItems: "center",
    justifyContent: "center",
  },
  exitConfirmButtonText: {
    color: "#E53E3E",
    fontWeight: "700",
    fontSize: 15,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  modalSaveButtonDisabled: {
    backgroundColor: colors.line,
    elevation: 0,
  },
  modalSaveButtonText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  exitNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.paper,
  },
  exitArrow: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.green,
  },
  exitNavText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.green,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  stepBadge: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
  },

  // Progress indicator styles (Smooth Line & Animated Nodes)
  progressContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  progressTrackWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    height: 32,
    justifyContent: "center",
  },
  backgroundTrackLine: {
    position: "absolute",
    left: 15,
    right: 15,
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 2,
  },
  activeTrackLine: {
    position: "absolute",
    left: 15,
    height: 3,
    backgroundColor: colors.green,
    borderRadius: 2,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  nodesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  stageNodePressable: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stageIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stageIconCircleCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stageCompleted: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  stageActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    elevation: 4,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  checkmarkIcon: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13,
  },

  // Footer styles
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 12,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.green,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    elevation: 2,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  postPrimaryButton: {
    backgroundColor: "#166534",
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.line,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.white,
  },
  primaryButtonTextDisabled: {
    color: colors.muted,
  },

  // Summary styles
  summary: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.white,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.green,
    alignItems: "center",
  },
  summaryIcon: { fontSize: 28 },
  summaryText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  summarySubtext: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },
});
