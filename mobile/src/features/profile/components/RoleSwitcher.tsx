import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../components/ui";
import type { ProfileRole } from "../types";

const ROLES: {
  id: ProfileRole;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeColor: string;
}[] = [
  {
    id: "provider",
    label: "Provider",
    sublabel: "Hirer",
    icon: "briefcase",
    activeColor: "#075B43",
  },
  {
    id: "seeker",
    label: "Seeker",
    sublabel: "Worker",
    icon: "hammer",
    activeColor: "#2563EB",
  },
  {
    id: "service",
    label: "Service",
    sublabel: "Partner",
    icon: "flash",
    activeColor: "#D97706",
  },
];

export function RoleSwitcher({
  activeRole,
  onSelectRole,
  serviceCount = 0,
}: {
  activeRole: ProfileRole;
  onSelectRole: (role: ProfileRole) => void;
  serviceCount?: number;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>VIEW PROFILE AS</Text>
      <View style={styles.tabsRow}>
        {ROLES.map((item) => {
          const isActive = item.id === activeRole;
          const showServiceBadge = item.id === "service" && serviceCount > 0;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${item.label} profile`}
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectRole(item.id)}
              style={[
                styles.tab,
                isActive && {
                  backgroundColor: item.activeColor,
                  borderColor: item.activeColor,
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isActive ? "#FFFFFF" : colors.muted}
              />
              <View style={styles.labelCol}>
                <View style={styles.labelWithBadgeRow}>
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive && styles.activeTabLabel,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {showServiceBadge && (
                    <View
                      style={[
                        styles.countPill,
                        isActive && styles.countPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countPillText,
                          isActive && styles.countPillTextActive,
                        ]}
                      >
                        {serviceCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tabSublabel,
                    isActive && styles.activeTabSublabel,
                  ]}
                >
                  {item.sublabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.mutedLight,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F1F5F2",
    padding: 5,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  labelCol: {
    alignItems: "flex-start",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  tabSublabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.mutedLight,
  },
  activeTabLabel: {
    color: "#FFFFFF",
  },
  activeTabSublabel: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  labelWithBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  countPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  countPillTextActive: {
    color: "#FFFFFF",
  },
});
