import { AppImage as Image } from '../src/components/AppImage';
import { invalidateServiceQueries } from "../src/api/serviceApi";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { dash } from "../src/components/provider/palette";
import { formatDirectPhone } from "@bulao/domain";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";
import { ServiceRequestCard } from "../src/components/service/ServiceRequestCard";
import { ServiceCompletionConfirmationSheet } from "../src/components/service/ServiceCompletionConfirmationSheet";
import { CancellationModal } from "../src/components/CancellationModal";
import type { ServiceItem } from "../src/features/profile/types";

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
  const params = useLocalSearchParams<{ tab?: string; serviceId?: string }>();
  const [activeTab, setActiveTab] = useState<RequestTab>(
    params.tab === "received" || !!params.serviceId ? "received" : "requested",
  );
  const [segmentWidth, setSegmentWidth] = useState(0);
  const tabProgress = useRef(new Animated.Value(activeTab === "received" ? 1 : 0)).current;
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    params.serviceId || null,
  );
  const [cancellingRequest, setCancellingRequest] = useState<any | null>(null);
  const [completionRequest, setCompletionRequest] = useState<any | null>(null);
  const [completionIsProvider, setCompletionIsProvider] = useState<boolean>(true);

  useEffect(() => {
    if (params.tab === "received" || params.serviceId) {
      setActiveTab("received");
      if (params.serviceId) {
        setSelectedServiceId(params.serviceId);
      }
    }
  }, [params.tab, params.serviceId]);

  useEffect(() => {
    Animated.timing(tabProgress, {
      toValue: activeTab === "received" ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabProgress]);

  // Fetch Current User
  const meQuery = useQuery({
    queryKey: ["users-me", session?.token],
    enabled: Boolean(session?.token),
    queryFn: () => api<{ id: string; name: string }>("/users/me"),
  });

  // Fetch My Services for filtering
  const myServicesQuery = useQuery({
    queryKey: ["my-services", session?.token],
    queryFn: () => api<ServiceItem[]>("/services/mine"),
    enabled: Boolean(session?.token),
  });
  const myServices = myServicesQuery.data || [];

  // Fetch Service Requests Data
  const activityQuery = useQuery({
    queryKey: ["service-requests-interactions", session?.token],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const currentUserId = meQuery.data?.id || "";

      // 1. Try dedicated service interactions endpoint
      try {
        const res = await api<{
          items?: Connection[];
          interactions?: Connection[];
        }>("/interactions?kind=service");
        const list = res?.items || res?.interactions;
        if (Array.isArray(list) && list.length > 0) {
          return { interactions: list, jobs: [] };
        }
      } catch {
        // Fall back gracefully to recent services endpoint
      }

      // 2. Reliable Service Provider Recent Endpoint
      try {
        const recent = await api<any[]>("/services/provider/recent");
        if (Array.isArray(recent)) {
          const reqItems = recent.filter(
            (r) => r.applicantCount === 1 || !["PUBLISHED", "PAUSED"].includes(r.status),
          );

          const myServiceIds = new Set(myServices.map((s) => s.id));

          const mapped: Connection[] = reqItems.map((r) => {
            const matchedServiceId = r.serviceId || r.roleId || null;
            const isMyService = matchedServiceId ? myServiceIds.has(matchedServiceId) : true;

            return {
              id: r.id,
              kind: "service",
              jobId: null,
              serviceId: matchedServiceId,
              status: r.status || "PENDING",
              ownerId: isMyService ? currentUserId : (r.ownerId || "provider"),
              workerId: isMyService ? (r.workerId || "seeker") : currentUserId,
              title: r.title || "Service Request",
              otherId: r.otherId || "",
              otherName: r.otherName || "Customer",
              otherPhone: r.otherPhone || null,
              otherPhotoUrl: r.otherPhotoUrl || null,
              area: r.area || "Local area",
              createdAt: r.createdAt || Date.now(),
              details: r.details || "",
              reviewed: false,
              ownerConfirmedAt: r.ownerConfirmedAt || null,
              workerConfirmedAt: r.workerConfirmedAt || null,
            };
          });

          return { interactions: mapped, jobs: [] };
        }
      } catch (err) {
        console.warn("[service-requests] recent fetch error:", err);
      }

      return { interactions: [], jobs: [] };
    },
    staleTime: 30000,
  });

  useFocusEffect(
    useCallback(() => {
      if (session?.token) void queryClient.invalidateQueries({ queryKey: ["activity"] });
    }, [session?.token, queryClient]),
  );
  const userId = meQuery.data?.id;

  // 1. Requested Services (Where I am the seeker / workerId)
  const requestedServices = useMemo(() => {
    if (!activityQuery.data?.interactions || !userId) return [];
    return activityQuery.data.interactions.filter(
      (item) => item.kind === "service" && item.workerId === userId,
    );
  }, [activityQuery.data, userId]);

  // All Got Requests for My Service (Where I am the provider / ownerId)
  const gotRequestsAll = useMemo(() => {
    if (!activityQuery.data?.interactions || !userId) return [];
    return activityQuery.data.interactions.filter(
      (item) => item.kind === "service" && item.ownerId === userId,
    );
  }, [activityQuery.data, userId]);

  // 2. Got Requests (Filtered by selectedServiceId if selected)
  const gotRequests = useMemo(() => {
    if (!selectedServiceId) return gotRequestsAll;
    return gotRequestsAll.filter((item) => item.serviceId === selectedServiceId);
  }, [gotRequestsAll, selectedServiceId]);

  // Action Mutation with instant optimistic updates
  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: string;
      reason?: string;
    }) => {
      return api(`/applications/${id}/action`, { action, reason });
    },
    onMutate: async ({ id, action, reason }) => {
      queryClient.setQueryData(
        ["activity-interactions", session?.token],
        (old: any) => {
          if (!old || !Array.isArray(old.interactions)) return old;
          return {
            ...old,
            interactions: old.interactions.map((item: any) => {
              if (item.id !== id) return item;
              if (action === "confirm") {
                const isProvider = activeTab === "received";
                const otherConfirmed = isProvider
                  ? item.workerConfirmedAt
                  : item.ownerConfirmedAt;
                return {
                  ...item,
                  status: otherConfirmed ? "COMPLETED" : "IN_PROGRESS",
                  ...(isProvider
                    ? {
                        ownerConfirmedAt:
                          item.ownerConfirmedAt || Math.floor(Date.now() / 1000),
                      }
                    : {
                        workerConfirmedAt:
                          item.workerConfirmedAt || Math.floor(Date.now() / 1000),
                      }),
                };
              }
              return {
                ...item,
                status:
                  action === "accept"
                    ? "ACCEPTED"
                    : action === "reject"
                      ? "REJECTED"
                      : action === "withdraw"
                        ? "WITHDRAWN"
                        : "CANCELLED",
                ...(reason ? { cancellationReason: reason } : {}),
              };
            }),
          };
        },
      );
    },
    onSuccess: () => {
      void invalidateServiceQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
    },
    onError: (err: any) => {
      void queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
      Alert.alert(
        "Action Failed",
        err.message || "Could not update request status.",
      );
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
        </View>

        {/* Two Type Segment Tabs */}
        <View
          style={styles.segmentBar}
          onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
        >
          {segmentWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentSelection,
                {
                  width: (segmentWidth - 8) / 2,
                  transform: [
                    {
                      translateX: tabProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (segmentWidth + 8) / 2],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === "requested" }}
            accessibilityLabel="Requested Services Tab"
            onPress={() => setActiveTab("requested")}
            style={styles.segmentBtn}
          >
            <Ionicons
              name="paper-plane"
              size={14}
              color={activeTab === "requested" ? "#FFFFFF" : "#047857"}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "requested" && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Requested Services ({requestedServices.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === "received" }}
            accessibilityLabel="Got Requests Tab"
            onPress={() => setActiveTab("received")}
            style={styles.segmentBtn}
          >
            <Ionicons
              name="download"
              size={14}
              color={activeTab === "received" ? "#FFFFFF" : "#047857"}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "received" && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Got Requests ({gotRequestsAll.length})
            </Text>
          </Pressable>
        </View>

        {/* Service Filter Chips for Got Requests */}
        {activeTab === "received" && myServices.length > 0 && (
          <View style={styles.servicesFilterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesFilterScroll}
            >
              <Pressable
                onPress={() => setSelectedServiceId(null)}
                style={[
                  styles.serviceFilterChip,
                  !selectedServiceId && styles.serviceFilterChipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: !selectedServiceId }}
                accessibilityLabel="All services filter"
              >
                <Text
                  style={[
                    styles.serviceFilterChipText,
                    !selectedServiceId && styles.serviceFilterChipTextActive,
                  ]}
                >
                  All Services ({gotRequestsAll.length})
                </Text>
              </Pressable>

              {myServices.map((svc) => {
                const isSelected = selectedServiceId === svc.id;
                const count = gotRequestsAll.filter(
                  (r) => r.serviceId === svc.id,
                ).length;
                return (
                  <Pressable
                    key={svc.id}
                    onPress={() =>
                      setSelectedServiceId(isSelected ? null : svc.id)
                    }
                    style={[
                      styles.serviceFilterChip,
                      isSelected && styles.serviceFilterChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filter by ${svc.title || svc.categoryName}`}
                  >
                    <Ionicons
                      name="construct-outline"
                      size={12}
                      color={isSelected ? "#FFFFFF" : "#047857"}
                    />
                    <Text
                      style={[
                        styles.serviceFilterChipText,
                        isSelected && styles.serviceFilterChipTextActive,
                      ]}
                    >
                      {svc.title || svc.categoryName} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
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
              {activeTab === "requested"
                ? "No requested services yet"
                : selectedServiceId
                  ? "No requests for this service"
                  : "No received requests yet"}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === "requested"
                ? "When you request a service profile, your active bookings will appear here."
                : selectedServiceId
                  ? "No customer requests received for the selected service yet."
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
            {activeTab === "received" && selectedServiceId && (
              <Pressable
                onPress={() => setSelectedServiceId(null)}
                style={styles.actionBtnPrimary}
              >
                <Text style={styles.actionBtnPrimaryText}>
                  Show All Requests ({gotRequestsAll.length})
                </Text>
              </Pressable>
            )}
          </View>
        ) : activeTab === "received" ? (
          <View style={styles.listContainer}>
            {gotRequests.map((item) => (
              <ServiceRequestCard
                key={item.id}
                request={item}
                onAccept={(req) =>
                  actionMutation.mutate({ id: req.id, action: "accept" })
                }
                onDecline={(req) =>
                  actionMutation.mutate({ id: req.id, action: "reject" })
                }
                onCancel={(req) => setCancellingRequest(req)}
                onCall={(phone, name) => handleCallUser(phone, name)}
                onPressDetails={(req) =>
                  router.push({
                    pathname: "/requests/[id]",
                    params: { id: req.id },
                  })
                }
                onCompleteWork={(req) => {
                  setCompletionRequest(req);
                  setCompletionIsProvider(true);
                }}
                onRateCustomer={(req) => {
                  setCompletionRequest(req);
                  setCompletionIsProvider(true);
                }}
                isProvider={true}
                isActing={
                  actionMutation.isPending &&
                  (actionMutation.variables as any)?.id === item.id
                }
                showServiceTitle={!selectedServiceId}
              />
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {requestedServices.map((item) => {
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
                        Provider: {item.otherName}
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
                        The service professional accepted your booking. You can now call each other directly.
                      </Text>

                      <View style={styles.directContactRow}>
                        <View style={styles.directContactInfo}>
                          <Text style={styles.directContactLabel}>
                            PROVIDER MOBILE
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
                        Awaiting provider acceptance. Mobile numbers will be unlocked once accepted.
                      </Text>
                    </View>
                  ) : null}

                  {/* Interactive Action Buttons */}
                  <View style={styles.actionRow}>
                    {/* Requested Services Tab: Customer can Withdraw if Pending */}
                    {isPending && (
                      <Pressable
                        disabled={actionMutation.isPending}
                        onPress={() => actionMutation.mutate({ id: item.id, action: "withdraw" })}
                        style={styles.btnWithdraw}
                      >
                        <Text style={styles.btnWithdrawText}>Withdraw Request</Text>
                      </Pressable>
                    )}

                    {["ACCEPTED", "IN_PROGRESS"].includes(item.status) && (
                      item.workerConfirmedAt ? (
                        <Text style={styles.waitingConfirmText}>
                          You marked work complete. Waiting for the provider to confirm.
                        </Text>
                      ) : (
                        <Pressable
                          disabled={actionMutation.isPending}
                          style={styles.btnAccept}
                          onPress={() => {
                            setCompletionRequest(item);
                            setCompletionIsProvider(false);
                          }}
                        >
                          <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.btnAcceptText}>Mark work done</Text>
                        </Pressable>
                      )
                    )}
                    {["ACCEPTED", "IN_PROGRESS"].includes(item.status) && !item.workerConfirmedAt && (
                      <Pressable
                        disabled={actionMutation.isPending}
                        style={styles.btnWithdraw}
                        onPress={() => actionMutation.mutate({ id: item.id, action: "cancel" })}
                      >
                        <Text style={styles.btnWithdrawText}>Cancel</Text>
                      </Pressable>
                    )}

                    {/* If Completed: Allow Leave Review */}
                    {isCompleted && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View offline payment status"
                        onPress={() => router.push({ pathname: "/requests/[id]", params: { id: item.id, kind: "service" } })}
                        style={styles.btnPaymentStatus}
                      >
                        <Ionicons name="cash-outline" size={15} color="#10563F" />
                        <Text style={styles.btnPaymentStatusText}>Offline payment status</Text>
                      </Pressable>
                    )}

                    {isCompleted && !item.reviewed && (
                      <Pressable
                        onPress={() => {
                          setCompletionRequest(item);
                          setCompletionIsProvider(false);
                        }}
                        style={styles.btnReview}
                      >
                        <Ionicons name="star" size={15} color="#F59E0B" />
                        <Text style={styles.btnReviewText}>Rate Service Experience</Text>
                      </Pressable>
                    )}
                    {isCompleted && !!item.reviewed && (
                      <View style={styles.ratedBadge}>
                        <Ionicons name="star" size={13} color="#047857" />
                        <Text style={styles.ratedBadgeText}>You rated this provider</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Cancellation Modal for provider cancellation */}
      <CancellationModal
        visible={!!cancellingRequest}
        title="Cancel Service Booking"
        isProvider={true}
        onClose={() => setCancellingRequest(null)}
        onConfirm={(reason) => {
          if (!cancellingRequest) return;
          const req = cancellingRequest;
          setCancellingRequest(null);
          actionMutation.mutate({ id: req.id, action: "cancel", reason });
        }}
      />

      {/* Service Completion & Mutual Rating Confirmation Sheet */}
      <ServiceCompletionConfirmationSheet
        visible={!!completionRequest}
        interaction={completionRequest}
        isProvider={completionIsProvider}
        onClose={() => {
          setCompletionRequest(null);
          void activityQuery.refetch();
          void invalidateServiceQueries(queryClient);
        }}
      />

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
  servicesFilterBar: {
    marginTop: 10,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  servicesFilterScroll: {
    gap: 7,
    paddingVertical: 3,
  },
  serviceFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#DCE8E0",
  },
  serviceFilterChipActive: {
    backgroundColor: "#087653",
    borderColor: "#087653",
  },
  serviceFilterChipText: {
    maxWidth: 190,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: "#315343",
  },
  serviceFilterChipTextActive: {
    color: "#FFFFFF",
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
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: dash.ink,
    letterSpacing: -0.4,
  },
  segmentBar: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
    position: "relative",
    backgroundColor: "transparent",
  },
  segmentSelection: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: "#047857",
  },
  segmentBtn: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#DCE8E0",
  },
  segmentBtnText: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 13,
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
  btnPaymentStatus: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "#D4E7DB",
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  btnPaymentStatusText: {
    flexShrink: 1,
    color: "#10563F",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  btnReviewText: {
    color: "#D97706",
    fontSize: 13,
    fontWeight: "700",
  },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  ratedBadgeText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
  },
});
