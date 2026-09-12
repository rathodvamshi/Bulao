import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuth } from "../auth";
import { jobApi } from "../api/jobApi";
import { ApiClientError } from "../api/apiClient";
import { applicationLabel } from "../features/jobs/filters";
import type { Job } from "../api/types";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85; // Taller sheet for full details

interface JobDetailsSheetProps {
  job: Job | null;
  onClose: () => void;
  onJobUpdated: (job: Job) => void;
}

export function JobDetailsSheet(props: JobDetailsSheetProps) {
  const { session, user } = useAuth();
  if (!props.job) return null;
  return <JobDetailsContent key={`${props.job.id}:${session?.token ?? "guest"}`} initialJob={props.job}
    token={session?.token} userId={user?.id} onClose={props.onClose} onJobUpdated={props.onJobUpdated} />;
}

function JobDetailsContent({ initialJob, token, userId, onClose, onJobUpdated }: {
  initialJob: Job; token?: string; userId?: string; onClose: () => void; onJobUpdated: (job: Job) => void;
}) {
  const client = useQueryClient();
  const queryKey = ["job-details", initialJob.id, token];
  const detail = useQuery({ queryKey, queryFn: () => jobApi.getJob(initialJob.id, token), staleTime: 0, refetchOnMount: "always" });
  useEffect(() => {
    if (detail.data) onJobUpdated({ ...initialJob, ...detail.data });
  }, [detail.data]);
  const job = detail.data ? { ...initialJob, ...detail.data } : initialJob;
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const [clock, setClock] = useState(Date.now() / 1000);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setClock(Date.now() / 1000), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const label = applicationLabel(job, userId, clock);
  const disabled = applying || detail.isFetching || detail.isError || !detail.data || label !== "Apply";
  async function apply() {
    if (disabled || busy.current) return;
    if (!token) { onClose(); router.push("/auth"); return; }
    busy.current = true;
    setApplying(true); setError("");
    try {
      await jobApi.apply(job.id, token);
      if (!mounted.current) return;
      const updated = { ...job, hasApplied: true };
      client.setQueryData(queryKey, updated);
      onJobUpdated(updated);
      void client.invalidateQueries({ queryKey: ["activity"] });
      void client.invalidateQueries({ queryKey: ["nearby"] });
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof ApiClientError && failure.code === "APPLICATION_EXISTS") {
        const updated = { ...job, hasApplied: true };
        client.setQueryData(queryKey, updated); onJobUpdated(updated);
      } else {
        setError(failure instanceof Error ? failure.message : "Could not apply. Please try again.");
        // Re-read availability after a conflict, or after an uncertain network outcome.
        const refreshed = await detail.refetch();
        if (mounted.current && refreshed.data) onJobUpdated({ ...initialJob, ...refreshed.data });
      }
    } finally {
      busy.current = false;
      if (mounted.current) setApplying(false);
    }
  }
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (job) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [initialJob.id, translateY]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!job) return null;

  const payInRupees = job.payPaise / 100;
  const payDisplay = `â‚¹${payInRupees} / ${job.payUnit.toLowerCase()}`;
  const startDate = new Date(job.startsAt * 1000);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const timeString = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateDisplay = isToday
    ? `Today at ${timeString}`
    : startDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Modal transparent visible={!!job} onRequestClose={handleDismiss} animationType="none">
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {detail.isPending ? <ActivityIndicator accessibilityLabel="Loading job details" color={colors.green} /> : detail.isError ? (
            <View><Text accessibilityRole="alert">Could not load current job details.</Text>
              <Pressable accessibilityRole="button" onPress={() => void detail.refetch()}><Text>Retry</Text></Pressable>
            </View>
          ) : <>

          <View style={styles.header}>
            <Text style={styles.title}>{job.title}</Text>
            <View style={styles.payBadge}>
              <Text style={styles.payText}>{payDisplay}</Text>
            </View>
          </View>

          <View style={styles.ownerRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={colors.green} />
            </View>
            <View>
              <Text style={styles.ownerName}>{job.ownerName}</Text>
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
                  {job.area} {job.distanceKm !== undefined ? `(${job.distanceKm} km away)` : ""}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.ink} />
              <View>
                <Text style={styles.infoLabel}>Starts At</Text>
                <Text style={styles.infoValue}>{dateDisplay}</Text>
              </View>
            </View>

            {job.hours && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={colors.ink} />
                <View>
                  <Text style={styles.infoLabel}>Working Hours</Text>
                  <Text style={styles.infoValue}>
                    {job.hours === 'full' ? 'Full Day' : job.hours === 'part' ? 'Part Time' : job.startTime + ' - ' + job.endTime}
                  </Text>
                </View>
              </View>
            )}

            {job.duration && (
              <View style={styles.infoRow}>
                <Ionicons name="hourglass-outline" size={20} color={colors.ink} />
                <View>
                  <Text style={styles.infoLabel}>Duration</Text>
                  <Text style={styles.infoValue}>
                    {job.duration === 'one' ? 'One Day' : job.duration === 'few' ? (job.endsAt ? 'Until ' + new Date(job.endsAt * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Few Days') : 'Ongoing'}
                  </Text>
                </View>
              </View>
            )}

            {job.paidWhen && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={20} color={colors.ink} />
                <View>
                  <Text style={styles.infoLabel}>Paid When</Text>
                  <Text style={styles.infoValue}>
                    {job.paidWhen === 'after' ? 'After work completes' : job.paidWhen === 'daily' ? 'Daily' : 'Weekly'}
                  </Text>
                </View>
              </View>
            )}
            
            {job.experience && job.experience !== 'any' && (
              <View style={styles.infoRow}>
                <Ionicons name="briefcase-outline" size={20} color={colors.ink} />
                <View>
                  <Text style={styles.infoLabel}>Experience Required</Text>
                  <Text style={styles.infoValue}>{job.experience} years</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={20} color={colors.ink} />
              <View>
                <Text style={styles.infoLabel}>Workers Needed</Text>
                <Text style={styles.infoValue}>{job.workers} people</Text>
              </View>
            </View>
          </View>

          {job.extras && typeof job.extras === 'string' && JSON.parse(job.extras).length > 0 ? (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Requirements & Extras</Text>
              <View style={{ gap: 8 }}>
                {JSON.parse(job.extras).map((extra, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                    <Text style={{ fontSize: 15, color: colors.ink }}>{extra}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : Array.isArray(job.extras) && job.extras.length > 0 ? (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Requirements & Extras</Text>
              <View style={{ gap: 8 }}>
                {job.extras.map((extra, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                    <Text style={{ fontSize: 15, color: colors.ink }}>{extra}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          
          {job.details ? (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{job.details}</Text>
            </View>
          ) : null}
          </>}
        </ScrollView>

        <View style={styles.footer}>
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: applying }} disabled={disabled}
            onPress={() => void apply()} style={({ pressed }) => [styles.applyButton, { opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}>
            <Text style={styles.applyButtonText}>{applying ? "Applyingâ€¦" : detail.isFetching ? "Loadingâ€¦" : label === "Apply" ? "Apply Now" : label}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
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
