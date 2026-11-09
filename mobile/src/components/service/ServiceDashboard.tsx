import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  useWindowDimensions,
  Animated,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { getNotificationInbox } from "../../api/notifications";
import { useAuth } from "../../auth";
import { useLocation } from "../../store/location";
import { Skeleton } from "../SkeletonLoader";
import { ServiceBottomNav } from "./ServiceBottomNav";
import { dash, radii } from "./palette";
import { ServiceStoryHero } from "./ServiceStoryHero";
import { BulaoWordmark } from "../BulaoWordmark";
import { useRotatingSearchHint } from "./useRotatingSearchHint";

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

type RecentRequest = {
  id: string;
  kind: string;
  status: string;
  isServiceListing: boolean;
  workerId?: string;
  ownerId?: string;
  title: string;
  categoryName?: string;
  otherName: string;
  area: string;
  createdAt: number;
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
  const client = useQueryClient();
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

  const recentDataQuery = useQuery<{
    customerRequests: RecentRequest[];
    myServices: RecentRequest[];
  }>({
    queryKey: ["service-dashboard-recent-split", token],
    queryFn: async () => {
      let allItems: any[] = [];
      try {
        const recent = await api<any[]>("/services/provider/recent");
        if (Array.isArray(recent)) {
          allItems = recent;
        }
      } catch (err) {
        console.warn("[ServiceDashboard] /services/provider/recent fetch:", err);
      }

      if (allItems.length === 0) {
        try {
          const mine = await api<any[]>("/services/mine");
          if (Array.isArray(mine)) {
            allItems = mine.map((s) => ({
              ...s,
              applicantCount: 0,
              status: s.available ? "PUBLISHED" : "PAUSED",
            }));
          }
        } catch {
          // ignore
        }
      }

      const customerRequests: RecentRequest[] = [];
      const myServices: RecentRequest[] = [];

      for (const item of allItems) {
        const isListing =
          item.applicantCount === 0 ||
          item.status === "PUBLISHED" ||
          item.status === "PAUSED";

        const mapped: RecentRequest = {
          id: item.id,
          kind: "service",
          status: item.status || (isListing ? "PUBLISHED" : "PENDING"),
          isServiceListing: isListing,
          workerId: item.workerId || "",
          ownerId: item.ownerId || "",
          title: item.title || item.categoryName || "Service",
          categoryName: item.categoryName || "Service",
          otherName: item.otherName || "Customer",
          area: item.area || "Local area",
          createdAt: item.createdAt || Date.now(),
        };

        if (isListing) {
          myServices.push(mapped);
        } else {
          customerRequests.push(mapped);
        }
      }

      return {
        customerRequests: customerRequests.slice(0, 5),
        myServices: myServices.slice(0, 5),
      };
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const customerRequests = recentDataQuery.data?.customerRequests || [];
  const myServices = recentDataQuery.data?.myServices || [];

  const notificationsQuery = useQuery({
    queryKey: ["service-notifications", token],
    queryFn: () => getNotificationInbox("provider", "service"),
    enabled: !!token,
    staleTime: 30000,
  });

  useFocusEffect(
    useCallback(() => {
      if (token) {
        void Promise.allSettled([
          client.invalidateQueries({ queryKey: ["service-notifications", token] }),
          client.invalidateQueries({ queryKey: ["service-recent-data", token] }),
          client.invalidateQueries({ queryKey: ["service-stats", token] }),
        ]);
      }
    }, [token, client]),
  );
  const photoUrl = me.data?.photoUrl;
  const unread = !notificationsQuery.isError && (notificationsQuery.data?.unreadCount ?? 0) > 0;

  const contentWidth = Math.min(width, 560);
  const sidePad = Math.max(pad, (width - contentWidth) / 2);
  const locationPillWidth = Math.max(112, Math.min(195, width - 2 * (sidePad + 70 + 8)));

  const { hint: searchHint, opacity: searchHintOpacity } = useRotatingSearchHint(location?.area);

  const openSearch = () => router.push("/service-search");

  const targetUpwardDistance = heroH - insets.top - 20;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent />

      <Animated.ScrollView
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

          <View style={{ paddingHorizontal: sidePad, marginTop: -28, marginBottom: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search services, workers, and categories"
              onPress={() => openSearch()}
              style={styles.homeSearchBox}
            >
              <View style={styles.homeSearchIcon}>
                <Ionicons name="search" size={18} color={dash.primary} />
              </View>
              <View style={styles.homeSearchHintClip}>
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    styles.homeSearchPlaceholder,
                    {
                      opacity: searchHintOpacity,
                      transform: [
                        {
                          translateY: searchHintOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [5, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {searchHint}
                </Animated.Text>
              </View>
            </Pressable>
          </View>

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
              <Pressable onPress={() => router.push("/service-requests")} style={styles.seeAll} accessibilityRole="button">
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color={dash.primary} />
              </Pressable>
            </View>
            {recentDataQuery.isLoading ? (
              <View style={styles.recentEmptyCard}>
                <Skeleton width="48%" height={16} borderRadius={6} />
                <Skeleton width="72%" height={13} borderRadius={6} />
              </View>
            ) : recentDataQuery.isError ? (
              <View style={styles.recentEmptyCard}>
                <Text style={styles.recentEmptyTitle}>Couldn’t load recent requests</Text>
                <Pressable onPress={() => void recentDataQuery.refetch()}><Text style={styles.recentRetry}>Try again</Text></Pressable>
              </View>
            ) : customerRequests.length > 0 ? (
              <View style={styles.recentRequestList}>
                {customerRequests.map((request) => (
                  <Pressable
                    key={request.id}
                    style={styles.recentRequestCard}
                    onPress={() =>
                      router.push({
                        pathname: "/requests/[id]",
                        params: { id: request.id },
                      })
                    }
                  >
                    <View style={styles.recentEmptyIcon}>
                      <Ionicons name="mail" size={19} color={dash.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentRequestTitle} numberOfLines={1}>{request.title}</Text>
                      <Text style={styles.recentRequestMeta} numberOfLines={1}>
                        {request.otherName ? `${request.otherName} · ` : ""}{request.area}
                      </Text>
                    </View>
                    <View style={styles.requestStatusBadge}>
                      <Text style={styles.requestStatusText}>{request.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={dash.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.recentEmptyCard}>
                <View style={styles.recentEmptyIcon}><Ionicons name="mail-unread-outline" size={26} color={dash.primary} /></View>
                <Text style={styles.recentEmptyTitle}>No requests yet</Text>
                <Text style={styles.recentEmptyCopy} numberOfLines={2}>Customer bookings and service requests will appear here.</Text>
                <Pressable onPress={() => router.push("/service-requests")} style={styles.recentExplore} accessibilityRole="button">
                  <Ionicons name="reader-outline" size={17} color={dash.white} />
                  <Text style={styles.recentExploreText}>View All Requests</Text>
                </Pressable>
              </View>
            )}

            {/* Premium Pro Level: Your Listed Active Services */}
            {myServices.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <View style={styles.subSectionHead}>
                  <View style={styles.activeServicesTitleRow}>
                    <Text style={styles.subSectionTitle}>Active Services</Text>
                    <View style={styles.activeServiceCount}>
                      <Text style={styles.activeServiceCountText}>{myServices.length}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => router.push("/service-profile")}
                    style={styles.manageServicesLink}
                    accessibilityRole="button"
                    accessibilityLabel="Manage your service profile"
                  >
                    <Text style={styles.manageServicesLinkText}>Manage</Text>
                    <Ionicons name="chevron-forward" size={12} color="#047857" />
                  </Pressable>
                </View>

                <View style={styles.servicesGrid}>
                  {myServices.map((svc) => (
                    <View key={svc.id} style={styles.proServiceCard}>
                      <View style={styles.proServiceIconBox}>
                        <Ionicons name="construct" size={20} color="#047857" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.proServiceTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {svc.title}
                        </Text>
                        <View style={styles.proServiceMetaRow}>
                          <Ionicons name="location-outline" size={12} color="#7B8B82" />
                          <Text style={styles.proServiceMeta} numberOfLines={1}>
                            {svc.categoryName ? `${svc.categoryName} · ` : ""}{svc.area || "Local service"}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/service-requests",
                            params: { tab: "received", serviceId: svc.id },
                          })
                        }
                        style={styles.btnViewRequestsPill}
                        accessibilityRole="button"
                        accessibilityLabel={`View requests for ${svc.title}`}
                        hitSlop={4}
                      >
                        <Ionicons name="mail-unread-outline" size={13} color="#047857" />
                        <Text style={styles.btnViewRequestsPillText}>Requests</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </Animated.ScrollView>

      {/* Sticky Home Header Controls */}
      <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {headerTint > 0.08 ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#FFFFFF",
                opacity: 0.55 + headerTint * 0.38,
              },
            ]}
          />
        ) : null}

        <View style={[styles.headerRow, { marginHorizontal: sidePad }]}>
          <View style={styles.headerLeft}>
            <BulaoWordmark size={width < 320 ? 18 : 21} color="#03402D" align="flex-start" />
          </View>

          <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose service area: ${location?.area || "Choose area"}`}
              onPress={() => useLocation.getState().setLocationSheetVisible(true)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              android_ripple={{ color: "rgba(7, 91, 67, 0.12)", borderless: false }}
              style={[styles.locationPill, styles.centeredLocationPill, { width: locationPillWidth, marginLeft: -locationPillWidth / 2 }]}
            >
              {/* Liquid Glass: Sheer Backdrop Blur */}
              <BlurView
                intensity={Platform.OS === "android" ? 25 : 45}
                tint="light"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              {/* Liquid Glass: Completely Transparent Glass Sheen */}
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.22)",
                  "rgba(255, 255, 255, 0.04)",
                  "rgba(255, 255, 255, 0.08)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              {/* Liquid Glass: Specular Top Rim Glint */}
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.65)", "rgba(255, 255, 255, 0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.liquidGlint}
                pointerEvents="none"
              />

              <Ionicons name="location-sharp" size={14} color={dash.primary} style={styles.locationPin} />
              <View style={styles.locationTextContainer}>
                <Text
                  style={styles.headerLocationText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {location?.area || "Choose area"}
                </Text>
              </View>
              <View style={styles.chevronWrapper}>
                <Ionicons name="chevron-down" size={11} color={dash.primary} style={styles.locationChevron} />
              </View>
          </Pressable>

          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push({ pathname: "/notifications", params: { role: "provider", context: "service" } })}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={dash.ink} />
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          </View>
        </View>
      </View>

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
      bg: "#FFFCF7",
      borderColor: "#EEE4D7",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "document-text" as const,
      iconColor: "#087653",
      filter: "active",
    },
    {
      key: "responses" as const,
      label: "Responses",
      value: stats?.interested ?? 0,
      bg: "#FFFCF7",
      borderColor: "#EEE4D7",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "people" as const,
      iconColor: "#087653",
      filter: "interested",
    },
    {
      key: "hired" as const,
      label: "Booked",
      value: stats?.hired ?? 0,
      bg: "#FFFCF7",
      borderColor: "#EEE4D7",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "person" as const,
      iconColor: "#087653",
      filter: "hired",
    },
    {
      key: "completed" as const,
      label: "Completed",
      value: stats?.completed ?? 0,
      bg: "#FFFCF7",
      borderColor: "#EEE4D7",
      iconBg: "#FFFFFF",
      haloColor: "#087653",
      icon: "checkmark" as const,
      iconColor: "#087653",
      filter: "completed",
    },
  ];

  return (
    <View>
      <View style={styles.sectionHead}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Overview</Text>
          </View>
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
                      borderColor: "#FFFFFF",
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
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
    position: "relative",
    height: 44,
    alignItems: "center",
  },
  headerLeft: { position: "absolute", left: 0, top: 0, bottom: 0, justifyContent: "center", zIndex: 2 },
  centeredLocationPill: { position: "absolute", left: "50%", top: 2, flex: 0, zIndex: 1 },
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
    maxWidth: 195,
    minWidth: 0,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderTopColor: "rgba(255, 255, 255, 0.8)",
    borderBottomColor: "rgba(255, 255, 255, 0.3)",
    overflow: "hidden",
  },
  liquidGlint: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 1.5,
    borderRadius: 1,
  },
  locationPin: {
    flexShrink: 0,
  },
  locationTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginHorizontal: 6,
  },
  headerLocationText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F2E23",
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  chevronWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 91, 67, 0.06)",
    flexShrink: 0,
  },
  locationChevron: {
    flexShrink: 0,
  },
  headerRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
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
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dash.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  avatarText: {
    color: dash.white,
    fontWeight: "800",
    fontSize: 13,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
    lineHeight: 26,
    includeFontPadding: false,
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
    marginTop: 8,
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
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    marginTop: 3,
    lineHeight: 13,
    includeFontPadding: false,
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
  recentEmptyCard: {
    marginTop: 4,
    borderRadius: radii.card,
    backgroundColor: dash.white,
    borderWidth: 1,
    borderColor: dash.border,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 2,
  },
  recentEmptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: dash.softGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recentEmptyTitle: { fontSize: 18, fontWeight: "800", color: dash.ink, textAlign: "center" },
  recentEmptyCopy: { fontSize: 14, lineHeight: 20, color: dash.muted, marginTop: 6, textAlign: "center" },
  recentRetry: { fontSize: 12, fontWeight: "700", color: dash.primary },
  recentExplore: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: dash.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  recentExploreText: { fontSize: 14, fontWeight: "800", color: dash.white },
  recentRequestList: { gap: 10, marginTop: 4 },
  recentRequestCard: {
    minHeight: 72,
    padding: 13,
    borderRadius: 16,
    backgroundColor: dash.white,
    borderWidth: 1,
    borderColor: "#E8F5F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  recentRequestTitle: { fontSize: 14, fontWeight: "800", color: "#173B2B" },
  recentRequestMeta: { fontSize: 12, color: dash.muted, marginTop: 4 },
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
    shadowColor: "#173A2D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 18,
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
  homeSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    height: 54,
    paddingHorizontal: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5ECE8",
    shadowColor: "#153B2C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 9,
    elevation: 3,
  },
  homeSearchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6F4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  homeSearchHintClip: { flex: 1, height: 22, justifyContent: "center", overflow: "hidden" },
  homeSearchPlaceholder: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: "#74857D",
    letterSpacing: -0.1,
    lineHeight: 19,
  },
  subSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  activeServicesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  subSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.25,
    includeFontPadding: false,
  },
  activeServiceCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#EAF4EE",
  },
  activeServiceCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#087653",
  },
  manageServicesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  manageServicesLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  servicesGrid: {
    gap: 10,
  },
  proServiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    shadowColor: "#086649",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 6,
    elevation: 1,
  },
  proServiceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF7F1",
    borderWidth: 1,
    borderColor: "#E1EEE4",
    alignItems: "center",
    justifyContent: "center",
  },
  proServiceTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#111827",
  },
  proServiceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
    minWidth: 0,
  },
  proServiceMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "500",
    color: "#718078",
  },
  btnViewRequestsPill: {
    flexDirection: "row",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#F0F8F2",
    borderWidth: 1,
    borderColor: "#DCEBE0",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  btnViewRequestsPillText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    color: "#086649",
  },
  requestStatusBadge: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  requestStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
    textTransform: "capitalize",
  },
});
