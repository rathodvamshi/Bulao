import { useCallback, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  useWindowDimensions,
  TextInput,
  Animated,
  Easing,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { getNotificationInbox } from "../../api/notifications";
import { useAuth } from "../../auth";
import { useLocation } from "../../store/location";
import { Skeleton } from "../SkeletonLoader";
import { ServiceBottomNav } from "./ServiceBottomNav";
import { dash, radii } from "./palette";
import { ServiceStoryHero } from "./ServiceStoryHero";

type Period = "week" | "month" | "all";

type ServiceStats = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  completed: number;
  pendingResponses?: number;
  trends?: {
    jobsPosted: number | null;
    interested: number | null;
    hired: number | null;
    active: number | null;
  };
};

function initials(name?: string | null) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function pagePad(width: number) {
  if (width < 360) return 16;
  if (width > 420) return 22;
  return 20;
}



export default function ServiceDashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pad = pagePad(width);

  const headerHeight = insets.top + 56;
  const heroH = headerHeight + Math.min(width, 440) * 0.63 + 64;
  const [heroVisible, setHeroVisible] = useState(true);
  const auth = useAuth();
  const location = useLocation((s) => s.location);
  const [period, setPeriod] = useState<Period>("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [headerTint, setHeaderTint] = useState(0);

  const token = auth.session?.token || null;

  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () =>
      api<{ id: string; name: string; area: string; photoUrl: string | null }>("/users/me"),
  });

  const statsQuery = useQuery<ServiceStats>({
    queryKey: ["service-stats", token, period],
    queryFn: () => api<ServiceStats>(`/services/provider/stats?period=${period}`),
    enabled: !!token,
  });

  const notificationsQuery = useQuery({
    queryKey: ["service-notifications", token],
    queryFn: () => getNotificationInbox("seeker"),
    enabled: !!token,
    refetchInterval: 30000,
  });
  const { refetch: refreshNotifications } = notificationsQuery;
  useFocusEffect(useCallback(() => { void refreshNotifications(); }, [refreshNotifications]));
  const photoUrl = me.data?.photoUrl;
  const unread = !notificationsQuery.isError && (notificationsQuery.data?.unreadCount ?? 0) > 0;

  const contentWidth = Math.min(width, 560);
  const sidePad = Math.max(pad, (width - contentWidth) / 2);

  // Bulao Search Interaction State & Animations
  const [searchActive, setSearchActive] = useState(false);
  const [searchQueryText, setSearchQueryText] = useState("");
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const [recentSearches, setRecentSearches] = useState(["Electrician", "Cook", "Plumber", "AC Repair"]);

  const suggestedServices = [
    { title: "Electrician", icon: "flash-outline", color: "#D97706", bg: "#FEF3C7", category: "Electrical" },
    { title: "Plumber", icon: "water-outline", color: "#0369A1", bg: "#E0F2FE", category: "Plumbing" },
    { title: "Cook / Chef", icon: "restaurant-outline", color: "#C05621", bg: "#FFF1E4", category: "Food & Household" },
    { title: "Home Cleaner", icon: "sparkles-outline", color: "#1A7A4A", bg: "#E8F6EE", category: "Cleaning" },
    { title: "AC Repair", icon: "snow-outline", color: "#2B6CB0", bg: "#E8F1FF", category: "Appliance Repair" },
    { title: "Painter", icon: "color-palette-outline", color: "#BE185D", bg: "#FCE7F3", category: "Home Improvement" },
  ];

  const searchResults = useMemo(() => {
    if (!searchQueryText.trim()) return [];
    const q = searchQueryText.toLowerCase().trim();
    return suggestedServices.filter(
      (s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [searchQueryText]);

  const openSearch = (queryStr?: string) => {
    if (typeof queryStr === "string" && queryStr.trim()) {
      router.push({ pathname: "/service-search", params: { q: queryStr.trim() } });
    } else {
      router.push("/service-search");
    }
  };

  const closeSearch = () => {
    searchInputRef.current?.blur();
    setSearchQueryText("");
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSearchActive(false);
    });
  };

  const handleSearchSubmit = () => {
    const q = searchQueryText.trim();
    router.push({ pathname: "/service-search", params: q ? { q } : {} });
  };

  const handleSelectSearch = (term: string) => {
    router.push({ pathname: "/service-search", params: { q: term } });
  };

  const targetUpwardDistance = heroH - insets.top - 20;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent />

      {/* Main Home ScrollView (Fades out smoothly when searchAnim -> 1) */}
      <Animated.View
        style={{
          flex: 1,
          opacity: searchAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 0.4, 0],
          }),
        }}
        pointerEvents={searchActive ? "none" : "auto"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setHeaderTint(Math.min(1, Math.max(0, y / 90)));
            setHeroVisible(y < heroH - headerHeight);
          }}
          contentContainerStyle={{
            paddingBottom: 118 + Math.max(insets.bottom, 8),
          }}
        >
          <ServiceStoryHero width={width} height={heroH} headerHeight={headerHeight} visible={heroVisible} />

          {/* Reserved Space for Single Clean Search Bar */}
          <View style={{ height: 48, marginTop: -28 }} />

          <View style={{ paddingHorizontal: sidePad, marginTop: 10 }}>
            <OverviewSection
              stats={statsQuery.data}
              loading={statsQuery.isLoading}
              error={statsQuery.isError}
              period={period}
              onOpenPeriod={() => setPeriodOpen(true)}
            />
          </View>

          <View style={{ paddingHorizontal: sidePad, marginTop: 24 }}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Recent Requests</Text>
              <Pressable onPress={() => router.push("/activity")} style={styles.seeAll} accessibilityRole="button">
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color={dash.primary} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Full-Screen Dedicated Search Page Content Overlay */}
      {searchActive ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              top: insets.top + 60,
              backgroundColor: "#F8FAFC",
              zIndex: 15,
              opacity: searchAnim.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0, 1],
              }),
              transform: [
                {
                  translateY: searchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: sidePad,
              paddingTop: 16,
              paddingBottom: 120 + insets.bottom,
            }}
          >
            {!searchQueryText.trim() ? (
              <View style={{ gap: 24 }}>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <Text style={styles.searchSectionLabel}>RECENT SEARCHES</Text>
                      <Pressable onPress={() => setRecentSearches([])} hitSlop={8}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: dash.muted }}>Clear All</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {recentSearches.map((item, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => handleSelectSearch(item)}
                          style={styles.recentChip}
                        >
                          <Ionicons name="time-outline" size={13} color={dash.muted} />
                          <Text style={styles.recentChipText}>{item}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Popular Services / Categories */}
                <View>
                  <Text style={styles.searchSectionLabel}>POPULAR SERVICES & CATEGORIES</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                    {suggestedServices.map((item, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => handleSelectSearch(item.title)}
                        style={styles.popularChip}
                      >
                        <View style={[styles.popularChipIcon, { backgroundColor: item.bg }]}>
                          <Ionicons name={item.icon as any} size={15} color={item.color} />
                        </View>
                        <Text style={styles.popularChipText}>{item.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              /* Dynamic Live Search Results */
              <View>
                <Text style={styles.searchSectionLabel}>SEARCH RESULTS ({searchResults.length})</Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  {searchResults.length === 0 ? (
                    <View style={styles.searchEmptyBox}>
                      <Ionicons name="search-outline" size={42} color="#CBD5E1" />
                      <Text style={styles.searchEmptyTitle}>No matching services found</Text>
                      <Text style={styles.searchEmptySub}>Try searching for electrician, plumber, cook, or maid.</Text>
                    </View>
                  ) : (
                    searchResults.map((item, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => {
                          closeSearch();
                          router.push({ pathname: "/service-search", params: { q: searchQueryText } });
                        }}
                        style={styles.searchResultCard}
                      >
                        <View style={[styles.searchResultIconBox, { backgroundColor: item.bg }]}>
                          <Ionicons name={item.icon as any} size={20} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchResultTitle}>{item.title}</Text>
                          <Text style={styles.searchResultMeta}>{item.category}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Sticky Home Header Controls (Fades out when search becomes active) */}
      <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {headerTint > 0.08 || searchActive ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#F8FAF7",
                opacity: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [headerTint > 0.08 ? 0.55 + headerTint * 0.38 : 0, 0.98],
                }),
              },
            ]}
          />
        ) : null}

        <View style={[styles.headerRow, { paddingHorizontal: sidePad }]}>
          <Animated.View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: searchAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [1, 0.1, 0],
              }),
            }}
            pointerEvents={searchActive ? "none" : "auto"}
          >
            <View>
              <Text style={styles.logo}>Bulao</Text>
              <Text style={styles.tagline}>Local Help. Real People.</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose service area"
              onPress={() => useLocation.getState().setLocationSheetVisible(true)}
              style={styles.locationPill}
            >
              <Ionicons name="location" size={13} color={dash.primary} />
              <Text style={styles.headerLocationText} numberOfLines={1}>
                {location?.area || "Choose area"}
              </Text>
              <Ionicons name="chevron-down" size={13} color={dash.primary} />
            </Pressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.headerRight,
              {
                opacity: searchAnim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [1, 0, 0],
                }),
              },
            ]}
            pointerEvents={searchActive ? "none" : "auto"}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push({ pathname: "/notifications", params: { role: "seeker" } })}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={dash.ink} />
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* The Single Continuous Transforming Search Bar Element (Bulao Pro Search Bar) */}
      <Animated.View
        style={{
          position: "absolute",
          top: heroH - 30,
          left: sidePad,
          right: sidePad,
          zIndex: 25,
          transform: [
            {
              translateY: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -(heroH - insets.top - 36)],
              }),
            },
          ],
        }}
      >
        <View style={styles.bulaoSearchBox}>
          {/* In-Place Action Badge: Search Icon when idle, morphs to Back Arrow when active */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchActive ? "Back to Home" : "Search"}
            onPress={searchActive ? closeSearch : () => openSearch()}
            hitSlop={8}
            style={styles.bulaoSearchBadge}
          >
            <Animated.View
              style={{
                position: "absolute",
                opacity: searchAnim.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [1, 0, 0],
                }),
                transform: [
                  {
                    scale: searchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.6],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="search" size={17} color={dash.primary} />
            </Animated.View>

            <Animated.View
              style={{
                opacity: searchAnim.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0, 0, 1],
                }),
                transform: [
                  {
                    scale: searchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="arrow-back" size={20} color={dash.ink} />
            </Animated.View>
          </Pressable>

          <TextInput
            ref={searchInputRef}
            value={searchQueryText}
            onChangeText={setSearchQueryText}
            onFocus={() => openSearch()}
            placeholder="Search services, workers, categories..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            style={styles.bulaoInputText}
          />

          {searchQueryText.length > 0 ? (
            <Pressable onPress={() => setSearchQueryText("")} hitSlop={6} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <ServiceBottomNav active="home" />

      <PeriodSheet
        visible={periodOpen}
        current={period}
        onClose={() => setPeriodOpen(false)}
        onSelect={(next) => {
          setPeriod(next);
          setPeriodOpen(false);
        }}
      />
    </View>
  );
}

function RequestServiceCTA() {
  const [query, setQuery] = useState("");

  const handleSearchSubmit = () => {
    const q = query.trim();
    if (q) {
      router.push({ pathname: "/service-search", params: { q } });
    } else {
      router.push({ pathname: "/service-search", params: { q } });
    }
  };

  return (
    <View style={styles.ctaOuter}>
      <View style={styles.ctaCardInner}>
        <View style={styles.ctaHeaderRow}>
          <View style={styles.ctaBadgeIcon}>
            <Ionicons name="paper-plane" size={12} color="#FFFFFF" />
          </View>
          <Text style={styles.ctaTitle}>Request a Service</Text>
          <Text style={styles.ctaSub}>Fast & Verified Local Help</Text>
        </View>

        <View style={styles.ctaSearchBox}>
          <Ionicons name="search" size={17} color={dash.primary} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => router.push("/service-search")}
            placeholder="Search service e.g. Electrician, Cook..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            onSubmitEditing={() => router.push({ pathname: "/service-search", params: query ? { q: query } : {} })}
            style={styles.ctaSearchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request service button"
            onPress={handleSearchSubmit}
            style={styles.ctaSubmitBtn}
          >
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function OverviewSection({
  stats,
  loading,
  error,
  period,
  onOpenPeriod,
}: {
  stats?: ServiceStats;
  loading: boolean;
  error: boolean;
  period: Period;
  onOpenPeriod: () => void;
}) {
  const periodLabel = period === "week" ? "This Week" : period === "all" ? "All time" : "This Month";
  const cards = [
    {
      key: "posted" as const,
      label: "Active Requests",
      value: stats?.active ?? 0,
      bg: "#F2FDF5",
      borderColor: "#DCFCE7",
      iconBg: "#FFFFFF",
      haloColor: "#10B981",
      icon: "document-text" as const,
      iconColor: "#059669",
      filter: "active",
    },
    {
      key: "responses" as const,
      label: "Responses",
      value: stats?.interested ?? 0,
      bg: "#F0F6FF",
      borderColor: "#DBEAFE",
      iconBg: "#FFFFFF",
      haloColor: "#3B82F6",
      icon: "people" as const,
      iconColor: "#2563EB",
      filter: "interested",
    },
    {
      key: "hired" as const,
      label: "Booked",
      value: stats?.hired ?? 0,
      bg: "#FFFDF0",
      borderColor: "#FEF3C7",
      iconBg: "#FFFFFF",
      haloColor: "#F59E0B",
      icon: "person" as const,
      iconColor: "#D97706",
      filter: "hired",
    },
    {
      key: "completed" as const,
      label: "Completed",
      value: stats?.completed ?? 0,
      bg: "#FFF1F2",
      borderColor: "#FFE4E6",
      iconBg: "#EF4444",
      haloColor: "#EF4444",
      icon: "checkmark" as const,
      iconColor: "#FFFFFF",
      filter: "completed",
    },
  ];

  return (
    <View>
      <View style={styles.sectionHead}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.sparkleIcon}>
              <Ionicons name="sparkles" size={15} color="#10B981" />
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>Your activity at a glance</Text>
        </View>
        <Pressable onPress={onOpenPeriod} style={styles.periodBtn} accessibilityRole="button">
          <Text style={styles.periodText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={dash.muted} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={22} color={dash.error} />
          <Text style={styles.errorText}>Couldn't load overview</Text>
        </View>
      ) : loading ? (
        <View style={styles.statsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: dash.white, borderColor: dash.border }]}>
              <View style={[styles.iconBadge, { backgroundColor: "#F3F4F6", borderColor: "#FFFFFF" }]}>
                <Skeleton width={16} height={16} borderRadius={8} />
              </View>
              <Skeleton width={28} height={20} borderRadius={6} style={{ marginBottom: 4 }} />
              <Skeleton width="80%" height={10} borderRadius={4} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.statsRow}>
          {cards.map((card) => {
            return (
              <View
                key={card.key}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: card.bg,
                    borderColor: card.borderColor,
                  },
                ]}
              >
                {/* Floating Icon badge at top-left corner */}
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: card.iconBg,
                      borderColor: card.iconBg === "#EF4444" ? "#FFE4E6" : "#FFFFFF",
                      shadowColor: card.haloColor,
                    },
                  ]}
                >
                  <Ionicons name={card.icon} size={15} color={card.iconColor} />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/activity?filter=${card.filter}`)}
                  style={({ pressed }) => [
                    styles.statCardInner,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {/* Value */}
                  <Text style={styles.statValue}>{card.value}</Text>

                  {/* Label */}
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {card.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function PeriodSheet({
  visible,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: Period;
  onClose: () => void;
  onSelect: (period: Period) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Overview period</Text>
          {(
            [
              ["month", "This Month"],
              ["week", "This Week"],
              ["all", "All time"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => onSelect(id)}
              style={[styles.sheetRow, current === id && styles.sheetRowActive]}
            >
              <Text style={[styles.sheetRowText, current === id && { color: dash.primary }]}>
                {label}
              </Text>
              {current === id ? <Ionicons name="checkmark" size={18} color={dash.primary} /> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dash.bg,
  },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    left: 0,
    top: 0,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  tagline: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "600",
    color: "#03402D",
    letterSpacing: 0.2,
  },
  locationPill: {
    flex: 1,
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  headerLocationText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto", // always pinned to the far right corner
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E24B4B",
    borderWidth: 1,
    borderColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  avatarText: {
    color: dash.white,
    fontWeight: "800",
    fontSize: 13,
  },
  ctaOuter: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    borderRadius: 20,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
    shadowColor: "#03402D",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaCardInner: {
    backgroundColor: "#03402D",
    borderRadius: 17,
    padding: 12,
    gap: 10,
  },
  ctaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaBadgeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  ctaSub: {
    marginLeft: "auto",
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  ctaSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  ctaSearchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0F172A",
    height: "100%",
    paddingVertical: 0,
  },
  ctaSubmitBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0B3524",
    letterSpacing: -0.4,
  },
  sparkleIcon: {
    transform: [{ rotate: "12deg" }],
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  periodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: dash.white,
    borderWidth: 1,
    borderColor: dash.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "700",
    color: dash.ink,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    overflow: "visible",
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "visible",
    paddingTop: 22,
    paddingBottom: 12,
    paddingHorizontal: 8,
    minHeight: 88,
    justifyContent: "center",
  },
  statCardInner: {
    flex: 1,
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    top: -14,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    marginTop: 2,
    lineHeight: 14,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: dash.primary,
  },
  jobCard: {
    borderRadius: 16,
    backgroundColor: dash.white,
    borderWidth: 2,
    borderColor: "#E8F5F0",
    shadowColor: dash.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  jobCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  jobRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
  },
  jobIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  jobIconEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  jobContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  jobTitleNew: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: dash.ink,
    letterSpacing: -0.15,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: dash.muted,
    fontWeight: "500",
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: dash.border,
  },
  applicationsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  applicationsText: {
    fontSize: 11,
    lineHeight: 15,
    color: dash.muted,
    fontWeight: "600",
  },
  menuBtnNew: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  emptyCard: {
    backgroundColor: dash.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: dash.border,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: dash.softGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  emptyCopy: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: dash.muted,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: dash.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: dash.white,
    fontWeight: "800",
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: dash.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "#F8D4D4",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: dash.ink,
    fontWeight: "600",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,42,42,0.28)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: dash.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: dash.ink,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  sheetRowActive: {
    backgroundColor: dash.softGreen,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: "600",
    color: dash.ink,
  },
  searchSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  recentChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  popularChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  popularChipText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchResultIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  searchResultMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  searchRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  searchRatingText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#D97706",
  },
  searchEmptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  searchEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 12,
  },
  searchEmptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  bulaoSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    height: 52,
    paddingLeft: 10,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bulaoSearchBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6F4EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bulaoInputText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.2,
    height: "100%",
    paddingVertical: 0,
  },
});
