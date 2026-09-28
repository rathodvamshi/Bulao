import { useState, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { useQuery } from "@tanstack/react-query";
import { locationApi, type LocationSearchResult } from "../../api/locationApi";
import { useLocation } from "../../store/location";
import { api } from "../../api/client";
import { useAuth } from "../../auth";

// ── Design Tokens ──
const GREEN = "#15803D";
const GREEN_DARK = "#166534";
const GREEN_SOFT = "#DCFCE7";
const GREEN_BG = "#F0FDF4";
const TEXT_PRIMARY = "#0F1F14";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";

export type ServiceMode = "doorstep" | "at_center" | "both";

const RADIUS_OPTIONS = [5, 10, 20, 30, 50];
const GPS_CHIP_ID = "__gps__";

// Neutral map viewport only; never save until the user explicitly selects a location.
const DEFAULT_COORDS = {
  latitude: 0,
  longitude: 0,
  area: "",
};

export interface SavedPlace {
  id: string;
  label: string;
  icon?: string;
  latitude: number;
  longitude: number;
  locality: string;
  address: string;
}

export interface ServiceLocationStepProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  serviceId: string;
  serviceName?: string;
  serviceIcon?: string;
  serviceMode: ServiceMode;
  onServiceModeChange: (mode: ServiceMode) => void;
  radiusKm: number;
  onRadiusKmChange: (radius: number) => void;
  location: {
    area: string;
    latitude: number;
    longitude: number;
  } | null;
  onLocationChange: (loc: { area: string; latitude: number; longitude: number } | null) => void;
  onChangeService: () => void;
  onChangeCategory?: () => void;
}

// ── Geocoding Helper ──
async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    if (first) {
      const parts = [
        first.name || first.streetNumber ? [first.streetNumber, first.name || first.street].filter(Boolean).join(" ") : null,
        first.subregion || first.district,
        first.city || first.region,
        first.postalCode,
      ].filter(Boolean);
      return parts.join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  } catch {
    // fallback
  }
  return `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;
}

// ── Exact Geographic Radius Framing Calculation ──
function getRegionForCoordinates(latitude: number, longitude: number, radiusKm: number, showRadius: boolean) {
  if (!showRadius) {
    return {
      latitude,
      longitude,
      latitudeDelta: 0.016,
      longitudeDelta: 0.016,
    };
  }
  const latDelta = Math.max(0.024, (radiusKm * 2 * 1.30) / 111.32);
  const radLat = (latitude * Math.PI) / 180;
  const lonDelta = latDelta / Math.max(0.2, Math.cos(radLat));
  return {
    latitude,
    longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

// ── Full-Page Map & Search Picker Modal ("Big Look") ──
function LocationPickerModal({
  visible,
  onClose,
  currentLocation,
  radiusKm,
  onRadiusKmChange,
  showRadius,
  serviceMode,
  onSelectLocation,
}: {
  visible: boolean;
  onClose: () => void;
  currentLocation: { area: string; latitude: number; longitude: number } | null;
  radiusKm: number;
  onRadiusKmChange?: (km: number) => void;
  showRadius: boolean;
  serviceMode: ServiceMode;
  onSelectLocation: (loc: { area: string; latitude: number; longitude: number }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    area: string;
    latitude: number;
    longitude: number;
  }>(currentLocation || DEFAULT_COORDS);

  const modalMapRef = useRef<MapView>(null);

  useEffect(() => {
    if (visible && currentLocation) {
      setSelectedItem(currentLocation);
      const region = getRegionForCoordinates(currentLocation.latitude, currentLocation.longitude, radiusKm, showRadius);
      modalMapRef.current?.animateToRegion(region, 500);
    }
  }, [visible, currentLocation, radiusKm, showRadius]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await locationApi.searchLocation(text);
      setResults(res);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: LocationSearchResult) => {
    Keyboard.dismiss();
    const newLoc = {
      area: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    };
    setSelectedItem(newLoc);
    setQuery("");
    setResults([]);
    const region = getRegionForCoordinates(item.latitude, item.longitude, radiusKm, showRadius);
    modalMapRef.current?.animateToRegion(region, 500);
  };

  const handleSetCoords = async (coords: { latitude: number; longitude: number }) => {
    setIsGeocoding(true);
    setSelectedItem((prev) => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }));
    try {
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      setSelectedItem({
        area: address,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseGps = async () => {
    Keyboard.dismiss();
    setIsGpsLoading(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission is needed to detect your current area.");
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const areaName = await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
      const newLoc = {
        area: areaName,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setSelectedItem(newLoc);
      const region = getRegionForCoordinates(pos.coords.latitude, pos.coords.longitude, radiusKm, showRadius);
      modalMapRef.current?.animateToRegion(region, 500);
    } catch {
      alert("Could not detect your location. Search for an address or select a point on the map.");
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedItem.area || isGeocoding) return;
    onSelectLocation(selectedItem);
    onClose();
  };

  const pinLabel = serviceMode === "at_center" ? "Shop Location" : "Service Base Pin";
  const modalRegion = useMemo(
    () => getRegionForCoordinates(selectedItem.latitude, selectedItem.longitude, radiusKm, showRadius),
    [selectedItem.latitude, selectedItem.longitude, radiusKm, showRadius]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreenModalContainer}>
        {/* 1. Full-Screen 100% Map Background */}
        {Platform.OS !== "web" ? (
          <MapView
            ref={modalMapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            initialRegion={modalRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            mapType="standard"
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={false}
            pitchEnabled={false}
            onPress={(e) => {
              Keyboard.dismiss();
              handleSetCoords(e.nativeEvent.coordinate);
            }}
          >
            {/* Radius Circle in Big Look */}
            {showRadius && (
              <Circle
                center={{ latitude: selectedItem.latitude, longitude: selectedItem.longitude }}
                radius={radiusKm * 1000}
                fillColor="rgba(21, 128, 61, 0.16)"
                strokeColor={GREEN}
                strokeWidth={2.5}
              />
            )}

            {/* Draggable Red Marker Pin */}
            <Marker
              coordinate={{ latitude: selectedItem.latitude, longitude: selectedItem.longitude }}
              draggable={true}
              onDragEnd={(e) => handleSetCoords(e.nativeEvent.coordinate)}
              tracksViewChanges={false}
              title={pinLabel}
              description="Move pin or tap anywhere to place"
            >
              <View style={styles.pinContainer}>
                <View style={styles.pinCalloutPill}>
                  <Text style={styles.pinCalloutText} numberOfLines={1}>
                    {selectedItem.area ? selectedItem.area.split(",")[0] : pinLabel}
                  </Text>
                </View>
                <View style={styles.pinPulseRing} />
                <View style={styles.pinSquircle}>
                  <Ionicons name="location" size={32} color="#DC2626" />
                </View>
                <View style={styles.pinShadow} />
              </View>
            </Marker>
          </MapView>
        ) : (
          <View style={styles.mockMapArea}>
            <View style={[styles.mockMapPin, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="location" size={36} color="#DC2626" />
            </View>
            <Text style={styles.mockMapText}>{selectedItem.area}</Text>
          </View>
        )}

        {/* 2. Floating Top Search & Navigation Overlay */}
        <View style={[styles.modalFloatingTopBar, { top: Math.max(insets.top + 8, 16) }]}>
          <View style={styles.modalSearchBarRow}>
            <Pressable onPress={onClose} style={styles.modalFloatingBackBtn} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
            </Pressable>
            <View style={styles.modalFloatingSearchBox}>
              <Ionicons name="search-outline" size={19} color={TEXT_SECONDARY} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search area, landmark or street..."
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => { setQuery(""); setResults([]); }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Autocomplete Results Dropdown */}
          {isSearching ? (
            <View style={styles.searchFloatingLoading}>
              <ActivityIndicator size="small" color={GREEN} />
              <Text style={styles.searchLoadingText}>Finding locations...</Text>
            </View>
          ) : results.length > 0 ? (
            <View style={styles.searchResultsFloatingDropdown}>
              <FlatList
                data={results}
                keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(item)}
                  >
                    <Ionicons name="location-outline" size={20} color={GREEN} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      <Text style={styles.searchResultAddress} numberOfLines={2}>
                        {item.address}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  </Pressable>
                )}
              />
            </View>
          ) : null}

          {/* Floating Map Tip Tag */}
          <View style={styles.bigMapTipBar}>
            <Ionicons name="sparkles" size={13} color={GREEN} />
            <Text style={styles.bigMapTipText}>Drag red pin or tap map to position</Text>
          </View>
        </View>

        {/* 3. Floating Quick GPS Button (Right Side) */}
        <Pressable
          style={[styles.floatingGpsBtn, { bottom: Math.max(insets.bottom, 16) + (showRadius ? 250 : 200) }]}
          onPress={handleUseGps}
          disabled={isGpsLoading}
          accessibilityLabel="Locate with GPS"
        >
          {isGpsLoading ? (
            <ActivityIndicator size="small" color={GREEN} />
          ) : (
            <Ionicons name="navigate" size={22} color={GREEN} />
          )}
        </Pressable>

        {/* 4. Floating Coverage Radius Pills Bar */}
        {showRadius && onRadiusKmChange && (
          <View style={[styles.modalRadiusFloatingBar, { bottom: Math.max(insets.bottom, 16) + 195 }]}>
            <Text style={styles.modalRadiusFloatingLabel}>Radius:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {RADIUS_OPTIONS.map((km) => {
                const isSelected = radiusKm === km;
                return (
                  <Pressable
                    key={km}
                    style={[styles.modalRadiusPill, isSelected ? styles.modalRadiusPillActive : null]}
                    onPress={() => onRadiusKmChange(km)}
                  >
                    <Text style={[styles.modalRadiusPillText, isSelected ? styles.modalRadiusPillTextActive : null]}>
                      {km} km
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 5. Sleek Bottom Confirmation Sheet */}
        <View style={[styles.modalFloatingBottomCard, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
          <View style={styles.modalHandlePill} />

          <View style={styles.modalBottomHeaderRow}>
            <View style={styles.modalBottomTitleGroup}>
              <View style={styles.placeTitleDot} />
              <Text style={styles.selectedLabel}>Selected Location</Text>
            </View>
            {isGeocoding ? (
              <View style={styles.geocodingPill}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={styles.geocodingPillText}>Updating...</Text>
              </View>
            ) : (
              <View style={styles.coordsBadgePill}>
                <Text style={styles.coordsBadgeText}>
                  {selectedItem.latitude.toFixed(4)}°, {selectedItem.longitude.toFixed(4)}°
                </Text>
              </View>
            )}
          </View>

          <View style={styles.selectedLocRow}>
            <View style={styles.selectedLocIconCircle}>
              <Ionicons name="location" size={22} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedAreaText} numberOfLines={2}>
                {selectedItem.area || "Fetching address..."}
              </Text>
            </View>
          </View>

          <Pressable disabled={!selectedItem.area || isGeocoding} style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="checkmark-circle" size={20} color={WHITE} />
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Component ──
export function ServiceLocationStep({
  categoryId,
  categoryName,
  categoryIcon,
  serviceId,
  serviceName,
  serviceIcon,
  serviceMode,
  onServiceModeChange,
  radiusKm,
  onRadiusKmChange,
  location,
  onLocationChange,
  onChangeService,
}: ServiceLocationStepProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const cardFade = useRef(new Animated.Value(1)).current;
  const inlineMapRef = useRef<MapView>(null);

  const appGlobalLocation = useLocation((x) => x.location);
  const auth = useAuth();
  const userId = auth.session?.userId || auth.user?.id;

  const { data: userSavedPlaces, isLoading: loadingPlaces } = useQuery<SavedPlace[]>({
    queryKey: ["saved-places", userId],
    queryFn: () => api<SavedPlace[]>("/saved-places"),
    enabled: !!userId,
    staleTime: 300000,
  });

  const savedPlaces = useMemo<SavedPlace[]>(() => {
    const list: SavedPlace[] = [];
    if (appGlobalLocation?.area) {
      list.push({
        id: "app-location",
        label: appGlobalLocation.area.split(",")[0] || "Current Spot",
        icon: "📍",
        latitude: appGlobalLocation.latitude,
        longitude: appGlobalLocation.longitude,
        locality: appGlobalLocation.area,
        address: appGlobalLocation.area,
      });
    }
    userSavedPlaces?.forEach((p) => {
      if (!list.some((e) => e.id === p.id)) {
        list.push({
          ...p,
          icon:
            p.icon ||
            (p.label.toLowerCase().includes("home")
              ? "🏠"
              : p.label.toLowerCase().includes("shop")
              ? "🏬"
              : p.label.toLowerCase().includes("office") || p.label.toLowerCase().includes("work")
              ? "🏢"
              : "📍"),
        });
      }
    });
    return list;
  }, [appGlobalLocation, userSavedPlaces]);

  // Animate inline map to coordinates with precise radius framing
  useEffect(() => {
    if (location && inlineMapRef.current) {
      const region = getRegionForCoordinates(
        location.latitude,
        location.longitude,
        radiusKm,
        serviceMode !== "at_center"
      );
      inlineMapRef.current.animateToRegion(region, 550);
    }
  }, [location, radiusKm, serviceMode]);

  // Layout sizing calculations for perfect spacing & symmetry
  const isSmall = windowWidth < 360;
  const isTablet = windowWidth >= 768;
  const containerPadding = 32;
  const availableContentWidth = Math.min(windowWidth, 880) - containerPadding;

  // Saved place grid cards: 3 equal columns with 10px gap
  const numGridCols = isTablet ? 4 : isSmall ? 2 : 3;
  const gridItemGap = 10;
  const gridItemWidth = Math.floor((availableContentWidth - gridItemGap * (numGridCols - 1)) / numGridCols);

  const displayServiceName = useMemo(() => {
    if (serviceName) return serviceName;
    return serviceId
      ? serviceId.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Selected Service";
  }, [serviceName, serviceId]);

  const displayCategoryName = categoryName || "Service Category";

  const effectiveCoords = useMemo(() => {
    return {
      latitude: location?.latitude ?? DEFAULT_COORDS.latitude,
      longitude: location?.longitude ?? DEFAULT_COORDS.longitude,
      area: location?.area || DEFAULT_COORDS.area,
    };
  }, [location]);

  // Handle GPS detection
  const handleDetectGPS = async () => {
    setLoadingGps(true);
    setSelectedChipId(GPS_CHIP_ID);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission is needed to detect your current area.");
        setSelectedChipId(null);
        return;
      }
      const pt = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const area = await getAddressFromCoords(pt.coords.latitude, pt.coords.longitude);
      onLocationChange({
        area,
        latitude: pt.coords.latitude,
        longitude: pt.coords.longitude,
      });
      cardFade.setValue(0.6);
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } catch {
      alert("Could not detect your location. Please select a saved place or search on the map.");
    } finally {
      setLoadingGps(false);
    }
  };

  // Handle selecting a saved place
  const handleSelectPlace = (place: SavedPlace) => {
    setSelectedChipId(place.id);
    onLocationChange({
      area: place.address || place.locality,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    cardFade.setValue(0.6);
    Animated.timing(cardFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // Handle tapping inline map
  const handleMapTap = async (latitude: number, longitude: number) => {
    setGeocoding(true);
    try {
      const address = await getAddressFromCoords(latitude, longitude);
      onLocationChange({
        area: address,
        latitude,
        longitude,
      });
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── 1. Hero Title & Decorative Badge ── */}
      <View style={styles.heroWrap}>
        <View style={styles.heroTextCol}>
          <Text style={styles.sectionLabel}>STAGE 4 OF 6</Text>
          <Text style={styles.mainTitle}>Where do you provide service?</Text>
          <Text style={styles.subtitle}>Pick from saved places or search your work location</Text>
        </View>

        <View style={styles.stickerBadge}>
          <Ionicons name="location" size={15} color={GREEN} style={{ alignSelf: "center", marginBottom: 2 }} />
          <Text style={styles.stickerText}>Near You{"\n"}For a Better{"\n"}Community</Text>
        </View>
      </View>

      {/* ── 2. Selected Service Summary Card ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIconSquircle}>
          <Ionicons
            name={(serviceIcon as keyof typeof Ionicons.glyphMap) || (categoryIcon as keyof typeof Ionicons.glyphMap) || "bicycle"}
            size={24}
            color={GREEN}
          />
        </View>
        <View style={styles.summaryInfoCol}>
          <Text style={styles.summaryTitle}>{displayServiceName}</Text>
          <Text style={styles.summaryBreadcrumb}>
            {displayCategoryName} &gt; {displayServiceName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change service"
          onPress={onChangeService}
          style={styles.changeBtn}
        >
          <Text style={styles.changeBtnText}>Change</Text>
          <Ionicons name="chevron-forward" size={14} color={GREEN} />
        </Pressable>
      </View>

      {/* ── 3. Premium Service Mode Cards (Single Horizontal Row) ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderRow}>
          <Ionicons name="person-outline" size={17} color={TEXT_PRIMARY} />
          <Text style={styles.fieldLabel}>Service type</Text>
        </View>

        <View style={styles.modeCardsRow}>
          {/* Card 1: 🏠 I come to the customer */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: serviceMode === "doorstep" }}
            style={[
              styles.modeCard,
              serviceMode === "doorstep" ? styles.modeCardSelected : null,
            ]}
            onPress={() => onServiceModeChange("doorstep")}
          >
            {serviceMode === "doorstep" && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={12} color={WHITE} />
              </View>
            )}
            <View style={[styles.modeIconSquircle, serviceMode === "doorstep" ? styles.modeIconSquircleSelected : { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="home" size={22} color={serviceMode === "doorstep" ? GREEN : "#059669"} />
            </View>
            <Text style={[styles.modeCardTitle, serviceMode === "doorstep" ? styles.modeCardTitleSelected : null]}>
              I come to{"\n"}the customer
            </Text>
            <Text style={styles.modeCardDesc} numberOfLines={2}>
              Travel to customer
            </Text>
          </Pressable>

          {/* Card 2: 🏪 Customer comes to me */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: serviceMode === "at_center" }}
            style={[
              styles.modeCard,
              serviceMode === "at_center" ? styles.modeCardSelected : null,
            ]}
            onPress={() => onServiceModeChange("at_center")}
          >
            {serviceMode === "at_center" && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={12} color={WHITE} />
              </View>
            )}
            <View style={[styles.modeIconSquircle, serviceMode === "at_center" ? styles.modeIconSquircleSelected : { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="storefront" size={22} color={serviceMode === "at_center" ? GREEN : "#2563EB"} />
            </View>
            <Text style={[styles.modeCardTitle, serviceMode === "at_center" ? styles.modeCardTitleSelected : null]}>
              Customer{"\n"}comes to me
            </Text>
            <Text style={styles.modeCardDesc} numberOfLines={2}>
              Visit my shop
            </Text>
          </Pressable>

          {/* Card 3: 🔄 Both */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: serviceMode === "both" }}
            style={[
              styles.modeCard,
              serviceMode === "both" ? styles.modeCardSelected : null,
            ]}
            onPress={() => onServiceModeChange("both")}
          >
            {serviceMode === "both" && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={12} color={WHITE} />
              </View>
            )}
            <View style={[styles.modeIconSquircle, serviceMode === "both" ? styles.modeIconSquircleSelected : { backgroundColor: "#F5F3FF" }]}>
              <Ionicons name="repeat" size={22} color={serviceMode === "both" ? GREEN : "#7C3AED"} />
            </View>
            <Text style={[styles.modeCardTitle, serviceMode === "both" ? styles.modeCardTitleSelected : null]}>
              Both
            </Text>
            <Text style={styles.modeCardDesc} numberOfLines={2}>
              Shop + Home
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── 4. Saved Locations Grid with Consistent Spacing & Gap ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderBetweenRow}>
          <View style={styles.fieldHeaderRow}>
            <Ionicons name="bookmark-outline" size={17} color={TEXT_PRIMARY} />
            <Text style={styles.fieldLabel}>Saved Locations</Text>
          </View>
          <Pressable style={styles.searchNewHeaderBtn} onPress={() => setIsMapModalOpen(true)}>
            <Ionicons name="search" size={13} color={GREEN} />
            <Text style={styles.searchNewHeaderBtnText}>Search Address</Text>
          </Pressable>
        </View>

        {loadingPlaces ? (
          <View style={styles.loadingPlacesRow}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={styles.loadingPlacesText}>Loading saved places…</Text>
          </View>
        ) : (
          <View style={[styles.gridContainer, { gap: gridItemGap }]}>
            {/* ① Saved Place Cards */}
            {savedPlaces.map((place) => {
              const active = Boolean(
                selectedChipId === place.id ||
                  (location?.latitude &&
                    Math.abs(location.latitude - place.latitude) < 0.0002 &&
                    Math.abs(location.longitude - place.longitude) < 0.0002)
              );
              return (
                <Pressable
                  key={place.id}
                  onPress={() => handleSelectPlace(place)}
                  style={({ pressed }) => [
                    styles.gridCard,
                    { width: gridItemWidth },
                    active ? styles.gridCardActive : null,
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.97 }] } : null,
                  ]}
                >
                  <View style={[styles.gridIconBox, active ? styles.gridIconBoxActive : null]}>
                    <Text style={styles.gridEmoji}>{place.icon || "🏠"}</Text>
                    {active && (
                      <View style={styles.iconTickBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.gridTitle, active ? styles.gridTitleActive : null]} numberOfLines={1}>
                    {place.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* ② My Location GPS Card */}
            <Pressable
              onPress={handleDetectGPS}
              disabled={loadingGps}
              style={({ pressed }) => [
                styles.gridCard,
                { width: gridItemWidth },
                selectedChipId === GPS_CHIP_ID ? styles.gridCardActive : null,
                pressed ? { opacity: 0.85, transform: [{ scale: 0.97 }] } : null,
              ]}
            >
              <View
                style={[
                  styles.gridIconBox,
                  styles.gpsIconBox,
                  selectedChipId === GPS_CHIP_ID ? styles.gridIconBoxActive : null,
                ]}
              >
                {loadingGps ? (
                  <ActivityIndicator size="small" color={GREEN} />
                ) : (
                  <Ionicons
                    name="navigate"
                    size={20}
                    color={selectedChipId === GPS_CHIP_ID ? GREEN : "#4A5D52"}
                  />
                )}
                {selectedChipId === GPS_CHIP_ID && !loadingGps && (
                  <View style={styles.iconTickBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  </View>
                )}
              </View>
              <Text style={[styles.gridTitle, selectedChipId === GPS_CHIP_ID ? styles.gridTitleActive : null]} numberOfLines={1}>
                {loadingGps ? "Detecting…" : "My Location"}
              </Text>
            </Pressable>

            {/* ③ Search New Address Card */}
            <Pressable
              onPress={() => setIsMapModalOpen(true)}
              style={({ pressed }) => [
                styles.gridCard,
                styles.gridCardDashed,
                { width: gridItemWidth },
                pressed ? { opacity: 0.85, transform: [{ scale: 0.97 }] } : null,
              ]}
            >
              <View style={styles.searchNewIconBox}>
                <Ionicons name="search" size={20} color={GREEN} />
              </View>
              <Text style={styles.searchNewTitle} numberOfLines={1}>
                + Search New
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 5. Selected Location Card (Detailed & Clean) ── */}
        {location && (
          <Animated.View style={[styles.placeCard, { opacity: cardFade }]}>
            {/* Header: Title + Tag + Checkmark */}
            <View style={styles.placeCardHeader}>
              <View style={styles.placeCardHeaderLeft}>
                <View style={styles.placeTitleDot} />
                <Text style={styles.placeCardTitle}>Selected Location</Text>
                <View style={styles.placeTagPill}>
                  <Text style={styles.placeTagEmoji}>
                    {selectedChipId === GPS_CHIP_ID ? "📍" : "🏠"}
                  </Text>
                  <Text style={styles.placeTagText} numberOfLines={1}>
                    {location.area ? location.area.split(",")[0] : "Base Location"}
                  </Text>
                </View>
              </View>
              <View style={styles.placeRightAction}>
                {geocoding ? (
                  <ActivityIndicator size="small" color={GREEN} />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                )}
              </View>
            </View>

            {/* Full Address Box */}
            <Pressable style={styles.placeAddressBox} onPress={() => setIsMapModalOpen(true)}>
              <Ionicons name="location-outline" size={16} color={GREEN} style={{ marginTop: 1 }} />
              <Text style={styles.placeAddressText} numberOfLines={2}>
                {location.area || "Fetching address..."}
              </Text>
              <Ionicons name="pencil" size={14} color={GREEN} />
            </Pressable>

            {/* Coordinates Footer (Latitude & Longitude Pills) */}
            <View style={styles.coordsFooter}>
              <View style={styles.coordPill}>
                <Text style={styles.coordLabel}>Latitude</Text>
                <Text style={styles.coordVal}>{effectiveCoords.latitude.toFixed(5)}° N</Text>
              </View>
              <View style={styles.coordPill}>
                <Text style={styles.coordLabel}>Longitude</Text>
                <Text style={styles.coordVal}>{effectiveCoords.longitude.toFixed(5)}° E</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* ── 6. Google Map Card with Red Marker Pin & Precise Radius Framing ── */}
      <View style={styles.fieldSection}>
        <View style={styles.mapCard}>
          {/* Map Header Bar */}
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderLeft}>
              <View style={styles.mapLiveDot} />
              <Text style={styles.mapHeaderText} numberOfLines={1}>
                {location?.area ? location.area.split(",")[0] : "Work Location Pin"}
              </Text>
            </View>
            <Pressable style={styles.mapExpandBtn} onPress={() => setIsMapModalOpen(true)}>
              <Ionicons name="expand" size={13} color={TEXT_PRIMARY} />
              <Text style={styles.mapExpandBtnText}>Big Look</Text>
            </Pressable>
          </View>

          {/* Map Surface */}
          {Platform.OS !== "web" ? (
            <MapView
              ref={inlineMapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={getRegionForCoordinates(
                effectiveCoords.latitude,
                effectiveCoords.longitude,
                radiusKm,
                serviceMode !== "at_center"
              )}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              mapType="standard"
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                handleMapTap(latitude, longitude);
              }}
            >
              {/* Coverage Circle */}
              {serviceMode !== "at_center" && (
                <Circle
                  center={{ latitude: effectiveCoords.latitude, longitude: effectiveCoords.longitude }}
                  radius={radiusKm * 1000}
                  fillColor="rgba(21, 128, 61, 0.16)"
                  strokeColor={GREEN}
                  strokeWidth={2}
                />
              )}

              {/* Red Location Pin */}
              <Marker
                coordinate={{ latitude: effectiveCoords.latitude, longitude: effectiveCoords.longitude }}
                draggable={true}
                onDragEnd={(e) => handleMapTap(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
                tracksViewChanges={false}
                title={serviceMode === "at_center" ? "Shop Location" : "Service Base Pin"}
                description="Move pin or tap anywhere to place"
              >
                <View style={styles.pinContainer}>
                  <View style={styles.pinCalloutPill}>
                    <Text style={styles.pinCalloutText} numberOfLines={1}>
                      {location?.area ? location.area.split(",")[0] : (serviceMode === "at_center" ? "Shop Location" : "Base Pin")}
                    </Text>
                  </View>
                  <View style={styles.pinPulseRing} />
                  <View style={styles.pinSquircle}>
                    <Ionicons name="location" size={32} color="#DC2626" />
                  </View>
                  <View style={styles.pinShadow} />
                </View>
              </Marker>
            </MapView>
          ) : (
            <View style={styles.webMapFallback}>
              <View style={styles.webRoadGrid}>
                <View style={styles.webRoadH} />
                <View style={styles.webRoadV} />
              </View>
              {serviceMode !== "at_center" && (
                <View style={[styles.webRadiusCircle, { width: 130 + radiusKm * 1.5, height: 130 + radiusKm * 1.5 }]}>
                  <View style={styles.webRadiusBadge}>
                    <Text style={styles.webRadiusBadgeText}>Within {radiusKm} km</Text>
                  </View>
                </View>
              )}
              <View style={[styles.pinSquircle, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="location" size={32} color="#DC2626" />
              </View>
            </View>
          )}

          {/* Map Footer Tip */}
          <View style={styles.mapFooter}>
            <Ionicons name="hand-right-outline" size={12} color="#8FA89B" />
            <Text style={styles.mapFooterText}>Tap the map or drag red pin to reposition</Text>
          </View>
        </View>

        {/* ── 7. Coverage Radius Selector Pills (if doorstep or both) ── */}
        {serviceMode !== "at_center" && (
          <View style={styles.radiusSectionWrap}>
            <View style={styles.radiusHeaderRow}>
              <Ionicons name="locate" size={16} color={GREEN} />
              <Text style={styles.radiusHeaderTitle}>Service Coverage Radius</Text>
              <Text style={styles.radiusHeaderSub}>within {radiusKm} km</Text>
            </View>

            <View style={styles.radiusPillsRow}>
              {RADIUS_OPTIONS.map((km) => {
                const isSelected = radiusKm === km;
                return (
                  <Pressable
                    key={km}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    style={[styles.radiusPill, isSelected ? styles.radiusPillSelected : null]}
                    onPress={() => onRadiusKmChange(km)}
                  >
                    <Text style={[styles.radiusPillText, isSelected ? styles.radiusPillTextSelected : null]}>
                      {km} km
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ── 8. Bottom Helpful Info Box ── */}
      <View style={styles.infoBox}>
        <View style={styles.infoIconCol}>
          <Ionicons name="information-circle" size={22} color={GREEN} />
        </View>
        <View style={styles.infoTextCol}>
          <Text style={styles.infoTitle}>Don't worry!</Text>
          <Text style={styles.infoSubtitle}>
            You can update your service location and coverage radius anytime from your provider dashboard.
          </Text>
        </View>
      </View>

      {/* ── 9. Full-screen Location Picker Modal (Consistent Big Look Map) ── */}
      <LocationPickerModal
        visible={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        currentLocation={location}
        radiusKm={radiusKm}
        onRadiusKmChange={onRadiusKmChange}
        showRadius={serviceMode !== "at_center"}
        serviceMode={serviceMode}
        onSelectLocation={(loc) => {
          onLocationChange(loc);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 24,
  },
  heroWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 3,
    lineHeight: 18,
  },
  stickerBadge: {
    backgroundColor: "#EAF8ED",
    borderWidth: 1.5,
    borderColor: "#B7EBC8",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  stickerText: {
    fontSize: 10,
    fontWeight: "800",
    color: GREEN,
    textAlign: "center",
    lineHeight: 13,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 13,
    gap: 12,
  },
  summaryIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryInfoCol: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  summaryBreadcrumb: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  changeBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: GREEN,
  },
  fieldSection: {
    gap: 10,
  },
  fieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  fieldHeaderBetweenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  searchNewHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: GREEN_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GREEN_SOFT,
  },
  searchNewHeaderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  loadingPlacesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  loadingPlacesText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  modeCardsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 2,
  },
  modeCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 112,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  modeCardSelected: {
    borderColor: GREEN,
    borderWidth: 2,
    backgroundColor: GREEN_BG,
    shadowColor: GREEN,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  checkBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  modeIconSquircleSelected: {
    backgroundColor: GREEN_SOFT,
  },
  modeCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 15,
  },
  modeCardTitleSelected: {
    color: GREEN,
    fontWeight: "800",
  },
  modeCardDesc: {
    fontSize: 9.5,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 12.5,
  },

  // ── Grid Container ──
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  gridCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 96,
  },
  gridCardActive: {
    backgroundColor: "#F0FAF4",
    borderColor: GREEN,
    borderWidth: 2,
    shadowColor: GREEN,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  gridCardDashed: {
    borderStyle: "dashed",
    borderColor: "#86EFAC",
    backgroundColor: "#F8FAF6",
  },
  gridIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
  },
  gridIconBoxActive: {
    backgroundColor: "#E4F7EC",
  },
  gpsIconBox: {
    backgroundColor: "#F4F7F5",
  },
  searchNewIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconTickBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: WHITE,
    borderRadius: 8,
  },
  gridEmoji: {
    fontSize: 20,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  gridTitleActive: {
    color: GREEN,
    fontWeight: "800",
  },
  searchNewTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: GREEN,
    textAlign: "center",
  },

  // ── Selected Location Card ──
  placeCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1.5,
    borderColor: "#C8EADA",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 9,
    marginTop: 2,
  },
  placeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  placeTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  placeCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  placeTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EDFBF3",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2F4E2",
    maxWidth: 140,
  },
  placeTagEmoji: {
    fontSize: 11,
  },
  placeTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN,
  },
  placeRightAction: {
    paddingLeft: 4,
  },
  placeAddressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6EFEA",
  },
  placeAddressText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#2D3E33",
    lineHeight: 16,
    flex: 1,
  },
  coordsFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coordPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F5F2",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7A9586",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  coordVal: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },

  // ── Map Card ──
  mapCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D8E5DB",
    shadowColor: "#0B1A0F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F0",
    backgroundColor: WHITE,
  },
  mapHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  mapLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  mapHeaderText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    flex: 1,
  },
  mapExpandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapExpandBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  map: {
    width: "100%",
    height: 220,
  },
  mapFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F0",
    backgroundColor: "#FAFCFB",
  },
  mapFooterText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8FA89B",
  },

  // Pin Styling (Red Pin Marker)
  pinContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 74,
  },
  pinCalloutPill: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
    maxWidth: 130,
    elevation: 3,
  },
  pinCalloutText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: WHITE,
    textAlign: "center",
  },
  pinPulseRing: {
    position: "absolute",
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(220, 38, 38, 0.22)",
  },
  pinSquircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#DC2626",
    elevation: 4,
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    marginTop: 2,
  },

  // Radius Section
  radiusSectionWrap: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  radiusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  radiusHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  radiusHeaderSub: {
    fontSize: 11.5,
    fontWeight: "600",
    color: GREEN,
    marginLeft: "auto",
  },
  radiusPillsRow: {
    flexDirection: "row",
    gap: 7,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  radiusPillSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  radiusPillTextSelected: {
    color: WHITE,
  },

  // Helpful Banner
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#DCFCE7",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  infoIconCol: {
    width: 28,
    alignItems: "center",
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  infoSubtitle: {
    fontSize: 12,
    color: GREEN_DARK,
    marginTop: 1,
  },

  // Web Fallbacks
  webMapFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  webRoadGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  webRoadH: {
    position: "absolute",
    top: 95,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: "#FFFFFF",
  },
  webRoadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 110,
    width: 16,
    backgroundColor: "#FFFFFF",
  },
  webRadiusCircle: {
    position: "absolute",
    borderRadius: 150,
    backgroundColor: "rgba(21, 128, 61, 0.16)",
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  webRadiusBadge: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  webRadiusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN,
  },

  // ── Full-Page Big Look Modal Styles ──
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: WHITE,
    position: "relative",
  },
  modalFloatingTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    gap: 8,
  },
  modalSearchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalFloatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  modalFloatingSearchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_PRIMARY,
  },
  searchFloatingLoading: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchLoadingText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: "500",
  },
  searchResultsFloatingDropdown: {
    backgroundColor: WHITE,
    borderRadius: 16,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  searchResultName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  searchResultAddress: {
    fontSize: 11.5,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  bigMapTipBar: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#86EFAC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  bigMapTipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: GREEN,
  },
  floatingGpsBtn: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 30,
  },
  modalRadiusFloatingBar: {
    position: "absolute",
    left: 16,
    right: 76,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 30,
  },
  modalRadiusFloatingLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  modalRadiusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalRadiusPillActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  modalRadiusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  modalRadiusPillTextActive: {
    color: WHITE,
  },
  modalFloatingBottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 40,
  },
  modalHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 2,
  },
  modalBottomHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalBottomTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  geocodingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  geocodingPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: GREEN,
  },
  coordsBadgePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coordsBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  selectedLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedLocIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedAreaText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  confirmBtn: {
    flexDirection: "row",
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: WHITE,
  },
  mockMapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F8FAF6",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  mockMapPin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  mockMapText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
});
