import { useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "../../../components/ui";
import type { ServiceRoleData } from "../types";

export function ServiceProfileView({
  data,
  isOwner = true,
}: {
  data: ServiceRoleData;
  isOwner?: boolean;
}) {
  const [isAvailable, setIsAvailable] = useState(data.available);
  const hasReviews = data.totalReviews > 0 && data.rating !== null;

  return (
    <View style={styles.container}>
      {/* ── 1. Service Partner Reputation & Rating Card ──────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Service Reputation</Text>
            <Text style={styles.cardSubtitle}>Rated by service customers</Text>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="flash" size={12} color="#D97706" />
            <Text style={styles.roleBadgeText}>Partner Mode</Text>
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
              {hasReviews ? `${data.totalReviews} client reviews` : "No ratings yet"}
            </Text>
          </View>

          <View style={styles.scoreDivider} />

          <View style={styles.quickMetricsCol}>
            <View style={styles.metricRow}>
              <Ionicons name="navigate-circle-outline" size={15} color="#D97706" />
              <Text style={styles.metricLabel}>Coverage</Text>
              <Text style={styles.metricVal}>{data.radiusKm} km radius</Text>
            </View>
            <View style={styles.metricRow}>
              <Ionicons name="checkmark-done-circle-outline" size={15} color="#D97706" />
              <Text style={styles.metricLabel}>Jobs Done</Text>
              <Text style={styles.metricVal}>{data.completed}</Text>
            </View>
            <View style={styles.metricRow}>
              <Ionicons name="flash-outline" size={15} color="#D97706" />
              <Text style={styles.metricLabel}>Response Time</Text>
              <Text style={styles.metricVal}>&lt; 15 min</Text>
            </View>
          </View>
        </View>

        {/* Availability Switch (If Owner) */}
        {isOwner && (
          <View style={styles.availabilityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.availTitle}>Accepting Service Bookings</Text>
              <Text style={styles.availSubtitle}>
                {isAvailable
                  ? "Customers can book your services immediately"
                  : "Currently paused for new requests"}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: "#D1D5DB", true: "#FDE68A" }}
              thumbColor={isAvailable ? "#D97706" : "#F3F4F6"}
            />
          </View>
        )}
      </View>

      {/* ── 2. Active Services Offered ────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionHeading}>My Offered Services</Text>
          <Text style={styles.serviceCountBadge}>{data.services.length}</Text>
        </View>

        {data.services.length === 0 ? (
          <View style={styles.emptyServicesBox}>
            <Ionicons name="construct-outline" size={32} color={colors.mutedLight} />
            <Text style={styles.emptyServicesTitle}>No services listed yet</Text>
            <Text style={styles.emptyServicesHint}>
              List your specialized services (e.g. plumbing, repairs, cleaning) to get direct bookings.
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {data.services.map((srv) => (
              <View key={srv.id} style={styles.serviceItem}>
                <View style={styles.serviceIconCircle}>
                  <Ionicons name="construct" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceCategory}>{srv.category}</Text>
                  <Text style={styles.serviceMeta}>
                    {srv.experienceYears} yrs experience · {srv.radiusKm} km radius
                  </Text>
                </View>
                <View style={styles.serviceActiveTag}>
                  <Text style={styles.serviceActiveText}>Active</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── 3. Quick Actions for Services (If Owner) ──────────────────────── */}
      {isOwner && (
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Service Actions</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/services/offer")}
            style={styles.actionButtonPrimary}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.actionPrimaryText}>Offer a New Service</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/explore?kind=service")}
            style={styles.actionButtonSecondary}
          >
            <Ionicons name="compass-outline" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionSecondaryTitle}>Explore Service Marketplace</Text>
              <Text style={styles.actionSecondarySub}>
                See current rates and services in your area
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
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
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
    color: "#D97706",
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFDF7",
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#FEF3C7",
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
  serviceCountBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D97706",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyServicesBox: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyServicesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  emptyServicesHint: {
    fontSize: 12,
    color: colors.mutedLight,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  servicesList: {
    gap: 10,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#FAFBF9",
    borderWidth: 1,
    borderColor: "#EEF3EF",
  },
  serviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCategory: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  serviceMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  serviceActiveTag: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  serviceActiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.green,
  },
  actionButtonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D97706",
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
