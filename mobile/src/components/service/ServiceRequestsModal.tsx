import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../auth";
import type { ServiceRequestItem } from "../../api/types";
import { CancellationModal } from "../CancellationModal";
import { AppPressable as Pressable } from "../AppPressable";
import { ServiceRequestCard } from "./ServiceRequestCard";
import { ServiceCompletionConfirmationSheet } from "./ServiceCompletionConfirmationSheet";
import { invalidateServiceQueries } from "../../api/serviceApi";

const green = "#086649";
const ink = "#182C25";
const muted = "#718078";

const ACTIVE_STATUSES = ["ACCEPTED", "IN_PROGRESS"];

export interface ServiceRequestsModalProps {
  visible: boolean;
  onClose: () => void;
  serviceId?: string;
  serviceTitle?: string;
}

export function ServiceRequestsModal({
  visible,
  onClose,
  serviceId,
  serviceTitle,
}: ServiceRequestsModalProps) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [actionId, setActionId] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<ServiceRequestItem | null>(null);
  const [completionRequest, setCompletionRequest] = useState<ServiceRequestItem | null>(null);
  const scope = useRef(0);

  useEffect(() => {
    scope.current++;
    setFilter("All");
    setActionId(null);
    setCancellingRequest(null);
    setCompletionRequest(null);
  }, [visible, serviceId, session?.token]);

  const requestsQuery = useQuery({
    queryKey: ["service-requests", serviceId, session?.token],
    queryFn: () =>
      api<ServiceRequestItem[]>(
        `/applications?kind=service&role=provider&serviceId=${encodeURIComponent(serviceId!)}`,
      ),
    enabled: visible && !!serviceId && !!session?.token,
    staleTime: 5000,
  });

  const requests = useMemo(() => {
    const list = requestsQuery.data || [];
    return [...list].sort(
      (a, b) =>
        Number(b.status === "PENDING") - Number(a.status === "PENDING") ||
        (b.createdAt || 0) - (a.createdAt || 0),
    );
  }, [requestsQuery.data]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const acceptedCount = requests.filter((r) => ACTIVE_STATUSES.includes(r.status || "")).length;
  const completedCount = requests.filter((r) => r.status === "COMPLETED").length;
  const declinedCount = requests.filter(
    (r) =>
      r.status === "REJECTED" ||
      r.status === "CANCELLED" ||
      r.status === "CANCELLED_BY_SEEKER" ||
      r.status === "CANCELLED_BY_PROVIDER" ||
      r.status === "WITHDRAWN",
  ).length;

  const shown = useMemo(() => {
    return requests.filter((item) => {
      const status = item.status || "";
      if (filter === "Needs review") return status === "PENDING";
      if (filter === "Accepted") return ACTIVE_STATUSES.includes(status);
      if (filter === "Completed") return status === "COMPLETED";
      if (filter === "Declined") {
        return (
          status === "REJECTED" ||
          status === "CANCELLED" ||
          status === "CANCELLED_BY_SEEKER" ||
          status === "CANCELLED_BY_PROVIDER" ||
          status === "WITHDRAWN"
        );
      }
      return true;
    });
  }, [requests, filter]);

  // Action Mutation
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
      setActionId(id);
      return api(`/applications/${id}/action`, { action, reason });
    },
    onMutate: async ({ id, action, reason }) => {
      queryClient.setQueryData(
        ["service-requests", serviceId, session?.token],
        (old: ServiceRequestItem[] | undefined) => {
          if (!old) return [];
          return old.map((item) => {
            if (item.id !== id) return item;
            let nextStatus = item.status;
            if (action === "accept") nextStatus = "ACCEPTED";
            else if (action === "reject") nextStatus = "REJECTED";
            else if (action === "cancel") nextStatus = "CANCELLED_BY_PROVIDER";
            return {
              ...item,
              status: nextStatus,
              ...(reason ? { cancellationReason: reason } : {}),
            };
          });
        },
      );
    },
    onSuccess: () => {
      void invalidateServiceQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });
      void queryClient.invalidateQueries({ queryKey: ["service-requests", serviceId] });
    },
    onError: (err: any) => {
      void queryClient.invalidateQueries({ queryKey: ["service-requests", serviceId] });
      Alert.alert("Action Failed", err?.message || "Could not update request status.");
    },
    onSettled: () => {
      setActionId(null);
    },
  });

  const handleAccept = async (req: ServiceRequestItem) => {
    if (actionId) return;
    await actionMutation.mutateAsync({ id: req.id, action: "accept" });
  };

  const handleDecline = async (req: ServiceRequestItem) => {
    if (actionId) return;
    await actionMutation.mutateAsync({ id: req.id, action: "reject" });
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!cancellingRequest) return;
    const req = cancellingRequest;
    setCancellingRequest(null);
    await actionMutation.mutateAsync({ id: req.id, action: "cancel", reason });
  };

  const handleDetails = (req: ServiceRequestItem) => {
    onClose();
    router.push({
      pathname: "/requests/[id]",
      params: { id: req.id },
    });
  };

  const tabs = [
    { key: "All", label: `All (${requests.length})` },
    { key: "Needs review", label: `Needs review (${pendingCount})` },
    { key: "Accepted", label: `Accepted (${acceptedCount})` },
    { key: "Completed", label: `Completed (${completedCount})` },
    { key: "Declined", label: `Declined (${declinedCount})` },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close request list"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title} numberOfLines={1}>
                {serviceTitle || "Service Requests"}
              </Text>
              <View style={styles.headerMeta}>
                <Text style={styles.subtitle}>
                  {requests.length}{" "}
                  {requests.length === 1 ? "request received" : "requests received"}
                </Text>
                {pendingCount > 0 && (
                  <View style={styles.pendingPill}>
                    <View style={styles.pendingDot} />
                    <Text style={styles.pendingPillText}>
                      {pendingCount} need response
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={ink} />
            </Pressable>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {tabs.map((tab) => {
                const active = filter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setFilter(tab.key)}
                    style={[styles.tab, active && styles.activeTab]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tabText, active && styles.activeTabText]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Request Cards List */}
          <FlatList
            data={shown}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={requestsQuery.isRefetching}
            onRefresh={() => requestsQuery.refetch()}
            ListEmptyComponent={
              <View style={styles.empty}>
                {requestsQuery.isLoading ? (
                  <ActivityIndicator color={green} size="large" />
                ) : (
                  <Ionicons
                    name="mail-unread-outline"
                    size={36}
                    color="#047857"
                  />
                )}
                <Text style={styles.emptyTitle}>
                  {requestsQuery.isLoading
                    ? "Loading requests…"
                    : filter === "All"
                      ? "No requests received yet"
                      : filter === "Needs review"
                        ? "No pending requests"
                        : filter === "Accepted"
                          ? "No active accepted bookings"
                          : filter === "Completed"
                            ? "No completed services yet"
                            : "No declined requests"}
                </Text>
                <Text style={styles.emptyCopy}>
                  {filter === "All"
                    ? "When customers book this service, their requests will appear here for you to accept and manage."
                    : filter === "Needs review"
                      ? "New requests that need your approval will appear here."
                      : "Bookings with this status will appear in this tab."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ServiceRequestCard
                request={item}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onCancel={(req) => setCancellingRequest(req)}
                onPressDetails={handleDetails}
                onCompleteWork={(req) => setCompletionRequest(req)}
                onRateCustomer={(req) => setCompletionRequest(req)}
                isProvider={true}
                isActing={actionId === item.id}
                showServiceTitle={false}
              />
            )}
          />
        </View>
      </View>

      {/* Cancellation Reason Modal */}
      <CancellationModal
        visible={!!cancellingRequest}
        title="Cancel Service Booking"
        isProvider={true}
        onClose={() => setCancellingRequest(null)}
        onConfirm={handleCancelConfirm}
      />

      {/* Service Completion & Mutual Rating Confirmation Sheet */}
      <ServiceCompletionConfirmationSheet
        visible={!!completionRequest}
        interaction={completionRequest}
        isProvider={true}
        onClose={() => {
          setCompletionRequest(null);
          void requestsQuery.refetch();
          void invalidateServiceQueries(queryClient);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 38, 29, 0.28)",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    height: "78%",
    maxHeight: "92%",
    backgroundColor: "#FBFCFB",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#193D2D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 18,
  },
  handle: {
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: "#C9D8CF",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EE",
    backgroundColor: "#FFFFFF",
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: ink,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: muted,
  },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF3DB",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D38A18",
  },
  pendingPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#805B18",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F6F3",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsWrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F1",
  },
  tabs: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tab: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#F3F5F4",
  },
  activeTab: {
    backgroundColor: green,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: muted,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: ink,
    marginTop: 6,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 12.5,
    lineHeight: 18,
    color: muted,
    textAlign: "center",
    maxWidth: 320,
  },
});
