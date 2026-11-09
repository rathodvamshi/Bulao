import { Hono, type Context } from "hono";
import type { AppEnv } from "../../config/env";
import { rateLimit, requireAuth } from "../auth/session";
import { ApiError, ok } from "../../middleware/errors";
import { z } from "zod";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

const pushDeviceSchema = z.object({
  installationId: z.string().regex(/^[0-9a-f-]{36}$/i),
  token: z.string().min(30).max(256).regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/),
  platform: z.literal("android"),
}).strict();

notificationRoutes.post("/devices/register", async (c) => {
  const parsed = pushDeviceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError("INVALID_PUSH_DEVICE", 400, "This Android device could not be registered for notifications.");
  const { installationId, token } = parsed.data;
  await rateLimit(c.env.DB, `push-registration:${c.get("userId")}`, 120, 3600);
  const now = Math.floor(Date.now() / 1000);
  try {
    await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE push_devices SET active=0,updated_at=? WHERE installation_id=? AND user_id=?",
    ).bind(now, installationId, c.get("userId")),
    c.env.DB.prepare(
      "DELETE FROM push_devices WHERE expo_push_token=? AND installation_id<>?",
    ).bind(token, installationId),
    c.env.DB.prepare(
      `INSERT INTO push_devices(installation_id,user_id,expo_push_token,platform,active,created_at,updated_at,last_seen_at)
       VALUES(?,?,?,'android',1,?,?,?)
       ON CONFLICT(installation_id) DO UPDATE SET
         user_id=excluded.user_id,expo_push_token=excluded.expo_push_token,
         platform='android',active=1,updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at`,
    ).bind(installationId, c.get("userId"), token, now, now, now),
    ]);
  } catch (error) {
    if (String(error).includes("PUSH_DEVICE_LIMIT"))
      throw new ApiError("PUSH_DEVICE_LIMIT", 429, "A maximum of 10 Android devices can receive notifications for this account.");
    throw error;
  }
  return ok(c, { registered: true });
});

notificationRoutes.post("/devices/unregister", async (c) => {
  const body = await c.req.json().catch(() => null) as { installationId?: unknown } | null;
  if (typeof body?.installationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.installationId))
    throw new ApiError("INVALID_PUSH_DEVICE", 400, "This Android device could not be unregistered.");
  await c.env.DB.prepare(
    "UPDATE push_devices SET active=0,updated_at=? WHERE installation_id=? AND user_id=?",
  ).bind(Math.floor(Date.now() / 1000), body.installationId, c.get("userId")).run();
  return ok(c, { registered: false });
});

function requirePushAdmin(c: Context<AppEnv>) {
  if (!c.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()).includes(c.get("userId")))
    throw new ApiError("UNAUTHORIZED", 403, "This operation is restricted to administrators.");
}

notificationRoutes.get("/ops/push-deliveries", async (c) => {
  requirePushAdmin(c);
  const [states, oldest, failed] = await Promise.all([
    c.env.DB.prepare("SELECT state,COUNT(*) AS count FROM push_deliveries GROUP BY state ORDER BY state").all(),
    c.env.DB.prepare(
      "SELECT MIN(created_at) AS oldestPendingAt FROM push_deliveries WHERE state IN ('pending','queued','sending','receipt_pending')",
    ).first(),
    c.env.DB.prepare(
      `SELECT id,state,notification_id AS notificationId,last_error_code AS errorCode,
              last_error AS error,attempts,updated_at AS updatedAt
         FROM push_deliveries WHERE state='failed' ORDER BY updated_at DESC LIMIT 100`,
    ).all(),
  ]);
  return ok(c, { states: states.results || [], oldestPendingAt: oldest?.oldestPendingAt ?? null, failed: failed.results || [] });
});

notificationRoutes.post("/ops/push-deliveries/retry", async (c) => {
  requirePushAdmin(c);
  const parsed = z.object({ deliveryIds: z.array(z.string().regex(/^[0-9a-f]{32}$/i)).min(1).max(100) }).strict()
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError("INVALID_DELIVERY_IDS", 400, "Choose up to 100 failed delivery records.");
  const now = Math.floor(Date.now() / 1000);
  const results = await c.env.DB.batch(parsed.data.deliveryIds.map((id) => c.env.DB.prepare(
    `UPDATE push_deliveries SET state='pending',next_attempt_at=?,expo_ticket_id=NULL,
            receipt_checked_at=NULL,lease_until=NULL,last_error_code=NULL,last_error=NULL,updated_at=?
      WHERE id=? AND state='failed'`,
  ).bind(now, now, id)));
  return ok(c, { retried: results.reduce((count, result) => count + result.meta.changes, 0) });
});

function recipientRole(value?: string) {
  if (value !== "seeker" && value !== "provider") {
    throw new ApiError(
      "INVALID_ROLE",
      400,
      "Choose the seeker or provider notification inbox.",
    );
  }
  return value;
}

function notificationScope(value?: string) {
  if (value === undefined) return "work";
  if (value !== "service" && value !== "work") {
    throw new ApiError("INVALID_SCOPE", 400, "Choose the service or work notification feed.");
  }
  return value;
}
const notificationScopeSql = (scope: "service" | "work") =>
  scope === "service" ? "type GLOB 'SERVICE_*'" : "type NOT GLOB 'SERVICE_*'";

// New events carry an explicit recipient role. Infer legacy events from their
// recipient and interaction, never from the account's currently selected mode.
const safeData =
  "CASE WHEN json_valid(notifications.data) THEN notifications.data ELSE '{}' END";
export const notificationRoleSql = `COALESCE(
  json_extract(${safeData}, '$.recipientRole'),
  CASE
    WHEN type IN ('APPLICATION_CREATED', 'APPLICATION_CANCELLED_BY_SEEKER') THEN 'provider'
    WHEN type IN ('APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'APPLICATION_CANCELLED_BY_PROVIDER') THEN 'seeker'
    WHEN type IN ('JOB_COMPLETED', 'JOB_COMPLETION_CONFIRMATION') THEN (
      SELECT CASE
        WHEN i.owner_id = notifications.user_id THEN 'provider'
        WHEN i.worker_id = notifications.user_id THEN 'seeker'
      END FROM interactions i
      WHERE i.id = json_extract(${safeData}, '$.interactionId')
      LIMIT 1
    )
  END
)`;

notificationRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const role = recipientRole(c.req.query("role"));
  const scope = notificationScope(c.req.query("scope"));
  const scopeSql = notificationScopeSql(scope);
  const cursor = c.req.query("cursor");
  let before: { createdAt: number; id: string } | undefined;
  if (cursor) {
    try {
      before = JSON.parse(cursor);
      if (
        !before ||
        !Number.isSafeInteger(before.createdAt) ||
        before.createdAt < 0 ||
        typeof before.id !== "string" ||
        !before.id ||
        before.id.length > 128
      )
        throw new Error();
    } catch {
      throw new ApiError(
        "INVALID_CURSOR",
        400,
        "Refresh notifications and try again.",
      );
    }
  }
  const result = await c.env.DB.prepare(
    `SELECT id, type, title, message, data, read, created_at as createdAt, ${notificationRoleSql} as recipientRole FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? AND ${scopeSql} ${before ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""} ORDER BY created_at DESC, id DESC LIMIT 51`,
  )
    .bind(
      userId,
      role,
      ...(before ? [before.createdAt, before.createdAt, before.id] : []),
    )
    .all<{ id: string; createdAt: number; read: number }>();
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? AND ${scopeSql} AND read = 0`,
  )
    .bind(userId, role)
    .first<{ count: number }>();
  const rows = result.results || [];
  const items = rows
    .slice(0, 50)
    .map((item) => ({ ...item, read: Boolean(item.read) }));
  const last = items[items.length - 1];
  return ok(c, {
    role,
    scope,
    items,
    nextCursor:
      rows.length > 50 && last
        ? JSON.stringify({ createdAt: last.createdAt, id: last.id })
        : null,
    unreadCount: count?.count ?? 0,
  });
});

notificationRoutes.get("/:id", async (c) => {
  const role = recipientRole(c.req.query("role"));
  const scope = notificationScope(c.req.query("scope"));
  const item = await c.env.DB.prepare(
    `SELECT id,user_id AS userId,type,title,message,data,read,created_at AS createdAt,
            ${notificationRoleSql} AS recipientRole
       FROM notifications
      WHERE id=? AND user_id=? AND ${notificationRoleSql}=? AND ${notificationScopeSql(scope)}
      LIMIT 1`,
  ).bind(c.req.param("id"), c.get("userId"), role).first();
  if (!item) throw new ApiError("NOTIFICATION_NOT_FOUND", 404, "This notification is no longer available.");
  return ok(c, item);
});

notificationRoutes.post("/read-all", async (c) => {
  const role = recipientRole(c.req.query("role"));
  const scope = notificationScope(c.req.query("scope"));
  await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND ${notificationRoleSql} = ? AND ${notificationScopeSql(scope)}`,
  )
    .bind(c.get("userId"), role)
    .run();
  return ok(c, { success: true });
});

for (const action of ["read", "unread"] as const) {
  notificationRoutes.post(`/:id/${action}`, async (c) => {
    const role = recipientRole(c.req.query("role"));
    const scope = notificationScope(c.req.query("scope"));
    const result = await c.env.DB.prepare(
      `UPDATE notifications SET read = ${action === "read" ? 1 : 0} WHERE id = ? AND user_id = ? AND ${notificationRoleSql} = ? AND ${notificationScopeSql(scope)}`,
    )
      .bind(c.req.param("id"), c.get("userId"), role)
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        "NOTIFICATION_NOT_FOUND",
        404,
        "This notification is no longer available. Refresh your inbox.",
      );
    return ok(c, { success: true });
  });
}

const bulkDeleteSchema = z
  .object({
    ids: z.array(z.string().min(1).max(128)).max(100).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (data) => data.all === true || (Array.isArray(data.ids) && data.ids.length > 0),
    {
      message: "Provide a list of notification IDs to delete or specify all: true.",
    },
  );

notificationRoutes.post("/bulk-delete", async (c) => {
  const role = recipientRole(c.req.query("role"));
  const scope = notificationScope(c.req.query("scope"));
  const parsed = bulkDeleteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError(
      "INVALID_DELETE_REQUEST",
      400,
      "Provide valid notification IDs or choose select all.",
    );
  }

  const userId = c.get("userId");
  const scopeSql = notificationScopeSql(scope);

  if (parsed.data.all) {
    const result = await c.env.DB.prepare(
      `DELETE FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? AND ${scopeSql}`,
    )
      .bind(userId, role)
      .run();
    return ok(c, { success: true, count: result.meta.changes });
  }

  const ids = parsed.data.ids || [];
  if (ids.length === 0) {
    return ok(c, { success: true, count: 0 });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const result = await c.env.DB.prepare(
    `DELETE FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? AND ${scopeSql} AND id IN (${placeholders})`,
  )
    .bind(userId, role, ...ids)
    .run();

  return ok(c, { success: true, count: result.meta.changes });
});

notificationRoutes.delete("/:id", async (c) => {
  const role = recipientRole(c.req.query("role"));
  const scope = notificationScope(c.req.query("scope"));
  await c.env.DB.prepare(
    `DELETE FROM notifications WHERE id = ? AND user_id = ? AND ${notificationRoleSql} = ? AND ${notificationScopeSql(scope)}`,
  )
    .bind(c.req.param("id"), c.get("userId"), role)
    .run();
  return ok(c, { success: true });
});
