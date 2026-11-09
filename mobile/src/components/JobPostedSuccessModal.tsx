import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface JobPostedDetails {
  title?: string;
  categoryName?: string;
  roleName?: string;
  payAmount?: string;
  payUnit?: string;
  locality?: string;
  workers?: number;
  startDate?: Date | string;
  hours?: "full" | "custom" | string;
  startTime?: string;
  endTime?: string;
  jobId?: string;
}

export interface JobPostedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onViewJob?: (jobId?: string) => void;
  onGoHome?: () => void;
  jobDetails?: JobPostedDetails;
  isEditing?: boolean;
}

export function JobPostedSuccessModal({
  visible,
  onClose,
  onViewJob,
  jobDetails,
  isEditing = false,
}: JobPostedSuccessModalProps) {
  // Animation References
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.85)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // Icon and burst animations
  const iconScale = useRef(new Animated.Value(0.2)).current;
  const ripple1Scale = useRef(new Animated.Value(0.7)).current;
  const ripple1Opacity = useRef(new Animated.Value(0.8)).current;
  const ripple2Scale = useRef(new Animated.Value(0.7)).current;
  const ripple2Opacity = useRef(new Animated.Value(0.5)).current;

  // Sparkles animations
  const sparklesScale = useRef(new Animated.Value(0.3)).current;
  const sparklesOpacity = useRef(new Animated.Value(0)).current;
  const sparklesRotate = useRef(new Animated.Value(0)).current;

  // Live status pulse & 2-second Progress Bar
  const dotPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Handle instant or automated navigation
  const hasTriggeredNav = useRef(false);

  const triggerNavigation = () => {
    if (hasTriggeredNav.current) return;
    hasTriggeredNav.current = true;
    if (onViewJob) {
      onViewJob(jobDetails?.jobId);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (visible) {
      hasTriggeredNav.current = false;

      // Reset animation values
      backdropOpacity.setValue(0);
      modalScale.setValue(0.85);
      modalOpacity.setValue(0);
      iconScale.setValue(0.2);
      ripple1Scale.setValue(0.7);
      ripple1Opacity.setValue(0.8);
      ripple2Scale.setValue(0.7);
      ripple2Opacity.setValue(0.5);
      sparklesScale.setValue(0.3);
      sparklesOpacity.setValue(0);
      sparklesRotate.setValue(0);
      progressAnim.setValue(0);

      // 1. Entrance backdrop & modal pop
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Icon burst sequence
      Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1,
            friction: 4,
            tension: 75,
            useNativeDriver: true,
          }),
          // Ripple 1 Expanding
          Animated.parallel([
            Animated.timing(ripple1Scale, {
              toValue: 1.35,
              duration: 1200,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ripple1Opacity, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
          // Ripple 2 Expanding
          Animated.sequence([
            Animated.delay(120),
            Animated.parallel([
              Animated.timing(ripple2Scale, {
                toValue: 1.6,
                duration: 1400,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(ripple2Opacity, {
                toValue: 0,
                duration: 1400,
                useNativeDriver: true,
              }),
            ]),
          ]),
          // Sparkles burst & spin
          Animated.sequence([
            Animated.delay(100),
            Animated.parallel([
              Animated.timing(sparklesOpacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }),
              Animated.spring(sparklesScale, {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
              }),
              Animated.timing(sparklesRotate, {
                toValue: 1,
                duration: 1200,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]).start();

      // 3. Status dot continuous pulse
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotPulse, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // 4. Smooth 2-second progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      // 5. Automated move to job application page after exactly 2 seconds
      const timer = setTimeout(() => {
        triggerNavigation();
      }, 2000);

      return () => {
        clearTimeout(timer);
        pulseLoop.stop();
      };
    }
  }, [visible]);

  if (!visible) return null;

  const spinInterpolation = sparklesRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "40deg"],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={triggerNavigation}
    >
      {/* Dark luxury backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={triggerNavigation} />
      </Animated.View>

      {/* Centered Minimal Animated Modal (Pure Celebration, No Clutter Details) */}
      <View style={styles.centerWrapper} pointerEvents="box-none">
        <Pressable onPress={triggerNavigation}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalOpacity,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            {/* ── Festive Sparkles Burst ── */}
            <Animated.View
              style={[
                styles.sparkleContainer,
                {
                  opacity: sparklesOpacity,
                  transform: [
                    { scale: sparklesScale },
                    { rotate: spinInterpolation },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={[styles.sparkleStar, styles.starTopRight]}>✦</Text>
              <Text style={[styles.sparkleStar, styles.starTopLeft]}>✧</Text>
              <Text style={[styles.sparkleStar, styles.starBottomLeft]}>★</Text>
              <Text style={[styles.sparkleStar, styles.starBottomRight]}>✦</Text>
              <Text style={[styles.sparkleStar, styles.starFarRight]}>⋆</Text>
              <Text style={[styles.sparkleStar, styles.starFarLeft]}>⋆</Text>
            </Animated.View>

            {/* ── Concentric Ripple Rings & Checkmark ── */}
            <View style={styles.iconWrapper}>
              {/* Ripple Ring 2 */}
              <Animated.View
                style={[
                  styles.rippleRing2,
                  {
                    transform: [{ scale: ripple2Scale }],
                    opacity: ripple2Opacity,
                  },
                ]}
              />

              {/* Ripple Ring 1 */}
              <Animated.View
                style={[
                  styles.rippleRing1,
                  {
                    transform: [{ scale: ripple1Scale }],
                    opacity: ripple1Opacity,
                  },
                ]}
              />

              {/* Central Emerald Badge */}
              <Animated.View
                style={[
                  styles.checkmarkCircle,
                  {
                    transform: [{ scale: iconScale }],
                  },
                ]}
              >
                <Ionicons name="checkmark-sharp" size={44} color="#FFFFFF" />
              </Animated.View>
            </View>

            {/* ── Heading ── */}
            <Text style={styles.heading}>
              {isEditing ? "Updated Successfully!" : "Posted Successfully!"}
            </Text>

            {/* ── Subtitle ── */}
            <Text style={styles.subtitle}>
              Your job request is now live on the network
            </Text>

            {/* ── Live Broadcasting Badge ── */}
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: dotPulse }]} />
              <Text style={styles.liveBadgeText}>
                {isEditing ? "SAVED & BROADCASTING" : "BROADCASTING TO WORKERS"}
              </Text>
            </View>

            {/* ── 2-Second Smooth Progress Bar (Auto-Move Indicator) ── */}
            <View style={styles.redirectSection}>
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[styles.progressBarFill, { width: progressWidth }]}
                />
              </View>
              <View style={styles.redirectRow}>
                <Text style={styles.redirectText}>
                  Opening job application...
                </Text>
                <Ionicons name="arrow-forward" size={13} color="#03402D" />
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3, 24, 16, 0.72)",
  },
  centerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },

  /* Sparkles Overlay */
  sparkleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleStar: {
    position: "absolute",
    fontWeight: "900",
  },
  starTopRight: {
    top: 26,
    right: 56,
    fontSize: 22,
    color: "#F59E0B",
  },
  starTopLeft: {
    top: 36,
    left: 54,
    fontSize: 18,
    color: "#10B981",
  },
  starBottomLeft: {
    top: 110,
    left: 48,
    fontSize: 14,
    color: "#F59E0B",
  },
  starBottomRight: {
    top: 104,
    right: 52,
    fontSize: 20,
    color: "#03402D",
  },
  starFarRight: {
    top: 66,
    right: 32,
    fontSize: 15,
    color: "#10B981",
  },
  starFarLeft: {
    top: 72,
    left: 34,
    fontSize: 16,
    color: "#D97706",
  },

  /* Central Ripples & Icon */
  iconWrapper: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 16,
  },
  rippleRing2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#A7F3D0",
  },
  rippleRing1: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#6EE7B7",
  },
  checkmarkCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#03402D",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#03402D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3.5,
    borderColor: "#FFFFFF",
  },

  /* Typography */
  heading: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 8,
  },

  /* Status Badge */
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  liveBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 0.6,
  },

  /* 2-Second Progress Bar Section */
  redirectSection: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  progressBarTrack: {
    width: "100%",
    height: 4.5,
    borderRadius: 3,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#03402D",
  },
  redirectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  redirectText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
  },
});
