import { useState, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { CategoryService } from "../../api/types";

// Design Tokens — same as Stage 1
const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E5E7EB";
const WHITE = "#FFFFFF";
const BG = "#F8FAF6";

// Icon color palette — maps Ionicon names to a soft pastel pair
const ICON_PALETTE: Record<string, { color: string; bg: string }> = {
  bicycle:           { color: "#E11D48", bg: "#FFF0F3" },
  "car-sport":       { color: "#2563EB", bg: "#EFF6FF" },
  water:             { color: "#0891B2", bg: "#ECFEFF" },
  sparkles:          { color: "#16A34A", bg: "#F0FDF4" },
  ellipse:           { color: "#475569", bg: "#F1F5F9" },
  "battery-charging":{ color: "#D97706", bg: "#FEF3C7" },
  snow:              { color: "#0891B2", bg: "#ECFEFF" },
  "color-palette":   { color: "#7C3AED", bg: "#F5F3FF" },
  "hardware-chip":   { color: "#0284C7", bg: "#F0F9FF" },
  "ellipsis-horizontal": { color: "#94A3B8", bg: "#F1F5F9" },
  construct:         { color: "#C2410C", bg: "#FFF7ED" },
  home:              { color: "#059669", bg: "#D1FAE5" },
  rainy:             { color: "#2563EB", bg: "#EFF6FF" },
  build:             { color: "#D97706", bg: "#FEFCE8" },
  trash:             { color: "#EF4444", bg: "#FEE2E2" },
  server:            { color: "#475569", bg: "#F8FAFC" },
  flash:             { color: "#D97706", bg: "#FEFCE8" },
  power:             { color: "#EF4444", bg: "#FEE2E2" },
  refresh:           { color: "#0891B2", bg: "#ECFEFF" },
  bulb:              { color: "#CA8A04", bg: "#FEF9C3" },
  "alert-circle":    { color: "#DC2626", bg: "#FEE2E2" },
  hammer:            { color: "#C2410C", bg: "#FFF7ED" },
  enter:             { color: "#475569", bg: "#F1F5F9" },
  grid:              { color: "#475569", bg: "#F8FAFC" },
  layers:            { color: "#7C3AED", bg: "#EDE9FE" },
  cut:               { color: "#C026D3", bg: "#FDF2F8" },
  happy:             { color: "#F59E0B", bg: "#FFFBEB" },
  rose:              { color: "#DB2777", bg: "#FCE7F3" },
  leaf:              { color: "#16A34A", bg: "#F0FDF4" },
  "hand-left":       { color: "#DB2777", bg: "#FCE7F3" },
  footsteps:         { color: "#EA580C", bg: "#FFF7ED" },
  heart:             { color: "#E11D48", bg: "#FFF0F3" },
  calculator:        { color: "#2563EB", bg: "#EFF6FF" },
  flask:             { color: "#16A34A", bg: "#F0FDF4" },
  book:              { color: "#9333EA", bg: "#F5F3FF" },
  language:          { color: "#0891B2", bg: "#ECFEFF" },
  laptop:            { color: "#0284C7", bg: "#F0F9FF" },
  trophy:            { color: "#D97706", bg: "#FEF3C7" },
  restaurant:        { color: "#EA580C", bg: "#FFF7ED" },
  balloon:           { color: "#DB2777", bg: "#FCE7F3" },
  "fast-food":       { color: "#EA580C", bg: "#FFF7ED" },
  gift:              { color: "#9333EA", bg: "#F5F3FF" },
  school:            { color: "#9333EA", bg: "#F5F3FF" },
  flower:            { color: "#C026D3", bg: "#FDF2F8" },
  medkit:            { color: "#DC2626", bg: "#FEE2E2" },
  fitness:           { color: "#16A34A", bg: "#F0FDF4" },
  people:            { color: "#2563EB", bg: "#EFF6FF" },
  body:              { color: "#059669", bg: "#D1FAE5" },
  "shield-checkmark":{ color: "#059669", bg: "#D1FAE5" },
  videocam:          { color: "#475569", bg: "#F1F5F9" },
  moon:              { color: "#7C3AED", bg: "#EDE9FE" },
};

function getIconStyle(icon: string): { color: string; bg: string } {
  return ICON_PALETTE[icon] ?? { color: "#64748B", bg: "#F1F5F9" };
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

// Service Card
function ServiceCard({
  service,
  selected,
  cardWidth,
  onPress,
}: {
  service: CategoryService;
  selected: boolean;
  cardWidth: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const { color, bg } = getIconStyle(service.icon);

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const isOther = service.id.startsWith("other_") || service.id === "other";

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${service.name}, ${selected ? "selected" : "not selected"}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          isOther && styles.cardOther,
          {
            width: cardWidth,
            backgroundColor: selected ? "#F0FDF4" : (isOther ? "#F8FAFC" : bg),
            borderColor: selected ? GREEN : (isOther ? "#CBD5E1" : `${color}30`),
            borderWidth: selected ? 2 : isOther ? 1 : 1.5,
            transform: [{ scale }],
          },
        ]}
      >
        {service.isPopular && !selected && !isOther && (
          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>HOT</Text>
          </View>
        )}
        {selected && (
          <View style={styles.selectedTick}>
            <Ionicons name="checkmark" size={11} color={WHITE} />
          </View>
        )}
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: selected ? GREEN_SOFT : (isOther ? "#E2E8F0" : WHITE) },
          ]}
        >
          <Ionicons
            name={service.icon as any}
            size={isOther ? 20 : 24}
            color={selected ? GREEN : (isOther ? "#64748B" : color)}
          />
        </View>
        <Text
          style={[styles.cardTitle, selected && styles.cardTitleSelected, isOther && styles.cardTitleOther]}
          numberOfLines={3}
        >
          {service.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// Main Component
export function ServiceSelectStep({
  categoryId,
  categoryName,
  categoryIcon,
  selectedServiceId,
  onServiceSelect,
  onChangeCategory,
}: {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  selectedServiceId: string;
  onServiceSelect: (id: string) => void;
  onChangeCategory: () => void;
}) {
  const [search, setSearch] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);
  const { width } = useWindowDimensions();

  // Responsive columns: 2 on tiny, 3 on normal mobile, 4 on tablet
  const availableWidth = containerWidth || Math.max(0, width - 40);
  const columns = availableWidth >= 768 ? 4 : availableWidth < 360 ? 2 : 3;
  const gridGap = 10;
  const cardWidth = Math.floor((availableWidth - (columns - 1) * gridGap) / columns);

  // Fetch services for this category
  const servicesQuery = useQuery({
    queryKey: ["category-services", categoryId],
    queryFn: () => api<CategoryService[]>(`/categories/${categoryId}/services`),
    enabled: Boolean(categoryId),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Append "Other Service" client-side if not already in list
  const allServices = useMemo(() => {
    const list = servicesQuery.data ?? [];
    const hasOther = list.some((s) => s.id.startsWith("other_") || s.id === "other");
    if (hasOther) return list;
    return [
      ...list,
      { id: "other", name: `Other ${categoryName} Service`, icon: "ellipsis-horizontal", sortOrder: 999 },
    ];
  }, [servicesQuery.data, categoryName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allServices;
    return allServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [allServices, search]);

  const selectedService = allServices.find((s) => s.id === selectedServiceId);

  // Loading skeleton
  if (servicesQuery.isLoading) {
    const skeletonCount = columns * 3;
    return (
      <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <HeroSection categoryName={categoryName} />
        <CategoryCard categoryName={categoryName} categoryIcon={categoryIcon} onChangeCategory={onChangeCategory} />
        <View style={styles.skeletonSearch} />
        <View style={[styles.grid, { gap: gridGap }]}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} width={cardWidth} />
          ))}
        </View>
      </View>
    );
  }

  // Error state
  if (servicesQuery.isError) {
    return (
      <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <HeroSection categoryName={categoryName} />
        <CategoryCard categoryName={categoryName} categoryIcon={categoryIcon} onChangeCategory={onChangeCategory} />
        <View style={styles.errorState}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={36} color={TEXT_SECONDARY} />
          </View>
          <Text style={styles.errorTitle}>Could not load services</Text>
          <Text style={styles.errorText}>Please check your connection and try again.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => servicesQuery.refetch()}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={16} color={WHITE} />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.content} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>

      {/* Hero heading */}
      <HeroSection categoryName={categoryName} />

      {/* Selected category card */}
      <CategoryCard
        categoryName={categoryName}
        categoryIcon={categoryIcon}
        onChangeCategory={onChangeCategory}
      />

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={TEXT_SECONDARY} style={styles.searchIcon} />
        <TextInput
          accessibilityLabel="Search services"
          placeholder={`Search services (e.g. Bike Repair, Car Wash...)`}
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

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {search ? "Search Results" : "Available Services"}
        </Text>
        {filtered.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filtered.length}</Text>
          </View>
        )}
      </View>

      {/* Grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No matching services</Text>
          <Text style={styles.emptyText}>Try a different search term.</Text>
          <Pressable
            style={styles.clearSearchBtn}
            onPress={() => setSearch("")}
          >
            <Text style={styles.clearSearchText}>Clear Search</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.grid, { gap: gridGap }]}>
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={selectedServiceId === service.id}
              cardWidth={cardWidth}
              onPress={() => onServiceSelect(service.id)}
            />
          ))}
        </View>
      )}

      {/* Helper info card */}
      <View style={styles.helperCard}>
        <Ionicons name="information-circle-outline" size={20} color={GREEN} style={{ marginTop: 1 }} />
        <Text style={styles.helperText}>
          <Text style={styles.helperBold}>Can't find your service?</Text>
          {"  "}Choose "Other Service" and add details in the next step.
        </Text>
      </View>

      {/* Selected service confirmation */}
      {selectedService && (
        <View style={styles.selectedBanner}>
          <View style={styles.selectedBannerLeft}>
            <View style={styles.selectedBannerIconWrap}>
              <Ionicons name="checkmark-circle" size={24} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedBannerTitle}>{selectedService.name}</Text>
              <Text style={styles.selectedBannerSub}>Tap Continue to set your pricing and details</Text>
            </View>
          </View>
          <View style={styles.selectedBannerBadge}>
            <Ionicons name="checkmark" size={12} color={WHITE} />
            <Text style={styles.selectedBannerBadgeText}>Step 2</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Sub-components
function HeroSection({ categoryName }: { categoryName: string }) {
  return (
    <View style={styles.heroSection}>
      <Text style={styles.stageTag}>SELECT SERVICE</Text>
      <Text accessibilityRole="header" style={styles.heading}>
        What specific{" "}
        <Text style={{ color: GREEN }}>service</Text>
        {" "}do you provide?
      </Text>
      <Text style={styles.subtitle}>
        You selected <Text style={styles.subtitleBold}>{categoryName}</Text>. Now choose the service that best matches what you do.
      </Text>
    </View>
  );
}

function CategoryCard({
  categoryName,
  categoryIcon,
  onChangeCategory,
}: {
  categoryName: string;
  categoryIcon?: string;
  onChangeCategory: () => void;
}) {
  const isPlumber = /plumb/i.test(categoryName);
  const isElectrician = /electric/i.test(categoryName);
  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryCardLeft}>
        <View style={styles.categoryCardIconWrap}>
          {isPlumber ? (
            <Image
              source={require("../../../assets/images/categories/plumber.png")}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          ) : isElectrician ? (
            <Image
              source={require("../../../assets/images/categories/electrician.jpg")}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.categoryCardIconText}>{categoryIcon ?? "🛠️"}</Text>
          )}
        </View>
        <Text style={styles.categoryCardName}>{categoryName}</Text>
      </View>
      <Pressable
        onPress={onChangeCategory}
        style={styles.changeCategoryBtn}
        accessibilityRole="button"
        accessibilityLabel="Change service category"
      >
        <Text style={styles.changeCategoryText}>Change category</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },

  // Hero
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
  subtitleBold: {
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },

  // Category summary card
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  categoryCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  categoryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCardIconText: {
    fontSize: 22,
  },
  categoryCardName: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    flex: 1,
  },
  changeCategoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GREEN_SOFT,
  },
  changeCategoryText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: GREEN,
  },

  // Search
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

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
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

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },

  // Service card
  card: {
    borderRadius: 16,
    padding: 10,
    paddingVertical: 14,
    alignItems: "center",
    gap: 7,
    position: "relative",
    minHeight: 110,
    justifyContent: "center",
  },
  cardOther: {
    borderStyle: "dashed",
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    width: "100%",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
    color: TEXT_PRIMARY,
    paddingHorizontal: 2,
  },
  cardTitleSelected: {
    color: GREEN,
    fontWeight: "800",
  },
  cardTitleOther: {
    color: TEXT_SECONDARY,
    fontSize: 11,
  },
  hotBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
  },
  hotBadgeText: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 0.2,
  },
  selectedTick: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  // Skeleton
  skeletonSearch: { height: 54, borderRadius: 16, backgroundColor: "#F3F4F6" },
  skeletonCard: {
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    padding: 10,
    paddingVertical: 14,
    alignItems: "center",
    gap: 7,
    minHeight: 110,
    justifyContent: "center",
  },
  skeletonIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#E5E7EB" },
  skeletonLine: { height: 11, width: "70%", borderRadius: 6, backgroundColor: "#E5E7EB" },
  skeletonLineShort: { height: 9, width: "50%", borderRadius: 6, backgroundColor: "#ECECEC" },

  // Empty / error
  emptyState: { width: "100%", paddingVertical: 32, alignItems: "center", gap: 12 },
  errorState: { width: "100%", paddingVertical: 40, alignItems: "center", gap: 12 },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY, textAlign: "center" },
  emptyText: { fontSize: 13, color: TEXT_SECONDARY, textAlign: "center", lineHeight: 20 },
  errorTitle: { fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY, textAlign: "center" },
  errorText: { fontSize: 13, color: TEXT_SECONDARY, textAlign: "center", lineHeight: 20, maxWidth: 260 },
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
  clearSearchBtn: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  clearSearchText: { fontSize: 13, fontWeight: "700", color: TEXT_SECONDARY },

  // Helper card
  helperCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: GREEN_SOFT,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  helperText: { flex: 1, fontSize: 13, lineHeight: 19, color: "#166534", fontWeight: "500" },
  helperBold: { fontWeight: "800", color: GREEN },

  // Selection banner
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
});