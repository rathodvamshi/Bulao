import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from "react-native";
import { useState, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api, ApiError } from "../src/api/client";
import { useAuth } from "../src/auth";
import { dash } from "../src/components/provider/palette";
import { ServiceCollectionSkeleton } from "../src/components/SkeletonLoader";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";
import { serviceApi, tenDigitPhone, servicePhoneVisible } from "../src/api/serviceApi";
import { useLocation } from "../src/store/location";

type CategoryFilter =
  | "all"
  | "automotive"
  | "appliance"
  | "electrical"
  | "plumbing"
  | "cleaning"
  | "painting"
  | "carpentry"
  | "cooking"
  | "pest"
  | "beauty";

interface CategoryMeta {
  id: CategoryFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

interface ServiceSearchResult {
  id: string;
  providerId?: string;
  title: string;
  providerName: string;
  providerPhoto?: string | null;
  providerPhone?: string | null;
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

const ALL_CATEGORIES_LIST: CategoryMeta[] = [
  { id: "all", label: "All Services", icon: "grid-outline", color: "#047857", bg: "#ECFDF5" },
  { id: "automotive", label: "Car & Auto", icon: "car-outline", color: "#047857", bg: "#ECFDF5" },
  { id: "appliance", label: "AC & Appliance", icon: "snow-outline", color: "#2B6CB0", bg: "#E8F1FF" },
  { id: "electrical", label: "Electrical", icon: "flash-outline", color: "#D97706", bg: "#FEF3C7" },
  { id: "plumbing", label: "Plumbing", icon: "water-outline", color: "#0369A1", bg: "#E0F2FE" },
  { id: "cleaning", label: "Cleaning", icon: "sparkles-outline", color: "#1A7A4A", bg: "#E8F6EE" },
  { id: "painting", label: "Painting", icon: "color-palette-outline", color: "#BE185D", bg: "#FCE7F3" },
  { id: "carpentry", label: "Carpentry", icon: "hammer-outline", color: "#B45309", bg: "#FEF3C7" },
  { id: "cooking", label: "Cook & Chef", icon: "restaurant-outline", color: "#C05621", bg: "#FFF1E4" },
  { id: "pest", label: "Pest Control", icon: "bug-outline", color: "#4C1D95", bg: "#F3E8FF" },
  { id: "beauty", label: "Beauty & Salon", icon: "cut-outline", color: "#DB2777", bg: "#FCE7F3" },
];

const ALL_PILL: CategoryMeta = ALL_CATEGORIES_LIST[0]!;

const TOP_FIVE_CATEGORIES = ALL_CATEGORIES_LIST.slice(0, 5);

const INITIAL_PAGE_SIZE = 6;

const ROLE_SYNONYMS: Record<string, string[]> = {
  automotive: ["car", "auto", "vehicle", "mechanic", "motor", "repair", "garage", "puncture", "wheel", "engine", "car repair"],
  electrical: ["electrician", "wiring", "light", "fan", "switch", "fuse", "power", "short circuit", "appliance", "electricals"],
  plumbing: ["plumber", "pipe", "leak", "tap", "sink", "drain", "water", "toilet", "bathroom", "faucet"],
  cleaning: ["cleaner", "maid", "housekeeping", "sweeping", "washing", "deep clean", "sanitization", "cleaning"],
  appliance: ["ac", "fridge", "refrigerator", "washing machine", "tv", "microwave", "oven", "cooler", "air conditioner"],
  cooking: ["cook", "chef", "catering", "meal", "food", "kitchen", "dinner", "lunch"],
  painting: ["painter", "paint", "wall", "color", "whitewash", "texture"],
  carpentry: ["carpenter", "wood", "furniture", "door", "table", "chair", "bed", "sofa"],
  pest: ["pest", "cockroach", "termite", "bedbug", "mosquito", "insects", "rat"],
  beauty: ["salon", "makeup", "haircut", "beautician", "barber", "grooming", "facial"],
};

export default function ServiceSearchScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [query, setQuery] = useState(params.q || "");
  const initialCategory = (params.category as CategoryFilter) || "all";
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(initialCategory);
  const [horizontalCategories, setHorizontalCategories] = useState<CategoryMeta[]>(() => {
    if (initialCategory === "all") return ALL_CATEGORIES_LIST.slice(0, 5);
    const targetMeta = ALL_CATEGORIES_LIST.find((c) => c.id === initialCategory);
    if (!targetMeta) return ALL_CATEGORIES_LIST.slice(0, 5);
    const nonAllList = ALL_CATEGORIES_LIST.filter(
      (c) => c.id !== "all" && c.id !== initialCategory
    );
    return [ALL_PILL, targetMeta, ...nonAllList].slice(0, 5);
  });
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const location = useLocation((state) => state.location);

  // Category Bottom Sheet Modal State
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [isCategoryFetching, setIsCategoryFetching] = useState(false);

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
    queryKey: ["db-services-search", activeCategory, query, location],
    queryFn: async () => {
      try {
        const queryParams = new URLSearchParams();
        if (!location) return [];
        queryParams.set("latitude", String(location.latitude));
        queryParams.set("longitude", String(location.longitude));
        queryParams.set("radiusKm", "50");
        if (query.trim()) {
          queryParams.set("q", query.trim());
        }
        const res = await api<{ items?: Array<any> }>(`/services?${queryParams.toString()}`);
        const dbItems = res?.items || [];
        return dbItems.map((s: any) => {
          const categoryText = String(s.category || s.categoryName || "").toLowerCase();
          const categorySlug = (Object.keys(ROLE_SYNONYMS).find((key) => categoryText.includes(key)) || "all") as CategoryFilter;
          const matchingCatMeta =
            ALL_CATEGORIES_LIST.find((c) => c.id === categorySlug) || ALL_CATEGORIES_LIST[0]!;

          let portfolio: string[] = [];
          try {
            portfolio = typeof s.portfolioUrls === "string" ? JSON.parse(s.portfolioUrls) : s.portfolioUrls || [];
          } catch {
            portfolio = [];
          }

          let offeredList: string[] = [];
          try {
            offeredList = typeof s.offeredServices === "string" ? JSON.parse(s.offeredServices) : s.offeredServices || [];
          } catch {
            offeredList = [];
          }

          const coverPhoto = s.shopPhotoUrl || portfolio[0] || s.providerPhoto || null;

          const modeTag =
            s.serviceMode === "doorstep"
              ? "Home Service"
              : s.serviceMode === "at_center"
              ? "Shop Service"
              : "Shop + Home";

          const ratingVal = s.rating !== null && s.rating !== undefined ? Number(s.rating) : null;
          const reviewsCountVal = s.completed ? Number(s.completed) : (s.totalReviews ? Number(s.totalReviews) : 0);
          const basePriceTextVal = s.basePricePaise ? `₹${Math.round(s.basePricePaise / 100)} base rate` : null;

          return {
            id: s.id,
            providerId: s.userId,
            title: s.title || s.category || "Service Profile",
            providerName: s.providerName || "Service Provider",
            providerPhoto: coverPhoto,
            providerPhone: s.providerPhone || s.ownerPhone || null,
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
      } catch (err) {
        console.warn("[ServiceSearch] DB query error:", err);
        return [];
      }
    },
    enabled: !!location,
    staleTime: 10000,
  });

  // On-Demand Category Selection Handler (with FIFO Queue Promotion)
  const handleSelectCategory = (catId: CategoryFilter) => {
    setActiveCategory(catId);
    setVisibleCount(INITIAL_PAGE_SIZE);
    setIsCategoryFetching(true);
    setTimeout(() => {
      setIsCategoryFetching(false);
    }, 300);

    if (catId === "all") return;

    const targetMeta = ALL_CATEGORIES_LIST.find((c) => c.id === catId);
    if (!targetMeta) return;

    setHorizontalCategories((prev) => {
      const allPill = prev.find((c) => c.id === "all") || ALL_PILL;
      const nonAllPills = prev.filter((c) => c.id !== "all" && c.id !== catId);
      const newNonAll = [targetMeta, ...nonAllPills].slice(0, 4);
      return [allPill, ...newNonAll];
    });
  };

  const dbServicesList = servicesDbQuery.data || [];

  // Multi-Field Fuzzy Match (Category + Role + Title + Provider Name + Area)
  const results = useMemo(() => {
    let list = dbServicesList;
    if (activeCategory !== "all") {
      list = list.filter((s) => s.categorySlug === activeCategory);
    }
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
    return list;
  }, [dbServicesList, query, activeCategory]);

  const paginatedResults = useMemo(() => {
    return results.slice(0, visibleCount);
  }, [results, visibleCount]);

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" translucent />

      {/* Header Container */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Search Bar Row */}
        <View style={styles.searchContainer}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={dash.ink} />
          </Pressable>

          <View style={styles.inputWrapper}>
            <Ionicons name="search" size={19} color="#047857" style={styles.searchIcon} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search 'AC repair', 'car', 'Vamshi'..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} style={styles.clearBtn} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Categories Horizontal Scroll + View More Pill */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {horizontalCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => handleSelectCategory(cat.id)}
                style={[
                  styles.catPill,
                  isActive ? styles.catPillActive : styles.catPillInactive,
                ]}
              >
                <View
                  style={[
                    styles.catIconBadge,
                    isActive ? styles.catIconBadgeActive : { backgroundColor: cat.bg },
                  ]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={12}
                    color={isActive ? "#FFFFFF" : cat.color}
                  />
                </View>
                <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all categories"
            onPress={() => setCategorySheetVisible(true)}
            style={styles.moreCatPill}
          >
            <View style={styles.moreIconBadge}>
              <Ionicons name="grid" size={12} color="#047857" />
            </View>
            <Text style={styles.moreCatPillText}>View More (+)</Text>
            <Ionicons name="chevron-down" size={12} color="#047857" style={{ marginLeft: 1 }} />
          </Pressable>
        </ScrollView>
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
          { paddingBottom: 110 + insets.bottom },
        ]}
      >
        {/* Results Count & Sort Row */}
        <View style={styles.resultsHeaderRow}>
          <Text style={styles.resultsCountText}>
            {results.length} provider{results.length === 1 ? "" : "s"} near you
          </Text>
          <Pressable style={styles.sortBtn}>
            <Text style={styles.sortBtnText}>Sort</Text>
            <Ionicons name="options-outline" size={14} color="#047857" />
          </Pressable>
        </View>

        {/* Loading State */}
        {servicesDbQuery.isLoading || isCategoryFetching ? (
          <View style={{ paddingVertical: 10 }}>
            <ServiceCollectionSkeleton />
          </View>
        ) : paginatedResults.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={36} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>
              {query.trim() ? `No exact profile match for "${query}"` : "No matching services found"}
            </Text>
            <Text style={styles.emptySub}>
              {query.trim()
                ? `We couldn't find a listed provider profile matching "${query}". Broadcast your requirement to notify local providers instantly.`
                : "Try searching for 'car', 'electrician', 'plumber', or selecting another category."}
            </Text>

            {query.trim() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Post work request for ${query}`}
                onPress={() => router.push({ pathname: "/post-work", params: { title: query } })}
                style={styles.postRequestBtn}
              >
                <Ionicons name="megaphone-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.postRequestText}>Post Work Request for "{query}"</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {paginatedResults.map((item) => {
              const isSaved = savedIds.includes(item.id);
              return (
                <View key={item.id} style={styles.specCardContainer}>
                  <Pressable
                    style={styles.specCardTop}
                    onPress={() => {
                      router.push({
                        pathname: "/service-details",
                        params: { id: item.id },
                      });
                    }}
                  >
                    {/* Left Column: Real Provider Image OR Category Icon Avatar */}
                    <View style={styles.imageColumn}>
                      {item.coverImage ? (
                        <Image
                          source={{ uri: item.coverImage }}
                          style={styles.providerImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.providerImagePlaceholder, { backgroundColor: item.bg }]}>
                          <Ionicons name={item.icon} size={32} color={item.color} />
                          <Text style={[styles.placeholderInitials, { color: item.color }]}>
                            {item.providerName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {/* Verified Overlay Badge */}
                      {item.isVerified && (
                        <View style={styles.verifiedImagePill}>
                          <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
                          <Text style={styles.verifiedImageText}>Verified</Text>
                        </View>
                      )}
                    </View>

                    {/* Right Column: Provider Details & Info */}
                    <View style={styles.infoColumn}>
                      {/* Row 1: Provider Name + Verification Checkmark + Heart Save Toggle */}
                      <View style={styles.providerRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                          <Text style={styles.providerNameText} numberOfLines={1}>
                            {item.providerName}
                          </Text>
                          {item.isVerified && (
                            <Ionicons name="checkmark-circle" size={15} color="#047857" />
                          )}
                        </View>

                        {/* Top Right Save / Favourite Heart Toggle */}
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleSave(item.id);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={isSaved ? "heart" : "heart-outline"}
                            size={20}
                            color={isSaved ? "#EF4444" : "#64748B"}
                          />
                        </Pressable>
                      </View>

                      {/* Row 2: Service Title */}
                      <Text style={styles.serviceTitleText} numberOfLines={1}>
                        {item.title}
                      </Text>

                      {/* Row 3: Service Rating (Real Rating or New Provider Badge) */}
                      {item.rating !== null ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={14} color="#F59E0B" />
                          <Text style={styles.ratingNum}>{item.rating.toFixed(1)}</Text>
                          <Text style={styles.ratingReviews}>
                            ({item.reviewCount} review{item.reviewCount === 1 ? "" : "s"})
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.newRatingRow}>
                          <Ionicons name="sparkles" size={12} color="#047857" />
                          <Text style={styles.newRatingText}>New Provider</Text>
                        </View>
                      )}

                      {/* Row 4: Key Service Tag Chips (Only rendered if tags exist in DB) */}
                      {item.keyServices.length > 0 ? (
                        <View style={styles.tagRow}>
                          {item.keyServices.slice(0, 2).map((tag, idx) => (
                            <View key={idx} style={styles.serviceTagPill}>
                              <Text style={styles.serviceTagText} numberOfLines={1}>
                                {tag}
                              </Text>
                            </View>
                          ))}
                          {item.keyServices.length > 2 && (
                            <View style={styles.moreTagPill}>
                              <Text style={styles.moreTagText}>+{item.keyServices.length - 2}</Text>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Row 5: Distance & Area + Service Mode Tag */}
                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={12} color="#047857" />
                          <Text style={styles.metaText}>
                            {item.distanceKm > 0 ? `${item.distanceKm} km · ` : ""}{item.area}
                          </Text>
                        </View>

                        <View style={styles.modeTagPill}>
                          <Ionicons
                            name={item.serviceModeTag.includes("Home") ? "home" : "storefront"}
                            size={11}
                            color="#047857"
                          />
                          <Text style={styles.modeTagText}>{item.serviceModeTag}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* Action Row: Call Provider & Request Service */}
                  <View style={styles.twoButtonsRow}>
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
                      <Ionicons name="call" size={15} color="#047857" />
                      <Text style={styles.btnCallText}>Call</Text>
                    </Pressable>

                    {/* 2. Request Service Action Button (Primary Solid Green) */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Request ${item.title}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        openConfirmation(item);
                      }}
                      style={styles.btnRequest}
                    >
                      <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.btnRequestText}>Request Service</Text>
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

      {/* 6th Pill: View All Categories Bottom Sheet Modal */}
      <Modal
        visible={categorySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategorySheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPress}
            onPress={() => setCategorySheetVisible(false)}
          />

          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.sheetTitle}>All Service Categories</Text>
                <Text style={styles.sheetSubTitle}>Select a category to filter listings</Text>
              </View>

              <Pressable
                onPress={() => setCategorySheetVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={dash.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetGrid} showsVerticalScrollIndicator={false}>
              {ALL_CATEGORIES_LIST.map((cat) => {
                const isSelected = activeCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      handleSelectCategory(cat.id);
                      setCategorySheetVisible(false);
                    }}
                    style={[styles.sheetGridCard, isSelected && styles.sheetGridCardActive]}
                  >
                    <View style={[styles.sheetIconBox, { backgroundColor: cat.bg }]}>
                      <Ionicons name={cat.icon} size={22} color={cat.color} />
                    </View>
                    <Text
                      style={[styles.sheetCatLabel, isSelected && styles.sheetCatLabelActive]}
                    >
                      {cat.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#047857"
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
      <ServiceBottomNav active="home" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF8",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: dash.ink,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#047857",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    paddingBottom: 4,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  catPillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  catIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  catIconBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  catPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  catPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  moreCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  moreIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(4, 120, 87, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreCatPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
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
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  list: {
    gap: 16,
  },
  specCardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  specCardTop: {
    flexDirection: "row",
    gap: 12,
  },
  imageColumn: {
    width: 96,
    height: 108,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F1F5F9",
  },
  providerImage: {
    width: "100%",
    height: "100%",
  },
  providerImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderInitials: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  verifiedImagePill: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: "rgba(4, 120, 87, 0.92)",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  verifiedImageText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoColumn: {
    flex: 1,
    justifyContent: "space-between",
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  providerNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: dash.ink,
  },
  serviceTitleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2B6CB0",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: "700",
    color: dash.ink,
  },
  ratingReviews: {
    fontSize: 12,
    color: "#64748B",
  },
  newRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  newRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  serviceTagPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  serviceTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  moreTagPill: {
    backgroundColor: "#E8F1FF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moreTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2B6CB0",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  modeTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  twoButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  btnCall: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flex: 1,
  },
  btnCallText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  btnRequest: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1.4,
  },
  btnRequestText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
  postRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#047857",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 12,
  },
  postRequestText: {
    color: "#FFFFFF",
    fontSize: 14,
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
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: dash.ink,
  },
  sheetSubTitle: {
    fontSize: 12,
    color: dash.muted,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetGrid: {
    gap: 10,
    paddingBottom: 24,
  },
  sheetGridCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFBF9",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sheetGridCardActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#047857",
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCatLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: dash.ink,
  },
  sheetCatLabelActive: {
    color: "#047857",
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
