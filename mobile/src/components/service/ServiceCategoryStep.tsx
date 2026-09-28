import { useState, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Category } from "../../api/types";

// Design Tokens
const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E5E7EB";
const WHITE = "#FFFFFF";

const PLUMBER_IMG = require("../../../assets/images/categories/plumber.png");
const ELECTRICIAN_IMG = require("../../../assets/images/categories/electrician.jpg");

// Category Visuals
type CategoryVisual = {
  match?: RegExp;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: ImageSourcePropType;
  color: string;
  background: string;
  hint: string;
  isPopular?: boolean;
  group?: "repairs" | "home" | "tech" | "personal";
};

const visuals: CategoryVisual[] = [
  { match: /mechanic|auto|vehicle/, icon: "car-sport", color: "#E11D48", background: "#FFF0F3", hint: "Vehicle Care & Fix", isPopular: true, group: "repairs" },
  { match: /plumb/, image: PLUMBER_IMG, color: "#2563EB", background: "#EFF6FF", hint: "Pipes & Drainage", isPopular: true, group: "repairs" },
  { match: /electric/, image: ELECTRICIAN_IMG, color: "#D97706", background: "#FEFCE8", hint: "Wiring & Power", isPopular: true, group: "repairs" },
  { match: /carpent/, icon: "hammer", color: "#C2410C", background: "#FFF7ED", hint: "Woodwork & Furniture", group: "repairs" },
  { match: /paint/, icon: "color-palette", color: "#7C3AED", background: "#F5F3FF", hint: "Walls & Painting", isPopular: true, group: "repairs" },
  { match: /mobile|phone/, icon: "phone-portrait", color: "#DB2777", background: "#FDF2F8", hint: "Screens & Batteries", group: "tech" },
  { match: /computer|laptop/, icon: "laptop", color: "#0284C7", background: "#F0F9FF", hint: "Hardware & Software", group: "tech" },
  { match: /tutor|teach|education|school/, icon: "school", color: "#9333EA", background: "#F5F3FF", hint: "Lessons & Classes", group: "personal" },
  { match: /beauty|salon|hair|cut/, icon: "cut", color: "#C026D3", background: "#FDF2F8", hint: "Hair & Grooming", group: "personal" },
  { match: /clean|housekeeping|maid/, icon: "sparkles", color: "#16A34A", background: "#F0FDF4", hint: "Home & Deep Clean", isPopular: true, group: "home" },
  { match: /food|cater|cook|restaurant/, icon: "restaurant", color: "#EA580C", background: "#FFF7ED", hint: "Catering & Cooking", group: "home" },
  { match: /\bac\b|air.condition|cool|snow/, icon: "snow", color: "#0891B2", background: "#ECFEFF", hint: "AC Repair & Cooling", isPopular: true, group: "repairs" },
  { match: /appliance|washing|machine/, icon: "construct", color: "#475569", background: "#F8FAFC", hint: "Appliance Repairs", group: "repairs" },
  { match: /garden|plant|leaf/, icon: "leaf", color: "#16A34A", background: "#F0FDF4", hint: "Lawn & Gardening", group: "home" },
  { match: /driv|transport/, icon: "car", color: "#2563EB", background: "#EFF6FF", hint: "Driver & Transit", group: "repairs" },
  { match: /construction|labour|build/, icon: "build", color: "#D97706", background: "#FEF3C7", hint: "Civil & Masonry", group: "repairs" },
  { match: /shop|retail|sale|store/, icon: "storefront", color: "#7C3AED", background: "#EDE9FE", hint: "Store & Inventory", group: "personal" },
  { match: /event|party|function/, icon: "balloon", color: "#DB2777", background: "#FCE7F3", hint: "Parties & Events", group: "personal" },
  { match: /security|guard|shield/, icon: "shield-checkmark", color: "#059669", background: "#D1FAE5", hint: "Safety & Security", group: "home" },
  { match: /health|med|nurse|care/, icon: "medkit", color: "#DC2626", background: "#FEE2E2", hint: "Caregiving & Health", group: "personal" },
  { match: /promo|market|ad/, icon: "megaphone", color: "#CA8A04", background: "#FEF9C3", hint: "Marketing & Ads", group: "personal" },
  { match: /office|admin|desk/, icon: "briefcase", color: "#475569", background: "#F1F5F9", hint: "Office & Admin", group: "personal" },
];

function getVisual(category: Category): CategoryVisual {
  const key = `${category.id} ${category.name.toLowerCase()}`;
  return (
    visuals.find((v) => v.match?.test(key)) ?? {
      icon: "grid" as const,
      color: "#475569",
      background: "#F1F5F9",
      hint: "Specialist Skill",
    }
  );
}

// Skeleton Card
function SkeletonCard({ width }: { width: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useMemo(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { width, opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
    </Animated.View>
  );
}

// Animated Category Card
function CategoryCard({
  category,
  visual,
  selected,
  cardWidth,
  onPress,
}: {
  category: Category;
  visual: CategoryVisual;
  selected: boolean;
  cardWidth: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={category.name}
      accessibilityHint={visual.hint}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          {
            width: cardWidth,
            backgroundColor: selected ? "#F0FDF4" : visual.background,
            borderColor: selected ? GREEN : `${visual.color}30`,
            borderWidth: selected ? 2 : 1.5,
            transform: [{ scale }],
          },
        ]}
      >
        {visual.isPopular && !selected && (
          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>HOT</Text>
          </View>
        )}
        {selected && (
          <View style={styles.selectedTick}>
            <Ionicons name="checkmark" size={11} color={WHITE} />
          </View>
        )}
        <View style={[styles.iconWrapper, { backgroundColor: selected ? GREEN_SOFT : WHITE }]}>
          {visual.image ? (
            <Image
              source={visual.image}
              style={styles.categoryImage}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name={visual.icon ?? "grid"} size={24} color={selected ? GREEN : visual.color} />
          )}
        </View>
        <Text
          style={[styles.cardTitle, selected && { color: GREEN, fontWeight: "800" }]}
          numberOfLines={2}
        >
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// Filter chip types
type FilterTab = "all" | "popular" | "repairs" | "home" | "tech" | "personal";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All Services" },
  { id: "popular", label: "High Demand" },
  { id: "repairs", label: "Repairs" },
  { id: "home", label: "Home" },
  { id: "tech", label: "Tech" },
  { id: "personal", label: "Personal" },
];

// Main Component
export function ServiceCategoryStep({
  categories,
  selectedId,
  onSelect,
  loading,
  failed,
  onRetry,
}: {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [containerWidth, setContainerWidth] = useState(0);
  const { width } = useWindowDimensions();

  const availableWidth = containerWidth || Math.max(0, width - 40);
  const columns = availableWidth >= 768 ? 4 : 2;
  const gridGap = 12;
  const cardWidth = Math.floor((availableWidth - (columns - 1) * gridGap) / columns);

  const selectedCategory = categories.find((c) => c.id === selectedId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((cat) => {
      if (q && !cat.name.toLowerCase().includes(q)) return false;
      if (activeTab === "all") return true;
      const v = getVisual(cat);
      if (activeTab === "popular") return Boolean(v.isPopular);
      return v.group === activeTab;
    });
  }, [categories, search, activeTab]);

  if (loading) {
    const skeletonCount = columns * 3;
    return (
      <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <View style={styles.heroSection}>
          <View style={styles.skeletonTag} />
          <View style={styles.skeletonHeading} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonSearch} />
        <View style={[styles.grid, { gap: gridGap }]}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} width={cardWidth} />
          ))}
        </View>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <View style={styles.emptyState}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={36} color={TEXT_SECONDARY} />
          </View>
          <Text style={styles.emptyTitle}>Could not load categories</Text>
          <Text style={styles.emptyText}>Please check your connection and try again.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
            <Ionicons name="refresh-outline" size={16} color={WHITE} />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>

      <View style={styles.heroSection}>
        <Text style={styles.stageTag}>SELECT CATEGORY</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          What <Text style={{ color: GREEN }}>service</Text> do you provide?
        </Text>
        <Text style={styles.subtitle}>
          Pick the category that best describes your expertise.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={TEXT_SECONDARY} style={styles.searchIcon} />
        <TextInput
          accessibilityLabel="Search service categories"
          placeholder="Search categories e.g. Plumbing, AC Repair"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="flame" size={16} color="#EF4444" />
          <Text style={styles.sectionTitleText}>
            {activeTab === "popular" ? "High Demand Services" : "All Categories"}
          </Text>
          {filtered.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filtered.length}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => setActiveTab(activeTab === "all" ? "popular" : "all")}>
          <Text style={styles.viewAllText}>
            {activeTab === "all" ? "High Demand" : "View All"}
          </Text>
        </Pressable>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>
            {categories.length ? "No matching categories" : "No categories yet"}
          </Text>
          <Text style={styles.emptyText}>
            {categories.length
              ? "Try a different search or select All Services."
              : "Please check back shortly."}
          </Text>
        </View>
      ) : (
        <View style={[styles.grid, { gap: gridGap }]}>
          {filtered.map((category) => {
            const visual = getVisual(category);
            return (
              <CategoryCard
                key={category.id}
                category={category}
                visual={visual}
                selected={selectedId === category.id}
                cardWidth={cardWidth}
                onPress={() => onSelect(category.id)}
              />
            );
          })}
        </View>
      )}

      {selectedCategory ? (
        <View style={styles.selectedBanner}>
          <View style={styles.selectedBannerLeft}>
            <View style={styles.selectedBannerIconWrap}>
              <Ionicons name="checkmark-circle" size={24} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedBannerTitle}>{selectedCategory.name}</Text>
              <Text style={styles.selectedBannerSub}>Tap Continue to set up pricing and details</Text>
            </View>
          </View>
          <View style={styles.selectedBannerBadge}>
            <Ionicons name="checkmark" size={12} color={WHITE} />
            <Text style={styles.selectedBannerBadgeText}>Step 1</Text>
          </View>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={GREEN} style={{ marginTop: 1 }} />
          <Text style={styles.infoCardText}>
            <Text style={styles.infoCardBold}>One category per profile.  </Text>
            You can add more services from your dashboard later.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },

  heroSection: { gap: 6 },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 54,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },
  clearButton: { padding: 4 },

  filterBar: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  filterChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: WHITE,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  countBadge: {
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },

  card: {
    borderRadius: 16,
    padding: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
    position: "relative",
    minHeight: 120,
    justifyContent: "center",
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  cardTitle: {
    width: "100%",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
    color: TEXT_PRIMARY,
    paddingHorizontal: 4,
  },
  hotBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hotBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 0.2,
  },
  selectedTick: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  skeletonTag: { height: 12, width: 100, borderRadius: 6, backgroundColor: "#E5E7EB" },
  skeletonHeading: { height: 28, width: "75%", borderRadius: 8, backgroundColor: "#E5E7EB", marginTop: 4 },
  skeletonSubtitle: { height: 16, width: "90%", borderRadius: 6, backgroundColor: "#F3F4F6" },
  skeletonSearch: { height: 54, borderRadius: 16, backgroundColor: "#F3F4F6" },
  skeletonCard: {
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    padding: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
    minHeight: 120,
    justifyContent: "center",
  },
  skeletonIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#E5E7EB" },
  skeletonLine: { height: 12, width: "70%", borderRadius: 6, backgroundColor: "#E5E7EB" },
  skeletonLineShort: { height: 10, width: "50%", borderRadius: 6, backgroundColor: "#ECECEC" },

  emptyState: { width: "100%", paddingVertical: 40, alignItems: "center", gap: 12 },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY, textAlign: "center" },
  emptyText: { fontSize: 13, color: TEXT_SECONDARY, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    marginTop: 4,
  },
  retryText: { color: WHITE, fontWeight: "700", fontSize: 14 },

  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: GREEN,
    gap: 8,
  },
  selectedBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  selectedBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBannerTitle: { fontSize: 14, fontWeight: "800", color: GREEN },
  selectedBannerSub: { fontSize: 11.5, fontWeight: "500", color: "#059669", marginTop: 2 },
  selectedBannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  selectedBannerBadgeText: { fontSize: 11, fontWeight: "800", color: WHITE },

  infoCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: GREEN_SOFT,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  infoCardText: { flex: 1, fontSize: 13, lineHeight: 19, color: "#166534", fontWeight: "500" },
  infoCardBold: { fontWeight: "800", color: GREEN },
});