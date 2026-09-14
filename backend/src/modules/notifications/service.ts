import type { D1Database } from "@cloudflare/workers-types";
import { now } from "../auth/session";

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function createNotification(
  db: D1Database,
  params: CreateNotificationParams,
) {
  try {
    // Deduplication check: prevent identical notification within 5 minutes on retried operations
    const entityId = params.data?.interactionId || params.data?.jobId;
    if (entityId) {
      const fiveMinAgo = now() - 300;
      const existing = await db
        .prepare(
          "SELECT id FROM notifications WHERE user_id=? AND type=? AND created_at >= ? AND data LIKE ?"
        )
        .bind(params.userId, params.type, fiveMinAgo, `%${entityId}%`)
        .first();

      if (existing) {
        console.log(`[Notifications] Suppressed duplicate notification for user ${params.userId} (${params.type})`);
        return;
      }
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      )
      .bind(
        id,
        params.userId,
        params.type,
        params.title,
        params.message,
        params.data ? JSON.stringify(params.data) : null,
        now(),
      )
      .run();
  } catch (err) {
    console.error("[Notifications] Failed to insert notification:", err);
  }
}
