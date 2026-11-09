import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { serviceTaskLabel } from "../serviceProfileTheme";

export interface ServicesIncludedListProps {
  tasks: string[];
}

interface TaskPalette {
  bg: string;
  icon: string;
  border: string;
}

const DEFAULT_PALETTE: TaskPalette = {
  bg: "#ECFDF5",
  icon: "#047857",
  border: "#A7F3D0",
};

const TASK_PALETTES: TaskPalette[] = [
  DEFAULT_PALETTE, // Emerald
  { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" }, // Sky
  { bg: "#FFFBEB", icon: "#D97706", border: "#FDE68A" }, // Amber
  { bg: "#F5F3FF", icon: "#7C3AED", border: "#DDD6FE" }, // Violet
  { bg: "#F0FDFA", icon: "#0D9488", border: "#99F6E4" }, // Teal
  { bg: "#FEF2F2", icon: "#DC2626", border: "#FECDD3" }, // Rose
];

export function getTaskPalette(taskName: string, index: number): TaskPalette {
  const t = taskName.toLowerCase();
  if (t.includes("engine") || t.includes("motor") || t.includes("diagnostic")) return TASK_PALETTES[1] ?? DEFAULT_PALETTE;
  if (t.includes("oil") || t.includes("fluid") || t.includes("lube") || t.includes("fuel")) return TASK_PALETTES[2] ?? DEFAULT_PALETTE;
  if (t.includes("tyre") || t.includes("tire") || t.includes("tube") || t.includes("wheel")) return TASK_PALETTES[3] ?? DEFAULT_PALETTE;
  if (t.includes("wash") || t.includes("clean") || t.includes("polish") || t.includes("chain")) return TASK_PALETTES[4] ?? DEFAULT_PALETTE;
  if (t.includes("brake") || t.includes("clutch") || t.includes("emergency")) return TASK_PALETTES[5] ?? DEFAULT_PALETTE;
  return TASK_PALETTES[index % TASK_PALETTES.length] ?? DEFAULT_PALETTE;
}

export function getTaskIcon(taskName: string): keyof typeof Ionicons.glyphMap {
  const t = taskName.toLowerCase();
  if (t.includes("engine") || t.includes("motor")) return "hardware-chip-outline";
  if (t.includes("tyre") || t.includes("tire") || t.includes("tube") || t.includes("wheel")) return "disc-outline";
  if (t.includes("oil") || t.includes("fluid") || t.includes("fuel") || t.includes("lube")) return "water-outline";
  if (t.includes("brake") || t.includes("clutch")) return "speedometer-outline";
  if (t.includes("wash") || t.includes("clean") || t.includes("polish")) return "sparkles-outline";
  if (t.includes("electric") || t.includes("battery") || t.includes("wiring") || t.includes("light") || t.includes("switch")) return "flash-outline";
  if (t.includes("chain") || t.includes("link")) return "link-outline";
  if (t.includes("pipe") || t.includes("tap") || t.includes("leak") || t.includes("drain")) return "color-filter-outline";
  if (t.includes("cut") || t.includes("hair") || t.includes("style")) return "cut-outline";
  if (t.includes("ac") || t.includes("cool")) return "snow-outline";
  return "construct-outline";
}

export function ServicesIncludedList({ tasks }: ServicesIncludedListProps) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconHalo}>
            <Ionicons name="checkmark-done-circle" size={16} color="#047857" />
          </View>
          <Text style={styles.headerTitle}>Services Included</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {tasks.length} {tasks.length === 1 ? "Service" : "Services"}
          </Text>
        </View>
      </View>

      {/* Dynamic Wrap Chips - adjusts width to service name naturally without wasting space */}
      <View style={styles.chipsWrap}>
        {tasks.map((taskName, idx) => {
          const palette = getTaskPalette(taskName, idx);
          const icon = getTaskIcon(taskName);
          const label = serviceTaskLabel(taskName);

          return (
            <View key={`${taskName}-${idx}`} style={styles.chip}>
              <View
                style={[
                  styles.chipIconHalo,
                  { backgroundColor: palette.bg, borderColor: palette.border },
                ]}
              >
                <Ionicons name={icon} size={12} color={palette.icon} />
              </View>
              <Text style={styles.chipText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipIconHalo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: 16,
  },
});
