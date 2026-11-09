import { router, Redirect } from "expo-router";
import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  Animated,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UniversalMap, UniversalMapHandle } from "../../src/components/map/UniversalMap";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import { useLocation } from "../../src/store/location";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkAnimatedContent,
  transitionPostWorkContent,
  ExitModal,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
} from "../../src/features/post-work/store";

interface SearchSuggestion {
  id: string;
  title: string;
  subtitle: string;
  locality: string;
  latitude: number;
  longitude: number;
}

// ── Curated Comprehensive Database of Hyderabad Hubs, Colleges & Landmarks ──
const HYDERABAD_HUBS: SearchSuggestion[] = [
  {
    id: "hub-kmit",
    title: "KMIT College",
    subtitle: "Keshav Memorial Institute of Technology, Narayanaguda, Hyderabad",
    locality: "Narayanaguda",
    latitude: 17.3986,
    longitude: 78.4932,
  },
  {
    id: "hub-himayatnagar",
    title: "Himayatnagar",
    subtitle: "Street No 1-15, Liberty, Central Hyderabad",
    locality: "Himayatnagar",
    latitude: 17.4022,
    longitude: 78.4878,
  },
  {
    id: "hub-kachiguda",
    title: "Kachiguda",
    subtitle: "Kachiguda X Road, Railway Station, Hyderabad",
    locality: "Kachiguda",
    latitude: 17.3916,
    longitude: 78.4988,
  },
  {
    id: "hub-narayanaguda",
    title: "Narayanaguda",
    subtitle: "Narayanaguda Metro, Flyover, Hyderabad",
    locality: "Narayanaguda",
    latitude: 17.3986,
    longitude: 78.4925,
  },
  {
    id: "hub-banjara-hills",
    title: "Banjara Hills",
    subtitle: "Road No 1 to 14, GVK One, Care Hospital, Hyderabad",
    locality: "Banjara Hills",
    latitude: 17.4156,
    longitude: 78.4350,
  },
  {
    id: "hub-jubilee-hills",
    title: "Jubilee Hills",
    subtitle: "Road No 36 & 45, Checkpost, Metro Station, Hyderabad",
    locality: "Jubilee Hills",
    latitude: 17.4300,
    longitude: 78.4070,
  },
  {
    id: "hub-hitec-city",
    title: "Hitec City",
    subtitle: "Cyber Towers, Mindspace, Cyber Gateway, Madhapur",
    locality: "Hitec City",
    latitude: 17.4504,
    longitude: 78.3808,
  },
  {
    id: "hub-madhapur",
    title: "Madhapur",
    subtitle: "Ayyappa Society, Kavuri Hills, Madhapur, Hyderabad",
    locality: "Madhapur",
    latitude: 17.4416,
    longitude: 78.3820,
  },
  {
    id: "hub-gachibowli",
    title: "Gachibowli",
    subtitle: "DLF Cyber City, Stadium, ORR Junction, Hyderabad",
    locality: "Gachibowli",
    latitude: 17.4401,
    longitude: 78.3489,
  },
  {
    id: "hub-financial-district",
    title: "Financial District",
    subtitle: "Nanakramguda, Waverock, Wipro Circle, Hyderabad",
    locality: "Financial District",
    latitude: 17.4162,
    longitude: 78.3438,
  },
  {
    id: "hub-kondapur",
    title: "Kondapur",
    subtitle: "Botanical Garden, RTO Office, Kothaguda, Hyderabad",
    locality: "Kondapur",
    latitude: 17.4699,
    longitude: 78.3578,
  },
  {
    id: "hub-kphb",
    title: "KPHB Colony",
    subtitle: "Phase 1 to 9, JNTU Road, Kukatpally, Hyderabad",
    locality: "KPHB Colony",
    latitude: 17.4938,
    longitude: 78.3994,
  },
  {
    id: "hub-kukatpally",
    title: "Kukatpally",
    subtitle: "Y Junction, Kukatpally Metro, Hyderabad",
    locality: "Kukatpally",
    latitude: 17.4875,
    longitude: 78.4080,
  },
  {
    id: "hub-ameerpet",
    title: "Ameerpet",
    subtitle: "Ameerpet Metro Interchange, Maitrivanam, Hyderabad",
    locality: "Ameerpet",
    latitude: 17.4375,
    longitude: 78.4483,
  },
  {
    id: "hub-sr-nagar",
    title: "SR Nagar",
    subtitle: "Sanjeeva Reddy Nagar, Community Hall, Hyderabad",
    locality: "SR Nagar",
    latitude: 17.4428,
    longitude: 78.4421,
  },
  {
    id: "hub-secunderabad",
    title: "Secunderabad",
    subtitle: "Railway Station, Clock Tower, Parade Ground, Hyderabad",
    locality: "Secunderabad",
    latitude: 17.4399,
    longitude: 78.4983,
  },
  {
    id: "hub-begumpet",
    title: "Begumpet",
    subtitle: "Old Airport, Lifestyle, Prakash Nagar, Hyderabad",
    locality: "Begumpet",
    latitude: 17.4448,
    longitude: 78.4665,
  },
  {
    id: "hub-somajiguda",
    title: "Somajiguda",
    subtitle: "Raj Bhavan Road, Yashoda Hospital, Hyderabad",
    locality: "Somajiguda",
    latitude: 17.4265,
    longitude: 78.4552,
  },
  {
    id: "hub-panjagutta",
    title: "Panjagutta",
    subtitle: "Central Mall, Panjagutta Circle, Hyderabad",
    locality: "Panjagutta",
    latitude: 17.4262,
    longitude: 78.4503,
  },
  {
    id: "hub-khairatabad",
    title: "Khairatabad",
    subtitle: "RTO Office, Khairatabad Metro, Bada Ganesh, Hyderabad",
    locality: "Khairatabad",
    latitude: 17.4124,
    longitude: 78.4616,
  },
  {
    id: "hub-dilsukhnagar",
    title: "Dilsukhnagar",
    subtitle: "Bus Depot, Metro Station, Konark Theatre, Hyderabad",
    locality: "Dilsukhnagar",
    latitude: 17.3688,
    longitude: 78.5247,
  },
  {
    id: "hub-lb-nagar",
    title: "LB Nagar",
    subtitle: "Ring Road, Metro Terminal, Kamineni, Hyderabad",
    locality: "LB Nagar",
    latitude: 17.3457,
    longitude: 78.5522,
  },
  {
    id: "hub-manikonda",
    title: "Manikonda",
    subtitle: "Puppalguda, Lanco Hills, OU Colony, Hyderabad",
    locality: "Manikonda",
    latitude: 17.3995,
    longitude: 78.3846,
  },
  {
    id: "hub-narsingi",
    title: "Narsingi",
    subtitle: "Narsingi Rotary, ORR Toll Gate, Gandipet Road",
    locality: "Narsingi",
    latitude: 17.3808,
    longitude: 78.3582,
  },
  {
    id: "hub-kokapet",
    title: "Kokapet",
    subtitle: "Neopolis, Golden Mile SEZ, Kokapet, Hyderabad",
    locality: "Kokapet",
    latitude: 17.4063,
    longitude: 78.3308,
  },
  {
    id: "hub-miyapur",
    title: "Miyapur",
    subtitle: "Miyapur Metro Station, Allwyn X Road, Hyderabad",
    locality: "Miyapur",
    latitude: 17.4968,
    longitude: 78.3614,
  },
  {
    id: "hub-chanda-nagar",
    title: "Chanda Nagar",
    subtitle: "Chanda Nagar Main Road, Lingampally, Hyderabad",
    locality: "Chanda Nagar",
    latitude: 17.4912,
    longitude: 78.3248,
  },
  {
    id: "hub-nallagandla",
    title: "Nallagandla",
    subtitle: "Aparna Sarovar, HCU Road, Tellapur, Hyderabad",
    locality: "Nallagandla",
    latitude: 17.4682,
    longitude: 78.3075,
  },
  {
    id: "hub-tellapur",
    title: "Tellapur",
    subtitle: "Tellapur Techno City, Kollur Road, Hyderabad",
    locality: "Tellapur",
    latitude: 17.4644,
    longitude: 78.2917,
  },
  {
    id: "hub-mehdipatnam",
    title: "Mehdipatnam",
    subtitle: "Rythu Bazar, PVNR Expressway Pillar 1-50, Hyderabad",
    locality: "Mehdipatnam",
    latitude: 17.3916,
    longitude: 78.4439,
  },
  {
    id: "hub-tolichowki",
    title: "Tolichowki",
    subtitle: "Galaxy Theatre, RTA Office, Shaikpet Road, Hyderabad",
    locality: "Tolichowki",
    latitude: 17.4014,
    longitude: 78.4116,
  },
  {
    id: "hub-attapur",
    title: "Attapur",
    subtitle: "Pillar 143, Pillar 120, Hyderguda, Attapur, Hyderabad",
    locality: "Attapur",
    latitude: 17.3697,
    longitude: 78.4357,
  },
  {
    id: "hub-abids",
    title: "Abids",
    subtitle: "GPO, Taj Mahal Hotel, Tilak Road, Hyderabad",
    locality: "Abids",
    latitude: 17.3871,
    longitude: 78.4764,
  },
  {
    id: "hub-koti",
    title: "Koti",
    subtitle: "Sultan Bazar, Women's College, Bank Street, Hyderabad",
    locality: "Koti",
    latitude: 17.3833,
    longitude: 78.4844,
  },
  {
    id: "hub-charminar",
    title: "Charminar",
    subtitle: "Laad Bazar, Mecca Masjid, Old City, Hyderabad",
    locality: "Charminar",
    latitude: 17.3616,
    longitude: 78.4747,
  },
  {
    id: "hub-tarnaka",
    title: "Tarnaka",
    subtitle: "Tarnaka Metro, Osmania University Road, Hyderabad",
    locality: "Tarnaka",
    latitude: 17.4284,
    longitude: 78.5302,
  },
  {
    id: "hub-habsiguda",
    title: "Habsiguda",
    subtitle: "Street No 8, Metro Station, CCMB, Hyderabad",
    locality: "Habsiguda",
    latitude: 17.4062,
    longitude: 78.5432,
  },
  {
    id: "hub-uppal",
    title: "Uppal",
    subtitle: "Ring Road, Metro Terminal, Cricket Stadium, Hyderabad",
    locality: "Uppal",
    latitude: 17.4018,
    longitude: 78.5602,
  },
  {
    id: "hub-ecil",
    title: "ECIL",
    subtitle: "ECIL X Roads, Moula Ali, Kushaiguda, Hyderabad",
    locality: "ECIL",
    latitude: 17.4689,
    longitude: 78.5779,
  },
  {
    id: "hub-as-rao-nagar",
    title: "AS Rao Nagar",
    subtitle: "Sainikpuri, Radhika Theatre, Hyderabad",
    locality: "AS Rao Nagar",
    latitude: 17.4847,
    longitude: 78.5521,
  },
  {
    id: "hub-sainikpuri",
    title: "Sainikpuri",
    subtitle: "Vayupuri, Defence Colony, Sainikpuri, Hyderabad",
    locality: "Sainikpuri",
    latitude: 17.4947,
    longitude: 78.5447,
  },
  {
    id: "hub-malkajgiri",
    title: "Malkajgiri",
    subtitle: "Anandbagh, Geeta Theatre, Malkajgiri, Hyderabad",
    locality: "Malkajgiri",
    latitude: 17.4474,
    longitude: 78.5289,
  },
  {
    id: "hub-alwal",
    title: "Alwal",
    subtitle: "Lothkunta, IG Statue, Old Alwal, Hyderabad",
    locality: "Alwal",
    latitude: 17.5024,
    longitude: 78.5132,
  },
  {
    id: "hub-kompally",
    title: "Kompally",
    subtitle: "Suchitra Circle, Cine Planet, Medchal Highway",
    locality: "Kompally",
    latitude: 17.5372,
    longitude: 78.4851,
  },
  {
    id: "hub-nizampet",
    title: "Nizampet",
    subtitle: "Nizampet Road, Village, Vertex Colony, Hyderabad",
    locality: "Nizampet",
    latitude: 17.5186,
    longitude: 78.3846,
  },
  {
    id: "hub-bachupally",
    title: "Bachupally",
    subtitle: "Silver Oaks, VNR VJIET, Bachupally X Road",
    locality: "Bachupally",
    latitude: 17.5323,
    longitude: 78.3688,
  },
  {
    id: "hub-pragathi-nagar",
    title: "Pragathi Nagar",
    subtitle: "Lake View, JNTU Back Road, Kukatpally, Hyderabad",
    locality: "Pragathi Nagar",
    latitude: 17.5152,
    longitude: 78.3962,
  },
  {
    id: "hub-chikkadpally",
    title: "Chikkadpally",
    subtitle: "City Central Library, Venkateswara Temple, Hyderabad",
    locality: "Chikkadpally",
    latitude: 17.4042,
    longitude: 78.4988,
  },
  {
    id: "hub-rtc-x-roads",
    title: "RTC X Roads",
    subtitle: "Bawarchi, Sandhya Theatres, Chikkadpally, Hyderabad",
    locality: "RTC X Roads",
    latitude: 17.4072,
    longitude: 78.4965,
  },
  {
    id: "hub-barkatpura",
    title: "Barkatpura",
    subtitle: "Barkatpura Chaman, Kacheguda, Hyderabad",
    locality: "Barkatpura",
    latitude: 17.3912,
    longitude: 78.4942,
  },
  {
    id: "hub-nallakunta",
    title: "Nallakunta",
    subtitle: "Fever Hospital, Vegetable Market, Shivam Road",
    locality: "Nallakunta",
    latitude: 17.3982,
    longitude: 78.5085,
  },
  {
    id: "hub-vidyanagar",
    title: "Vidyanagar",
    subtitle: "Vidyanagar Railway Station, OU Road, Hyderabad",
    locality: "Vidyanagar",
    latitude: 17.3988,
    longitude: 78.5182,
  },
  {
    id: "hub-jntu",
    title: "JNTU College of Engineering",
    subtitle: "JNTUH Campus, KPHB 7th Phase, Kukatpally",
    locality: "Kukatpally",
    latitude: 17.4986,
    longitude: 78.3912,
  },
  {
    id: "hub-ou",
    title: "Osmania University Campus",
    subtitle: "Arts College, Landscape Gardens, Tarnaka, Hyderabad",
    locality: "Tarnaka",
    latitude: 17.4138,
    longitude: 78.5284,
  },
  {
    id: "hub-inorbit",
    title: "Inorbit Mall",
    subtitle: "Durgam Cheruvu, Knowledge City, Madhapur, Hyderabad",
    locality: "Madhapur",
    latitude: 17.4342,
    longitude: 78.3865,
  },
  {
    id: "hub-sarath-mall",
    title: "Sarath City Capital Mall",
    subtitle: "Whitefields, Kondapur Main Road, Gachibowli, Hyderabad",
    locality: "Kondapur",
    latitude: 17.4582,
    longitude: 78.3645,
  },
  {
    id: "hub-ikea",
    title: "IKEA Hyderabad",
    subtitle: "Raidurg Metro Station, Hitec City, Hyderabad",
    locality: "Hitec City",
    latitude: 17.4412,
    longitude: 78.3742,
  },
  {
    id: "hub-shamshabad",
    title: "Shamshabad Airport (RGIA)",
    subtitle: "Rajiv Gandhi International Airport, Hyderabad",
    locality: "Shamshabad",
    latitude: 17.2403,
    longitude: 78.4294,
  },
];

function deduplicateSuggestions(items: SearchSuggestion[]): SearchSuggestion[] {
  const seenTitles = new Set<string>();
  const seenCoords = new Set<string>();
  const seenIds = new Set<string>();
  const unique: SearchSuggestion[] = [];

  for (const item of items) {
    if (!item) continue;
    if (seenIds.has(item.id)) continue;

    const cleanTitle =
      item.title.trim().toLowerCase().split(",")[0]?.trim() || item.title.toLowerCase();
    const coordKey = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;

    if (seenTitles.has(cleanTitle) || seenCoords.has(coordKey)) {
      continue;
    }

    seenIds.add(item.id);
    seenTitles.add(cleanTitle);
    seenCoords.add(coordKey);
    unique.push(item);
  }

  return unique;
}

export interface PostWorkLocationHandle {
  validateAndSave: () => boolean;
}

export interface PostWorkLocationProps {
  embedded?: boolean;
}

export const PostWorkLocationScreen = React.forwardRef<PostWorkLocationHandle, PostWorkLocationProps>(
  function PostWorkLocationScreen({ embedded = false }, ref) {
  const insets = useSafeAreaInsets();
  const {
    latitude: savedLat,
    longitude: savedLng,
    locality: savedLocality,
    address: savedAddress,
    savedPlaceId: savedPlaceIdStore,
    workMode: storeWorkMode,
    dynamicAnswers,
    setLocation,
    resetFlow,
  } = usePostWorkStore();

  // If online mode was chosen in Stage 3, skip location and redirect directly to schedule
  useEffect(() => {
    if (storeWorkMode === "online" || dynamicAnswers?.teachingMode === "online") {
      router.replace("/post-work/schedule");
    }
  }, [storeWorkMode, dynamicAnswers?.teachingMode]);

  // The initial map camera is only a preview; providers must explicitly choose
  // the real worksite before they can continue.
  const hasSavedWorksite = savedLat != null && savedLng != null && Boolean(savedLocality?.trim()) && Boolean(savedAddress?.trim());
  const [locationConfirmed, setLocationConfirmed] = useState(hasSavedWorksite);
  const [selectedPlace, setSelectedPlace] = useState<{
    locality: string;
    address: string;
    latitude: number;
    longitude: number;
  }>({
    locality: savedLocality || "Choose worksite location",
    address: savedAddress || "",
    latitude: savedLat ?? 17.3995,
    longitude: savedLng ?? 78.3846,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResultsList, setShowResultsList] = useState(false);

  const [landmarkDirections, setLandmarkDirections] = useState(
    savedAddress && savedAddress.includes("Near:")
      ? savedAddress.split("Near:")[1]?.trim() || ""
      : ""
  );

  const [loadingGps, setLoadingGps] = useState(false);
  const [bottomCardHeight, setBottomCardHeight] = useState(220);
  const [geocoding, setGeocoding] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const mapRef = useRef<UniversalMapHandle>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialGpsAttempted = useRef(false);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedPlace?.latitude, selectedPlace?.longitude, selectedPlace?.locality, geocoding]);

  // ── Keyboard & Landmark Focus Animation ───────────────────
  const [isLandmarkFocused, setIsLandmarkFocused] = useState(false);
  const isLandmarkFocusedRef = useRef(false);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (isLandmarkFocusedRef.current) {
        Animated.timing(keyboardOffset, {
          // Android resizes the app window, so lifting the sheet by the
          // keyboard height as well would leave an unnecessary gap above it.
          toValue: Platform.OS === "ios" ? e.endCoordinates.height : 0,
          duration: Platform.OS === "ios" ? e.duration || 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e?.duration || 200 : 150,
        useNativeDriver: false,
      }).start(() => {
        setIsLandmarkFocused(false);
        isLandmarkFocusedRef.current = false;
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // Animate map to selected coordinate
  const animateToCoordinate = useCallback((lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.animateToCoordinate(lat, lng);
    }
  }, []);

  useEffect(() => {
    if (selectedPlace) {
      animateToCoordinate(selectedPlace.latitude, selectedPlace.longitude);
    }
  }, [selectedPlace?.latitude, selectedPlace?.longitude, animateToCoordinate]);

  // ── Core GPS Detection Logic ──────────────────────────────
  const detectAndApplyLocation = useCallback(
    async (silent = false) => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!silent) {
            Alert.alert(
              "Permission Required",
              "Please enable Location access in device settings to detect your current location."
            );
          }
          return;
        }

        setLoadingGps(true);
        setGeocoding(true);

        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });

        const { latitude, longitude } = pos.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180
        ) {
          throw new Error("Invalid location coordinates");
        }

        // Move to valid coordinates immediately; reverse geocoding only fills in the label.
        setSelectedPlace({
          locality: "Current Location",
          address: "Current Location",
          latitude,
          longitude,
        });
        setLocationConfirmed(true);

        const results = await ExpoLocation.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        const geo = results[0];
        const area = geo?.subregion || geo?.district || geo?.name || "Current Location";
        const city = geo?.city || "Hyderabad";
        const locality = `${area}, ${city}`;
        const street = [geo?.streetNumber, geo?.street].filter(Boolean).join(" ");
        const formatted = [street, area, city, geo?.region]
          .filter(Boolean)
          .join(", ");

        setSelectedPlace({
          locality: area,
          address: formatted || locality,
          latitude,
          longitude,
        });
        setLocationConfirmed(true);
      } catch {
        if (!silent) {
          Alert.alert(
            "GPS Unavailable",
            "Could not detect location. You can search or tap on the map to pin your location."
          );
        }
      } finally {
        setLoadingGps(false);
        setGeocoding(false);
      }
    },
    []
  );

  useEffect(() => {
    if (initialGpsAttempted.current || hasSavedWorksite) return;
    initialGpsAttempted.current = true;
    void detectAndApplyLocation(false);
  }, [detectAndApplyLocation, hasSavedWorksite]);

  // ── GPS Button Manual Trigger ─────────────────────────────
  const handleDetectGPS = () => {
    detectAndApplyLocation(false);
  };

  // ── Tap Map to Move Pin ───────────────────────────────────
  const handleMapTap = async (latitude: number, longitude: number, placeName?: string) => {
    Keyboard.dismiss();
    setShowResultsList(false);

    // 1. Immediately move the pin and update coordinates with zero lag
    setSelectedPlace((prev) => ({
      ...prev,
      locality: placeName || prev.locality || "Pinned Location",
      latitude,
      longitude,
    }));
    setLocationConfirmed(true);
    setGeocoding(true);

    try {
      const results = await ExpoLocation.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      const geo = results[0];
      const area =
        placeName ||
        geo?.subregion ||
        geo?.district ||
        geo?.name ||
        geo?.city ||
        "Pinned Location";
      const city = geo?.city || "Hyderabad";
      const locality = `${area}, ${city}`;
      const street = [geo?.streetNumber, geo?.street].filter(Boolean).join(" ");
      const formatted = [street, area, city, geo?.region]
        .filter(Boolean)
        .join(", ");

      setSelectedPlace({
        locality: area,
        address: formatted || locality,
        latitude,
        longitude,
      });
    } catch {
      // Retain coordinates even if reverse geocoding is unavailable
    } finally {
      setGeocoding(false);
    }
  };

    // ── Search Locations Autocomplete ─────────────────────────
  const executeSearch = async (text: string) => {
    const q = text.trim().toLowerCase();
    if (!q) {
      setSearchResults(deduplicateSuggestions(HYDERABAD_HUBS.slice(0, 10)));
      setShowResultsList(true);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResultsList(true);

    // 1. Instant local match across curated Hyderabad database (0ms latency!)
    const localMatches = HYDERABAD_HUBS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.locality.toLowerCase().includes(q)
    );

    // Set local matches immediately so the UI responds instantaneously
    setSearchResults(deduplicateSuggestions(localMatches));

    // 2. Query ExpoLocation geocoder in background for additional street-level addresses
    try {
      const queryWithCity = q.includes("hyderabad") ? q : `${q}, Hyderabad`;
      const geocoded = await ExpoLocation.geocodeAsync(queryWithCity);

      if (geocoded && geocoded.length > 0) {
        const topResults = geocoded.slice(0, 3);
        const extraItems: SearchSuggestion[] = [];

        for (let i = 0; i < topResults.length; i++) {
          const item = topResults[i];
          if (!item) continue;
          const duplicate = localMatches.some(
            (m) =>
              Math.abs(m.latitude - item.latitude) < 0.003 &&
              Math.abs(m.longitude - item.longitude) < 0.003
          );
          if (duplicate) continue;

          try {
            const rev = await ExpoLocation.reverseGeocodeAsync({
              latitude: item.latitude,
              longitude: item.longitude,
            });
            const geo = rev[0];
            const area = geo?.subregion || geo?.district || geo?.name || text.trim();
            const city = geo?.city || "Hyderabad";
            const locality = `${area}, ${city}`;
            const subtitle = [geo?.street, area, city, geo?.region]
              .filter(Boolean)
              .join(", ");

            extraItems.push({
              id: `geo-${i}-${item.latitude}`,
              title: area,
              subtitle: subtitle || locality,
              locality: area,
              latitude: item.latitude,
              longitude: item.longitude,
            });
          } catch {
            extraItems.push({
              id: `geo-${i}-${item.latitude}`,
              title: text.trim(),
              subtitle: "Hyderabad, Telangana",
              locality: text.trim(),
              latitude: item.latitude,
              longitude: item.longitude,
            });
          }
        }

        if (extraItems.length > 0) {
          setSearchResults(deduplicateSuggestions([...localMatches, ...extraItems]));
        }
      }
    } catch {
      // Keep localMatches already displayed
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);
    const q = text.trim().toLowerCase();
    if (!q) {
      setSearchResults(deduplicateSuggestions(HYDERABAD_HUBS.slice(0, 10)));
      setShowResultsList(true);
      return;
    }

    // Instant local results on every keystroke
    const instant = HYDERABAD_HUBS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.locality.toLowerCase().includes(q)
    );
    setSearchResults(deduplicateSuggestions(instant));
    setShowResultsList(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(text);
    }, 300);
  };

  const handleSelectSearchResult = (item: SearchSuggestion) => {
    Keyboard.dismiss();
    setSearchQuery("");
    setShowResultsList(false);

    setSelectedPlace({
      locality: item.title,
      address: item.subtitle,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setLocationConfirmed(true);

  };

  // ── Proceed to Stage 5 ────────────────────────────────────
  const validateAndSave = (): boolean => {
    if (!selectedPlace || !locationConfirmed) {
      Alert.alert("Worksite Location Required", "Choose the actual job location by searching, placing the map pin, or using GPS. Your device location is only used if you choose it.");
      return false;
    }

    const combinedAddress = [selectedPlace.address, landmarkDirections.trim()]
      .filter(Boolean)
      .join(". Near: ");

    setLocation(
      selectedPlace.latitude,
      selectedPlace.longitude,
      selectedPlace.locality,
      combinedAddress,
      savedPlaceIdStore || undefined,
      storeWorkMode || "home"
    );
    useLocation.getState().setLocation({
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      area: selectedPlace.locality || selectedPlace.address || "Current Location",
    });

    return true;
  };

  useImperativeHandle(ref, () => ({
    validateAndSave,
  }));

  const handleNext = () => {
    if (!validateAndSave()) return;
    router.push("/post-work/schedule");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  const RootContainer = embedded ? View : SafeAreaView;

  return (
    <RootContainer style={styles.root} {...(!embedded ? { edges: ["top" as const] } : {})}>
      {!embedded && (
        <>
          {/* ── Standard Navigation Header ── */}
          <PostWorkHeader
            title="Location"
            currentStep={4}
            totalSteps={7}
            onBack={() => router.push("/post-work/details")}
            onExit={() => setShowExitModal(true)}
          />

          <StageProgressIndicator
            currentStep={4}
            onStepPress={(step) => {
              if (step <= 2) {
                router.push({
                  pathname: "/post-work",
                  params: { stage: String(step), preserveDraft: "1" },
                });
              }
              else if (step === 3) router.push("/post-work/details");
            }}
          />
        </>
      )}

      {/* ============================================================ */}
      {/* IMMERSIVE FULL-MAP VIEW (GOOGLE MAPS STYLE)                  */}
      {/* ============================================================ */}
      <PostWorkAnimatedContent style={styles.mapContainer}>
        {/* 1. Full-screen Google Map */}
        <UniversalMap
          ref={mapRef}
          style={styles.fullMap}
          latitude={selectedPlace.latitude}
          longitude={selectedPlace.longitude}
          locality={selectedPlace.locality}
          onLocationSelect={(lat, lng) => {
            handleMapTap(lat, lng);
          }}
          interactive={true}
        />

        {/* ============================================================ */}
        {/* ULTRA-MODERN CENTER LOCATION BEACON (SWIGGY / UBER STYLE)    */}
        {/* Completely non-pointing: circular radar halo & floating pill */}
        {/* ============================================================ */}
        <View style={styles.centerBeaconOverlay} pointerEvents="none">
          {/* Floating Pill Location Card */}
          <View style={styles.beaconPill}>
            <View style={styles.beaconStatusDot} />
            <Text style={styles.beaconPillText} numberOfLines={1}>
              {geocoding ? "Locating..." : locationConfirmed ? selectedPlace.locality : "Choose exact worksite"}
            </Text>
            <View style={[styles.beaconPillBadge, !locationConfirmed && styles.beaconPillBadgeUnset]}>
              <Text style={styles.beaconPillBadgeText}>{locationConfirmed ? "SET" : "PICK"}</Text>
            </View>
          </View>
          <View style={styles.beaconPillConnector} />

          {/* Modern Circular Radar Halo Target (Zero Pointing Needle!) */}
          <View style={styles.beaconHaloRing}>
            <View style={styles.beaconMiddleRing}>
              <View style={styles.beaconCoreDot} />
            </View>
          </View>
          <View style={styles.beaconGroundShadow} />
        </View>

        {/* 2. Floating Search Bar over Map */}
        <View style={styles.floatingSearchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#03402D" />
            <TextInput
              value={searchQuery}
              onFocus={() => {
                isLandmarkFocusedRef.current = false;
                setIsLandmarkFocused(false);
                Animated.timing(keyboardOffset, {
                  toValue: 0,
                  duration: 150,
                  useNativeDriver: false,
                }).start();
                if (!searchQuery.trim()) {
                  setSearchResults(deduplicateSuggestions(HYDERABAD_HUBS.slice(0, 10)));
                }
                setShowResultsList(true);
              }}
              onChangeText={handleSearchTextChange}
              placeholder="Search area, colony, or landmark..."
              placeholderTextColor="#64748B"
              style={styles.searchBarInput}
              returnKeyType="search"
              onSubmitEditing={() => executeSearch(searchQuery)}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#03402D" />
            ) : searchQuery.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults(deduplicateSuggestions(HYDERABAD_HUBS.slice(0, 10)));
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          {/* Helper Pill: Tap Map to Move Pin (hidden when search is open) */}
          {!showResultsList && (
            <View style={styles.tapHelperPill}>
              <Ionicons name="hand-right-outline" size={12} color="#03402D" />
              <Text style={styles.tapHelperText}>
                {geocoding ? "Resolving address..." : "Move map or tap to set exact location"}
              </Text>
            </View>
          )}

          {/* Suggestions Dropdown Overlay */}
          {showResultsList && (
            <View style={styles.searchResultsCard}>
              {/* 1. Instant Current Location Target Option */}
              <Pressable
                onPress={() => {
                  setShowResultsList(false);
                  Keyboard.dismiss();
                  handleDetectGPS();
                }}
                style={styles.searchUseCurrentLocationBtn}
              >
                <View style={styles.currentLocIconBox}>
                  <Ionicons name="navigate" size={17} color="#03402D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentLocTitle}>Use Current GPS Location</Text>
                  <Text style={styles.currentLocSubtitle}>
                    Auto-detect and pin my live address
                  </Text>
                </View>
              </Pressable>

              <View style={styles.searchDivider} />

              {/* Section Header */}
              <View style={styles.searchSectionHeader}>
                <Text style={styles.searchSectionHeaderText}>
                  {searchQuery.trim().length > 0
                    ? `MATCHING PLACES (${searchResults.length})`
                    : "POPULAR & SUGGESTED PLACES"}
                </Text>
              </View>

              {/* 2. Scrollable Suggestions */}
              <ScrollView
                style={styles.searchResultsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {searchResults.length > 0 ? (
                  searchResults.map((res) => (
                    <Pressable
                      key={res.id}
                      onPress={() => handleSelectSearchResult(res)}
                      style={styles.searchResultItem}
                    >
                      <View style={styles.searchResultIconBox}>
                        <Ionicons name="location-outline" size={18} color="#03402D" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultTitle}>{res.title}</Text>
                        <Text style={styles.searchResultSubtitle} numberOfLines={1}>
                          {res.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : !isSearching && searchQuery.trim().length > 1 ? (
                  <View style={styles.noResultsBox}>
                    <Text style={styles.noResultsText}>
                      No matching places found. Tap directly on the map to pin.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Backdrop to dismiss keyboard on tap outside when landmark is focused */}
        {isLandmarkFocused && (
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => Keyboard.dismiss()}
          />
        )}

        {/* 3. Floating GPS "Locate Me" Target Button */}
        <Animated.View
          style={[
            styles.floatingGpsBtnContainer,
            {
              bottom: keyboardOffset.interpolate({
                inputRange: [0, 600],
                outputRange: [bottomCardHeight + 12, bottomCardHeight + 12 + 600],
              }),
            },
            isLandmarkFocused && { opacity: 0, pointerEvents: "none" },
          ]}
        >
          <Pressable
            onPress={handleDetectGPS}
            disabled={loadingGps || isLandmarkFocused}
            style={styles.floatingGpsBtn}
            accessibilityRole="button"
            accessibilityLabel="Detect current location"
          >
            {loadingGps ? (
              <ActivityIndicator size="small" color="#03402D" />
            ) : (
              <>
                <Ionicons name="navigate" size={17} color="#03402D" />
                <Text style={styles.floatingGpsText}>Detect location</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* 4. Docked Bottom Location Card (Animated with Keyboard) */}
        <Animated.View
          style={[
            styles.bottomCard,
            {
              bottom: keyboardOffset,
              paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 16 : 8),
            },
          ]}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setBottomCardHeight((current) => current === nextHeight ? current : nextHeight);
          }}
        >
          <View style={styles.bottomCardHandle} />

          {/* Location Title & Verified Tag */}
          <View style={styles.bottomPlaceRow}>
            <View style={styles.bottomPinIcon}>
              {geocoding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="location-sharp" size={20} color="#FFFFFF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.bottomTitleRow}>
                <Text style={styles.bottomPlaceTitle} numberOfLines={1}>
                  {locationConfirmed ? selectedPlace.locality : "Choose worksite location"}
                </Text>
              </View>
              <Text style={styles.bottomPlaceAddress} numberOfLines={2}>
                {geocoding ? "Resolving street address..." : locationConfirmed ? selectedPlace.address : "Search for the worksite, move the map pin, or choose GPS."}
              </Text>
            </View>
          </View>

          {/* Optional Society / Landmark Input with Keyboard Lift */}
          <View
            style={[
              styles.bottomLandmarkBox,
              isLandmarkFocused && styles.bottomLandmarkBoxFocused,
            ]}
          >
            <Ionicons
              name="business-outline"
              size={17}
              color={isLandmarkFocused ? "#03402D" : "#64748B"}
            />
            <TextInput
              value={landmarkDirections}
              onChangeText={setLandmarkDirections}
              onFocus={() => {
                isLandmarkFocusedRef.current = true;
                setIsLandmarkFocused(true);
              }}
              placeholder="House, building, gate or landmark (optional)..."
              placeholderTextColor="#94A3B8"
              style={styles.bottomLandmarkInput}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {landmarkDirections.length > 0 && (
              <Pressable
                onPress={() => setLandmarkDirections("")}
                hitSlop={8}
                style={{ paddingHorizontal: 4 }}
              >
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
            {isLandmarkFocused && (
              <Pressable
                onPress={() => Keyboard.dismiss()}
                style={styles.landmarkDoneBtn}
              >
                <Text style={styles.landmarkDoneText}>Done</Text>
              </Pressable>
            )}
          </View>

          {!embedded && (
            <>
              {/* Action Navigation Buttons */}
              <View style={styles.bottomActionsRow}>
                <Pressable
                  onPress={() => transitionPostWorkContent("back", () => router.push("/post-work/details"))}
                  style={styles.backBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Back to previous step"
                >
                  <Ionicons name="arrow-back" size={18} color="#03402D" />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>

                <Pressable
                  onPress={() => transitionPostWorkContent("forward", handleNext)}
                  disabled={!locationConfirmed || geocoding}
                  style={[styles.confirmLocationBtn, (!locationConfirmed || geocoding) && styles.confirmLocationBtnDisabled]}
                >
                  <Text style={styles.confirmLocationBtnText}>
                    Next
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </PostWorkAnimatedContent>

      {!embedded && (
        <ExitModal
          visible={showExitModal}
          onClose={() => setShowExitModal(false)}
          onExit={handleConfirmExit}
        />
      )}
    </RootContainer>
  );
});

export default function PostWorkLocationRoute() {
  return <Redirect href={{ pathname: "/post-work", params: { stage: "4" } }} />;
}

// ────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Map Container
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  fullMap: {
    ...StyleSheet.absoluteFillObject,
  },

  // Ultra-Modern Center Location Beacon (Swiggy / Uber style)
  centerBeaconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 220,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  beaconPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    gap: 7,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: "#03402D",
    maxWidth: 240,
    marginBottom: 2,
  },
  beaconStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#059669",
  },
  beaconPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  beaconPillBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  beaconPillBadgeUnset: { backgroundColor: "#FEF3C7" },
  beaconPillBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#03402D",
  },
  beaconPillConnector: {
    width: 2,
    height: 6,
    backgroundColor: "#03402D",
    borderRadius: 1,
    marginBottom: 1,
  },
  beaconHaloRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(3, 64, 45, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(3, 64, 45, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  beaconMiddleRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#03402D",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  beaconCoreDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#34D399",
  },
  beaconGroundShadow: {
    width: 14,
    height: 4,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginTop: 2,
  },

  // Floating Search Bar over Map
  floatingSearchContainer: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: "#0F172A",
  },
  tapHelperPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tapHelperText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03402D",
  },

  // Search Results Overlay
  searchResultsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 6,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 290,
  },
  searchUseCurrentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#F0FDF4",
    marginHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  currentLocIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03402D",
  },
  currentLocSubtitle: {
    fontSize: 11,
    color: "#059669",
    marginTop: 1,
  },
  searchDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 6,
  },
  searchSectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  searchSectionHeaderText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  searchResultsScroll: {
    maxHeight: 210,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  searchResultIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  searchResultSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
  noResultsBox: {
    padding: 14,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
  },

  // Floating GPS Button
  floatingGpsBtnContainer: {
    position: "absolute",
    right: 16,
    zIndex: 5,
  },
  floatingGpsBtn: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#03402D",
    zIndex: 5,
  },
  floatingGpsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03402D",
  },

  // Docked Bottom Location Card (Google Maps Style)
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    zIndex: 6,
  },
  bottomCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 4,
  },
  bottomPlaceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bottomPinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#03402D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  bottomTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomPlaceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  bottomPlaceAddress: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 2,
  },
  coordsDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  coordPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 4,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  coordValue: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#0F172A",
  },

  // Landmark Input
  bottomLandmarkBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  bottomLandmarkBoxFocused: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.6,
  },
  bottomLandmarkInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#0F172A",
  },
  landmarkDoneBtn: {
    backgroundColor: "#03402D",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  landmarkDoneText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Bottom Navigation Buttons
  bottomActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  backBtnText: {
    fontSize: POST_WORK_TYPOGRAPHY.button,
    fontWeight: "700",
    color: "#03402D",
  },
  confirmLocationBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#03402D",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  confirmLocationBtnDisabled: { backgroundColor: "#94A3B8", opacity: 0.75 },
  confirmLocationBtnText: {
    fontSize: POST_WORK_TYPOGRAPHY.button,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
