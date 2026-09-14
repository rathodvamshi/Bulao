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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./ui";
import { api } from "../api/client";
import { getNotificationInbox } from "../api/notifications";
import type { AppNotification } from "../api/types";

export interface NotificationsScreenProps {
  onBack: () => void;
  role: "seeker" | "provider";
  onSelectJob?: (jobId: string) => void;
  onSelectProfile?: (workerId: string) => void;
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
  key: "jobId" | "workerId",
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
  onSelectJob,
  onSelectProfile,
}: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [menuHeight, setMenuHeight] = useState(0);
  const pageRef = useRef<View>(null);
  const optionButtons = useRef(new Map<string, View>());
  const openOptions = (item: AppNotification) => {
    const button = optionButtons.current.get(item.id);
    if (!button || !pageRef.current) return;
    pageRef.current.measureInWindow((pageX, pageY) => {
      button.measureInWindow((x, y, width, height) => {
        if (!width || !height) return;
        setAnchor({ x: x - pageX, y: y - pageY, width, height });
        setMenuHeight(0);
        setSelected(item);
      });
    });
  };
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(0);
  useEffect(() => {
    if (!selected) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelected(null);
      return true;
    });
    return () => listener.remove();
  }, [selected]);
  const fetchNotifications = useCallback(async () => {
    const version = ++request.current;
    setError("");
    try {
      const res = await getNotificationInbox(role);
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
  }, [role]);
  useEffect(() => {
    setQuery("");
    setFilter("all");
    setSelected(null);
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
    setSelected(null);
    setBusy(true);
    setError("");
    request.current++;
    try {
      const path =
        action === "read-all"
          ? "/notifications/read-all"
          : `/notifications/${encodeURIComponent(item!.id)}${action === "delete" ? "" : `/${action}`}`;
      await api(
        `${path}?role=${role}`,
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
      setSelected(null);
      setError("Couldn't save that change. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const openNotification = async (item: AppNotification) => {
    if (!item.read && !(await mutate("read", item))) return;
    const jobId = jobIdFor(item);
    if (jobId && onSelectJob) {
      setSelected(null);
      onSelectJob(jobId);
    }
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
  const filtered = notifications.filter(
    (n) =>
      (filter === "all" || !n.read) &&
      `${n.title} ${n.message} ${notificationIcon(n.type).label}`
        .toLocaleLowerCase()
        .includes(search),
  );
  const canOpen = selected && jobIdFor(selected) && onSelectJob;
  const canOpenProfile =
    selected &&
    role === "provider" &&
    selected.type === "APPLICATION_CREATED" &&
    notificationTarget(selected, "workerId") &&
    onSelectProfile;
  const menuWidth = Math.min(244, Math.max(0, pageSize.width - 24));
  const spaceBelow = anchor
    ? Math.max(0, pageSize.height - anchor.y - anchor.height - 20)
    : 0;
  const spaceAbove = anchor ? Math.max(0, anchor.y - insets.top - 20) : 0;
  const openAbove =
    spaceBelow < (menuHeight || (canOpenProfile ? 300 : 248)) &&
    spaceAbove > spaceBelow;
  const menuLeft = anchor
    ? Math.max(
        12,
        Math.min(
          anchor.x + anchor.width - menuWidth,
          pageSize.width - menuWidth - 12,
        ),
      )
    : 12;
  const menuTop = anchor
    ? openAbove
      ? anchor.y - menuHeight - 8
      : anchor.y + anchor.height + 8
    : 0;
  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        ref={pageRef}
        collapsable={false}
        onLayout={({ nativeEvent: { layout } }) => {
          setPageSize({ width: layout.width, height: layout.height });
          setSelected(null);
        }}
        style={[
          styles.sheet,
          { paddingTop: insets.top + 20, paddingBottom: 16 },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.iconButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              {role === "provider" ? "PROVIDER UPDATES" : "SEEKER UPDATES"}
            </Text>
            <Text style={styles.title}>Notifications</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {role === "provider"
            ? "Stay on top of applicants and your posted jobs."
            : "Your next opportunity starts with an update."}
        </Text>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search recent notifications"
            placeholderTextColor="#7A8882"
            accessibilityLabel="Search notifications"
            autoCorrect={false}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable
              onPress={() => setQuery("")}
              style={styles.clear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {(["all", "unread"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                style={[styles.chip, filter === value && styles.activeChip]}
              >
                <Text
                  style={[
                    styles.chipText,
                    filter === value && styles.activeChipText,
                  ]}
                >
                  {value === "all"
                    ? "All"
                    : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={!unreadCount || busy || loading || refreshing}
            onPress={() => void mutate("read-all")}
            accessibilityRole="button"
            style={styles.markAll}
          >
            <Text
              style={[
                styles.markAllText,
                (!unreadCount || busy) && styles.disabled,
              ]}
            >
              Mark all read
            </Text>
          </Pressable>
        </View>
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
            extraData={{ selectedId: selected?.id, expandedId }}
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
                    : filter === "unread"
                      ? "You're all caught up"
                      : "A little quiet here"}
                </Text>
                <Text style={styles.emptyText}>
                  {search
                    ? "Try a different name, job or keyword."
                    : filter === "unread"
                      ? "You've read all your recent notifications."
                      : role === "provider"
                        ? "New applications and job updates will appear here."
                        : "Application responses and job updates will appear here."}
                </Text>
                {(!!query || filter !== "all") && (
                  <Pressable
                    style={styles.reset}
                    onPress={() => {
                      setQuery("");
                      setFilter("all");
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
              const newApplicant =
                role === "provider" && item.type === "APPLICATION_CREATED";
              const showJob =
                !!onSelectJob &&
                !!jobIdFor(item) &&
                (newApplicant ||
                  (role === "seeker" && item.type === "APPLICATION_ACCEPTED"));
              const showProfile =
                newApplicant &&
                !!onSelectProfile &&
                !!notificationTarget(item, "workerId");
              return (
                <View>
                  {(index === 0 ||
                    groupLabel(filtered[index - 1]!.createdAt) !== group) && (
                    <Text style={styles.group}>{group}</Text>
                  )}
                  <View style={[styles.card, !item.read && styles.unreadCard]}>
                    <View style={styles.cardMain}>
                      <Pressable
                        disabled={busy || refreshing}
                        onPress={() =>
                          setExpandedId(expandedId === item.id ? null : item.id)
                        }
                        style={styles.cardBody}
                        accessibilityRole="button"
                        accessibilityState={{
                          expanded: expandedId === item.id,
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
                        <View style={styles.flex}>
                          <View style={styles.meta}>
                            <Text style={styles.category}>{icon.label}</Text>
                            {!item.read && <View style={styles.dot} />}
                          </View>
                          <Text style={styles.cardTitle}>{item.title}</Text>
                          <Text
                            style={styles.message}
                            numberOfLines={
                              expandedId === item.id ? undefined : 3
                            }
                          >
                            {item.message}
                          </Text>
                          <Text style={styles.time}>
                            {relativeTime(item.createdAt)}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        ref={(button) => {
                          if (button)
                            optionButtons.current.set(item.id, button);
                          else optionButtons.current.delete(item.id);
                        }}
                        disabled={busy || refreshing}
                        style={[
                          styles.more,
                          selected?.id === item.id && styles.moreActive,
                        ]}
                        onPress={() => openOptions(item)}
                        accessibilityRole="button"
                        accessibilityState={{
                          expanded: selected?.id === item.id,
                        }}
                        accessibilityLabel={`Options for ${item.title}`}
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={21}
                          color={colors.muted}
                        />
                      </Pressable>
                    </View>
                    {(showJob || showProfile) && (
                      <View style={styles.cardActions}>
                        {showProfile && (
                          <Pressable
                            disabled={busy || refreshing}
                            onPress={() => void openProfile(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`View applicant profile for ${item.title}`}
                            style={({ pressed }) => [
                              styles.cardAction,
                              styles.primaryAction,
                              pressed && styles.actionPressed,
                              (busy || refreshing) && styles.disabled,
                            ]}
                          >
                            <Ionicons
                              name="person-outline"
                              size={16}
                              color="#FFF"
                            />
                            <Text style={styles.primaryActionText}>
                              View profile
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={15}
                              color="#FFF"
                            />
                          </Pressable>
                        )}
                        {showJob && (
                          <Pressable
                            disabled={busy || refreshing}
                            onPress={() => void openNotification(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`View job for ${item.title}`}
                            style={({ pressed }) => [
                              styles.cardAction,
                              showProfile
                                ? styles.secondaryAction
                                : styles.primaryAction,
                              pressed && styles.actionPressed,
                              (busy || refreshing) && styles.disabled,
                            ]}
                          >
                            <Ionicons
                              name="briefcase-outline"
                              size={16}
                              color={showProfile ? colors.green : "#FFF"}
                            />
                            <Text
                              style={
                                showProfile
                                  ? styles.secondaryActionText
                                  : styles.primaryActionText
                              }
                            >
                              View job
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={15}
                              color={showProfile ? colors.green : "#FFF"}
                            />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
        {selected && anchor && (
          <View style={styles.menuOverlay} accessibilityViewIsModal>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification options"
            />
            <View
              style={[
                styles.menu,
                {
                  left: menuLeft,
                  top: menuTop,
                  width: menuWidth,
                  opacity: menuHeight ? 1 : 0,
                },
              ]}
              onLayout={({ nativeEvent: { layout } }) =>
                setMenuHeight(layout.height)
              }
            >
              <View
                pointerEvents="none"
                style={[
                  styles.menuPointer,
                  {
                    left: Math.max(
                      16,
                      Math.min(
                        menuWidth - 26,
                        anchor.x + anchor.width / 2 - menuLeft - 5,
                      ),
                    ),
                  },
                  openAbove ? { bottom: -5 } : { top: -5 },
                ]}
              />
              <ScrollView
                style={{
                  maxHeight: Math.max(
                    44,
                    (openAbove ? spaceAbove : spaceBelow) - 14,
                  ),
                }}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.menuHeader}>
                  <Text style={styles.menuHeading}>QUICK ACTIONS</Text>
                  <View
                    style={[
                      styles.menuStatusDot,
                      selected.read && styles.menuStatusRead,
                    ]}
                  />
                  <Text style={styles.menuStatusText}>
                    {selected.read ? "Read" : "Unread"}
                  </Text>
                </View>
                {!!canOpenProfile && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuAction,
                      pressed && styles.menuActionPressed,
                    ]}
                    disabled={busy}
                    onPress={() => void openProfile(selected)}
                    accessibilityRole="button"
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="person-outline"
                        size={17}
                        color={colors.green}
                      />
                    </View>
                    <Text style={styles.menuText}>View profile</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#91A096"
                    />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuAction,
                    pressed && styles.menuActionPressed,
                  ]}
                  onPress={() => {
                    setExpandedId(selected.id);
                    setSelected(null);
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.menuIcon}>
                    <Ionicons
                      name="reader-outline"
                      size={17}
                      color={colors.green}
                    />
                  </View>
                  <Text style={styles.menuText}>View details</Text>
                </Pressable>
                {!!canOpen && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuAction,
                      pressed && styles.menuActionPressed,
                    ]}
                    disabled={busy}
                    onPress={() => void openNotification(selected)}
                    accessibilityRole="button"
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name="briefcase-outline"
                        size={17}
                        color={colors.green}
                      />
                    </View>
                    <Text style={styles.menuText}>View job</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#91A096"
                    />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuAction,
                    pressed && styles.menuActionPressed,
                  ]}
                  disabled={busy}
                  onPress={() =>
                    void mutate(selected.read ? "unread" : "read", selected)
                  }
                  accessibilityRole="button"
                >
                  <View style={styles.menuIcon}>
                    <Ionicons
                      name={
                        selected.read
                          ? "mail-unread-outline"
                          : "checkmark-done-outline"
                      }
                      size={17}
                      color={colors.green}
                    />
                  </View>
                  <Text style={styles.menuText}>
                    Mark as {selected.read ? "unread" : "read"}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuAction,
                    styles.deleteAction,
                    pressed && styles.menuActionPressed,
                  ]}
                  disabled={busy}
                  onPress={() => void mutate("delete", selected)}
                  accessibilityRole="button"
                >
                  <View style={[styles.menuIcon, styles.deleteIcon]}>
                    <Ionicons name="trash-outline" size={17} color="#BB4439" />
                  </View>
                  <Text style={[styles.menuText, { color: "#BB4439" }]}>
                    Delete notification
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "#FAFCFA",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    flex: 1,
    backgroundColor: "#FAFCFA",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "700",
    marginBottom: 3,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#193C2E",
    letterSpacing: -0.7,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDF2EE",
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    color: "#758279",
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 22,
    marginTop: 12,
    marginBottom: 20,
  },
  search: {
    marginHorizontal: 22,
    paddingLeft: 14,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E0E8E2",
    backgroundColor: "#FFF",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 14,
    color: colors.ink,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  filters: { flexDirection: "row", gap: 7 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#EDF2EE",
  },
  activeChip: { backgroundColor: "#075B43" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#64756B" },
  activeChipText: { color: "#FFF" },
  markAll: { minHeight: 44, justifyContent: "center" },
  markAllText: { color: colors.green, fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  list: { paddingHorizontal: 18, paddingBottom: 20, flexGrow: 1 },
  group: {
    fontSize: 12,
    fontWeight: "700",
    color: "#758279",
    marginTop: 8,
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E8EDE9",
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardMain: { flexDirection: "row" },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2EDE6",
  },
  cardAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    flexGrow: 1,
  },
  primaryAction: {
    backgroundColor: "#075B43",
    borderWidth: 1,
    borderColor: "#075B43",
  },
  secondaryAction: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#C9DFD1",
  },
  primaryActionText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  secondaryActionText: { fontSize: 12, fontWeight: "700", color: "#075B43" },
  actionPressed: { opacity: 0.75 },
  unreadCard: { backgroundColor: "#F0F8F3", borderColor: "#D5E8DD" },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingLeft: 14,
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  category: {
    fontSize: 10,
    fontWeight: "600",
    color: "#728278",
    flexShrink: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#199467" },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#203D30",
    lineHeight: 20,
  },
  message: { fontSize: 12, color: "#6A796F", lineHeight: 19, marginTop: 4 },
  time: { fontSize: 10, fontWeight: "500", color: "#87948B", marginTop: 9 },
  more: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    borderRadius: 14,
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
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  menu: {
    position: "absolute",
    borderRadius: 18,
    padding: 7,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DCE7E0",
    shadowColor: "#163D2C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 12,
  },
  menuPointer: {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#FFF",
    transform: [{ rotate: "45deg" }],
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  menuActionPressed: { backgroundColor: "#F0F6F2" },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 11,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3EF",
  },
  menuHeading: {
    flex: 1,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: "700",
    color: "#7B8B80",
  },
  menuStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#199467",
  },
  menuStatusRead: { backgroundColor: "#A1ADA5" },
  menuStatusText: { fontSize: 10, color: "#7B8B80" },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EDF5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteIcon: { backgroundColor: "#FFF0ED" },
  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: "#EDF2EE",
    marginTop: 4,
  },
  menuText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#203D30" },
});
