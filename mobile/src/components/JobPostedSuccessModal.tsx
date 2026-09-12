import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  ScrollView,
  useWindowDimensions,
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
}

export function JobPostedSuccessModal({
  visible,
  onClose,
  onViewJob,
  onGoHome,
  jobDetails,
}: JobPostedSuccessModalProps) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const outerRingScale = useRef(new Animated.Value(0.8)).current;
  const sparklesOpacity = useRef(new Animated.Value(0)).current;
  const sparklesScale = useRef(new Animated.Value(0.5)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset values
      backdropOpacity.setValue(0);
      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
      iconScale.setValue(0.6);
      outerRingScale.setValue(0.8);
      sparklesOpacity.setValue(0);
      sparklesScale.setValue(0.5);

      // Entrance animation sequence
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.spring(iconScale, {
              toValue: 1,
              friction: 5,
              tension: 80,
              useNativeDriver: true,
            }),
            Animated.spring(outerRingScale, {
              toValue: 1,
              friction: 6,
              tension: 60,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(250),
          Animated.parallel([
            Animated.timing(sparklesOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.spring(sparklesScale, {
              toValue: 1,
              friction: 5,
              tension: 90,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();

      // Pulsing green dot animation loop
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, {
            toValue: 0.35,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dotPulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    }
  }, [visible]);

  if (!visible) return null;

  // Format Helper Data
  const title = jobDetails?.title || jobDetails?.roleName || "Plumber";
  const category = jobDetails?.categoryName || "Construction";
  const role = jobDetails?.roleName || "Plumber";
  const subtitleText = `${category} • ${role}`;

  const payAmount = jobDetails?.payAmount ? `₹${jobDetails.payAmount}` : "₹500";
  const payUnit = jobDetails?.payUnit ? `/${jobDetails.payUnit}` : "/day";
  const priceDisplay = `${payAmount}${payUnit}`;

  const locality = jobDetails?.locality || "Hyderabad";
  const workersCount = jobDetails?.workers || 2;
  const workersDisplay = `${workersCount} ${workersCount === 1 ? "Person" : "People"}`;

  let scheduleDisplay = "11 Sep 2026";
  if (jobDetails?.startDate) {
    const d = typeof jobDetails.startDate === "string"
      ? new Date(jobDetails.startDate)
      : jobDetails.startDate;
    if (!isNaN(d.getTime())) {
      scheduleDisplay = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }

  let timingDisplay = "Full Day";
  if (jobDetails?.hours === "custom" && jobDetails?.startTime && jobDetails?.endTime) {
    timingDisplay = `${jobDetails.startTime} - ${jobDetails.endTime}`;
  }

  const isSmallScreen = screenHeight < 680;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dark Blurred Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Modal Container */}
      <View style={styles.centerWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
              maxHeight: screenHeight * 0.88,
            },
          ]}
        >
          {/* Close Button (X) */}
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close confirmation"
          >
            <Ionicons name="close" size={22} color="#4B5563" />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* ── Success Animation Area ── */}
            <View style={styles.iconSection}>
              {/* Decorative Sparkles */}
              <Animated.View
                style={[
                  styles.sparkleWrapper,
                  {
                    opacity: sparklesOpacity,
                    transform: [{ scale: sparklesScale }],
                  },
                ]}
                pointerEvents="none"
              >
                {/* Top Right Sparkle */}
                <Text style={[styles.sparkleText, styles.sparkleTopRight]}>✦</Text>
                {/* Top Left Sparkle */}
                <Text style={[styles.sparkleText, styles.sparkleTopLeft]}>✦</Text>
                {/* Bottom Left Sparkle */}
                <Text style={[styles.sparkleText, styles.sparkleBottomLeft]}>✦</Text>
                {/* Bottom Right Sparkle */}
                <Text style={[styles.sparkleText, styles.sparkleBottomRight]}>✦</Text>
              </Animated.View>

              {/* Glowing Outer Rings */}
              <Animated.View
                style={[
                  styles.outerRing2,
                  { transform: [{ scale: outerRingScale }] },
                ]}
              >
                <View style={styles.outerRing1}>
                  {/* Main Green Success Circle */}
                  <Animated.View
                    style={[
                      styles.successCircle,
                      { transform: [{ scale: iconScale }] },
                    ]}
                  >
                    <Ionicons name="checkmark" size={42} color="#FFFFFF" />
                  </Animated.View>
                </View>
              </Animated.View>
            </View>

            {/* ── Main Heading ── */}
            <Text style={styles.heading} adjustsFontSizeToFit numberOfLines={1}>
              Job Posted Successfully!
            </Text>

            {/* ── Live Matching Status Badge ── */}
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: dotPulse }]} />
              <Text style={styles.liveBadgeText}>LIVE & MATCHING WORKERS</Text>
            </View>

            {/* ── Job Summary Card ── */}
            <View style={styles.summaryCard}>
              {/* Header inside summary card */}
              <View style={styles.cardHeader}>
                <View style={styles.briefcaseContainer}>
                  <Ionicons name="briefcase-outline" size={22} color="#1F2937" />
                </View>

                <View style={styles.titleColumn}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.jobSubtitle} numberOfLines={1}>
                    {subtitleText}
                  </Text>
                </View>

                {/* Price Badge */}
                <View style={styles.priceBadge}>
                  <Text style={styles.priceBadgeText}>{priceDisplay}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 2-Column x 2-Row Details Grid */}
              <View style={styles.gridContainer}>
                {/* Row 1 */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>Location</Text>
                    <Text style={styles.gridValue} numberOfLines={1}>
                      {locality}
                    </Text>
                  </View>

                  <View style={styles.gridVerticalDivider} />

                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>Workers</Text>
                    <Text style={styles.gridValue} numberOfLines={1}>
                      {workersDisplay}
                    </Text>
                  </View>
                </View>

                <View style={styles.gridHorizontalDivider} />

                {/* Row 2 */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>Schedule</Text>
                    <Text style={styles.gridValue} numberOfLines={1}>
                      {scheduleDisplay}
                    </Text>
                  </View>

                  <View style={styles.gridVerticalDivider} />

                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>Timing</Text>
                    <Text style={styles.gridValue} numberOfLines={1}>
                      {timingDisplay}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Broadcasting Status Pill */}
              <View style={styles.broadcastPill}>
                <Text style={styles.broadcastPillText} numberOfLines={1}>
                  📣  Broadcasting to workers in {locality}
                </Text>
              </View>
            </View>

            <View style={styles.bottomDivider} />

            {/* ── Action Buttons ── */}
            <View style={styles.actionRow}>
              {/* Home Button (Secondary) */}
              <Pressable
                onPress={onGoHome || onClose}
                style={({ pressed }) => [
                  styles.homeButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go to Home"
              >
                <Ionicons name="home" size={18} color="#18B978" />
                <Text style={styles.homeButtonText}>Home</Text>
              </Pressable>

              {/* View Job Button (Primary) */}
              <Pressable
                onPress={() => (onViewJob ? onViewJob(jobDetails?.jobId) : onClose())}
                style={({ pressed }) => [
                  styles.viewJobButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="View Job details"
              >
                <Ionicons name="document-text" size={18} color="#FFFFFF" />
                <Text style={styles.viewJobButtonText}>View Job</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 18, 14, 0.68)",
  },
  centerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    position: "relative",
    // Premium soft elevation & shadow
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },

  /* Success Icon & Outer Rings */
  iconSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    position: "relative",
    width: 140,
    height: 140,
  },
  sparkleWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  sparkleText: {
    position: "absolute",
    color: "#18B978",
    fontWeight: "900",
  },
  sparkleTopRight: {
    top: 6,
    right: 18,
    fontSize: 16,
  },
  sparkleTopLeft: {
    top: 22,
    left: 14,
    fontSize: 12,
  },
  sparkleBottomLeft: {
    bottom: 12,
    left: 20,
    fontSize: 15,
  },
  sparkleBottomRight: {
    bottom: 24,
    right: 12,
    fontSize: 11,
  },
  outerRing2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(221, 245, 233, 0.35)",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing1: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: "rgba(221, 245, 233, 0.65)",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#18B978",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#18B978",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  /* Main Heading */
  heading: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F1F14",
    textAlign: "center",
    letterSpacing: -0.4,
    marginTop: 6,
    marginBottom: 8,
    width: "100%",
  },

  /* Live Matching Status Badge */
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#DDF5E9",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#18B978",
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },

  /* Job Summary Card */
  summaryCard: {
    width: "100%",
    backgroundColor: "#F1F3F5",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  briefcaseContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  titleColumn: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F1F14",
    letterSpacing: -0.3,
  },
  jobSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 1,
  },
  priceBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  priceBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F1F14",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  /* 2x2 Grid */
  gridContainer: {
    gap: 10,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F1F14",
  },
  gridVerticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E7EB",
  },
  gridHorizontalDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    width: "100%",
  },

  /* Broadcasting Pill */
  broadcastPill: {
    backgroundColor: "#DDF5E9",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  broadcastPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },

  bottomDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    width: "100%",
    marginBottom: 14,
  },

  /* Action Buttons */
  actionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  homeButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#18B978",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  homeButtonText: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#18B978",
  },
  viewJobButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#18B978",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewJobButtonText: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
