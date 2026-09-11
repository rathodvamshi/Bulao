import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";
import { useAuth } from "../src/auth";
import { jobApi } from "../src/api/jobApi";
import type { Job } from "../src/api/types";
import { JobCard } from "../src/components/JobCard";
import { JobDetailsSheet } from "../src/components/JobDetailsSheet";

const tabs = [
  { key: "home", label: "Home", icon: "arrow-back" },
  { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
  { key: "applications", label: "Applications", icon: "document-text-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
] as const;

interface WorkSearchBarProps {
  query: string;
  setQuery: (q: string) => void;
}

function WorkSearchBar({ query, setQuery }: WorkSearchBarProps) {
  const inputRef = useRef<TextInput>(null);
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
  const { location, setLocationSheetVisible } = useLocation();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "profile">("jobs");
  const [radiusKm, setRadiusKm] = useState<3 | 5 | 10 | 15 | 50>(5);
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!location?.latitude || !location?.longitude) return;
    
    try {
      const res = await jobApi.searchJobs({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm,
        categoryId: category,
      }, session?.token);
      setJobs(res.items);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  }, [location?.latitude, location?.longitude, radiusKm, category, session?.token]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);
      fetchJobs().finally(() => {
        if (isActive) setIsLoading(false);
      });

      return () => {
        isActive = false;
      };
    }, [fetchJobs])
  );

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      job.title.toLowerCase().includes(lowerQ) ||
      job.area.toLowerCase().includes(lowerQ) ||
      job.details?.toLowerCase().includes(lowerQ)
    );
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.brand}>Bulao</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use current location: ${location?.area ?? "Choose location"}`}
          onPress={() => setLocationSheetVisible(true)}
          style={styles.location}
        >
          <Ionicons name="location-outline" size={18} color={colors.green} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.locationName}>
            {location?.area ?? "Choose location"}
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

      <WorkSearchBar query={searchQuery} setQuery={setSearchQuery} />
      <View style={styles.radiusFilters} accessibilityLabel="Job search distance">
        {([3, 5, 10, 15, 50] as const).map((km) => (
          <Pressable
            key={km}
            accessibilityRole="button"
            accessibilityLabel={km === 50 ? "Any distance" : `Within ${km} kilometres`}
            accessibilityState={{ selected: radiusKm === km }}
            onPress={() => setRadiusKm(km)}
            style={[styles.radiusButton, radiusKm === km && styles.radiusButtonSelected]}
          >
            <Text style={[styles.radiusLabel, radiusKm === km && styles.radiusLabelSelected]}>
              {km === 50 ? "All" : `${km} km`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.categoryFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilterContent}>
          {["Events", "Tuitions", "Shop & Hotel", "Constructions", "House"].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${label}`}
              accessibilityState={{ selected: category === label }}
              onPress={() => setCategory(category === label ? null : label)}
              style={[styles.categoryButton, category === label && styles.radiusButtonSelected]}
            >
              <Text style={[styles.radiusLabel, category === label && styles.radiusLabelSelected]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === "jobs" && (
          isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : filteredJobs.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => {
                    setIsRefreshing(true);
                    fetchJobs().finally(() => setIsRefreshing(false));
                  }}
                  colors={[colors.green]}
                  tintColor={colors.green}
                />
              }
            >
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onViewDetails={setSelectedJob} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
              <Ionicons name="briefcase-outline" size={64} color={colors.line} style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
                No jobs found nearby
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
                Try expanding your search radius or changing the category filter.
              </Text>
            </View>
          )
        )}
      </View>

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

      <JobDetailsSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
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
  radiusFilters: { width: "100%", maxWidth: 680, alignSelf: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  radiusButton: { width: "18%", minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  radiusButtonSelected: { backgroundColor: colors.green, borderColor: colors.green },
  radiusLabel: { fontSize: 13, fontWeight: "600", color: colors.green },
  radiusLabelSelected: { color: colors.white },
  categoryFilters: { width: "100%", maxWidth: 680, alignSelf: "center", paddingBottom: 12 },
  categoryFilterContent: { paddingHorizontal: 16, gap: 8 },
  categoryButton: { minHeight: 34, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
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
