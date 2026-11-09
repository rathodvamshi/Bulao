import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "./ui";
import { api } from "../api/client";
import { getNotificationInbox } from "../api/notifications";
import type { AppNotification } from "../api/types";

export interface NotificationsScreenProps {
  onBack: () => void;
  context?: "hire" | "service" | "work";
  role: "seeker" | "provider";
  initialNotificationId?: string;
  onSelectJob?: (jobId: string, type?: string) => void;
  onSelectProfile?: (workerId: string) => void;
  onSelectRequest?: (requestId: string, kind?: string) => void;
  onSelectService?: (serviceId: string) => void;
  onSelectProviderRatingQueue?: (jobId: string) => void;
  onSelectReceivedRating?: (interactionId: string) => void;
  onSelectAcceptedApplication?: (interactionId: string) => void;
  onSelectCompletionPrompt?: (interactionId: string) => void;
  onSelectProviderFeedback?: (interactionId: string) => void;
}
function relativeTime(timestamp: number) {
  const diff = Math.max(0, Date.now() / 1000 - timestamp);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function groupLabel(timestamp: number) {
  const date = new Date(timestamp * 1000).toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date === new Date().toDateString()
    ? "Today"
    : date === yesterday.toDateString()
      ? "Yesterday"
      : "Earlier";
}
function notificationIcon(type: string) {
  if (type.startsWith("SERVICE_"))
    return {
      name: "construct-outline" as const,
      color: "#087653",
      bg: "#E4F4EC",
      label: "Service",
    };
  if (type === "NEW_JOB_NEARBY")
    return {
      name: "flash-outline" as const,
      color: "#087653",
      bg: "#E4F4EC",
      label: "Jobs",
    };
  if (type.startsWith("APPLICATION_"))
    return {
      name: type === "APPLICATION_CREATED" ? "briefcase-outline" as const : "checkmark-circle-outline" as const,
      color: type === "APPLICATION_CREATED" ? "#4765B6" : "#087653",
      bg: type === "APPLICATION_CREATED" ? "#ECF0FF" : "#E4F4EC",
      label: "Applications",
    };
  if (type.startsWith("JOB_"))
    return {
      name: type === "JOB_COMPLETED" ? "star-outline" as const : type.includes("COMPLET") ? "checkmark-done-circle-outline" as const : "briefcase-outline" as const,
      color: type === "JOB_COMPLETED" ? "#A66A12" : "#087653",
      bg: type === "JOB_COMPLETED" ? "#FFF4DE" : "#E4F4EC",
      label: "Jobs",
    };
  if (type === "APPLICATION_ACCEPTED")
    return {
      name: "checkmark-circle-outline" as const,
      color: "#087653",
      bg: "#E4F4EC",
      label: "Application update",
    };
  if (type.includes("CANCELLED") || type.includes("REJECTED"))
    return {
      name: "alert-circle-outline" as const,
      color: "#B76828",
      bg: "#FFF1E4",
      label: "Status update",
    };
  if (type === "APPLICATION_CREATED")
    return {
      name: "briefcase-outline" as const,
      color: "#4765B6",
      bg: "#ECF0FF",
      label: "New application",
    };
  return {
    name: "notifications-outline" as const,
    color: "#087653",
    bg: "#E4F4EC",
    label: "Update",
  };
}
function notificationTarget(
  item: AppNotification,
  key: "jobId" | "workerId" | "interactionId" | "serviceId",
): string | undefined {
  try {
    const data =
      typeof item.data === "string" ? JSON.parse(item.data) : item.data;
    return typeof data?.[key] === "string" && data[key].trim()
      ? data[key].trim()
      : undefined;
  } catch {
    return undefined;
  }
}
const jobIdFor = (item: AppNotification) => notificationTarget(item, "jobId");
export function NotificationsScreen({
  onBack,
  role,
  context = role === "provider" ? "hire" : "work",
  onSelectJob,
  onSelectProfile,
  onSelectRequest,
  onSelectService,
  onSelectProviderRatingQueue,
  onSelectReceivedRating,
  onSelectAcceptedApplication,
  onSelectCompletionPrompt,
  onSelectProviderFeedback,
  initialNotificationId,
}: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [searchVisible, setSearchVisible] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [inlineDeleteConfirm, setInlineDeleteConfirm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Selection & Bulk Delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const openOptions = (item: AppNotification) => {
    setInlineDeleteConfirm(false);
    setSelected(item);
  };
  const [busy, setBusy] = useState(false);
  const scope = context === "service" ? "service" : "work";
  const lock = useRef(false);
  const request = useRef(0);
  const enterSelectionMode = useCallback((initialId: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([initialId]));
    setSelected(null);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isSelectionMode) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      exitSelectionMode();
      return true;
    });
    return () => listener.remove();
  }, [isSelectionMode, exitSelectionMode]);

  const fetchNotifications = useCallback(async () => {
    const version = ++request.current;
    setError("");
    try {
      const res = await getNotificationInbox(role, scope);
      if (version !== request.current) return;
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      if (version === request.current) {
        setNotifications([]);
        setUnreadCount(0);
        setError("Couldn't load notifications. Pull down to try again.");
      }
    }
  }, [role, scope]);
  useEffect(() => {
    setQuery("");
    setFilter("All");
    setSelected(null);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setNotifications([]);
    setUnreadCount(0);
    setLoading(true);
    void fetchNotifications().finally(() => setLoading(false));
    return () => {
      request.current++;
    };
  }, [fetchNotifications]);
  const refresh = async () => {
    if (lock.current || refreshing) return;
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };
  // Commit only successful writes, so failures never hide or mislabel an item.
  const mutate = async (
    action: "read" | "unread" | "delete" | "read-all",
    item?: AppNotification,
  ) => {
    if (lock.current || refreshing) return false;
    lock.current = true;
    if (action !== "delete") setSelected(null);
    setBusy(true);
    setError("");
    request.current++;
    try {
      const path =
        action === "read-all"
          ? "/notifications/read-all"
          : `/notifications/${encodeURIComponent(item!.id)}${action === "delete" ? "" : `/${action}`}`;
      await api(
        `${path}?role=${role}&scope=${scope}`,
        undefined,
        action === "delete" ? "DELETE" : "POST",
      );
      setNotifications((prev) =>
        action === "read-all"
          ? prev.map((n) => ({ ...n, read: true }))
          : action === "delete"
            ? prev.filter((n) => n.id !== item!.id)
            : prev.map((n) =>
                n.id === item!.id ? { ...n, read: action === "read" } : n,
              ),
      );
      if (action === "delete") {
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            [
              "notifications",
              "provider-notifications",
              "seeker-notifications",
              "service-notifications",
              "activity",
            ].includes(String(queryKey[0])),
        });
      }
      setUnreadCount((prev) =>
        action === "read-all"
          ? 0
          : Math.max(
              0,
              prev +
                (action === "unread"
                  ? item!.read
                    ? 1
                    : 0
                  : !item!.read
                    ? -1
                    : 0),
            ),
      );
      setSelected(null);
      return true;
    } catch {
      setError("Couldn't save that change. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const executeBulkDelete = async (idsToDelete: string[], isAll: boolean) => {
    if (lock.current || refreshing || idsToDelete.length === 0) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    request.current++;
    try {
      try {
        await api(
          `/notifications/bulk-delete?role=${role}&scope=${scope}`,
          isAll ? { all: true } : { ids: idsToDelete },
          "POST",
        );
      } catch {
        // Fallback to individual DELETEs if bulk endpoint is unavailable
        await Promise.all(
          idsToDelete.map((id) =>
            api(
              `/notifications/${encodeURIComponent(id)}?role=${role}&scope=${scope}`,
              undefined,
              "DELETE",
            ),
          ),
        );
      }

      const toDeleteSet = new Set(idsToDelete);
      setNotifications((prev) =>
        isAll ? [] : prev.filter((n) => !toDeleteSet.has(n.id)),
      );

      setUnreadCount((prev) => {
        if (isAll) return 0;
        const deletedUnread = notifications.filter(
          (n) => toDeleteSet.has(n.id) && !n.read,
        ).length;
        return Math.max(0, prev - deletedUnread);
      });

      exitSelectionMode();

      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          [
            "notifications",
            "provider-notifications",
            "seeker-notifications",
            "service-notifications",
            "activity",
          ].includes(String(queryKey[0])),
      });

      return true;
    } catch {
      setError("Couldn't delete selected notifications. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    setShowDeleteConfirm(false);
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;
    const isAll = idsToDelete.length === notifications.length;
    await executeBulkDelete(idsToDelete, isAll);
  };
  const openNotification = async (item: AppNotification) => {
    if (!item.read && !(await mutate("read", item))) return;
    const jobId = jobIdFor(item);
    const interactionId = notificationTarget(item, "interactionId");
    const serviceId = notificationTarget(item, "serviceId");

    setSelected(null);

    if (item.type === "REVIEW_RECEIVED" && interactionId && onSelectReceivedRating) {
      onSelectReceivedRating(interactionId);
      return;
    }

    if (item.type === "APPLICATION_ACCEPTED" && interactionId && onSelectAcceptedApplication) {
      onSelectAcceptedApplication(interactionId);
      return;
    }

    // 1. Nearby job alert -> open the job details page
    if (item.type === "NEW_JOB_NEARBY" && jobId && onSelectJob) {
      onSelectJob(jobId, item.type);
      return;
    }

    // 2. Applicant created -> provider views applicants for this specific job posting
    if (item.type === "APPLICATION_CREATED" && role === "provider" && jobId && onSelectJob) {
      onSelectJob(jobId, item.type);
      return;
    }

    // 3. Completion confirmation or completed
    if (item.type === "JOB_COMPLETION_CONFIRMATION" || item.type === "JOB_COMPLETED") {
      if (item.type === "JOB_COMPLETED" && role === "provider" && interactionId && onSelectProviderFeedback) {
        onSelectProviderFeedback(interactionId);
        return;
      }
      if (role === "provider" && jobId && onSelectProviderRatingQueue) {
        onSelectProviderRatingQueue(jobId);
        return;
      }
      if (interactionId && onSelectCompletionPrompt) {
        onSelectCompletionPrompt(interactionId);
        return;
      }
      if (interactionId && onSelectRequest) {
        onSelectRequest(interactionId, "job");
        return;
      }
    }

    // 4. Seeker application status updates (accepted, rejected, cancelled)
    if (
      (item.type === "APPLICATION_ACCEPTED" ||
        item.type === "APPLICATION_REJECTED" ||
        item.type.includes("CANCELLED")) &&
      interactionId &&
      onSelectRequest
    ) {
      onSelectRequest(interactionId, "job");
      return;
    }

    // 5. Worksite location updated
    if (item.type === "JOB_LOCATION_UPDATED") {
      if (interactionId && onSelectRequest) {
        onSelectRequest(interactionId, "job");
        return;
      }
      if (jobId && onSelectJob) {
        onSelectJob(jobId, item.type);
        return;
      }
    }

    // 6. Service requests & updates
    if (item.type.startsWith("SERVICE_")) {
      if (interactionId && onSelectRequest) {
        onSelectRequest(interactionId, "service");
        return;
      }
      if (serviceId && onSelectService) {
        onSelectService(serviceId);
        return;
      }
    }

    // Fallbacks
    if (role === "provider" && jobId && onSelectJob) {
      onSelectJob(jobId, item.type);
      return;
    }
    if (interactionId && onSelectRequest) {
      onSelectRequest(interactionId, item.type.startsWith("SERVICE_") ? "service" : "job");
      return;
    }
    if (jobId && onSelectJob) {
      onSelectJob(jobId, item.type);
      return;
    }
    if (serviceId && onSelectService) {
      onSelectService(serviceId);
      return;
    }
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };
  const openProfile = async (item: AppNotification) => {
    const workerId = notificationTarget(item, "workerId");
    if (
      role !== "provider" ||
      item.type !== "APPLICATION_CREATED" ||
      !workerId ||
      !onSelectProfile
    )
      return;
    if (!item.read && !(await mutate("read", item))) return;
    setSelected(null);
    onSelectProfile(workerId);
  };
  const search = query.trim().toLocaleLowerCase();
  const tabs = context === "service"
    ? ["All", "Unread", "System", "Services"]
    : ["All", "Unread", "System", "Jobs", "Applications"];
  const filtered = notifications.filter(
    (n) =>
      (filter === "All" || (filter === "Unread" && !n.read) ||
        (filter === "System" && !n.type.startsWith("JOB_") && n.type !== "NEW_JOB_NEARBY" && !n.type.startsWith("APPLICATION_") && !n.type.startsWith("SERVICE_")) ||
        (filter === "Jobs" && (n.type.startsWith("JOB_") || n.type === "NEW_JOB_NEARBY")) ||
        (filter === "Applications" && n.type.startsWith("APPLICATION_")) ||
        (filter === "Services" && n.type.startsWith("SERVICE_"))) &&
      `${n.title} ${n.message} ${notificationIcon(n.type).label}`
        .toLocaleLowerCase()
        .includes(search),
  );

  const isAllSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filtered) {
          next.delete(item.id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filtered) {
          next.add(item.id);
        }
        return next;
      });
    }
  }, [isAllSelected, filtered]);
  const canOpen =
    selected &&
    Boolean(
      (jobIdFor(selected) && onSelectJob) ||
        (notificationTarget(selected, "interactionId") && onSelectRequest) ||
        (notificationTarget(selected, "serviceId") && onSelectService),
    );
  const canOpenProfile =
    selected &&
    role === "provider" &&
    selected.type === "APPLICATION_CREATED" &&
    notificationTarget(selected, "workerId") &&
    onSelectProfile;
  const detailActionLabel = selected?.type.startsWith("SERVICE_")
    ? "View service request"
    : role === "provider" && selected?.type === "JOB_COMPLETED"
      ? "Share your feedback"
      : selected?.type === "JOB_COMPLETION_CONFIRMATION"
        ? "Confirm completed work"
      : selected && notificationTarget(selected, "interactionId")
        ? "View request"
        : "View job";
  const modeLabel = context === "service" ? "Find a service" : role === "provider" ? "Hire someone" : "Find work";
  const pageTitle = context === "service" ? "Service notifications" : role === "provider" ? "Hire notifications" : "Work notifications";
  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.sheet,
          { paddingTop: insets.top + 20, paddingBottom: 16 },
        ]}
      >
        {isSelectionMode ? (
          <View style={styles.selectionToolbar}>
            <View style={styles.selectionLeft}>
              <Pressable
                style={styles.iconButton}
                onPress={exitSelectionMode}
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text style={styles.selectionCount}>
                {selectedIds.size} Selected
              </Text>
            </View>

            <View style={styles.selectionRight}>
              <Pressable
                onPress={handleToggleSelectAll}
                accessibilityRole="button"
                style={styles.selectAllButton}
                hitSlop={8}
              >
                <Text style={styles.selectAllText}>
                  {isAllSelected ? "Deselect All" : "Select All"}
                </Text>
              </Pressable>

              <Pressable
                disabled={selectedIds.size === 0 || busy}
                onPress={() => setShowDeleteConfirm(true)}
                accessibilityRole="button"
                accessibilityLabel="Delete selected notifications"
                style={[
                  styles.deleteIconButton,
                  (selectedIds.size === 0 || busy) && styles.disabled,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={selectedIds.size === 0 ? "#9CA3AF" : "#DC2626"}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable
              style={styles.iconButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.modeLabel} numberOfLines={1}>{modeLabel}</Text>
            <Pressable
              style={styles.headerSearchButton}
              onPress={() => {
                if (searchVisible) {
                  setQuery("");
                  setSearchVisible(false);
                } else {
                  setSearchVisible(true);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={searchVisible ? "Close search" : "Search notifications"}
            >
              <Ionicons name={searchVisible ? "close" : "search-outline"} size={21} color={colors.ink} />
            </Pressable>
          </View>
        )}
        <View style={styles.heading}>
          <Text style={styles.title}>{pageTitle}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusText}>
              <View style={[styles.statusDot, !unreadCount && styles.quietDot]} />
              <Text style={styles.statusLabel}>
                {loading ? "Loading your updates" : "You're all caught up"}
              </Text>
            </View>
            <Pressable
              disabled={!unreadCount || busy || loading || refreshing}
              onPress={() => void mutate("read-all")}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              style={[styles.readAll, (!unreadCount || busy || loading || refreshing) && styles.disabled]}
            >
              <Ionicons name="checkmark-done-outline" size={15} color={colors.green} />
              <Text style={styles.readAllText}>Read all</Text>
            </Pressable>
          </View>
        </View>
        {searchVisible && (
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search notifications"
              placeholderTextColor="#7A8882"
              accessibilityLabel="Search notifications"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={19} color={colors.muted} />
              </Pressable>
            )}
          </View>
        )}
        <ScrollView style={styles.tabsViewport} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((value) => (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                style={[styles.tab, filter === value && styles.activeTab]}
              >
                <Text
                  style={[
                    styles.tabText,
                    filter === value && styles.activeTabText,
                  ]}
                >
                  {value === "Unread" && unreadCount ? `Unread (${unreadCount})` : value}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
        {!!error && (
          <View style={styles.error} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color="#9D422F" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void refresh()}
              disabled={busy || refreshing}
              accessibilityRole="button"
            >
              <Text style={styles.markAllText}>Retry</Text>
            </Pressable>
          </View>
        )}
        {busy && (
          <ActivityIndicator color={colors.green} style={{ marginBottom: 8 }} />
        )}
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={styles.emptyText}>Getting your updates...</Text>
          </View>
        ) : (
          <FlatList
            extraData={{ selectedId: selected?.id, expandedId, isSelectionMode, selectedIdsCount: selectedIds.size, selectedIds }}
            onScrollBeginDrag={() => setSelected(null)}
            onMomentumScrollBegin={() => setSelected(null)}
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.flex}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.green}
                colors={[colors.green]}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      search ? "search-outline" : "notifications-off-outline"
                    }
                    size={34}
                    color={colors.green}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {search
                    ? "No matching updates"
                    : filter === "Unread"
                      ? "You're all caught up"
                      : "A little quiet here"}
                </Text>
                <Text style={styles.emptyText}>
                  {search
                    ? "Try a different name, job or keyword."
                    : filter === "Unread"
                      ? "You've read all your recent notifications."
                      : role === "provider"
                        ? "New applications and job updates will appear here."
                        : "Application responses and job updates will appear here."}
                </Text>
                {(!!query || filter !== "All") && (
                  <Pressable
                    style={styles.reset}
                    onPress={() => {
                      setQuery("");
                      setFilter("All");
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.markAllText}>
                      View all notifications
                    </Text>
                  </Pressable>
                )}
              </View>
            }
            renderItem={({ item, index }) => {
              const icon = notificationIcon(item.type);
              const group = groupLabel(item.createdAt);
              const isSelected = selectedIds.has(item.id);
              return (
                <View>
                  {(index === 0 ||
                    groupLabel(filtered[index - 1]!.createdAt) !== group) && (
                    <Text style={styles.group}>{group}</Text>
                  )}
                  <View style={[
                    styles.card,
                    !item.read && styles.unreadCard,
                    isSelectionMode && isSelected && styles.selectedCard,
                  ]}>
                    <View style={styles.cardMain}>
                      {isSelectionMode && (
                        <Pressable
                          hitSlop={6}
                          onPress={() => toggleSelect(item.id)}
                          style={styles.checkboxWrapper}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={isSelected ? colors.green : "#9CA3AF"}
                          />
                        </Pressable>
                      )}
                      <Pressable
                        disabled={busy || refreshing}
                        delayLongPress={220}
                        onLongPress={() => {
                          if (isSelectionMode) {
                            toggleSelect(item.id);
                          } else {
                            enterSelectionMode(item.id);
                          }
                        }}
                        onPress={() => {
                          if (isSelectionMode) {
                            toggleSelect(item.id);
                          } else {
                            void openNotification(item);
                          }
                        }}
                        style={styles.cardBody}
                        accessibilityRole="button"
                        accessibilityState={{
                          expanded: !isSelectionMode && expandedId === item.id,
                          selected: isSelectionMode && isSelected,
                        }}
                        accessibilityLabel={`${item.read ? "" : "Unread: "}${item.title}. ${item.message}`}
                      >
                        <View
                          style={[
                            styles.cardIcon,
                            { backgroundColor: icon.bg },
                          ]}
                        >
                          <Ionicons
                            name={icon.name}
                            size={23}
                            color={icon.color}
                          />
                        </View>
                        <View style={styles.cardCopy}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                            {!item.read && <View style={styles.dot} />}
                          </View>
                          <Text
                            style={styles.message}
                            numberOfLines={
                              expandedId === item.id ? undefined : 2
                            }
                          >
                            {item.message}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.cardEnd}>
                        <Text style={styles.compactTime}>{relativeTime(item.createdAt).replace(" ago", "")}</Text>
                        <Pressable
                          disabled={busy || refreshing}
                          style={[
                            styles.more,
                            selected?.id === item.id && styles.moreActive,
                          ]}
                          onPress={() => {
                            if (isSelectionMode) {
                              toggleSelect(item.id);
                            } else {
                              openOptions(item);
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityState={{
                            expanded: selected?.id === item.id,
                          }}
                          accessibilityLabel={`Options for ${item.title}`}
                        >
                          <Ionicons name="ellipsis-horizontal" size={21} color={colors.green} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
        <Modal
          visible={!!selected}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => { if (!busy) setSelected(null); }}
        >
          <View style={styles.actionSheetOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => { if (!busy) setSelected(null); }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification options"
            />
            <View
              style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
              accessibilityViewIsModal
            >
              <View style={styles.actionSheetHandle} />
              <View style={styles.actionSheetHeader}>
                <View style={styles.actionSheetHeadingCopy}>
                  <Text style={styles.actionSheetTitle}>Notification options</Text>
                  {!!selected && <Text numberOfLines={1} style={styles.actionSheetSubtitle}>{selected.title}</Text>}
                </View>
                <Pressable
                  onPress={() => setSelected(null)}
                  disabled={busy}
                  style={styles.actionSheetClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close notification options"
                >
                  <Ionicons name="close" size={20} color="#596A60" />
                </Pressable>
              </View>
              {selected && (
                <ScrollView
                  style={styles.actionSheetOptions}
                  contentContainerStyle={styles.actionSheetContent}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {!!canOpen && (
                    <Pressable
                      style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                      disabled={busy}
                      onPress={() => void openNotification(selected)}
                      accessibilityRole="button"
                    >
                      <View style={styles.sheetOptionMain}>
                        <View style={styles.sheetOptionIcon}><Ionicons name={selected.type.startsWith("SERVICE_") ? "construct-outline" : "briefcase-outline"} size={18} color={colors.green} /></View>
                        <Text style={styles.sheetOptionText}>{detailActionLabel}</Text>
                      </View>
                    </Pressable>
                  )}
                  {!!canOpenProfile && (
                    <Pressable
                      style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                      disabled={busy}
                      onPress={() => void openProfile(selected)}
                      accessibilityRole="button"
                    >
                      <View style={styles.sheetOptionMain}>
                        <View style={styles.sheetOptionIcon}><Ionicons name="person-outline" size={18} color={colors.green} /></View>
                        <Text style={styles.sheetOptionText}>View profile</Text>
                      </View>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                    onPress={() => {
                      setExpandedId(selected.id);
                      setSelected(null);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.sheetOptionMain}>
                      <View style={styles.sheetOptionIcon}><Ionicons name="reader-outline" size={18} color={colors.green} /></View>
                      <Text style={styles.sheetOptionText}>View details</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                    disabled={busy}
                    onPress={() => void mutate(selected.read ? "unread" : "read", selected)}
                    accessibilityRole="button"
                  >
                    <View style={styles.sheetOptionMain}>
                      <View style={styles.sheetOptionIcon}>
                        <Ionicons name={selected.read ? "mail-unread-outline" : "checkmark-done-outline"} size={18} color={colors.green} />
                      </View>
                      <Text style={styles.sheetOptionText}>Mark as {selected.read ? "unread" : "read"}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.sheetOptionDivider} />
                  {!inlineDeleteConfirm ? (
                    <Pressable
                      style={({ pressed }) => [styles.sheetOption, styles.sheetDeleteOption, pressed && styles.sheetOptionPressed]}
                      disabled={busy}
                      onPress={() => setInlineDeleteConfirm(true)}
                      accessibilityRole="button"
                    >
                      <View style={styles.sheetOptionMain}>
                        <View style={[styles.sheetOptionIcon, styles.sheetDeleteIcon]}><Ionicons name="trash-outline" size={18} color="#BB4439" /></View>
                        <Text style={[styles.sheetOptionText, styles.sheetDeleteText]}>Delete notification</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={styles.inlineDeleteConfirm}>
                      <Text style={styles.inlineDeletePrompt}>Delete this notification?</Text>
                      {!!error && <Text style={styles.inlineDeleteError}>{error}</Text>}
                      <View style={styles.inlineDeleteActions}>
                        <Pressable
                          style={styles.inlineCancelButton}
                          disabled={busy}
                          onPress={() => setInlineDeleteConfirm(false)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.inlineCancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineDeleteButton}
                          disabled={busy}
                          onPress={() => void mutate("delete", selected)}
                          accessibilityRole="button"
                        >
                          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.inlineDeleteText}>Delete</Text>}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowDeleteConfirm(false)}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="trash-outline" size={22} color="#DC2626" />
              </View>
              <Text style={styles.modalTitle}>
                {selectedIds.size === notifications.length
                  ? "Delete all notifications?"
                  : `Delete ${selectedIds.size} notification${selectedIds.size === 1 ? "" : "s"}?`}
              </Text>
              <Text style={styles.modalMessage}>
                {selectedIds.size === notifications.length
                  ? "Are you sure you want to remove all notifications?"
                  : "These notifications will be removed from your notification list."}
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setShowDeleteConfirm(false)}
                  hitSlop={6}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalDeleteBtn}
                  onPress={() => void confirmBulkDelete()}
                  hitSlop={6}
                >
                  <Text style={styles.modalDeleteText}>
                    {selectedIds.size === notifications.length ? "Delete all" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  modeLabel: {
    flex: 1,
    color: "#596A60",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSearchButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  heading: { paddingHorizontal: 22, paddingTop: 17, paddingBottom: 7 },
  statusRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
  },
  statusText: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#199467" },
  quietDot: { backgroundColor: "#A7B2AA" },
  statusLabel: { color: "#758279", fontSize: 12 },
  readAll: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  readAllText: { color: colors.green, fontSize: 12, fontWeight: "600" },
  search: {
    marginHorizontal: 22,
    marginTop: 4,
    marginBottom: 7,
    paddingLeft: 13,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E0E8E2",
    backgroundColor: "#FFF",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    fontSize: 13,
    color: colors.ink,
  },
  clear: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsViewport: {
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEE9",
  },
  tabs: {
    paddingHorizontal: 22,
    gap: 25,
    minHeight: 47,
    alignItems: "stretch",
  },
  tab: {
    minHeight: 47,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: "#087653" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#728078" },
  activeTabText: { color: "#087653", fontWeight: "700" },
  markAllText: { color: colors.green, fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  list: { paddingHorizontal: 18, paddingBottom: 20, flexGrow: 1 },
  group: {
    fontSize: 12,
    fontWeight: "700",
    color: "#758279",
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 2,
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: 14,
    marginBottom: 16,
  },
  cardMain: { flexDirection: "row" },
  unreadCard: { backgroundColor: "#F7FBF8" },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingLeft: 5,
    gap: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#199467" },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#203D30",
    lineHeight: 20,
    flex: 1,
  },
  message: { fontSize: 12, color: "#6A796F", lineHeight: 18, marginTop: 3 },
  cardEnd: { width: 47, alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", paddingTop: 5, paddingBottom: 1 },
  compactTime: { fontSize: 9, color: "#7A8980" },
  more: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    borderRadius: 12,
    backgroundColor: "#EFF4F0",
  },
  moreActive: { backgroundColor: "#DDEEE3" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    minHeight: 240,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: "#E7F3EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#203D30",
    textAlign: "center",
  },
  emptyText: {
    color: "#758279",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
    textAlign: "center",
    maxWidth: 260,
  },
  reset: { padding: 16 },
  error: {
    marginHorizontal: 22,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFF0E9",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18, color: "#9D422F" },
  actionSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(15, 33, 25, 0.38)",
  },
  actionSheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "52%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 9,
    paddingHorizontal: 20,
    shadowColor: "#193D2E",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 16,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DCE4DF",
    alignSelf: "center",
    marginBottom: 10,
  },
  actionSheetHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EF",
  },
  actionSheetHeadingCopy: { flex: 1, minWidth: 0 },
  actionSheetTitle: { color: "#193C2E", fontSize: 16, fontWeight: "700" },
  actionSheetSubtitle: { color: "#7B8980", fontSize: 11, marginTop: 2 },
  actionSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetOptions: { flexShrink: 1 },
  actionSheetContent: { paddingTop: 7, paddingBottom: 4 },
  sheetOption: {
    width: "100%",
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 11,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginVertical: 3,
    backgroundColor: "#FAFCFA",
    borderWidth: 1,
    borderColor: "#E8EEE9",
  },
  sheetOptionMain: { flex: 1, minWidth: 0, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 13 },
  sheetOptionPressed: { backgroundColor: "#F3F7F4" },
  sheetOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#EDF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionText: { flex: 1, color: "#203D30", fontSize: 14, fontWeight: "600" },
  sheetOptionDivider: { height: 1, backgroundColor: "#EDF1EE", marginVertical: 7, marginLeft: 51 },
  sheetDeleteOption: { marginTop: 3, backgroundColor: "#FFF8F7", borderColor: "#F4E4E1" },
  sheetDeleteIcon: { backgroundColor: "#FFF0ED" },
  sheetDeleteText: { color: "#BB4439" },
  inlineDeleteConfirm: { marginTop: 3, padding: 12, borderRadius: 14, backgroundColor: "#FFF8F7", borderWidth: 1, borderColor: "#F4E4E1", gap: 10 },
  inlineDeletePrompt: { color: "#7A302B", fontSize: 13, fontWeight: "600" },
  inlineDeleteError: { color: "#A73B32", fontSize: 11, lineHeight: 15 },
  inlineDeleteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  inlineCancelButton: { minWidth: 76, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#F2F4F2", paddingHorizontal: 12 },
  inlineCancelText: { color: "#53645A", fontSize: 12, fontWeight: "700" },
  inlineDeleteButton: { minWidth: 76, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#C9443A", paddingHorizontal: 12 },
  inlineDeleteText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  selectionToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    minHeight: 44,
  },
  selectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#203D30",
    letterSpacing: -0.3,
  },
  selectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.green,
  },
  deleteIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxWrapper: {
    paddingLeft: 8,
    paddingRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCard: {
    backgroundColor: "#EBF5F0",
    borderRadius: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
