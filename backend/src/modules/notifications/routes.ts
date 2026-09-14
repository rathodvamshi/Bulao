import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../auth/session";
import { ok } from "../../middleware/errors";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

notificationRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await c.env.DB.prepare(
    "SELECT id, type, title, message, data, read, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
  )
    .bind(userId)
    .all();

  const unreadCountRes = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0",
  )
    .bind(userId)
    .first<{ count: number }>();

  return ok(c, {
    items: result.results || [],
    unreadCount: unreadCountRes?.count ?? 0,
  });
});

notificationRoutes.post("/:id/read", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  await c.env.DB.prepare(
    "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .run();
  return ok(c, { success: true });
});

notificationRoutes.post("/read-all", async (c) => {
  const userId = c.get("userId");
  await c.env.DB.prepare(
    "UPDATE notifications SET read = 1 WHERE user_id = ?",
  )
    .bind(userId)
    .run();
  return ok(c, { success: true });
});
