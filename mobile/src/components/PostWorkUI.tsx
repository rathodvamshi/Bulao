import React, { useEffect, useRef, useState } from "react";
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
  Easing,
  ActivityIndicator,
  useWindowDimensions,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { verifyCustomName } from "../utils/nameVerification";
import { usePostWorkStore } from "../features/post-work/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export { JobPostedSuccessModal } from "./JobPostedSuccessModal";
export type { JobPostedDetails, JobPostedSuccessModalProps } from "./JobPostedSuccessModal";

export const POST_WORK_TYPOGRAPHY = {
  screenHeading: 20,
  sectionHeading: 16,
  cardTitle: 14,
  inputLabel: 12,
  inputValue: 15,
  helper: 12,
  button: 15,
} as const;

// Exactly 7 stages with short 1-word labels and matching icons
export const STAGES = [
  { step: 1, label: "Category", icon: "apps-outline", route: "/post-work" },
  { step: 2, label: "Role", icon: "briefcase-outline", route: "/post-work" },
  { step: 3, label: "Title", icon: "document-text-outline", route: "/post-work/details" },
  { step: 4, label: "Location", icon: "location-outline", route: "/post-work/location" },
  { step: 5, label: "Dates", icon: "calendar-outline", route: "/post-work/schedule" },
  { step: 6, label: "Pay", icon: "wallet-outline", route: "/post-work/pay" },
  { step: 7, label: "Review", icon: "checkmark-circle-outline", route: "/post-work/review" },
] as const;

export type StageItem = (typeof STAGES)[number];

// Backward compatibility stub for existing imports
export function transitionPostWorkContent(_direction: "forward" | "back", onNavigate: () => void) {
  onNavigate();
}

/** Legacy wrapper kept for backward compatibility */
export function PostWorkAnimatedContent({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
}) {
  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}

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
              <Ionicons name="warning-outline" size={26} color="#E53E3E" />
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
              <Pressable onPress={onClose} style={styles.modalCloseBtn} hitSlop={8}>
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
                  {verification.errorReason}
                </Text>
              ) : (
                <Text style={styles.validHint}>
                  Verified safe name ({verification.sanitizedName.length}/{maxLength} chars)
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
                <Text style={styles.modalSaveButtonText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ----------------------------------------------------
// REDESIGNED TOP HEADER (COMPACT, STATIONARY, CENTERED TITLE)
// ----------------------------------------------------
export function PostWorkHeader({
  title = "Job Details",
  onExit,
  onBack,
}: {
  title?: string;
  currentStep?: number;
  totalSteps?: number;
  onExit: () => void;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      {/* Left side Exit button - polished rounded pill with horizontal row */}
      <Pressable
        onPress={onExit}
        android_ripple={{ color: "#A7F3D0", borderless: false }}
        style={styles.headerExitBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Exit job posting"
      >
        <View style={styles.headerExitInner}>
          <Ionicons name="close" size={15} color="#03402D" />
          <Text style={styles.headerExitText}>Exit</Text>
        </View>
      </Pressable>

      {/* Center Title - Absolutely centered so it remains exactly in horizontal center */}
      <View style={styles.headerCenterWrap} pointerEvents="none">
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Right side spacer to balance the Exit button */}
      <View style={styles.headerRightSpacer} />
    </View>
  );
}

// ----------------------------------------------------
// SEVEN-STAGE PROGRESS NAVIGATION WITH SEQUENCED CONNECTOR LINE
// ----------------------------------------------------
export function StageProgressIndicator({
  currentStep = 1,
  visualActiveStage,
  lineProgress,
  onStepPress,
  disabled = false,
}: {
  currentStep: number;
  visualActiveStage?: number;
  lineProgress?: Animated.Value;
  onStepPress?: (step: number) => void;
  disabled?: boolean;
}) {
  const isEditing = Boolean(usePostWorkStore((s) => s.editingJobId));
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  // Active visual stage: which icon circle is highlighted with green background & outer ring
  const activeStage = visualActiveStage !== undefined ? visualActiveStage : currentStep;

  // Track container width for mathematically precise icon center connections
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  // Fallback track width based on window width minus horizontal padding (32)
  const effectiveWidth = containerWidth > 0 ? containerWidth : Math.max(width - 32, 280);
  const colWidth = effectiveWidth / 7;
  const iconCenterOffset = colWidth * 0.5;
  const totalLineSpan = colWidth * 6;

  // Fallback animated value if not provided by parent controller
  const fallbackAnim = useRef(new Animated.Value(currentStep)).current;
  const activeLineAnim = lineProgress || fallbackAnim;

  useEffect(() => {
    if (!lineProgress) {
      fallbackAnim.setValue(currentStep);
    }
  }, [currentStep, lineProgress, fallbackAnim]);

  // Width of the animated active green line from icon 0 center to destination icon center
  const activeLineWidth = activeLineAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5, 6, 7],
    outputRange: [
      0,
      colWidth * 1,
      colWidth * 2,
      colWidth * 3,
      colWidth * 4,
      colWidth * 5,
      colWidth * 6,
    ],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.progressContainer}>
      <View
        style={styles.progressTrackWrapper}
        onLayout={handleLayout}
      >
        {/* Background Grey Track Line connecting first and last icon centers */}
        <View
          style={[
            styles.backgroundTrackLine,
            {
              left: iconCenterOffset,
              width: totalLineSpan,
            },
          ]}
        />

        {/* Smooth Animated Green Progress Line growing from first icon center */}
        <Animated.View
          style={[
            styles.activeTrackLine,
            {
              left: iconCenterOffset,
              width: activeLineWidth,
            },
          ]}
        />

        {/* Seven Stage Nodes with labels below */}
        <View style={styles.nodesContainer}>
          {STAGES.map((stage) => {
            const stepNum = stage.step;
            const isCompleted = stepNum < activeStage;
            const isActive = stepNum === activeStage;
            const isUpcoming = stepNum > activeStage;

            return (
              <StageNodeItem
                key={stage.step}
                stage={stage}
                stepNum={stepNum}
                currentStep={currentStep}
                isCompleted={isCompleted}
                isActive={isActive}
                isUpcoming={isUpcoming}
                isCompact={isCompact}
                isEditing={isEditing}
                disabled={disabled}
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
  isUpcoming,
  isCompact,
  isEditing,
  disabled,
  onStepPress,
}: {
  stage: StageItem;
  stepNum: number;
  currentStep: number;
  isCompleted: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompact: boolean;
  isEditing: boolean;
  disabled?: boolean;
  onStepPress?: (step: number) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.96)).current;

  useEffect(() => {
    if (isActive) {
      scaleAnim.setValue(0.88);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive, scaleAnim]);

  // User can tap completed stages or any stage when editing
  const canPress = !disabled && (isEditing || stepNum < currentStep);

  const handlePress = () => {
    if (canPress && onStepPress) {
      onStepPress(stepNum);
    }
  };

  return (
    <Pressable
      disabled={!canPress}
      onPress={handlePress}
      style={styles.stageNodeCol}
      accessibilityRole="button"
      accessibilityLabel={`Stage ${stepNum}: ${stage.label}${
        isActive ? " (Current stage)" : isCompleted ? " (Completed)" : ""
      }`}
    >
      {/* Icon Circle Container */}
      <View style={styles.iconCircleContainer}>
        {/* Subtle Outer Highlight Ring for Active Stage */}
        {isActive && <View style={[styles.activeOuterRing, isCompact && styles.activeOuterRingCompact]} />}

        <Animated.View
          style={[
            styles.stageIconCircle,
            isCompact && styles.stageIconCircleCompact,
            isCompleted && styles.stageCompleted,
            isActive && styles.stageActive,
            isUpcoming && styles.stageUpcoming,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons
            name={stage.icon as keyof typeof Ionicons.glyphMap}
            size={isCompact ? 13 : 15}
            color={isCompleted || isActive ? colors.white : colors.mutedLight}
          />
        </Animated.View>
      </View>

      {/* Stage Label directly below icon */}
      <Text
        style={[
          styles.stageLabelText,
          isCompact && styles.stageLabelTextCompact,
          isActive && styles.stageLabelActive,
          isCompleted && styles.stageLabelCompleted,
          isUpcoming && styles.stageLabelUpcoming,
        ]}
        numberOfLines={1}
      >
        {stage.label}
      </Text>
    </Pressable>
  );
}

// ----------------------------------------------------
// CONTENT SLIDING WINDOW (ONLY THE STAGE CONTENT SLIDES)
// ----------------------------------------------------
export function StageSlider({
  currentStage,
  transitionStage,
  slideDirection,
  slideAnim,
  renderStage,
}: {
  currentStage: number;
  transitionStage: number | null;
  slideDirection: "forward" | "backward";
  slideAnim: Animated.Value;
  renderStage: (stage: number) => React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);

  const effectiveW = viewportWidth > 0 ? viewportWidth : width;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - viewportWidth) > 1) {
      setViewportWidth(w);
    }
  };

  // If idle, render current stage directly
  if (transitionStage === null) {
    return (
      <View style={styles.sliderViewport} onLayout={handleLayout}>
        <View style={styles.sliderPageStatic}>
          {renderStage(currentStage)}
        </View>
      </View>
    );
  }

  // When transitioning, interpolate translateX for leaving and entering stages
  const leavingTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: slideDirection === "forward" ? [0, -effectiveW] : [0, effectiveW],
  });

  const enteringTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: slideDirection === "forward" ? [effectiveW, 0] : [-effectiveW, 0],
  });

  return (
    <View style={styles.sliderViewport} onLayout={handleLayout}>
      {/* Exiting Stage */}
      <Animated.View
        style={[
          styles.sliderPageAbsolute,
          { transform: [{ translateX: leavingTranslateX }] },
        ]}
      >
        {renderStage(currentStage)}
      </Animated.View>

      {/* Entering Destination Stage */}
      <Animated.View
        style={[
          styles.sliderPageAbsolute,
          { transform: [{ translateX: enteringTranslateX }] },
        ]}
      >
        {renderStage(transitionStage)}
      </Animated.View>
    </View>
  );
}

// ----------------------------------------------------
// PERSISTENT BOTTOM NAVIGATION (BACK & NEXT)
// ----------------------------------------------------
export function PostWorkFooter({
  currentStep = 1,
  onBack,
  onNext,
  onExit,
  nextDisabled = false,
  isStage1 = false,
  isFinalStage = false,
  isTransitioning = false,
  nextLabel,
  backLabel,
  loading = false,
}: {
  currentStep?: number;
  onBack?: () => void;
  onNext: () => void;
  onExit?: () => void;
  nextDisabled?: boolean;
  isStage1?: boolean;
  isFinalStage?: boolean;
  isTransitioning?: boolean;
  nextLabel?: string;
  backLabel?: string;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const primaryText = isFinalStage
    ? nextLabel || "Post Work"
    : nextLabel || "Next";

  const isFirstStep = isStage1 || currentStep === 1;

  const handleBackPress = () => {
    if (isTransitioning) return;
    if (isFirstStep && onExit) {
      onExit();
    } else if (onBack) {
      onBack();
    }
  };

  const handleNextPress = () => {
    if (isTransitioning || nextDisabled || loading) return;
    onNext();
  };

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Left Action Button (Exit on Stage 1 / Back on Stages 2-7) - Equal width 50% */}
      <Pressable
        onPress={handleBackPress}
        disabled={isTransitioning}
        android_ripple={{ color: "#E2E8F0", borderless: false }}
        style={styles.footerBtnHalf}
        accessibilityRole="button"
        accessibilityLabel={isFirstStep ? "Exit posting" : "Go back"}
      >
        <View
          style={[
            styles.secondaryButtonInner,
            isTransitioning && styles.footerBtnDisabled,
          ]}
        >
          <Ionicons
            name={isFirstStep ? "close" : "arrow-back"}
            size={18}
            color="#03402D"
          />
          <Text style={styles.secondaryButtonText}>
            {backLabel || (isFirstStep ? "Exit" : "Back")}
          </Text>
        </View>
      </Pressable>

      {/* Right Action Button (Next / Post Work) - Equal width 50% with Dark Green Background */}
      <Pressable
        onPress={handleNextPress}
        disabled={nextDisabled || loading || isTransitioning}
        android_ripple={{ color: "#0D3825", borderless: false }}
        style={styles.footerBtnHalf}
        accessibilityRole="button"
        accessibilityLabel={primaryText}
      >
        <View
          style={[
            styles.primaryButtonInner,
            (nextDisabled || loading || isTransitioning) && styles.primaryButtonInnerDisabled,
          ]}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {primaryText.toLowerCase().includes("update") ? "Updating..." : "Posting..."}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {primaryText}
              </Text>
              <Ionicons
                name={isFinalStage ? "checkmark-circle" : "arrow-forward"}
                size={18}
                color="#FFFFFF"
              />
            </>
          )}
        </View>
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
    backgroundColor: "#03402D",
    paddingVertical: 13,
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
    paddingVertical: 13,
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
    paddingVertical: 13,
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
    backgroundColor: "#03402D",
    paddingVertical: 13,
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

  // --------------------------------------------------
  // TOP HEADER STYLES
  // --------------------------------------------------
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    position: "relative",
    zIndex: 10,
  },
  headerExitBtn: {
    zIndex: 2,
  },
  headerExitInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  headerExitBtnPressed: {
    backgroundColor: "#DCEDE3",
  },
  headerExitText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03402D",
  },
  headerCenterWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  headerRightSpacer: {
    width: 60,
  },

  // --------------------------------------------------
  // SEVEN-STAGE PROGRESS INDICATOR STYLES
  // --------------------------------------------------
  progressContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 9,
  },
  progressTrackWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    height: 52,
    justifyContent: "flex-start",
  },
  backgroundTrackLine: {
    position: "absolute",
    top: 15,
    height: 2.5,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    zIndex: 1,
  },
  activeTrackLine: {
    position: "absolute",
    top: 15,
    height: 2.5,
    backgroundColor: colors.greenDark,
    borderRadius: 2,
    zIndex: 1,
  },
  nodesContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
    zIndex: 2,
  },
  stageNodeCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  iconCircleContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeOuterRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.8,
    borderColor: "#A7F3D0",
    backgroundColor: "transparent",
  },
  activeOuterRingCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  stageIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  stageIconCircleCompact: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
  },
  stageCompleted: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  stageUpcoming: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  stageActive: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark,
    elevation: 2,
    shadowColor: colors.greenDark,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stageLabelText: {
    marginTop: 3,
    fontSize: 8.5,
    fontWeight: "600",
    textAlign: "center",
    color: "#64748B",
    letterSpacing: -0.2,
    lineHeight: 11,
  },
  stageLabelTextCompact: {
    fontSize: 8,
    marginTop: 2,
    letterSpacing: -0.2,
    lineHeight: 10,
  },
  stageLabelActive: {
    fontWeight: "700",
    color: "#03402D",
  },
  stageLabelCompleted: {
    fontWeight: "600",
    color: "#059669",
  },
  stageLabelUpcoming: {
    fontWeight: "500",
    color: "#94A3B8",
  },

  // --------------------------------------------------
  // STAGE SLIDER (CONTENT VIEWPORT)
  // --------------------------------------------------
  sliderViewport: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  sliderPageStatic: {
    flex: 1,
    width: "100%",
  },
  sliderPageAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },

  // --------------------------------------------------
  // BOTTOM FOOTER STYLES (EQUAL 50/50 SCREEN WIDTH SPLIT)
  // --------------------------------------------------
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    zIndex: 20,
    elevation: 4,
  },
  footerBtnHalf: {
    flex: 1,
    minWidth: 0,
  },
  secondaryButtonInner: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#03402D",
  },
  primaryButtonInner: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#03402D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#03402D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonInnerDisabled: {
    backgroundColor: "#03402D",
    opacity: 0.45,
    elevation: 0,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  footerBtnDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  // Summary styles
  summary: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  summaryIcon: {
    fontSize: 22,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  summarySubtext: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
