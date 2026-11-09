import { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "../../../components/ui";
import { ServiceProfileViewSkeleton } from "../../../components/SkeletonLoader";
import { MyServiceCollection } from "./MyServiceCollection";
import { ServiceGrowthSheet } from "./ServiceGrowthSheet";
import type { ServiceRoleData, ServiceFeedbackReview } from "../types";

// Enable LayoutAnimation on Android for the Legacy Architecture only.
// The New Architecture (Fabric) makes this call a no-op and emits a console
// warning, so guard against it using the presence of nativeFabricUIManager
// (set by Fabric) or the __fbBatchedBridgeConfig sentinel (not set by Fabric).
if (
  Platform.OS === "android" &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === "function" &&
  !(global as any).nativeFabricUIManager
) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Legacy API unavailable in this architecture — safe to ignore.
  }
}

function formatReviewDate(timestamp?: number): string {
  if (!timestamp) return "Recently";
  const time = timestamp * (timestamp < 1e11 ? 1000 : 1);
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
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(time).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name?: string): string {
  if (!name) return "C";
  const trimmed = name.trim();
  if (!trimmed) return "C";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0].charAt(0);
    const second = parts[1].charAt(0);
    return `${first}${second}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function ServiceProfileView({
  data,
  isOwner = true,
  loading = false,
  error,
  onRetry,
  initialServiceId,
}: {
  data?: ServiceRoleData;
  isOwner?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  initialServiceId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"rating" | "feedback">("rating");
  const [filterRating, setFilterRating] = useState<"all" | "5">("all");
  const [showAllCustomerReviews, setShowAllCustomerReviews] = useState(false);
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

  const [growthSheetOpen, setGrowthSheetOpen] = useState(false);
  const [growExpanded, setGrowExpanded] = useState(false);
  const growAnimation = useRef(new Animated.Value(0)).current;

  const toggleGrowExpanded = () => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    const toValue = growExpanded ? 0 : 1;
    setGrowExpanded((prev) => !prev);
    Animated.timing(growAnimation, {
      toValue,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const chevronRotate = growAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const services = data?.services || [];
  const activeServices = services.filter((s) => s.available).length;
  const pausedServices = services.length - activeServices;
  const completedServices =
    data?.completed ||
    services.reduce((total, s) => total + (s.completedBookings || 0), 0);
  const hasReviews = (data?.totalReviews || 0) > 0 && data?.rating !== null;
  const activeRequests = data?.activeRequests || 0;
  const pendingRequests = data?.pendingRequests || 0;
  const totalPipelineRequests = activeRequests + pendingRequests;

  // Star distribution breakdown
  const dist = data?.starDistribution || {
    stars5: 0,
    stars4: 0,
    stars3: 0,
    stars2: 0,
    stars1: 0,
  };

  // All reviews across all service offerings
  const allReviews: (ServiceFeedbackReview & { serviceTitle: string })[] =
    data?.recentFeedback || [];

  const totalRev = data?.totalReviews ?? allReviews.length;
  const hasRating = totalRev > 0 && data?.rating != null;
  const s5 = dist.stars5 ?? (hasRating ? totalRev : 0);
  const s4 = dist.stars4 ?? 0;
  const s3 = dist.stars3 ?? 0;
  const p5 = totalRev > 0 ? Math.round((s5 / totalRev) * 100) : 0;
  const p4 = totalRev > 0 ? Math.round((s4 / totalRev) * 100) : 0;
  const p3 = totalRev > 0 ? Math.round((s3 / totalRev) * 100) : 0;

  const reviewsToDisplay = useMemo(() => {
    return filterRating === "5"
      ? allReviews.filter((r) => Number(r.stars) === 5 || Math.round(Number(r.stars)) === 5)
      : allReviews;
  }, [allReviews, filterRating]);

  const visibleCustomerReviews = showAllCustomerReviews
    ? reviewsToDisplay
    : reviewsToDisplay.slice(0, 5);

  // Dynamic growth suggestions based on real metrics
  const suggestions = useMemo(() => {
    const list: {
      id: string;
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      desc: string;
      tag?: string;
      priority: number;
    }[] = [];

    if (services.length === 0) {
      list.push({
        id: "create_first_service",
        icon: "add-circle",
        title: "List your first service",
        desc: "Set price & area to start getting customer calls",
        tag: "Get Started",
        priority: 1,
      });
    }

    if (pausedServices > 0) {
      list.push({
        id: "paused_services",
        icon: "play-circle",
        title: `Resume ${pausedServices} paused listing${pausedServices > 1 ? "s" : ""}`,
        desc: "Make services active so clients can find you",
        tag: "Visibility",
        priority: 2,
      });
    }

    const missingPhotos = services.find(
      (s) => !s.portfolioUrls || s.portfolioUrls.length === 0,
    );
    if (missingPhotos) {
      list.push({
        id: "add_portfolio_photos",
        icon: "images",
        title: "Add real photos of work",
        desc: "Listings with real photos get 3x more bookings",
        tag: "3x Leads",
        priority: 3,
      });
    }

    const missingOfferings = services.find(
      (s) => !s.offerings || s.offerings.length === 0,
    );
    if (missingOfferings) {
      list.push({
        id: "add_pricing_tiers",
        icon: "pricetag",
        title: "Add package pricing",
        desc: "Clear prices reduce customer hesitation by 70%",
        tag: "High Impact",
        priority: 4,
      });
    }

    const phoneHiddenService = services.find((s) => !s.phoneVisible);
    if (phoneHiddenService) {
      list.push({
        id: "enable_phone",
        icon: "call",
        title: "Show direct calling number",
        desc: "Urgent clients prefer calling immediately",
        tag: "More Calls",
        priority: 5,
      });
    }

    const missingHours = services.find(
      (s) => !s.operatingHours || s.operatingHours === "",
    );
    if (missingHours) {
      list.push({
        id: "set_operating_hours",
        icon: "time",
        title: "Set operating hours & days",
        desc: "Clear working hours prevent missed booking calls",
        tag: "Trust",
        priority: 6,
      });
    }

    if (completedServices > 0 && (data?.totalReviews || 0) < 5) {
      list.push({
        id: "collect_reviews",
        icon: "star",
        title: "Request 5★ client reviews",
        desc: "Past client ratings unlock your Top Rated badge",
        tag: "Top Rated",
        priority: 7,
      });
    }

    const smallRadiusService = services.find((s) => (s.radiusKm || 0) < 20);
    if (smallRadiusService) {
      list.push({
        id: "expand_radius",
        icon: "navigate-circle",
        title: "Expand coverage to 20+ km",
        desc: "Wider radius connects you with 2x more clients",
        tag: "2x Reach",
        priority: 8,
      });
    }

    // Always include response time best practice
    list.push({
      id: "fast_response",
      icon: "flash",
      title: "Reply within 15 minutes",
      desc: "Prompt replies convert 80% more inquiries",
      tag: "+80% Jobs",
      priority: 9,
    });

    list.sort((a, b) => a.priority - b.priority);
    return list.slice(0, 4);
  }, [
    services,
    pausedServices,
    completedServices,
    data?.totalReviews,
    data?.radiusKm,
  ]);

  if (loading) {
    return <ServiceProfileViewSkeleton />;
  }

  if (error || !data) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Service Profile</Text>
        <Text style={styles.cardSubtitle}>
          {error || "Service profile data is currently unavailable."}
        </Text>
        {!!onRetry && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retryButton}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.actionPrimaryText}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── 1. Live Service Business Performance Dashboard ────────────────── */}
      <View style={styles.perfCard}>
        {/* Header: Title + Live Status */}
        <View style={styles.perfHeader}>
          <View style={styles.perfTitleRow}>
            <Ionicons name="stats-chart" size={14} color="#047857" />
            <Text style={styles.perfTitle}>Performance</Text>
          </View>
          <View style={[styles.perfStatusPill, activeServices > 0 ? styles.perfStatusPillActive : styles.perfStatusPillPaused]}>
            <View style={[styles.perfStatusDot, { backgroundColor: activeServices > 0 ? "#10B981" : "#F59E0B" }]} />
            <Text style={[styles.perfStatusText, { color: activeServices > 0 ? "#047857" : "#B45309" }]}>
              {activeServices > 0 ? "Accepting Bookings" : "Paused"}
            </Text>
          </View>
        </View>

        {/* 2 Micro-Tiles: Total Services & Services Completed */}
        <View style={styles.perfTilesRow}>
          {/* Tile 1: Total Services */}
          <View style={styles.perfTile}>
            <View style={[styles.perfTileIconBox, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="storefront-outline" size={16} color="#047857" />
            </View>
            <View style={styles.perfTileTextCol}>
              <Text style={styles.perfTileVal}>{services.length}</Text>
              <Text style={styles.perfTileLabel} numberOfLines={1}>Total Services</Text>
            </View>
          </View>

          {/* Tile 2: Services Completed */}
          <View style={styles.perfTile}>
            <View style={[styles.perfTileIconBox, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="checkmark-done-circle-outline" size={17} color="#059669" />
            </View>
            <View style={styles.perfTileTextCol}>
              <Text style={styles.perfTileVal}>{completedServices}</Text>
              <Text style={styles.perfTileLabel} numberOfLines={1}>Services Completed</Text>
            </View>
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
            Rating ({hasRating ? data?.rating!.toFixed(1) : "New"})
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show customer feedback"
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
          {/* ── 3A. Slide 1: Service Business Rating & Trust Showcase ─── */}
          <View style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View>
                  <View style={styles.reputationHeaderRow}>
                    <Text style={styles.cardTitle}>Business Reputation</Text>
                    <View style={styles.trustShield}>
                      <Ionicons name="shield-checkmark" size={12} color="#075B43" />
                      <Text style={styles.trustShieldText}>Verified Service</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    {totalRev > 0
                      ? `Calculated from ${totalRev} verified customer review${totalRev === 1 ? "" : "s"}`
                      : "Customer ratings appear here after completed service bookings."}
                  </Text>
                </View>
              </View>

              {/* Strong, Simple Rating Hero */}
              <View style={styles.ratingHero}>
                {/* Left: Score & Stars */}
                <View style={styles.scoreBlock}>
                  <Text style={styles.ratingBigNumber}>
                    {hasRating ? data?.rating!.toFixed(1) : "New"}
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={hasRating && star <= Math.round(data?.rating || 0) ? "star" : "star-outline"}
                        size={17}
                        color={hasRating && star <= Math.round(data?.rating || 0) ? "#F59E0B" : "#AAB5AE"}
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewCountText}>
                    {totalRev > 0
                      ? `${totalRev} verified customer rating${totalRev === 1 ? "" : "s"}`
                      : "No customer ratings yet"}
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
                          { width: `${totalRev > 0 ? p5 : 0}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.distPctText}>
                      {totalRev > 0 ? `${p5}%` : "0%"}
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
            </View>
          </View>

          {/* ── 3B. Slide 2: Customer Feedback & Reviews ─────────── */}
          <View style={[styles.slidePane, viewportWidth > 0 && { width: viewportWidth }]}>
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.cardTitle}>Customer Feedback</Text>
                  <Text style={styles.cardSubtitle}>Direct reviews from completed service bookings</Text>
                </View>
                {allReviews.length > 0 && (
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
                        All ({allReviews.length})
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
                        ★ 5.0 ({s5})
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {reviewsToDisplay.length === 0 ? (
                <View style={styles.emptyReviewsBlock}>
                  <View style={styles.emptyReviewsIconCircle}>
                    <Ionicons name="chatbubbles-outline" size={26} color="#075B43" />
                  </View>
                  <Text style={styles.emptyReviewsTitle}>No Customer Reviews Yet</Text>
                  <Text style={styles.emptyReviewsSub}>
                    When customers complete service bookings, their verified ratings and reviews will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.reviewsList}>
                  {visibleCustomerReviews.map((rev, index) => (
                    <View
                      key={rev.id || index}
                      style={[
                        styles.reviewItem,
                        index < visibleCustomerReviews.length - 1 && styles.reviewDivider,
                      ]}
                    >
                      <View style={styles.reviewHeader}>
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerInitial}>
                            {(rev.authorName || "C").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={styles.customerName}>{rev.authorName || "Customer"}</Text>
                            <View style={styles.verifiedCustomerBadge}>
                              <Ionicons name="checkmark-circle" size={11} color="#075B43" />
                              <Text style={styles.verifiedCustomerText}>Verified Customer</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <View style={styles.reviewServiceTagBadge}>
                              <Ionicons name="pricetag-outline" size={9} color="#047857" />
                              <Text style={styles.reviewServiceTagText} numberOfLines={1}>
                                {rev.serviceTitle || "Service"}
                              </Text>
                            </View>
                            <Text style={styles.reviewDateText}>• {formatReviewDate(rev.createdAt)}</Text>
                          </View>
                        </View>
                        <View style={styles.starsPill}>
                          <Ionicons name="star" size={12} color="#F5B928" />
                          <Text style={styles.starsPillText}>{rev.stars?.toFixed(1) || "5.0"}</Text>
                        </View>
                      </View>
                      {rev.body?.trim() ? (
                        <Text style={styles.reviewBody}>{rev.body.trim()}</Text>
                      ) : null}
                    </View>
                  ))}

                  {reviewsToDisplay.length > 5 && (
                    <Pressable
                      onPress={() => setShowAllCustomerReviews(!showAllCustomerReviews)}
                      style={styles.expandReviewsBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.expandReviewsText}>
                        {showAllCustomerReviews ? "Show fewer reviews" : `Show all ${reviewsToDisplay.length} reviews`}
                      </Text>
                      <Ionicons
                        name={showAllCustomerReviews ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="#047857"
                      />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* ── 3. My Services Collection & Listings Management ───────────────── */}
      <MyServiceCollection
        services={services}
        initialServiceId={initialServiceId}
      />

      {/* ── 4. Ways to Grow Your Business (Collapsible Accordion Dropdown) ── */}
      {isOwner && suggestions.length > 0 && (
        <View style={styles.growCard}>
          <Pressable
            onPress={toggleGrowExpanded}
            android_ripple={{ color: "rgba(4, 120, 87, 0.06)" }}
            accessibilityRole="button"
            accessibilityLabel="Ways to grow your business recommendations"
            accessibilityState={{ expanded: growExpanded }}
          >
            <View style={styles.growHeaderRow}>
              <View style={styles.growIconCircle}>
                <Ionicons name="sparkles" size={18} color="#D97706" />
              </View>

              <View style={styles.growTextCol}>
                <Text style={styles.growTitle}>Ways to Grow Your Business</Text>
                <Text style={styles.growSubtitle} numberOfLines={1}>
                  {growExpanded
                    ? "Tap recommendations below to optimize listings"
                    : `${suggestions.length} recommendations to boost your ranking`}
                </Text>
              </View>

              <View style={styles.growBadgePill}>
                <Text style={styles.growBadgeText}>{suggestions.length} Steps</Text>
                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                  <Ionicons name="chevron-down" size={14} color="#047857" />
                </Animated.View>
              </View>
            </View>
          </Pressable>

          {growExpanded && (
            <Animated.View style={[styles.growContent, { opacity: growAnimation }]}>
              <View style={styles.growDivider} />
              <View style={styles.growList}>
                {suggestions.map((item) => (
                  <View key={item.id} style={styles.growSimpleRow}>
                    <View style={styles.growSimpleIcon}>
                      <Ionicons name={item.icon} size={16} color="#047857" />
                    </View>
                    <View style={styles.growSimpleTextCol}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.growSimpleTitle}>{item.title}</Text>
                        {item.tag ? (
                          <View style={styles.growItemTagBadge}>
                            <Text style={styles.growItemTagText}>{item.tag}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.growSimpleDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.growTipBanner}>
                <Ionicons name="bulb-outline" size={16} color="#047857" />
                <Text style={styles.growTipText}>
                  Active providers with verified ratings and transparent pricing convert 4x more customer bookings.
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {growthSheetOpen && (
        <ServiceGrowthSheet
          services={services}
          onClose={() => setGrowthSheetOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 3,
    lineHeight: 16,
  },
  perfCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "#EAEFEA",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  perfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  perfTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perfTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  perfStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
  },
  perfStatusPillActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  perfStatusPillPaused: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  perfStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  perfStatusText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  perfTilesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perfTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAF8",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#EAEFEA",
    gap: 8,
  },
  perfTileIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  perfTileTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  perfTileVal: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  perfTileLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    lineHeight: 14,
    marginTop: 1,
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
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  customerInitial: {
    fontSize: 13,
    fontWeight: "800",
    color: "#075B43",
  },
  customerName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  verifiedCustomerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  verifiedCustomerText: {
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
  expandReviewsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#F1F7F3",
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#D9E9DF",
  },
  expandReviewsText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#075B43",
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
  reviewServiceTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160,
  },
  reviewServiceTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  reviewDateText: {
    fontSize: 10.5,
    color: colors.mutedLight,
    fontWeight: "500",
  },
  growCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 4,
  },
  growHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    width: "100%",
  },
  growIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  growTextCol: {
    flex: 1,
    minWidth: 0,
  },
  growTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  growSubtitle: {
    fontSize: 11.5,
    color: colors.mutedLight,
    marginTop: 2,
    lineHeight: 15,
  },
  growBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  growBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  growContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  growDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  growList: {
    gap: 8,
  },
  growSimpleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFBF9",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF3EF",
    gap: 10,
  },
  growSimpleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  growSimpleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  growSimpleTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.ink,
  },
  growItemTagBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  growItemTagText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#B45309",
  },
  growSimpleDesc: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  growTipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginTop: 12,
  },
  growTipText: {
    flex: 1,
    fontSize: 11,
    color: "#166534",
    lineHeight: 15,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#047857",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
