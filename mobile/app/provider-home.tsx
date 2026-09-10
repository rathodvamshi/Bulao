import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../src/components/ui";
import { useLocation } from "../src/store/location";
import { useAuth } from "../src/auth";
import { api } from "../src/api/client";
import { YourHiringsSkeleton, RecentJobsSkeleton } from "../src/components/SkeletonLoader";

type ProviderStats = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  completed: number;
};

type RecentJob = {
  id: string;
  title: string;
  categoryName: string;
  area: string;
  distance?: string;
  payPaise: number;
  payUnit: string;
  status: string;
  applicantCount: number;
};

export default function ProviderHomeScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F7FAF7" }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <TopHeader />
        <HeroSection />
        <YourHiringsSection />
        <RecentJobsSection />
        <BottomImageSection />
      </ScrollView>
      <BottomNavigation />
    </SafeAreaView>
  );
}

// ─── Top Header Component ─────────────────────────────────────────────────────
function TopHeader() {
  const location = useLocation((x) => x.location);

  return (
    <View
      style={{
        height: 80,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left - Bulao Brand (takes only needed space) */}
      <View style={{ minWidth: 80 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "900",
            letterSpacing: -1.8,
            color: colors.green,
            lineHeight: 36,
          }}
        >
          Bulao
        </Text>
        <Text
          style={{
            fontSize: 9,
            color: colors.muted,
            marginTop: 0,
            letterSpacing: 0.3,
          }}
        >
          Good things are nearby
        </Text>
      </View>

      {/* Center - Location (absolutely centered) */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          pointerEvents: "box-none",
        }}
      >
        <Pressable
          onPress={() => router.push("/location")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#E8F5EE",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "#C8E87A",
            minHeight: 42,
            maxWidth: 200,
          }}
        >
          <Ionicons name="location-outline" size={16} color={colors.green} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.green,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {location?.area || "Choose location"}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted }}>˅</Text>
        </Pressable>
      </View>

      {/* Right - Notification (takes only needed space) */}
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>
        <Pressable
          onPress={() => router.push("/activity")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.green} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Hero Section Component ───────────────────────────────────────────────────
function HeroSection() {
  const auth = useAuth();
  const userName = auth.user?.name || "Guest";

  return (
    <View
      style={{
        width: "100%",
        marginTop: 0,
      }}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={require("../assets/images/provider/provider_hero_image.png")}
          style={{
            width: "100%",
            height: undefined,
            aspectRatio: 2.2,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
          resizeMode="cover"
        />
        
        {/* Greeting Text Overlay */}
        <View
          style={{
            position: "absolute",
            top: 11,
            left: 16,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: "#1A1A1A",
              letterSpacing: -0.5,
              textShadowColor: "rgba(255, 255, 255, 0.3)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            Hello {userName}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Your Hirings Section Component ───────────────────────────────────────────
function YourHiringsSection() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  
  const { data: stats, isLoading, isError, error } = useQuery<ProviderStats>({
    queryKey: ["provider-stats"],
    queryFn: () => api<ProviderStats>("/jobs/provider/stats"),
    enabled: !!token,
    retry: 1,
  });

  const statsData = [
    { label: "Jobs Posted", value: stats?.jobsPosted || 0, color: "#E3F2FD", filter: "posted" },
    { label: "Active", value: stats?.active || 0, color: "#FFF9E6", filter: "active" },
    { label: "Interested", value: stats?.interested || 0, color: "#F3E5F5", filter: "interested" },
    { label: "Hired", value: stats?.hired || 0, color: "#E8F5E9", filter: "hired" },
    { label: "Completed", value: stats?.completed || 0, color: "#FFE8E8", filter: "completed" },
  ];

  if (isError) {
    return (
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink }}>Your Hirings</Text>
        </View>
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 24, alignItems: "center" }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedLight} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 12 }}>
            Could not load stats
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8 }}>
            {error instanceof Error ? error.message : "Please try again later"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: colors.ink,
          }}
        >
          Your Hirings
        </Text>
        <Pressable onPress={() => router.push("/activity")}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.green,
            }}
          >
            See all →
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <YourHiringsSkeleton />
      ) : (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {statsData.map((stat, index) => (
            <Pressable
              key={index}
              onPress={() => router.push(`/activity?filter=${stat.filter}`)}
              style={{
                backgroundColor: stat.color,
                borderRadius: 14,
                paddingTop: 12,
                paddingHorizontal: 12,
                paddingBottom: 8,
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 85,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: colors.ink,
                }}
              >
                {stat.value}
              </Text>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "600",
                  color: colors.muted,
                  textAlign: "center",
                  lineHeight: 13,
                  marginTop: 6,
                }}
                numberOfLines={2}
              >
                {stat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Recent Jobs Section Component ────────────────────────────────────────────
function RecentJobsSection() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  
  const { data: jobs, isLoading, isError, error } = useQuery<RecentJob[]>({
    queryKey: ["provider-recent-jobs"],
    queryFn: () => api<RecentJob[]>("/jobs/provider/recent"),
    enabled: !!token,
    retry: 1,
  });

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "PUBLISHED":
        return "#4CAF50";
      case "PAUSED":
        return "#FF9800";
      case "FILLED":
        return "#2196F3";
      case "COMPLETED":
        return "#9C27B0";
      default:
        return colors.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case "PUBLISHED":
        return "Open";
      case "PAUSED":
        return "Paused";
      case "FILLED":
        return "Filled";
      case "COMPLETED":
        return "Done";
      default:
        return status;
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: colors.ink,
          }}
        >
          Recent Jobs
        </Text>
        <Pressable onPress={() => router.push("/activity")}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.green,
            }}
          >
            See all →
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <RecentJobsSkeleton count={3} />
      ) : isError ? (
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 24, alignItems: "center" }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedLight} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 12 }}>
            Could not load jobs
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8 }}>
            {error instanceof Error ? error.message : "Please try again later"}
          </Text>
        </View>
      ) : jobs && jobs.length > 0 ? (
        <View style={{ gap: 12 }}>
          {jobs.slice(0, 5).map((job) => (
            <Pressable
              key={job.id}
              onPress={() => router.push(`/jobs/${job.id}`)}
              style={({ pressed }) => ({
                backgroundColor: colors.white,
                borderRadius: 18,
                padding: 14,
                flexDirection: "row",
                gap: 14,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                opacity: pressed ? 0.95 : 1,
              })}
            >
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 12,
                  backgroundColor: "#E8F5EE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="construct-outline" size={28} color={colors.green} />
              </View>

              <View style={{ flex: 1, justifyContent: "space-between" }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.ink,
                  }}
                  numberOfLines={1}
                >
                  {job.title}
                </Text>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
                    📍 {job.area}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: "#E8F5EE",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.green,
                        }}
                      >
                        {job.categoryName}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: getStatusColor(job.status),
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: getStatusColor(job.status),
                        }}
                      >
                        {getStatusLabel(job.status)}
                      </Text>
                    </View>

                    {job.applicantCount > 0 && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {job.applicantCount} interested
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 18,
            padding: 24,
            alignItems: "center",
          }}
        >
          <Ionicons name="briefcase-outline" size={48} color={colors.mutedLight} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.ink,
              marginTop: 12,
            }}
          >
            No jobs yet
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Post your first job to find help nearby
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Bottom Image Section Component ───────────────────────────────────────────
function BottomImageSection() {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        marginTop: 32,
        width: "100%",
      }}
    >
      <View
        style={{
          width: "100%",
          height: 100,
          backgroundColor: "#F7FAF7",
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#E0E0E0",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={require("../assets/images/provider/provider_bottom_image.png")}
          style={{
            width: "100%",
            height: undefined,
            aspectRatio: 2.2,
          }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

// ─── Bottom Navigation Component ──────────────────────────────────────────────
function BottomNavigation() {
  const navItems = [
    { id: "bulao", label: "Bulao", icon: "home-outline", path: "/" },
    { id: "home", label: "Home", icon: "briefcase-outline", path: "/provider-home" },
    { id: "post", label: "Post Job", icon: "add", path: "/post-work", isCenter: true },
    { id: "activity", label: "Activity", icon: "list-outline", path: "/activity" },
    { id: "profile", label: "Profile", icon: "person-outline", path: "/profile" },
  ];

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingBottom: 20,
        paddingTop: 12,
        paddingHorizontal: 8,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
      }}
    >
      {navItems.map((item) => {
        const isActive = item.id === "home";

        if (item.isCenter) {
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.path)}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.green,
                alignItems: "center",
                justifyContent: "center",
                marginTop: -28,
                shadowColor: colors.green,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Ionicons name="add" size={32} color={colors.white} />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.path)}
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              minWidth: 60,
            }}
          >
            <Ionicons
              name={item.icon as any}
              size={24}
              color={isActive ? colors.green : colors.mutedLight}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: isActive ? "700" : "600",
                color: isActive ? colors.green : colors.mutedLight,
                marginTop: 4,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
