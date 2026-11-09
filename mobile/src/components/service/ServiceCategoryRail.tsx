import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { ALL_CATEGORIES_LIST, type CategoryFilter } from "./searchCategories";
import { dash } from "./palette";

type Props = {
  activeCategory: CategoryFilter;
  onSelect: (category: CategoryFilter) => void;
  style?: ScrollViewProps["style"];
};

export function ServiceCategoryRail({ activeCategory, onSelect, style }: Props) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentContainerStyle={styles.content}
      style={style}
    >
      {ALL_CATEGORIES_LIST.map((category) => {
        const active = activeCategory === category.id;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${category.label} services`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(category.id)}
            style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
          >
            <View style={[styles.iconBadge, active ? styles.iconBadgeActive : { backgroundColor: category.bg }]}>
              <Ionicons name={category.icon} size={14} color={active ? "#FFFFFF" : category.color} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{category.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 9,
  },
  pill: {
    height: 42,
    paddingLeft: 7,
    paddingRight: 13,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillActive: {
    backgroundColor: dash.primary,
    borderColor: dash.primary,
  },
  pillInactive: {
    backgroundColor: dash.white,
    borderColor: "#E7ECE9",
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  label: {
    fontSize: 12.5,
    fontWeight: "700",
    color: dash.ink,
  },
  labelActive: {
    color: dash.white,
  },
});
