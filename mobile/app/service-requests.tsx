import { invalidateServiceQueries } from "../src/api/serviceApi";
import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { dash } from "../src/components/provider/palette";
import { formatDirectPhone } from "@bulao/domain";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";

type RequestTab = "requested" | "received";

interface Connection {
  id: string;
  kind: string;
  jobId: string | null;
  serviceId: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "IN_PROGRESS" | "WITHDRAWN" | "CANCELLED_BY_SEEKER" | "CANCELLED_BY_PROVIDER";
  ownerId: string;
  workerId: string;
  title: string;
  otherId: string;
  otherName: string;
  otherPhone: string | null;
  otherPhotoUrl: string | null;
  area: string;
  createdAt: number;
  details?: string;
  reviewed?: boolean;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const time = timestamp * (timestamp < 1e11 ? 1000 : 1);
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

function getStatusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case "PENDING":
      return { label: "Pending", bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", dot: "#D97706" };
    case "ACCEPTED":
      return { label: "Accepted", bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "#10B981" };
    case "IN_PROGRESS":
      return { label: "In Progress", bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD", dot: "#0284C7" };
    case "COMPLETED":
      return { label: "Completed", bg: "#F3E8FF", text: "#6B21A8", border: "#E9D5FF", dot: "#9333EA" };
    case "REJECTED":
      return { label: "Declined", bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5", dot: "#EF4444" };
    case "WITHDRAWN":
    case "CANCELLED_BY_SEEKER":
    case "CANCELLED_BY_PROVIDER":
    case "CANCELLED":
      return { label: "Cancelled", bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", dot: "#64748B" };
    default:
      return { label: status || "Open", bg: "#F3F4F6", text: "#374151", border: "#E5E7EB", dot: "#6B7280" };
  }
}

export default function ActivityTabScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RequestTab>("requested");

  // Fetch Current User
  const meQuery = useQuery({
    queryKey: ["users-me", session?.token],
    enabled: Boolean(session?.token),
    queryFn: () => api<{ id: string; name: string }>("/users/me"),
  });

  // Fetch Activity Data
  const activityQuery = useQuery({
    queryKey: ["activity-interactions", session?.token],
    enabled: Boolean(session?.token),
    queryFn: () =>
      api<{
        interactions: Connection[];
        jobs: Array<any>;
      }>("/activity"),
    refetchInterval: 15000,
  });

  useFocusEffect(useCallback(() => { if (session?.token) void activityQuery.refetch(); }, [session?.token, activityQuery.refetch]));
  const userId = meQuery.data?.id;

  // 1. Requested Services (Where I am the seeker / workerId)
  const requestedServices = useMemo(() => {
    if (!activityQuery.data?.interactions || !userId) return [];
    return activityQuery.data.interactions.filter((item) => item.kind === "service" && item.workerId === userId);
  }, [activityQuery.data, userId]);

  // 2. Got Requests for My Service (Where I am the provider / ownerId)
  const gotRequests = useMemo(() => {
    if (!activityQuery.data?.interactions || !userId) return [];
    return activityQuery.data.interactions.filter((item) => item.kind === "service" && item.ownerId === userId);
  }, [activityQuery.data, userId]);

  // Action Mutation (Accept, Reject, Withdraw, Cancel)
  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      return api(`/applications/${id}/action`, { action });
    },
    onSuccess: () => {
      void invalidateServiceQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (err: any) => {
      Alert.alert("Action Failed", err.message || "Could not update request status.");
    },
  });

  const handleCallUser = (phone: string | null, name: string) => {
    const clean = phone ? formatDirectPhone(phone) : null;
    if (!clean) {
      Alert.alert(
        "Call Unavailable",
        `Direct phone calling for ${name} is unavailable.`,
      );
      return;
    }
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert("Call Error", "Phone dialer unavailable on this device.");
    });
  };

  const currentList = activeTab === "requested" ? requestedServices : gotRequests;
  const isLoading = activityQuery.isLoading || meQuery.isLoading;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Service Requests</Text>
          <Text style={styles.headerSub}>Track requested services & manage incoming bookings</Text>
        </View>

        {/* Two Type Segment Tabs */}
        <View style={styles.segmentBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Requested Services Tab"
            onPress={() => setActiveTab("requested")}
            style={[styles.segmentBtn, activeTab === "requested" && styles.segmentBtnActive]}
          >
            <Ionicons
              name="paper-plane"
              size={15}
              color={activeTab === "requested" ? "#FFFFFF" : "#047857"}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "requested" && styles.segmentBtnTextActive,
              ]}
            >
              Requested Services ({requestedServices.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Got Requests Tab"
            onPress={() => setActiveTab("received")}
            style={[styles.segmentBtn, activeTab === "received" && styles.segmentBtnActive]}
          >
            <Ionicons
              name="download"
              size={15}
              color={activeTab === "received" ? "#FFFFFF" : "#047857"}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "received" && styles.segmentBtnTextActive,
              ]}
            >
              Got Requests ({gotRequests.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Requests List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={activityQuery.isRefetching}
            onRefresh={() => {
              void activityQuery.refetch();
              void meQuery.refetch();
            }}
            tintColor="#047857"
            colors={["#047857"]}
          />
        }
      >
        {!session?.token ? (
          <View style={styles.emptyCard}>
            <Ionicons name="lock-closed-outline" size={44} color="#64748B" />
            <Text style={styles.emptyTitle}>Sign in to view requests</Text>
            <Text style={styles.emptySub}>Please sign in to track your service requests and received bookings.</Text>
            <Pressable onPress={() => router.push("/auth")} style={styles.actionBtnPrimary}>
              <Text style={styles.actionBtnPrimaryText}>Sign In Now</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.loadingText}>Loading requests…</Text>
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={activeTab === "requested" ? "paper-plane-outline" : "mail-unread-outline"}
                size={34}
                color="#047857"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === "requested" ? "No requested services yet" : "No received requests yet"}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === "requested"
                ? "When you request a service profile, your active bookings will appear here."
                : "When customers request your listed services, incoming requests will show up here."}
            </Text>
            {activeTab === "requested" && (
              <Pressable
                onPress={() => router.push("/service-search")}
                style={styles.actionBtnPrimary}
              >
                <Ionicons name="search" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnPrimaryText}>Explore Local Services</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {currentList.map((item) => {
              const badge = getStatusBadge(item.status);
              const isPending = item.status === "PENDING";
              const isAccepted = item.status === "ACCEPTED" || item.status === "IN_PROGRESS";
              const isCompleted = item.status === "COMPLETED";

              return (
                <View key={item.id} style={styles.requestCard}>
                  {/* Card Header: Service Title + Status Badge */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: badge.dot }]} />
                      <Text style={[styles.statusText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Other Person Info (Provider or Customer) */}
                  <View style={styles.personRow}>
                    {item.otherPhotoUrl ? (
                      <Image source={{ uri: item.otherPhotoUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>
                          {(item.otherName || "U").substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {activeTab === "requested" ? `Provider: ${item.otherName}` : `Customer: ${item.otherName}`}
                      </Text>
                      <Text style={styles.personSub} numberOfLines={1}>
                        {item.area ? `${item.area} • ` : ""}{formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>

                    {item.otherPhone && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${item.otherName}`}
                        onPress={() => handleCallUser(item.otherPhone, item.otherName)}
                        style={styles.inlineCallBtn}
                      >
                        <Ionicons name="call" size={14} color="#047857" />
                      </Pressable>
                    )}
                  </View>

                  {/* Details text if present */}
                  {!!item.details && (
                    <View style={styles.detailsBox}>
                      <Text style={styles.detailsText} numberOfLines={2}>
                        "{item.details}"
                      </Text>
                    </View>
                  )}

                  {/* Connected Mutual Contact Card (Unlocked upon Acceptance) */}
                  {isAccepted ? (
                    <View style={styles.acceptedContactCard}>
                      <View style={styles.connectedBadgeRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#047857" />
                        <Text style={styles.connectedBadgeText}>
                          {item.status === "ACCEPTED" ? "Request Accepted • Contact Unlocked" : "Service In Progress"}
                        </Text>
                      </View>
                      <Text style={styles.connectedNotice}>
                        {activeTab === "requested"
                          ? "The service professional accepted your booking. You can now call each other directly."
                          : "You accepted this booking. You can now call the customer directly to coordinate."}
                      </Text>

                      <View style={styles.directContactRow}>
                        <View style={styles.directContactInfo}>
                          <Text style={styles.directContactLabel}>
                            {activeTab === "requested" ? "PROVIDER MOBILE" : "CUSTOMER MOBILE"}
                          </Text>
                          <Text style={styles.directContactPhone}>
                            {item.otherPhone ? `+91 ${formatDirectPhone(item.otherPhone)}` : "Contact Available"}
                          </Text>
                        </View>
                        {item.otherPhone && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Call ${item.otherName}`}
                            onPress={() => handleCallUser(item.otherPhone, item.otherName)}
                            style={styles.btnDirectCall}
                          >
                            <Ionicons name="call" size={14} color="#FFFFFF" />
                            <Text style={styles.btnDirectCallText}>Call Now</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ) : isPending ? (
                    <View style={styles.pendingNoticeBox}>
                      <Ionicons name="time-outline" size={14} color="#B45309" />
                      <Text style={styles.pendingNoticeText}>
                        {activeTab === "requested"
                          ? "Awaiting provider acceptance. Mobile numbers will be unlocked once accepted."
                          : "Customer request pending. Accept request to unlock direct mobile contact."}
                      </Text>
                    </View>
                  ) : null}

                  {/* Interactive Action Buttons */}
                  <View style={styles.actionRow}>
                    {/* Got Requests Tab: Provider can Accept or Reject */}
                    {activeTab === "received" && isPending && (
                      <>
                        <Pressable
                          disabled={actionMutation.isPending}
                          onPress={() => actionMutation.mutate({ id: item.id, action: "accept" })}
                          style={styles.btnAccept}
                        >
                          {actionMutation.isPending &&
                          (actionMutation.variables as any)?.id === item.id &&
                          (actionMutation.variables as any)?.action === "accept" ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                              <Text style={styles.btnAcceptText}>Accept Request</Text>
                            </>
                          )}
                        </Pressable>

                        <Pressable
                          disabled={actionMutation.isPending}
                          onPress={() => actionMutation.mutate({ id: item.id, action: "reject" })}
                          style={styles.btnReject}
                        >
                          <Text style={styles.btnRejectText}>Decline</Text>
                        </Pressable>
                      </>
                    )}

                    {/* Requested Services Tab: Customer can Withdraw if Pending */}
                    {activeTab === "requested" && isPending && (
                      <Pressable
                        disabled={actionMutation.isPending}
                        onPress={() => actionMutation.mutate({ id: item.id, action: "withdraw" })}
                        style={styles.btnWithdraw}
                      >
                        <Text style={styles.btnWithdrawText}>Withdraw Request</Text>
                      </Pressable>
                    )}

                    {activeTab === "received" && item.status === "ACCEPTED" && (
                      <Pressable disabled={actionMutation.isPending} style={styles.btnAccept} onPress={() => actionMutation.mutate({ id: item.id, action: "start" })}><Text style={styles.btnAcceptText}>Start service</Text></Pressable>
                    )}
                    {item.status === "IN_PROGRESS" && (
                      (activeTab === "received" ? item.ownerConfirmedAt : item.workerConfirmedAt)
                        ? <Text style={styles.waitingConfirmText}>Waiting for confirmation…</Text>
                        : <Pressable disabled={actionMutation.isPending} style={styles.btnAccept} onPress={() => actionMutation.mutate({ id: item.id, action: "confirm" })}><Text style={styles.btnAcceptText}>Confirm completion</Text></Pressable>
                    )}
                    {["ACCEPTED", "IN_PROGRESS"].includes(item.status) && (
                      <Pressable disabled={actionMutation.isPending} style={styles.btnWithdraw} onPress={() => actionMutation.mutate({ id: item.id, action: "cancel" })}><Text style={styles.btnWithdrawText}>Cancel</Text></Pressable>
                    )}

                    {/* If Completed: Allow Leave Review */}
                    {isCompleted && !item.reviewed && (
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: "/review", params: { id: item.id } })
                        }
                        style={styles.btnReview}
                      >
                        <Ionicons name="star" size={15} color="#F59E0B" />
                        <Text style={styles.btnReviewText}>Leave Rating Review</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <ServiceBottomNav active="requests" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF8",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  headerContent: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: dash.ink,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: dash.muted,
    marginTop: 2,
  },
  segmentBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: "#047857",
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  segmentBtnTextActive: {
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: dash.muted,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: dash.ink,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: dash.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#047857",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginTop: 6,
  },
  actionBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  listContainer: {
    gap: 14,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: dash.ink,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: "800",
    color: "#047857",
  },
  personName: {
    fontSize: 13,
    fontWeight: "700",
    color: dash.ink,
  },
  personSub: {
    fontSize: 11,
    color: dash.muted,
    marginTop: 1,
  },
  inlineCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsBox: {
    backgroundColor: "#F8FAF8",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  detailsText: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  btnAccept: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnAcceptText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  btnReject: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnRejectText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  btnWithdraw: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnWithdrawText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  acceptedContactCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  connectedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectedBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
  },
  connectedNotice: {
    fontSize: 11,
    color: "#166534",
    lineHeight: 15,
  },
  directContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginTop: 2,
  },
  directContactInfo: {
    flex: 1,
  },
  directContactLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },
  directContactPhone: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  btnDirectCall: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#047857",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnDirectCallText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  pendingNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingNoticeText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
    lineHeight: 15,
  },
  waitingConfirmText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    fontStyle: "italic",
    paddingVertical: 6,
  },
  btnCallFull: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnCallFullText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  btnReview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnReviewText: {
    color: "#D97706",
    fontSize: 13,
    fontWeight: "700",
  },
});
