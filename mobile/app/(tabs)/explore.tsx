import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Catalog, Job, Professional } from "../../src/api/types";
import { useLocation } from "../../src/store/location";

const THEME = {
  green: "#176B58",
  greenDark: "#0F5041",
  greenLight: "#E8F5EE",
  greenBorder: "#C2DDD0",
  paper: "#F5F8F6",
  white: "#FFFFFF",
  ink: "#0D2318",
  muted: "#4F6558",
  line: "#DCE6E0",
  sand: "#FAF3EB",
  sandBorder: "#EADDCF",
  sandText: "#6E4C2C",
  amber: "#D97706",
  amberLight: "#FEF3C7",
};

const RADIUS_OPTIONS = [3, 5, 10, 25, 50] as const;

export default function Explore() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === "service" ? "service" : "job";
  const location = useLocation((x) => x.location);
  const setLocationSheetVisible = useLocation((x) => x.setLocationSheetVisible);

  const [radius, setRadius] = useState<number>(5);
  const [category, setCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Catalog>("/categories"),
    staleTime: 86400000,
  });

  const list = useInfiniteQuery({
    queryKey: ["nearby", kind, location?.latitude, location?.longitude, radius, category],
    enabled: !!location,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ items: (Job & Professional)[]; nextCursor: number | null }>(
        `/${kind === "job" ? "jobs" : "services"}?latitude=${location!.latitude}&longitude=${location!.longitude}&radiusKm=${radius}&cursor=${pageParam}${category ? `&categoryId=${encodeURIComponent(category)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const allRows = list.data?.pages.flatMap((p) => p.items) ?? [];

  // Filter items in real time based on user search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase().trim();
    return allRows.filter((item) => {
      const titleMatch = (item.title || "").toLowerCase().includes(q);
      const catMatch = (item.category || "").toLowerCase().includes(q);
      const areaMatch = (item.area || "").toLowerCase().includes(q);
      return titleMatch || catMatch || areaMatch;
    });
  }, [allRows, searchQuery]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await list.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleKindSwitch = (newKind: "service" | "job") => {
    if (newKind !== kind) {
      setCategory("");
      setSearchQuery("");
      router.setParams({ kind: newKind });
    }
  };

  const categoriesList = catalog.data?.categories.filter((c) => c.kind === kind) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* ── TOP APP BAR ────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.brandWrap}>
          <Text style={styles.brandTitle}>
            bulao
            <Text style={styles.brandDot}> ●</Text>
          </Text>
        </View>

        {/* Location Selector Pill */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change area: ${location?.area || "Choose Area"}`}
          onPress={() => setLocationSheetVisible(true)}
          style={({ pressed }) => [
            styles.locationPill,
            pressed && styles.pillPressed,
          ]}
        >
          <Ionicons name="location-sharp" size={14} color={THEME.green} />
          <Text style={styles.locationText} numberOfLines={1}>
            {location?.area || "Choose Area"}
          </Text>
          <Ionicons name="chevron-down" size={12} color={THEME.muted} />
        </Pressable>
      </View>

      {/* ── KIND SWITCHER (SERVICES VS JOBS) ───────────────── */}
      <View style={styles.switcherContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse local trade services"
          onPress={() => handleKindSwitch("service")}
          style={[
            styles.switchButton,
            kind === "service" && styles.switchButtonActiveService,
          ]}
        >
          <Ionicons
            name="construct-outline"
            size={16}
            color={kind === "service" ? THEME.sandText : THEME.muted}
          />
          <Text
            style={[
              styles.switchText,
              kind === "service" && styles.switchTextActiveService,
            ]}
          >
            Local Services
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse nearby daily jobs"
          onPress={() => handleKindSwitch("job")}
          style={[
            styles.switchButton,
            kind === "job" && styles.switchButtonActiveJob,
          ]}
        >
          <Ionicons
            name="briefcase-outline"
            size={16}
            color={kind === "job" ? THEME.green : THEME.muted}
          />
          <Text
            style={[
              styles.switchText,
              kind === "job" && styles.switchTextActiveJob,
            ]}
          >
            Daily Jobs
          </Text>
        </Pressable>
      </View>

      {/* ── SEARCH BAR ──────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={THEME.green} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              kind === "service"
                ? "Search electricians, plumbers, painters..."
                : "Search daily helpers, workers, tasks..."
            }
            placeholderTextColor="#8CA296"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery("")}
              style={styles.searchClearBtn}
            >
              <Ionicons name="close-circle" size={18} color={THEME.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── RADIUS FILTERS ──────────────────────────────────── */}
      <View style={styles.radiusRow}>
        <Text style={styles.radiusHeading}>Radius:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.radiusList}
        >
          {RADIUS_OPTIONS.map((km) => {
            const isSelected = radius === km;
            return (
              <Pressable
                key={km}
                accessibilityRole="button"
                accessibilityLabel={`Within ${km} kilometers`}
                onPress={() => setRadius(km)}
                style={[
                  styles.radiusPill,
                  isSelected && styles.radiusPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.radiusPillText,
                    isSelected && styles.radiusPillTextActive,
                  ]}
                >
                  {km} km
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CATEGORY FILTERS ────────────────────────────────── */}
      <View style={styles.categoryRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="All categories"
            onPress={() => setCategory("")}
            style={[
              styles.categoryPill,
              !category && styles.categoryPillActive,
            ]}
          >
            <Text
              style={[
                styles.categoryPillText,
                !category && styles.categoryPillTextActive,
              ]}
            >
              All {kind === "service" ? "Services" : "Work"}
            </Text>
          </Pressable>

          {categoriesList.map((c) => {
            const isSelected = category === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Category ${c.name}`}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillActive,
                ]}
              >
                <Text style={styles.categoryEmoji}>{c.icon || "🔧"}</Text>
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT FEED ────────────────────────────────────── */}
      <View style={styles.feedWrap}>
        {!location ? (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={44} color={THEME.green} />
            <Text style={styles.emptyTitle}>Location Needed</Text>
            <Text style={styles.emptySubtitle}>
              Please select your neighborhood to see available services and professionals nearby.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLocationSheetVisible(true)}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionText}>Select Area</Text>
            </Pressable>
          </View>
        ) : list.isPending ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={THEME.green} />
            <Text style={styles.loadingText}>
              Discovering {kind === "service" ? "local professionals" : "nearby jobs"}...
            </Text>
          </View>
        ) : list.isError ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={44} color="#E53E3E" />
            <Text style={styles.emptyTitle}>Failed to Load</Text>
            <Text style={styles.emptySubtitle}>
              Could not load results. Please check your network and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void list.refetch()}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name={kind === "service" ? "construct-outline" : "briefcase-outline"}
              size={48}
              color={THEME.muted}
            />
            <Text style={styles.emptyTitle}>
              No {kind === "service" ? "services" : "jobs"} found nearby
            </Text>
            <Text style={styles.emptySubtitle}>
              Try expanding your radius to 10 km or 25 km, or choose another category.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRadius(25)}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionText}>Expand to 25 km</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredRows}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[THEME.green]}
                tintColor={THEME.green}
              />
            }
            renderItem={({ item }) => {
              if (kind === "service") {
                const initial = (item.title || "P").trim().charAt(0).toUpperCase();
                const displayArea = item.area || "Neighborhood";
                const displayDistance = item.distanceKm
                  ? `${Math.round(item.distanceKm * 10) / 10} km away`
                  : "Nearby";

                return (
                  <View style={styles.serviceCard}>
                    <View style={styles.serviceHeaderRow}>
                      {/* Avatar with initial */}
                      <View style={styles.avatarWrap}>
                        <Text style={styles.avatarInitial}>{initial}</Text>
                        <View style={styles.avatarBadge}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      </View>

                      {/* Pro Info */}
                      <View style={styles.serviceTitleWrap}>
                        <View style={styles.serviceNameRow}>
                          <Text style={styles.serviceTitle} numberOfLines={1}>
                            {item.title || "Local Professional"}
                          </Text>
                        </View>

                        <View style={styles.badgeRow}>
                          <View style={styles.serviceCatBadge}>
                            <Text style={styles.serviceCatText}>
                              {item.category || "Home Service"}
                            </Text>
                          </View>

                          {item.rating ? (
                            <View style={styles.ratingBadge}>
                              <Ionicons name="star" size={11} color="#D97706" />
                              <Text style={styles.ratingText}>
                                {item.rating}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.ratingBadge}>
                              <Text style={styles.ratingTextNew}>★ New</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Meta Row: Area, Distance, Experience */}
                    <View style={styles.serviceMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={13} color={THEME.muted} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {displayArea} · {displayDistance}
                        </Text>
                      </View>

                      {item.completed ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="checkmark-done-outline" size={13} color={THEME.green} />
                          <Text style={styles.metaText}>
                            {item.completed} completed
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Bottom Action Row */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.trustPill}>
                        <Ionicons name="shield-checkmark" size={12} color={THEME.green} />
                        <Text style={styles.trustPillText}>Direct Contact</Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Request service from ${item.title}`}
                        onPress={() =>
                          router.push({
                            pathname: "/profile/[id]",
                            params: {
                              id: item.userId,
                              serviceId: item.id,
                              name: item.title,
                              category: item.category,
                            },
                          })
                        }
                        style={({ pressed }) => [
                          styles.serviceActionBtn,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <Text style={styles.serviceActionBtnText}>Contact</Text>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                );
              }

              // Otherwise render Job Card
              const payRupees = Math.round((item.payPaise || 0) / 100);
              const displayArea = item.area || "Neighborhood";
              const displayDistance = item.distanceKm
                ? `${Math.round(item.distanceKm * 10) / 10} km away`
                : "Nearby";

              return (
                <View style={styles.jobCard}>
                  <View style={styles.jobHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.jobTitle} numberOfLines={2}>
                        {item.title || "Work Opportunity"}
                      </Text>
                      <View style={styles.jobRoleBadge}>
                        <Text style={styles.jobRoleText}>
                          {item.category || "General Work"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.payBadge}>
                      <Text style={styles.payBadgeText}>
                        ₹{payRupees}
                      </Text>
                      <Text style={styles.payBadgeUnit}>
                        /{item.payUnit || "day"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.serviceMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={13} color={THEME.muted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {displayArea} · {displayDistance}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooterRow}>
                    <View style={styles.trustPill}>
                      <Ionicons name="flash-outline" size={12} color={THEME.green} />
                      <Text style={styles.trustPillText}>Daily Wage Work</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View job details: ${item.title}`}
                      onPress={() => router.push(`/jobs/${item.id}`)}
                      style={({ pressed }) => [
                        styles.jobActionBtn,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text style={styles.jobActionBtnText}>View Details</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              list.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={list.isFetchingNextPage}
                  onPress={() => void list.fetchNextPage()}
                  style={styles.loadMoreBtn}
                >
                  {list.isFetchingNextPage ? (
                    <ActivityIndicator size="small" color={THEME.green} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More</Text>
                  )}
                </Pressable>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.paper,
  },

  /* ── Top Bar ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    backgroundColor: THEME.paper,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: THEME.green,
  },
  brandDot: {
    color: "#B3CF5C",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.white,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: THEME.line,
    maxWidth: "55%",
    gap: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1.5 },
    }),
  },
  pillPressed: {
    opacity: 0.7,
  },
  locationText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: THEME.ink,
    flexShrink: 1,
  },

  /* ── Kind Switcher ── */
  switcherContainer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  switchButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: THEME.line,
    backgroundColor: THEME.white,
  },
  switchButtonActiveService: {
    backgroundColor: THEME.sand,
    borderColor: THEME.sandBorder,
  },
  switchButtonActiveJob: {
    backgroundColor: THEME.greenLight,
    borderColor: THEME.greenBorder,
  },
  switchText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: THEME.muted,
  },
  switchTextActiveService: {
    color: THEME.sandText,
    fontWeight: "800",
  },
  switchTextActiveJob: {
    color: THEME.green,
    fontWeight: "800",
  },

  /* ── Search Bar ── */
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: THEME.line,
    backgroundColor: THEME.white,
    paddingHorizontal: 14,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: THEME.ink,
    paddingVertical: 10,
  },
  searchClearBtn: {
    padding: 4,
  },

  /* ── Radius Row ── */
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  radiusHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.muted,
  },
  radiusList: {
    gap: 6,
  },
  radiusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: THEME.line,
    backgroundColor: THEME.white,
  },
  radiusPillActive: {
    backgroundColor: THEME.green,
    borderColor: THEME.green,
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.ink,
  },
  radiusPillTextActive: {
    color: "#FFFFFF",
  },

  /* ── Category Row ── */
  categoryRow: {
    paddingVertical: 6,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: THEME.line,
    backgroundColor: THEME.white,
  },
  categoryPillActive: {
    backgroundColor: THEME.green,
    borderColor: THEME.green,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryPillText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: THEME.ink,
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
  },

  /* ── Feed Container ── */
  feedWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 14,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.muted,
  },

  /* ── Service Card ── */
  serviceCard: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: THEME.line,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2.5 },
    }),
  },
  serviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: THEME.sand,
    borderWidth: 1.5,
    borderColor: THEME.sandBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.sandText,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: THEME.white,
  },
  serviceTitleWrap: {
    flex: 1,
    gap: 4,
  },
  serviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: THEME.ink,
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  serviceCatBadge: {
    backgroundColor: THEME.sand,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.sandBorder,
  },
  serviceCatText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.sandText,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: THEME.amberLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.amber,
  },
  ratingTextNew: {
    fontSize: 10.5,
    fontWeight: "700",
    color: THEME.muted,
  },
  serviceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: THEME.muted,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(23, 107, 88, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trustPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.green,
  },
  serviceActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2C2621",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  serviceActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  /* ── Job Card in Explore ── */
  jobCard: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: THEME.line,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2.5 },
    }),
  },
  jobHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  jobTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: THEME.ink,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  jobRoleBadge: {
    alignSelf: "flex-start",
    backgroundColor: THEME.greenLight,
    borderWidth: 1,
    borderColor: THEME.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  jobRoleText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.green,
  },
  payBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: THEME.greenLight,
    borderWidth: 1,
    borderColor: THEME.greenBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  payBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.green,
  },
  payBadgeUnit: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.green,
    marginLeft: 1,
  },
  jobActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.green,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  jobActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ── Empty Card ── */
  emptyCard: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: THEME.line,
    padding: 32,
    marginHorizontal: 16,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: THEME.muted,
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },
  emptyActionBtn: {
    backgroundColor: THEME.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyActionText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ── Pagination ── */
  loadMoreBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: THEME.line,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: THEME.green,
  },
});
