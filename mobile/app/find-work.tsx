import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";

const tabs = [
  { key: "home", label: "Home", icon: "arrow-back" },
  { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
  { key: "applications", label: "Applications", icon: "document-text-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
] as const;

function WorkSearchBar() {
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [typedWord, setTypedWord] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (focused || query || reduceMotion) return;
    const words = ["location", "category"] as const;
    let wordIndex = 0;
    let letters = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    setTypedWord("");
    function tick() {
      const word = words[wordIndex % words.length]!;
      letters += deleting ? -1 : 1;
      setTypedWord(word.slice(0, letters));
      let delay = deleting ? 65 : 130;
      if (letters === word.length) {
        deleting = true;
        delay = 1400;
      } else if (letters === 0) {
        deleting = false;
        wordIndex += 1;
        delay = 300;
      }
      timer = setTimeout(tick, delay);
    }
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [focused, query, reduceMotion]);

  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`Search by ${focused || reduceMotion ? "location or category" : typedWord}`}
          placeholderTextColor={colors.mutedLight}
          accessibilityLabel="Search by location or category"
          autoCorrect={false}
          style={styles.searchInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter a location or category to search"
          onPress={() => inputRef.current?.focus()}
          style={styles.searchIcon}
        >
          <Ionicons name="search-outline" size={23} color={colors.green} />
        </Pressable>
      </View>
    </View>
  );
}

export default function FindWork() {
  const setLocation = useLocation((state) => state.setLocation);
  const [resolvedArea, setResolvedArea] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locationRequestActive = useRef(false);
  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "profile">("jobs");

  async function detectLocation() {
    if (locationRequestActive.current) return;
    locationRequestActive.current = true;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Allow location", "Allow location access to show your current area.",
          permission.canAskAgain ? [{ text: "OK" }] : [
            { text: "Cancel", style: "cancel" },
            { text: "Open settings", onPress: () => {
              void Linking.openSettings().catch(() => Alert.alert("Settings", "Open your phone settings to allow location access."));
            } },
          ]);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        Alert.alert("Turn on location", "Enable location in your phone settings, then tap the location button again.");
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      // GPS remains useful even when the address lookup is unavailable.
      let area = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try {
        const [address] = await Location.reverseGeocodeAsync(coords);
        area = address?.district || address?.city || address?.subregion || area;
      } catch {
        // Display the actual coordinates instead of a preset area name.
      }
      setLocation({ latitude: coords.latitude, longitude: coords.longitude, area });
      setResolvedArea(area);
    } catch {
      Alert.alert("Location unavailable", "Couldn't get your current location. Please try again.");
    } finally {
      locationRequestActive.current = false;
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.brand}>Bulao</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locating ? "Finding your current location" : `Use current location: ${resolvedArea ?? "Choose location"}`}
          accessibilityState={{ disabled: locating, busy: locating }}
          disabled={locating}
          onPress={() => void detectLocation()}
          style={styles.location}
        >
          {locating ? <ActivityIndicator size="small" color={colors.green} /> :
            <Ionicons name="location-outline" size={18} color={colors.green} />}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.locationName}>
            {locating ? "Locating…" : resolvedArea ?? "Choose location"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => Alert.alert("Notifications", "Work notifications are not available yet.")}
          style={styles.notifications}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.green} />
        </Pressable>
      </View>

      <WorkSearchBar />

      {/* Content for each Find Work tab will be added in the next step. */}
      <View style={styles.content} />

      <View style={styles.bottomBar}>
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          const color = selected ? colors.green : colors.muted;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={tab.key === "home" ? "Back to home" : tab.label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (tab.key === "home") router.dismissTo("/(tabs)");
                else setActiveTab(tab.key);
              }}
              style={styles.tab}
            >
              <View style={styles.tabIcon}>
                <Ionicons name={tab.icon} size={25} color={color} />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.tabLabel, { color }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  // Equal side columns keep the location at the exact center as the width changes.
  brand: { width: "25%", minWidth: 0, fontSize: 30, fontWeight: "900", letterSpacing: -1.5, color: colors.green },
  location: { width: "50%", minWidth: 0, minHeight: 48, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  locationName: { flexShrink: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.green },
  notifications: { width: "25%", minWidth: 0, minHeight: 48, alignItems: "flex-end", justifyContent: "center", paddingRight: 4 },
  content: { flex: 1 },
  searchContainer: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  searchBarFocused: { borderColor: colors.green },
  searchInput: { flex: 1, minWidth: 0, paddingLeft: 16, paddingRight: 4, paddingVertical: 14, fontSize: 15, color: colors.ink },
  searchIcon: { width: 48, minHeight: 52, alignItems: "center", justifyContent: "center" },
  // Match the main Home tab bar. The root layout reserves the device's bottom safe area.
  bottomBar: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: 78,
    flexShrink: 0,
    paddingTop: 9,
    paddingBottom: 15,
    backgroundColor: "#FAFAF5",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  // Start every button at zero width, then divide all available space equally.
  // Label length must never affect a button's share of the row.
  tab: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 3 },
  tabIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  tabLabel: { width: "100%", textAlign: "center", fontSize: 12, fontWeight: "500" },
});
