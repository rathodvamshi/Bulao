import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../api/client";
import { AppImage } from "./AppImage";

type ReceivedRating = {
  id: string;
  stars: number;
  body: string;
  createdAt?: number;
  authorName?: string;
  authorPhotoUrl?: string | null;
};

type RatingInteraction = {
  id: string;
  kind: string;
  isOwner: boolean;
  jobId?: string | null;
  title: string;
  status: string;
  reviewed?: boolean;
  area?: string | null;
  otherId: string;
  otherName?: string;
  otherPhotoUrl?: string | null;
  otherPhoneVerified?: boolean;
  otherCreatedAt?: number | null;
  otherRating?: number | null;
  otherTotalReviews?: number;
  otherCompletedCount?: number;
  otherCompletionRate?: number | null;
  distanceKm?: number | null;
  jobOverview?: {
    categoryName?: string;
    area?: string | null;
    address?: string | null;
    details?: string | null;
    payPaise?: number | null;
    payUnit?: string | null;
    duration?: string | null;
    hours?: string | null;
    startsAt?: number | null;
  } | null;
  receivedReview?: ReceivedRating | null;
  myReview?: { stars: number; body: string } | null;
};

type Props = {
  interactionId: string;
  role: "seeker" | "provider";
  onBack: () => void;
};

function initials(name?: string) {
  return (name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function memberSince(timestamp?: number | null) {
  if (!timestamp) return "Member";
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "Member";
  return `Member since ${date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
}

function reviewDate(timestamp?: number) {
  if (!timestamp) return "Recently";
  return new Date(timestamp * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const REVIEW_SUGGESTIONS = ["Reliable", "On time", "Good communication", "Respectful"];

function RateReviewerCard({
  interactionId,
  reviewerName,
  reviewed,
  savedReview,
  onRated,
}: {
  interactionId: string;
  reviewerName: string;
  reviewed: boolean;
  savedReview?: { stars: number; body: string } | null;
  onRated: () => Promise<unknown>;
}) {
  const [stars, setStars] = useState(savedReview?.stars ?? 0);
  const [feedback, setFeedback] = useState(savedReview?.body ?? "");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const submitReview = useMutation({
    mutationFn: () => {
      const body = [selectedSuggestions.join(", "), feedback.trim()].filter(Boolean).join(" · ");
      return api("/reviews", { interactionId, stars, body });
    },
    onSuccess: async () => { await onRated(); },
  });
  const isRated = reviewed || submitReview.isSuccess;
  const savedStars = savedReview?.stars ?? (submitReview.isSuccess ? stars : 0);
  const savedFeedback = savedReview?.body ?? (
    submitReview.isSuccess
      ? [selectedSuggestions.join(", "), feedback.trim()].filter(Boolean).join(" · ")
      : ""
  );

  if (isRated) {
    return (
      <View style={styles.reviewSuccessCard}>
        <View style={styles.reviewSuccessHeader}>
          <View style={styles.reviewSuccessIcon}><Ionicons name="checkmark-circle" size={24} color={green} /></View>
          <View style={styles.rateCopy}>
            <Text style={styles.reviewDirectionLabel}>YOUR REVIEW OF</Text>
            <Text style={styles.rateTitle} numberOfLines={1}>You rated {reviewerName}</Text>
            <Text style={styles.rateSubtitle}>Your review is saved.</Text>
          </View>
          <View style={styles.ratedPill}><Ionicons name="checkmark" size={13} color={green} /><Text style={styles.ratedPillText}>Rated</Text></View>
        </View>
        {(savedStars || savedFeedback.trim()) ? (
          <View style={styles.savedReviewDetails}>
            {savedStars > 0 && (
              <View style={styles.savedReviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons key={star} name={star <= savedStars ? "star" : "star-outline"} size={17} color={star <= savedStars ? "#E3A62F" : "#C8D1CB"} />
                ))}
                <Text style={styles.savedReviewScore}>{savedStars}/5</Text>
              </View>
            )}
            <View style={styles.savedFeedbackBox}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color="#718078" />
              <Text style={styles.savedFeedbackText}>{savedFeedback.trim() || "No written feedback was added."}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.reviewUnavailable}>
            <Text style={styles.reviewUnavailableText}>Your review is saved, but its details couldn’t be loaded.</Text>
            <Pressable onPress={() => void onRated()} accessibilityRole="button"><Text style={styles.reviewRetryText}>Reload</Text></Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.rateFormCard}>
      <View style={styles.rateFormHeader}>
        <View style={styles.rateIconWrap}><Ionicons name="star" size={19} color="#B77916" /></View>
        <View style={styles.rateCopy}>
          <Text style={styles.reviewDirectionLabel}>YOUR REVIEW OF</Text>
          <Text style={styles.rateTitle} numberOfLines={1}>Rate {reviewerName}</Text>
          <Text style={styles.rateSubtitle}>Share your experience to help others.</Text>
        </View>
      </View>

      <Text style={styles.rateFieldLabel}>Your rating</Text>
      <View style={styles.rateStarsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => setStars(star)}
            style={styles.rateStarButton}
            accessibilityRole="button"
            accessibilityLabel={`${star} ${star === 1 ? "star" : "stars"}`}
            accessibilityState={{ selected: stars === star }}
          >
            <Ionicons name={star <= stars ? "star" : "star-outline"} size={30} color={star <= stars ? "#E3A62F" : "#C8D1CB"} />
          </Pressable>
        ))}
        <Text style={styles.rateStarHint}>{stars ? `${stars}/5` : "Tap to rate"}</Text>
      </View>

      <Text style={styles.rateFieldLabel}>Quick tags <Text style={styles.optionalLabel}>· optional</Text></Text>
      <View style={styles.suggestionsRow}>
        {REVIEW_SUGGESTIONS.map((suggestion) => {
          const selected = selectedSuggestions.includes(suggestion);
          return (
            <Pressable
              key={suggestion}
              onPress={() => setSelectedSuggestions((current) => selected ? current.filter((item) => item !== suggestion) : [...current, suggestion])}
              style={[styles.suggestionChip, selected && styles.suggestionChipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.suggestionText, selected && styles.suggestionTextSelected]}>{suggestion}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.rateFieldLabel}>Feedback <Text style={styles.optionalLabel}>· optional</Text></Text>
      <TextInput
        value={feedback}
        onChangeText={setFeedback}
        placeholder="What went well?"
        placeholderTextColor="#94A098"
        multiline
        maxLength={900}
        textAlignVertical="top"
        style={styles.feedbackInput}
        accessibilityLabel="Write feedback"
      />
      {!!submitReview.error && <Text style={styles.reviewSubmitError}>{submitReview.error instanceof Error ? submitReview.error.message : "Could not save your review. Try again."}</Text>}
      <Pressable
        disabled={!stars || submitReview.isPending}
        onPress={() => submitReview.mutate()}
        style={[styles.submitReviewButton, (!stars || submitReview.isPending) && styles.submitReviewDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Submit rating and feedback"
      >
        {submitReview.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send-outline" size={17} color="#FFFFFF" />}
        <Text style={styles.submitReviewText}>{submitReview.isPending ? "Saving review…" : "Submit review"}</Text>
      </Pressable>
    </View>
  );
}

export function ReceivedRatingScreen({ interactionId, role, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const ratingQuery = useQuery({
    queryKey: ["received-rating", interactionId],
    enabled: Boolean(interactionId),
    queryFn: () => api<RatingInteraction>(`/interactions/${encodeURIComponent(interactionId)}`),
  });
  const data = ratingQuery.data;
  const reviewerRole = data
    ? data.isOwner ? "provider" : "seeker"
    : role === "seeker" ? "provider" : "seeker";
  const reviewerTitle = reviewerRole === "provider" ? "Provider" : "Worker";
  const score = data?.receivedReview?.stars ?? 0;
  const reviewerInitials = useMemo(() => initials(data?.otherName), [data?.otherName]);

  const openReviewerProfile = () => {
    if (!data?.otherId) return;
    router.push({
      pathname: "/profile/[id]",
      params: {
        id: data.otherId,
        role: reviewerRole,
        ...(data.jobId ? { jobId: data.jobId } : {}),
      },
    });
  };

  const openJobOverview = () => {
    if (data?.jobId) router.push({ pathname: "/jobs/[id]", params: { id: data.jobId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Rating received</Text>
        <View style={styles.headerSpacer} />
        </View>

        {ratingQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.stateText}>Loading rating details…</Text>
        </View>
      ) : ratingQuery.isError || !data ? (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}><Ionicons name="alert-circle-outline" size={27} color="#A95745" /></View>
          <Text style={styles.stateTitle}>Rating details unavailable</Text>
          <Text style={styles.stateText}>Try again in a moment.</Text>
          <Pressable onPress={() => void ratingQuery.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.introIcon}><Ionicons name="star" size={19} color="#B87812" /></View>
            <View style={styles.introCopy}>
              <Text style={styles.eyebrow}>NEW FEEDBACK</Text>
              <Text style={styles.pageTitle}>A rating for your work</Text>
              <Text style={styles.introText} numberOfLines={1}>New rating from {reviewerTitle.toLowerCase()}</Text>
            </View>
          </View>

          <Pressable
            onPress={openJobOverview}
            disabled={!data.jobId}
            accessibilityRole="button"
            accessibilityLabel="View job overview"
            style={({ pressed }) => [styles.jobCard, pressed && data.jobId && styles.pressed]}
          >
            <View style={styles.jobTopLine}>
              <Text style={styles.jobEyebrow}>{data.jobOverview?.categoryName || "WORK OPPORTUNITY"}</Text>
              <View style={styles.completedBadge}>
                <View style={styles.completedDot} />
                <Text style={styles.completedText}>Completed</Text>
              </View>
            </View>
            <View style={styles.jobInfoPanel}>
              <View style={styles.jobIdentity}>
                <Text style={styles.jobTitle}>{data.title}</Text>
                <View style={styles.locationLine}>
                  <Ionicons name="location-outline" size={16} color={muted} />
                  <Text style={styles.locationText} numberOfLines={1}>{data.area || "Location not available"}</Text>
                </View>
              </View>
              {!!data.jobId && <View style={styles.jobBottomLine}><Text style={styles.overviewLinkText}>Job overview</Text><Ionicons name="chevron-forward" size={15} color={green} /></View>}
            </View>
          </Pressable>

          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                {data.otherPhotoUrl ? (
                  <AppImage source={{ uri: data.otherPhotoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarInitials}>{reviewerInitials}</Text>
                )}
                {reviewerRole === "provider" && data.otherPhoneVerified && (
                  <View style={styles.avatarVerifiedBadge}>
                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={styles.profileIdentity}>
                <View style={styles.nameLine}>
                  <Text style={styles.profileName} numberOfLines={1}>{data.otherName || reviewerTitle}</Text>
                </View>
                {reviewerRole !== "provider" && (
                  <Text style={styles.memberText} numberOfLines={1}>{reviewerTitle} · {memberSince(data.otherCreatedAt)}</Text>
                )}
                {!!data.distanceKm && <View style={styles.distancePill}><Ionicons name="navigate-outline" size={12} color="#087653" /><Text style={styles.distanceText}>{data.distanceKm} km away</Text></View>}
              </View>
              <Pressable onPress={openReviewerProfile} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={`View ${reviewerTitle.toLowerCase()} profile`}>
                <Text style={styles.profileButtonText}>Profile</Text>
                <Ionicons name="chevron-forward" size={15} color={green} />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <View style={styles.statValueLine}><Ionicons name="star" size={14} color="#D99A22" /><Text style={styles.statValue}>{data.otherRating != null ? Number(data.otherRating).toFixed(1) : "New"}</Text></View>
                <Text style={styles.statLabel}>{data.otherTotalReviews || 0} reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={styles.statValueLine}><Ionicons name="briefcase" size={14} color={green} /><Text style={styles.statValue}>{data.otherCompletedCount || 0}</Text></View>
                <Text style={styles.statLabel}>Jobs done</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={styles.statValueLine}><Ionicons name="shield-checkmark" size={14} color={green} /><Text style={styles.statValue}>{data.otherCompletionRate != null ? `${data.otherCompletionRate}%` : "—"}</Text></View>
                <Text style={styles.statLabel}>Reliable</Text>
              </View>
            </View>
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingHeadingRow}>
              <View>
                <Text style={styles.sectionEyebrow}>THEIR REVIEW OF YOU</Text>
                <Text style={styles.ratingSectionTitle} numberOfLines={1}>From {data.receivedReview?.authorName || data.otherName || "reviewer"}</Text>
              </View>
              {data.receivedReview && <View style={styles.ratingScore}><Text style={styles.ratingScoreText}>{score.toFixed(1)}</Text><Text style={styles.ratingOutOf}> out of 5</Text></View>}
            </View>
            {data.receivedReview ? (
              <>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name={star <= score ? "star" : "star-outline"} size={23} color={star <= score ? "#E3A62F" : "#CAD2CC"} />
                  ))}
                </View>
                <View style={styles.feedbackBox}>
                  <Ionicons name="chatbox-ellipses-outline" size={17} color="#718078" />
                  <Text style={styles.feedbackText}>
                    {data.receivedReview.body?.trim() || "No written feedback was included."}
                  </Text>
                </View>
                <View style={styles.reviewFooter}>
                  <View style={styles.reviewAuthor}><Ionicons name="person-circle-outline" size={16} color="#718078" /><Text style={styles.reviewAuthorText}>From {data.receivedReview.authorName || data.otherName || reviewerTitle} · about you</Text></View>
                  <Text style={styles.reviewDate}>{reviewDate(data.receivedReview.createdAt)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.reviewUnavailable}>
                <Ionicons name="cloud-offline-outline" size={17} color="#728078" />
                <Text style={styles.reviewUnavailableText}>Their rating details aren’t available right now.</Text>
                <Pressable onPress={() => void ratingQuery.refetch()} accessibilityRole="button"><Text style={styles.reviewRetryText}>Retry</Text></Pressable>
              </View>
            )}
          </View>

          <RateReviewerCard
            interactionId={interactionId}
            reviewerName={data.otherName || reviewerTitle}
            reviewed={Boolean(data.reviewed)}
            savedReview={data.myReview}
            onRated={() => ratingQuery.refetch()}
          />
        </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const ink = "#1B2E25";
const green = "#087653";
const muted = "#758279";
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#123D2D" },
  screen: { flex: 1, backgroundColor: "#F7F8F7" },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, backgroundColor: "#123D2D", borderBottomWidth: 1, borderBottomColor: "#123D2D" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, minWidth: 0, color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginLeft: 4 },
  headerSpacer: { width: 20 },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  rateFormCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E5ECE7", padding: 16, gap: 11, shadowColor: "#173829", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 9, elevation: 1 },
  rateFormHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EEF2EF" },
  rateIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF3D9" },
  rateCopy: { flex: 1, minWidth: 0, gap: 3 },
  rateTitle: { color: ink, fontSize: 13, fontWeight: "800" },
  rateSubtitle: { color: muted, fontSize: 10, fontWeight: "500" },
  reviewDirectionLabel: { color: green, fontSize: 9, letterSpacing: 0.8, fontWeight: "800" },
  rateFieldLabel: { color: ink, fontSize: 12, fontWeight: "700", marginTop: 2 },
  optionalLabel: { color: muted, fontSize: 10, fontWeight: "500" },
  rateStarsRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: -3 },
  rateStarButton: { width: 36, height: 38, alignItems: "center", justifyContent: "center" },
  rateStarHint: { color: muted, fontSize: 11, fontWeight: "600", marginLeft: "auto" },
  suggestionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: -3 },
  suggestionChip: { minHeight: 31, paddingHorizontal: 10, justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: "#DDE7E0", backgroundColor: "#FAFCFA" },
  suggestionChipSelected: { backgroundColor: "#EAF5EE", borderColor: "#9BCBAA" },
  suggestionText: { color: "#607067", fontSize: 10, fontWeight: "600" },
  suggestionTextSelected: { color: green },
  feedbackInput: { minHeight: 86, maxHeight: 140, borderRadius: 13, borderWidth: 1, borderColor: "#E1E8E3", backgroundColor: "#FBFCFB", paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, color: ink, fontSize: 13, lineHeight: 19 },
  reviewSubmitError: { color: "#A73B32", fontSize: 12, lineHeight: 17 },
  submitReviewButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, backgroundColor: green, marginTop: 1 },
  submitReviewDisabled: { backgroundColor: "#A7B9AE" },
  submitReviewText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  reviewSuccessCard: { gap: 12, padding: 14, borderRadius: 17, backgroundColor: "#F0F8F2", borderWidth: 1, borderColor: "#CFE5D5" },
  reviewSuccessHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  reviewSuccessIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#DCEFE2" },
  savedReviewDetails: { paddingTop: 11, borderTopWidth: 1, borderTopColor: "#D9EADD", gap: 9 },
  savedReviewStars: { flexDirection: "row", alignItems: "center", gap: 3 },
  savedReviewScore: { marginLeft: 5, color: ink, fontSize: 12, fontWeight: "800" },
  savedFeedbackBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.72)" },
  savedFeedbackText: { flex: 1, color: "#41534A", fontSize: 12, lineHeight: 18 },
  reviewUnavailable: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: "#F7F9F7" },
  reviewUnavailableText: { flex: 1, color: "#627168", fontSize: 11, lineHeight: 16 },
  reviewRetryText: { color: green, fontSize: 11, fontWeight: "700" },
  ratedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: "#E0F1E5", borderWidth: 1, borderColor: "#C8E3D0" },
  ratedPillText: { color: green, fontSize: 11, fontWeight: "700" },
  intro: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  introIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFF4DE", alignItems: "center", justifyContent: "center" },
  introCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#A66A12", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  pageTitle: { color: ink, fontSize: 19, lineHeight: 25, fontWeight: "800", letterSpacing: -0.3, marginTop: 2 },
  introText: { color: muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  jobCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E8ECE9", padding: 17, shadowColor: "#173829", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  jobTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 11 },
  jobEyebrow: { flex: 1, color: "#7C8981", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  completedBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#F2E9FF" },
  completedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7C3AED" },
  completedText: { color: "#6B21A8", fontSize: 10, fontWeight: "700" },
  jobInfoPanel: { backgroundColor: "#F7FAF8", borderWidth: 1, borderColor: "#E2EBE5", borderRadius: 15, padding: 13 },
  jobIdentity: { gap: 7 },
  jobTitle: { color: ink, fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.45 },
  jobBottomLine: { marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#E6ECE8", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  locationLine: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  locationText: { flex: 1, color: muted, fontSize: 12, fontWeight: "600" },
  overviewLinkText: { color: green, fontSize: 11, fontWeight: "700" },
  profileCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8ECE9", borderRadius: 20, padding: 15, shadowColor: "#173829", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: "visible", backgroundColor: "#E5F2EB", alignItems: "center", justifyContent: "center" },
  avatarVerifiedBadge: { position: "absolute", right: -1, bottom: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: green, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: green, fontSize: 17, fontWeight: "800" },
  profileIdentity: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { flexShrink: 1, color: ink, fontSize: 15, fontWeight: "800" },
  memberText: { color: muted, fontSize: 11, marginTop: 3 },
  distancePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: "#EFF8F2" },
  distanceText: { color: green, fontSize: 10, fontWeight: "600" },
  profileButton: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11, backgroundColor: "#F1F7F3" },
  profileButtonText: { color: green, fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 15, paddingVertical: 11, borderRadius: 14, backgroundColor: "#F7F9F8" },
  statCell: { flex: 1, alignItems: "center", gap: 3 },
  statValueLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { color: ink, fontSize: 13, fontWeight: "800" },
  statLabel: { color: muted, fontSize: 9, fontWeight: "600", textAlign: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "#E3E9E5" },
  ratingCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8ECE9", borderRadius: 20, padding: 17, shadowColor: "#173829", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  ratingHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionEyebrow: { color: "#7A8880", fontSize: 9, letterSpacing: 1.05, fontWeight: "800" },
  ratingSectionTitle: { color: ink, fontSize: 16, fontWeight: "800", marginTop: 4 },
  ratingScore: { flexDirection: "row", alignItems: "baseline" },
  ratingScoreText: { color: ink, fontSize: 22, fontWeight: "800" },
  ratingOutOf: { color: muted, fontSize: 11, fontWeight: "600" },
  starsRow: { flexDirection: "row", gap: 5, marginTop: 13 },
  feedbackBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, marginTop: 14, borderRadius: 13, backgroundColor: "#F7F9F8" },
  feedbackText: { flex: 1, color: "#41534A", fontSize: 13, lineHeight: 20 },
  reviewFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  reviewAuthor: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  reviewAuthorText: { color: muted, fontSize: 10, fontWeight: "600" },
  reviewDate: { color: "#89958E", fontSize: 10 },
  pressed: { opacity: 0.8 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  stateIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#FFF0ED", alignItems: "center", justifyContent: "center" },
  stateTitle: { color: ink, fontSize: 16, fontWeight: "700" },
  stateText: { color: muted, fontSize: 13, textAlign: "center" },
  retryButton: { marginTop: 7, borderRadius: 12, backgroundColor: green, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
