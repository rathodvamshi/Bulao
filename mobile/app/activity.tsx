import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Copy, colors } from "../src/components/ui";
import { api } from "../src/api/client";
import { getExactRoleIcon } from "../src/utils/nameVerification";

type Applicant = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

type Job = {
  id: string;
  roleId?: string;
  categoryId?: string;
  title: string;
  categoryName: string;
  area: string;
  payPaise: number;
  payUnit: string;
  status: string;
  applicantCount: number;
  createdAt?: number | string;
  startsAt?: number;
  applicants?: Applicant[];
};

type Interaction = {
  id: string;
  jobId: string;
  jobTitle: string;
  area: string;
  status: string;
  createdAt: number;
};

const AVATAR_PALETTES = [
  { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  { bg: "#FCE7F3", text: "#BE185D", border: "#FBCFE8" },
  { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" },
  { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
];

function getAvatarPalette(key: string): { bg: string; text: string; border: string } {
  let hash = 0;
  for (let i = 0; i < (key || "").length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] ?? AVATAR_PALETTES[0]!;
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

function ApplicantAvatarStack({
  applicants = [],
  totalCount = 0,
}: {
  applicants?: Applicant[];
  totalCount: number;
}) {
  const displayApplicants = applicants.slice(0, 3);
  const remaining = Math.max(0, totalCount - displayApplicants.length);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {displayApplicants.map((app, index) => {
          const palette = getAvatarPalette(app.id || app.name || `${index}`);
          const initial = (app.name || "W").trim().charAt(0).toUpperCase();

          return (
            <View
              key={app.id || index}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: palette.bg,
                borderWidth: 2,
                borderColor: "#FFFFFF",
                marginLeft: index === 0 ? 0 : -10,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
                zIndex: 10 - index,
              }}
            >
              {app.photoUrl ? (
                <Image
                  source={{ uri: app.photoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: palette.text,
                  }}
                >
                  {initial}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {remaining > 0 && (
        <View
          style={{
            marginLeft: -8,
            backgroundColor: "#EEF2FF",
            paddingHorizontal: 7,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            zIndex: 1,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#4F46E5" }}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [activeTab, setActiveTab] = useState<"posted" | "applied">("posted");

  return (
    <Screen title="Activity" back>
      {/* Top Main Tab Toggle */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Pressable
          onPress={() => setActiveTab("posted")}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: activeTab === "posted" ? colors.green : colors.white,
            borderWidth: 1.5,
            borderColor: activeTab === "posted" ? colors.green : "#E2ECE6",
            shadowColor: activeTab === "posted" ? colors.green : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: activeTab === "posted" ? 0.2 : 0.03,
            shadowRadius: 6,
            elevation: activeTab === "posted" ? 3 : 1,
          }}
        >
          <Text
            style={{
              fontSize: 14.5,
              fontWeight: "800",
              color: activeTab === "posted" ? colors.white : colors.ink,
              textAlign: "center",
            }}
          >
            Jobs Posted
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("applied")}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: activeTab === "applied" ? colors.green : colors.white,
            borderWidth: 1.5,
            borderColor: activeTab === "applied" ? colors.green : "#E2ECE6",
            shadowColor: activeTab === "applied" ? colors.green : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: activeTab === "applied" ? 0.2 : 0.03,
            shadowRadius: 6,
            elevation: activeTab === "applied" ? 3 : 1,
          }}
        >
          <Text
            style={{
              fontSize: 14.5,
              fontWeight: "800",
              color: activeTab === "applied" ? colors.white : colors.ink,
              textAlign: "center",
            }}
          >
            Applications
          </Text>
        </Pressable>
      </View>

      {activeTab === "posted" ? <PostedJobsTab initialFilter={params.filter} /> : <ApplicationsTab />}
    </Screen>
  );
}

function PostedJobsTab({ initialFilter }: { initialFilter?: string }) {
  const [selectedFilter, setSelectedFilter] = useState<string>(initialFilter || "all");

  const { data: jobs, isLoading, error } = useQuery<Job[]>({
    queryKey: ["my-jobs"],
    queryFn: () => api<Job[]>("/jobs/provider/recent"),
  });

  const filterOptions = [
    { key: "all", label: "All" },
    { key: "active", label: "🟢 Active" },
    { key: "interested", label: "👥 With Applicants" },
    { key: "hired", label: "🤝 Hired" },
    { key: "completed", label: "✓ Done" },
  ];

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 50, alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          backgroundColor: "#FEF2F2",
          padding: 18,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#FEE2E2",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#991B1B", marginTop: 8 }}>
          Failed to load jobs
        </Text>
        <Text style={{ fontSize: 13, color: "#B91C1C", textAlign: "center", marginTop: 4 }}>
          Please check your connection and try again.
        </Text>
      </View>
    );
  }

  const filteredJobs = jobs?.filter((job) => {
    if (selectedFilter === "active") return job.status === "PUBLISHED";
    if (selectedFilter === "interested") return (job.applicantCount || 0) > 0;
    if (selectedFilter === "hired") return job.status === "FILLED";
    if (selectedFilter === "completed") return job.status === "COMPLETED";
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Quick Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
      >
        {filterOptions.map((opt) => {
          const isSelected = selectedFilter === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelectedFilter(opt.key)}
              style={{
                backgroundColor: isSelected ? colors.ink : colors.white,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isSelected ? colors.ink : "#E2ECE6",
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  color: isSelected ? colors.white : "#4B5563",
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Jobs List */}
      {!filteredJobs || filteredJobs.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.white,
            padding: 30,
            borderRadius: 22,
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: "#EAEFEA",
            marginTop: 10,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: "#F0FDF4",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#DCFCE7",
            }}
          >
            <Text style={{ fontSize: 28 }}>💼</Text>
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: colors.ink,
              textAlign: "center",
            }}
          >
            {selectedFilter !== "all" ? `No ${selectedFilter} jobs found` : "No jobs posted yet"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.muted,
              textAlign: "center",
              marginTop: 6,
              lineHeight: 18,
              paddingHorizontal: 20,
            }}
          >
            {selectedFilter !== "all"
              ? "Try switching to a different filter above."
              : "Post a job to get matched with skilled workers nearby in minutes."}
          </Text>
          {selectedFilter === "all" && (
            <Pressable
              onPress={() => router.push("/post-work")}
              style={({ pressed }) => ({
                backgroundColor: colors.green,
                paddingHorizontal: 22,
                paddingVertical: 11,
                borderRadius: 14,
                marginTop: 16,
                opacity: pressed ? 0.9 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 14, fontWeight: "800" }}>
                Post a Job
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={{ gap: 14 }}>
            {filteredJobs.map((job) => {
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
                    borderRadius: 22,
                    padding: 16,
                    borderWidth: 1.5,
                    borderColor: "#E2ECE6",
                    shadowColor: "#0F291E",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 12,
                    elevation: 3,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                    gap: 14,
                  })}
                >
                  {/* Top Row: Squircle Role Icon + Title/Location + Status Pill */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    {/* Squircle Role Icon */}
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        backgroundColor: roleTheme.bg,
                        borderWidth: 1.5,
                        borderColor: roleTheme.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>{roleTheme.icon}</Text>
                    </View>

                    {/* Title, Locality & Time */}
                    <View style={{ flex: 1, justifyContent: "center" }}>
                      <Text
                        style={{
                          fontSize: 16.5,
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

                  {/* Rate & Category Badges Row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 2,
                    }}
                  >
                    {/* Offered Pay Pill */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 2,
                        backgroundColor: "#F0FDF4",
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 9,
                        borderWidth: 0.5,
                        borderColor: "#BBF7D0",
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#166534" }}>
                        Pay:
                      </Text>
                      <Text style={{ fontSize: 14.5, fontWeight: "900", color: colors.green }}>
                        ₹{((job.payPaise || 0) / 100).toLocaleString("en-IN")}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                        /{formatPayUnit(job.payUnit)}
                      </Text>
                    </View>

                    {/* Category Pill */}
                    {!!job.categoryName && (
                      <View
                        style={{
                          backgroundColor: "#F8FAFC",
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 9,
                          borderWidth: 0.5,
                          borderColor: "#E2E8F0",
                        }}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#64748B" }}>
                          {job.categoryName}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Dedicated Applications Banner with Avatars & Count */}
                  <View
                    style={{
                      backgroundColor: (job.applicantCount || 0) > 0 ? "#F5F7FF" : "#F8FAF8",
                      borderRadius: 14,
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: (job.applicantCount || 0) > 0 ? "#E0E7FF" : "#EAF0EC",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {(job.applicantCount || 0) > 0 ? (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          {/* Avatar stack */}
                          <ApplicantAvatarStack
                            applicants={job.applicants}
                            totalCount={job.applicantCount}
                          />
                          <View>
                            <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#3730A3" }}>
                              {job.applicantCount} {job.applicantCount === 1 ? "Worker Applied" : "Workers Applied"}
                            </Text>
                            <Text style={{ fontSize: 11, color: "#6366F1", fontWeight: "600" }}>
                              Tap to view profiles
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            backgroundColor: "#FFFFFF",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#C7D2FE",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#4F46E5" }}>
                            Review
                          </Text>
                          <Ionicons name="chevron-forward" size={12} color="#4F46E5" />
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: "#E8F5EE",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="radio-outline" size={14} color={colors.green} />
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B" }}>
                            Live listing • Awaiting applications
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={14} color={colors.mutedLight} />
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ApplicationsTab() {
  const { data: applications, isLoading } = useQuery<Interaction[]>({
    queryKey: ["my-applications"],
    queryFn: async () => {
      return [];
    },
  });

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.white,
        padding: 30,
        borderRadius: 22,
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#EAEFEA",
        marginTop: 10,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "#F0FDF4",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          borderWidth: 1,
          borderColor: "#DCFCE7",
        }}
      >
        <Ionicons name="document-text-outline" size={30} color={colors.green} />
      </View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "800",
          color: colors.ink,
          textAlign: "center",
        }}
      >
        No applications yet
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.muted,
          textAlign: "center",
          marginTop: 6,
          lineHeight: 18,
          paddingHorizontal: 20,
        }}
      >
        Your job applications and work requests will appear here with live tracking.
      </Text>
    </View>
  );
}
