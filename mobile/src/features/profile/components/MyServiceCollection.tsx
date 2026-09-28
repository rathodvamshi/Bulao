import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Image, Animated, Easing, AccessibilityInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ServiceGrowthSheet } from "./ServiceGrowthSheet";
import type { ServiceItem } from "../types";
import {
  ServiceActionsPopover,
  type ServiceMenuAnchor,
} from "./ServiceActionsPopover";
import {
  ServiceText as Text,
  serviceTheme as theme,
  serviceModeLabel,
  serviceModeIcon,
  servicePhotos,
  serviceCategoryFallbackIcon,
  serviceTaskLabel,
} from "./serviceProfileTheme";

type Filter = "all" | "active" | "paused";
const PAGE_SIZE = 3;

export function MyServiceCollection({
  services,
  initialServiceId,
}: {
  services: ServiceItem[];
  initialServiceId?: string;
}) {
  const [growthOpen, setGrowthOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [filterFrames, setFilterFrames] = useState<Partial<Record<Filter, { x: number; width: number }>>>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorReady = useRef(false);
  const selectedFrame = filterFrames[filter];
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!selectedFrame) return;
    indicatorX.stopAnimation();
    if (!indicatorReady.current || reduceMotion) {
      indicatorX.setValue(selectedFrame.x);
      indicatorReady.current = true;
      return;
    }
    const animation = Animated.timing(indicatorX, {
      toValue: selectedFrame.x,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selectedFrame?.x, selectedFrame?.width, reduceMotion, indicatorX]);
  const [page, setPage] = useState(0);
  const cardsProgress = useRef(new Animated.Value(1)).current;
  const cardsOffset = useRef(new Animated.Value(0)).current;
  const previousSelection = useRef({ filter, page });
  useLayoutEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = { filter, page };
    if (previous.filter === filter && previous.page === page) return;
    cardsProgress.stopAnimation();
    cardsOffset.stopAnimation();
    if (reduceMotion) {
      cardsProgress.setValue(1);
      cardsOffset.setValue(0);
      return;
    }
    const order: Filter[] = ["all", "active", "paused"];
    const direction = previous.filter !== filter
      ? Math.sign(order.indexOf(filter) - order.indexOf(previous.filter))
      : Math.sign(page - previous.page);
    cardsProgress.setValue(0.65);
    cardsOffset.setValue(-24 * direction);
    const animation = Animated.parallel([
      Animated.timing(cardsProgress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardsOffset, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      cardsProgress.setValue(1);
      cardsOffset.setValue(0);
    };
  }, [filter, page, reduceMotion, cardsProgress, cardsOffset]);
  const [anchor, setAnchor] = useState<ServiceMenuAnchor | null>(null);
  const [moreId, setMoreId] = useState<string | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const active = services.filter((item) => item.available).length;
  const filtered = services.filter(
    (item) =>
      filter === "all" ||
      (filter === "active" ? item.available : !item.available),
  );
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const more = services.find((item) => item.id === moreId);
  useEffect(() => {
    if (!initialServiceId) return;
    const index = services.findIndex((item) => item.id === initialServiceId);
    if (index >= 0) {
      setFilter("all");
      setPage(Math.floor(index / PAGE_SIZE));
    }
  }, [initialServiceId, services.length]);
  const open = (item: ServiceItem, editing = false) => {
    setMoreId(null);
    router.push(
      editing
        ? { pathname: "/create-service", params: { editId: item.id } }
        : { pathname: "/service-details", params: { id: item.id } },
    );
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.info}>
          <View style={s.headingRow}>
            <Text style={s.heading}>My services</Text>
            <Text style={s.count}>{services.length}</Text>
          </View>
          <Text style={s.subtitle}>
            {services.length} {services.length === 1 ? "service" : "services"} · {active} active · {services.length - active} paused
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={s.add}
          onPress={() => router.push("/create-service")}
        >
          <Ionicons name="add" size={17} color="white" />
          <Text style={s.addText}>Add service</Text>
        </Pressable>
      </View>
      <View style={s.toolbar}>
        <View style={s.filters}>
          {selectedFrame && <Animated.View pointerEvents="none" style={[s.filterIndicator, { width: selectedFrame.width, transform: [{ translateX: indicatorX }] }]} />}
          {(
            [
              ["all", "All", services.length],
              ["active", "Active", active],
              ["paused", "Paused", services.length - active],
            ] as const
          ).map(([value, label, count]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${count} services`}
              accessibilityState={{ selected: filter === value }}
              android_ripple={{ color: "rgba(3,78,59,0.08)", borderless: false }}
              onLayout={({ nativeEvent: { layout } }) => {
                setFilterFrames((previous) => previous[value]?.x === layout.x && previous[value]?.width === layout.width ? previous : { ...previous, [value]: { x: layout.x, width: layout.width } });
              }}
              onPress={() => {
                setFilter(value);
                setPage(0);
              }}
              style={[s.filter, !selectedFrame && filter === value && s.filterSelected]}
            >
              <View pointerEvents="none" style={s.filterContent}>
              <Text
                numberOfLines={1}
                style={[s.filterText, filter === value && s.filterSelectedText]}
              >
                {label}
              </Text>
              <View style={[s.filterCount, filter === value && s.filterCountSelected]}>
                <Text numberOfLines={1} style={[s.filterCountText, filter === value && s.filterSelectedText]}>{count}</Text>
              </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.cardsViewport}>
      <Animated.View style={[s.cardsContent, { opacity: cardsProgress, transform: [{ translateX: cardsOffset }] }]}>
      {visible.map((item) => {
        const photo = servicePhotos(item)[0];
        const tasks = item.offeredServices ?? [];
        return (
          <View key={item.id} style={s.card}>
            <View style={s.main}>
              <View style={s.photoWrap}>
                {photo && !failedPhotos[item.id] ? (
                  <Image
                    source={{ uri: photo }}
                    style={s.photo}
                    onError={() =>
                      setFailedPhotos((previous) => ({
                        ...previous,
                        [item.id]: true,
                      }))
                    }
                  />
                ) : (
                  <View style={s.photoFallback}>
                    <Ionicons
                      name={typeof serviceCategoryFallbackIcon === "function" ? serviceCategoryFallbackIcon(item) : "storefront-outline"}
                      size={26}
                      color={theme.green}
                    />
                    <Text style={s.noPhoto} numberOfLines={1}>
                      {item.categoryName || "Service"}
                    </Text>
                  </View>
                )}
                <View style={[s.statusBadge, !item.available && s.statusBadgePaused]}>
                  <Text style={[s.statusDot, !item.available && s.statusDotPaused]}>
                    {item.available ? "●" : "Ⅱ"}
                  </Text>
                  <Text style={[s.statusText, !item.available && s.statusTextPaused]}>
                    {item.available ? "Active" : "Paused"}
                  </Text>
                </View>
              </View>

              <View style={s.info}>
                <View style={s.titleHeaderRow}>
                  <Text style={s.cardTitle} numberOfLines={2}>
                    {item.title || item.categoryName}
                  </Text>
                  <ThreeDotAction
                    onAnchor={(position) => {
                      setAnchor(position);
                      setMoreId(item.id);
                    }}
                  />
                </View>

                <Text style={s.categoryBreadcrumb} numberOfLines={1}>
                  {item.categoryName}{item.title ? ` › ${item.title}` : ""}
                </Text>

                <View style={s.ratingRow}>
                  <Ionicons
                    name={item.totalReviews > 0 ? "star" : "star-outline"}
                    size={13}
                    color={item.totalReviews > 0 ? theme.gold : "#94A3B8"}
                  />
                  <Text style={s.ratingText}>
                    {item.totalReviews > 0 && item.rating != null
                      ? `${item.rating.toFixed(1)} (${item.totalReviews} ${item.totalReviews === 1 ? "review" : "reviews"})`
                      : "New (0 reviews)"}
                  </Text>
                </View>

                {!!tasks.length && (
                  <View style={s.chips}>
                    {tasks.slice(0, 2).map((task, index) => (
                      <Text
                        numberOfLines={1}
                        key={`${task}-${index}`}
                        style={s.chip}
                      >
                        {serviceTaskLabel(task)}
                      </Text>
                    ))}
                    {tasks.length > 2 && (
                      <Pressable
                        onPress={() => open(item)}
                        style={s.moreChip}
                      >
                        <Text style={s.moreChipText}>+{tasks.length - 2}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <View style={s.metaIconCircle}>
                  <Ionicons name="location-outline" size={13} color="#047857" />
                </View>
                <View style={s.metaTextCol}>
                  <Text style={s.metaLabel}>LOCATION</Text>
                  <Text style={s.metaVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {item.area || "Location not added"}
                  </Text>
                </View>
              </View>

              <View style={s.metaDivider} />

              <View style={s.metaItem}>
                <View style={[s.metaIconCircle, s.modeIconCircle]}>
                  <Ionicons name={serviceModeIcon(item)} size={13} color="#0284C7" />
                </View>
                <View style={s.metaTextCol}>
                  <Text style={s.metaLabel}>SERVICE MODE</Text>
                  <Text style={[s.metaVal, s.modeVal]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {serviceModeLabel(item)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => open(item)}
                style={[s.actionBtn, s.actionBtnPrimary]}
              >
                <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
                <Text style={s.actionPrimaryText}>View Details</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => open(item, true)}
                style={s.actionBtn}
              >
                <Ionicons name="create-outline" size={14} color={theme.green} />
                <Text style={s.actionSecondaryText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {!visible.length && (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons
              name={
                services.length ? "pause-circle-outline" : "storefront-outline"
              }
              size={30}
              color="white"
            />
          </View>
          <Text style={s.emptyTitle}>
            {services.length
              ? `No ${filter} services`
              : "Turn your skills into opportunities"}
          </Text>
          <Text style={s.emptyText}>
            {services.length
              ? "Your other listings are still available under All."
              : "Add your first service so local customers can discover what you do."}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.emptyAction}
            onPress={() =>
              services.length
                ? (setFilter("all"), setPage(0))
                : router.push("/create-service")
            }
          >
            <Text style={s.emptyActionText}>
              {services.length
                ? "Show all services"
                : "Create your first service"}
            </Text>
          </Pressable>
        </View>
      )}
      </Animated.View>
      </View>
      {lastPage > 0 && (
        <View style={s.pager}>
          <Text style={s.subtitle}>
            {currentPage * PAGE_SIZE + 1}–
            {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length} services
          </Text>
          <View style={s.pagerButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous services"
              disabled={!currentPage}
              onPress={() => setPage(currentPage - 1)}
              style={[s.pageButton, !currentPage && s.disabled]}
            >
              <Ionicons name="chevron-back" size={18} color={theme.green} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next services"
              disabled={currentPage === lastPage}
              onPress={() => setPage(currentPage + 1)}
              style={[s.pageButton, currentPage === lastPage && s.disabled]}
            >
              <Ionicons name="chevron-forward" size={18} color={theme.green} />
            </Pressable>
          </View>
        </View>
      )}
      {growthOpen && (
        <ServiceGrowthSheet
          services={services}
          onClose={() => setGrowthOpen(false)}
        />
      )}
      {more && anchor && (
        <ServiceActionsPopover
          service={more}
          anchor={anchor}
          onClose={() => setMoreId(null)}
        />
      )}
    </View>
  );
}

function ThreeDotAction({
  onAnchor,
}: {
  onAnchor: (anchor: ServiceMenuAnchor) => void;
}) {
  const button = useRef<View>(null);
  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      accessibilityLabel="Service options"
      hitSlop={8}
      style={s.threeDotBtn}
      onPress={() =>
        button.current?.measureInWindow((x, y, width, height) =>
          onAnchor({ x, y, width, height }),
        )
      }
    >
      <Ionicons name="ellipsis-vertical" size={16} color="#61718A" />
    </Pressable>
  );
}

function CardAction({
  label,
  icon,
  onPress,
  onAnchor,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onAnchor?: (anchor: ServiceMenuAnchor) => void;
}) {
  const button = useRef<View>(null);
  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      onPress={() =>
        onAnchor
          ? button.current?.measureInWindow((x, y, width, height) =>
              onAnchor({ x, y, width, height }),
            )
          : onPress()
      }
      style={s.action}
    >
      <Ionicons name={icon} size={15} color={theme.green} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  section: { gap: 8 },
  cardsViewport: { overflow: "hidden" },
  cardsContent: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  count: {
    color: "#9A650D",
    backgroundColor: "#FFF1D7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "700",
  },
  heading: {
    color: theme.green,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 11, lineHeight: 17, color: theme.muted },
  toolbar: {
    marginVertical: 0,
  },
  filters: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 23,
    overflow: "hidden",
  },
  filterIndicator: {
    position: "absolute",
    left: 0,
    top: 3,
    bottom: 3,
    borderRadius: 19,
    backgroundColor: theme.green,
    shadowColor: theme.green,
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  filter: {
    flex: 1,
    flexBasis: 0,
    minHeight: 38,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  filterContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: 6,
  },
  filterSelected: { backgroundColor: theme.green },
  filterText: { flexShrink: 1, fontSize: 13, lineHeight: 20, includeFontPadding: false, textAlign: "center", textAlignVertical: "center", fontWeight: "600", color: theme.muted, letterSpacing: -0.1 },
  filterCount: {
    minWidth: 18,
    minHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountSelected: { backgroundColor: "rgba(255,255,255,0.12)" },
  filterCountText: { fontSize: 11, lineHeight: 16, includeFontPadding: false, textAlign: "center", textAlignVertical: "center", fontWeight: "600", fontVariant: ["tabular-nums"], color: theme.muted },
  filterSelectedText: { color: "white" },
  add: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: theme.green,
  },
  addText: { fontSize: 11, fontWeight: "700", color: "white" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    gap: 12,
    shadowColor: "#062217",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: "hidden",
  },
  main: { flexDirection: "row", gap: 12, alignItems: "flex-start", width: "100%" },
  photoWrap: {
    width: 108,
    height: 81,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F4F8F5",
  },
  photo: { width: "100%", height: "100%" },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    backgroundColor: "#F0F7F2",
  },
  noPhoto: { fontSize: 9.5, color: "#61718A", fontWeight: "600", textAlign: "center" },
  statusBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusBadgePaused: { backgroundColor: "#F1F5F9" },
  statusDot: { fontSize: 7.5, color: "#15803D" },
  statusDotPaused: { fontSize: 7.5, color: "#64748B" },
  statusText: { fontSize: 10, fontWeight: "700", color: "#15803D" },
  statusTextPaused: { fontSize: 10, fontWeight: "700", color: "#64748B" },
  info: { flex: 1, minWidth: 0 },
  titleHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  threeDotBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBreadcrumb: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    letterSpacing: -0.1,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
    marginBottom: 5,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  chips: { flexDirection: "row", gap: 5, alignItems: "center", flexWrap: "wrap" },
  chip: {
    fontSize: 10,
    lineHeight: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: "#475569",
    fontWeight: "600",
  },
  moreChip: {
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  metaIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconCircle: {
    backgroundColor: "#E0F2FE",
  },
  metaTextCol: {
    flex: 1,
    minWidth: 0,
  },
  metaLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  metaVal: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  modeVal: {
    color: "#0284C7",
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: "#034E3B",
    borderColor: "#034E3B",
  },
  actionPrimaryText: { fontSize: 12.5, fontWeight: "700", color: "#FFFFFF" },
  actionSecondaryText: { fontSize: 12.5, fontWeight: "700", color: "#034E3B" },
  action: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  actionText: { fontSize: 12.5, fontWeight: "700", color: "#034E3B" },
  empty: {
    padding: 22,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    backgroundColor: "white",
  },
  emptyIcon: {
    backgroundColor: theme.green,
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyText: {
    fontSize: 12,
    lineHeight: 19,
    color: theme.muted,
    textAlign: "center",
  },
  emptyAction: { backgroundColor: theme.green, borderRadius: 11, padding: 13 },
  emptyActionText: { fontSize: 12, fontWeight: "700", color: "white" },
  pager: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pagerButtons: { flexDirection: "row", gap: 6 },
  pageButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#EAF3EF",
  },
  disabled: { opacity: 0.3 },
  growth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: theme.pale,
    borderWidth: 1,
    borderColor: "#DDEEE3",
    shadowColor: theme.green,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    marginTop: 2,
  },
  growthIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#D9F4E3",
    alignItems: "center",
    justifyContent: "center",
  },
  growthTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  growthText: { fontSize: 12, lineHeight: 18, color: theme.muted },
});

