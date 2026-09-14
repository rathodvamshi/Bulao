import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../auth/session";
import { ApiError, ok } from "../../middleware/errors";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

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

// New events carry an explicit recipient role. Infer legacy events from their
// recipient and interaction, never from the account's currently selected mode.
const safeData =
  "CASE WHEN json_valid(notifications.data) THEN notifications.data ELSE '{}' END";
export const notificationRoleSql = `COALESCE(
  json_extract(${safeData}, '$.recipientRole'),
  CASE
    WHEN type IN ('APPLICATION_CREATED', 'APPLICATION_CANCELLED_BY_SEEKER') THEN 'provider'
    WHEN type IN ('APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'APPLICATION_CANCELLED_BY_PROVIDER') THEN 'seeker'
    WHEN type = 'JOB_COMPLETED' THEN (
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
  const result = await c.env.DB.prepare(
    `SELECT id, type, title, message, data, read, created_at as createdAt, ${notificationRoleSql} as recipientRole FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(userId, role)
    .all();
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND ${notificationRoleSql} = ? AND read = 0`,
  )
    .bind(userId, role)
    .first<{ count: number }>();
  return ok(c, {
    role,
    items: result.results || [],
    unreadCount: count?.count ?? 0,
  });
});

notificationRoutes.post("/read-all", async (c) => {
  const role = recipientRole(c.req.query("role"));
  await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND ${notificationRoleSql} = ?`,
  )
    .bind(c.get("userId"), role)
    .run();
  return ok(c, { success: true });
});

for (const action of ["read", "unread"] as const) {
  notificationRoutes.post(`/:id/${action}`, async (c) => {
    const role = recipientRole(c.req.query("role"));
    await c.env.DB.prepare(
      `UPDATE notifications SET read = ${action === "read" ? 1 : 0} WHERE id = ? AND user_id = ? AND ${notificationRoleSql} = ?`,
    )
      .bind(c.req.param("id"), c.get("userId"), role)
      .run();
    return ok(c, { success: true });
  });
}

notificationRoutes.delete("/:id", async (c) => {
  const role = recipientRole(c.req.query("role"));
  await c.env.DB.prepare(
    `DELETE FROM notifications WHERE id = ? AND user_id = ? AND ${notificationRoleSql} = ?`,
  )
    .bind(c.req.param("id"), c.get("userId"), role)
    .run();
  return ok(c, { success: true });
});
