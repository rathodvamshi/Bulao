import { router } from "expo-router";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
  SavedPlace,
} from "../../src/features/post-work/store";
import { useLocation } from "../../src/store/location";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";

// ── Extended place with full geocode detail ─────────────
interface DetailedPlace extends SavedPlace {
  street?: string;
  area?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

type TabKey = "saved" | "manual";
const GPS_CHIP_ID = "__gps__";

export default function PostWorkLocationScreen() {
  const {
    latitude: savedLat,
    longitude: savedLng,
    locality: savedLocality,
    address: savedAddress,
    savedPlaceId: savedPlaceIdStore,
    setLocation,
    resetFlow,
  } = usePostWorkStore();

  const appGlobalLocation = useLocation((x) => x.location);
  const auth = useAuth();
  const userId = auth.session?.userId;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("saved");
  const [selectedPlace, setSelectedPlace] = useState<DetailedPlace | null>(null);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [saveToPlacesCheck, setSaveToPlacesCheck] = useState(false);
  const [landmarkDirections, setLandmarkDirections] = useState("");

  // Manual form
  const [manualLabel, setManualLabel] = useState("");
  const [manualIcon, setManualIcon] = useState("📍");
  const [manualLocality, setManualLocality] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualLandmark, setManualLandmark] = useState("");

  // Animations
  const tabSlide = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  // ── Fetch saved places ──────────────────────────────────
  const { data: userSavedPlaces, isLoading: loadingPlaces } =
    useQuery<SavedPlace[]>({
      queryKey: ["saved-places", userId],
      queryFn: () => api<SavedPlace[]>("/saved-places"),
      enabled: !!userId,
      retry: 0,
      staleTime: 300000,
    });

  const savePlaceMutation = useMutation({
    mutationFn: (p: {
      label: string; icon: string;
      latitude: number; longitude: number;
      locality: string; address: string;
    }) => api<SavedPlace>("/saved-places", p),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["saved-places", userId] }),
  });

  // ── Build saved places list (only real data) ────────────
  const savedPlaces = useMemo<SavedPlace[]>(() => {
    const list: SavedPlace[] = [];
    if (appGlobalLocation?.area) {
      list.push({
        id: "app-location",
        label: appGlobalLocation.area,
        icon: "📍",
        latitude: appGlobalLocation.latitude || 17.4483,
        longitude: appGlobalLocation.longitude || 78.3915,
        locality: appGlobalLocation.area,
        address: `${appGlobalLocation.area}, Hyderabad`,
      });
    }
    userSavedPlaces?.forEach((p) => {
      if (!list.some((e) => e.id === p.id)) list.push(p);
    });
    if (list.length === 0) {
      list.push({
        id: "fallback",
        label: savedLocality || "Home",
        icon: "🏠",
        latitude: savedLat || 17.4483,
        longitude: savedLng || 78.3915,
        locality: savedLocality || "Madhapur, Hyderabad",
        address: savedAddress || "Madhapur, Hyderabad, Telangana",
      });
    }

    // Auto-name places without a name: default to "Home", or "Home-1", "Home-2", etc. if multiple
    const unnamedPlaces = list.filter(
      (p) =>
        p.id !== "app-location" &&
        (!p.label?.trim() ||
          p.label === "Location" ||
          p.label === "Saved Place" ||
          p.label === "Worksite")
    );

    if (unnamedPlaces.length === 1) {
      return list.map((p) => {
        if (
          p.id !== "app-location" &&
          (!p.label?.trim() ||
            p.label === "Location" ||
            p.label === "Saved Place" ||
            p.label === "Worksite")
        ) {
          return { ...p, label: "Home", icon: p.icon && p.icon !== "📍" ? p.icon : "🏠" };
        }
        return p;
      });
    } else if (unnamedPlaces.length > 1) {
      let homeCounter = 1;
      return list.map((p) => {
        if (
          p.id !== "app-location" &&
          (!p.label?.trim() ||
            p.label === "Location" ||
            p.label === "Saved Place" ||
            p.label === "Worksite")
        ) {
          return {
            ...p,
            label: `Home-${homeCounter++}`,
            icon: p.icon && p.icon !== "📍" ? p.icon : "🏠",
          };
        }
        return p;
      });
    }

    return list;
  }, [appGlobalLocation, userSavedPlaces, savedLocality, savedLat, savedLng, savedAddress]);

  // ── Resolve initial selected ────────────────────────────
  const initialSelected = useMemo<DetailedPlace | null>(() => {
    if (savedPlaceIdStore) {
      const m = savedPlaces.find((p) => p.id === savedPlaceIdStore);
      if (m) return m;
    }
    if (savedLocality && savedLat && savedLng) {
      const m = savedPlaces.find(
        (p) => p.locality.toLowerCase() === savedLocality.toLowerCase()
      );
      if (m) return m;
      return {
        id: "stored",
        label: "Selected Location",
        icon: "📍",
        latitude: savedLat,
        longitude: savedLng,
        locality: savedLocality,
        address: savedAddress || savedLocality,
      };
    }
    return savedPlaces[0] ?? null;
  }, [savedPlaceIdStore, savedLocality, savedLat, savedLng, savedAddress, savedPlaces]);

  // Set initial
  useEffect(() => {
    if (!selectedPlace && initialSelected) {
      setSelectedPlace(initialSelected);
      setSelectedChipId(initialSelected.id);
    }
  }, [initialSelected]);

  // Animate map to selected place
  useEffect(() => {
    if (selectedPlace && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        700
      );
    }
  }, [selectedPlace]);

  // Fade-in card when place selected
  const showCard = (place: DetailedPlace) => {
    setSelectedPlace(place);
    cardFade.setValue(0);
    Animated.timing(cardFade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // ── Tab switch ──────────────────────────────────────────
  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    Animated.timing(tabSlide, {
      toValue: tab === "saved" ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  // ── GPS detect ──────────────────────────────────────────
  const handleDetectGPS = async () => {
    setLoadingGps(true);
    setSelectedChipId(GPS_CHIP_ID);

    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please enable Location access in your device settings."
        );
        setSelectedChipId(null);
        return;
      }

      const pt = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });
      const { latitude, longitude } = pt.coords;
      setGeocoding(true);

      const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      const geo = results[0];

      if (geo) {
        const street = [geo.streetNumber, geo.street].filter(Boolean).join(" ");
        const area = geo.subregion || geo.district || "";
        const city = geo.city || "";
        const state = geo.region || "";
        const postalCode = geo.postalCode || "";
        const country = geo.country || "";
        const name = geo.name || "";

        const localityLine = [area, city].filter(Boolean).join(", ");
        const addressParts = [street || name, area, city, state, postalCode, country].filter(Boolean);
        const formatted = addressParts.join(", ");

        const place: DetailedPlace = {
          id: GPS_CHIP_ID,
          label: "Current Location",
          icon: "📍",
          latitude,
          longitude,
          locality: localityLine || city,
          address: formatted,
          street: street || name,
          area,
          state,
          postalCode,
          country,
        };

        showCard(place);
      }
    } catch {
      Alert.alert("GPS Error", "Could not detect your location. Please try again.");
      setSelectedChipId(null);
    } finally {
      setLoadingGps(false);
      setGeocoding(false);
    }
  };

  // ── Select saved place ──────────────────────────────────
  const handleSelectPlace = (place: SavedPlace) => {
    setSelectedChipId(place.id);
    showCard(place);
  };

  // ── Map tap to move pin ─────────────────────────────────
  const handleMapTap = async (latitude: number, longitude: number) => {
    setGeocoding(true);
    try {
      const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      const geo = results[0];
      if (geo) {
        const street = [geo.streetNumber, geo.street].filter(Boolean).join(" ");
        const area = geo.subregion || geo.district || "";
        const city = geo.city || "";
        const state = geo.region || "";
        const postalCode = geo.postalCode || "";
        const country = geo.country || "";
        const parts = [street, area, city, state, postalCode, country].filter(Boolean);

        const place: DetailedPlace = {
          id: selectedChipId || "map-tap",
          label: selectedPlace?.label || "Pinned Location",
          icon: selectedPlace?.icon || "📍",
          latitude,
          longitude,
          locality: [area, city].filter(Boolean).join(", ") || city,
          address: parts.join(", "),
          street,
          area,
          state,
          postalCode,
          country,
        };
        showCard(place);
      }
    } catch {
      // silent
    } finally {
      setGeocoding(false);
    }
  };

  // ── Save manual location ────────────────────────────────
  const handleSaveManual = async () => {
    if (!manualLocality.trim()) {
      Alert.alert("Required", "Please enter the area / locality.");
      return;
    }
    let labelName = manualLabel.trim();
    if (!labelName) {
      const existingHomes = savedPlaces.filter(
        (p) => p.label === "Home" || /^Home(-\d+)?$/i.test(p.label)
      );
      if (existingHomes.length === 0) {
        labelName = "Home";
      } else {
        labelName = `Home-${existingHomes.length + 1}`;
      }
    }
    const fullAddress = [manualAddress.trim(), manualLandmark.trim(), manualLocality.trim()]
      .filter(Boolean).join(", ");
    const newPlace: DetailedPlace = {
      id: `custom-${Date.now()}`,
      label: labelName,
      icon: manualIcon || "🏠",
      latitude: selectedPlace?.latitude || 17.4483,
      longitude: selectedPlace?.longitude || 78.3915,
      locality: manualLocality.trim(),
      address: fullAddress,
    };
    if (saveToPlacesCheck && userId) {
      try {
        await savePlaceMutation.mutateAsync({
          label: newPlace.label, icon: newPlace.icon,
          latitude: newPlace.latitude, longitude: newPlace.longitude,
          locality: newPlace.locality, address: newPlace.address,
        });
      } catch { /* continue locally */ }
    }
    setSelectedChipId(newPlace.id);
    showCard(newPlace);
    setShowManualModal(false);
    setManualLabel(""); setManualLocality(""); setManualAddress("");
    setManualLandmark(""); setSaveToPlacesCheck(false);
  };

  // ── Proceed to Stage 5 ──────────────────────────────────
  const handleNext = () => {
    if (!selectedPlace) {
      Alert.alert("Select Location", "Please choose a work location.");
      return;
    }
    const combinedAddress = landmarkDirections.trim()
      ? `${selectedPlace.address}. Near: ${landmarkDirections.trim()}`
      : selectedPlace.address;
    setLocation(
      selectedPlace.latitude, selectedPlace.longitude,
      selectedPlace.locality, combinedAddress,
      selectedPlace.id !== GPS_CHIP_ID ? selectedPlace.id : undefined
    );
    router.push("/post-work/schedule");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  // ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <PostWorkHeader
        title="Location"
        currentStep={4}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />
      <StageProgressIndicator
        currentStep={4}
        onStepPress={(step) => {
          if (step <= 2) router.push("/post-work");
          else if (step === 3) router.push("/post-work/details");
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Heading ── */}
        <View style={styles.heading}>
          <Text style={styles.stageTag}>STAGE 4 OF 7</Text>
          <Text style={styles.title}>Where's the work?</Text>
          <Text style={styles.subtitle}>
            Pick a location from your saved places
          </Text>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => switchTab("saved")}
            style={[styles.tabBtn, activeTab === "saved" && styles.tabBtnActive]}
          >
            <Ionicons name="bookmark" size={14}
              color={activeTab === "saved" ? colors.green : "#8FA89B"} />
            <Text style={[styles.tabText, activeTab === "saved" && styles.tabTextActive]}>
              Saved Locations
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchTab("manual")}
            style={[styles.tabBtn, activeTab === "manual" && styles.tabBtnActive]}
          >
            <Ionicons name="pencil" size={14}
              color={activeTab === "manual" ? colors.green : "#8FA89B"} />
            <Text style={[styles.tabText, activeTab === "manual" && styles.tabTextActive]}>
              Enter Manually
            </Text>
          </Pressable>
        </View>

        {/* ══════════ SAVED LOCATIONS TAB ══════════ */}
        {activeTab === "saved" && (
          <View>

            {/* ── LOCATION SELECTION GRID ── */}
            {loadingPlaces ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.green} />
                <Text style={styles.loadingText}>Loading your places…</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {/* ① Saved place cards (Home, Home-1, etc.) */}
                {savedPlaces.map((place) => {
                  const active = selectedChipId === place.id;
                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => handleSelectPlace(place)}
                      style={({ pressed }) => [
                        styles.gridCard,
                        active && styles.gridCardActive,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                      ]}
                    >
                      <View style={[styles.gridIconBox, active && styles.gridIconBoxActive]}>
                        <Text style={styles.gridEmoji}>{place.icon || "🏠"}</Text>
                        {active && (
                          <View style={styles.iconTickBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.gridTitle, active && styles.gridTitleActive]}
                        numberOfLines={1}
                      >
                        {place.label}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* ② Detect location card (GPS) */}
                <Pressable
                  onPress={handleDetectGPS}
                  disabled={loadingGps}
                  style={({ pressed }) => [
                    styles.gridCard,
                    selectedChipId === GPS_CHIP_ID && styles.gridCardActive,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <View
                    style={[
                      styles.gridIconBox,
                      styles.gpsIconBox,
                      selectedChipId === GPS_CHIP_ID && styles.gridIconBoxActive,
                    ]}
                  >
                    {loadingGps ? (
                      <ActivityIndicator size="small" color={colors.green} />
                    ) : (
                      <Ionicons
                        name="navigate"
                        size={20}
                        color={selectedChipId === GPS_CHIP_ID ? colors.green : "#4A5D52"}
                      />
                    )}
                    {selectedChipId === GPS_CHIP_ID && !loadingGps && (
                      <View style={styles.iconTickBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.gridTitle,
                      selectedChipId === GPS_CHIP_ID && styles.gridTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {loadingGps ? "Detecting…" : "My Location"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── SELECTED LOCATION CARD — compact & detailed ── */}
            {selectedPlace && (
              <Animated.View style={[styles.placeCard, { opacity: cardFade }]}>
                {/* Header Row: Title "Selected Location" + tag + checkmark */}
                <View style={styles.placeCardHeader}>
                  <View style={styles.placeCardHeaderLeft}>
                    <View style={styles.placeTitleDot} />
                    <Text style={styles.placeCardTitle}>Selected Location</Text>
                    <View style={styles.placeTagPill}>
                      <Text style={styles.placeTagEmoji}>
                        {selectedChipId === GPS_CHIP_ID ? "📍" : selectedPlace.icon || "🏠"}
                      </Text>
                      <Text style={styles.placeTagText}>{selectedPlace.label}</Text>
                    </View>
                  </View>
                  <View style={styles.placeRightAction}>
                    {geocoding ? (
                      <ActivityIndicator size="small" color={colors.green} />
                    ) : (
                      <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                    )}
                  </View>
                </View>

                {/* Full Address (wrapped) */}
                <View style={styles.addressBox}>
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={colors.green}
                    style={styles.addressIcon}
                  />
                  <Text style={styles.addressFullText}>
                    {selectedPlace.address || selectedPlace.locality}
                  </Text>
                </View>

                {/* Coordinates Footer (Labeled Latitude & Longitude) */}
                <View style={styles.coordsFooter}>
                  <View style={styles.coordPill}>
                    <Text style={styles.coordLabel}>Latitude</Text>
                    <Text style={styles.coordVal}>{selectedPlace.latitude.toFixed(5)}° N</Text>
                  </View>
                  <View style={styles.coordPill}>
                    <Text style={styles.coordLabel}>Longitude</Text>
                    <Text style={styles.coordVal}>{selectedPlace.longitude.toFixed(5)}° E</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── GOOGLE MAP ── */}
            <View style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <View style={styles.mapHeaderLeft}>
                  <View style={styles.mapLiveDot} />
                  <Text style={styles.mapHeaderText} numberOfLines={1}>
                    {selectedPlace?.locality || "Select a location above"}
                  </Text>
                </View>
                {geocoding && <ActivityIndicator size="small" color={colors.green} />}
              </View>

              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: selectedPlace?.latitude || 17.4483,
                  longitude: selectedPlace?.longitude || 78.3915,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                mapType="standard"
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  handleMapTap(latitude, longitude);
                }}
              >
                {selectedPlace && (
                  <Marker
                    coordinate={{
                      latitude: selectedPlace.latitude,
                      longitude: selectedPlace.longitude,
                    }}
                    title={selectedPlace.label}
                    description={selectedPlace.locality}
                    pinColor={colors.green}
                  />
                )}
              </MapView>

              <View style={styles.mapFooter}>
                <Ionicons name="hand-right-outline" size={12} color="#8FA89B" />
                <Text style={styles.mapFooterText}>
                  Tap the map to pin a different spot
                </Text>
              </View>
            </View>

            {/* ── LANDMARK (optional) ── */}
            <View style={styles.landmarkCard}>
              <View style={styles.landmarkHeaderRow}>
                <Ionicons name="compass-outline" size={15} color={colors.green} />
                <Text style={styles.landmarkTitle}>Landmark / Gate</Text>
                <View style={styles.optBadge}>
                  <Text style={styles.optBadgeText}>Optional</Text>
                </View>
              </View>
              <TextInput
                value={landmarkDirections}
                onChangeText={setLandmarkDirections}
                placeholder="e.g. Near Metro Gate 2, Behind Pharmacy"
                placeholderTextColor="#A0B0A5"
                style={styles.landmarkInput}
              />
            </View>
          </View>
        )}

        {/* ══════════ MANUAL TAB ══════════ */}
        {activeTab === "manual" && (
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIcon}>
              <Ionicons name="construct-outline" size={30} color={colors.green} />
            </View>
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonSub}>
              Manual address entry will be available in the next update.
            </Text>
            <Pressable onPress={() => switchTab("saved")} style={styles.comingSoonBtn}>
              <Ionicons name="bookmark" size={14} color="#FFFFFF" />
              <Text style={styles.comingSoonBtnText}>Use Saved Locations</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <PostWorkFooter
        onBack={() => router.back()}
        onNext={handleNext}
        nextDisabled={!selectedPlace}
      />

      {/* ── MANUAL MODAL ── */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowManualModal(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="location" size={18} color={colors.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Enter Address</Text>
                  <Text style={styles.modalSub}>Set your work reporting location</Text>
                </View>
                <Pressable onPress={() => setShowManualModal(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={18} color="#6B7280" />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <Text style={styles.modalSectionLabel}>Place Type</Text>
                <View style={styles.typeChipRow}>
                  {[
                    { label: "Home", icon: "🏠" },
                    { label: "Work", icon: "🏢" },
                    { label: "Shop", icon: "🏪" },
                    { label: "Site", icon: "🏗️" },
                    { label: "Other", icon: "📍" },
                  ].map((t) => {
                    const active = manualIcon === t.icon;
                    return (
                      <Pressable
                        key={t.label}
                        onPress={() => { setManualIcon(t.icon); if (!manualLabel) setManualLabel(t.label); }}
                        style={[styles.typeChip, active && styles.typeChipActive]}
                      >
                        <Text style={styles.typeChipEmoji}>{t.icon}</Text>
                        <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput value={manualLabel} onChangeText={setManualLabel}
                  placeholder="Location name" placeholderTextColor="#9CA3AF" style={styles.mInput} />
                <TextInput value={manualLocality} onChangeText={setManualLocality}
                  placeholder="Area / Locality *" placeholderTextColor="#9CA3AF"
                  style={[styles.mInput, styles.mInputRequired]} />
                <TextInput value={manualAddress} onChangeText={setManualAddress}
                  placeholder="Street / Building (optional)" placeholderTextColor="#9CA3AF"
                  style={styles.mInput} />
                <TextInput value={manualLandmark} onChangeText={setManualLandmark}
                  placeholder="Landmark (optional)" placeholderTextColor="#9CA3AF"
                  style={styles.mInput} />
                {userId ? (
                  <Pressable onPress={() => setSaveToPlacesCheck(!saveToPlacesCheck)}
                    style={styles.saveRow}>
                    <View style={[styles.checkBox, saveToPlacesCheck && styles.checkBoxActive]}>
                      {saveToPlacesCheck && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.saveRowText}>Save for future jobs</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowManualModal(false)} style={styles.mCancelBtn}>
                  <Text style={styles.mCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveManual} disabled={!manualLocality.trim()}
                  style={[styles.mSaveBtn, !manualLocality.trim() && styles.mSaveBtnDisabled]}>
                  <Text style={styles.mSaveText}>Set Location</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <ExitModal visible={showExitModal} onClose={() => setShowExitModal(false)} onExit={handleConfirmExit} />
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6F5" },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16, paddingBottom: 32,
    maxWidth: 640, width: "100%", alignSelf: "center",
  },

  // Heading
  heading: { marginBottom: 20 },
  stageTag: { fontSize: 10, fontWeight: "800", color: colors.green, letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "900", color: "#0F1F14", letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: "500", color: "#6B8A74", lineHeight: 18 },

  // Tabs
  tabBar: {
    flexDirection: "row", backgroundColor: "#E8EDE9",
    borderRadius: 14, padding: 4, marginBottom: 18, gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: "#8FA89B" },
  tabTextActive: { color: colors.green },

  // Loading
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, marginBottom: 8 },
  loadingText: { fontSize: 13, fontWeight: "500", color: "#8FA89B" },

  // ── Location Grid Layout ──
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 16,
  },
  gridCard: {
    width: "47.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E2EBE6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 110,
  },
  gridCardActive: {
    backgroundColor: "#F0FAF4",
    borderColor: colors.green,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  gridIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  gridIconBoxActive: {
    backgroundColor: "#E4F7EC",
  },
  gpsIconBox: {
    backgroundColor: "#F4F7F5",
  },
  iconTickBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
  },
  gridEmoji: {
    fontSize: 22,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F1F14",
    textAlign: "center",
  },
  gridTitleActive: {
    color: colors.green,
  },

  // ── Selected Location Card (Small, Sleek, Complete) ──
  placeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#C8EADA",
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 9,
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
    backgroundColor: colors.green,
  },
  placeCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F1F14",
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
  },
  placeTagEmoji: {
    fontSize: 11,
  },
  placeTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.green,
  },
  placeRightAction: {
    paddingLeft: 4,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6EFEA",
  },
  addressIcon: {
    marginTop: 1,
  },
  addressFullText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2D3E33",
    lineHeight: 16,
    flex: 1,
    flexWrap: "wrap",
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
    color: "#0F1F14",
  },

  // ── Map Card ──
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D8E5DB",
    shadowColor: "#0B1A0F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F0",
  },
  mapHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  mapLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  mapHeaderText: { fontSize: 12, fontWeight: "700", color: "#0F1F14", flex: 1 },
  map: { width: "100%", height: 230 },
  mapFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F0",
    backgroundColor: "#FAFCFB",
  },
  mapFooterText: { fontSize: 11, fontWeight: "500", color: "#8FA89B" },

  // Landmark
  landmarkCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2EBE6",
    marginBottom: 4,
  },
  landmarkHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  landmarkTitle: { fontSize: 13, fontWeight: "800", color: "#0F1F14", flex: 1 },
  optBadge: { backgroundColor: "#F0F4F1", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  optBadgeText: { fontSize: 9, fontWeight: "700", color: "#8FA89B", letterSpacing: 0.3 },
  landmarkInput: {
    backgroundColor: "#F5F7F5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2EBE6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "500",
    color: "#0F1F14",
  },

  // Coming soon
  comingSoonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2EBE6",
    marginTop: 4,
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#EDFBF3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  comingSoonTitle: { fontSize: 18, fontWeight: "800", color: "#0F1F14", marginBottom: 8 },
  comingSoonSub: {
    fontSize: 13, fontWeight: "500", color: "#6B8A74",
    textAlign: "center", lineHeight: 19, marginBottom: 20,
  },
  comingSoonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  comingSoonBtnText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,20,14,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 32,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  modalIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#EDFBF3", alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F1F14" },
  modalSub: { fontSize: 11, fontWeight: "500", color: "#6B8A74" },
  modalClose: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  modalSectionLabel: { fontSize: 11, fontWeight: "700", color: "#6B8A74", letterSpacing: 0.5, marginBottom: 8 },
  typeChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, backgroundColor: "#F5F7F5",
    borderWidth: 1.5, borderColor: "#E2EBE6",
  },
  typeChipActive: { backgroundColor: "#EDFBF3", borderColor: colors.green },
  typeChipEmoji: { fontSize: 13 },
  typeChipText: { fontSize: 12, fontWeight: "600", color: "#6B8A74" },
  typeChipTextActive: { color: colors.green, fontWeight: "700" },
  mInput: {
    backgroundColor: "#F5F7F5",
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#E2EBE6",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: "500",
    color: "#0F1F14",
    marginBottom: 9,
  },
  mInputRequired: { borderColor: colors.green, backgroundColor: "#F0FAF4" },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4, marginBottom: 6 },
  checkBox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: "#D1D5DB",
    backgroundColor: "#F5F7F5", alignItems: "center", justifyContent: "center",
  },
  checkBoxActive: { backgroundColor: colors.green, borderColor: colors.green },
  saveRowText: { fontSize: 12, fontWeight: "600", color: "#374840", flex: 1 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  mCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 13,
    borderWidth: 1.5, borderColor: "#E2EBE6",
    alignItems: "center", justifyContent: "center",
  },
  mCancelText: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  mSaveBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 13,
    backgroundColor: colors.green, alignItems: "center", justifyContent: "center",
  },
  mSaveBtnDisabled: { backgroundColor: "#D1D5DB", opacity: 0.6 },
  mSaveText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
});
