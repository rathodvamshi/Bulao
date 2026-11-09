import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppPressable as Pressable } from "../AppPressable";
import { AppImage } from "../AppImage";
import type { ApplicationItem, ServiceRequestItem } from "../../api/types";
import { formatDirectPhone } from "@bulao/domain";

const green = "#086649";
const ink = "#182C25";
const muted = "#718078";

export const serviceStatusLabels: Record<string, string> = {
  PENDING: "Needs review",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  REJECTED: "Declined",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  CANCELLED_BY_SEEKER: "Customer cancelled",
  CANCELLED_BY_PROVIDER: "You cancelled",
};

export function formatRequestDate(value?: number | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value * (value < 1e11 ? 1000 : 1));
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function formatScheduledDate(value?: number | null): string {
  if (!value) return "";
  const date = new Date(value * (value < 1e11 ? 1000 : 1));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface ServiceRequestCardProps {
  request: ServiceRequestItem | ApplicationItem | any;
  onAccept?: (request: any) => Promise<void> | void;
  onDecline?: (request: any) => Promise<void> | void;
  onCancel?: (request: any) => void;
  onCall?: (phone: string, name: string) => void;
  onPressDetails?: (request: any) => void;
  onCompleteWork?: (request: any) => void;
  onRateCustomer?: (request: any) => void;
  isProvider?: boolean;
  isActing?: boolean;
  showServiceTitle?: boolean;
}

export function ServiceRequestCard({
  request,
  onAccept,
  onDecline,
  onCancel,
  onCall,
  onPressDetails,
  onCompleteWork,
  onRateCustomer,
  isProvider = true,
  isActing = false,
  showServiceTitle = true,
}: ServiceRequestCardProps) {
  const status = (request.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const isAccepted = status === "ACCEPTED" || status === "IN_PROGRESS";
  const isCompleted = status === "COMPLETED";
  const isDeclined = status === "REJECTED";
  const isCancelled =
    status === "CANCELLED" ||
    status === "CANCELLED_BY_SEEKER" ||
    status === "CANCELLED_BY_PROVIDER" ||
    status === "WITHDRAWN";

  const hasConfirmed = isProvider
    ? !!request.ownerConfirmedAt
    : !!request.workerConfirmedAt;
  const hasReviewed =
    !!request.reviewed ||
    (typeof request.myRating === "number" && request.myRating > 0);

  const customerName = request.otherName || "Customer";
  const customerPhoto = request.otherPhotoUrl;
  const initial = (customerName || "C").trim().charAt(0).toUpperCase();
  const customerRating =
    typeof request.otherRating === "number" && request.otherRating > 0
      ? request.otherRating
      : null;
  const totalReviews = Number(request.otherTotalReviews || 0);

  const handleOpenDetails = () => {
    if (onPressDetails) {
      onPressDetails(request);
      return;
    }
    router.push({
      pathname: "/requests/[id]",
      params: { id: request.id },
    });
  };

  const handleCall = () => {
    const rawPhone = request.otherPhone || request.phone;
    if (onCall && rawPhone) {
      onCall(rawPhone, customerName);
      return;
    }
    const clean = rawPhone ? formatDirectPhone(rawPhone) : null;
    if (!clean) {
      Alert.alert(
        "Call Unavailable",
        `Direct phone calling for ${customerName} is unavailable.`,
      );
      return;
    }
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert("Call Error", "Phone dialer unavailable on this device.");
    });
  };

  return (
    <View style={[styles.card, isPending && styles.pendingCard]}>
      {/* 1. Customer Identity Row */}
      <Pressable
        style={styles.identity}
        onPress={handleOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`View request from ${customerName}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.initial}>{initial}</Text>
          {customerPhoto ? (
            <AppImage source={{ uri: customerPhoto }} style={styles.photo} />
          ) : null}
        </View>

        <View style={styles.identityTextCol}>
          <Text style={styles.name} numberOfLines={1}>
            {customerName}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={12} color="#047857" />
            <Text style={styles.meta} numberOfLines={1}>
              {request.area || "Location not shared"}
            </Text>
          </View>
          <Text style={styles.applied}>
            Requested {formatRequestDate(request.createdAt)}
          </Text>
        </View>

        <View style={styles.chevronWrapper}>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </View>
      </Pressable>

      {/* 2. Service & Status Row */}
      <View style={styles.statusLine}>
        {/* Service Title / Category Tag */}
        {showServiceTitle && (request.title || request.categoryName) ? (
          <View style={styles.servicePill}>
            <Ionicons name="construct-outline" size={12} color="#047857" />
            <Text style={styles.servicePillText} numberOfLines={1}>
              {request.title || request.categoryName}
            </Text>
          </View>
        ) : null}

        {/* Status Badge */}
        <View
          style={[
            styles.badge,
            isPending
              ? styles.pendingBadge
              : isAccepted
                ? styles.acceptedBadge
                : isCompleted
                  ? styles.completedBadge
                  : isDeclined
                    ? styles.declinedBadge
                    : styles.historyBadge,
          ]}
        >
          {isPending && <View style={styles.pendingDot} />}
          <Text
            style={[
              styles.badgeText,
              isPending && styles.pendingBadgeText,
              isAccepted && styles.acceptedText,
              isCompleted && styles.completedText,
              isDeclined && styles.declinedText,
            ]}
          >
            {serviceStatusLabels[status] || status}
          </Text>
        </View>

        {/* Customer Rating Badge (if available) */}
        {customerRating != null && totalReviews > 0 ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#B7791F" />
            <Text style={styles.ratingText}>
              {customerRating.toFixed(1)} · {totalReviews}{" "}
              {totalReviews === 1 ? "review" : "reviews"}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 3. Customer Requirement / Description */}
      {!!request.details && (
        <View style={styles.requirementBox}>
          <Text style={styles.requirementLabel}>Requirement</Text>
          <Text style={styles.requirementText} numberOfLines={3}>
            {request.details}
          </Text>
        </View>
      )}

      {/* 4. Scheduled Time (if any) */}
      {!!request.scheduledAt && (
        <View style={styles.scheduledRow}>
          <Ionicons name="calendar-outline" size={13} color="#047857" />
          <Text style={styles.scheduledText}>
            Service time: {formatScheduledDate(request.scheduledAt)}
          </Text>
        </View>
      )}

      {/* 5. Cancellation Reason (if any) */}
      {!!request.cancellationReason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Cancellation Reason</Text>
          <Text style={styles.reasonText}>{request.cancellationReason}</Text>
        </View>
      )}

      {/* 6. Mutual Unlocked Contact Box (Unlocked upon acceptance) */}
      {isAccepted && (
        <View style={styles.unlockedContactCard}>
          <View style={styles.unlockedContactHeader}>
            <Ionicons name="call" size={13} color="#086649" />
            <Text style={styles.unlockedContactLabel}>
              {isProvider ? "CUSTOMER MOBILE NUMBER" : "PROVIDER MOBILE NUMBER"}
            </Text>
          </View>
          <View style={styles.unlockedContactRow}>
            <Text style={styles.unlockedContactPhone}>
              {request.otherPhone
                ? `+91 ${formatDirectPhone(request.otherPhone)}`
                : "Direct Contact Available"}
            </Text>
            {request.otherPhone && (
              <Pressable
                onPress={handleCall}
                style={styles.directCallPill}
                accessibilityRole="button"
                accessibilityLabel={`Call ${customerName}`}
              >
                <Ionicons name="call" size={12} color="#FFFFFF" />
                <Text style={styles.directCallPillText}>Call</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* 7. Action Spinner */}
      {isActing && (
        <ActivityIndicator color={green} style={{ marginTop: 12 }} />
      )}

      {/* 8. Action Buttons */}
      {!isActing && (
        <View style={styles.actionsContainer}>
          {isPending ? (
            <View style={styles.actionsRow}>
              {onAccept && (
                <Pressable
                  onPress={() => onAccept(request)}
                  style={[styles.button, styles.acceptBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="Accept service request"
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={17}
                    color="#FFFFFF"
                  />
                  <Text style={styles.acceptBtnText}>Accept Request</Text>
                </Pressable>
              )}

              {onDecline && (
                <Pressable
                  onPress={() => onDecline(request)}
                  style={[styles.button, styles.declineBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="Decline service request"
                >
                  <Ionicons name="close-circle-outline" size={17} color="#78574A" />
                  <Text style={styles.declineBtnText}>Decline</Text>
                </Pressable>
              )}
            </View>
          ) : isAccepted ? (
            <View style={styles.acceptedActionsCol}>
              {/* Mark Work Done Button */}
              {!hasConfirmed ? (
                onCompleteWork ? (
                  <Pressable
                    onPress={() => onCompleteWork(request)}
                    style={[styles.button, styles.completeBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Mark work as completed"
                  >
                    <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.completeBtnText}>
                      {isProvider ? "Mark Work Done" : "Confirm Completed"}
                    </Text>
                  </Pressable>
                ) : null
              ) : (
                <View style={styles.waitingNotice}>
                  <Ionicons name="time-outline" size={14} color="#086649" />
                  <Text style={styles.waitingNoticeText}>
                    You marked work complete. Waiting for {isProvider ? "customer" : "provider"} to confirm.
                  </Text>
                </View>
              )}

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleOpenDetails}
                  style={[styles.button, styles.detailsBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="View full request details"
                >
                  <Ionicons name="eye-outline" size={15} color={green} />
                  <Text style={styles.detailsBtnText}>View Details</Text>
                </Pressable>

                {onCancel && (
                  <Pressable
                    onPress={() => onCancel(request)}
                    style={[styles.button, styles.cancelBtnSecondary]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel this booking"
                  >
                    <Ionicons name="close-circle-outline" size={15} color="#A65342" />
                    <Text style={styles.cancelBtnSecondaryText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : isCompleted ? (
            <View style={styles.completedActionsCol}>
              {/* Mutual Rating & Feedback Button */}
              {!hasReviewed ? (
                onRateCustomer ? (
                  <Pressable
                    onPress={() => onRateCustomer(request)}
                    style={[styles.button, styles.rateBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Rate and leave feedback"
                  >
                    <Ionicons name="star" size={16} color="#FFFFFF" />
                    <Text style={styles.rateBtnText}>
                      {isProvider ? "Rate Customer & Feedback" : "Rate Service Experience"}
                    </Text>
                  </Pressable>
                ) : null
              ) : (
                <View style={styles.ratedStatus}>
                  <Ionicons name="checkmark-circle" size={15} color="#086649" />
                  <Text style={styles.ratedStatusText}>
                    {request.myRating ? `You rated this ${request.myRating} ★` : "Review submitted"}
                  </Text>
                </View>
              )}

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleOpenDetails}
                  style={[styles.button, styles.detailsBtnFull]}
                  accessibilityRole="button"
                  accessibilityLabel="View full details"
                >
                  <Ionicons name="document-text-outline" size={15} color={green} />
                  <Text style={styles.detailsBtnText}>View Details</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleOpenDetails}
                style={[styles.button, styles.detailsBtnFull]}
                accessibilityRole="button"
                accessibilityLabel="View full details"
              >
                <Ionicons name="document-text-outline" size={16} color={green} />
                <Text style={styles.detailsBtnText}>View Details</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#193D2D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingCard: {
    borderColor: "#E5D7B8",
    backgroundColor: "#FFFCF6",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EAF4EE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: 48,
    height: 48,
  },
  initial: {
    fontSize: 19,
    fontWeight: "700",
    color: green,
  },
  identityTextCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    color: ink,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: muted,
    flexShrink: 1,
  },
  applied: {
    fontSize: 11,
    lineHeight: 15,
    color: "#8FA097",
    marginTop: 2,
  },
  chevronWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  servicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF5F0",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 180,
  },
  servicePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  badge: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pendingBadge: {
    backgroundColor: "#FFF3DB",
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D38A18",
  },
  pendingBadgeText: {
    color: "#805B18",
  },
  acceptedBadge: {
    backgroundColor: "#E6F4EC",
  },
  acceptedText: {
    color: green,
  },
  completedBadge: {
    backgroundColor: "#F3E8FF",
  },
  completedText: {
    color: "#6B21A8",
  },
  declinedBadge: {
    backgroundColor: "#FEF2F2",
  },
  declinedText: {
    color: "#A65342",
  },
  historyBadge: {
    backgroundColor: "#F0F3F1",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#65756C",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#FFF7E6",
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#805B18",
  },
  requirementBox: {
    backgroundColor: "#F6F9F7",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    marginTop: 12,
    gap: 4,
  },
  requirementLabel: {
    fontSize: 10.5,
    color: "#65756C",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  requirementText: {
    color: ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  scheduledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  scheduledText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  reasonBox: {
    backgroundColor: "#FFF7EF",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 4,
  },
  reasonLabel: {
    fontSize: 11,
    color: "#A65342",
    fontWeight: "700",
  },
  reasonText: {
    color: ink,
    fontSize: 13,
    lineHeight: 18,
  },
  unlockedContactCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  unlockedContactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unlockedContactLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },
  unlockedContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unlockedContactPhone: {
    fontSize: 15,
    fontWeight: "800",
    color: "#182C25",
    letterSpacing: 0.3,
  },
  directCallPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: green,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  directCallPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  completeBtn: {
    backgroundColor: green,
    minHeight: 46,
  },
  completeBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  waitingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  waitingNoticeText: {
    fontSize: 11.5,
    color: "#086649",
    fontWeight: "600",
    flex: 1,
  },
  cancelBtnSecondary: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  cancelBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A65342",
  },
  completedActionsCol: {
    gap: 8,
  },
  rateBtn: {
    backgroundColor: "#086649",
    minHeight: 46,
  },
  rateBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  ratedStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#EAF5EF",
  },
  ratedStatusText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#086649",
  },
  actionsContainer: {
    marginTop: 14,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  acceptedActionsCol: {
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  acceptBtn: {
    backgroundColor: green,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  declineBtn: {
    backgroundColor: "#F6F3F1",
    borderWidth: 1,
    borderColor: "#E8E2DD",
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78574A",
  },
  callBtn: {
    backgroundColor: green,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  detailsBtn: {
    backgroundColor: "#F2F7F4",
    borderWidth: 1,
    borderColor: "#D8E5DD",
  },
  detailsBtnFull: {
    backgroundColor: "#F2F7F4",
    borderWidth: 1,
    borderColor: "#D8E5DD",
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: green,
  },
  cancelLink: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  cancelLinkText: {
    color: "#A65342",
    fontSize: 12,
    fontWeight: "600",
  },
});
