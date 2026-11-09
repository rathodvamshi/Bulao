import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceItem } from "../../types";

export interface ServiceSpecificationsCardProps {
  service: ServiceItem;
  serviceModeText: string;
  vehicleType: string;
  timings: { start: string; end: string; days: string };
}

interface SpecItem {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  statusBadge?: string;
  statusColor?: string;
}

export function ServiceSpecificationsCard({
  service,
  serviceModeText,
  vehicleType,
  timings,
}: ServiceSpecificationsCardProps) {
  // Collect genuine, non-empty specifications
  const items: SpecItem[] = [];

  // 1. Service Mode
  if (serviceModeText) {
    const isAtCenter = service.serviceMode === "at_center";
    const isBoth = service.serviceMode === "both";
    items.push({
      id: "mode",
      label: "SERVICE MODE",
      value: serviceModeText,
      icon: isAtCenter ? "storefront" : isBoth ? "sync" : "home",
      iconBg: "#ECFDF5",
      iconColor: "#047857",
      borderColor: "#A7F3D0",
      statusBadge: isAtCenter ? "Shop" : isBoth ? "Hybrid" : "Doorstep",
      statusColor: "#047857",
    });
  }

  // 2. Vehicle / Target Type
  if (vehicleType) {
    const isCar = vehicleType.toLowerCase().includes("car");
    items.push({
      id: "vehicle",
      label: "TARGET TYPE",
      value: vehicleType,
      icon: isCar ? "car-sport" : "bicycle",
      iconBg: "#F0F9FF",
      iconColor: "#0284C7",
      borderColor: "#BAE6FD",
      statusBadge: "Verified",
      statusColor: "#0284C7",
    });
  }

  // 3. Service Hours
  if (timings.start && timings.end) {
    items.push({
      id: "hours",
      label: "SERVICE HOURS",
      value: `${timings.start} – ${timings.end}`,
      icon: "time",
      iconBg: "#FFFBEB",
      iconColor: "#D97706",
      borderColor: "#FDE68A",
      statusBadge: "Active",
      statusColor: "#D97706",
    });
  }

  // 4. Working Days
  if (timings.days) {
    items.push({
      id: "days",
      label: "WORKING DAYS",
      value: timings.days,
      icon: "calendar",
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
      borderColor: "#DDD6FE",
      statusBadge: "Schedule",
      statusColor: "#7C3AED",
    });
  }

  // 5. Experience Years (Only if available and > 0)
  if (service.experienceYears && service.experienceYears > 0) {
    items.push({
      id: "experience",
      label: "EXPERIENCE",
      value: `${service.experienceYears}+ Years Working`,
      icon: "ribbon",
      iconBg: "#FEF3C7",
      iconColor: "#B45309",
      borderColor: "#FDE68A",
      statusBadge: "Pro",
      statusColor: "#B45309",
    });
  }

  // 6. Coverage Radius (Only if relevant for doorstep or both)
  if (service.radiusKm && (service.serviceMode === "doorstep" || service.serviceMode === "both")) {
    items.push({
      id: "radius",
      label: "SERVICE RADIUS",
      value: `Within ${service.radiusKm} km`,
      icon: "navigate",
      iconBg: "#F0FDFA",
      iconColor: "#0D9488",
      borderColor: "#99F6E4",
      statusBadge: "Radius",
      statusColor: "#0D9488",
    });
  }

  if (items.length === 0) return null;

  // Organize into explicit pairs: exactly two grids per row
  const pairedRows: SpecItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairedRows.push(items.slice(i, i + 2));
  }

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconHalo}>
            <Ionicons name="grid" size={15} color="#047857" />
          </View>
          <Text style={styles.headerTitle}>Service Specifications</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length} Key Details</Text>
        </View>
      </View>

      {/* Row-by-Row Layout: Exactly Two Grids in Each Row */}
      <View style={styles.rowsContainer}>
        {pairedRows.map((row, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.specRow}>
            {row.map((item) => (
              <View key={item.id} style={styles.specCell}>
                {/* Top Row: Themed Icon Halo + Status Pill */}
                <View style={styles.cellTopRow}>
                  <View
                    style={[
                      styles.iconSquircle,
                      {
                        backgroundColor: item.iconBg,
                        borderColor: item.borderColor,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={17} color={item.iconColor} />
                  </View>

                  {item.statusBadge && (
                    <View
                      style={[
                        styles.cellStatusPill,
                        {
                          backgroundColor: item.iconBg,
                          borderColor: item.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellStatusText,
                          { color: item.statusColor },
                        ]}
                      >
                        {item.statusBadge}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Content Block */}
                <View style={styles.cellContentBlock}>
                  <Text style={styles.cellLabelText}>{item.label}</Text>
                  <Text style={styles.cellValueText} numberOfLines={2}>
                    {item.value}
                  </Text>
                </View>
              </View>
            ))}

            {/* If odd count in last row, insert empty flex spacer to preserve exact 2-column balance */}
            {row.length === 1 && <View style={styles.specCellSpacer} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconHalo: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  rowsContainer: {
    gap: 10,
  },
  specRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  specCell: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
    minHeight: 88,
  },
  specCellSpacer: {
    flex: 1,
  },
  cellTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconSquircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cellStatusPill: {
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  cellStatusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cellContentBlock: {
    marginTop: 8,
    gap: 3,
  },
  cellLabelText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cellValueText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 18,
  },
});
