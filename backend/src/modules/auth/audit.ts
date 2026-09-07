import type { Context } from "hono";
import type { AppEnv, Env } from "../../config/env";
import { now } from "./session";
import { writeAuthEvent } from "./repository";

export type AuthEvent = {
  id: string; requestId: string; eventType: string; createdAt: number;
  success: boolean; userId: string | null; phoneHash: string | null;
  ipHash: string | null; code: string | null;
};

export function audit(c: Context<AppEnv>, event: Omit<AuthEvent, "id" | "requestId" | "createdAt">) {
  c.executionCtx.waitUntil(c.env.AUTH_EVENTS.send({
    ...event, id: crypto.randomUUID(), requestId: c.get("requestId"), createdAt: now(),
  }).catch(() => {
    console.error(JSON.stringify({ requestId: c.get("requestId"), code: "AUTH_AUDIT_ENQUEUE_FAILED" }));
  }));
}

export async function consumeAuthEvents(batch: MessageBatch<AuthEvent>, env: Env) {
  for (const message of batch.messages) {
    const e = message.body;
    try {
      // Queue retries are idempotent; no OTP, raw token, phone, or IP enters this queue.
      await writeAuthEvent(env.DB, e);
      message.ack();
    } catch {
      console.error(JSON.stringify({ requestId: e.requestId, code: "AUTH_AUDIT_WRITE_FAILED" }));
      message.retry();
    }
  }
}

