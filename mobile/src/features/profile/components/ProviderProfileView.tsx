import { useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "../../../components/ui";
import type { ProviderRoleData } from "../types";

export function ProviderProfileView({
  data,
  isOwner = true,
}: {
  data: ProviderRoleData;
  isOwner?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"rating" | "feedback">("rating");
  const [filterRating, setFilterRating] = useState<"all" | "5">("all");
  const [viewportWidth, setViewportWidth] = useState(0);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleTabChange = (tab: "rating" | "feedback") => {
    setActiveTab(tab);
    Animated.spring(slideAnim, {
      toValue: tab === "rating" ? 0 : 1,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const totalRev = data.totalReviews ?? data.reviews.length;
  const hasRating = totalRev > 0 && data.rating != null;

  const s5 = data.starDistribution?.stars5 ?? (hasRating ? totalRev : 0);
  const s4 = data.starDistribution?.stars4 ?? 0;
  const s3 = data.starDistribution?.stars3 ?? 0;
  const p5 = totalRev > 0 ? Math.round((s5 / totalRev) * 100) : 0;
  const p4 = totalRev > 0 ? Math.round((s4 / totalRev) * 100) : 0;
  const p3 = totalRev > 0 ? Math.round((s3 / totalRev) * 100) : 0;

  const reviewsToDisplay =
    filterRating === "5"
      ? data.reviews.filter((r) => r.stars === 5)
      : data.reviews;

  return (
    <View style={styles.container}>
      {/* ── 1. Hiring Overview (Directly Below User Card) ───────────────── */}
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Hiring Overview</Text>
          <View style={styles.activePill}>
            <View style={styles.greenPulse} />
            <Text style={styles.activePillText}>Actively Hiring</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconCircle}>
              <Ionicons name="document-text-outline" size={16} color="#075B43" />
            </View>
            <Text style={styles.statNumber}>{data.jobsPosted ?? 0}</Text>
            <Text style={styles.statLabel}>Total Posted</Text>
          </View>

          <View style={[styles.statBox, styles.statBoxHighlight]}>
            <View style={[styles.statIconCircle, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="pulse" size={16} color="#059669" />
            </View>
            <Text style={[styles.statNumber, { color: "#059669" }]}>
              {data.active ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: "#059669" }]}>Active Now</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="people-outline" size={16} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{data.hired ?? 0}</Text>
            <Text style={styles.statLabel}>Workers Hired</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconCircle}>
              <Ionicons name="checkmark-done-outline" size={16} color="#075B43" />
            </View>
            <Text style={styles.statNumber}>{data.completed ?? 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* ── 2. Side-by-Side Segmented Buttons (Rating vs Feedback with Moving Pill) ── */}
      <View
        style={styles.segmentContainer}
        onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingPill,
              {
                width: (segmentWidth - 8) / 2,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (segmentWidth - 8) / 2],
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show ratings and reputation"
          onPress={() => handleTabChange("rating")}
          style={styles.segmentBtn}
        >
          <Ionicons
            name="star"
            size={16}
            color={activeTab === "rating" ? "#FFFFFF" : "#075B43"}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === "rating" && styles.segmentTextActive,
            ]}
          >
            Rating ({(data.rating ?? 5.0).toFixed(1)} ★)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show worker feedback"
          onPress={() => handleTabChange("feedback")}
          style={styles.segmentBtn}
        >
          <Ionicons
            name="chatbubbles"
            size={16}
            color={activeTab === "feedback" ? "#FFFFFF" : "#075B43"}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === "feedback" && styles.segmentTextActive,
            ]}
          >
            Feedback ({totalRev})
          </Text>
        </Pressable>
      </View>

      {/* ── 3. Moving Window Slide Container ────────────────────────── */}
      <View
        style={styles.sliderViewport}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.sliderTrack,
            viewportWidth > 0 && {
              width: viewportWidth * 2,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -viewportWidth],
                  }),
                },
              ],
            },
          ]}
        >
          {/* ── 3A. Slide 1: Rating & Trust Showcase (5.0 Baseline) ─── */}
          <View style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View>
              <View style={styles.reputationHeaderRow}>
                <Text style={styles.cardTitle}>Hirer Reputation</Text>
                <View style={styles.trustShield}>
                  <Ionicons name="shield-checkmark" size={12} color="#075B43" />
                  <Text style={styles.trustShieldText}>Verified Hirer</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                {totalRev > 0
                  ? `Calculated from ${totalRev} worker review${totalRev === 1 ? "" : "s"}`
                  : "Base rating 5.0 ★ · Updates as worker reviews arrive"}
              </Text>
            </View>
          </View>

          {/* Strong, Simple Rating Hero */}
          <View style={styles.ratingHero}>
            {/* Left: Score & Stars */}
            <View style={styles.scoreBlock}>
              <Text style={styles.ratingBigNumber}>
                {(data.rating ?? 5.0).toFixed(1)}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={17}
                    color={star <= Math.round(data.rating ?? 5.0) ? "#F5B928" : "#E2E8E4"}
                  />
                ))}
              </View>
              <Text style={styles.reviewCountText}>
                {totalRev > 0
                  ? `${totalRev} verified rating${totalRev === 1 ? "" : "s"}`
                  : "Welcome baseline 5.0"}
              </Text>
            </View>

            {/* Right: Distribution Bars */}
            <View style={styles.distributionBlock}>
              <View style={styles.distRow}>
                <Text style={styles.distStarLabel}>5 ★</Text>
                <View style={styles.distBarBg}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${totalRev > 0 ? p5 : 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distPctText}>
                  {totalRev > 0 ? `${p5}%` : "100%"}
                </Text>
              </View>
              <View style={styles.distRow}>
                <Text style={styles.distStarLabel}>4 ★</Text>
                <View style={styles.distBarBg}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${totalRev > 0 ? p4 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distPctText}>
                  {totalRev > 0 ? `${p4}%` : "0%"}
                </Text>
              </View>
              <View style={styles.distRow}>
                <Text style={styles.distStarLabel}>3 ★</Text>
                <View style={styles.distBarBg}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${totalRev > 0 ? p3 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distPctText}>
                  {totalRev > 0 ? `${p3}%` : "0%"}
                </Text>
              </View>
            </View>
          </View>

          {/* Worker Sentiment & Trust Metrics */}
          <View style={styles.complimentsSection}>
            <Text style={styles.complimentsHeader}>TRUST HIGHLIGHTS</Text>
            <View style={styles.complimentsGrid}>
              <View style={styles.complimentPill}>
                <Text style={styles.complimentIcon}>⚡</Text>
                <Text style={styles.complimentLabel}>Prompt Payer</Text>
                <Text style={styles.complimentPct}>99%</Text>
              </View>
              <View style={styles.complimentPill}>
                <Text style={styles.complimentIcon}>🛡️</Text>
                <Text style={styles.complimentLabel}>Safe Worksite</Text>
                <Text style={styles.complimentPct}>98%</Text>
              </View>
              <View style={styles.complimentPill}>
                <Text style={styles.complimentIcon}>🤝</Text>
                <Text style={styles.complimentLabel}>Respectful</Text>
                <Text style={styles.complimentPct}>97%</Text>
              </View>
            </View>
          </View>

          {/* Verified Badges / Trust Credentials */}
          {data.badges && data.badges.length > 0 && (
            <View style={styles.badgesSection}>
              <Text style={styles.complimentsHeader}>VERIFIED TRUST CREDENTIALS</Text>
              <View style={styles.badgesList}>
                {data.badges.map((b) => (
                  <View key={b.id} style={styles.badgeRow}>
                    <View style={styles.badgeIconCircle}>
                      <Text style={styles.badgeEmoji}>{b.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.badgeTitle}>{b.title}</Text>
                      <Text style={styles.badgeDescription}>{b.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── 3B. Slide 2: Worker Feedback & Testimonials ─────────── */}
      <View style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.cardTitle}>Worker Feedback</Text>
              <Text style={styles.cardSubtitle}>Direct feedback from hired workers</Text>
            </View>
            <View style={styles.filterPillsRow}>
              <Pressable
                onPress={() => setFilterRating("all")}
                style={[
                  styles.filterPill,
                  filterRating === "all" && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterRating === "all" && styles.filterPillTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFilterRating("5")}
                style={[
                  styles.filterPill,
                  filterRating === "5" && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterRating === "5" && styles.filterPillTextActive,
                  ]}
                >
                  ★ 5.0
                </Text>
              </Pressable>
            </View>
          </View>

          {reviewsToDisplay.length === 0 ? (
            <View style={styles.emptyReviewsBlock}>
              <View style={styles.emptyReviewsIconCircle}>
                <Ionicons name="chatbubbles-outline" size={26} color="#075B43" />
              </View>
              <Text style={styles.emptyReviewsTitle}>No Worker Feedback Yet</Text>
              <Text style={styles.emptyReviewsSub}>
                When workers complete jobs posted by you, their verified feedback and ratings will show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviewsToDisplay.map((rev, index) => (
                <View
                  key={rev.id || index}
                  style={[
                    styles.reviewItem,
                    index < reviewsToDisplay.length - 1 && styles.reviewDivider,
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerInitial}>
                        {(rev.author || "W").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerName}>{rev.author || "Worker"}</Text>
                      <View style={styles.verifiedWorkBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#075B43" />
                        <Text style={styles.verifiedWorkText}>
                          {rev.jobTitle || "Verified Completion"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.starsPill}>
                      <Ionicons name="star" size={12} color="#F5B928" />
                      <Text style={styles.starsPillText}>{rev.stars}.0</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewBody}>{rev.body}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  </View>
</View>
);
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reputationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  trustShield: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trustShieldText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#075B43",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  activePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#075B43",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#FAFBF9",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF3EF",
  },
  statBoxHighlight: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.mutedLight,
    marginTop: 2,
    textAlign: "center",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#EBF3EE",
    borderRadius: 16,
    padding: 4,
    position: "relative",
  },
  slidingPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: "#075B43",
    borderRadius: 12,
    zIndex: 1,
    shadowColor: "#075B43",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "transparent",
    zIndex: 2,
  },
  segmentBtnActive: {
    // Handled smoothly by slidingPill
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#075B43",
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  sliderViewport: {
    width: "100%",
    overflow: "hidden",
  },
  sliderTrack: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  slidePane: {
    width: "100%",
  },
  ratingHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFBF9",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF3EF",
    gap: 14,
  },
  scoreBlock: {
    alignItems: "center",
    minWidth: 90,
  },
  ratingBigNumber: {
    fontSize: 38,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 3,
  },
  reviewCountText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
  distributionBlock: {
    flex: 1,
    gap: 5,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distStarLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
    width: 22,
  },
  distBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#E8ECE9",
    borderRadius: 3,
    overflow: "hidden",
  },
  distBarFill: {
    height: "100%",
    backgroundColor: "#075B43",
    borderRadius: 3,
  },
  distPctText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    width: 28,
    textAlign: "right",
  },
  complimentsSection: {
    marginTop: 14,
  },
  complimentsHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.mutedLight,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  complimentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  complimentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F7F3",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9E9DF",
  },
  complimentIcon: {
    fontSize: 12,
  },
  complimentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  complimentPct: {
    fontSize: 11,
    fontWeight: "800",
    color: "#075B43",
  },
  badgesSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF3EF",
  },
  badgesList: {
    gap: 10,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAF9",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAEFEA",
  },
  badgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  badgeDescription: {
    fontSize: 11,
    color: colors.mutedLight,
    marginTop: 1,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F1F5F2",
  },
  filterPillActive: {
    backgroundColor: "#075B43",
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  reviewsList: {
    gap: 8,
  },
  reviewItem: {
    paddingVertical: 6,
  },
  reviewDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F1",
    paddingBottom: 10,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  workerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  workerInitial: {
    fontSize: 13,
    fontWeight: "800",
    color: "#075B43",
  },
  workerName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  verifiedWorkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  verifiedWorkText: {
    fontSize: 11,
    color: colors.mutedLight,
  },
  starsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF7E7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  starsPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
  },
  reviewBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  noRatingHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFBF9",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF3EF",
    gap: 14,
  },
  noRatingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  noRatingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  noRatingSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyReviewsBlock: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyReviewsIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyReviewsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  emptyReviewsSub: {
    fontSize: 12,
    color: colors.mutedLight,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 260,
  },
});
