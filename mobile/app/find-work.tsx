import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { JobCompletionConfirmationSheet, type CompletionInteraction } from "../src/components/JobCompletionConfirmationSheet";
import { invalidateJobLifecycleQueries } from "../src/api/jobLifecycleCache";
import * as Location from "expo-location";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";
import { useAuth } from "../src/auth";
import { jobApi } from "../src/api/jobApi";
import { api } from "../src/api/client";
import { getNotificationInbox } from "../src/api/notifications";
import type { Job, ApplicationItem } from "../src/api/types";
import { formatDirectPhone } from "../src/utils/phone";
import { formatJobTitle } from "../src/utils/jobTitle";
import { AppImage } from "../src/components/AppImage";
import { JobCard } from "../src/components/JobCard";
import { BulaoWordmark } from "../src/components/BulaoWordmark";
import { JobDetailsSheet } from "../src/components/JobDetailsSheet";
import { JobApplicationsModal } from "../src/components/JobApplicationsModal";
import { CancellationModal } from "../src/components/CancellationModal";
import { ProviderBottomNav } from "../src/components/provider/ProviderBottomNav";
import { PageTransition } from "../src/components/PageTransition";

const tabs = [
  { key: "home", label: "Home", icon: "home-outline" },
  { key: "jobs", label: "Find work", icon: "search-outline" },
  { key: "applications", label: "My work", icon: "reader-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
] as const;

const RADIUS_OPTIONS = [
  { key: 5, label: "5 km" },
  { key: 10, label: "10 km" },
  { key: 15, label: "15 km" },
  { key: 20, label: "20 km" },
  { key: 30, label: "30 km" },
] as const;

interface CategoryOption {
  id: string | null;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: readonly CategoryOption[] = [
  { id: null, label: "All", icon: "grid-outline" },
  { id: "tuition", label: "Tuition", icon: "school-outline" },
  { id: "education-training", label: "Education", icon: "book-outline" },
  { id: "construction", label: "Construction", icon: "hammer-outline" },
  { id: "events", label: "Events", icon: "calendar-outline" },
  { id: "shops", label: "Shops", icon: "storefront-outline" },
  { id: "food", label: "Food & Kitchen", icon: "restaurant-outline" },
  { id: "household", label: "House & Maid", icon: "home-outline" },
  { id: "promotion", label: "Promotions", icon: "megaphone-outline" },
  { id: "other-work", label: "Other", icon: "briefcase-outline" },
] as const;

type FindWorkFeedItem =
  | { kind: "categories"; id: "sticky-categories" }
  | { kind: "radius"; id: "radius-filter" }
  | { kind: "job"; id: string; job: Job }
  | { kind: "empty"; id: "empty-state" };

const APP_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "COMPLETED", label: "History" },
  { id: "CANCELLED", label: "Cancelled" },
] as const;

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduceMotion;
}

interface WorkSearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

function WorkSearchBar({ query, setQuery, refreshing, onRefresh }: WorkSearchBarProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="search"
          placeholder="Search jobs, roles, skills or area"
          placeholderTextColor={colors.mutedLight}
          accessibilityLabel="Search jobs by title, role, skill, category or area"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        <View style={styles.searchActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={query ? "Apply search" : "Search jobs"}
            onPress={() => query ? Keyboard.dismiss() : inputRef.current?.focus()}
            style={styles.searchIcon}
          >
            <Ionicons name="search-outline" size={22} color={colors.green} />
          </Pressable>
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              style={styles.clearSearchIcon}
              hitSlop={6}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={refreshing ? "Refreshing nearby jobs" : "Reload nearby jobs"}
            accessibilityState={{ disabled: refreshing, busy: refreshing }}
            disabled={refreshing}
            onPress={onRefresh}
            style={({ pressed }) => [styles.reloadIcon, pressed && styles.actionPressed]}
          >
            {refreshing ? <ActivityIndicator size="small" color={colors.green} /> : <Ionicons name="refresh-outline" size={18} color={colors.green} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function JobCardSkeleton({ reduceMotion }: { reduceMotion: boolean }) {
  const shimmerX = useRef(new Animated.Value(-120)).current;
  const [cardWidth, setCardWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion || !cardWidth) return;
    shimmerX.setValue(-120);
    const shimmer = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: cardWidth + 120,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [cardWidth, reduceMotion, shimmerX]);

  return (
    <View style={styles.jobSkeletonShadow}>
      <View
        onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        style={styles.skeletonCard}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.skeletonProviderRow}>
          <View style={styles.skeletonProviderInfo}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonProviderLines}>
              <View style={[styles.skeletonBlock, styles.skeletonProviderName]} />
              <View style={[styles.skeletonBlock, styles.skeletonProviderRating]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, styles.skeletonPayBadge]} />
        </View>

        <View style={styles.skeletonDivider} />
        <View style={[styles.skeletonBlock, styles.skeletonJobTitle]} />

        <View style={styles.skeletonLocationRow}>
          <View style={styles.skeletonLocationIcon} />
          <View style={[styles.skeletonBlock, styles.skeletonLocationName]} />
          <View style={[styles.skeletonBlock, styles.skeletonDistance]} />
        </View>

        <View style={styles.skeletonInfoGrid}>
          <View style={styles.skeletonInfoCell}>
            <View style={[styles.skeletonBlock, styles.skeletonDateLabel]} />
            <View style={[styles.skeletonBlock, styles.skeletonDateValue]} />
          </View>
          <View style={styles.skeletonInfoDivider} />
          <View style={styles.skeletonInfoCell}>
            <View style={[styles.skeletonBlock, styles.skeletonTimeLabel]} />
            <View style={[styles.skeletonBlock, styles.skeletonTimeValue]} />
          </View>
          <View style={styles.skeletonInfoDivider} />
          <View style={styles.skeletonInfoCell}>
            <View style={[styles.skeletonBlock, styles.skeletonMembersLabel]} />
            <View style={[styles.skeletonBlock, styles.skeletonMembersValue]} />
          </View>
        </View>

        <View style={styles.skeletonActionsRow}>
          <View style={styles.skeletonDetailsAction}>
            <View style={[styles.skeletonBlock, styles.skeletonDetailsText]} />
            <View style={styles.skeletonArrow} />
          </View>
          <View style={[styles.skeletonBlock, styles.skeletonPrimaryAction]} />
        </View>

        <View pointerEvents="none" style={styles.skeletonShimmerClip}>
          {!reduceMotion ? (
            <Animated.View style={[styles.skeletonShimmerBand, { transform: [{ translateX: shimmerX }] }]}>
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.72)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function formatApplicationStart(startsAt?: number) {
  if (!startsAt || !Number.isFinite(startsAt)) return null;
  const date = new Date(startsAt * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

interface CategoryRailProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

function CategoryItem({
  item,
  index,
  isSelected,
  itemWidth,
  reduceMotion,
  onPress,
}: {
  item: (typeof CATEGORIES)[number];
  index: number;
  isSelected: boolean;
  itemWidth: number;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(isSelected ? 1.12 : 1)).current;
  const bounceY = useRef(new Animated.Value(0)).current;
  const labelTranslateX = useRef(new Animated.Value(0)).current;
  const labelViewportWidth = Math.max(40, itemWidth - 8);
  const labelContentWidth = item.label.length * 6.4;
  const labelOverflow = Math.max(0, labelContentWidth - labelViewportWidth);

  useEffect(() => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      bounceY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.12 : 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bounceY, {
          toValue: isSelected ? -5 : 0,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(bounceY, {
          toValue: 0,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isSelected, scaleAnim, bounceY, reduceMotion]);

  useEffect(() => {
    labelTranslateX.stopAnimation();
    labelTranslateX.setValue(0);
    if (!isSelected || reduceMotion || labelOverflow <= 4) return;

    const marquee = Animated.loop(
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(labelTranslateX, {
          toValue: -labelOverflow,
          duration: Math.max(1100, labelOverflow * 45),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(850),
        Animated.timing(labelTranslateX, {
          toValue: 0,
          duration: Math.max(800, labelOverflow * 32),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ]),
    );
    marquee.start();
    return () => marquee.stop();
  }, [isSelected, labelOverflow, labelTranslateX, reduceMotion]);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      friction: 8,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.12 : 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${item.label}`}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.categoryItemWrap, { width: itemWidth }]}
    >
      {/* Pure borderless, backgroundless 3D icon with spring animation */}
      <Animated.View
        style={[
          styles.categoryIconWrap,
          {
            transform: [{ scale: scaleAnim }, { translateY: bounceY }],
          },
        ]}
      >
        <View style={[styles.categoryIconTile, isSelected && styles.categoryIconTileSelected]}>
          <Ionicons name={item.icon} size={20} color={isSelected ? "#FFFFFF" : "#176B58"} />
        </View>
      </Animated.View>

      {/* Label placed directly below the 3D icon */}
      <View style={[styles.categoryLabelViewport, { width: labelViewportWidth }]}>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.categoryLabelBelow,
            isSelected && styles.categoryLabelBelowSelected,
            isSelected && labelOverflow > 4 && { width: labelContentWidth, textAlign: "left" },
            { transform: [{ translateX: labelTranslateX }] },
          ]}
        >
          {item.label}
        </Animated.Text>
      </View>

    </Pressable>
  );
}

function CategoryRail({ selectedCategory, onSelectCategory }: CategoryRailProps) {
  const reduceMotion = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const containerWidth = Math.min(windowWidth, 680);
  const H_PADDING = 16;
  const GAP = 10;
  const JOIN_RADIUS = 6;
  const VISIBLE_COUNT = 4;
  const selectedIndex = Math.max(0, CATEGORIES.findIndex((item) => item.id === selectedCategory));
  const itemWidth = Math.max(
    56,
    Math.floor((containerWidth - H_PADDING * 2 - GAP * (VISIBLE_COUNT - 1)) / VISIBLE_COUNT)
  );
  const selectionBorderX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(selectionBorderX, {
      toValue: selectedIndex * (itemWidth + GAP),
      friction: 18,
      tension: 120,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [GAP, itemWidth, selectedIndex, selectionBorderX]);

  const handleSelect = (id: string | null, index: number) => {
    onSelectCategory(id);
    // User specification:
    // Keep the selected category near the center of the four visible tiles.
    const targetFirstIndex = Math.max(0, Math.min(index - 1, CATEGORIES.length - VISIBLE_COUNT));
    const targetScrollX = targetFirstIndex * (itemWidth + GAP);
    scrollRef.current?.scrollTo({ x: targetScrollX, animated: true });
  };

  return (
    <View style={styles.categoryRailContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.categoryRailContent,
          { paddingHorizontal: H_PADDING, gap: GAP },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(23,107,88,0.24)", "#176B58", "rgba(23,107,88,0.24)"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.categoryDividerLine}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.categoryDividerGap,
            {
              left: H_PADDING - JOIN_RADIUS * 2,
              width: itemWidth + JOIN_RADIUS * 4,
              transform: [{ translateX: selectionBorderX }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.categorySelectionBorder,
            {
              width: itemWidth,
              bottom: JOIN_RADIUS,
              transform: [{ translateX: selectionBorderX }],
            },
          ]}
        >
          <View
            style={[
              styles.categoryBorderJoin,
              styles.categoryBorderJoinLeft,
              { left: -JOIN_RADIUS * 2, width: JOIN_RADIUS * 2, height: JOIN_RADIUS * 2, bottom: -JOIN_RADIUS, borderBottomRightRadius: JOIN_RADIUS },
            ]}
          />
          <View
            style={[
              styles.categoryBorderJoin,
              styles.categoryBorderJoinRight,
              { right: -JOIN_RADIUS * 2, width: JOIN_RADIUS * 2, height: JOIN_RADIUS * 2, bottom: -JOIN_RADIUS, borderBottomLeftRadius: JOIN_RADIUS },
            ]}
          />
        </Animated.View>
        {CATEGORIES.map((item, index) => {
          const isSelected = selectedCategory === item.id;
          return (
            <CategoryItem
              key={item.label}
              item={item}
              index={index}
              isSelected={isSelected}
              itemWidth={itemWidth}
              reduceMotion={reduceMotion}
              onPress={() => handleSelect(item.id, index)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}


interface SlidingRadiusFilterProps {
  selectedRadius: number;
  onSelectRadius: (radius: number) => void;
}

function SlidingRadiusFilter({ selectedRadius, onSelectRadius }: SlidingRadiusFilterProps) {
  const reduceMotion = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [trackWidth, setTrackWidth] = useState<number>(0);

  const containerWidth = Math.min(windowWidth, 680);
  const fallbackTrackInnerWidth = containerWidth - 32 - 6; // paddingHorizontal 16*2 + track padding 3*2
  const effectiveInnerWidth = trackWidth > 0 ? trackWidth - 6 : fallbackTrackInnerWidth;
  const segmentWidth = effectiveInnerWidth / RADIUS_OPTIONS.length;

  const selectedIndex = Math.max(
    0,
    RADIUS_OPTIONS.findIndex((r) => r.key === selectedRadius)
  );

  const translateX = useRef(new Animated.Value(selectedIndex * segmentWidth)).current;

  useEffect(() => {
    if (reduceMotion) {
      translateX.setValue(selectedIndex * segmentWidth);
      return;
    }
    Animated.spring(translateX, {
      toValue: selectedIndex * segmentWidth,
      friction: 18,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, segmentWidth, translateX, reduceMotion]);

  return (
    <View style={styles.radiusSegmentContainer}>
      <View
        style={styles.radiusSegmentTrack}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - trackWidth) > 1) {
            setTrackWidth(w);
          }
        }}
      >
        {/* Animated Sliding Window Thumb */}
        <Animated.View
          style={[
            styles.slidingRadiusIndicator,
            {
              width: segmentWidth,
              transform: [{ translateX }],
            },
          ]}
        />

        {/* Tab Buttons */}
        {RADIUS_OPTIONS.map(({ key, label }) => {
          const isSelected = selectedRadius === key;
          return (
            <Pressable
              key={String(key)}
              accessibilityRole="button"
              accessibilityLabel={`Distance radius within ${label}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectRadius(key)}
              style={styles.radiusSegmentTab}
            >
              <Text
                style={[
                  styles.radiusSegmentLabel,
                  isSelected && styles.radiusSegmentLabelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function FindWork() {
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{
    tab?: string | string[];
    applicationId?: string | string[];
    completionInteractionId?: string | string[];
  }>();
  const notificationApplicationId = Array.isArray(params.applicationId)
    ? params.applicationId[0]
    : params.applicationId;
  const notificationCompletionId = Array.isArray(params.completionInteractionId)
    ? params.completionInteractionId[0]
    : params.completionInteractionId;
  const queryClient = useQueryClient();
  const { location, setLocation, setLocationSheetVisible } = useLocation();
  const insets = useSafeAreaInsets();
  const bottomNavAreaHeight = 68 + Math.max(insets.bottom, 8);
  const jobsBottomClearance = Math.max(108, bottomNavAreaHeight + 28);
  const jobsBottomFadeHeight = bottomNavAreaHeight + 56;
  const locationSelectorWidth = Math.max(72, Math.min(195, screenWidth - 32 - 76 - 40 - 20));
  const { session, user } = useAuth();
  const userId = user?.id || session?.userId || null;
  const reduceMotion = useReduceMotion();
  const resultsOpacity = useRef(new Animated.Value(1)).current;
  const resultsOffset = useRef(new Animated.Value(0)).current;
  const [bottomNavVisible, setBottomNavVisible] = useState(true);
  const bottomFadeOpacity = useRef(new Animated.Value(1)).current;
  const lastJobsOffset = useRef(0);
  const jobsScrollDirection = useRef(0);
  const jobsDirectionTravel = useRef(0);
  const isJobsFingerDragging = useRef(false);
  const lastIntentDirection = useRef(0);
  const filterTransitionPending = useRef(false);

  useEffect(() => {
    Animated.timing(bottomFadeOpacity, {
      toValue: bottomNavVisible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [bottomFadeOpacity, bottomNavVisible]);
  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "profile">(() =>
    (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "applications" ? "applications" : "jobs"
  );

  useEffect(() => {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (tab === "applications") setActiveTab("applications");
    else if (tab === "jobs") setActiveTab("jobs");
  }, [params.tab]);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const feedListRef = useRef<FlatList<FindWorkFeedItem>>(null);
  useEffect(() => {
    if (searchQuery) feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [searchQuery]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInProgress = useRef(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const jobsRequestId = useRef(0);
  const jobsSearchKey = useRef<string | null>(null);
  const applyingJobIds = useRef(new Set<string>());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [appsModalJob, setAppsModalJob] = useState<Job | null>(null);

  const beginFilterTransition = useCallback(() => {
    if (!location) return;
    filterTransitionPending.current = true;
    jobsRequestId.current += 1;
    jobsSearchKey.current = null;
    nextCursorRef.current = null;
    setJobs([]);
    setNextCursor(null);
    setIsLoadingMore(false);
    setIsLoading(true);
    if (reduceMotion) return;
    resultsOpacity.stopAnimation();
    resultsOffset.stopAnimation();
    Animated.parallel([
      Animated.timing(resultsOpacity, { toValue: 0.62, duration: 120, useNativeDriver: true }),
      Animated.timing(resultsOffset, { toValue: 3, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [location, reduceMotion, resultsOpacity, resultsOffset]);

  const handleRadiusChange = useCallback((nextRadius: number) => {
    if (nextRadius === radiusKm) return;
    beginFilterTransition();
    setRadiusKm(nextRadius);
  }, [beginFilterTransition, radiusKm]);

  const handleCategoryChange = useCallback((nextCategory: string | null) => {
    if (nextCategory === category) return;
    beginFilterTransition();
    setCategory(nextCategory);
  }, [beginFilterTransition, category]);

  useEffect(() => {
    if (isLoading || !filterTransitionPending.current) return;
    filterTransitionPending.current = false;
    if (reduceMotion) {
      resultsOpacity.setValue(1);
      resultsOffset.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(resultsOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(resultsOffset, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [isLoading, reduceMotion, resultsOpacity, resultsOffset]);

  // Applications tab state
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [historyLimit, setHistoryLimit] = useState(15);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsRefreshing, setAppsRefreshing] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>("all");
  useEffect(() => {
    if (notificationApplicationId) {
      setActiveTab("applications");
      setSelectedAppFilter("ACCEPTED");
    } else if (notificationCompletionId) {
      setActiveTab("applications");
    }
  }, [notificationApplicationId, notificationCompletionId]);
  const [cancelConfirmApp, setCancelConfirmApp] = useState<ApplicationItem | null>(null);
  const [cancellingApp, setCancellingApp] = useState<ApplicationItem | null>(null);
  const [deletingApp, setDeletingApp] = useState<ApplicationItem | null>(null);
  const [confirmingCompletionId, setConfirmingCompletionId] = useState<string | null>(null);

  const [completionPrompt, setCompletionPrompt] = useState<CompletionInteraction | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  const dismissedCompletionIds = useRef(new Set<string>());
  const openedCompletionNotificationId = useRef<string | null>(null);

  const completionActivityQuery = useQuery({
    queryKey: ["seeker-completion-activity", userId],
    queryFn: () => api<{ interactions: CompletionInteraction[] }>("/activity"),
    enabled: !!session?.token && !!userId,
    staleTime: 30000,
  });

  const pendingCompletionPrompts = useMemo(() => {
    if (!userId) return [];
    const unique = new Map<string, CompletionInteraction>();
    for (const item of completionActivityQuery.data?.interactions || []) {
      if (item.kind !== "job" || item.workerId !== userId) continue;
      // 1. When the provider says this job is done (needs seeker confirmation):
      const needsConfirmation =
        item.status === "IN_PROGRESS" &&
        item.ownerConfirmedAt != null &&
        item.workerConfirmedAt == null;
      // 2. When the job is completed and seeker has not reviewed the provider yet:
      const needsReview = item.status === "COMPLETED" && !item.reviewed;
      if ((needsConfirmation || needsReview) && !unique.has(item.id)) {
        unique.set(item.id, item);
      }
    }
    return Array.from(unique.values());
  }, [completionActivityQuery.data?.interactions, userId]);

  useEffect(() => {
    const targetId = notificationCompletionId;
    const interactions = completionActivityQuery.data?.interactions;
    if (
      !targetId ||
      !interactions ||
      completionActivityQuery.isFetching ||
      openedCompletionNotificationId.current === targetId
    ) return;
    const target = interactions.find((item) => item.id === targetId && item.kind === "job");
    if (target) {
      openedCompletionNotificationId.current = targetId;
      setCompletionPrompt(target);
    }
  }, [notificationCompletionId, completionActivityQuery.data?.interactions, completionActivityQuery.isFetching]);

  useEffect(() => {
    if (notificationCompletionId || completionPrompt || completionActivityQuery.isFetching) return;
    const next = pendingCompletionPrompts.find((item) => !dismissedCompletionIds.current.has(item.id));
    if (next) setCompletionPrompt(next);
  }, [notificationCompletionId, completionPrompt, pendingCompletionPrompts, completionActivityQuery.isFetching]);

  const dismissCompletionPrompt = useCallback(() => {
    if (completionPrompt) dismissedCompletionIds.current.add(completionPrompt.id);
    setCompletionPrompt(null);
  }, [completionPrompt]);

  const handleConfirmCompletion = useCallback(
    async (interaction: CompletionInteraction) => {
      try {
        setCompletionBusy(true);
        const result = await api<{ status: string }>(
          `/applications/${encodeURIComponent(interaction.id)}/action`,
          { action: "confirm" }
        );
        dismissedCompletionIds.current.add(interaction.id);
        await Promise.allSettled([
          completionActivityQuery.refetch(),
          queryClient.invalidateQueries({ queryKey: ["applications"] }),
          queryClient.invalidateQueries({ queryKey: ["my-applications"] }),
          invalidateJobLifecycleQueries(queryClient),
        ]);
        return result;
      } finally {
        setCompletionBusy(false);
      }
    },
    [completionActivityQuery, queryClient]
  );

  useEffect(() => {
    // Clear user applications and prompt state immediately on account switch
    setApplications([]);
    setAppsError(null);
    dismissedCompletionIds.current.clear();
    setCompletionPrompt(null);
  }, [userId]);


  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastOffset = useRef(new Animated.Value(-10)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastOpacity.stopAnimation();
    toastOffset.stopAnimation();
    toastOpacity.setValue(0);
    toastOffset.setValue(-10);
    setToastMessage(message);
    setToastVisible(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(toastOffset, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(toastOffset, {
          toValue: -8,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished: hidden }) => {
        if (hidden) {
          setToastVisible(false);
          setToastMessage(null);
        }
      });
    }, 2000);
  };

  const handleInitiateCancel = (item: ApplicationItem) => {
    setCancelConfirmApp(item);
  };

  // Notifications state
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const checkUnread = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await getNotificationInbox("seeker", "work");
      setUnreadCount(res?.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void checkUnread();
    }, [checkUnread])
  );

  // Auto-request location in background if not already set
  useEffect(() => {
    if (!location) {
      void (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getLastKnownPositionAsync() || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (loc?.coords) {
              let area = "Current Location";
              try {
                const [a] = await Location.reverseGeocodeAsync(loc.coords);
                area = [a?.subregion || a?.district || a?.city, a?.region].filter(Boolean).join(", ") || "Current Location";
              } catch {}
              setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, area });
            }
          }
        } catch {}
      })();
    }
  }, [location, setLocation]);

  // Fetch jobs with cursor-based lazy loading
  const fetchJobs = useCallback(async (reset = true) => {
    if (!location) {
      jobsRequestId.current += 1;
      setJobs([]);
      setNextCursor(null);
      setJobsError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }
    const query = searchQueryRef.current.trim();
    const searchKey = `${location.latitude}:${location.longitude}:${radiusKm}:${category ?? "all"}:${query.toLowerCase()}`;
    if (reset && jobsSearchKey.current !== searchKey) {
      jobsSearchKey.current = searchKey;
      nextCursorRef.current = null;
      setNextCursor(null);
      setJobs([]);
    }
    const requestId = ++jobsRequestId.current;
    try {
      setJobsError(null);
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const cursor = reset ? undefined : (nextCursorRef.current || undefined);

      const res = await jobApi.searchJobs({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm,
        categoryId: category,
        q: query || undefined,
        cursor: cursor ? String(cursor) : undefined,
      }, session?.token);
      if (requestId !== jobsRequestId.current) return;

      const newItems = res?.items || [];
      setJobs((prev) => {
        const base = reset ? [] : prev;
        const uniqueMap = new Map<string, Job>();
        for (const item of base) {
          if (item?.id) uniqueMap.set(item.id, item);
        }
        for (const item of newItems) {
          if (item?.id) uniqueMap.set(item.id, item);
        }
        return Array.from(uniqueMap.values());
      });

      setNextCursor(res?.nextCursor != null ? String(res.nextCursor) : null);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
      if (requestId === jobsRequestId.current) {
        setJobsError(err instanceof Error ? err.message : "Could not load nearby jobs.");
      }
    } finally {
      if (requestId === jobsRequestId.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [location, radiusKm, category, session?.token]);

  useEffect(() => {
    if (activeTab !== "jobs" || !location) return;
    const timer = setTimeout(() => void fetchJobs(true), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, location, fetchJobs]);

  const refreshJobs = useCallback(async () => {
    if (refreshInProgress.current) return;
    if (!location) {
      setLocationSheetVisible(true);
      return;
    }
    refreshInProgress.current = true;
    setIsRefreshing(true);
    void queryClient.invalidateQueries({ queryKey: ["seeker-completion-activity", userId] });
    try {
      await fetchJobs(true);
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
    }
  }, [fetchJobs, location, queryClient, setLocationSheetVisible, userId]);

  // Fetch seeker applications
  const fetchApplications = useCallback(async () => {
    try {
      setAppsLoading(true);
      setAppsError(null);
      const res = await api<ApplicationItem[]>("/applications?role=seeker&kind=job");
      const seen = new Set<string>();
      const deduped = (res || []).filter((item) => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      setApplications(deduped);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
      setAppsError(err instanceof Error ? err.message : "Could not load your applications.");
    } finally {
      setAppsLoading(false);
    }
  }, []);

  const fetchJobsRef = useRef(fetchJobs);
  fetchJobsRef.current = fetchJobs;
  const fetchApplicationsRef = useRef(fetchApplications);
  fetchApplicationsRef.current = fetchApplications;

  // Refresh data only when this screen is focused or active tab changes
  useFocusEffect(
    useCallback(() => {
      dismissedCompletionIds.current.clear();
      void queryClient.invalidateQueries({ queryKey: ["seeker-completion-activity", userId] });
      if (activeTab === "jobs") {
        void fetchJobsRef.current(true);
      } else if (activeTab === "applications") {
        void fetchApplicationsRef.current();
      }
    }, [activeTab, queryClient, userId])
  );

  // Load more jobs when end is reached
  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && nextCursor) {
      fetchJobs(false);
    }
  };

  const handleJobsScroll = (event: any) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offset - lastJobsOffset.current;
    lastJobsOffset.current = offset;

    if (offset <= 8) {
      jobsScrollDirection.current = 0;
      jobsDirectionTravel.current = 0;
      setBottomNavVisible(true);
      return;
    }
    if (Math.abs(delta) < 0.5) return;

    const nextDirection = Math.sign(delta);
    if (isJobsFingerDragging.current) {
      lastIntentDirection.current = nextDirection;
    } else if (lastIntentDirection.current === 0 || nextDirection !== lastIntentDirection.current) {
      // Ignore edge bounce and layout corrections that move the list opposite
      // to the user's last deliberate drag direction.
      return;
    }
    if (nextDirection !== jobsScrollDirection.current) {
      jobsScrollDirection.current = nextDirection;
      jobsDirectionTravel.current = 0;
    }
    jobsDirectionTravel.current += Math.abs(delta);

    // Wait for a purposeful gesture before moving the bar, so small finger
    // corrections and list bounce do not make the navigation flicker.
    if (jobsDirectionTravel.current >= 14) {
      setBottomNavVisible(nextDirection < 0);
      jobsDirectionTravel.current = 0;
    }
  };



  // 1-Click apply handler with instant optimistic feedback
  const handleApplyJob = async (job: Job) => {
    if (job.myApplication || applyingJobIds.current.has(job.id)) return;
    applyingJobIds.current.add(job.id);
    const originalApplication = job.myApplication;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? { ...j, myApplication: { id: `optimistic-${job.id}`, status: "PENDING" } }
          : j
      )
    );
    try {
      await api(`/jobs/${job.id}/apply`, {});
      void fetchApplications();
      void fetchJobs(true);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      void queryClient.invalidateQueries({ queryKey: ["nearby"] });
      showToast("Application sent successfully");
    } catch (err: any) {
      // Revert if API failed
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id && j.myApplication?.id === `optimistic-${job.id}`
            ? { ...j, myApplication: originalApplication }
            : j
        )
      );
      throw new Error(err?.message || "Failed to submit application.");
    } finally {
      applyingJobIds.current.delete(job.id);
    }
  };

  // Delete cancelled application handler (available AFTER cancel only)
  const handleConfirmDelete = async () => {
    if (!deletingApp || isDeleting) return;
    try {
      setIsDeleting(true);
      await api(`/applications/${deletingApp.id}/action`, { action: "delete" });
      const targetId = deletingApp.id;
      const targetJobId = deletingApp.jobId;
      setApplications((prev) => prev.filter((a) => a.id !== targetId));
      void queryClient.invalidateQueries({ queryKey: ["job", targetJobId] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      setDeletingApp(null);
      showToast("Removed from your history");
    } catch (err: any) {
      Alert.alert("Delete Failed", err?.message || "Could not delete application.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Seeker cancel application handler
  const handleCancelApplicationConfirm = async (reason: string) => {
    if (!cancellingApp) return;
    try {
      const targetId = cancellingApp.id;
      const targetJobId = cancellingApp.jobId;
      await api(`/applications/${targetId}/action`, {
        action: "cancel",
        reason,
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === targetId
            ? { ...a, status: "CANCELLED_BY_SEEKER", cancellationReason: reason }
            : a
        )
      );
      setJobs((prev) => prev.map((job) =>
        job.id === targetJobId && job.myApplication?.id === targetId
          ? { ...job, myApplication: { id: targetId, status: "CANCELLED_BY_SEEKER" } }
          : job,
      ));
      void queryClient.invalidateQueries({ queryKey: ["job", targetJobId] });
      void queryClient.invalidateQueries({ queryKey: ["nearby"] });
      void queryClient.invalidateQueries({ queryKey: ["provider-recent-jobs"] });
      showToast("Application cancelled");
      // Auto-remove from the list after 7 seconds so seeker history stays clean
      setTimeout(() => {
        setApplications((prev) => prev.filter((a) => a.id !== targetId));
      }, 7000);
    } catch (err: any) {
      throw new Error(err?.message || "Could not cancel application.");
    }
  };

  const submitCompletionConfirmation = async (item: ApplicationItem) => {
    if (confirmingCompletionId) return;
    setConfirmingCompletionId(item.id);
    try {
      const result = await api<{ id: string; status: string }>(
        `/applications/${encodeURIComponent(item.id)}/action`,
        { action: "confirm" },
      );
      await fetchApplications();
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["job", item.jobId] });
      showToast(
        result.status === "COMPLETED"
          ? "Job completed. You can now rate your provider."
          : "You marked the work complete. Waiting for the provider to confirm.",
      );
    } catch (err: any) {
      const stateConflict = err?.code === "INVALID_TRANSITION" || err?.code === "STATE_CHANGED";
      await fetchApplications();
      Alert.alert(
        stateConflict ? "Job status changed" : "Couldn’t update completion",
        stateConflict
          ? "Your application has been refreshed, but this job was not marked complete. Check the updated status before trying again."
          : err?.message || "Your job was not marked complete. Refresh and try again.",
      );
    } finally {
      setConfirmingCompletionId(null);
    }
  };

  const rejectProviderCompletion = async (item: ApplicationItem) => {
    if (confirmingCompletionId) return;
    setConfirmingCompletionId(item.id);
    try {
      await api(`/applications/${encodeURIComponent(item.id)}/action`, {
        action: "reject_completion",
        reason: "Work is not complete yet.",
      });
      await fetchApplications();
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      Alert.alert("Completion sent back", "The provider has been notified. You can review the job again when the work is finished.");
    } catch (err: any) {
      await fetchApplications();
      Alert.alert("Couldn’t update completion", err?.message || "Please refresh and try again.");
    } finally {
      setConfirmingCompletionId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const lowerQ = searchQuery.toLowerCase().trim();
    const titleMatch = (job.title || "").toLowerCase().includes(lowerQ);
    const customTitleMatch = (job.customTitle || "").toLowerCase().includes(lowerQ);
    const roleMatch = (job.roleName || "").toLowerCase().includes(lowerQ);
    const catMatch = (job.categoryName || "").toLowerCase().includes(lowerQ);
    const providerMatch = (job.ownerName || "").toLowerCase().includes(lowerQ);
    const areaMatch = (job.area || "").toLowerCase().includes(lowerQ);
    const detailsMatch = (job.details || "").toLowerCase().includes(lowerQ);
    return titleMatch || customTitleMatch || roleMatch || catMatch || providerMatch || areaMatch || detailsMatch;
  });
  const feedItems: FindWorkFeedItem[] = [
    { kind: "categories", id: "sticky-categories" },
    { kind: "radius", id: "radius-filter" },
    ...(filteredJobs.length > 0
      ? filteredJobs.map((job) => ({ kind: "job" as const, id: job.id, job }))
      : [{ kind: "empty" as const, id: "empty-state" as const }]),
  ];
  const getStatusCount = useCallback(
    (statusId: string) => {
      if (statusId === "all") {
        // "All" reflects only active applications; completed jobs show ONLY in History
        return applications.filter(
          (a) => a.status === "PENDING" || a.status === "ACCEPTED" || a.status === "IN_PROGRESS"
        ).length;
      }
      if (statusId === "ACCEPTED") {
        return applications.filter((a) => a.status === "ACCEPTED" || a.status === "IN_PROGRESS").length;
      }
      if (statusId === "CANCELLED") {
        return applications.filter(
          (a) =>
            a.status === "CANCELLED" ||
            a.status === "CANCELLED_BY_SEEKER" ||
            a.status === "CANCELLED_BY_PROVIDER" ||
            a.status === "WITHDRAWN"
        ).length;
      }
      return applications.filter((a) => a.status === statusId).length;
    },
    [applications]
  );

  const filteredApplications = useMemo(() => {
    let list = applications.filter((app) => {
      if (selectedAppFilter === "all") {
        // Completed jobs show ONLY in History, not in All
        return app.status === "PENDING" || app.status === "ACCEPTED" || app.status === "IN_PROGRESS";
      }
      if (selectedAppFilter === "ACCEPTED") {
        return app.status === "ACCEPTED" || app.status === "IN_PROGRESS";
      }
      if (selectedAppFilter === "CANCELLED") {
        return (
          app.status === "CANCELLED" ||
          app.status === "CANCELLED_BY_SEEKER" ||
          app.status === "CANCELLED_BY_PROVIDER" ||
          app.status === "WITHDRAWN" ||
          app.status === "REJECTED"
        );
      }
      return app.status === selectedAppFilter;
    });
    if (selectedAppFilter === "COMPLETED") {
      list = [...list].sort(
        (a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0)
      );
    }
    return list;
  }, [applications, selectedAppFilter]);

  const displayedApplications = useMemo(() => {
    let list = filteredApplications;
    if (notificationApplicationId) {
      list = [...list].sort((a, b) =>
        a.id === notificationApplicationId ? -1 : b.id === notificationApplicationId ? 1 : 0,
      );
    }
    if (selectedAppFilter === "COMPLETED") return list.slice(0, historyLimit);
    return list;
  }, [filteredApplications, selectedAppFilter, historyLimit, notificationApplicationId]);

  const handleCallEmployer = async (phoneNumber?: string | null) => {
    if (!phoneNumber) {
      Alert.alert("Contact Protected", "Contact numbers are only visible once your application is accepted by the employer.");
      return;
    }
    const clean = phoneNumber.replace(/[^0-9+]/g, "");
    try {
      await Linking.openURL(`tel:${clean}`);
    } catch {
      Alert.alert("Unable to call", "Your device could not open the phone app. You can still view the contact number here.");
    }
  };

  const brandNavigation = (
    <View style={styles.navRow}>
      <BulaoWordmark size={27} pinScale={0.9} color="#FFFFFF" pinHoleColor="#103F34" signalColor="#D8E9A2" withSignal animateSignal align="flex-start" style={styles.brandMark} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose work area. Current area: ${location?.area || "not set"}`}
        accessibilityHint="Opens the work area selector"
        onPress={() => setLocationSheetVisible(true)}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        android_ripple={{ color: "rgba(255, 255, 255, 0.14)" }}
        style={({ pressed }) => [styles.seekerLocationPill, { width: locationSelectorWidth }, pressed && styles.actionPressed]}
      >
        <BlurView
          intensity={Platform.OS === "android" ? 10 : 18}
          tint="dark"
          style={styles.seekerLocationBlur}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={styles.seekerLocationTint} />
        <View style={styles.seekerLocationPin}>
          <Ionicons name="location-sharp" size={15} color="#D8E9A2" />
        </View>
        <Text style={styles.seekerLocationText} numberOfLines={1} ellipsizeMode="tail">
          {location?.area || "Set work area"}
        </Text>
        <View style={styles.seekerLocationChevron}>
          <Ionicons name="chevron-down" size={11} color="#FFFFFF" />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onPress={() => router.push({ pathname: "/notifications", params: { role: "seeker", context: "work" } })}
        style={({ pressed }) => [styles.notificationAction, pressed && styles.actionPressed]}
      >
        <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
        {unreadCount > 0 ? <View style={styles.notificationCount}><Text style={styles.notificationCountText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : null}
      </Pressable>
    </View>
  );

  const jobTopHeader = (
    <View style={[styles.topBar, { paddingTop: 6 }]}>
      {brandNavigation}
      <WorkSearchBar query={searchQuery} setQuery={setSearchQuery} refreshing={isRefreshing} onRefresh={() => void refreshJobs()} />
    </View>
  );

  const jobListHeader = (
    <View>
      {jobTopHeader}
      {jobsError && jobs.length > 0 ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={17} color="#A64B35" />
          <Text style={styles.errorBannerText}>Couldn’t refresh jobs. Showing the last results.</Text>
          <Pressable onPress={() => void fetchJobs(true)}><Text style={styles.errorBannerAction}>Retry</Text></Pressable>
        </View>
      ) : null}
    </View>
  );

  const stickyCategories = (
    <View style={styles.stickyCategoryHeader}>
      <CategoryRail selectedCategory={category} onSelectCategory={handleCategoryChange} />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.screen, activeTab === "jobs" && styles.jobsScreenSafeArea]}
      edges={activeTab === "jobs" ? ["top", "left", "right"] : ["left", "right"]}
    >
      <StatusBar style="light" backgroundColor="#103F34" translucent={false} />
      {/* Main Tab Content */}
      <PageTransition key={activeTab} style={{ flex: 1 }}>
      {activeTab !== "jobs" ? <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>{brandNavigation}</View> : null}
      {activeTab === "jobs" ? (
        <View style={styles.mainContent}>
          <View style={styles.content}>
            <FlatList
              ref={feedListRef}
              style={styles.jobsList}
              data={feedItems}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListHeaderComponent={jobListHeader}
              stickyHeaderIndices={[1]}
              renderItem={({ item, index }) => item.kind === "categories" ? stickyCategories : item.kind === "radius" ? (
                <View style={styles.radiusFeedRow}>
                  <SlidingRadiusFilter selectedRadius={radiusKm} onSelectRadius={handleRadiusChange} />
                </View>
              ) : item.kind === "empty" ? (
                <Animated.View
                  style={[
                    { flexGrow: 1 },
                    !(isLoading && jobs.length === 0) && {
                      opacity: resultsOpacity,
                      transform: [{ translateY: resultsOffset }],
                    },
                  ]}
                >
                  {isLoading && jobs.length === 0 ? (
                    <View style={styles.jobsLoadingState}>
                      <JobCardSkeleton reduceMotion={reduceMotion} />
                      <JobCardSkeleton reduceMotion={reduceMotion} />
                      <JobCardSkeleton reduceMotion={reduceMotion} />
                    </View>
                  ) : !location ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyStateIcon}><Ionicons name="navigate-outline" size={28} color="#176B58" /></View>
                      <Text style={styles.emptyStateTitle}>Choose your work area</Text>
                      <Text style={styles.emptyStateBody}>We’ll show real opportunities near the area you choose. Your location is never guessed.</Text>
                      <Pressable accessibilityRole="button" style={styles.emptyStateAction} onPress={() => setLocationSheetVisible(true)}>
                        <Ionicons name="location-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.emptyStateActionText}>Choose an area</Text>
                      </Pressable>
                    </View>
                  ) : jobsError && jobs.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyStateIcon}><Ionicons name="cloud-offline-outline" size={27} color="#176B58" /></View>
                      <Text style={styles.emptyStateTitle}>Jobs didn’t load</Text>
                      <Text style={styles.emptyStateBody}>{jobsError}</Text>
                      <Pressable accessibilityRole="button" style={styles.emptyStateAction} onPress={() => void fetchJobs(true)}>
                        <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.emptyStateActionText}>Try again</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.jobsEmptyState}>
                      <Ionicons name="briefcase-outline" size={64} color={colors.line} style={{ marginBottom: 16 }} />
                      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
                        {searchQuery.trim() ? "No jobs match your search" : category ? "No jobs in this category yet" : "No jobs found nearby"}
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
                        {searchQuery.trim() ? "Try a different job title, skill or area." : "Try a wider search distance or another category to see more opportunities."}
                      </Text>
                      {(searchQuery.trim() || category) ? <Pressable style={styles.emptyStateAction} onPress={() => { setSearchQuery(""); setCategory(null); }}><Text style={styles.emptyStateActionText}>Clear search and filters</Text></Pressable> : null}
                    </View>
                  )}
                </Animated.View>
              ) : (
                <Animated.View style={[{ paddingTop: index === 2 ? 12 : 0 }, { opacity: resultsOpacity, transform: [{ translateY: resultsOffset }] }]}>
                  <JobCard
                    job={item.job}
                    onViewDetails={(j) => router.push(`/jobs/${j.id}`)}
                    onViewApplications={(j) => setAppsModalJob(j)}
                    onApply={handleApplyJob}
                  />
                </Animated.View>
              )}
              contentContainerStyle={[styles.jobsListContent, { paddingBottom: jobsBottomClearance }]}
              showsVerticalScrollIndicator={false}
              bounces={!!location}
              alwaysBounceVertical={!!location}
              overScrollMode={location ? "always" : "never"}
              onScroll={handleJobsScroll}
              onScrollBeginDrag={() => {
                isJobsFingerDragging.current = true;
                lastIntentDirection.current = 0;
                jobsScrollDirection.current = 0;
                jobsDirectionTravel.current = 0;
              }}
              onScrollEndDrag={() => {
                isJobsFingerDragging.current = false;
              }}
              scrollEventThrottle={16}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              refreshControl={location ? <RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshJobs()} colors={[colors.green]} tintColor={colors.green} /> : undefined}
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={colors.green} />
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                      Loading more nearby jobs...
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      ) : activeTab === "applications" ? (
        /* Applications Tracking Tab */
        <View style={styles.mainContent}>
          <View style={styles.appsHeaderWrap}>
            <Text style={styles.appsScreenTitle}>Your Applications</Text>
          </View>

          {/* Status Filter Chips */}
          <View style={styles.appFilterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {APP_STATUS_FILTERS.map((f) => {
                const isSelected = selectedAppFilter === f.id;
                const count = getStatusCount(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setSelectedAppFilter(f.id)}
                    style={[styles.appFilterChip, isSelected && styles.appFilterChipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.appFilterChipText, isSelected && styles.appFilterChipTextSelected]}>
                      {f.label}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.appFilterCountBadge, isSelected && styles.appFilterCountBadgeSelected]}>
                        <Text style={[styles.appFilterCountText, isSelected && styles.appFilterCountTextSelected]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Applications List */}
          <View style={styles.content}>
            {appsLoading && applications.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={colors.green} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.muted }}>
                  Loading your applications...
                </Text>
              </View>
            ) : appsError && applications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}><Ionicons name="cloud-offline-outline" size={27} color="#176B58" /></View>
                <Text style={styles.emptyStateTitle}>Applications didn’t load</Text>
                <Text style={styles.emptyStateBody}>{appsError}</Text>
                <Pressable accessibilityRole="button" style={styles.emptyStateAction} onPress={() => void fetchApplications()}>
                  <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.emptyStateActionText}>Try again</Text>
                </Pressable>
              </View>
            ) : filteredApplications.length > 0 ? (
              <FlatList
                key={notificationApplicationId ? `notification-${notificationApplicationId}` : "applications-list"}
                data={displayedApplications}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={appsError ? <View style={styles.errorBanner}><Ionicons name="cloud-offline-outline" size={17} color="#A64B35" /><Text style={styles.errorBannerText}>Couldn’t refresh applications. Showing the last results.</Text><Pressable onPress={() => void fetchApplications()}><Text style={styles.errorBannerAction}>Retry</Text></Pressable></View> : null}
                ListFooterComponent={
                  selectedAppFilter === "COMPLETED" && filteredApplications.length > historyLimit ? (
                    <View style={styles.loadMoreContainer}>
                      <Text style={styles.historyCounterText}>
                        Showing {Math.min(historyLimit, filteredApplications.length)} of {filteredApplications.length} completed records
                      </Text>
                      <Pressable
                        style={styles.loadMoreBtn}
                        onPress={() => setHistoryLimit((prev) => prev + 15)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="time-outline" size={15} color="#087653" />
                        <Text style={styles.loadMoreBtnText}>Load more history</Text>
                      </Pressable>
                    </View>
                  ) : selectedAppFilter === "COMPLETED" && filteredApplications.length > 0 ? (
                    <View style={styles.loadMoreContainer}>
                      <Text style={styles.historyCounterText}>
                        Showing all {filteredApplications.length} completed records
                      </Text>
                    </View>
                  ) : null
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 108, gap: 12 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={appsRefreshing}
                    onRefresh={() => {
                      setAppsRefreshing(true);
                      fetchApplications().finally(() => setAppsRefreshing(false));
                    }}
                    colors={[colors.green]}
                    tintColor={colors.green}
                  />
                }
                renderItem={({ item }) => {
                  const isAccepted = item.status === "ACCEPTED" || item.status === "IN_PROGRESS";
                  const isInProgress = item.status === "IN_PROGRESS";
                  const isAwaitingMyConfirmation = isInProgress && item.ownerConfirmedAt != null && item.workerConfirmedAt == null;
                  const isAwaitingProviderConfirmation = isInProgress && item.workerConfirmedAt != null && item.ownerConfirmedAt == null;
                  const completionRejectedByMe = item.completionRejectedAt != null && item.completionRejectedBy === userId;
                  const isPending = item.status === "PENDING";
                  const isRejected = item.status === "REJECTED";
                  const isCompleted = item.status === "COMPLETED";
                  const isCancelled =
                    item.status === "CANCELLED_BY_SEEKER" ||
                    item.status === "CANCELLED_BY_PROVIDER" ||
                    item.status === "CANCELLED";
                  const isWithdrawn = item.status === "WITHDRAWN";

                  // Extract date & time matching JobCard format
                  let dateDisplay = "Flexible";
                  let timeDisplay = "Anytime";
                  if (item.startsAt && Number.isFinite(item.startsAt)) {
                    const d = new Date(item.startsAt * 1000);
                    if (!Number.isNaN(d.getTime())) {
                      dateDisplay = d.toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      });
                      timeDisplay = d
                        .toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                        .replace(/\b(am|pm)$/i, (p) => p.toUpperCase());
                    }
                  }

                  const payDisplay = `₹${Math.round(item.payPaise / 100).toLocaleString("en-IN")} / ${(item.payUnit || "month").toLowerCase()}`;

                  const openedFromNotification = item.id === notificationApplicationId;
                  return (
                    <View style={[styles.appCard, openedFromNotification && styles.notificationTargetCard]}>
                      {openedFromNotification && (
                        <View style={styles.notificationTargetBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#087653" />
                          <Text style={styles.notificationTargetText}>Accepted application</Text>
                        </View>
                      )}
                      {/* Top Provider / Employer Row (matches JobCard header) */}
                      <View style={styles.appProviderRow}>
                        <Pressable
                          style={styles.appProviderProfilePressable}
                          onPress={() => {
                            if (item.otherId) {
                              router.push({
                                pathname: "/profile/[id]",
                                params: { id: item.otherId, jobId: item.jobId },
                              });
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${item.otherName || "employer"}'s profile`}
                          hitSlop={4}
                        >
                          <View style={styles.appProviderAvatar}>
                            {item.otherPhotoUrl ? (
                              <AppImage
                                source={{ uri: item.otherPhotoUrl }}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                              />
                            ) : (
                              <Ionicons name="person" size={15} color="#176B58" />
                            )}
                          </View>
                          <View style={styles.appProviderIdentity}>
                            <Text style={styles.appProviderName} numberOfLines={1}>
                              {item.otherName || "Work provider"}
                            </Text>
                            <View style={styles.appRatingRow}>
                              <Ionicons name="shield-checkmark" size={11} color="#176B58" />
                              <Text style={styles.appVerifiedTagText}>Verified employer</Text>
                            </View>
                          </View>
                        </Pressable>

                        {/* Pay Badge (matches JobCard pay badge) */}
                        <View style={styles.appPayBadge}>
                          <Text style={styles.appPayText}>{payDisplay}</Text>
                        </View>
                      </View>

                      {/* Horizontal line half of the card */}
                      <View style={styles.appHalfDivider} />

                      {/* Title & Status Badge Row */}
                      <View style={styles.appTitleHeaderRow}>
                        <Text style={styles.appTitle} numberOfLines={2}>
                          {formatJobTitle(item.title)}
                        </Text>
                        <View
                          style={[
                            styles.appBadge,
                            isAccepted && styles.appBadgeAccepted,
                            isInProgress && styles.appBadgeInProgress,
                            (isAwaitingMyConfirmation || isAwaitingProviderConfirmation) && styles.appBadgeCompletion,
                            isPending && styles.appBadgePending,
                            isRejected && styles.appBadgeRejected,
                            (isCancelled || isWithdrawn) && styles.appBadgeCancelled,
                            isCompleted && styles.appBadgeCompleted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.appBadgeText,
                              isAccepted && styles.appBadgeAcceptedText,
                              isInProgress && styles.appBadgeInProgressText,
                              (isAwaitingMyConfirmation || isAwaitingProviderConfirmation) && styles.appBadgeCompletionText,
                              isPending && styles.appBadgePendingText,
                              isRejected && styles.appBadgeRejectedText,
                              (isCancelled || isWithdrawn) && styles.appBadgeCancelledText,
                              isCompleted && styles.appBadgeCompletedText,
                            ]}
                          >
                            {isAwaitingMyConfirmation
                              ? "Confirm work"
                              : isAwaitingProviderConfirmation
                              ? "Waiting"
                              : isInProgress
                              ? "In progress"
                              : isAccepted
                              ? "Accepted"
                              : isPending
                              ? "Pending Review"
                              : isRejected
                              ? "Rejected"
                              : isCompleted
                              ? "Completed"
                              : isWithdrawn
                              ? "Withdrawn"
                              : "Cancelled"}
                          </Text>
                        </View>
                      </View>

                      {/* Location Capsule Row (matches JobCard location row) */}
                      <View style={styles.appLocationRow}>
                        <View style={styles.appLocationIcon}>
                          <Ionicons name="location" size={15} color="#176B58" />
                        </View>
                        <Text style={styles.appLocationText} numberOfLines={1}>
                          {item.area || "Worksite location"}
                        </Text>
                        <View style={styles.appCategoryPill}>
                          <Text style={styles.appCategoryPillText} numberOfLines={1}>
                            {item.roleName || item.categoryName || "Work"}
                          </Text>
                        </View>
                      </View>

                      {/* 3-Column Info Grid (matches JobCard info grid) */}
                      <View style={styles.appInfoGrid}>
                        <View style={styles.appInfoCell}>
                          <Text style={styles.appInfoLabel}>DATE</Text>
                          <Text style={styles.appInfoValue} numberOfLines={1}>
                            {dateDisplay}
                          </Text>
                        </View>
                        <View style={styles.appInfoDivider} />
                        <View style={styles.appInfoCell}>
                          <Text style={styles.appInfoLabel}>TIME</Text>
                          <Text style={styles.appInfoValue} numberOfLines={1}>
                            {timeDisplay}
                          </Text>
                        </View>
                        <View style={styles.appInfoDivider} />
                        <View style={styles.appInfoCell}>
                          <Text style={styles.appInfoLabel}>CATEGORY</Text>
                          <Text style={styles.appInfoValue} numberOfLines={1}>
                            {item.categoryName || item.roleName || "General"}
                          </Text>
                        </View>
                      </View>

                      {/* Contact Unlocked Card (when accepted / in-progress) with direct Call button */}
                      {isAccepted && (
                        <View style={styles.contactUnlockedBox}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                              <Ionicons name="lock-open-outline" size={13} color="#176B58" />
                              <Text style={styles.unlockedHeader}>EMPLOYER CONTACT UNLOCKED</Text>
                            </View>
                            <View style={styles.contactPersonRow}>
                              <Text style={styles.employerNameVal} numberOfLines={1} ellipsizeMode="tail">
                                {item.otherName || "Employer"}
                              </Text>
                              <View style={styles.contactPersonDivider} />
                              <Text style={styles.employerPhoneVal} numberOfLines={1} ellipsizeMode="tail">
                                {item.otherPhone ? formatDirectPhone(item.otherPhone) : "Phone not provided"}
                              </Text>
                            </View>
                          </View>
                          {item.otherPhone ? (
                            <Pressable
                              style={styles.callEmployerBtn}
                              onPress={() => handleCallEmployer(item.otherPhone)}
                              accessibilityRole="button"
                              accessibilityLabel={`Call ${item.otherName || "employer"}`}
                            >
                              <Ionicons name="call" size={15} color="#FFFFFF" />
                              <Text style={styles.callEmployerBtnText}>Call</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )}

                      {completionRejectedByMe ? (
                        <View style={styles.completionWaitingBox} accessibilityRole="text">
                          <View style={styles.completionStatusIcon}><Ionicons name="alert-circle-outline" size={17} color="#A33B32" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.completionPromptTitle}>Completion sent back</Text>
                            <Text style={styles.completionPromptBody}>You reported that the work is unfinished. The provider can review and resubmit when it is ready.</Text>
                          </View>
                        </View>
                      ) : (isAccepted || isInProgress) && item.workerConfirmedAt != null ? (
                        <View style={styles.completionWaitingBox} accessibilityRole="text">
                          <View style={styles.completionStatusIcon}>
                            <Ionicons name="hourglass-outline" size={17} color="#2563A6" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.completionPromptTitle}>Waiting for provider</Text>
                            <Text style={styles.completionPromptBody}>
                              You marked the work complete. {item.otherName || "The provider"} needs to confirm.
                            </Text>
                          </View>
                        </View>
                      ) : (isAccepted || isInProgress) ? (
                        <View style={styles.completionPromptBox}>
                          <View style={styles.completionPromptCopy}>
                            <View style={styles.completionStatusIcon}>
                              <Ionicons
                                name={item.ownerConfirmedAt != null ? "checkmark-done-circle-outline" : "checkmark-circle-outline"}
                                size={17}
                                color="#176B58"
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.completionPromptTitle}>
                                {item.completionRejectedAt != null ? "Completion needs another look" : item.ownerConfirmedAt != null ? "Provider marked it complete" : "Finished the agreed work?"}
                              </Text>
                              {item.completionRejectedAt != null || item.ownerConfirmedAt != null ? (
                                <Text style={styles.completionPromptBody}>{item.completionRejectedAt != null ? item.completionRejectionReason || "The previous completion request was sent back." : "Confirm only if the work is finished."}</Text>
                              ) : null}
                            </View>
                          </View>
                          <Pressable
                            disabled={confirmingCompletionId === item.id}
                            onPress={() => void submitCompletionConfirmation(item)}
                            style={[
                              styles.completionActionBtn,
                              confirmingCompletionId === item.id && styles.completionActionDisabled,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={item.ownerConfirmedAt != null ? "Confirm provider marked this job completed" : "Mark this job completed and ask provider to confirm"}
                          >
                            {confirmingCompletionId === item.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="checkmark-done-outline" size={17} color="#FFFFFF" />
                            )}
                            <Text numberOfLines={1} style={styles.completionActionText}>
                              {item.ownerConfirmedAt != null ? "Confirm completed work" : "Mark work complete"}
                            </Text>
                          </Pressable>
                          {item.ownerConfirmedAt != null && item.completionRejectedAt == null ? (
                            <Pressable
                              disabled={confirmingCompletionId === item.id}
                              onPress={() => void rejectProviderCompletion(item)}
                              style={[styles.completionRejectBtn, confirmingCompletionId === item.id && styles.completionActionDisabled]}
                              accessibilityRole="button"
                              accessibilityLabel="Reject completion because work is not complete"
                            >
                              <Text style={styles.completionRejectText}>Not complete</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                      {/* Cancellation reason if cancelled */}
                      {isCancelled && item.cancellationReason ? (
                        <View style={styles.cancelledReasonBox}>
                          <Text style={styles.cancelledReasonTitle}>
                            {item.cancelledBy === session?.userId
                              ? "You cancelled this application:"
                              : "Employer cancelled this job:"}
                          </Text>
                          <Text style={styles.cancelledReasonText}>{item.cancellationReason}</Text>
                        </View>
                      ) : null}

                      {/* Action Buttons Row (The two essential options for My Work) */}
                      <View style={styles.appCardActions}>
                        {/* Option 1: Job details & directions */}
                        {item.jobId && (
                          <View style={{ flex: 1 }}>
                            <Pressable
                              style={styles.viewJobBtn}
                              onPress={() => router.push(`/jobs/${item.jobId}`)}
                              accessibilityRole="button"
                            >
                              <Ionicons name="navigate-outline" size={15} color="#176B58" />
                              <Text style={styles.viewJobBtnText} numberOfLines={1}>
                                {isAccepted || isCompleted ? "Job details & directions" : "View job details"}
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Option 2: Cancel Job / Cancel Application / Rate */}
                        {isAccepted && (
                          <View style={{ flex: 1 }}>
                            <Pressable
                              style={styles.cancelJobBtn}
                              onPress={() => handleInitiateCancel(item)}
                              accessibilityRole="button"
                              accessibilityLabel="Cancel Job"
                            >
                              <Ionicons name="close-circle-outline" size={15} color="#E11D48" />
                              <Text style={styles.cancelJobBtnText} numberOfLines={1}>Cancel Job</Text>
                            </Pressable>
                          </View>
                        )}

                        {isPending && (
                          <View style={{ flex: 1 }}>
                            <Pressable
                              style={styles.cancelJobBtn}
                              onPress={() => handleInitiateCancel(item)}
                              accessibilityRole="button"
                              accessibilityLabel="Cancel Application"
                            >
                              <Ionicons name="close-circle-outline" size={15} color="#E11D48" />
                              <Text style={styles.cancelJobBtnText} numberOfLines={1}>Cancel</Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Completed records can be removed from this user's history. */}
                        {(isCancelled || isWithdrawn || isCompleted) && (
                          <View style={{ flex: 1 }}>
                            <Pressable
                              style={styles.deleteAppBtn}
                              onPress={() => setDeletingApp(item)}
                              accessibilityRole="button"
                              accessibilityLabel={isCompleted ? "Remove completed job from history" : "Delete application"}
                            >
                              <Ionicons name="trash-outline" size={15} color="#DC2626" />
                              <Text style={styles.deleteAppBtnText} numberOfLines={1}>{isCompleted ? "Remove from history" : "Delete"}</Text>
                            </Pressable>
                          </View>
                        )}

                        {isCompleted && (item.receivedRating || item.myRating) ? (
                        <View style={styles.historyRatingBox}>
                          {item.receivedRating ? (
                            <View style={styles.historyRatingItem}>
                              <View style={styles.historyRatingStarsRow}>
                                <Ionicons name="star" size={13} color="#F59E0B" />
                                <Text style={styles.historyRatingVal}>{item.receivedRating}★ from employer</Text>
                              </View>
                              {item.receivedFeedback ? (
                                <Text style={styles.historyFeedbackText} numberOfLines={2}>
                                  "{item.receivedFeedback}"
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                          {item.myRating ? (
                            <View style={[styles.historyRatingItem, Boolean(item.receivedRating) && styles.historyRatingItemBorder]}>
                              <View style={styles.historyRatingStarsRow}>
                                <Ionicons name="star" size={13} color="#087653" />
                                <Text style={styles.historyRatingVal}>You rated {item.myRating}★</Text>
                              </View>
                              {item.myFeedback ? (
                                <Text style={styles.historyFeedbackText} numberOfLines={2}>
                                  "{item.myFeedback}"
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      {isCompleted && !item.reviewed && (
                          <View style={{ flex: 1 }}>
                            <Pressable
                              style={styles.rateBtn}
                              onPress={() => router.push({ pathname: "/requests/[id]", params: { id: item.id, kind: item.kind } })}
                              accessibilityRole="button"
                            >
                              <Ionicons name="star" size={14} color="#F59E0B" />
                              <Text style={styles.rateBtnText} numberOfLines={1}>Rate & review</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}><Ionicons name="reader-outline" size={27} color="#176B58" /></View>
                <Text style={styles.emptyStateTitle}>{selectedAppFilter === "all" ? "Your work updates will appear here" : `No ${APP_STATUS_FILTERS.find((filter) => filter.id === selectedAppFilter)?.label.toLowerCase()} applications`}</Text>
                <Text style={styles.emptyStateBody}>{selectedAppFilter === "all" ? "Apply for a nearby job to track replies, accepted work and next steps in one place." : "Try another status filter to see more of your applications."}</Text>
                <Pressable accessibilityRole="button" style={styles.emptyStateAction} onPress={() => selectedAppFilter === "all" ? setActiveTab("jobs") : setSelectedAppFilter("all")}>
                  <Text style={styles.emptyStateActionText}>{selectedAppFilter === "all" ? "Explore nearby jobs" : "Show all applications"}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Profile Tab */
        <View style={styles.profileIntro}>
          <View style={styles.profileIntroIcon}><Ionicons name="person" size={26} color="#176B58" /></View>
          <Text style={styles.profileIntroEyebrow}>YOUR WORKER PROFILE</Text>
          <Text style={styles.profileIntroTitle}>Build trust. Get noticed.</Text>
          <Text style={styles.profileIntroBody}>Keep your details, work history and reputation up to date so local employers know what you bring.</Text>
          <Pressable style={styles.manageProfileBtn} onPress={() => router.push("/seeker-profile")}>
            <Text style={styles.manageProfileBtnText}>Manage my profile</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
          <View style={styles.profileTrustNote}><Ionicons name="shield-checkmark-outline" size={17} color="#176B58" /><Text style={styles.profileTrustText}>Your phone number stays private until a job is accepted.</Text></View>
        </View>
      )}
      </PageTransition>

      {activeTab === "jobs" ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.jobBottomFade, { height: jobsBottomFadeHeight, opacity: bottomFadeOpacity }]}
        >
          <LinearGradient
            colors={["rgba(248,250,247,0)", "rgba(248,250,247,0.96)", colors.paper]}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <ProviderBottomNav
        visible={activeTab !== "jobs" || bottomNavVisible}
        variant="seeker"
        seekerActive={activeTab === "applications" ? "applications" : "findWork"}
        onSeekerTabChange={(tab) => setActiveTab(tab === "applications" ? "applications" : "jobs")}
      />

      <JobDetailsSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
      <JobApplicationsModal
        visible={!!appsModalJob}
        jobId={appsModalJob?.id}
        jobTitle={appsModalJob?.customTitle || appsModalJob?.title}
        initialApplicants={appsModalJob?.applicants}
        initialApplicantCount={appsModalJob?.applicantCount || appsModalJob?.applicants?.length}
        onClose={() => setAppsModalJob(null)}
      />

      {/* Seeker cancellation confirmation */}
      <Modal
        visible={!!cancelConfirmApp}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setCancelConfirmApp(null)}
      >
        <View style={styles.cancelConfirmOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCancelConfirmApp(null)}
            accessibilityRole="button"
            accessibilityLabel="Close cancellation confirmation"
          />
          {cancelConfirmApp ? (
            <View style={styles.cancelConfirmCard} accessibilityViewIsModal>
              <View style={styles.cancelConfirmHeading}>
                <View style={styles.cancelConfirmIcon}>
                  <Ionicons name="close" size={20} color="#B42318" />
                </View>
                <Text style={styles.cancelConfirmTitle}>
                  {cancelConfirmApp.status === "ACCEPTED" || cancelConfirmApp.status === "IN_PROGRESS"
                    ? "Cancel this job?"
                    : "Cancel application?"}
                </Text>
              </View>
              <Text style={styles.cancelConfirmDescription}>
                {cancelConfirmApp.status === "ACCEPTED" || cancelConfirmApp.status === "IN_PROGRESS"
                  ? "The employer will be notified."
                  : "You can review the cancellation before confirming."}
              </Text>

              <View style={styles.cancelConfirmJob}>
                <View style={styles.cancelConfirmJobIcon}>
                  <Ionicons name="briefcase-outline" size={17} color="#086649" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cancelConfirmJobTitle} numberOfLines={2}>
                    {cancelConfirmApp.title || "Work application"}
                  </Text>
                  {!!cancelConfirmApp.area && (
                    <Text style={styles.cancelConfirmJobArea} numberOfLines={1}>
                      {cancelConfirmApp.area}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.cancelConfirmActions}>
                <Pressable
                  style={styles.cancelConfirmKeep}
                  onPress={() => setCancelConfirmApp(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelConfirmKeepText}>Go back</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelConfirmContinue}
                  onPress={() => {
                    const item = cancelConfirmApp;
                    setCancelConfirmApp(null);
                    if (item) setTimeout(() => setCancellingApp(item), 220);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelConfirmContinueText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Seeker Cancellation Modal */}
      <CancellationModal
        visible={!!cancellingApp}
        title={
          cancellingApp?.status === "ACCEPTED" || cancellingApp?.status === "IN_PROGRESS"
            ? `Cancel Job: ${cancellingApp?.title || "Work"}`
            : `Cancel Application: ${cancellingApp?.title || "Job"}`
        }
        isProvider={false}
        onClose={() => setCancellingApp(null)}
        onConfirm={handleCancelApplicationConfirm}
      />

      {/* Delete Application Confirmation Popup */}
      <Modal
        visible={!!deletingApp}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setDeletingApp(null);
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isDeleting) setDeletingApp(null);
            }}
          />
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconRing}>
              <Ionicons name="trash-outline" size={26} color="#DC2626" />
            </View>

            <Text style={styles.deleteModalTitle}>{deletingApp?.status === "COMPLETED" ? "Remove from history?" : "Delete Application?"}</Text>
            <Text style={styles.deleteModalDesc}>
              {deletingApp?.status === "COMPLETED"
                ? "This completed job will be removed from your history. The other participant’s history and reviews will remain."
                : "This will permanently remove this cancelled application from your history. This cannot be undone."}
            </Text>

            {deletingApp && (
              <View style={styles.deleteModalJobSnippet}>
                <Text style={styles.deleteModalJobTitle} numberOfLines={2}>
                  {deletingApp.title}
                </Text>
                <View style={styles.deleteModalMetaRow}>
                  <Ionicons name="location-outline" size={13} color="#6B7280" />
                  <Text style={styles.deleteModalJobArea} numberOfLines={1}>
                    {deletingApp.area || "Worksite location"}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.deleteModalActions}>
              <Pressable
                style={styles.deleteModalCancelBtn}
                onPress={() => setDeletingApp(null)}
                disabled={isDeleting}
                accessibilityRole="button"
              >
                <Text style={styles.deleteModalCancelText}>Keep</Text>
              </Pressable>

              <Pressable
                style={[styles.deleteModalConfirmBtn, isDeleting && styles.deleteModalConfirmBtnDisabled]}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                accessibilityRole="button"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash" size={15} color="#FFFFFF" />
                  <Text style={styles.deleteModalConfirmText}>{deletingApp?.status === "COMPLETED" ? "Remove" : "Delete"}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toastVisible && toastMessage ? (
        <Animated.View
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              top: insets.top + 10,
              opacity: toastOpacity,
              transform: [{ translateY: toastOffset }],
            },
          ]}
        >
          <View style={styles.toastCheck}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <JobCompletionConfirmationSheet
        visible={!!completionPrompt}
        interaction={completionPrompt}
        isOwner={false}
        onClose={dismissCompletionPrompt}
        onConfirm={handleConfirmCompletion}
        onReviewJob={(interaction) => {
          if (interaction.jobId) {
            router.push(`/jobs/${interaction.jobId}`);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  jobsScreenSafeArea: { backgroundColor: "#103F34" },
  mainContent: { flex: 1, minHeight: 0, backgroundColor: colors.paper },
  topBar: {
    zIndex: 10,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: "#103F34",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowColor: "#0B3027", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12 },
      android: { elevation: 5 },
      web: { boxShadow: "0 8px 20px rgba(11, 48, 39, 0.12)" } as any,
    }),
  },
  stickyCategoryHeader: {
    zIndex: 20,
    backgroundColor: "#FFFFFF",
  },
  radiusFeedRow: { backgroundColor: "#FFFFFF", paddingTop: 6 },
  navRow: { minHeight: 46, width: "100%", flexDirection: "row", flexWrap: "nowrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brandMark: { flexShrink: 0 },
  seekerLocationPill: {
    position: "relative",
    height: 40,
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 7,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.25,
    borderColor: "rgba(255, 255, 255, 0.3)",
    overflow: "hidden",
  },
  seekerLocationBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  seekerLocationTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  seekerLocationPin: {
    position: "absolute",
    left: 10,
    top: 0,
    bottom: 0,
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  seekerLocationText: {
    position: "absolute",
    left: 36,
    right: 28,
    top: 0,
    bottom: 0,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  seekerLocationChevron: {
    position: "absolute",
    top: 0,
    right: 8,
    bottom: 0,
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationAction: { width: 42, height: 42, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", position: "relative" },
  notificationCount: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#E8664C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#103F34" },
  notificationCountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  profileIntro: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30, paddingBottom: 30 },
  profileIntroIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: "#E2EFE7", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  profileIntroEyebrow: { color: "#176B58", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
  profileIntroTitle: { color: "#0D2318", fontSize: 24, fontWeight: "800", letterSpacing: -0.55, textAlign: "center" },
  profileIntroBody: { color: "#52665A", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9, maxWidth: 320 },
  profileTrustNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, padding: 12, borderRadius: 14, backgroundColor: "#EAF3EC", maxWidth: 340 },
  profileTrustText: { flex: 1, color: "#315B45", fontSize: 11.5, lineHeight: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 24 },
  emptyStateIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#E8F1EB", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyStateTitle: { color: "#17251D", fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.25 },
  emptyStateBody: { color: "#617067", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, maxWidth: 330 },
  jobsLoadingState: { flexGrow: 1, paddingTop: 12 },
  jobsEmptyState: { flexGrow: 1, minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 24 },
  emptyStateAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#176B58", borderRadius: 14, paddingHorizontal: 16, marginTop: 16 },
  emptyStateActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderRadius: 12, borderWidth: 1, borderColor: "#F0D5CA", backgroundColor: "#FFF8F5", padding: 10 },
  errorBannerText: { color: "#70493D", fontSize: 11, lineHeight: 15, flex: 1 },
  errorBannerAction: { color: "#8B3C28", fontSize: 12, fontWeight: "800", padding: 3 },
  content: { flex: 1, minHeight: 0, position: "relative" },
  jobsList: { flex: 1, minHeight: 0 },
  jobsListContent: { flexGrow: 1, paddingTop: 0, paddingBottom: 108 },
  jobBottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50 },
  searchContainer: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 0 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#DCE6E0",
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  searchBarFocused: { borderColor: "#176B58" },
  searchInput: { flex: 1, minWidth: 0, paddingLeft: 16, paddingRight: 4, paddingVertical: 12, fontSize: 14.5, color: "#0D2318", fontWeight: "500" },
  searchActions: { flexDirection: "row", alignItems: "center", gap: 2, paddingRight: 5 },
  searchIcon: { width: 42, minHeight: 46, alignItems: "center", justifyContent: "center" },
  clearSearchIcon: { width: 30, height: 38, alignItems: "center", justifyContent: "center" },
  reloadIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E8F1EB" },
  // Ultra-Premium Category Rail Styles
  categoryRailContainer: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingTop: 4,
    paddingBottom: 0,
  },
  categoryRailContent: {
    paddingVertical: 2,
    alignItems: "center",
  },
  categoryItemWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
    paddingBottom: 10,
  },
  categoryDividerLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
  },
  categoryDividerGap: {
    position: "absolute",
    left: 16,
    bottom: 0,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "#FFFFFF",
  },
  categorySelectionBorder: {
    position: "absolute",
    top: 2,
    bottom: 0,
    left: 16,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "#176B58",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  categoryBorderJoin: {
    position: "absolute",
    borderBottomWidth: 1.5,
    borderColor: "#176B58",
    backgroundColor: "transparent",
  },
  categoryBorderJoinLeft: {
    left: -12,
    borderRightWidth: 1.5,
  },
  categoryBorderJoinRight: {
    right: -12,
    borderLeftWidth: 1.5,
  },
  categoryIconWrap: {
    width: "100%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconTile: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F1EB", borderWidth: 1, borderColor: "#DCE9E0" },
  categoryIconTileSelected: { backgroundColor: "#176B58", borderColor: "#176B58" },
  categoryLabelBelow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  categoryLabelViewport: {
    overflow: "hidden",
    alignItems: "center",
  },
  categoryLabelBelowSelected: {
    color: "#176B58",
    fontWeight: "800",
  },
  // Ultra-Premium Radius Segmented Filter with Smooth Sliding Window
  radiusSegmentContainer: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  radiusSegmentTrack: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F4",
    borderWidth: 1,
    borderColor: "#E2ECE6",
    padding: 3,
  },
  slidingRadiusIndicator: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 16,
    backgroundColor: "#176B58",
    ...Platform.select({
      ios: {
        shadowColor: "#176B58",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  radiusSegmentTab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    zIndex: 2,
    backgroundColor: "transparent",
  },
  radiusSegmentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52665B",
    letterSpacing: -0.2,
  },
  radiusSegmentLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  jobSkeletonShadow: {
    marginHorizontal: 16,
    marginBottom: 11,
    borderRadius: 22,
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    padding: 12,
    overflow: "hidden",
  },
  skeletonProviderRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
    marginBottom: 7,
  },
  skeletonProviderInfo: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  skeletonAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#E1EAE4" },
  skeletonProviderLines: { justifyContent: "center", gap: 4 },
  skeletonBlock: { backgroundColor: "#E5ECE7", borderRadius: 5 },
  skeletonProviderName: { width: 82, height: 10 },
  skeletonProviderRating: { width: 62, height: 7, borderRadius: 4 },
  skeletonPayBadge: { width: 100, height: 30, borderRadius: 12, backgroundColor: "#EAF1EC" },
  skeletonDivider: { width: "48%", height: 1, borderRadius: 1, backgroundColor: "#E2ECE5", marginBottom: 9 },
  skeletonJobTitle: { width: "72%", height: 22, borderRadius: 5, marginBottom: 8 },
  skeletonLocationRow: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, marginBottom: 8, borderRadius: 13, backgroundColor: "#F3F7F4" },
  skeletonLocationIcon: { width: 22, height: 22, borderRadius: 9, backgroundColor: "#DDE9E1" },
  skeletonLocationName: { width: "42%", height: 10 },
  skeletonDistance: { width: 78, height: 20, borderRadius: 9, backgroundColor: "#E5ECE7" },
  skeletonInfoGrid: { minHeight: 44, flexDirection: "row", alignItems: "stretch", paddingVertical: 2, marginBottom: 6 },
  skeletonInfoCell: { flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: 2, gap: 5 },
  skeletonInfoDivider: { width: 1, backgroundColor: "#E8EEE9", marginHorizontal: 7, marginVertical: 5 },
  skeletonDateLabel: { width: 32, height: 6, borderRadius: 3 },
  skeletonDateValue: { width: 48, height: 9, borderRadius: 4 },
  skeletonTimeLabel: { width: 28, height: 6, borderRadius: 3 },
  skeletonTimeValue: { width: "82%", height: 9, borderRadius: 4 },
  skeletonMembersLabel: { width: "90%", height: 6, borderRadius: 3 },
  skeletonMembersValue: { width: "76%", height: 9, borderRadius: 4 },
  skeletonActionsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#EEF2EF" },
  skeletonDetailsAction: { flex: 1, minHeight: 35, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 7 },
  skeletonDetailsText: { width: 86, height: 9, borderRadius: 4 },
  skeletonArrow: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#DDE8E1" },
  skeletonPrimaryAction: { flex: 1, height: 35, borderRadius: 14, backgroundColor: "#DDE8E1" },
  skeletonShimmerClip: { ...StyleSheet.absoluteFillObject, borderRadius: 22, overflow: "hidden" },
  skeletonShimmerBand: { position: "absolute", top: 0, bottom: 0, width: 120 },
  appsHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 5,
  },
  appsScreenTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0D2318",
    letterSpacing: -0.4,
  },
  appFilterBar: {
    paddingVertical: 8,
  },
  appFilterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E5DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: "#0D2318", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  appFilterChipSelected: {
    backgroundColor: "#103F34",
    borderColor: "#103F34",
    ...Platform.select({
      ios: { shadowColor: "#0B2B23", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  appFilterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2C4538",
  },
  appFilterChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  appFilterCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#EAF3ED",
    alignItems: "center",
    justifyContent: "center",
  },
  appFilterCountBadgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  appFilterCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#103F34",
  },
  appFilterCountTextSelected: {
    color: "#FFFFFF",
  },
  deleteAppBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  deleteAppBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#DC2626",
  },
  cancelConfirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(9, 25, 18, 0.54)",
  },
  cancelConfirmCard: {
    width: "100%",
    maxWidth: 340,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEE9",
    ...Platform.select({
      ios: { shadowColor: "#061B12", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.24, shadowRadius: 30 },
      android: { elevation: 22 },
    }),
  },
  cancelConfirmIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F0",
    borderWidth: 1,
    borderColor: "#FEE1DE",
  },
  cancelConfirmHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  cancelConfirmTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    color: "#142B21",
    letterSpacing: -0.2,
  },
  cancelConfirmDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#66766D",
  },
  cancelConfirmJob: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 13,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E5EEE8",
    backgroundColor: "#F7FAF8",
  },
  cancelConfirmJobIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5F3EB",
  },
  cancelConfirmJobTitle: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
    color: "#19382A",
  },
  cancelConfirmJobArea: {
    marginTop: 2,
    fontSize: 11,
    color: "#75847C",
  },
  cancelConfirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  cancelConfirmKeep: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4F0",
  },
  cancelConfirmKeepText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#315342",
  },
  cancelConfirmContinue: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "#B42318",
  },
  cancelConfirmContinueText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  toast: {
    position: "absolute",
    left: 32,
    right: 32,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#103F34",
    zIndex: 1000,
    ...Platform.select({
      ios: { shadowColor: "#08251B", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14 },
      android: { elevation: 16 },
    }),
  },
  toastCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E8B68",
  },
  toastText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(13, 35, 24, 0.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5ECE7",
    ...Platform.select({
      ios: { shadowColor: "#0D2318", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  deleteModalIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0D2318",
    textAlign: "center",
    marginBottom: 6,
  },
  deleteModalDesc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteModalJobSnippet: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  deleteModalJobTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  deleteModalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deleteModalJobArea: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  deleteModalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  deleteModalCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalCancelText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#475569",
  },
  deleteModalConfirmBtn: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteModalConfirmBtnDisabled: {
    opacity: 0.6,
  },
  deleteModalConfirmText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  historyRatingBox: {
    backgroundColor: "#F8FAF9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  historyRatingItem: {
    gap: 2,
  },
  historyRatingItemBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
  },
  historyRatingStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyRatingVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  historyFeedbackText: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
    lineHeight: 16,
  },
  loadMoreContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  historyCounterText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#E6F4EA",
    borderWidth: 1,
    borderColor: "#C4E5CE",
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#087653",
  },
  appCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    padding: 8,
    marginBottom: 9,
    ...Platform.select({
      ios: {
        shadowColor: "#0D2318",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.055,
        shadowRadius: 9,
      },
      android: { elevation: 2 },
    }),
  },
  notificationTargetCard: {
    borderColor: "#087653",
    borderWidth: 2,
    backgroundColor: "#F7FCF9",
  },
  notificationTargetBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginHorizontal: 7,
    marginTop: 7,
    marginBottom: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#EAF6EF",
  },
  notificationTargetText: { color: "#087653", fontSize: 10, fontWeight: "700" },
  appProviderRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  appProviderProfilePressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  appProviderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#E5F0E9",
    alignItems: "center",
    justifyContent: "center",
  },
  appProviderIdentity: {
    justifyContent: "center",
    gap: 2,
    flexShrink: 1,
    maxWidth: 180,
  },
  appHalfDivider: {
    width: "48%",
    height: 1,
    backgroundColor: "#E2ECE5",
    marginBottom: 8,
    borderRadius: 1,
  },
  appProviderName: {
    color: "#354A3E",
    fontSize: 12,
    fontWeight: "700",
  },
  appRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  appVerifiedTagText: {
    color: "#176B58",
    fontSize: 10.5,
    fontWeight: "700",
  },
  appPayBadge: {
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#D5E9DC",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  appPayText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#176B58",
  },
  appTitleHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  appTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0D2318",
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  appBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    alignSelf: "flex-start",
    marginTop: 1,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
  },
  appBadgeAccepted: {
    backgroundColor: "#EAF5EE",
    borderColor: "#D5E9DC",
  },
  appBadgeAcceptedText: {
    color: "#176B58",
  },
  appBadgeInProgress: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  appBadgeInProgressText: {
    color: "#0284C7",
  },
  appBadgeCompletion: {
    backgroundColor: "#EAF5EE",
    borderColor: "#BBDCC9",
  },
  appBadgeCompletionText: {
    color: "#176B58",
  },
  appBadgePending: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  appBadgePendingText: {
    color: "#D97706",
  },
  appBadgeRejected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  appBadgeRejectedText: {
    color: "#DC2626",
  },
  appBadgeCancelled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  appBadgeCancelledText: {
    color: "#6B7280",
  },
  appBadgeCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  appBadgeCompletedText: {
    color: "#059669",
  },
  appLocationRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    marginBottom: 7,
    borderRadius: 13,
    backgroundColor: "#F3F7F4",
  },
  appLocationIcon: {
    width: 22,
    height: 22,
    borderRadius: 9,
    backgroundColor: "#E2EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  appLocationText: {
    flex: 1,
    minWidth: 0,
    color: "#243C30",
    fontSize: 12.5,
    fontWeight: "700",
  },
  appCategoryPill: {
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  appCategoryPillText: {
    color: "#61766A",
    fontSize: 10.5,
    fontWeight: "700",
  },
  appInfoGrid: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 2,
    marginBottom: 5,
  },
  appInfoCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  appInfoDivider: {
    width: 1,
    backgroundColor: "#E8EEE9",
    marginHorizontal: 6,
    marginVertical: 4,
  },
  appInfoLabel: {
    color: "#839188",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.45,
    marginBottom: 2,
  },
  appInfoValue: {
    color: "#20382C",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  contactUnlockedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F8F4",
    borderWidth: 1,
    borderColor: "#D3E9DC",
    borderRadius: 14,
    padding: 8,
    marginVertical: 4,
    gap: 10,
  },
  unlockedHeader: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#176B58",
    letterSpacing: 0.5,
  },
  contactPersonRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  employerNameVal: {
    maxWidth: "46%",
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0D2318",
  },
  contactPersonDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#BED5C7",
  },
  employerPhoneVal: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: "#1B5E43",
    fontWeight: "600",
  },
  callEmployerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#176B58",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  callEmployerBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cancelledReasonBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 12,
    marginVertical: 6,
  },
  cancelledReasonTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 2,
  },
  cancelledReasonText: {
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 16,
  },
  completionPromptBox: {
    marginTop: 4,
    padding: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CFE3D6",
    backgroundColor: "#F3F9F5",
    gap: 5,
  },
  completionPromptCopy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  completionWaitingBox: {
    marginTop: 4,
    padding: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D7E5F3",
    backgroundColor: "#F5F8FC",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  completionStatusIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  completionPromptTitle: {
    color: "#173D31",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  completionPromptBody: {
    marginTop: 2,
    color: "#5B7167",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
  completionActionBtn: {
    minHeight: 44,
    width: "100%",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#14513F",
    backgroundColor: "#176B58",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completionActionDisabled: {
    opacity: 0.55,
  },
  completionRejectBtn: {
    minHeight: 38,
    width: "100%",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E8C7C3",
    backgroundColor: "#FFF8F7",
    alignItems: "center",
    justifyContent: "center",
  },
  completionRejectText: { color: "#A33B32", fontSize: 12, fontWeight: "700" },
  completionActionText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },
  appCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2EF",
  },
  viewJobBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5E7DC",
    backgroundColor: "#F3F7F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewJobBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#176B58",
  },
  cancelJobBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  cancelJobBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#E11D48",
  },
  withdrawBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  withdrawBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  rateBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#176B58",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  rateBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  manageProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#176B58",
    marginTop: 20,
    alignSelf: "stretch",
  },
  manageProfileBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

