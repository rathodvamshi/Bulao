import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "./ui";
import type { Job } from "../api/types";
import { useAuth } from "../auth";
import { JobApplicationsModal } from "./JobApplicationsModal";
import { AppImage } from "./AppImage";
import { formatJobTitle } from "../utils/jobTitle";

function formatClockTime(value: string | null | undefined, fallback: Date) {
  const match = value?.trim().match(/^(\d{1,2})(?::(\d{2}))?(?:\s*([ap]m))?$/i);
  const date = new Date(fallback);

  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const suffix = match[3]?.toLowerCase();
    if (suffix) hour = (hour % 12) + (suffix === "pm" ? 12 : 0);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) date.setHours(hour, minute, 0, 0);
  }

  return date
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\b(am|pm)$/i, (period) => period.toUpperCase());
}

function formatApproximateDistance(distanceKm: number) {
  if (distanceKm < 1) return "Under 1 km away";
  const lowerBound = Math.floor(distanceKm);
  return `${lowerBound}–${lowerBound + 1} km away`;
}

interface JobCardProps {
  job: Job;
  onViewDetails: (job: Job) => void;
  onViewApplications?: (job: Job) => void;
  onApply?: (job: Job) => Promise<void> | void;
}

export function JobCard({ job, onViewDetails, onViewApplications, onApply }: JobCardProps) {
  const { user, session } = useAuth();
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [applyConfirmationVisible, setApplyConfirmationVisible] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedLocally, setAppliedLocally] = useState(false);

  const currentUserId = user?.id || session?.userId;
  const isOwner = Boolean(
    currentUserId &&
    job.ownerId &&
    String(currentUserId).trim().toLowerCase() === String(job.ownerId).trim().toLowerCase()
  );

  const hasActiveApplication = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(job.myApplication?.status || "");
  const hasApplied = Boolean(hasActiveApplication || (appliedLocally && !job.myApplication));
  const remainingWorkers = Math.max(0, job.remainingWorkers ?? (job.workers - (job.acceptedCount || 0)));

  const payInRupees = job.payPaise / 100;
  const payDisplay = `₹${payInRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })} / ${job.payUnit.toLowerCase()}`;

  const startDate = new Date(job.startsAt * 1000);
  const dateDisplay = startDate.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = formatClockTime(job.startTime, startDate);
  const endTime = job.endTime
    ? formatClockTime(job.endTime, new Date(job.endsAt ? job.endsAt * 1000 : startDate.getTime()))
    : job.endsAt
      ? formatClockTime(null, new Date(job.endsAt * 1000))
      : null;
  const isOnlineWork = Boolean(
    job.area?.toLowerCase().includes("online") || /work mode\s*:\s*online/i.test(job.details || "")
  );
  const hasProviderRating = typeof job.ownerRating === "number" && job.ownerRating > 0;

  const handleApplyPress = () => {
    if (hasApplied || isApplying) return;
    if (!currentUserId) {
      Alert.alert("Sign In Required", "Please sign in to apply for this job.");
      return;
    }
    if (!onApply) {
      onViewDetails(job);
      return;
    }
    setApplyConfirmationVisible(true);
  };

  const confirmApply = async () => {
    if (!onApply || isApplying) return;
    try {
      setIsApplying(true);
      await onApply(job);
      setAppliedLocally(true);
      setApplyConfirmationVisible(false);
    } catch (err: any) {
      Alert.alert("Application Error", err?.message || "Failed to submit application.");
    } finally {
      setIsApplying(false);
    }
  };

  const handlePrimaryPress = () => {
    if (isOwner) {
      if (onViewApplications) {
        onViewApplications(job);
      } else {
        setAppsModalVisible(true);
      }
    } else {
      handleApplyPress();
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.providerRow}>
        <Pressable
          style={styles.providerProfilePressable}
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: job.ownerId, jobId: job.id } })}
          accessibilityRole="button"
          accessibilityLabel={`View ${job.ownerName || "provider"}'s profile`}
          hitSlop={4}
        >
          <View style={styles.providerAvatar}>
            {job.ownerPhotoUrl ? (
              <AppImage source={{ uri: job.ownerPhotoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={15} color="#176B58" />
            )}
          </View>
          <View style={styles.providerIdentity}>
            <Text style={styles.providerName} numberOfLines={1}>{job.ownerName || "Local provider"}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name={hasProviderRating ? "star" : "star-outline"} size={11} color={hasProviderRating ? "#D99A22" : "#87958C"} />
              <Text style={[styles.ratingText, !hasProviderRating && styles.newProviderText]}>
                {hasProviderRating ? job.ownerRating!.toFixed(1) : "New provider"}
              </Text>
              {hasProviderRating && job.ownerReviewsCount ? (
                <Text style={styles.reviewCount}>· {job.ownerReviewsCount} reviews</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        <View style={styles.payBadge}>
          <Text style={styles.payText}>{payDisplay}</Text>
        </View>
      </View>

      <View style={styles.halfDivider} />

      <Text style={styles.title} numberOfLines={2}>{formatJobTitle(job.title)}</Text>

      <View style={styles.locationRow}>
        <View style={styles.locationIcon}>
          <Ionicons name={isOnlineWork ? "laptop-outline" : "location"} size={15} color="#176B58" />
        </View>
        <Text style={styles.locationText} numberOfLines={2}>{job.area}</Text>
        {!isOnlineWork && job.distanceKm !== undefined ? (
          <View style={styles.distancePill}>
            <Text style={styles.distanceText}>{formatApproximateDistance(job.distanceKm)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>DATE</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{dateDisplay}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>TIME</Text>
          <Text style={styles.infoValue} numberOfLines={1} adjustsFontSizeToFit>
            {startTime}{endTime ? ` – ${endTime}` : ""}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel} numberOfLines={1} adjustsFontSizeToFit>MEMBERS NEEDED</Text>
          <View style={styles.memberValueRow}>
            <Ionicons name="people-outline" size={15} color="#176B58" />
            <Text style={styles.infoValue} numberOfLines={1} adjustsFontSizeToFit>
              {remainingWorkers} {remainingWorkers === 1 ? "spot" : "spots"} left
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewDetails(job)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText} numberOfLines={1}>View job details</Text>
              <Ionicons name="arrow-forward" size={15} color="#176B58" />
            </View>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePrimaryPress}
            disabled={!isOwner && (hasApplied || isApplying)}
            style={({ pressed }) => ({
              opacity: pressed && !hasApplied ? 0.7 : 1,
            })}
          >
            <View
              style={[
                styles.primaryButton,
                isOwner && styles.ownerButton,
                !isOwner && hasApplied && styles.appliedButton,
              ]}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={
                      isOwner
                        ? "people-outline"
                        : hasApplied
                        ? "checkmark-circle"
                        : "paper-plane-outline"
                    }
                    size={15}
                    color={!isOwner && hasApplied ? colors.green : "#FFFFFF"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.primaryButtonText,
                      !isOwner && hasApplied && styles.appliedButtonText,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isOwner
                      ? job.applicantCount && job.applicantCount > 0
                        ? `Applications (${job.applicantCount})`
                        : "View Applications"
                      : hasApplied
                      ? "Applied"
                      : "Apply"}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <JobApplicationsModal
        visible={appsModalVisible}
        jobId={job.id}
        jobTitle={formatJobTitle(job.customTitle || job.title)}
        initialApplicants={job.applicants}
        initialApplicantCount={job.applicantCount || job.applicants?.length}
        onClose={() => setAppsModalVisible(false)}
      />

      <Modal
        transparent
        visible={applyConfirmationVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !isApplying && setApplyConfirmationVisible(false)}
      >
        <View style={styles.confirmationOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss application confirmation"
            style={StyleSheet.absoluteFill}
            onPress={() => !isApplying && setApplyConfirmationVisible(false)}
          />
          <View style={styles.confirmationCard} accessibilityViewIsModal>
            <View style={styles.confirmationHeadingRow}>
              <View style={styles.confirmationIcon}>
                <Ionicons name="paper-plane" size={16} color="#147A5A" />
              </View>
              <View style={styles.confirmationHeadingText}>
                <Text style={styles.confirmationMessage}>Apply for this job?</Text>
                <Text style={styles.confirmationSubtext}>Send to {job.ownerName || "the employer"}</Text>
              </View>
            </View>
            <View style={styles.confirmationJob}>
              <View style={styles.confirmationJobTop}>
                <Text style={styles.confirmationJobTitle} numberOfLines={1}>{formatJobTitle(job.customTitle || job.title)}</Text>
                <Text style={styles.confirmationPay}>{payDisplay}</Text>
              </View>
              <Text style={styles.confirmationDetail} numberOfLines={1}>{job.area || "Location shared"}  ·  {dateDisplay}, {startTime}</Text>
            </View>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel application"
                accessibilityState={{ disabled: isApplying }}
                disabled={isApplying}
                onPress={() => setApplyConfirmationVisible(false)}
                style={({ pressed }) => [styles.confirmationCancel, pressed && !isApplying && styles.confirmationCancelPressed]}
              >
                <Text style={styles.confirmationCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send job application"
                accessibilityState={{ disabled: isApplying, busy: isApplying }}
                disabled={isApplying}
                onPress={() => void confirmApply()}
                style={({ pressed }) => [styles.confirmationConfirm, pressed && !isApplying && styles.confirmationConfirmPressed]}
              >
                <View style={styles.confirmationConfirmSurface}>
                  {isApplying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="paper-plane" size={14} color="#FFFFFF" /><Text style={styles.confirmationConfirmText}>Apply now</Text></>}
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    padding: 13,
    marginBottom: 11,
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.055,
        shadowRadius: 9,
      },
      android: { elevation: 2 },
    }),
  },
  providerRow: {
    minHeight: 32,
    justifyContent: "space-between",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 7,
  },
  providerProfilePressable: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  providerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#E5F0E9",
    alignItems: "center",
    justifyContent: "center",
  },
  providerIdentity: { justifyContent: "center", gap: 2, flexShrink: 1, maxWidth: 180 },
  halfDivider: {
    width: "48%" as const,
    height: 1,
    backgroundColor: "#E2ECE5",
    marginBottom: 9,
    borderRadius: 1,
  },
  providerName: {
    color: "#354A3E",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: { color: "#4B493B", fontSize: 11, fontWeight: "800" },
  newProviderText: { color: "#7B8980", fontWeight: "600" },
  reviewCount: { color: "#89948D", fontSize: 10, fontWeight: "500" },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0D2318",
    letterSpacing: -0.35,
    lineHeight: 24,
    marginTop: 1,
    marginBottom: 12,
  },
  payBadge: {
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#D5E9DC",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    flexShrink: 0,
  },
  payText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#176B58",
  },
  locationRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7EEE9",
    backgroundColor: "#F8FAF8",
  },
  locationIcon: {
    width: 22,
    height: 22,
    borderRadius: 9,
    backgroundColor: "#E2EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    color: "#243C30",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  distancePill: {
    borderRadius: 9,
    backgroundColor: "#EAF4ED",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexShrink: 0,
  },
  distanceText: { color: "#426653", fontSize: 10, fontWeight: "700" },
  infoGrid: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 7,
    paddingHorizontal: 5,
    marginBottom: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EEE9",
    backgroundColor: "#FBFCFB",
  },
  infoCell: { flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: 5 },
  infoDivider: { width: 1, backgroundColor: "#E4EAE5", marginHorizontal: 3, marginVertical: 5 },
  infoLabel: {
    color: "#839188",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.45,
    marginBottom: 3,
  },
  infoValue: { color: "#20382C", fontSize: 12, fontWeight: "700", lineHeight: 16 },
  infoSubValue: { color: "#718077", fontSize: 11, fontWeight: "500", marginTop: 2 },
  memberValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#EEF2EF",
  },
  secondaryButton: {
    minHeight: 35,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  secondaryButtonText: {
    color: "#176B58",
    fontSize: 12.5,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 35,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#176B58",
    ...Platform.select({
      ios: {
        shadowColor: "#176B58",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
  ownerButton: {
    backgroundColor: "#0F5041",
  },
  appliedButton: {
    backgroundColor: "#E8F5EE",
    borderWidth: 1.5,
    borderColor: "#176B58",
  },
  appliedButtonText: {
    color: "#176B58",
    fontWeight: "800",
  },
  confirmationOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(17, 29, 24, 0.38)",
  },
  confirmationCard: {
    width: "100%",
    maxWidth: 320,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EEE9",
    ...Platform.select({
      ios: { shadowColor: "#0D2318", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  confirmationIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9F5EF",
  },
  confirmationHeadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  confirmationHeadingText: { flex: 1 },
  confirmationMessage: { color: "#18372B", fontSize: 17, lineHeight: 21, fontWeight: "800" },
  confirmationSubtext: { color: "#718078", fontSize: 12, lineHeight: 16, marginTop: 2 },
  confirmationJob: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F6F8F6",
    borderWidth: 1,
    borderColor: "#E7ECE8",
  },
  confirmationJobTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  confirmationJobTitle: { flex: 1, color: "#20382C", fontSize: 13, lineHeight: 17, fontWeight: "800" },
  confirmationDetail: { color: "#637168", fontSize: 11, lineHeight: 15, marginTop: 5 },
  confirmationPay: { color: "#147A5A", fontSize: 12, fontWeight: "800", flexShrink: 0 },
  confirmationActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  confirmationCancel: {
    width: "40%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E2DA",
    backgroundColor: "#F7F9F7",
  },
  confirmationCancelPressed: { backgroundColor: "#EDF2EE", borderColor: "#BFCFC3" },
  confirmationCancelText: { color: "#40574A", fontSize: 14, fontWeight: "700" },
  confirmationConfirm: {
    width: "56%",
    flexShrink: 0,
  },
  confirmationConfirmSurface: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#075B43",
    borderWidth: 1,
    borderColor: "#064A36",
    ...Platform.select({
      ios: { shadowColor: "#075B43", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  confirmationConfirmPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  confirmationConfirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", includeFontPadding: false },
});
