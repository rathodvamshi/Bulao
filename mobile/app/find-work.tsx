import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";
import { useAuth } from "../src/auth";
import { jobApi } from "../src/api/jobApi";
import { api } from "../src/api/client";
import { getNotificationInbox } from "../src/api/notifications";
import type { Job, ApplicationItem } from "../src/api/types";
import { formatDirectPhone } from "../src/utils/phone";
import { JobCard } from "../src/components/JobCard";
import { JobDetailsSheet } from "../src/components/JobDetailsSheet";
import { JobApplicationsModal } from "../src/components/JobApplicationsModal";
import { CancellationModal } from "../src/components/CancellationModal";

const tabs = [
  { key: "home", label: "Home", icon: "arrow-back" },
  { key: "jobs", label: "Jobs", icon: "briefcase-outline" },
  { key: "applications", label: "Applications", icon: "document-text-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
] as const;

const RADIUS_OPTIONS = [
  { key: 5, label: "5 km" },
  { key: 10, label: "10 km" },
  { key: 20, label: "20 km" },
  { key: 30, label: "30 km" },
  { key: 40, label: "40 km" },
  { key: 50, label: "50 km" },
] as const;

const CATEGORIES = [
  { id: null, label: "All" },
  { id: "construction", label: "Construction" },
  { id: "events", label: "Events" },
  { id: "shops", label: "Shop & Business" },
  { id: "food", label: "Food & Kitchen" },
  { id: "household", label: "House & Maid" },
  { id: "promotion", label: "Promotions" },
  { id: "other-work", label: "Other" },
] as const;

const APP_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "REJECTED", label: "Rejected" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "COMPLETED", label: "Completed" },
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

function JobCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ width: "60%", height: 20, borderRadius: 6, backgroundColor: "#E2E8F0" }} />
        <View style={{ width: "25%", height: 22, borderRadius: 6, backgroundColor: "#E2E8F0" }} />
      </View>
      <View style={{ width: "40%", height: 14, borderRadius: 4, backgroundColor: "#F1F5F9", marginBottom: 10 }} />
      <View style={{ width: "70%", height: 14, borderRadius: 4, backgroundColor: "#F1F5F9", marginBottom: 6 }} />
      <View style={{ width: "50%", height: 14, borderRadius: 4, backgroundColor: "#F1F5F9", marginBottom: 16 }} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: "#E2E8F0" }} />
        <View style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: "#E2E8F0" }} />
      </View>
    </View>
  );
}

export default function FindWork() {
  const { location, setLocation, setLocationSheetVisible } = useLocation();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "profile">("jobs");
  // Default radius 5 km, hard maximum 50 km per Phase 1 specification
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [appsModalJob, setAppsModalJob] = useState<Job | null>(null);

  // Applications tab state
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsRefreshing, setAppsRefreshing] = useState(false);
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>("all");
  const [cancellingApp, setCancellingApp] = useState<ApplicationItem | null>(null);

  // Notifications state
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const checkUnread = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await getNotificationInbox("seeker");
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

  // Fallback coordinates if user location is not yet set
  const userLat = location?.latitude ?? 17.3850;
  const userLng = location?.longitude ?? 78.4867;

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
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const cursor = reset ? undefined : (nextCursor || undefined);

      const res = await jobApi.searchJobs({
        latitude: userLat,
        longitude: userLng,
        radiusKm,
        categoryId: category,
        cursor: cursor ? String(cursor) : undefined,
      }, session?.token);

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

      setNextCursor(res?.nextCursor ? String(res.nextCursor) : null);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [userLat, userLng, radiusKm, category, nextCursor, session?.token]);

  // Initial and refresh load
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (activeTab === "jobs") {
        fetchJobs(true);
      } else if (activeTab === "applications") {
        fetchApplications();
      }
      return () => {
        isActive = false;
      };
    }, [radiusKm, category, activeTab])
  );

  // Load more jobs when end is reached
  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && nextCursor) {
      fetchJobs(false);
    }
  };

  // Fetch seeker applications
  const fetchApplications = useCallback(async () => {
    try {
      setAppsLoading(true);
      const res = await api<ApplicationItem[]>("/applications?role=seeker&kind=job");
      setApplications(res || []);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setAppsLoading(false);
    }
  }, []);

  // 1-Click apply handler
  const handleApplyJob = async (job: Job) => {
    try {
      await api(`/jobs/${job.id}/apply`, {});
      // Immediately reflect applied status locally
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, myApplication: { id: "temp", status: "PENDING" } }
            : j
        )
      );
      Alert.alert(
        "Application Sent!",
        `Your application for "${job.customTitle || job.title}" was submitted. The employer will be notified immediately.`,
        [{ text: "OK" }]
      );
    } catch (err: any) {
      throw new Error(err?.message || "Failed to submit application.");
    }
  };

  // Seeker cancel application handler
  const handleCancelApplicationConfirm = async (reason: string) => {
    if (!cancellingApp) return;
    try {
      await api(`/applications/${cancellingApp.id}/action`, {
        action: "cancel",
        reason,
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === cancellingApp.id
            ? { ...a, status: "CANCELLED_BY_SEEKER", cancellationReason: reason }
            : a
        )
      );
      Alert.alert("Application Cancelled", "Your application has been cancelled.");
    } catch (err: any) {
      throw new Error(err?.message || "Could not cancel application.");
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const lowerQ = searchQuery.toLowerCase().trim();
    const titleMatch = (job.title || "").toLowerCase().includes(lowerQ);
    const customTitleMatch = (job.customTitle || "").toLowerCase().includes(lowerQ);
    const roleMatch = (job.roleName || "").toLowerCase().includes(lowerQ);
    const catMatch = (job.categoryName || "").toLowerCase().includes(lowerQ);
    const areaMatch = (job.area || "").toLowerCase().includes(lowerQ);
    const detailsMatch = (job.details || "").toLowerCase().includes(lowerQ);
    return titleMatch || customTitleMatch || roleMatch || catMatch || areaMatch || detailsMatch;
  });

  const filteredApplications = applications.filter((app) => {
    if (selectedAppFilter === "all") return true;
    if (selectedAppFilter === "CANCELLED") {
      return (
        app.status === "CANCELLED" ||
        app.status === "CANCELLED_BY_SEEKER" ||
        app.status === "CANCELLED_BY_PROVIDER" ||
        app.status === "WITHDRAWN"
      );
    }
    return app.status === selectedAppFilter;
  });

  const handleCallEmployer = (phoneNumber?: string | null) => {
    if (!phoneNumber) {
      Alert.alert("Contact Protected", "Contact numbers are only visible once your application is accepted by the employer.");
      return;
    }
    const clean = phoneNumber.replace(/[^0-9+]/g, "");
    void Linking.openURL(`tel:${clean}`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Top Header */}
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
          onPress={() => router.push({ pathname: "/notifications", params: { role: "seeker" } })}
          style={styles.notifications}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.green} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Main Tab Content */}
      {activeTab === "jobs" ? (
        <View style={{ flex: 1 }}>
          {/* Search bar */}
          <WorkSearchBar query={searchQuery} setQuery={setSearchQuery} />

          {/* Radius Filters: 5 km (default), 10 km, 20 km, 30 km, 40 km, 50 km */}
          <View style={styles.radiusFilters} accessibilityLabel="Job search distance">
            {RADIUS_OPTIONS.map(({ key, label }) => {
              const isSelected = radiusKm === key;
              return (
                <Pressable
                  key={String(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Within ${key} kilometres`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setRadiusKm(key)}
                  style={[styles.radiusButton, isSelected && styles.radiusButtonSelected]}
                >
                  <Text style={[styles.radiusLabel, isSelected && styles.radiusLabelSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Category Filters */}
          <View style={styles.categoryFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilterContent}>
              {CATEGORIES.map(({ id, label }) => {
                const isSelected = category === id;
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${label}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setCategory(id)}
                    style={[styles.categoryButton, isSelected && styles.radiusButtonSelected]}
                  >
                    <Text style={[styles.radiusLabel, isSelected && styles.radiusLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Jobs Discovery Feed with Infinite Scroll */}
          <View style={styles.content}>
            {isLoading && jobs.length === 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </View>
            ) : filteredJobs.length > 0 ? (
              <FlatList
                data={filteredJobs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <JobCard
                    job={item}
                    onViewDetails={(j) => router.push(`/jobs/${j.id}`)}
                    onViewApplications={(j) => setAppsModalJob(j)}
                    onApply={handleApplyJob}
                  />
                )}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => {
                      setIsRefreshing(true);
                      fetchJobs(true).finally(() => setIsRefreshing(false));
                    }}
                    colors={[colors.green]}
                    tintColor={colors.green}
                  />
                }
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
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
                <Ionicons name="briefcase-outline" size={64} color={colors.line} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
                  No jobs found nearby
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
                  Try expanding your search radius to 20 km or 50 km to find more opportunities.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : activeTab === "applications" ? (
        /* Applications Tracking Tab */
        <View style={{ flex: 1 }}>
          <View style={styles.appsHeaderWrap}>
            <Text style={styles.appsScreenTitle}>Your Applications</Text>
            <Text style={styles.appsScreenSubtitle}>
              Track status, unlock employer contacts, and manage active jobs
            </Text>
          </View>

          {/* Status Filter Chips */}
          <View style={styles.appFilterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {APP_STATUS_FILTERS.map((f) => {
                const isSelected = selectedAppFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setSelectedAppFilter(f.id)}
                    style={[styles.appFilterChip, isSelected && styles.appFilterChipSelected]}
                  >
                    <Text style={[styles.appFilterChipText, isSelected && styles.appFilterChipTextSelected]}>
                      {f.label}
                    </Text>
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
            ) : filteredApplications.length > 0 ? (
              <FlatList
                data={filteredApplications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 12 }}
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
                  const isPending = item.status === "PENDING";
                  const isRejected = item.status === "REJECTED";
                  const isCompleted = item.status === "COMPLETED";
                  const isCancelled =
                    item.status === "CANCELLED_BY_SEEKER" ||
                    item.status === "CANCELLED_BY_PROVIDER" ||
                    item.status === "CANCELLED";

                  return (
                    <View style={styles.appCard}>
                      <View style={styles.appCardHeader}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.appCardTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.appCardMeta}>
                            {item.roleName || item.categoryName || "Work"} • ₹{Math.round(item.payPaise / 100)} / {item.payUnit}
                          </Text>
                        </View>
                        {/* Status Badge */}
                        <View
                          style={[
                            styles.appBadge,
                            isAccepted && styles.appBadgeAccepted,
                            isRejected && styles.appBadgeRejected,
                            isCancelled && styles.appBadgeCancelled,
                            isCompleted && styles.appBadgeCompleted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.appBadgeText,
                              isAccepted && styles.appBadgeAcceptedText,
                              isRejected && styles.appBadgeRejectedText,
                              isCancelled && styles.appBadgeCancelledText,
                              isCompleted && styles.appBadgeCompletedText,
                            ]}
                          >
                            {isAccepted
                              ? "Accepted"
                              : isPending
                              ? "Pending Review"
                              : isRejected
                              ? "Rejected"
                              : isCompleted
                              ? "Completed"
                              : "Cancelled"}
                          </Text>
                        </View>
                      </View>

                      {/* Location & Time info */}
                      <View style={styles.appInfoRow}>
                        <Ionicons name="location-outline" size={15} color={colors.muted} />
                        <Text style={styles.appInfoText} numberOfLines={1}>{item.area || "Worksite"}</Text>
                      </View>

                      {/* Contact unlocked section when accepted */}
                      {isAccepted && (
                        <View style={styles.contactUnlockedBox}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                              <Ionicons name="lock-open-outline" size={13} color={colors.green} />
                              <Text style={styles.unlockedHeader}>EMPLOYER CONTACT UNLOCKED</Text>
                            </View>
                            <Text style={styles.employerNameVal}>{item.otherName || "Employer"}</Text>
                            <Text style={styles.employerPhoneVal}>{formatDirectPhone(item.otherPhone) || "Phone available"}</Text>
                          </View>
                          {item.otherPhone ? (
                            <Pressable
                              style={styles.callEmployerBtn}
                              onPress={() => handleCallEmployer(item.otherPhone)}
                            >
                              <Ionicons name="call" size={16} color="#FFFFFF" />
                              <Text style={styles.callEmployerBtnText}>Call</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )}

                      {/* Cancellation context if cancelled */}
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

                      {/* Action buttons */}
                      <View style={styles.appCardActions}>
                        {item.jobId && (
                          <Pressable
                            style={styles.viewJobBtn}
                            onPress={() => router.push(`/jobs/${item.jobId}`)}
                          >
                            <Text style={styles.viewJobBtnText}>View Job Details</Text>
                          </Pressable>
                        )}

                        {isPending && (
                          <Pressable
                            style={styles.withdrawBtn}
                            onPress={() => setCancellingApp(item)}
                          >
                            <Text style={styles.withdrawBtnText}>Withdraw</Text>
                          </Pressable>
                        )}

                        {isAccepted && (
                          <Pressable
                            style={styles.cancelJobBtn}
                            onPress={() => setCancellingApp(item)}
                          >
                            <Text style={styles.cancelJobBtnText}>Cancel Job</Text>
                          </Pressable>
                        )}

                        {isCompleted && !item.reviewed && (
                          <Pressable
                            style={styles.rateBtn}
                            onPress={() => router.push({ pathname: "/requests/[id]", params: { id: item.id, kind: item.kind } })}
                          >
                            <Text style={styles.rateBtnText}>Rate Experience</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
                <Ionicons name="document-text-outline" size={64} color={colors.line} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
                  No applications found
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
                  Explore nearby jobs in the Jobs tab and apply with one tap.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Profile Tab */
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="person-circle-outline" size={72} color={colors.green} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
            Seeker Profile
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 20 }}>
            Manage your personal profile, phone verification, and reliability rating.
          </Text>
          <Pressable
            style={styles.manageProfileBtn}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.manageProfileBtnText}>Go to Full Profile</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom Bar */}
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
                if (tab.key === "home") {
                  router.replace("/(tabs)");
                  return;
                }
                setActiveTab(tab.key);
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
      <JobApplicationsModal
        visible={!!appsModalJob}
        jobId={appsModalJob?.id}
        jobTitle={appsModalJob?.customTitle || appsModalJob?.title}
        initialApplicants={appsModalJob?.applicants}
        initialApplicantCount={appsModalJob?.applicantCount || appsModalJob?.applicants?.length}
        onClose={() => setAppsModalJob(null)}
      />

      {/* Seeker Cancellation Modal */}
      <CancellationModal
        visible={!!cancellingApp}
        title={`Cancel Application: ${cancellingApp?.title || "Job"}`}
        isProvider={false}
        onClose={() => setCancellingApp(null)}
        onConfirm={handleCancelApplicationConfirm}
      />

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
  brand: { width: "25%", minWidth: 0, fontSize: 30, fontWeight: "900", letterSpacing: -1.5, color: colors.green },
  location: { width: "50%", minWidth: 0, minHeight: 48, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  locationName: { flexShrink: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.green },
  notifications: { width: "25%", minWidth: 0, minHeight: 48, alignItems: "flex-end", justifyContent: "center", paddingRight: 4, position: "relative" },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  content: { flex: 1 },
  searchContainer: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  searchBarFocused: { borderColor: colors.green },
  searchInput: { flex: 1, minWidth: 0, paddingLeft: 16, paddingRight: 4, paddingVertical: 14, fontSize: 15, color: colors.ink },
  searchIcon: { width: 48, minHeight: 52, alignItems: "center", justifyContent: "center" },
  radiusFilters: { width: "100%", maxWidth: 680, alignSelf: "center", flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  radiusButton: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  radiusButtonSelected: { backgroundColor: colors.green, borderColor: colors.green },
  radiusLabel: { fontSize: 12.5, fontWeight: "600", color: colors.green },
  radiusLabelSelected: { color: colors.white },
  categoryFilters: { width: "100%", maxWidth: 680, alignSelf: "center", paddingBottom: 12 },
  categoryFilterContent: { paddingHorizontal: 16, gap: 8 },
  categoryButton: { minHeight: 34, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 14,
    marginHorizontal: 16,
  },
  appsHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appsScreenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
  },
  appsScreenSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  appFilterBar: {
    paddingVertical: 8,
  },
  appFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FFFFFF",
  },
  appFilterChipSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  appFilterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  appFilterChipTextSelected: {
    color: "#FFFFFF",
  },
  appCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  appCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  appCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  appCardMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.green,
    marginTop: 2,
  },
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  appBadgeAccepted: {
    backgroundColor: "#DCFCE7",
  },
  appBadgeAcceptedText: {
    color: "#166534",
  },
  appBadgeRejected: {
    backgroundColor: "#FEE2E2",
  },
  appBadgeRejectedText: {
    color: "#DC2626",
  },
  appBadgeCancelled: {
    backgroundColor: "#F1F5F9",
  },
  appBadgeCancelledText: {
    color: "#64748B",
  },
  appBadgeCompleted: {
    backgroundColor: "#DBEAFE",
  },
  appBadgeCompletedText: {
    color: "#1E40AF",
  },
  appInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  appInfoText: {
    fontSize: 13,
    color: colors.muted,
  },
  contactUnlockedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  unlockedHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: 0.5,
  },
  employerNameVal: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  employerPhoneVal: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
    marginTop: 1,
  },
  callEmployerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callEmployerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelledReasonBox: {
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#94A3B8",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  cancelledReasonTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 2,
  },
  cancelledReasonText: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 17,
  },
  appCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  viewJobBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAF5",
  },
  viewJobBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  withdrawBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  withdrawBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  cancelJobBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  cancelJobBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  rateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.green,
  },
  rateBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  manageProfileBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  manageProfileBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
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
  tab: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 3 },
  tabIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  tabLabel: { width: "100%", textAlign: "center", fontSize: 12, fontWeight: "500" },
});

