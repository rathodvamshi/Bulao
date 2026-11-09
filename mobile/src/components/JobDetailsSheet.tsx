import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import type { Job } from "../api/types";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85; // Taller sheet for full details

interface JobDetailsSheetProps {
  job: Job | null;
  onClose: () => void;
}

export function JobDetailsSheet({ job, onClose }: JobDetailsSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(!!job);
  const [displayJob, setDisplayJob] = useState(job);
  const mountedRef = useRef(!!job);
  const closing = useRef(false);

  const animateOut = useCallback((onComplete?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      mountedRef.current = false;
      setMounted(false);
      setDisplayJob(null);
      closing.current = false;
      onComplete?.();
    });
  }, [backdropOpacity, translateY]);

  useEffect(() => {
    if (job) {
      closing.current = false;
      mountedRef.current = true;
      setDisplayJob(job);
      setMounted(true);
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        mass: 0.85,
        stiffness: 220,
      }).start();
    } else if (mountedRef.current) {
      animateOut();
    }
  }, [job, translateY, backdropOpacity, animateOut]);

  const handleDismiss = () => {
    animateOut(onClose);
  };

  if (!mounted || !displayJob) return null;
  const visibleJob = displayJob;

  const payInRupees = visibleJob.payPaise / 100;
  const payDisplay = `₹${payInRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })} / ${visibleJob.payUnit.toLowerCase()}`;
  const startDate = new Date(visibleJob.startsAt * 1000);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const timeString = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateDisplay = isToday
    ? `Today at ${timeString}`
    : startDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const approximateDistance = visibleJob.distanceKm === undefined
    ? ""
    : visibleJob.distanceKm < 1
      ? "Under 1 km away"
      : `${Math.floor(visibleJob.distanceKm)}–${Math.floor(visibleJob.distanceKm) + 1} km away`;

  return (
    <Modal transparent visible={mounted} onRequestClose={handleDismiss} animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{visibleJob.title}</Text>
            <View style={styles.payBadge}>
              <Text style={styles.payText}>{payDisplay}</Text>
            </View>
          </View>

          <View style={styles.ownerRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={colors.green} />
            </View>
            <View>
              <Text style={styles.ownerName}>{visibleJob.ownerName}</Text>
              <Text style={styles.ownerSub}>Posted this job</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={colors.ink} />
              <View>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>
                  {visibleJob.area} {approximateDistance ? `· ${approximateDistance}` : ""}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.ink} />
              <View>
                <Text style={styles.infoLabel}>Starts At</Text>
                <Text style={styles.infoValue}>{dateDisplay}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={20} color={colors.ink} />
              <View>
                <Text style={styles.infoLabel}>Workers Needed</Text>
                <Text style={styles.infoValue}>{visibleJob.workers} people</Text>
              </View>
            </View>
          </View>

          {visibleJob.details ? (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{visibleJob.details}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.applyButton, { opacity: pressed ? 0.8 : 1 }]}>
            <Text style={styles.applyButtonText}>Apply Now</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for the fixed footer
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    paddingRight: 16,
  },
  payBadge: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.green,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAF5",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  ownerSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.ink,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    backgroundColor: colors.paper,
    padding: 16,
    borderRadius: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  applyButton: {
    backgroundColor: colors.green,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
