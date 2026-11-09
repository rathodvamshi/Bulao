import { useRef, useState } from "react";
import { Animated, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../components/ui";
import type { CommonProfileData, SeekerRoleData } from "../types";

type ProfileTab = "rating" | "feedback";

export function SeekerProfileView({
  data,
  profile,
  isOwner = true,
}: {
  data: SeekerRoleData;
  profile?: CommonProfileData;
  isOwner?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("rating");
  const [filterRating, setFilterRating] = useState<"all" | "5">("all");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [ratingPanelHeight, setRatingPanelHeight] = useState(0);
  const [feedbackPanelHeight, setFeedbackPanelHeight] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const panelHeight = useRef(new Animated.Value(0)).current;
  const hasRating = data.totalReviews > 0 && data.rating !== null;
  const reviews = data.reviews.filter((review) => review.body.trim().length > 0);
  const filteredReviews = filterRating === "5" ? reviews.filter((review) => review.stars === 5) : reviews;
  const visibleReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, 3);
  const stars = [5, 4, 3, 2, 1] as const;
  const suggestion = data.completed === 0
    ? "Complete your first job to start building your work history."
    : data.totalReviews === 0
      ? "Ask your employer for feedback after your next completed job."
      : hasRating && data.rating! >= 4.5
        ? "Your strong feedback can help your next application stand out."
        : "Keep your work history growing by collecting feedback after each job.";

  const selectTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    const targetHeight = tab === "rating" ? ratingPanelHeight : feedbackPanelHeight;
    Animated.parallel([
      Animated.spring(slide, {
        toValue: tab === "rating" ? 0 : 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(panelHeight, { toValue: targetHeight, duration: 220, useNativeDriver: false }),
    ]).start();
  };

  const measurePanel = (tab: ProfileTab, height: number) => {
    if (tab === "rating") setRatingPanelHeight(height);
    else setFeedbackPanelHeight(height);
    const previousHeight = tab === "rating" ? ratingPanelHeight : feedbackPanelHeight;
    if (tab === activeTab && previousHeight === 0) {
      panelHeight.setValue(height);
    } else if (tab === activeTab && Math.abs(previousHeight - height) > 1) {
      Animated.timing(panelHeight, { toValue: height, duration: 180, useNativeDriver: false }).start();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleGroup}>
            <Text style={styles.eyebrow}>SEEKER PROFILE</Text>
            <Text style={styles.summaryTitle}>Your work, recognized</Text>
          </View>
          <View style={styles.workerPill}>
            <Ionicons name="person-outline" size={12} color="#FFFFFF" />
            <Text style={styles.workerPillText}>Worker</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.completed}</Text>
            <Text style={styles.statLabel}>Completed jobs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.totalReviews}</Text>
            <Text style={styles.statLabel}>Employer feedback</Text>
          </View>
        </View>

        {isOwner ? (
          <View style={styles.suggestionRow}>
            <Ionicons name="bulb-outline" size={15} color="#FFFFFF" />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.segment} onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}>
        {segmentWidth > 0 ? (
          <Animated.View
            style={[
              styles.activeSegment,
              {
                width: (segmentWidth - 8) / 2,
                transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, (segmentWidth - 8) / 2] }) }],
              },
            ]}
          />
        ) : null}
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === "rating" }} onPress={() => selectTab("rating")} style={styles.segmentButton}>
          <Ionicons name="star" size={15} color={activeTab === "rating" ? "#FFFFFF" : "#176B58"} />
          <Text style={[styles.segmentText, activeTab === "rating" && styles.segmentTextSelected]}>
            Rating ({hasRating ? data.rating!.toFixed(1) : "New"})
          </Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === "feedback" }} onPress={() => selectTab("feedback")} style={styles.segmentButton}>
          <Ionicons name="chatbubbles-outline" size={15} color={activeTab === "feedback" ? "#FFFFFF" : "#176B58"} />
          <Text style={[styles.segmentText, activeTab === "feedback" && styles.segmentTextSelected]}>
            Feedback ({data.totalReviews})
          </Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.sliderViewport, { height: panelHeight }]}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.sliderTrack,
            viewportWidth > 0 && {
              width: viewportWidth * 2,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -viewportWidth] }) }],
            },
          ]}
        >
          <View onLayout={(event) => measurePanel("rating", event.nativeEvent.layout.height)} style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
            <View style={styles.detailCard}>
              <View style={styles.panelHeader}>
                <View style={styles.panelHeaderText}>
                  <View style={styles.titleAndBadge}>
                    <Text style={styles.panelTitle}>Worker reputation</Text>
                    {profile?.phoneVerified ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.panelSubtitle}>Ratings from employers after completed jobs</Text>
                </View>
              </View>

              <View style={styles.ratingSummary}>
                <View style={styles.scoreBlock}>
                  <Text style={styles.ratingValue}>{hasRating ? data.rating!.toFixed(1) : "New"}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = hasRating && star <= Math.round(data.rating!);
                      return <Ionicons key={star} name={filled ? "star" : "star-outline"} size={14} color={filled ? "#E6AD32" : "#B8C2BB"} />;
                    })}
                  </View>
                  <Text style={styles.ratingCount}>{data.totalReviews ? `${data.totalReviews} ${data.totalReviews === 1 ? "rating" : "ratings"}` : "No employer ratings yet"}</Text>
                </View>
                <View style={styles.distribution}>
                  {stars.map((star) => {
                    const count = data.starDistribution?.[`stars${star}` as keyof NonNullable<SeekerRoleData["starDistribution"]>] ?? 0;
                    const percent = data.totalReviews ? Math.round((count / data.totalReviews) * 100) : 0;
                    return (
                      <View key={star} style={styles.distributionRow}>
                        <Text style={styles.starLabel}>{star} ★</Text>
                        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${percent}%` }]} /></View>
                        <Text style={styles.percentLabel}>{percent}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <View onLayout={(event) => measurePanel("feedback", event.nativeEvent.layout.height)} style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
            <View style={styles.detailCard}>
              <View style={styles.feedbackHeader}>
                <View style={styles.panelHeaderText}>
                  <Text style={styles.panelTitle}>Employer feedback</Text>
                  <Text style={styles.panelSubtitle}>Reviews from your completed jobs</Text>
                </View>
                <View style={styles.filterRow}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: filterRating === "all" }} onPress={() => { setFilterRating("all"); setShowAllReviews(false); }} style={[styles.filterButton, filterRating === "all" && styles.filterButtonSelected]}>
                    <Text style={[styles.filterText, filterRating === "all" && styles.filterTextSelected]}>All</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: filterRating === "5" }} onPress={() => { setFilterRating("5"); setShowAllReviews(false); }} style={[styles.filterButton, filterRating === "5" && styles.filterButtonSelected]}>
                    <Text style={[styles.filterText, filterRating === "5" && styles.filterTextSelected]}>★ 5</Text>
                  </Pressable>
                </View>
              </View>

              {visibleReviews.length ? (
                <>
                  {visibleReviews.map((review, index) => (
                    <View key={review.id || `${review.author}-${index}`} style={[styles.review, index > 0 && styles.reviewDivider]}>
                      <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}><Text style={styles.reviewerInitial}>{(review.author || "E").charAt(0).toUpperCase()}</Text></View>
                        <View style={styles.reviewerInfo}>
                          <Text style={styles.reviewerName} numberOfLines={1}>{review.author || "Employer"}</Text>
                          <View style={styles.verifiedWork}>
                            <Ionicons name="checkmark-circle" size={11} color="#176B58" />
                            <Text style={styles.verifiedWorkText} numberOfLines={1}>{review.jobTitle || "Verified completed job"}</Text>
                          </View>
                        </View>
                        <View style={styles.starsBadge}><Ionicons name="star" size={11} color="#E6AD32" /><Text style={styles.starsBadgeText}>{review.stars}.0</Text></View>
                      </View>
                      <Text style={styles.reviewBody}>{review.body}</Text>
                    </View>
                  ))}
                  {filteredReviews.length > 3 ? (
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllReviews }} onPress={() => setShowAllReviews((showing) => !showing)} style={styles.moreButton}>
                      <Text style={styles.moreButtonText}>{showAllReviews ? "Show fewer reviews" : "Show more feedback"}</Text>
                      <Ionicons name={showAllReviews ? "chevron-up" : "chevron-down"} size={15} color="#176B58" />
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <View style={styles.emptyFeedback}>
                  <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={23} color="#FFFFFF" /></View>
                  <Text style={styles.emptyTitle}>{filterRating === "5" ? "No 5-star feedback yet" : "No employer feedback yet"}</Text>
                  <Text style={styles.emptyDescription}>{filterRating === "5" ? "Choose All to see every review." : "Once you complete a job, verified employer feedback will appear here."}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  summaryCard: { padding: 15, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EAE4" },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  summaryTitleGroup: { flex: 1, gap: 3 },
  eyebrow: { color: "#74877C", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  summaryTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", letterSpacing: -0.35 },
  workerPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#176B58", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  workerPillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#EDF1EE" },
  stat: { flex: 1, minHeight: 42, justifyContent: "center" },
  statValue: { color: colors.ink, fontSize: 22, lineHeight: 26, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { color: "#66756C", fontSize: 10, marginTop: 1 },
  statDivider: { width: 1, height: 32, marginHorizontal: 14, backgroundColor: "#E5EBE6" },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 9, borderRadius: 12, backgroundColor: "#075B43" },
  suggestionText: { flex: 1, color: "#FFFFFF", fontSize: 10, lineHeight: 15 },
  segment: { flexDirection: "row", position: "relative", padding: 4, borderRadius: 15, backgroundColor: "#EEF5F1" },
  activeSegment: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: 11, backgroundColor: "#034E3B", zIndex: 0 },
  segmentButton: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, zIndex: 1 },
  segmentText: { color: "#176B58", fontSize: 11, fontWeight: "800" },
  segmentTextSelected: { color: "#FFFFFF" },
  sliderViewport: { width: "100%", overflow: "hidden" },
  sliderTrack: { flexDirection: "row", alignItems: "flex-start" },
  slidePane: { width: "100%" },
  detailCard: { padding: 15, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EAE4" },
  panelHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  panelHeaderText: { flex: 1, gap: 3 },
  titleAndBadge: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  panelTitle: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "900", letterSpacing: -0.2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: "#176B58" },
  verifiedBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  panelSubtitle: { color: "#718078", fontSize: 10, lineHeight: 14 },
  ratingSummary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: "#F8FAF8", borderWidth: 1, borderColor: "#EDF1EE" },
  scoreBlock: { minWidth: 86, alignItems: "center" },
  ratingValue: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1 },
  starsRow: { flexDirection: "row", gap: 1, marginTop: 2 },
  ratingCount: { color: "#69776E", fontSize: 9, fontWeight: "600", marginTop: 4, textAlign: "center" },
  distribution: { flex: 1, gap: 7 },
  distributionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  starLabel: { width: 24, color: "#44544A", fontSize: 10, fontWeight: "700" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#E7ECE8", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: "#075B43" },
  percentLabel: { width: 28, color: "#6A776F", textAlign: "right", fontSize: 10, fontWeight: "700" },
  feedbackHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 },
  filterRow: { flexDirection: "row", gap: 5 },
  filterButton: { minWidth: 35, alignItems: "center", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: "#F1F5F2" },
  filterButtonSelected: { backgroundColor: "#176B58" },
  filterText: { color: "#617067", fontSize: 10, fontWeight: "800" },
  filterTextSelected: { color: "#FFFFFF" },
  review: { paddingVertical: 10 },
  reviewDivider: { borderTopWidth: 1, borderTopColor: "#E9EEEA" },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
  reviewerAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#176B58" },
  reviewerInitial: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  reviewerInfo: { flex: 1, gap: 2 },
  reviewerName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  verifiedWork: { flexDirection: "row", alignItems: "center", gap: 3 },
  verifiedWorkText: { flexShrink: 1, color: "#718078", fontSize: 10 },
  starsBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: "#FBF5E5" },
  starsBadgeText: { color: "#66562C", fontSize: 10, fontWeight: "800" },
  reviewBody: { color: "#526259", fontSize: 11, lineHeight: 16 },
  moreButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 5, borderTopWidth: 1, borderTopColor: "#E9EEEA" },
  moreButtonText: { color: "#176B58", fontSize: 11, fontWeight: "800" },
  emptyFeedback: { minHeight: 170, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, paddingVertical: 20, gap: 8, borderRadius: 16, backgroundColor: "#F5F8F5" },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF24" },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  emptyDescription: { maxWidth: 270, color: "#68766E", fontSize: 11, lineHeight: 17, textAlign: "center" },
});
