import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { invalidateJobLifecycleQueries } from "../api/jobLifecycleCache";
import { useAuth } from "../auth";
import type { Job, JobApplicant } from "../api/types";
import { CancellationModal } from "./CancellationModal";
import { AppPressable as Pressable } from "./AppPressable";
import { AppImage } from "./AppImage";

const green = "#086649",
  ink = "#182C25",
  muted = "#718078";
const statusLabels: Record<string, string> = {
  PENDING: "Needs review",
  ACCEPTED: "Hired",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  CANCELLED_BY_SEEKER: "Applicant cancelled",
  CANCELLED_BY_PROVIDER: "You cancelled",
};
const HIRE_STATUSES = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"];
const TOP_RATED_STATUSES = ["PENDING", ...HIRE_STATUSES];
const TOP_RATING = 4.5;
const TOP_RATING_MIN_REVIEWS = 3;
function appliedDate(value?: number) {
  if (!value) return "Date unavailable";
  const date = new Date(value * (value < 1e11 ? 1000 : 1));
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export interface JobApplicationsModalProps {
  visible: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  initialApplicants?: JobApplicant[];
  initialApplicantCount?: number;
}
export function JobApplicationsModal({
  visible,
  onClose,
  jobId,
  initialApplicants,
  initialApplicantCount,
}: JobApplicationsModalProps) {
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<JobApplicant | null>(null);
  const [ratingCandidate, setRatingCandidate] = useState<JobApplicant | null>(null);
  const [bulkReviewVisible, setBulkReviewVisible] = useState(false);
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewedApplicationIds, setReviewedApplicationIds] = useState<string[]>([]);
  const locked = useRef(false);
  const autoSelectedFilter = useRef(false);
  const lastReadyRateIds = useRef<string[]>([]);
  const scope = useRef(0);
  useEffect(() => {
    scope.current++;
    setFilter("All");
    setError("");
    setCancelling(null);
    setRatingCandidate(null);
    setBulkReviewVisible(false);
    setSelectedRateIds([]);
    setReviewSuccess("");
    setReviewStars(0);
    setReviewBody("");
    setReviewedApplicationIds([]);
    setActionId(null);
    locked.current = false;
    autoSelectedFilter.current = false;
    lastReadyRateIds.current = [];
    return () => {
      scope.current++;
    };
  }, [visible, jobId, session?.token]);
  const jobQuery = useQuery({
    queryKey: ["job", jobId, session?.token],
    queryFn: () => api<Job>(`/jobs/${encodeURIComponent(jobId!)}`),
    enabled: visible && !!jobId && !!session?.token,
    staleTime: 0,
  });
  const job = jobQuery.data;
  const isOwner = !!user?.id && job?.ownerId === user.id;
  const candidates = useMemo(() => {
    // The API only returns applicant details to the job owner. Trust that
    // server-side access check instead of hiding results during auth hydration.
    const source = job ? job.applicants || [] : initialApplicants || [];
    return [...source].sort(
      (a, b) =>
        Number(b.status === "PENDING") - Number(a.status === "PENDING") ||
        (b.appliedAt || 0) - (a.appliedAt || 0),
    );
  }, [job, initialApplicants]);
  const pending = candidates.filter((c) => c.status === "PENDING").length;
  const hired = candidates.filter((c) => HIRE_STATUSES.includes(c.status || "")).length;
  const allCount = candidates.filter((c) => c.status !== "REJECTED").length;
  const rejectedCount = candidates.filter((c) => c.status === "REJECTED").length;
  const hasProviderReviewed = (candidate: JobApplicant) =>
    Boolean(candidate.reviewedByProvider || reviewedApplicationIds.includes(candidate.applicationId || ""));
  const readyToRate = candidates.filter(
    (c) => c.status === "COMPLETED" && !hasProviderReviewed(c),
  ).length;
  const readyToRateCandidates = useMemo(
    () => candidates.filter((candidate) =>
      candidate.status === "COMPLETED" && !candidate.reviewedByProvider &&
      !reviewedApplicationIds.includes(candidate.applicationId || "") &&
      !!candidate.applicationId,
    ),
    [candidates, reviewedApplicationIds],
  );
  const readyToRateIds = useMemo(
    () => readyToRateCandidates.map((candidate) => candidate.applicationId!),
    [readyToRateCandidates],
  );
  const selectedRateCount = readyToRateIds.filter((id) => selectedRateIds.includes(id)).length;
  const allReadySelected = readyToRateIds.length > 0 && selectedRateCount === readyToRateIds.length;
  const topRated = candidates.filter(
    (c) => TOP_RATED_STATUSES.includes(c.status || "") && (c.rating || 0) >= TOP_RATING && (c.totalReviews || 0) >= TOP_RATING_MIN_REVIEWS,
  ).length;
  const shown = useMemo(() => {
    const filtered = candidates.filter((candidate) => {
      const status = candidate.status || "";
      if (filter === "Hired") return HIRE_STATUSES.includes(status);
      if (filter === "Ready to rate") {
        return status === "COMPLETED" && !candidate.reviewedByProvider &&
          !reviewedApplicationIds.includes(candidate.applicationId || "");
      }
      if (filter === "Top rated") {
        return TOP_RATED_STATUSES.includes(status) && (candidate.rating || 0) >= TOP_RATING && (candidate.totalReviews || 0) >= TOP_RATING_MIN_REVIEWS;
      }
      if (filter === "Rejected") return status === "REJECTED";
      return status !== "REJECTED";
    });
    if (filter === "Top rated") {
      return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.totalReviews || 0) - (a.totalReviews || 0));
    }
    return filtered;
  }, [candidates, filter, reviewedApplicationIds]);
  const count =
    job?.applicantCount ?? initialApplicantCount ?? candidates.length;
  const seatsRemaining = job ? Math.max(0, job.remainingWorkers ?? (job.workers - (job.acceptedCount || hired))) : null;
  const allSeatsFilled = seatsRemaining === 0;
  const canAcceptMore = job?.status === "PUBLISHED" && !allSeatsFilled;
  const applicantDetailsMissing =
    jobQuery.isSuccess && isOwner && count > candidates.length;
  useEffect(() => {
    if (!visible || !jobQuery.isSuccess) return;
    if (!autoSelectedFilter.current) {
      autoSelectedFilter.current = true;
      lastReadyRateIds.current = readyToRateIds;
      if (readyToRate > 0) {
        setFilter("Ready to rate");
        setSelectedRateIds(readyToRateIds);
      } else if (allCount === 0 && rejectedCount > 0) setFilter("Rejected");
      return;
    }
    const newReadyIds = readyToRateIds.filter((id) => !lastReadyRateIds.current.includes(id));
    if (newReadyIds.length > 0) {
      setSelectedRateIds((current) => [...new Set([...current, ...newReadyIds])]);
      if (lastReadyRateIds.current.length === 0) setFilter("Ready to rate");
    }
    lastReadyRateIds.current = readyToRateIds;
  }, [visible, jobQuery.isSuccess, allCount, rejectedCount, readyToRate, readyToRateIds]);
  const canAct = isOwner && !jobQuery.isFetching && !jobQuery.isError;
  const close = () => {
    if (!locked.current) onClose();
  };
  const openProfile = (candidate: JobApplicant) => {
    if (locked.current || !candidate.id) return;
    onClose();
    router.push({
      pathname: "/profile/[id]",
      params: { id: candidate.id, role: "seeker" },
    });
  };
  const act = async (
    candidate: JobApplicant,
    action: "accept" | "reject" | "reject_completion" | "confirm" | "cancel",
    reason?: string,
  ) => {
    if (locked.current || !canAct || !candidate.applicationId)
      throw new Error("Refresh the applications before trying again.");
    locked.current = true;
    const version = scope.current;
    setActionId(candidate.applicationId);
    setError("");
    try {
      await api(
        `/applications/${encodeURIComponent(candidate.applicationId)}/action`,
        { action, ...(reason ? { reason } : {}) },
      );
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          [
            "job",
            "activity",
            "provider-recent-jobs",
            "my-jobs",
            "nearby",
            "provider-notifications",
            "notifications",
          ].includes(String(queryKey[0])),
      });
      if (version === scope.current) setCancelling(null);
    } catch (cause) {
      if (version === scope.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't save this change. Please try again.",
        );
      throw cause;
    } finally {
      if (version === scope.current) {
        locked.current = false;
        setActionId(null);
      }
    }
  };
  const call = async (phone: string) => {
    try {
      await Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`);
    } catch {
      setError("Couldn't open the phone dialler. Please try again.");
    }
  };
  const reviewMutation = useMutation({
    mutationFn: (submission: { interactionIds: string[]; stars: number; body: string; bulk: boolean }) =>
      submission.bulk
        ? api("/reviews/bulk", { interactionIds: submission.interactionIds, stars: submission.stars, body: submission.body })
        : api("/reviews", { interactionId: submission.interactionIds[0], stars: submission.stars, body: submission.body }),
    onSuccess: async (_result, submission) => {
      setReviewedApplicationIds((current) => [...new Set([...current, ...submission.interactionIds])]);
      setSelectedRateIds((current) => current.filter((id) => !submission.interactionIds.includes(id)));
      setReviewSuccess(
        submission.interactionIds.length > 1
          ? `Rated ${submission.interactionIds.length} seekers. Their profiles are updated.`
          : "Rating saved. The seeker's profile is updated.",
      );
      setRatingCandidate(null);
      setBulkReviewVisible(false);
      setReviewStars(0);
      setReviewBody("");
      await Promise.all([
        jobQuery.refetch(),
        invalidateJobLifecycleQueries(queryClient),
      ]);
    },
  });
  const openSingleRating = (candidate: JobApplicant) => {
    const interactionId = candidate.applicationId;
    if (!interactionId || !canAct || reviewMutation.isPending) return;
    setSelectedRateIds((current) => current.filter((id) => id !== interactionId));
    setBulkReviewVisible(false);
    setReviewStars(0);
    setReviewBody("");
    setReviewSuccess("");
    reviewMutation.reset();
    setRatingCandidate(candidate);
  };
  const openBulkRating = () => {
    if (!selectedRateCount || !canAct || reviewMutation.isPending) return;
    setRatingCandidate(null);
    setReviewStars(0);
    setReviewBody("");
    setReviewSuccess("");
    reviewMutation.reset();
    setBulkReviewVisible(true);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close applications"
          disabled={!!actionId}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title} accessibilityRole="header">
                Received applications
              </Text>
              <View style={styles.headerMeta}>
                {job ? (
                  <View style={styles.reviewPill}>
                    <Text style={styles.reviewText}>
                      {job.acceptedCount ?? hired}/{job.workers} hired · {seatsRemaining} {seatsRemaining === 1 ? "spot" : "spots"} open
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.subtitle}>
                  {count} {count === 1 ? "applicant" : "applicants"}
                </Text>
                {pending > 0 && (
                  <View style={styles.reviewPill}>
                    <View style={styles.reviewDot} />
                    <Text style={styles.reviewText}>{pending} to review</Text>
                  </View>
                )}
                {readyToRate > 0 && (
                  <Pressable
                    onPress={() => {
                      if (filter !== "Ready to rate") setSelectedRateIds(readyToRateIds);
                      setFilter("Ready to rate");
                      setReviewSuccess("");
                    }}
                    style={styles.rateQueuePill}
                    accessibilityRole="button"
                    accessibilityLabel={`${readyToRate} seekers ready for your rating`}
                  >
                    <Ionicons name="star" size={11} color="#94620D" />
                    <Text style={styles.rateQueueText}>{readyToRate} to rate</Text>
                  </Pressable>
                )}
                {pending === 0 && rejectedCount > 0 && (
                  <View style={styles.rejectedPill}>
                    <Text style={styles.rejectedPillText}>
                      {rejectedCount} rejected
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable
              style={styles.close}
              onPress={close}
              disabled={!!actionId}
              accessibilityRole="button"
              accessibilityLabel="Close applications"
            >
              <Ionicons name="close" size={22} color={ink} />
            </Pressable>
          </View>
          {!!error && (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {!!reviewSuccess && (
            <View style={styles.reviewSuccessBanner} accessibilityRole="summary">
              <Ionicons name="checkmark-circle" size={17} color="#176B4D" />
              <Text style={styles.reviewSuccessText}>{reviewSuccess}</Text>
            </View>
          )}
          {jobQuery.isError && (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={[styles.errorText, styles.flex]}>
                Couldn't refresh applications. Actions are paused until you
                retry.
              </Text>
              <Pressable
                style={styles.retry}
                onPress={() => void jobQuery.refetch()}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          )}
          {applicantDetailsMissing && (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={[styles.errorText, styles.flex]}>
                Some applicant details didn’t load. Refresh to try again.
              </Text>
              <Pressable
                style={styles.retry}
                onPress={() => void jobQuery.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Refresh applicant details"
              >
                <Text style={styles.link}>Refresh</Text>
              </Pressable>
            </View>
          )}
          <FlatList
            data={shown}
            keyExtractor={(c) => c.applicationId || c.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {filter === "Ready to rate" && readyToRate > 0 && (
                  <View style={styles.bulkReviewCard}>
                    <View style={styles.bulkReviewHeading}>
                      <View style={styles.bulkReviewIcon}>
                        <Ionicons name="people-outline" size={17} color={green} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.bulkReviewTitle}>Quick rate</Text>
                        <Text style={styles.bulkReviewCopy}>
                          Everyone starts selected. Unselect anyone you want to rate individually.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bulkReviewActions}>
                      <Pressable
                        onPress={() => setSelectedRateIds(allReadySelected ? [] : readyToRateIds)}
                        style={styles.bulkSelectAllButton}
                        accessibilityRole="button"
                      >
                        <Text style={styles.bulkSelectAllText}>
                          {allReadySelected ? "Clear selection" : "Select all"}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={!selectedRateCount || !canAct || reviewMutation.isPending}
                        onPress={openBulkRating}
                        style={[styles.bulkRateButton, (!selectedRateCount || !canAct) && styles.bulkRateButtonDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Give the same rating to ${selectedRateCount} selected seekers`}
                      >
                        <Ionicons name="star" size={14} color="#FFFFFF" />
                        <Text style={styles.bulkRateButtonText}>
                          Rate selected · {selectedRateCount}
                        </Text>
                      </Pressable>
                    </View>
                    <Text style={styles.bulkSelectionHint}>
                      The same stars and optional note will be shared with the selected seekers.
                    </Text>
                  </View>
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabs}
                >
                  {["All", "Top rated", "Hired", "Ready to rate", "Rejected"].map((tab) => (
                    <Pressable
                      key={tab}
                      onPress={() => {
                        if (tab === "Ready to rate" && filter !== tab) {
                          setSelectedRateIds(readyToRateIds);
                        }
                        setFilter(tab);
                        setReviewSuccess("");
                      }}
                      style={[styles.tab, filter === tab && styles.activeTab]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: filter === tab }}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          filter === tab && styles.activeTabText,
                        ]}
                      >
                        {tab === "All"
                          ? `All (${allCount})`
                          : tab === "Top rated"
                            ? `Top rated (${topRated})`
                            : tab === "Hired"
                              ? `Hired (${hired})`
                              : tab === "Ready to rate"
                                ? `Rate seekers (${readyToRate})`
                              : `Rejected (${rejectedCount})`}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                {jobQuery.isLoading ? (
                  <ActivityIndicator color={green} />
                ) : (
                  <Ionicons name="people-outline" size={30} color={green} />
                )}
                <Text style={styles.emptyTitle}>
                  {jobQuery.isLoading
                    ? "Loading applicants"
                    : jobQuery.isError
                      ? "Applications unavailable"
                      : applicantDetailsMissing
                        ? "Applicant details unavailable"
                        : filter === "All"
                          ? "No applications here"
                          : filter === "Rejected"
                            ? "No rejected applications"
                            : filter === "Top rated"
                              ? "No highly rated applicants yet"
                              : filter === "Ready to rate"
                                ? "No seeker ratings waiting"
                              : `No ${filter.toLowerCase()} applications`}
                </Text>
                <Text style={styles.emptyCopy}>
                  {applicantDetailsMissing
                    ? `We found ${count} applications but could not load all applicant profiles. Refresh the list to try again.`
                    : filter === "All"
                      ? "All applications except rejected ones appear here. Cancelled and withdrawn applications keep their status."
                      : filter === "Rejected"
                        ? "Rejected applications stay here. You can reconsider someone and accept them again."
                        : filter === "Ready to rate"
                          ? "Seekers appear here after they confirm completed work. Rate each person separately."
                          : filter === "Top rated"
                          ? `Top rated means ${TOP_RATING.toFixed(1)}+ stars from at least ${TOP_RATING_MIN_REVIEWS} reviews.`
                          : "Applicants you hire will appear here."}
                </Text>
                {filter === "All" && rejectedCount > 0 && (
                  <Pressable
                    onPress={() => setFilter("Rejected")}
                    style={({ pressed }) => [styles.rejectedAction, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.rejectedActionText}>
                      View {rejectedCount} rejected
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color={green} />
                  </Pressable>
                )}
              </View>
            }
            renderItem={({ item: candidate }) => {
              const status = candidate.status || "UNKNOWN";
              const active = HIRE_STATUSES.includes(status);
              const canCancelHire = status === "ACCEPTED" || status === "IN_PROGRESS";
              const awaitingProviderDecision = status === "IN_PROGRESS" && candidate.workerConfirmedAt != null && candidate.ownerConfirmedAt == null && candidate.completionRejectedAt == null;
              const needsProviderResubmit = status === "IN_PROGRESS" && candidate.completionRejectedAt != null && candidate.completionRejectedBy !== user?.id;
              const pendingCandidate = status === "PENDING";
              const selectedForBulk = selectedRateIds.includes(candidate.applicationId || "");
              const disabled =
                !canAct || !!actionId || !candidate.applicationId;
              return (
                <View style={[styles.card, pendingCandidate && styles.pendingCard]}>
                  <Pressable
                    style={styles.identity}
                    onPress={() => openProfile(candidate)}
                    disabled={!!actionId}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${candidate.name || "applicant"}'s profile`}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.initial}>
                        {(candidate.name || "A").trim().charAt(0).toUpperCase()}
                      </Text>
                      {candidate.photoUrl && (
                        <AppImage
                          source={{ uri: candidate.photoUrl }}
                          style={styles.photo}
                        />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>
                        {candidate.name || "Applicant"}
                      </Text>
                      <Text style={styles.meta}>
                        {candidate.area || "Location not shared"}
                      </Text>
                      <Text style={styles.applied}>
                        Applied {appliedDate(candidate.appliedAt)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={muted} />
                  </Pressable>
                  <View style={styles.statusLine}>
                    <View
                      style={[
                        styles.badge,
                        pendingCandidate
                          ? styles.pendingBadge
                          : active
                            ? styles.hiredBadge
                            : styles.historyBadge,
                      ]}
                    >
                      {pendingCandidate && <View style={styles.pendingDot} />}
                      <Text
                        style={[styles.badgeText, active && styles.hiredText]}
                      >
                        {statusLabels[status] || "Status unavailable"}
                      </Text>
                    </View>
                    {candidate.rating != null && (candidate.totalReviews || 0) > 0 && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={12} color="#B7791F" />
                        <Text style={styles.ratingText}>
                          {Number(candidate.rating).toFixed(1)} · {candidate.totalReviews} {candidate.totalReviews === 1 ? "review" : "reviews"}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!candidate.cancellationReason && (
                    <View style={styles.reason}>
                      <Text style={styles.factLabel}>Cancellation reason</Text>
                      <Text style={styles.reasonText}>
                        {candidate.cancellationReason}
                      </Text>
                    </View>
                  )}
                  {candidate.completionRejectedAt != null && (
                    <View style={styles.reason}>
                      <Text style={styles.factLabel}>Completion needs another look</Text>
                      <Text style={styles.reasonText}>{candidate.completionRejectionReason || "The completion request was sent back for review."}</Text>
                    </View>
                  )}
                  {awaitingProviderDecision && (
                    <View style={styles.reason}>
                      <Text style={styles.factLabel}>Seeker marked this work complete</Text>
                      <Text style={styles.reasonText}>Confirm the agreed work is finished, or send the request back.</Text>
                      <View style={[styles.actions, { marginTop: 8 }]}>
                        <Pressable disabled={disabled} onPress={() => void act(candidate, "confirm").catch(() => {})} style={[styles.button, styles.accept, disabled && styles.disabled]} accessibilityRole="button">
                          <Text style={styles.acceptText}>Confirm complete</Text>
                        </Pressable>
                        <Pressable disabled={disabled} onPress={() => void act(candidate, "reject_completion", "Work is not complete yet.").catch(() => {})} style={[styles.button, styles.decline, disabled && styles.disabled]} accessibilityRole="button">
                          <Text style={styles.declineText}>Not complete</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {needsProviderResubmit && (
                    <Pressable disabled={disabled} onPress={() => void act(candidate, "confirm").catch(() => {})} style={[styles.button, styles.accept, { marginTop: 10 }, disabled && styles.disabled]} accessibilityRole="button">
                      <Text style={styles.acceptText}>Mark complete again</Text>
                    </Pressable>
                  )}
                  {actionId === candidate.applicationId && (
                    <ActivityIndicator
                      color={green}
                      style={{ marginTop: 12 }}
                    />
                  )}
                  {(pendingCandidate || status === "REJECTED") && (
                    <View style={styles.actions}>
                      <Pressable
                        disabled={disabled || !canAcceptMore}
                        onPress={() =>
                          void act(candidate, "accept").catch(() => {})
                        }
                        style={[
                          styles.button,
                          styles.accept,
                          (disabled || !canAcceptMore) && styles.disabled,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.acceptText}>
                          {status === "REJECTED"
                            ? !canAcceptMore ? allSeatsFilled ? "All spots filled" : "Job unavailable" : "Reconsider"
                            : !canAcceptMore ? allSeatsFilled ? "All spots filled" : "Job unavailable" : "Accept"}
                        </Text>
                      </Pressable>
                      {pendingCandidate && (
                        <Pressable
                          disabled={disabled}
                          onPress={() =>
                            void act(candidate, "reject").catch(() => {})
                          }
                          style={[
                            styles.button,
                            styles.decline,
                            disabled && styles.disabled,
                          ]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.declineText}>Decline</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  {candidate.phone && (
                    <Pressable
                      onPress={() => void call(candidate.phone!)}
                      style={[styles.button, styles.accept, { marginTop: 10 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${candidate.name}`}
                    >
                      <Ionicons name="call-outline" size={17} color="#FFF" />
                      <Text style={styles.acceptText}>Call applicant</Text>
                    </Pressable>
                  )}
                  {canCancelHire && (
                    <Pressable
                      disabled={disabled}
                      onPress={() => setCancelling(candidate)}
                      style={styles.cancelButton}
                      accessibilityRole="button"
                    >
                      <Text style={styles.cancelText}>Cancel this hire</Text>
                    </Pressable>
                  )}
                  {status === "COMPLETED" && (
                    hasProviderReviewed(candidate) ? (
                      <View style={styles.ratedStatus} accessibilityRole="text">
                        <Ionicons name="checkmark-circle" size={16} color="#176B4D" />
                        <Text style={styles.ratedStatusText}>You rated this seeker</Text>
                      </View>
                    ) : filter === "Ready to rate" ? (
                      <View style={styles.readyRatingControls}>
                        <Pressable
                          onPress={() => {
                            const interactionId = candidate.applicationId;
                            if (!interactionId) return;
                            setSelectedRateIds((current) => current.includes(interactionId)
                              ? current.filter((id) => id !== interactionId)
                              : [...current, interactionId]);
                          }}
                          style={styles.readySelectionToggle}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selectedForBulk }}
                          accessibilityLabel={`${selectedForBulk ? "Remove" : "Include"} ${candidate.name || "seeker"} ${selectedForBulk ? "from" : "in"} shared rating`}
                        >
                          <View style={[styles.readyCheckbox, selectedForBulk && styles.readyCheckboxSelected]}>
                            {selectedForBulk && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                          </View>
                          <Text style={styles.readySelectionText} numberOfLines={1}>
                            {selectedForBulk ? "Included in shared rating" : "Rate this person individually"}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!canAct || reviewMutation.isPending}
                          onPress={() => openSingleRating(candidate)}
                          style={styles.individualRateLink}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate ${candidate.name || "this seeker"} individually`}
                        >
                          <Text style={styles.individualRateText}>Rate individually</Text>
                          <Ionicons name="arrow-forward" size={14} color={green} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        disabled={!canAct || !candidate.applicationId || reviewMutation.isPending}
                        onPress={() => openSingleRating(candidate)}
                        style={({ pressed }) => [styles.rateSeekerButton, pressed && { opacity: 0.86 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${candidate.name || "this seeker"}`}
                      >
                        <Ionicons name="star-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.rateSeekerButtonText}>Rate seeker</Text>
                        <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                      </Pressable>
                    )
                  )}
                  {pendingCandidate && (
                    <Text style={styles.contactHint}>
                      Review their profile before accepting.
                    </Text>
                  )}
                </View>
              );
            }}
          />
        </View>
        <CancellationModal
          visible={!!cancelling}
          title={`Cancel hire with ${cancelling?.name || "applicant"}`}
          isProvider
          onClose={() => setCancelling(null)}
          onConfirm={(reason) =>
            cancelling ? act(cancelling, "cancel", reason) : undefined
          }
        />
      </View>
      <Modal
        visible={!!ratingCandidate || bulkReviewVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setRatingCandidate(null);
          setBulkReviewVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.reviewOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!reviewMutation.isPending) {
                setRatingCandidate(null);
                setBulkReviewVisible(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Close seeker rating"
          />
          <View style={[styles.reviewSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.reviewHandle} />
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderCopy}>
                <Text style={styles.reviewTitle}>
                  {bulkReviewVisible
                    ? `Rate ${selectedRateCount} seekers together`
                    : `Rate ${ratingCandidate?.name || "this seeker"}`}
                </Text>
                <Text style={styles.reviewSubtitle}>
                  {bulkReviewVisible
                    ? "The same stars and optional note will be added to each selected seeker."
                    : "Your rating is added to their Bulao profile."}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setRatingCandidate(null);
                  setBulkReviewVisible(false);
                }}
                disabled={reviewMutation.isPending}
                style={styles.reviewSkipButton}
                accessibilityRole="button"
                accessibilityLabel="Skip this rating for now"
              >
                <Text style={styles.reviewSkipText}>Skip</Text>
              </Pressable>
            </View>
            <View style={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewStars(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
                  accessibilityState={{ selected: reviewStars === star }}
                  style={styles.reviewStarTap}
                >
                  <Ionicons name={reviewStars >= star ? "star" : "star-outline"} size={31} color={reviewStars >= star ? "#D99A28" : "#B9C5BE"} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.reviewHint}>Choose a rating to submit. Written feedback is optional.</Text>
            <TextInput
              value={reviewBody}
              onChangeText={setReviewBody}
              placeholder={bulkReviewVisible ? "Shared note for everyone (optional)" : "Share a helpful note (optional)"}
              placeholderTextColor="#8A958E"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.reviewInput}
              accessibilityLabel="Optional written feedback"
            />
            {!!reviewMutation.error && (
              <Text style={styles.reviewError} accessibilityRole="alert">
                {reviewMutation.error.message || "Couldn't submit this rating. Please try again."}
              </Text>
            )}
            <Pressable
              disabled={reviewStars === 0 || reviewMutation.isPending || (bulkReviewVisible ? selectedRateCount === 0 : !ratingCandidate?.applicationId)}
              onPress={() => {
                const interactionIds = bulkReviewVisible
                  ? readyToRateIds.filter((id) => selectedRateIds.includes(id))
                  : ratingCandidate?.applicationId ? [ratingCandidate.applicationId] : [];
                if (interactionIds.length === 0 || reviewStars === 0) return;
                reviewMutation.mutate({
                  interactionIds,
                  stars: reviewStars,
                  body: reviewBody.trim(),
                  bulk: bulkReviewVisible,
                });
              }}
              style={[styles.reviewSubmit, (reviewStars === 0 || reviewMutation.isPending || (bulkReviewVisible && selectedRateCount === 0)) && styles.reviewSubmitDisabled]}
              accessibilityRole="button"
            >
              {reviewMutation.isPending && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={styles.reviewSubmitText}>
                {bulkReviewVisible
                  ? `Submit for ${selectedRateCount} seeker${selectedRateCount === 1 ? "" : "s"}`
                  : "Submit rating"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 38, 29, 0.20)",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    height: "72%",
    maxHeight: "92%",
    backgroundColor: "#FBFCFB",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#193D2D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 18,
  },
  handle: {
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: "#C9D8CF",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EE",
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 20, lineHeight: 27, fontWeight: "800", color: ink },
  headerMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
  subtitle: { fontSize: 12, color: muted },
  reviewPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF4DE", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  reviewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D38A18" },
  reviewText: { fontSize: 11, fontWeight: "700", color: "#8A5A12" },
  rateQueuePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF4DE", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  rateQueueText: { fontSize: 11, fontWeight: "700", color: "#805B18" },
  reviewSuccessBanner: { flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#EAF4EE" },
  reviewSuccessText: { flex: 1, color: "#176B4D", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  rejectedPill: { backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  rejectedPillText: { fontSize: 11, fontWeight: "700", color: "#A65342" },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F6F3",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 10 },
  meta: { fontSize: 12, lineHeight: 18, color: muted },
  factLabel: { fontSize: 11, color: muted, fontWeight: "600" },
  tabs: { gap: 6, paddingVertical: 12 },
  bulkReviewCard: { padding: 13, marginTop: 4, borderRadius: 16, borderWidth: 1, borderColor: "#DCEAE1", backgroundColor: "#F2F8F4", gap: 10 },
  bulkReviewHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulkReviewIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#E1F0E6" },
  bulkReviewTitle: { color: ink, fontSize: 14, fontWeight: "800" },
  bulkReviewCopy: { color: muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  bulkReviewActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulkSelectAllButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE7E0" },
  bulkSelectAllText: { color: green, fontSize: 11.5, fontWeight: "700" },
  bulkRateButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: green },
  bulkRateButtonDisabled: { opacity: 0.45 },
  bulkRateButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  bulkSelectionHint: { color: "#65756C", fontSize: 10.5, lineHeight: 15 },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "#F3F5F4",
  },
  activeTab: { backgroundColor: green },
  tabText: { fontSize: 12, fontWeight: "600", color: muted },
  activeTabText: { color: "#FFF" },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#FFF",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EAF4EE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { ...StyleSheet.absoluteFillObject, width: 50, height: 50 },
  initial: { fontSize: 20, fontWeight: "700", color: green },
  name: { fontSize: 17, lineHeight: 23, color: ink, fontWeight: "700" },
  applied: { fontSize: 11, lineHeight: 16, color: muted, marginTop: 3 },
  statusLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 },
  badge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  pendingBadge: { backgroundColor: "#FFF3DB", flexDirection: "row", alignItems: "center", gap: 6 },
  pendingCard: { borderColor: "#E5D7B8" },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D38A18" },
  hiredBadge: { backgroundColor: "#E6F4EC" },
  historyBadge: { backgroundColor: "#F0F3F1" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#FFF7E6" },
  ratingText: { fontSize: 11, fontWeight: "700", color: "#805B18" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#756249" },
  hiredText: { color: green },
  reason: {
    backgroundColor: "#FFF7EF",
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 5,
  },
  reasonText: { color: ink, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  button: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  accept: { backgroundColor: green },
  acceptText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  decline: { backgroundColor: "#F6F3F1" },
  declineText: { fontSize: 13, fontWeight: "600", color: "#78574A" },
  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelText: { color: "#A65342", fontSize: 12, fontWeight: "600" },
  rateSeekerButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: green },
  rateSeekerButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  readyRatingControls: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: "#F6F9F7", borderWidth: 1, borderColor: "#E5ECE7", gap: 8 },
  readySelectionToggle: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 8 },
  readyCheckbox: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1.5, borderColor: "#AAB9B0", backgroundColor: "#FFFFFF" },
  readyCheckboxSelected: { borderColor: green, backgroundColor: green },
  readySelectionText: { flex: 1, minWidth: 0, color: "#52645A", fontSize: 11.5, fontWeight: "600" },
  individualRateLink: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8 },
  individualRateText: { color: green, fontSize: 11.5, fontWeight: "800" },
  ratedStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, marginTop: 8, borderRadius: 11, backgroundColor: "#EAF4EE" },
  ratedStatusText: { color: "#176B4D", fontSize: 12, fontWeight: "700" },
  reviewOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18,38,29,0.28)" },
  reviewSheet: { width: "100%", maxWidth: 640, paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#FFFFFF", gap: 13, shadowColor: "#193D2D", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 18 },
  reviewHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#C9D8CF", marginBottom: 3 },
  reviewHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  reviewHeaderCopy: { flex: 1, minWidth: 0, gap: 4 },
  reviewTitle: { color: ink, fontSize: 19, lineHeight: 25, fontWeight: "800" },
  reviewSubtitle: { color: muted, fontSize: 12.5, lineHeight: 18 },
  reviewSkipButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "#F1F5F2" },
  reviewSkipText: { color: green, fontSize: 12, fontWeight: "700" },
  reviewStars: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 2 },
  reviewStarTap: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  reviewHint: { color: muted, fontSize: 11.5, textAlign: "center" },
  reviewInput: { minHeight: 82, maxHeight: 132, borderWidth: 1, borderColor: "#E3EAE5", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, color: ink, fontSize: 13, backgroundColor: "#FBFCFB" },
  reviewError: { color: "#B42318", fontSize: 12, lineHeight: 17 },
  reviewSubmit: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: green },
  reviewSubmitDisabled: { opacity: 0.48 },
  reviewSubmitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  contactHint: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    color: muted,
    marginTop: 10,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  error: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#FFF1EB",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { color: "#9D4736", fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 13, color: green, fontWeight: "600" },
  empty: { flex: 1, paddingVertical: 24, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: {
    fontSize: 17,
    color: ink,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: muted,
    maxWidth: 270,
  },
  rejectedAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#EAF4EE",
  },
  rejectedActionText: { color: green, fontSize: 13, fontWeight: "700" },
});
