import type { D1Database } from "@cloudflare/workers-types";
import { now } from "../auth/session";
import { dispatchPendingPushes } from "./push";

export interface CreateNotificationParams {
  userId: string;
  recipientRole: "seeker" | "provider";
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
}

export async function createNotification(
  db: D1Database,
  params: CreateNotificationParams,
  env?: any,
  ctx?: { waitUntil: (promise: Promise<unknown>) => void },
) {
  // Do not dedupe by a time window: two real updates for the same job within
  // five minutes are distinct events and each must reach the durable outbox.
  // Operation-level state guards and database uniqueness already prevent
  // duplicate applications, reviews, and lifecycle transitions.
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
      JSON.stringify({ ...params.data, recipientRole: params.recipientRole }),
      now(),
    )
    .run();

  if (env && env.PUSH_DELIVERIES) {
    const task = dispatchPendingPushes(env).catch((err) => {
      console.error("Instant push dispatch error:", err);
    });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(task);
    } else {
      void task;
    }
  }

  return id;
}
