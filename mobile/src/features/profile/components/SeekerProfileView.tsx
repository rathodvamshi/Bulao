import { useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "../../../components/ui";
import type { SeekerRoleData } from "../types";

export function SeekerProfileView({
  data,
  isOwner = true,
}: {
  data: SeekerRoleData;
  isOwner?: boolean;
}) {
  const [isAvailable, setIsAvailable] = useState(data.available);
  const hasReviews = data.totalReviews > 0 && data.rating !== null;

  return (
    <View style={styles.container}>
      {/* ── 1. Seeker Reputation & Rating Card ────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Worker Reputation</Text>
            <Text style={styles.cardSubtitle}>Rated by employers & job posters</Text>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="hammer" size={12} color="#2563EB" />
            <Text style={styles.roleBadgeText}>Worker Mode</Text>
          </View>
        </View>

        <View style={styles.ratingSection}>
          <View style={styles.ratingScoreCol}>
            <Text style={styles.ratingBigText}>
              {hasReviews ? data.rating?.toFixed(1) : "New"}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={
                    hasReviews && (data.rating || 0) >= star
                      ? "star"
                      : hasReviews && (data.rating || 0) >= star - 0.5
                      ? "star-half"
                      : "star-outline"
                  }
                  size={16}
                  color="#F5B928"
                />
              ))}
            </View>
            <Text style={styles.reviewCountText}>
              {hasReviews ? `${data.totalReviews} employer reviews` : "No ratings yet"}
            </Text>
          </View>

          <View style={styles.scoreDivider} />

          <View style={styles.quickMetricsCol}>
            <View style={styles.metricRow}>
              <Ionicons name="time-outline" size={15} color="#2563EB" />
              <Text style={styles.metricLabel}>Punctuality</Text>
              <Text style={styles.metricVal}>{data.punctualityScore}%</Text>
            </View>
            <View style={styles.metricRow}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#2563EB" />
              <Text style={styles.metricLabel}>Jobs Completed</Text>
              <Text style={styles.metricVal}>{data.completed}</Text>
            </View>
            <View style={styles.metricRow}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#2563EB" />
              <Text style={styles.metricLabel}>Reliability</Text>
              <Text style={styles.metricVal}>96%</Text>
            </View>
          </View>
        </View>

        {/* Availability Switch (If Owner) */}
        {isOwner && (
          <View style={styles.availabilityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.availTitle}>Available for Work Today</Text>
              <Text style={styles.availSubtitle}>
                {isAvailable
                  ? "You are visible to employers hiring nearby"
                  : "Turn on to get notified of urgent jobs"}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={isAvailable ? "#2563EB" : "#F3F4F6"}
            />
          </View>
        )}
      </View>

      {/* ── 2. Skills & Categories ────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionHeading}>Trade Skills & Experience</Text>
        <View style={styles.skillsWrap}>
          {data.skills.map((skill) => (
            <View key={skill} style={styles.skillChip}>
              <Ionicons name="construct-outline" size={13} color="#2563EB" />
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 3. Employer Feedback Tags ─────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.tagsHeader}>EMPLOYER FEEDBACK HIGHLIGHTS</Text>
        <View style={styles.tagsWrap}>
          {data.feedbackTags.map((tag) => (
            <View key={tag.id} style={styles.feedbackTag}>
              <Text style={styles.tagIcon}>{tag.icon}</Text>
              <Text style={styles.tagLabel}>{tag.label}</Text>
              <Text style={styles.tagPct}>{tag.percentage}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 4. Quick Actions for Seekers (If Owner) ───────────────────────── */}
      {isOwner && (
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Work Actions</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/find-work")}
            style={styles.actionButtonPrimary}
          >
            <Ionicons name="search" size={18} color="#FFFFFF" />
            <Text style={styles.actionPrimaryText}>Find Work Nearby</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/activity")}
            style={styles.actionButtonSecondary}
          >
            <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionSecondaryTitle}>My Applications & Gigs</Text>
              <Text style={styles.actionSecondarySub}>
                Track your active job requests and earnings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
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
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFBF9",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF3EF",
  },
  ratingScoreCol: {
    alignItems: "center",
    minWidth: 95,
  },
  ratingBigText: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 4,
  },
  reviewCountText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
  },
  scoreDivider: {
    width: 1,
    height: "75%",
    backgroundColor: "#E2E8E4",
    marginHorizontal: 12,
  },
  quickMetricsCol: {
    flex: 1,
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  metricLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    fontWeight: "500",
  },
  metricVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  availTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  availSubtitle: {
    fontSize: 11,
    color: colors.mutedLight,
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  skillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },
  tagsHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.mutedLight,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedbackTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tagIcon: {
    fontSize: 13,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  tagPct: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  actionButtonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  actionPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F7FAF8",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6ECE8",
  },
  actionSecondaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  actionSecondarySub: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
});
