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
import { getExactRoleIcon } from "../src/utils/nameVerification";

type ProviderStats = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  completed: number;
};

type RecentJob = {
  id: string;
  roleId?: string;
  categoryId?: string;
  title: string;
  categoryName: string;
  area: string;
  distance?: string;
  payPaise: number;
  payUnit: string;
  status: string;
  createdAt?: string | number;
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

function formatPayUnit(unit?: string): string {
  if (!unit) return "fixed";
  switch (unit.toUpperCase()) {
    case "HOUR":
      return "hr";
    case "DAY":
      return "day";
    case "MONTH":
      return "mo";
    case "FIXED":
      return "fixed";
    default:
      return unit.toLowerCase();
  }
}

function formatRelativeTime(timestamp?: string | number): string {
  if (!timestamp) return "";
  const time =
    typeof timestamp === "string"
      ? new Date(timestamp).getTime()
      : timestamp * (timestamp < 1e11 ? 1000 : 1);
  if (isNaN(time)) return "";
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function getJobStatusMeta(status: string) {
  switch (status?.toUpperCase()) {
    case "PUBLISHED":
      return {
        label: "Active",
        dotColor: "#10B981",
        textColor: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
      };
    case "PAUSED":
      return {
        label: "Paused",
        dotColor: "#F59E0B",
        textColor: "#D97706",
        bgColor: "#FFFBEB",
        borderColor: "#FDE68A",
      };
    case "FILLED":
      return {
        label: "Hired",
        dotColor: "#3B82F6",
        textColor: "#2563EB",
        bgColor: "#EFF6FF",
        borderColor: "#BFDBFE",
      };
    case "COMPLETED":
      return {
        label: "Done",
        dotColor: "#8B5CF6",
        textColor: "#7C3AED",
        bgColor: "#F5F3FF",
        borderColor: "#DDD6FE",
      };
    default:
      return {
        label: status || "Open",
        dotColor: colors.muted,
        textColor: colors.ink,
        bgColor: "#F3F4F6",
        borderColor: "#E5E7EB",
      };
  }
}

function getRoleTheme(roleId?: string, roleName?: string, categoryId?: string) {
  const name = (roleName || "").toLowerCase();
  const cat = (categoryId || "").toLowerCase();
  const rId = (roleId || "").toLowerCase();

  if (name.includes("electr") || name.includes("wire") || rId.includes("electr")) {
    return { bg: "#FEF3C7", border: "#FDE68A", icon: "⚡" };
  }
  if (name.includes("plumb") || name.includes("pipe") || rId.includes("plumb")) {
    return { bg: "#E0F2FE", border: "#BAE6FD", icon: "🔧" };
  }
  if (name.includes("carpent") || name.includes("wood") || rId.includes("carpent")) {
    return { bg: "#FFEDD5", border: "#FED7AA", icon: "🪚" };
  }
  if (name.includes("cook") || name.includes("chef") || cat.includes("food") || rId.includes("cook")) {
    return { bg: "#FFF7ED", border: "#FFEDD5", icon: "🍳" };
  }
  if (name.includes("paint") || rId.includes("paint")) {
    return { bg: "#FCE7F3", border: "#FBCFE8", icon: "🎨" };
  }
  if (name.includes("clean") || name.includes("maid") || name.includes("housekeep") || rId.includes("clean")) {
    return { bg: "#E8F5EE", border: "#C8E87A", icon: "🧹" };
  }
  if (name.includes("mason") || name.includes("brick") || cat.includes("construction") || rId.includes("mason")) {
    return { bg: "#F5F5F4", border: "#E7E5E4", icon: "🏗️" };
  }
  if (name.includes("driv") || name.includes("cab") || name.includes("ride") || cat.includes("transport") || rId.includes("driver")) {
    return { bg: "#CFFAFE", border: "#A5F3FC", icon: "🚗" };
  }
  if (name.includes("guard") || name.includes("secur") || rId.includes("guard")) {
    return { bg: "#EDE9FE", border: "#DDD6FE", icon: "🛡️" };
  }
  return {
    bg: "#ECFDF5",
    border: "#C8E87A",
    icon: getExactRoleIcon(roleId || "", roleName || "", categoryId),
  };
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

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
      {/* Section Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.5,
              color: colors.ink,
            }}
          >
            Recent Jobs
          </Text>
          {jobs && jobs.length > 0 && (
            <View
              style={{
                backgroundColor: "#E8F5EE",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: "#C8E87A",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.green }}>
                {jobs.length} Active
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/activity")}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: "#F0FDF4",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.green,
            }}
          >
            See all
          </Text>
          <Ionicons name="arrow-forward" size={12} color={colors.green} />
        </Pressable>
      </View>

      {isLoading ? (
        <RecentJobsSkeleton count={3} />
      ) : isError ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#FEE2E2",
          }}
        >
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 10 }}>
            Could not load jobs
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 4 }}>
            {error instanceof Error ? error.message : "Please try again later"}
          </Text>
        </View>
      ) : jobs && jobs.length > 0 ? (
        <View style={{ gap: 14 }}>
          {jobs.slice(0, 5).map((job) => {
            const statusMeta = getJobStatusMeta(job.status);
            const roleTheme = getRoleTheme(
              job.roleId,
              job.title,
              job.categoryName || job.categoryId
            );

            return (
              <Pressable
                key={job.id}
                onPress={() => router.push(`/jobs/${job.id}`)}
                style={({ pressed }) => ({
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 15,
                  borderWidth: 1.5,
                  borderColor: "#E2ECE6",
                  shadowColor: "#0F291E",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  elevation: 3,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                  gap: 12,
                })}
              >
                {/* Top Row: Squircle Role Icon + Title/Location + Status Pill */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  {/* Category/Role Icon Container */}
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 15,
                      backgroundColor: roleTheme.bg,
                      borderWidth: 1.5,
                      borderColor: roleTheme.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 25 }}>{roleTheme.icon}</Text>
                  </View>

                  {/* Title and Area */}
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "800",
                        color: "#0F1F14",
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {job.title}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <Ionicons name="location" size={13} color={colors.green} />
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: "#4B5563",
                          fontWeight: "600",
                          maxWidth: "60%",
                        }}
                        numberOfLines={1}
                      >
                        {job.area || "Nearby"}
                      </Text>
                      {!!job.createdAt && (
                        <>
                          <Text style={{ fontSize: 10, color: "#9CA3AF" }}>•</Text>
                          <Text style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: "500" }}>
                            {formatRelativeTime(job.createdAt)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Status Pill */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 9,
                      paddingVertical: 4.5,
                      borderRadius: 20,
                      backgroundColor: statusMeta.bgColor,
                      borderWidth: 1,
                      borderColor: statusMeta.borderColor,
                    }}
                  >
                    <View
                      style={{
                        width: 6.5,
                        height: 6.5,
                        borderRadius: 3.5,
                        backgroundColor: statusMeta.dotColor,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: statusMeta.textColor,
                        letterSpacing: 0.2,
                      }}
                    >
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Bottom Highlight Strip */}
                <View
                  style={{
                    backgroundColor: "#F7FAF8",
                    borderRadius: 13,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1,
                    borderColor: "#EAF0EC",
                  }}
                >
                  {/* Pay Pill */}
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>
                      Pay:
                    </Text>
                    <Text style={{ fontSize: 14.5, fontWeight: "900", color: colors.green }}>
                      ₹{((job.payPaise || 0) / 100).toLocaleString("en-IN")}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                      /{formatPayUnit(job.payUnit)}
                    </Text>
                  </View>

                  {/* Center Vertical Divider */}
                  <View style={{ width: 1, height: 14, backgroundColor: "#E0EAE3" }} />

                  {/* Applicants / Interested Badge */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {job.applicantCount > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3.5,
                          backgroundColor: "#EEF2FF",
                          paddingHorizontal: 7,
                          paddingVertical: 2.5,
                          borderRadius: 7,
                        }}
                      >
                        <Ionicons name="people" size={12} color="#4F46E5" />
                        <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#4338CA" }}>
                          {job.applicantCount} Interested
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3.5,
                          backgroundColor: "#F1F5F9",
                          paddingHorizontal: 7,
                          paddingVertical: 2.5,
                          borderRadius: 7,
                        }}
                      >
                        <Ionicons name="radio-outline" size={11} color="#64748B" />
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748B" }}>
                          Finding workers
                        </Text>
                      </View>
                    )}

                    {/* Circular forward arrow */}
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "#E5ECE7",
                      }}
                    >
                      <Ionicons name="chevron-forward" size={12} color={colors.green} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: "#EAEFEA",
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#F0FDF4",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "#DCFCE7",
            }}
          >
            <Text style={{ fontSize: 26 }}>💼</Text>
          </View>
          <Text
            style={{
              fontSize: 16.5,
              fontWeight: "800",
              color: colors.ink,
              textAlign: "center",
            }}
          >
            No active jobs posted
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.muted,
              textAlign: "center",
              marginTop: 4,
              marginBottom: 16,
              lineHeight: 18,
              paddingHorizontal: 16,
            }}
          >
            Post work to quickly connect with trusted and verified workers nearby.
          </Text>
          <Pressable
            onPress={() => router.push("/post-work")}
            style={({ pressed }) => ({
              backgroundColor: colors.green,
              paddingHorizontal: 22,
              paddingVertical: 11,
              borderRadius: 14,
              opacity: pressed ? 0.9 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              shadowColor: colors.green,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 4,
            })}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 14, fontWeight: "800" }}>
              Post a Job
            </Text>
          </Pressable>
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
