import { api, ApiError } from "./client";
import type { AppNotification } from "./types";

export type NotificationRole = "seeker" | "provider";
export type NotificationScope = "service" | "work";
export interface NotificationInbox {
  role: NotificationRole;
  scope: NotificationScope;
  scopeVerified: boolean;
  items: (AppNotification & { recipientRole: NotificationRole })[];
  unreadCount: number;
  nextCursor?: string | null;
}

function belongsToScope(type: string, scope: NotificationScope) {
  const isServiceEvent = type.startsWith("SERVICE_");
  return scope === "service" ? isServiceEvent : !isServiceEvent;
}

// Never trust a combined/old API response just because the request had a role.
// Use the same check for the inbox and both home-screen badges.
export function validateNotificationInbox(
  value: unknown,
  role: NotificationRole,
  scope: NotificationScope = "work",
): NotificationInbox {
  const inbox = value as Partial<NotificationInbox> | null;
  if (
    !inbox ||
    inbox.role !== role ||
    !Array.isArray(inbox.items) ||
    inbox.items.some(
      (item) =>
        !item ||
        item.recipientRole !== role ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.type !== "string" ||
        typeof item.title !== "string" ||
        typeof item.message !== "string" ||
        !Number.isSafeInteger(item.createdAt) ||
        item.createdAt < 0 ||
        ![true, false, 0, 1].includes(item.read),
    ) ||
    typeof inbox.unreadCount !== "number" ||
    !Number.isInteger(inbox.unreadCount) ||
    inbox.unreadCount < 0 ||
    (inbox.nextCursor != null &&
      (typeof inbox.nextCursor !== "string" || !inbox.nextCursor.trim()))
  ) {
    throw new ApiError(
      "Your notification inbox couldn't be verified. Please refresh and try again.",
      "NOTIFICATION_SCOPE_MISMATCH",
    );
  }
  const scopeVerified = inbox.scope === scope;
  if (
    inbox.scope != null &&
    (!scopeVerified || inbox.items.some((item) => !belongsToScope(item.type, scope)))
  ) {
    throw new ApiError(
      "The notification feed scope did not match this page. Please refresh and try again.",
      "NOTIFICATION_SCOPE_MISMATCH",
    );
  }
  const scopedItems = inbox.items.filter((item) => belongsToScope(item.type, scope));
  return {
    ...inbox,
    scope,
    scopeVerified,
    unreadCount: scopeVerified
      ? inbox.unreadCount!
      : scopedItems.filter((item) => !item.read).length,
    items: Array.from(
      new Map(
        scopedItems.map((item) => [
          item.id,
          { ...item, read: Boolean(item.read) },
        ]),
      ).values(),
    ),
  } as NotificationInbox;
}

export async function getNotificationInbox(
  role: NotificationRole,
  scope: NotificationScope = "work",
  cursor?: string,
) {
  return validateNotificationInbox(
    await api(
      `/notifications?role=${role}&scope=${scope}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
    role,
    scope,
  );
}
