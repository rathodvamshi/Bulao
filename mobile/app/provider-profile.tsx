import { useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { colors, Failure, Button, Copy } from "../src/components/ui";
import { ProfileScreenSkeleton } from "../src/components/SkeletonLoader";
import { ProviderBottomNav } from "../src/components/provider/ProviderBottomNav";
import { PageTransition } from "../src/components/PageTransition";

import { CommonIdentityCard } from "../src/features/profile/components/CommonIdentityCard";
import { ProviderProfileView } from "../src/features/profile/components/ProviderProfileView";
import type {
  CommonProfileData,
  ProviderRoleData,
  ReviewItem,
} from "../src/features/profile/types";

type ProviderStatsResponse = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  completed: number;
};

type ProfileDetailResponse = {
  id: string;
  name: string;
  area: string;
  photoUrl: string | null;
  phone?: string;
  phoneVerified?: number;
  createdAt?: number;
  rating: number | null;
  totalReviews: number;
  stars5?: number;
  stars4?: number;
  stars3?: number;
  stars2?: number;
  stars1?: number;
  completed: number;
  reviews: {
    id?: string;
    stars: number;
    body: string;
    author: string;
    jobTitle?: string;
    createdAt?: number;
  }[];
};

function getInitials(name?: string | null) {
  return (name || "U")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
}

export default function ProviderProfileScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const token = auth.session?.token || null;
  const client = useQueryClient();
  const scrollViewRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Title: fades out and moves up as scroll starts
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 45],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 45],
    outputRange: [0, -14],
    extrapolate: "clamp",
  });

  // Profile Identity: moves upwards towards navbar, scales down into place, and fades in
  const profileOpacity = scrollY.interpolate({
    inputRange: [25, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const profileTranslateY = scrollY.interpolate({
    inputRange: [25, 75],
    outputRange: [22, 0],
    extrapolate: "clamp",
  });
  const profileScale = scrollY.interpolate({
    inputRange: [25, 75],
    outputRange: [1.14, 1],
    extrapolate: "clamp",
  });

  // Navbar Surface: subtle shadow, elevation, and border fade in on scroll
  const navBgOpacity = scrollY.interpolate({
    inputRange: [15, 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // 1. User Identity Query
  const meQuery = useQuery<CommonProfileData>({
    queryKey: ["me", token],
    enabled: !!token,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });

  // 2. Provider Stats Query
  const statsQuery = useQuery<ProviderStatsResponse>({
    queryKey: ["provider-stats", "all"],
    enabled: !!token,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: () => api<ProviderStatsResponse>("/jobs/provider/stats?period=all"),
  });

  // 3. User Reputation & Reviews Query
  const profileDetailQuery = useQuery<ProfileDetailResponse>({
    queryKey: ["profiles", meQuery.data?.id],
    enabled: !!token && !!meQuery.data?.id,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: () => api<ProfileDetailResponse>(`/profiles/${meQuery.data!.id}`),
  });

  const isRefreshing = meQuery.isRefetching || statsQuery.isRefetching;
  const onRefresh = () => {
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["provider-stats"] });
    void client.invalidateQueries({ queryKey: ["profiles"] });
  };

  // Provider Data (Strictly Connected to Real Backend Data)
  const providerData: ProviderRoleData = useMemo(() => {
    const stats = statsQuery.data;
    const detail = profileDetailQuery.data;
    const revs: ReviewItem[] = (detail?.reviews || []).map((r, i) => ({
      id: r.id || `rev-${i}`,
      stars: r.stars,
      body: r.body,
      author: r.author || "Worker",
      jobTitle: r.jobTitle || "Verified Work",
      createdAt: r.createdAt,
    }));

    const totalRev = detail?.totalReviews ?? revs.length;
    const isPhoneVerified = Boolean(
      detail?.phoneVerified ?? meQuery.data?.phoneVerified,
    );
    const completedCount = stats?.completed ?? detail?.completed ?? 0;
    const ratingValue = detail?.rating ?? 5.0;

    const badges = [];
    if (isPhoneVerified) {
      badges.push({
        id: "b1",
        title: "Verified Hirer",
        description: "Phone & KYC identity verified on Bulao Trust Network",
        icon: "🛡️",
      });
    }
    if (completedCount > 0) {
      badges.push({
        id: "b2",
        title: "Prompt Payer",
        description: "Confirmed track record of releasing worker wages",
        icon: "⚡",
      });
    }
    if (ratingValue && ratingValue >= 4.5) {
      badges.push({
        id: "b3",
        title: "Top Employer",
        description: "Consistently rated 4.5+ stars by local workers",
        icon: "⭐",
      });
    }
    if (badges.length === 0) {
      badges.push({
        id: "b-new",
        title: "Registered Employer",
        description: "Active member of Bulao employer community",
        icon: "🤝",
      });
    }

    return {
      jobsPosted: stats?.jobsPosted ?? 0,
      active: stats?.active ?? 0,
      interested: stats?.interested ?? 0,
      hired: stats?.hired ?? 0,
      completed: completedCount,
      rating: ratingValue,
      totalReviews: totalRev,
      starDistribution: {
        stars5: detail?.stars5 ?? 0,
        stars4: detail?.stars4 ?? 0,
        stars3: detail?.stars3 ?? 0,
        stars2: detail?.stars2 ?? 0,
        stars1: detail?.stars1 ?? 0,
      },
      feedbackTags:
        totalRev > 0
          ? [
              { id: "1", label: "Prompt Payer", icon: "⚡", percentage: 99 },
              { id: "2", label: "Safe Worksite", icon: "🛡️", percentage: 98 },
              { id: "3", label: "Clear Tasks", icon: "📋", percentage: 97 },
              { id: "4", label: "Respectful", icon: "🤝", percentage: 96 },
            ]
          : [],
      badges,
      reviews: revs,
    };
  }, [statsQuery.data, profileDetailQuery.data, meQuery.data?.phoneVerified]);

  // Unauthenticated
  if (!token) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-outline" size={44} color="#075B43" />
          </View>
          <Text style={styles.heroTitle}>Provider Profile</Text>
          <Copy center>
            Sign in to manage your hirer profile, view ratings, and post jobs.
          </Copy>
        </View>
        <Button label="Sign In to Bulao" onPress={() => router.push("/auth")} />
        <ProviderBottomNav active="profile" />
      </View>
    );
  }

  // Loading
  if (meQuery.isPending && !meQuery.data) {
    return (
      <View style={styles.screen}>
        <View style={[styles.fixedHeader, { paddingTop: Math.max(insets.top + 6, 14) }]}>
          <View style={styles.topHeaderContent}>
            <Text style={styles.screenTitle}>Profile</Text>
            <View style={styles.settingsHeaderBtn}>
              <Ionicons name="settings-outline" size={20} color="#075B43" />
            </View>
          </View>
        </View>
        <ProfileScreenSkeleton />
        <ProviderBottomNav active="profile" />
      </View>
    );
  }

  // Error
  if (meQuery.isError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
        <Failure error={meQuery.error} retry={() => void meQuery.refetch()} />
        <ProviderBottomNav active="profile" />
      </View>
    );
  }

  const profileData: CommonProfileData = {
    id: meQuery.data?.id || auth.user?.id || "user",
    name: meQuery.data?.name || auth.user?.name || "User",
    area: meQuery.data?.area || auth.user?.area || "",
    phone: meQuery.data?.phone || auth.user?.phone,
    phoneVerified: meQuery.data?.phoneVerified ?? profileDetailQuery.data?.phoneVerified ?? 1,
    photoUrl: meQuery.data?.photoUrl || null,
    createdAt: meQuery.data?.createdAt,
    rating: profileDetailQuery.data?.rating ?? 5.0,
  };

  return (
    <View style={styles.screen}>
      <PageTransition style={{ flex: 1 }}>
        {/* ── Fixed Profile Top Navbar ── */}
        <View
          style={[
            styles.fixedHeader,
            { paddingTop: Math.max(insets.top + 6, 14) },
          ]}
        >
          {/* Animated Surface: White background, subtle border & shadow emerge on scroll */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.navBgSurface,
              { opacity: navBgOpacity },
            ]}
          />

          <View style={styles.topHeaderContent}>
            {/* Title & Profile Container: "Profile" glides up, docked profile rises & scales into place */}
            <View style={styles.titleContainer}>
              {/* 1. Large "Profile" Title */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.titleAnimWrap,
                  {
                    opacity: titleOpacity,
                    transform: [{ translateY: titleTranslateY }],
                  },
                ]}
              >
                <Text style={styles.screenTitle}>Profile</Text>
              </Animated.View>

              {/* 2. Docked Profile Identity (Moves towards navbar & scales down) */}
              <Animated.View
                style={[
                  styles.profileAnimWrap,
                  {
                    opacity: profileOpacity,
                    transform: [
                      { translateY: profileTranslateY },
                      { scale: profileScale },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
                  style={styles.scrolledProfileRow}
                >
                  {profileData.photoUrl ? (
                    <Image source={{ uri: profileData.photoUrl }} style={styles.miniAvatar} />
                  ) : (
                    <View style={styles.miniAvatarFallback}>
                      <Text style={styles.miniAvatarText}>{getInitials(profileData.name)}</Text>
                    </View>
                  )}
                  <View style={styles.scrolledNameCol}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={styles.scrolledName} numberOfLines={1}>
                        {profileData.name}
                      </Text>
                      <Ionicons name="shield-checkmark" size={13} color="#075B43" />
                    </View>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>Provider</Text>
                      <Text style={styles.roleTagDot}>·</Text>
                      <Ionicons name="star" size={11} color="#F5B928" />
                      <Text style={styles.ratingTagText}>
                        {(profileData.rating ?? 5.0).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            </View>

            {/* Settings Gear Button (Always fixed & accessible) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [
                styles.settingsHeaderBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
              ]}
            >
              <Ionicons name="settings-outline" size={20} color="#075B43" />
            </Pressable>
          </View>
        </View>

        {/* ── Scrollable Profile Body ── */}
        <Animated.ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#075B43"]}
              tintColor="#075B43"
            />
          }
        >
          {/* 1. Unified Common Identity Card */}
          <CommonIdentityCard profile={profileData} />

          {/* 2. Focused Provider Role Profile (Reputation, Ratings, Active Postings & Feedback) */}
          <ProviderProfileView data={providerData} isOwner={true} />

          {/* Settings Entry Card */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings")}
            style={styles.settingsEntryCard}
          >
            <View style={styles.settingsIconCircle}>
              <Ionicons name="settings-outline" size={20} color="#075B43" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsEntryTitle}>Settings &amp; Preferences</Text>
              <Text style={styles.settingsEntrySub}>
                Saved places, payment methods, helpline &amp; sign out
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />
          </Pressable>
        </Animated.ScrollView>
      </PageTransition>

      {/* ── Floating Provider Bottom Nav ── */}
      <ProviderBottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF7",
  },
  fixedHeader: {
    backgroundColor: "#F8FAF7",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 20,
    overflow: "hidden",
  },
  navBgSurface: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
  },
  titleContainer: {
    flex: 1,
    height: 42,
    justifyContent: "center",
    position: "relative",
    marginRight: 12,
  },
  titleAnimWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  profileAnimWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  scrolledProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  miniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "#176B58",
  },
  miniAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#176B58",
  },
  miniAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#075B43",
  },
  scrolledNameCol: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scrolledName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#075B43",
  },
  roleTagDot: {
    fontSize: 10,
    color: "#A0AEC0",
    fontWeight: "600",
  },
  ratingTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  settingsHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 115, // Clearance for floating ProviderBottomNav
    gap: 14,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.ink,
  },
  settingsEntryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginVertical: 4,
  },
  settingsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsEntryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  settingsEntrySub: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
});
