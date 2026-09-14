import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Linking,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Job, JobApplicant } from "../api/types";
import { CancellationModal } from "./CancellationModal";
import { formatDirectPhone } from "../utils/phone";

const pro = {
  canvas: "#F4F7F5",
  surface: "#FFFFFF",
  cardBg: "#FAFCFA",
  emeraldDark: "#022B1F",
  emeraldPrimary: "#075B43",
  emeraldMid: "#0A6E52",
  emeraldLight: "#10B981",
  emeraldSoft: "#E9F8EF",
  emeraldFrost: "#F0FDF4",
  ink: "#0D1914",
  charcoal: "#1F2E27",
  slate: "#475569",
  muted: "#64748B",
  faint: "#94A3B8",
  borderLight: "#E2EBE5",
  borderSubtle: "#EEF4F0",
};

function formatRelativeTime(timestamp?: string | number): string {
  if (!timestamp) return "Recently";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp * (timestamp < 1e11 ? 1000 : 1);
  if (isNaN(time)) return "Recently";
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

export interface JobApplicationsModalProps {
  visible: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  initialApplicants?: any[];
  initialApplicantCount?: number;
}

export function JobApplicationsModal({
  visible,
  onClose,
  jobId,
  jobTitle,
  initialApplicants,
  initialApplicantCount,
}: JobApplicationsModalProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const anim = useRef(new Animated.Value(0)).current;
  const [modalRendered, setModalRendered] = useState(false);
  const [cancellingApplicant, setCancellingApplicant] = useState<{ id: string; name: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Sync animation with visible prop (smooth & slow glide)
  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setModalRendered(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalRendered(false);
      onClose();
    });
  };

  // Fetch full job data if jobId is provided to get live verified applicants
  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api<Job>(`/jobs/${jobId}`),
    enabled: visible && !!jobId,
    staleTime: 5000,
  });

  const applicantsList = useMemo(() => {
    if (jobQuery.data?.applicants && Array.isArray(jobQuery.data.applicants)) {
      return jobQuery.data.applicants;
    }
    if (initialApplicants && Array.isArray(initialApplicants)) {
      return initialApplicants;
    }
    return [];
  }, [jobQuery.data?.applicants, initialApplicants]);

  const applicantsCount =
    jobQuery.data?.applicantCount ??
    (jobQuery.data?.applicants ? jobQuery.data.applicants.length : undefined) ??
    initialApplicantCount ??
    applicantsList.length;

  const handleCall = (phoneNumber?: string | null) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "");
    void Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleAction = async (applicationId: string, action: "accept" | "reject" | "cancel", reason?: string) => {
    try {
      setActionLoadingId(applicationId);
      await api(`/applications/${applicationId}/action`, {
        action,
        reason: reason || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
    } catch (err: any) {
      console.error("Failed to perform action:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!modalRendered) return null;

  const backdropOpacity = anim;
  const sheetTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [380, 0],
  });

  return (
    <Modal
      visible={modalRendered}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        {/* Animated backdrop */}
        <Animated.View
          style={[styles.backdropFill, { opacity: backdropOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Animated sheet */}
        <Animated.View
          style={[
            styles.appsSheetCard,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 16,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.sheetHandleIndicator} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.sheetMainTitle}>Received Applications</Text>
              <Text style={styles.sheetSubTitle} numberOfLines={1}>
                {applicantsCount}{" "}
                {applicantsCount === 1 ? "candidate has" : "candidates have"}{" "}
                applied
                {jobTitle ? ` • ${jobTitle}` : ""}
              </Text>
            </View>

            <Pressable
              style={styles.sheetCloseBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={pro.ink} />
            </Pressable>
          </View>

          {jobQuery.isLoading && applicantsList.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={pro.emeraldPrimary} />
              <Text style={styles.loadingText}>Fetching candidates...</Text>
            </View>
          ) : applicantsList.length > 0 ? (
            <ScrollView
              style={styles.candidatesScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {applicantsList.map((cand: any, idx: number) => {
                const appId = cand.applicationId || cand.id;
                const status = cand.status || "PENDING";
                const isAccepted = status === "ACCEPTED" || status === "IN_PROGRESS" || status === "COMPLETED";
                const isRejected = status === "REJECTED";
                const isCancelled = status === "CANCELLED_BY_SEEKER" || status === "CANCELLED_BY_PROVIDER" || status === "CANCELLED";
                const isPending = status === "PENDING";
                const isActionLoading = actionLoadingId === appId;

                return (
                  <View key={appId || idx} style={styles.candidateCard}>
                    <View style={styles.candidateTopRow}>
                      <View style={styles.candidateAvatar}>
                        <Text style={styles.candidateAvatarText}>
                          {(cand.name || "W").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1, paddingHorizontal: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.candidateNameText} numberOfLines={1}>
                            {cand.name || "Worker Candidate"}
                          </Text>
                          {/* Status Badge */}
                          <View
                            style={[
                              styles.statusBadge,
                              isAccepted && styles.statusAccepted,
                              isRejected && styles.statusRejected,
                              isCancelled && styles.statusCancelled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isAccepted && styles.statusAcceptedText,
                                isRejected && styles.statusRejectedText,
                                isCancelled && styles.statusCancelledText,
                              ]}
                            >
                              {isAccepted ? "Accepted" : isRejected ? "Rejected" : isCancelled ? "Cancelled" : "Pending"}
                            </Text>
                          </View>
                        </View>

                        {cand.area ? (
                          <Text style={styles.candidateAreaText} numberOfLines={1}>
                            {cand.area}
                          </Text>
                        ) : null}
                        {cand.phone ? (
                          <View style={styles.candidatePhoneRow}>
                            <Ionicons name="call" size={12} color={pro.emeraldPrimary} />
                            <Text style={styles.candidatePhoneText}>
                              {formatDirectPhone(cand.phone)}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.candidateAppliedAt}>
                          Applied {formatRelativeTime(cand.appliedAt)}
                        </Text>
                      </View>

                      {/* Call button if phone is unlocked */}
                      {cand.phone ? (
                        <Pressable
                          style={styles.candidateCallBtn}
                          onPress={() => handleCall(cand.phone)}
                          accessibilityRole="button"
                          accessibilityLabel={`Call ${cand.name || "candidate"}`}
                        >
                          <Ionicons name="call" size={16} color="#FFFFFF" />
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Action Buttons Row */}
                    <View style={styles.candidateActionsRow}>
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color={pro.emeraldPrimary} style={{ marginVertical: 6 }} />
                      ) : isPending ? (
                        <View style={{ flexDirection: "row", gap: 8, flex: 1, marginTop: 8 }}>
                          <Pressable
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() => handleAction(appId, "accept")}
                          >
                            <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => handleAction(appId, "reject")}
                          >
                            <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      ) : isRejected ? (
                        <View style={{ flexDirection: "row", gap: 8, flex: 1, marginTop: 8 }}>
                          <Pressable
                            style={[styles.actionBtn, styles.reAcceptBtn]}
                            onPress={() => handleAction(appId, "accept")}
                          >
                            <Ionicons name="refresh-outline" size={15} color={pro.emeraldPrimary} />
                            <Text style={styles.reAcceptBtnText}>Re-Accept Candidate</Text>
                          </Pressable>
                        </View>
                      ) : isAccepted ? (
                        <View style={{ flexDirection: "row", gap: 8, flex: 1, marginTop: 8, alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={styles.contactUnlockedNotice}>
                            <Ionicons name="lock-open-outline" size={12} color={pro.emeraldPrimary} /> Contact details unlocked
                          </Text>
                          <Pressable
                            style={styles.cancelLinkBtn}
                            onPress={() => setCancellingApplicant({ id: appId, name: cand.name || "candidate" })}
                          >
                            <Text style={styles.cancelLinkText}>Cancel Job</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyApplicantsBox}>
              <View style={styles.emptyApplicantsRing}>
                <Ionicons name="people-outline" size={34} color={pro.muted} />
              </View>
              <Text style={styles.emptyApplicantsTitle}>No Applications Yet</Text>
              <Text style={styles.emptyApplicantsDesc}>
                Your job posting is actively live on the Bulao worker feed. As
                candidates apply, their verified profiles and direct contacts
                will appear here instantly.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Cancellation Reason Modal */}
        <CancellationModal
          visible={!!cancellingApplicant}
          title={`Cancel Job with ${cancellingApplicant?.name || "Candidate"}`}
          isProvider={true}
          onClose={() => setCancellingApplicant(null)}
          onConfirm={(reason) => {
            if (cancellingApplicant?.id) {
              return handleAction(cancellingApplicant.id, "cancel", reason);
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  appsSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandleIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: pro.borderLight,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sheetMainTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: pro.ink,
  },
  sheetSubTitle: {
    fontSize: 12.5,
    color: pro.muted,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: pro.cardBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: pro.borderLight,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: pro.muted,
    fontWeight: "600",
  },
  candidatesScrollView: {
    marginBottom: 10,
  },
  candidateCard: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: pro.borderSubtle,
  },
  candidateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  candidateActionsRow: {
    paddingLeft: 46,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#B45309",
  },
  statusAccepted: {
    backgroundColor: pro.emeraldSoft,
  },
  statusAcceptedText: {
    color: pro.emeraldPrimary,
  },
  statusRejected: {
    backgroundColor: "#FEE2E2",
  },
  statusRejectedText: {
    color: "#DC2626",
  },
  statusCancelled: {
    backgroundColor: "#F1F5F9",
  },
  statusCancelledText: {
    color: "#64748B",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
  },
  acceptBtn: {
    backgroundColor: pro.emeraldPrimary,
  },
  acceptBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#DC2626",
  },
  reAcceptBtn: {
    backgroundColor: pro.emeraldSoft,
    borderWidth: 1,
    borderColor: pro.emeraldLight,
  },
  reAcceptBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: pro.emeraldPrimary,
  },
  contactUnlockedNotice: {
    fontSize: 12,
    color: pro.emeraldPrimary,
    fontWeight: "600",
  },
  cancelLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelLinkText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  candidateAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: pro.emeraldSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  candidateAvatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: pro.emeraldPrimary,
  },
  candidateNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: pro.ink,
  },
  candidateAreaText: {
    fontSize: 12.5,
    color: pro.slate,
    marginTop: 1,
  },
  candidateAppliedAt: {
    fontSize: 11,
    color: pro.muted,
    marginTop: 2,
  },
  candidatePhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    backgroundColor: pro.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  candidatePhoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: pro.emeraldPrimary,
    letterSpacing: 0.5,
  },
  candidateCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: pro.emeraldPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyApplicantsBox: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyApplicantsRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: pro.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyApplicantsTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: pro.ink,
    marginBottom: 6,
  },
  emptyApplicantsDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: pro.slate,
    textAlign: "center",
  },
});
