import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppImage as Image } from "../../../../components/AppImage";
import type { ServiceFeedbackReview, StarDistribution } from "../../types";

export type ServiceDetailTab = "rating" | "feedback" | "photos";

export interface ServiceReviewsPhotosSectionProps {
  ratingValue: string;
  totalReviewsCount: number;
  reviewBreakdown: StarDistribution;
  reviews: ServiceFeedbackReview[];
  photos: string[];
  isLoadingReviews?: boolean;
  onOpenRateModal: () => void;
  onOpenImageViewer: (images: string[], initialIndex: number) => void;
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
  return new Date(time).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name?: string): string {
  if (!name) return "P";
  const trimmed = name.trim();
  if (!trimmed) return "P";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function ServiceReviewsPhotosSection({
  ratingValue,
  totalReviewsCount,
  reviewBreakdown,
  reviews,
  photos,
  isLoadingReviews = false,
  onOpenRateModal,
  onOpenImageViewer,
}: ServiceReviewsPhotosSectionProps) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ServiceDetailTab>("rating");

  // Collect customer work photos from reviews to supplement service photos
  const customerWorkPhotos = reviews.flatMap((r) => r.images || []);
  const allPhotos = Array.from(new Set([...photos, ...customerWorkPhotos])).filter(
    (uri) => typeof uri === "string" && /^https?:\/\//i.test(uri)
  );

  // Compute distribution percentages
  const denom = totalReviewsCount > 0 ? totalReviewsCount : 1;
  const p5 = Math.min(100, Math.round(((reviewBreakdown.stars5 ?? 0) / denom) * 100));
  const p4 = Math.min(100, Math.round(((reviewBreakdown.stars4 ?? 0) / denom) * 100));
  const p3 = Math.min(100, Math.round(((reviewBreakdown.stars3 ?? 0) / denom) * 100));
  const p2 = Math.min(100, Math.round(((reviewBreakdown.stars2 ?? 0) / denom) * 100));
  const p1 = Math.min(100, Math.round(((reviewBreakdown.stars1 ?? 0) / denom) * 100));

  // Responsive tile size for 3-column photos grid
  const photoCardPadding = 28; // 14px * 2
  const photoGridGap = 8;
  const photoTileSize = Math.floor(
    (SCREEN_WIDTH - 32 - photoCardPadding - photoGridGap * 2) / 3
  );

  return (
    <View style={styles.card}>
      {/* ── A. Single Horizontal Navigation Row (Rating | Feedback | Photos) ── */}
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "rating" }}
          style={[styles.navTab, activeTab === "rating" && styles.navTabActive]}
          onPress={() => setActiveTab("rating")}
        >
          <Ionicons
            name={activeTab === "rating" ? "star" : "star-outline"}
            size={14}
            color={activeTab === "rating" ? "#047857" : "#64748B"}
          />
          <Text
            style={[styles.navTabText, activeTab === "rating" && styles.navTabTextActive]}
          >
            Rating
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "feedback" }}
          style={[styles.navTab, activeTab === "feedback" && styles.navTabActive]}
          onPress={() => setActiveTab("feedback")}
        >
          <Ionicons
            name={activeTab === "feedback" ? "chatbubbles" : "chatbubbles-outline"}
            size={14}
            color={activeTab === "feedback" ? "#047857" : "#64748B"}
          />
          <Text
            style={[styles.navTabText, activeTab === "feedback" && styles.navTabTextActive]}
          >
            Feedback{reviews.length > 0 ? ` (${reviews.length})` : ""}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "photos" }}
          style={[styles.navTab, activeTab === "photos" && styles.navTabActive]}
          onPress={() => setActiveTab("photos")}
        >
          <Ionicons
            name={activeTab === "photos" ? "images" : "images-outline"}
            size={14}
            color={activeTab === "photos" ? "#047857" : "#64748B"}
          />
          <Text
            style={[styles.navTabText, activeTab === "photos" && styles.navTabTextActive]}
          >
            Photos{allPhotos.length > 0 ? ` (${allPhotos.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {/* ── B. Rating Tab Content ────────────────────────────────────────── */}
      {activeTab === "rating" && (
        <View style={styles.tabContentBox}>
          {/* Overview Score & Distribution Bars */}
          <View style={styles.ratingOverviewRow}>
            {/* Left Big Score */}
            <View style={styles.scoreCol}>
              <View style={styles.scoreNumberRow}>
                <Text style={styles.bigScoreNumber}>{ratingValue}</Text>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>

              <View style={styles.starIconsRow}>
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Ionicons
                    key={starIdx}
                    name="star"
                    size={11}
                    color={
                      Number(ratingValue) >= starIdx
                        ? "#F59E0B"
                        : "#CBD5E1"
                    }
                  />
                ))}
              </View>

              <Text style={styles.basedOnText}>
                {totalReviewsCount} {totalReviewsCount === 1 ? "Rating" : "Ratings"}
              </Text>
            </View>

            {/* Right Distribution Bars */}
            <View style={styles.distBarsCol}>
              {[
                { star: "5★", pct: p5 },
                { star: "4★", pct: p4 },
                { star: "3★", pct: p3 },
                { star: "2★", pct: p2 },
                { star: "1★", pct: p1 },
              ].map((item) => (
                <View key={item.star} style={styles.distRow}>
                  <Text style={styles.distStarLabel}>{item.star}</Text>
                  <View style={styles.distTrack}>
                    <View style={[styles.distFill, { width: `${item.pct}%` }]} />
                  </View>
                  <Text style={styles.distPctLabel}>{item.pct}%</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Prominent "Rate Our Service" Action Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rate Our Service"
            style={styles.rateServiceBtn}
            onPress={onOpenRateModal}
          >
            <Ionicons name="star-outline" size={16} color="#FFFFFF" />
            <Text style={styles.rateServiceBtnText}>Rate Our Service</Text>
          </Pressable>
        </View>
      )}

      {/* ── C. Feedback Tab Content ──────────────────────────────────────── */}
      {activeTab === "feedback" && (
        <View style={styles.tabContentBox}>
          {isLoadingReviews && reviews.length === 0 ? (
            <View style={styles.centerLoadingBox}>
              <ActivityIndicator size="small" color="#047857" />
            </View>
          ) : reviews.length > 0 ? (
            <View style={styles.reviewsList}>
              {reviews.map((rev, idx) => {
                const authorName = rev.authorName || "Customer";
                const feedbackBody = rev.feedback || rev.body || "";
                const revImages = rev.images || [];

                return (
                  <View
                    key={rev.id || `rev-${idx}`}
                    style={[
                      styles.reviewItem,
                      idx < reviews.length - 1 && styles.reviewItemDivider,
                    ]}
                  >
                    {/* Top Row: Avatar, Name, Rating, Date */}
                    <View style={styles.reviewHeaderLine}>
                      <View style={styles.reviewAvatar}>
                        {rev.authorPhoto ? (
                          <Image
                            source={{ uri: rev.authorPhoto }}
                            style={styles.reviewAvatarImg}
                          />
                        ) : (
                          <Text style={styles.reviewInitials}>
                            {getInitials(authorName)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.reviewAuthorMeta}>
                        <View style={styles.reviewNameRow}>
                          <Text style={styles.reviewAuthorName} numberOfLines={1}>
                            {authorName}
                          </Text>
                          <View style={styles.starsInlineRow}>
                            {[...Array(rev.stars || 5)].map((_, i) => (
                              <Ionicons
                                key={i}
                                name="star"
                                size={11}
                                color="#F59E0B"
                              />
                            ))}
                          </View>
                        </View>

                        <View style={styles.reviewDateRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={11}
                            color="#047857"
                          />
                          <Text style={styles.verifiedText}>Verified Customer</Text>
                          <Text style={styles.bulletSep}>•</Text>
                          <Text style={styles.reviewDateText}>
                            {formatReviewDate(rev.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Feedback Text Body */}
                    {Boolean(feedbackBody) && (
                      <Text style={styles.feedbackBodyText}>{feedbackBody}</Text>
                    )}

                    {/* Work Photo Thumbnails */}
                    {revImages.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.revThumbsRow}
                      >
                        {revImages.map((imgUri, imgIdx) => (
                          <Pressable
                            key={`${imgUri}-${imgIdx}`}
                            onPress={() => onOpenImageViewer(revImages, imgIdx)}
                            style={styles.revThumbWrapper}
                          >
                            <Image
                              source={{ uri: imgUri }}
                              style={styles.revThumbImg}
                              resizeMode="cover"
                            />
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={24} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No feedback yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first customer to share your experience with this service!
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Write Feedback"
                style={styles.emptyActionBtn}
                onPress={onOpenRateModal}
              >
                <Text style={styles.emptyActionBtnText}>Write a Review</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── D. Photos Tab Content ────────────────────────────────────────── */}
      {activeTab === "photos" && (
        <View style={styles.tabContentBox}>
          {allPhotos.length > 0 ? (
            <View style={styles.photosGridWrap}>
              {allPhotos.map((photoUri, pIdx) => (
                <Pressable
                  key={`${photoUri}-${pIdx}`}
                  onPress={() => onOpenImageViewer(allPhotos, pIdx)}
                  style={[
                    styles.photoGridTile,
                    { width: photoTileSize, height: photoTileSize },
                  ]}
                >
                  <Image
                    source={{ uri: photoUri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="images-outline" size={24} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No photos available</Text>
              <Text style={styles.emptySubtext}>
                Photos uploaded by the provider or customers will appear here.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload Service Photo"
                style={styles.emptyActionBtn}
                onPress={onOpenRateModal}
              >
                <Text style={styles.emptyActionBtnText}>Add Work Photo</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  navRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  navTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  navTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  navTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  navTabTextActive: {
    color: "#047857",
    fontWeight: "800",
  },
  tabContentBox: {
    gap: 12,
    paddingTop: 2,
  },
  ratingOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scoreCol: {
    alignItems: "center",
    gap: 3,
    minWidth: 80,
  },
  scoreNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bigScoreNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: "#047857",
  },
  starIconsRow: {
    flexDirection: "row",
    gap: 2,
  },
  basedOnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    marginTop: 2,
  },
  distBarsCol: {
    flex: 1,
    gap: 3,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  distStarLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B",
    width: 18,
  },
  distTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  distFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 2.5,
  },
  distPctLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B",
    width: 28,
    textAlign: "right",
  },
  rateServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#034E3B",
    paddingVertical: 11,
    borderRadius: 12,
  },
  rateServiceBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  centerLoadingBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  reviewsList: {
    gap: 12,
  },
  reviewItem: {
    gap: 6,
  },
  reviewItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  reviewHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewAvatarImg: {
    width: "100%",
    height: "100%",
  },
  reviewInitials: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
  },
  reviewAuthorMeta: {
    flex: 1,
    gap: 1,
  },
  reviewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewAuthorName: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  starsInlineRow: {
    flexDirection: "row",
    gap: 1,
  },
  reviewDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  bulletSep: {
    fontSize: 10,
    color: "#94A3B8",
  },
  reviewDateText: {
    fontSize: 10,
    color: "#94A3B8",
  },
  feedbackBodyText: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 18,
  },
  revThumbsRow: {
    gap: 8,
    paddingTop: 3,
  },
  revThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  revThumbImg: {
    width: "100%",
    height: "100%",
  },
  photosGridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoGridTile: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  emptyStateBox: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtext: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  emptyActionBtn: {
    marginTop: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  emptyActionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#047857",
  },
});
