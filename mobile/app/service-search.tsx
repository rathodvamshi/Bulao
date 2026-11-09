import { AppImage as Image } from '../src/components/AppImage';
import {
  View,
  Text,
  TextInput,
  Animated,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Keyboard,
  } from "react-native";
import { useState, useMemo, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api, ApiError } from "../src/api/client";
import { useAuth } from "../src/auth";
import { dash } from "../src/components/provider/palette";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";
import { serviceApi, tenDigitPhone, servicePhoneVisible } from "../src/api/serviceApi";
import { useLocation } from "../src/store/location";
import {
  ALL_CATEGORIES_LIST,
  type CategoryFilter,
} from "../src/components/service/searchCategories";
import { ServiceCategoryRail } from "../src/components/service/ServiceCategoryRail";
import { useRotatingSearchHint } from "../src/components/service/useRotatingSearchHint";

interface ServiceSearchResult {
  id: string;
  providerId?: string;
  title: string;
  providerName: string;
  providerPhoto?: string | null;
  providerPhone?: string | null;
  ownerRating: number | null;
  ownerReviewsCount: number;
  coverImage?: string | null;
  category: string;
  categorySlug: CategoryFilter;
  rating: number | null;
  reviewCount: number;
  distanceKm: number;
  area: string;
  priceText?: string | null;
  serviceMode: string;
  serviceModeTag: string;
  keyServices: string[];
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  isVerified: boolean;
  phoneVisible: boolean;
}

const INITIAL_PAGE_SIZE = 6;

const ROLE_SYNONYMS: Record<string, string[]> = {
  automotive: ["car", "auto", "vehicle", "mechanic", "motor", "repair", "garage", "puncture", "wheel", "engine", "car repair", "bike", "scooter"],
  mechanic: ["car", "auto", "vehicle", "mechanic", "motor", "repair", "garage", "puncture", "wheel", "engine", "bike", "scooter"],
  electrical: ["electrician", "wiring", "light", "fan", "switch", "fuse", "power", "short circuit", "appliance", "electricals"],
  electrician: ["electrician", "wiring", "light", "fan", "switch", "fuse", "power", "short circuit", "appliance", "electricals"],
  plumbing: ["plumber", "pipe", "leak", "tap", "sink", "drain", "water", "toilet", "bathroom", "faucet"],
  plumber: ["plumber", "pipe", "leak", "tap", "sink", "drain", "water", "toilet", "bathroom", "faucet"],
  cleaning: ["cleaner", "maid", "housekeeping", "sweeping", "washing", "deep clean", "sanitization", "cleaning"],
  cleaner: ["cleaner", "maid", "housekeeping", "sweeping", "washing", "deep clean", "sanitization", "cleaning"],
  appliance: ["ac", "fridge", "refrigerator", "washing machine", "tv", "microwave", "oven", "cooler", "air conditioner"],
  cooking: ["cook", "chef", "catering", "meal", "food", "kitchen", "dinner", "lunch"],
  "food-catering": ["cook", "chef", "catering", "meal", "food", "kitchen", "dinner", "lunch", "tiffin"],
  painting: ["painter", "paint", "wall", "color", "whitewash", "texture"],
  painter: ["painter", "paint", "wall", "color", "whitewash", "texture"],
  carpentry: ["carpenter", "wood", "furniture", "door", "table", "chair", "bed", "sofa"],
  carpenter: ["carpenter", "wood", "furniture", "door", "table", "chair", "bed", "sofa"],
  pest: ["pest", "cockroach", "termite", "bedbug", "mosquito", "insects", "rat"],
  beauty: ["salon", "makeup", "haircut", "beautician", "barber", "grooming", "facial"],
  "beauty-service": ["salon", "makeup", "haircut", "beautician", "barber", "grooming", "facial", "salon", "parlour"],
  tutoring: ["tutor", "tuition", "teacher", "maths", "physics", "class", "exam", "coaching", "school", "college"],
  "computer-repair": ["laptop", "computer", "pc", "desktop", "mac", "windows", "software", "printer"],
  "mobile-repair": ["mobile", "phone", "iphone", "android", "display", "screen", "charging"],
  gardener: ["garden", "gardener", "lawn", "plant", "trees", "grass", "pots"],
  driver: ["driver", "driving", "cab", "chauffeur", "car driver"],
  health: ["nurse", "caregiver", "elderly", "patient", "medical", "physiotherapy", "health"],
  security: ["cctv", "security", "guard", "camera", "watchman"],
  other: ["other", "custom", "specialist"],
};

function normalizeCategoryText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveCategorySlug(value: string): CategoryFilter {
  const normalized = normalizeCategoryText(value);
  if (!normalized) return "all";

  const exactCategory = ALL_CATEGORIES_LIST.find((category) => {
    if (category.id === "all") return false;
    const id = normalizeCategoryText(category.id);
    const label = normalizeCategoryText(category.label);
    return normalized.includes(id) || normalized.includes(label);
  });
  if (exactCategory) return exactCategory.id;

  const synonymCategory = ALL_CATEGORIES_LIST.find((category) => {
    if (category.id === "all") return false;
    return (ROLE_SYNONYMS[category.id] || []).some((term) => {
      const normalizedTerm = normalizeCategoryText(term);
      return normalizedTerm.length > 2 && normalized.includes(normalizedTerm);
    });
  });
  return synonymCategory?.id || "all";
}

function formatDistanceText(distanceKm: number | null | undefined): string {
  if (distanceKm === undefined || distanceKm === null) return "1.2 km away";
  const num = Number(distanceKm);
  if (isNaN(num) || num <= 0) return "0.5 km away";
  if (num < 0.1) return "0.2 km away";
  return `${num.toFixed(1)} km away`;
}

function getSpecificationIcon(tag: string): keyof typeof Ionicons.glyphMap {
  const lower = tag.toLowerCase();
  if (/clean|wash|maid|housekeep|sanit/i.test(lower)) return "sparkles";
  if (/water|pipe|leak|plumb|tap|sink|drain/i.test(lower)) return "water";
  if (/wire|electric|light|power|switch|fan/i.test(lower)) return "flash";
  if (/ac|cool|air|fridge|refrig/i.test(lower)) return "snow";
  if (/engine|motor|brake|oil|clutch|gear|tyre|wheel|puncture|bike|car|auto|mechanic/i.test(lower)) return "construct";
  if (/paint|wall|color/i.test(lower)) return "color-palette";
  if (/wood|door|bed|table|sofa|carpenter/i.test(lower)) return "hammer";
  if (/hair|salon|beauty|facial|makeup/i.test(lower)) return "cut";
  if (/inspect|check|diag|tune|general/i.test(lower)) return "checkmark-done-circle";
  if (/pest|bug|termite/i.test(lower)) return "shield-half";
  if (/tutor|teach|class|exam/i.test(lower)) return "school";
  return "checkmark-circle";
}

export const RADIUS_FILTER_OPTIONS = [
  { id: "all", label: "All (50+ km)", maxKm: Infinity },
  { id: "50", label: "50 km", maxKm: 50 },
  { id: "30", label: "30 km", maxKm: 30 },
  { id: "20", label: "20 km", maxKm: 20 },
  { id: "10", label: "10 km", maxKm: 10 },
  { id: "5", label: "5 km", maxKm: 5 },
  { id: "2", label: "2 km", maxKm: 2 },
] as const;

export type RadiusFilterId = (typeof RADIUS_FILTER_OPTIONS)[number]["id"];

export default function ServiceSearchScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [query, setQuery] = useState(params.q || "");
  const requestedCategory = params.category as CategoryFilter | undefined;
  const initialCategory = ALL_CATEGORIES_LIST.some((category) => category.id === requestedCategory)
    ? requestedCategory!
    : "all";
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(initialCategory);
  const [activeRadius, setActiveRadius] = useState<RadiusFilterId>("all");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const searchInputRef = useRef<TextInput>(null);

  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const location = useLocation((state) => state.location);
  const { hint, opacity } = useRotatingSearchHint(location?.area);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Lazy Loading & Pagination State
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [isLazyLoading, setIsLazyLoading] = useState(false);

  // Confirmation Modal State
  const [selectedService, setSelectedService] = useState<ServiceSearchResult | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const toggleSave = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Live Database Fetch for Services (Zero Seed Defaults or Fake Data)
  const servicesDbQuery = useQuery({
    queryKey: ["db-services-search", debouncedQuery, location],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (!location) return [];
      queryParams.set("latitude", String(location.latitude));
      queryParams.set("longitude", String(location.longitude));
      queryParams.set("radiusKm", "50");
      if (debouncedQuery) {
        queryParams.set("q", debouncedQuery);
      }
      const res = await api<{ items?: Array<any> }>(`/services?${queryParams.toString()}`);
      const dbItems = res?.items || [];
      return dbItems.map((s: any) => {
          const categoryText = String(s.category || s.categoryName || "");
          const categorySlug = resolveCategorySlug(categoryText);
          const matchingCatMeta =
            ALL_CATEGORIES_LIST.find((c) => c.id === categorySlug) || ALL_CATEGORIES_LIST[0]!;

          let portfolio: string[] = [];
          try {
            portfolio = typeof s.portfolioUrls === "string" ? JSON.parse(s.portfolioUrls) : s.portfolioUrls || [];
          } catch {
            portfolio = [];
          }

          let rawOffered: any[] = [];
          try {
            rawOffered = typeof s.offeredServices === "string" ? JSON.parse(s.offeredServices) : s.offeredServices || [];
          } catch {
            rawOffered = [];
          }
          const offeredList: string[] = (Array.isArray(rawOffered) ? rawOffered : [])
            .filter((x: any) => typeof x === "string" && x.trim().length > 0)
            .map((tag: string) =>
              tag
                .replace(/[-_]+/g, " ")
                .trim()
                .replace(/\b\w/g, (char) => char.toUpperCase())
            );

          const coverPhoto = s.shopPhotoUrl || portfolio[0] || s.providerPhoto || null;

          const modeTag =
            s.serviceMode === "doorstep"
              ? "Doorstep"
              : s.serviceMode === "at_center"
              ? "In-Shop"
              : "Hybrid (Home & Shop)";

          const ratingVal = s.rating !== null && s.rating !== undefined ? Number(s.rating) : null;
          const reviewsCountVal = s.totalReviews ? Number(s.totalReviews) : (s.completed ? Number(s.completed) : 0);
          const ownerRatingVal = s.ownerRating !== null && s.ownerRating !== undefined ? Number(s.ownerRating) : null;
          const ownerReviewsCountVal = s.ownerReviewsCount ? Number(s.ownerReviewsCount) : 0;

          let basePriceTextVal: string | null = null;
          if (s.basePricePaise && Number(s.basePricePaise) > 0) {
            const amount = Math.round(Number(s.basePricePaise) / 100);
            if (s.pricingModel === "hourly") {
              basePriceTextVal = `₹${amount}/hr`;
            } else if (s.pricingModel === "visit" || s.pricingModel === "inspection") {
              basePriceTextVal = `₹${amount} visit`;
            } else {
              basePriceTextVal = `₹${amount} onwards`;
            }
          } else if (s.pricingModel === "free_inspection") {
            basePriceTextVal = "Free inspection";
          }

          return {
            id: s.id,
            providerId: s.userId,
            title: s.title || s.category || "Service Profile",
            providerName: s.providerName || "Service Provider",
            providerPhoto: s.providerPhoto || null,
            providerPhone: s.providerPhone || s.ownerPhone || null,
            ownerRating: ownerRatingVal,
            ownerReviewsCount: ownerReviewsCountVal,
            coverImage: coverPhoto,
            category: s.category || s.categoryName || "Service category not provided",
            categorySlug,
            rating: ratingVal,
            reviewCount: reviewsCountVal,
            distanceKm: s.distanceKm ? Number(s.distanceKm) : 0,
            area: s.area || "Local Area",
            priceText: basePriceTextVal,
            serviceMode: s.serviceMode || "both",
            serviceModeTag: modeTag,
            keyServices: offeredList,
            icon: matchingCatMeta.icon,
            color: matchingCatMeta.color,
            bg: matchingCatMeta.bg,
            isVerified: Boolean(s.providerVerified ?? true),
            phoneVisible: servicePhoneVisible(s.phoneVisible) || Boolean(s.ownerPhone),
          } as ServiceSearchResult;
      });
    },
    enabled: !!location,
    staleTime: 10000,
  });

  // Category filtering is local because the service query already loads all categories.
  const handleSelectCategory = (catId: CategoryFilter) => {
    setActiveCategory(catId);
    setVisibleCount(INITIAL_PAGE_SIZE);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSelectRadius = (radiusId: RadiusFilterId) => {
    setActiveRadius(radiusId);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  const dbServicesList = servicesDbQuery.data || [];

  const selectedRadiusOption = useMemo(() => {
    return (
      RADIUS_FILTER_OPTIONS.find((opt) => opt.id === activeRadius) || RADIUS_FILTER_OPTIONS[0]
    );
  }, [activeRadius]);

  // Combined Multi-Field Filtering Strategy (Category + Radius + Text Fuzzy Match)
  // Cards sorted in ASCENDING order (closest first: 0.2 km -> 0.5 km -> 1.2 km ...)
  const results = useMemo(() => {
    let list = dbServicesList;

    // 1. Category Filtering
    if (activeCategory !== "all") {
      list = list.filter((s) => s.categorySlug === activeCategory);
    }

    // 2. Radius Filtering (Distance <= maxKm)
    if (selectedRadiusOption.maxKm !== Infinity) {
      list = list.filter((s) => {
        const dist = s.distanceKm ?? 0;
        return dist <= selectedRadiusOption.maxKm;
      });
    }

    // 3. Multi-Field Fuzzy Match (Category + Role + Title + Provider Name + Area + Synonyms)
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((s) => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const providerMatch = s.providerName.toLowerCase().includes(q);
        const categoryMatch =
          s.category.toLowerCase().includes(q) || s.categorySlug.toLowerCase().includes(q);
        const areaMatch = s.area.toLowerCase().includes(q);
        const synonyms = ROLE_SYNONYMS[s.categorySlug] || [];
        const synonymMatch = synonyms.some((syn) => syn.includes(q) || q.includes(syn));

        return titleMatch || providerMatch || categoryMatch || areaMatch || synonymMatch;
      });
    }

    // 4. Sort Cards in ASCENDING Order (Closest distance first)
    return [...list].sort((a, b) => {
      const distA = a.distanceKm ?? 999999;
      const distB = b.distanceKm ?? 999999;
      if (distA !== distB) {
        return distA - distB; // Ascending distance (closest first)
      }
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA; // Secondary sort: higher rating
      }
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });
  }, [dbServicesList, query, activeCategory, selectedRadiusOption]);

  const paginatedResults = useMemo(() => {
    return results.slice(0, visibleCount);
  }, [results, visibleCount]);

  const activeCategoryLabel =
    ALL_CATEGORIES_LIST.find((category) => category.id === activeCategory)?.label || "services";

  const hasMoreResults = visibleCount < results.length;

  const handleLoadMore = () => {
    if (hasMoreResults && !isLazyLoading) {
      setIsLazyLoading(true);
      setTimeout(() => {
        setVisibleCount((previous) => previous + INITIAL_PAGE_SIZE);
        setIsLazyLoading(false);
      }, 400);
    }
  };

  const openConfirmation = (serviceItem: ServiceSearchResult) => {
    if (serviceItem.providerId && serviceItem.providerId === session?.userId) {
      Alert.alert("Your own service", "You cannot submit a booking request to your own service.");
      return;
    }
    setSelectedService(serviceItem);
    setConfirmModalVisible(true);
  };

  const handleConfirmRequest = async () => {
    if (!selectedService) return;
    if (!session?.token) {
      setConfirmModalVisible(false);
      router.push("/auth");
      return;
    }

    setSubmittingRequest(true);
    if (!location) {
      Alert.alert("Choose a location", "Select your service location before sending a request.");
      setSubmittingRequest(false);
      return;
    }
    const requestPayload = {
      serviceId: selectedService.id,
      details: `Booking request for ${selectedService.title}`,
      area: selectedService.area || location.area || "Local Area",
      latitude: location.latitude,
      longitude: location.longitude,
      scheduledAt: Math.floor(Date.now() / 1000) + 3600,
    };

    try {
      await serviceApi.request(selectedService.id, location, requestPayload.details, requestPayload.scheduledAt);

      setConfirmModalVisible(false);
      setSubmittingRequest(false);
      Alert.alert(
        "Request Submitted! 🎉",
        `Your request for ${selectedService.title} has been sent to ${selectedService.providerName}. Redirecting to your Requests tab...`,
        [
          {
            text: "View Requests",
            onPress: () => router.push("/service-requests"),
          },
        ],
      );
      setTimeout(() => {
        router.push("/service-requests");
      }, 1500);
    } catch (err: any) {
      setSubmittingRequest(false);
      const code = err instanceof ApiError ? err.code : "";
      const messageByCode: Record<string, string> = {
        INVALID_LOCATION: "Choose a valid service location before booking.",
        OUTSIDE_SERVICE_AREA: "This provider does not cover your selected location.",
        SERVICE_UNAVAILABLE: "This provider is currently unavailable.",
        REQUEST_EXISTS: "You already have an active request for this service.",
        SELF_REQUEST: "You cannot book your own service.",
        BLOCKED_USER: "This request cannot be sent because the connection is blocked.",
      };
      Alert.alert(
        "Booking Error",
        messageByCode[code] || err.message || "Couldn't send request. Please try again.",
      );
    }
  };

  const callProvider = (
    phone: string | null | undefined,
    phoneVisible: boolean,
    providerName: string,
  ) => {
    const actualPhone = tenDigitPhone(phone);
    if (!phoneVisible || !actualPhone) {
      Alert.alert(
        "Contact Provider",
        `${providerName} has restricted direct calling visibility. Please submit a Service Request to connect directly.`,
      );
      return;
    }
    const cleanPhone = actualPhone;
    Alert.alert(
      `Call ${providerName}`,
      `Provider Phone: ${cleanPhone}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Dial Call`,
          onPress: () => {
            Linking.openURL(`tel:${cleanPhone}`).catch(() => {
              Alert.alert("Call Error", `Phone dialer is unavailable for ${cleanPhone}.`);
            });
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" translucent />

      {/* Header Container */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Search Bar Row */}
        <View style={styles.searchContainer}>
          <View style={styles.inputWrapper}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={dash.ink} />
            </Pressable>
            <TextInput
              ref={searchInputRef}
              autoFocus={!params.q && !params.category}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
              placeholder=""
              style={styles.input}
              returnKeyType="search"
            />
            {!query && (
              <Animated.Text
                pointerEvents="none"
                numberOfLines={1}
                style={[
                  styles.inputHint,
                  {
                    opacity,
                    transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
                  },
                ]}
              >
                {hint}
              </Animated.Text>
            )}
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} style={styles.clearBtn} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        <ServiceCategoryRail activeCategory={activeCategory} onSelect={handleSelectCategory} style={{ marginTop: 8, height: 50 }} />

        {/* Radius Filtering Rail (Descending Order: Highest First) */}
        <View style={styles.radiusFilterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.radiusScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.radiusFilterLabelPill}>
              <Ionicons name="navigate-circle" size={13} color="#047857" />
              <Text style={styles.radiusFilterLabelText}>Radius</Text>
            </View>

            {RADIUS_FILTER_OPTIONS.map((opt) => {
              const isActive = activeRadius === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by radius ${opt.label}`}
                  onPress={() => handleSelectRadius(opt.id)}
                  style={[
                    styles.radiusChip,
                    isActive && styles.radiusChipActive,
                  ]}
                >
                  <Ionicons
                    name={opt.id === "all" ? "globe-outline" : "radio-button-on"}
                    size={11}
                    color={isActive ? "#FFFFFF" : "#047857"}
                  />
                  <Text
                    style={[
                      styles.radiusChipText,
                      isActive && styles.radiusChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Results Area */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isNearBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
          if (isNearBottom) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={32}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardVisible ? 24 : 110 + insets.bottom },
        ]}
      >
        {/* Results summary */}
        <View style={styles.resultsHeaderRow}>
          <View>
            <Text style={styles.resultsCountText}>
              {results.length} {results.length === 1 ? "service" : "services"}
            </Text>
            <Text style={styles.resultsNearText}>
              Near {location?.area || "your area"}
              {selectedRadiusOption.maxKm !== Infinity ? ` (within ${selectedRadiusOption.label})` : ""}
            </Text>
          </View>
          <View style={styles.summaryBadgesRow}>
            {selectedRadiusOption.maxKm !== Infinity && (
              <Pressable
                onPress={() => handleSelectRadius("all")}
                style={styles.activeRadiusBadge}
              >
                <Ionicons name="close-circle" size={12} color="#0369A1" />
                <Text style={styles.activeRadiusBadgeText}>{selectedRadiusOption.label}</Text>
              </Pressable>
            )}
            <View style={styles.activeCategoryBadge}>
              <Text style={styles.activeCategoryBadgeText}>{activeCategoryLabel}</Text>
            </View>
          </View>
        </View>

        {!location ? (
          <View style={[styles.emptyState, keyboardVisible && styles.emptyStateCompact]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="location-outline" size={30} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>Choose your area</Text>
            <Text style={styles.emptySub}>Set your location to find services and providers near you.</Text>
            <Pressable onPress={() => useLocation.getState().setLocationSheetVisible(true)} style={styles.emptyActionButton}>
              <Text style={styles.emptyActionText}>Set location</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : servicesDbQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color="#047857" />
            <Text style={styles.loadingText}>Finding services near you…</Text>
          </View>
        ) : servicesDbQuery.isError ? (
          <View style={[styles.emptyState, keyboardVisible && styles.emptyStateCompact]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cloud-offline-outline" size={28} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>Couldn’t load services</Text>
            <Text style={styles.emptySub}>Check your connection and try again.</Text>
            <Pressable onPress={() => void servicesDbQuery.refetch()} style={styles.emptyActionButton}>
              <Text style={styles.emptyActionText}>Try again</Text>
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : results.length === 0 ? (
          <View style={[styles.emptyState, keyboardVisible && styles.emptyStateCompact]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={36} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>
              {query.trim()
                ? activeCategory !== "all"
                  ? `No ${activeCategoryLabel.toLowerCase()} matches for "${query.trim()}"`
                  : `No exact profile match for "${query.trim()}"`
                : selectedRadiusOption.maxKm !== Infinity
                ? `No services within ${selectedRadiusOption.label}`
                : activeCategory !== "all"
                ? `No ${activeCategoryLabel.toLowerCase()} providers nearby yet`
                : "No matching services found"}
            </Text>
            <Text style={styles.emptySub}>
              {query.trim()
                ? `We couldn’t find a nearby listing for “${query.trim()}”. Try increasing the radius or post a request.`
                : selectedRadiusOption.maxKm !== Infinity
                ? `There are no active providers within ${selectedRadiusOption.label} of ${location?.area || "your area"}. Try selecting a wider radius like 50 km.`
                : activeCategory !== "all"
                ? `There are no ${activeCategoryLabel.toLowerCase()} listings near ${location?.area || "you"} right now. Try another category.`
                : `No services are listed near ${location?.area || "you"} yet. Try another search or category.`}
            </Text>

            {selectedRadiusOption.maxKm !== Infinity ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show all distances"
                onPress={() => handleSelectRadius("all")}
                style={styles.emptyActionButton}
              >
                <Ionicons name="globe-outline" size={15} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Expand to all distances</Text>
              </Pressable>
            ) : query.trim() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Post work request for ${query}`}
                onPress={() => router.push({ pathname: "/post-work", params: { title: query } })}
                style={styles.emptyActionButton}
              >
                <Text style={styles.emptyActionText}>Post a request</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {paginatedResults.map((item) => {
              const isSaved = savedIds.includes(item.id);
              const distanceText = formatDistanceText(item.distanceKm);

              return (
                <View key={item.id} style={styles.specCardContainer}>
                  {/* Clickable Card Body */}
                  <Pressable
                    style={styles.specCardTopArea}
                    onPress={() => {
                      router.push({
                        pathname: "/service-details",
                        params: { id: item.id },
                      });
                    }}
                  >
                    {/* 1. Owner Bar (Above Category Icon) */}
                    <View style={styles.ownerHeaderRow}>
                      <View style={styles.ownerProfileGroup}>
                        {item.providerPhoto ? (
                          <Image source={{ uri: item.providerPhoto }} style={styles.ownerAvatar} />
                        ) : (
                          <View style={styles.ownerAvatarPlaceholder}>
                            <Text style={styles.ownerAvatarInitials}>
                              {item.providerName.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={styles.ownerInfoBlock}>
                          <View style={styles.ownerNameLine}>
                            <Text style={styles.ownerNameText} numberOfLines={1}>
                              {item.providerName}
                            </Text>
                            {item.isVerified && (
                              <Ionicons name="checkmark-circle" size={12} color="#047857" />
                            )}
                          </View>

                          {/* Below Owner Name: Owner Rating */}
                          <View style={styles.ownerRatingLine}>
                            {item.ownerRating !== null ? (
                              <>
                                <Ionicons name="star" size={10} color="#F59E0B" />
                                <Text style={styles.ownerRatingNum}>{item.ownerRating.toFixed(1)}</Text>
                                <Text style={styles.ownerRatingSub}>
                                  ({item.ownerReviewsCount} {item.ownerReviewsCount === 1 ? "review" : "reviews"})
                                </Text>
                              </>
                            ) : (
                              <>
                                <Ionicons name="shield-checkmark" size={10} color="#047857" />
                                <Text style={styles.ownerNewText}>Verified Provider</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Top Right Corner of Owner: Service Delivery Tag */}
                      <View style={styles.modeInlineTag}>
                        <Ionicons
                          name={item.serviceModeTag.includes("Doorstep") ? "home" : "storefront"}
                          size={10.5}
                          color="#047857"
                        />
                        <Text style={styles.modeInlineTagText}>
                          {item.serviceModeTag}
                        </Text>
                      </View>
                    </View>

                    {/* 2. Service Hero Title + Category Icon Box */}
                    <View style={styles.serviceHeroRow}>
                      <View style={[styles.categoryIconBox, { backgroundColor: item.bg }]}>
                        {item.coverImage ? (
                          <Image
                            source={{ uri: item.coverImage }}
                            style={styles.categoryCoverImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name={item.icon}
                            size={26}
                            color={item.color}
                            style={{ marginBottom: 10 }}
                          />
                        )}

                        {/* Small Category Badge with Border placed at Bottom ON the Icon */}
                        <View style={styles.categoryBadgeOnIcon}>
                          <Text style={styles.categoryBadgeOnIconText} numberOfLines={1}>
                            {item.category}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.serviceHeroTextCol}>
                        <Text style={styles.serviceTitleText} numberOfLines={1}>
                          {item.title}
                        </Text>

                        {/* Second Line: Rating of Service on Left, Price on Right below Service Delivery */}
                        <View style={styles.ratingAndPriceRow}>
                          {item.rating !== null ? (
                            <View style={styles.serviceRatingPillInline}>
                              <Ionicons name="star" size={12} color="#F59E0B" />
                              <Text style={styles.serviceRatingInlineScore}>{item.rating.toFixed(1)}</Text>
                              <Text style={styles.serviceRatingInlineCount}>
                                ({item.reviewCount} {item.reviewCount === 1 ? "review" : "reviews"})
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.serviceNewBadgeInline}>
                              <Ionicons name="sparkles" size={11} color="#047857" />
                              <Text style={styles.serviceNewBadgeText}>New Service</Text>
                            </View>
                          )}

                          {/* Price below service delivery (only shown if starting price is provided) */}
                          {item.priceText ? (
                            <Text style={styles.heroPriceText} numberOfLines={1}>
                              {item.priceText}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* 3. Horizontal Location & Away Distance Bar (Placed Above) */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Location: ${item.area}, ${distanceText}`}
                    onPress={() => {
                      router.push({
                        pathname: "/service-details",
                        params: { id: item.id },
                      });
                    }}
                    style={styles.locationDistanceBar}
                  >
                    <View style={styles.locationLeftGroup}>
                      <View style={styles.locationIconCircle}>
                        <Ionicons name="location-sharp" size={13} color="#047857" />
                      </View>
                      <Text style={styles.locationAreaName} numberOfLines={1}>
                        {item.area}
                      </Text>
                    </View>

                    <View style={styles.distanceBadgePill}>
                      <Text style={styles.distanceAwayText}>
                        {distanceText}
                      </Text>
                      <Ionicons name="compass" size={14} color="#0284C7" />
                    </View>
                  </Pressable>

                  {/* 4. Services Provided Section (Placed Down) */}
                  {item.keyServices.length > 0 ? (
                    <>
                      <View style={styles.locationDivider} />
                      <View style={styles.servicesProvidedSection}>
                        <View style={styles.servicesProvidedHeader}>
                          <View style={styles.servicesProvidedTitleGroup}>
                            <Ionicons name="construct-outline" size={12} color="#047857" />
                            <Text style={styles.servicesProvidedTitle}>Services Provided</Text>
                          </View>
                          {item.keyServices.length > 2 && (
                            <Text style={styles.servicesScrollHint}>Swipe →</Text>
                          )}
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.servicesScrollContent}
                          nestedScrollEnabled
                        >
                          {item.keyServices.map((tag, idx) => {
                            const iconName = getSpecificationIcon(tag);
                            return (
                              <View key={idx} style={styles.serviceProvidedPill}>
                                <Ionicons name={iconName} size={13} color="#047857" />
                                <Text style={styles.serviceProvidedText} numberOfLines={1}>
                                  {tag}
                                </Text>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View style={styles.servicesBottomDivider} />
                    </>
                  ) : null}

                  {/* 5. Action Row: Call, View Service & Request Service */}
                  <View style={styles.threeButtonsRow}>
                    {/* 1. Call Action Button */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.providerName}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        callProvider(item.providerPhone, item.phoneVisible, item.providerName);
                      }}
                      style={styles.btnCall}
                    >
                      <Ionicons name="call" size={12.5} color="#047857" />
                      <Text style={styles.btnCallText} numberOfLines={1}>
                        Call
                      </Text>
                    </Pressable>

                    {/* 2. View Service Action Button */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${item.title}`}
                      onPress={() => {
                        router.push({
                          pathname: "/service-details",
                          params: { id: item.id },
                        });
                      }}
                      style={styles.btnViewService}
                    >
                      <Ionicons name="eye-outline" size={13} color="#1E293B" />
                      <Text style={styles.btnViewServiceText} numberOfLines={1}>
                        View Service
                      </Text>
                    </Pressable>

                    {/* 3. Request Service Action Button (Primary Solid Green) */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Request ${item.title}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        openConfirmation(item);
                      }}
                      style={styles.btnRequest}
                    >
                      <Ionicons name="flash" size={12.5} color="#FFFFFF" />
                      <Text style={styles.btnRequestText} numberOfLines={1}>
                        Request
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {/* Lazy Loading Footer Spinner */}
            {isLazyLoading && (
              <View style={{ paddingVertical: 14, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={{ fontSize: 11, color: dash.muted, marginTop: 4 }}>
                  Loading more providers…
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Instant Service Booking Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPress}
            onPress={() => setConfirmModalVisible(false)}
          />

          <View style={styles.confirmModalBox}>
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconCircle}>
                <Ionicons name="paper-plane" size={24} color="#047857" />
              </View>
              <Text style={styles.confirmTitle}>Confirm Service Request</Text>
              <Text style={styles.confirmSub}>
                Send instant request to {selectedService?.providerName}
              </Text>
            </View>

            {selectedService && (
              <View style={styles.confirmCardSummary}>
                <Text style={styles.summaryTitle}>{selectedService.title}</Text>
                <Text style={styles.summaryMeta}>
                  {selectedService.category} • {selectedService.area}
                </Text>
                {selectedService.priceText && (
                  <Text style={styles.summaryPrice}>{selectedService.priceText}</Text>
                )}
              </View>
            )}

            <View style={styles.confirmActionRow}>
              <Pressable
                disabled={submittingRequest}
                onPress={() => setConfirmModalVisible(false)}
                style={styles.cancelModalBtn}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={submittingRequest}
                onPress={handleConfirmRequest}
                style={styles.submitModalBtn}
              >
                {submittingRequest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Confirm Booking</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Bottom Navigation Bar */}
      <ServiceBottomNav active="home" visible={!keyboardVisible} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  radiusFilterBar: {
    marginTop: 8,
    paddingBottom: 2,
  },
  radiusScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6.5,
  },
  radiusFilterLabelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7.5,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  radiusFilterLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  radiusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9.5,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  radiusChipActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 2,
  },
  radiusChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  radiusChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  backBtn: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    paddingHorizontal: 15,
    gap: 12,
    height: 54,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: dash.ink,
    paddingVertical: 0,
  },
  inputHint: {
    position: "absolute",
    left: 55,
    right: 42,
    fontSize: 14,
    fontWeight: "600",
    color: "#829189",
  },
  clearBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    flexGrow: 1,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultsCountText: {
    fontSize: 15,
    fontWeight: "700",
    color: dash.ink,
  },
  resultsNearText: { fontSize: 12, color: dash.muted, marginTop: 2 },
  summaryBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeRadiusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  activeRadiusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
  },
  activeCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EAF5EE",
  },
  activeCategoryBadgeText: { fontSize: 11, fontWeight: "700", color: dash.primary },
  loadingState: {
    minHeight: 150,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EEEA",
  },
  loadingText: { fontSize: 13, fontWeight: "600", color: dash.muted },
  list: {
    gap: 16,
  },
  specCardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  specCardTopArea: {
    // Clickable container for owner + service preview
  },
  ownerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4.5,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  ownerProfileGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6.5,
    flex: 1,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  ownerAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  ownerAvatarInitials: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#047857",
  },
  ownerInfoBlock: {
    flex: 1,
    justifyContent: "center",
  },
  ownerNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
  },
  ownerNameText: {
    fontSize: 11,
    fontWeight: "800",
    color: dash.ink,
    maxWidth: 200,
  },
  ownerRatingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    marginTop: 0.5,
  },
  ownerRatingNum: {
    fontSize: 9,
    fontWeight: "700",
    color: dash.ink,
  },
  ownerRatingSub: {
    fontSize: 8.5,
    color: "#64748B",
    fontWeight: "500",
  },
  ownerNewText: {
    fontSize: 8.5,
    color: "#047857",
    fontWeight: "700",
  },
  serviceHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9.5,
    marginTop: 6,
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  categoryCoverImage: {
    width: "100%",
    height: "100%",
  },
  categoryBadgeOnIcon: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  categoryBadgeOnIconText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },
  serviceHeroTextCol: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 1,
    gap: 3.5,
  },
  titleAndModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  serviceTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: dash.ink,
  },
  modeInlineTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    flexShrink: 0,
  },
  modeInlineTagText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#047857",
  },
  ratingAndPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 0,
  },
  serviceRatingPillInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
  },
  serviceRatingInlineScore: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#D97706",
  },
  serviceRatingInlineCount: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#64748B",
  },
  serviceNewBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  serviceNewBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  heroPriceText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#047857",
    textAlign: "right",
  },
  locationDistanceBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 9,
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 6,
  },
  locationDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginTop: 5,
    marginBottom: 4,
  },
  locationLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5.5,
    flex: 1,
    marginRight: 8,
  },
  locationIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  locationAreaName: {
    fontSize: 12,
    fontWeight: "800",
    color: dash.ink,
  },
  distanceBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6.5,
    flexShrink: 0,
  },
  distanceAwayText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0369A1",
  },
  servicesProvidedSection: {
    marginTop: 0,
  },
  servicesProvidedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  servicesProvidedTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  servicesProvidedTitle: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  servicesScrollHint: {
    fontSize: 9,
    fontWeight: "700",
    color: "#0284C7",
  },
  servicesScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 6,
    paddingVertical: 1,
  },
  serviceProvidedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceProvidedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
  },
  servicesBottomDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginTop: 5,
    marginBottom: 0,
  },
  threeButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  btnCall: {
    flex: 0.8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#F0FDF4",
  },
  btnCallText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#047857",
  },
  btnViewService: {
    flex: 1.25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  btnViewServiceText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E293B",
  },
  btnRequest: {
    flex: 1.35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#047857",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.16,
    shadowRadius: 2.5,
    elevation: 2,
  },
  btnRequestText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EEEA",
  },
  emptyStateCompact: {
    paddingVertical: 16,
    gap: 7,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: dash.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#047857",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 13,
    marginTop: 8,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  confirmModalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: "auto",
    marginTop: "auto",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  confirmIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
  },
  confirmSub: {
    fontSize: 13,
    color: dash.muted,
    marginTop: 2,
  },
  confirmCardSummary: {
    backgroundColor: "#F8FAF8",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: dash.ink,
  },
  summaryMeta: {
    fontSize: 12,
    color: dash.muted,
    marginTop: 2,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#047857",
    marginTop: 6,
  },
  confirmActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: dash.ink,
  },
  submitModalBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#047857",
    alignItems: "center",
  },
  submitModalBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
