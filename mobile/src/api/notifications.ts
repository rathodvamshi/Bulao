import { api, ApiError } from "./client";
import type { AppNotification } from "./types";

export type NotificationRole = "seeker" | "provider";
export interface NotificationInbox {
  role: NotificationRole;
  items: (AppNotification & { recipientRole: NotificationRole })[];
  unreadCount: number;
}

// Never trust a combined/old API response just because the request had a role.
// Use the same check for the inbox and both home-screen badges.
export function validateNotificationInbox(
  value: unknown,
  role: NotificationRole,
): NotificationInbox {
  const inbox = value as Partial<NotificationInbox> | null;
  if (
    !inbox ||
    inbox.role !== role ||
    !Array.isArray(inbox.items) ||
    inbox.items.some((item) => !item || item.recipientRole !== role) ||
    typeof inbox.unreadCount !== "number" ||
    !Number.isInteger(inbox.unreadCount) ||
    inbox.unreadCount < 0
  ) {
    throw new ApiError(
      "Your notification inbox couldn't be verified. Please refresh and try again.",
      "NOTIFICATION_SCOPE_MISMATCH",
    );
  }
  return inbox as NotificationInbox;
}

export async function getNotificationInbox(role: NotificationRole) {
  return validateNotificationInbox(
    await api(`/notifications?role=${role}`),
    role,
  );
}
