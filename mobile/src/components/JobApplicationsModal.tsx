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
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Job } from "../api/types";

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
  const [modalRendered, setModalRendered] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  // Sync animation with visible prop (smooth & slow glide)
  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else if (modalRendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalRendered(false);
        }
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 280,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setModalRendered(false);
        onClose();
      }
    });
  };

  // Fetch full job data if jobId is provided to get live verified applicants
  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api<Job>(`/jobs/${jobId}`),
    enabled: visible && !!jobId,
    staleTime: 10000,
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

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "");
    void Linking.openURL(`tel:${cleanPhone}`);
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
              {applicantsList.map((cand: any, idx: number) => (
                <View key={cand.id || idx} style={styles.candidateCard}>
                  <View style={styles.candidateAvatar}>
                    <Text style={styles.candidateAvatarText}>
                      {(cand.name || "W").charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.candidateNameText} numberOfLines={1}>
                      {cand.name || "Worker Candidate"}
                    </Text>
                    {cand.area ? (
                      <Text style={styles.candidateAreaText} numberOfLines={1}>
                        {cand.area}
                      </Text>
                    ) : null}
                    <Text style={styles.candidateAppliedAt}>
                      Applied {formatRelativeTime(cand.appliedAt)}
                    </Text>
                  </View>

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
              ))}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: pro.borderSubtle,
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
