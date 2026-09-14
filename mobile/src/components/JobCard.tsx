import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import type { Job } from "../api/types";
import { useAuth } from "../auth";
import { JobApplicationsModal } from "./JobApplicationsModal";

interface JobCardProps {
  job: Job;
  onViewDetails: (job: Job) => void;
  onViewApplications?: (job: Job) => void;
  onApply?: (job: Job) => Promise<void> | void;
}

export function JobCard({ job, onViewDetails, onViewApplications, onApply }: JobCardProps) {
  const { user, session } = useAuth();
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedLocally, setAppliedLocally] = useState(false);

  const currentUserId = user?.id || session?.userId;
  const isOwner = Boolean(
    currentUserId &&
    job.ownerId &&
    String(currentUserId).trim().toLowerCase() === String(job.ownerId).trim().toLowerCase()
  );

  const hasApplied = Boolean(job.myApplication || appliedLocally);

  const payInRupees = job.payPaise / 100;
  const payDisplay = `₹${payInRupees} / ${job.payUnit.toLowerCase()}`;

  const startDate = new Date(job.startsAt * 1000);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const timeString = startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateDisplay = isToday ? `Today at ${timeString}` : startDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const handleApplyPress = async () => {
    if (hasApplied || isApplying) return;
    if (!currentUserId) {
      Alert.alert("Sign In Required", "Please sign in to apply for this job.");
      return;
    }
    if (onApply) {
      try {
        setIsApplying(true);
        await onApply(job);
        setAppliedLocally(true);
      } catch (err: any) {
        Alert.alert("Application Error", err?.message || "Failed to submit application.");
      } finally {
        setIsApplying(false);
      }
    } else {
      onViewDetails(job);
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
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Text style={styles.title} numberOfLines={2}>
              {job.title}
            </Text>
          </View>
          {isOwner ? (
            <View style={styles.ownerBadge}>
              <Ionicons name="person" size={11} color={colors.green} />
              <Text style={styles.ownerBadgeText}>Your Job Posting</Text>
            </View>
          ) : (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {job.roleName || job.categoryName || "General Work"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.payBadge}>
          <Text style={styles.payText}>{payDisplay}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.muted} />
          <Text style={styles.detailText} numberOfLines={1}>
            {job.area} {job.distanceKm !== undefined ? `• ${job.distanceKm} km away` : ""}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.detailText}>{dateDisplay}</Text>
        </View>

        {job.workers > 1 && (
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.muted} />
            <Text style={styles.detailText}>Needs {job.workers} workers</Text>
          </View>
        )}
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
              <Text style={styles.secondaryButtonText} numberOfLines={1} adjustsFontSizeToFit>
                View Details
              </Text>
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
        jobTitle={job.customTitle || job.title}
        initialApplicants={job.applicants}
        initialApplicantCount={job.applicantCount || job.applicants?.length}
        onClose={() => setAppsModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  payBadge: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  payText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.green,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.muted,
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  ownerButton: {
    backgroundColor: "#065F46",
  },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.greenLight,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.green,
  },
  roleBadge: {
    backgroundColor: "#F1F5F9",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#475569",
  },
  appliedButton: {
    backgroundColor: "#E2FBE8",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  appliedButtonText: {
    color: colors.green,
    fontWeight: "700",
  },
});
