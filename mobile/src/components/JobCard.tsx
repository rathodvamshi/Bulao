import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import type { Job } from "../api/types";

interface JobCardProps {
  job: Job;
  onViewDetails: (job: Job) => void;
}

export function JobCard({ job, onViewDetails }: JobCardProps) {
  const payInRupees = job.payPaise / 100;
  const payDisplay = `₹${payInRupees} / ${job.payUnit.toLowerCase()}`;

  const startDate = new Date(job.startsAt * 1000);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const timeString = startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateDisplay = isToday ? `Today at ${timeString}` : startDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
        </View>
        <View style={styles.payBadge}>
          <Text style={styles.payText}>{payDisplay}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.muted} />
          <Text style={styles.detailText} numberOfLines={1}>
            {job.area} {job.distanceKm !== undefined ? `• ${job.distanceKm} km away` : ""}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.detailText}>{dateDisplay}</Text>
        </View>

        {job.workers > 1 && (
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.muted} />
            <Text style={styles.detailText}>Needs {job.workers} workers</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewDetails(job)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText} numberOfLines={1} adjustsFontSizeToFit>View Details</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewDetails(job)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={styles.primaryButton}>
              <Text style={styles.primaryButtonText} numberOfLines={1} adjustsFontSizeToFit>Apply</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  payBadge: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  payText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.green,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.muted,
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
