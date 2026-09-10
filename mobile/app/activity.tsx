import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Copy, colors } from "../src/components/ui";
import { api } from "../src/api/client";

type Job = {
  id: string;
  title: string;
  categoryName: string;
  area: string;
  payPaise: number;
  payUnit: string;
  status: string;
  applicantCount: number;
  startsAt: number;
};

type Interaction = {
  id: string;
  jobId: string;
  jobTitle: string;
  area: string;
  status: string;
  createdAt: number;
};

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [activeTab, setActiveTab] = useState<"posted" | "applied">("posted");

  return (
    <Screen title="Activity" back>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Pressable
          onPress={() => setActiveTab("posted")}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: activeTab === "posted" ? colors.green : colors.white,
            borderWidth: 1,
            borderColor: activeTab === "posted" ? colors.green : colors.line,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
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
            borderRadius: 12,
            backgroundColor: activeTab === "applied" ? colors.green : colors.white,
            borderWidth: 1,
            borderColor: activeTab === "applied" ? colors.green : colors.line,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: activeTab === "applied" ? colors.white : colors.ink,
              textAlign: "center",
            }}
          >
            Applications
          </Text>
        </Pressable>
      </View>

      {activeTab === "posted" ? <PostedJobsTab filter={params.filter} /> : <ApplicationsTab />}
    </Screen>
  );
}

function PostedJobsTab({ filter }: { filter?: string }) {
  const { data: jobs, isLoading, error } = useQuery<Job[]>({
    queryKey: ["my-jobs"],
    queryFn: () => api<Job[]>("/jobs/provider/recent"),
  });

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          backgroundColor: colors.errorBg,
          padding: 16,
          borderRadius: 12,
        }}
      >
        <Copy>Failed to load jobs. Please try again.</Copy>
      </View>
    );
  }

  const filteredJobs = filter
    ? jobs?.filter((job) => {
        if (filter === "active") return job.status === "PUBLISHED";
        if (filter === "interested") return job.applicantCount > 0;
        if (filter === "hired") return job.status === "FILLED";
        if (filter === "completed") return job.status === "COMPLETED";
        return true;
      })
    : jobs;

  if (!filteredJobs || filteredJobs.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.white,
          padding: 24,
          borderRadius: 18,
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
          No jobs found
        </Text>
        <Copy center small style={{ marginTop: 8 }}>
          {filter ? `No ${filter} jobs` : "Post your first job to get started"}
        </Copy>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ gap: 12 }}>
        {filteredJobs.map((job) => (
          <Pressable
            key={job.id}
            onPress={() => router.push(`/jobs/${job.id}`)}
            style={({ pressed }) => ({
              backgroundColor: colors.white,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.ink,
                  flex: 1,
                }}
                numberOfLines={2}
              >
                {job.title}
              </Text>
              <StatusBadge status={job.status} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                📍 {job.area}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.green }}>
                  ₹{job.payPaise / 100}/{job.payUnit}
                </Text>

                {job.applicantCount > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: colors.greenLight,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Ionicons name="people-outline" size={14} color={colors.green} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.green }}>
                      {job.applicantCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ApplicationsTab() {
  const { data: applications, isLoading } = useQuery<Interaction[]>({
    queryKey: ["my-applications"],
    queryFn: async () => {
      // This would need a backend endpoint
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
        padding: 24,
        borderRadius: 18,
        alignItems: "center",
      }}
    >
      <Ionicons name="document-text-outline" size={48} color={colors.mutedLight} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.ink,
          marginTop: 12,
        }}
      >
        No applications yet
      </Text>
      <Copy center small style={{ marginTop: 8 }}>
        Your job applications will appear here
      </Copy>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStatusInfo = (s: string) => {
    switch (s.toUpperCase()) {
      case "PUBLISHED":
        return { label: "Open", color: "#4CAF50", bg: "#E8F5E9" };
      case "PAUSED":
        return { label: "Paused", color: "#FF9800", bg: "#FFF3E0" };
      case "FILLED":
        return { label: "Filled", color: "#2196F3", bg: "#E3F2FD" };
      case "COMPLETED":
        return { label: "Done", color: "#9C27B0", bg: "#F3E5F5" };
      case "CANCELLED":
        return { label: "Cancelled", color: "#757575", bg: "#F5F5F5" };
      default:
        return { label: status, color: colors.muted, bg: colors.paper };
    }
  };

  const info = getStatusInfo(status);

  return (
    <View
      style={{
        backgroundColor: info.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: info.color,
          textTransform: "uppercase",
        }}
      >
        {info.label}
      </Text>
    </View>
  );
}
