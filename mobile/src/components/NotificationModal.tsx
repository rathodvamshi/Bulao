import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { api } from "../api/client";
import type { AppNotification } from "../api/types";

export interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectJob?: (jobId: string) => void;
  onNavigateToApplications?: () => void;
}

function formatRelativeTime(timestampSec?: number): string {
  if (!timestampSec) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestampSec);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestampSec * 1000).toLocaleDateString();
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "APPLICATION_ACCEPTED":
      return { name: "checkmark-circle" as const, color: colors.success, bg: colors.greenLight };
    case "APPLICATION_REJECTED":
      return { name: "close-circle" as const, color: colors.muted, bg: "#F3F4F6" };
    case "APPLICATION_CREATED":
      return { name: "briefcase" as const, color: colors.green, bg: colors.greenLight };
    case "APPLICATION_CANCELLED":
    case "JOB_CANCELLED":
      return { name: "alert-circle" as const, color: colors.error, bg: colors.errorBg };
    default:
      return { name: "notifications" as const, color: colors.ink, bg: "#F3F4F6" };
  }
}

export function NotificationModal({
  visible,
  onClose,
  onSelectJob,
  onNavigateToApplications,
}: NotificationModalProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api<{ items: AppNotification[]; unreadCount: number }>("/notifications");
      setNotifications(res?.items || []);
      setUnreadCount(res?.unreadCount || 0);
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [visible, fetchNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (item: AppNotification) => {
    if (!item.read) {
      // optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await api(`/notifications/${item.id}/read`, { method: "POST" });
      } catch {
        // silent fail
      }
    }

    // Handle deep navigation
    const data = typeof item.data === "string" ? JSON.parse(item.data || "{}") : (item.data || {});
    if (data?.jobId && onSelectJob) {
      onClose();
      onSelectJob(data.jobId);
    } else if (onNavigateToApplications) {
      onClose();
      onNavigateToApplications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {
      // silent fail
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <Pressable onPress={handleMarkAllRead} hitSlop={8} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityLabel="Close notifications"
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.centerContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={32} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                You will be notified here when employers accept or update your applications.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[colors.green]}
                />
              }
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const icon = getNotificationIcon(item.type);
                return (
                  <Pressable
                    style={[styles.notificationCard, !item.read && styles.unreadCard]}
                    onPress={() => handleMarkAsRead(item)}
                    android_ripple={{ color: "#E5E7EB" }}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                      <Ionicons name={icon.name} size={20} color={icon.color} />
                    </View>
                    <View style={styles.cardContent}>
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
                          {item.title}
                        </Text>
                        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
                      </View>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {item.message}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "80%",
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  unreadBadge: {
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.green,
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  unreadCard: {
    backgroundColor: "#F9FAFB",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  timeText: {
    fontSize: 11,
    color: colors.muted,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    marginLeft: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});
