import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { requireAuth, now, rateLimit } from "../auth/session";
export const trust = new Hono<AppEnv>();
trust.post("/reviews", requireAuth, async (c) => {
  const input = z
    .object({
      interactionId: z.string().uuid(),
      stars: z.number().int().min(1).max(5),
      body: z.string().trim().max(1000),
    })
    .parse(await c.req.json());
  const result = await c.env.DB.prepare(
    "INSERT INTO reviews(id,interaction_id,author_id,target_id,stars,body,created_at) SELECT ?,id,?,CASE WHEN owner_id=? THEN worker_id ELSE owner_id END,?,?,? FROM interactions WHERE id=? AND status='COMPLETED' AND owner_confirmed_at IS NOT NULL AND worker_confirmed_at IS NOT NULL AND (owner_id=? OR worker_id=?) ON CONFLICT(interaction_id,author_id) DO NOTHING RETURNING id",
  )
    .bind(
      crypto.randomUUID(),
      c.get("userId"),
      c.get("userId"),
      input.stars,
      input.body,
      now(),
      input.interactionId,
      c.get("userId"),
      c.get("userId"),
    )
    .first();
  if (!result)
    throw new ApiError(
      "REVIEW_NOT_ALLOWED",
      409,
      "Reviews unlock after both people confirm completion. Each person can review once.",
    );
  return ok(c, result);
});
trust.post("/blocks", requireAuth, async (c) => {
  const { targetId } = z
    .object({ targetId: z.string().uuid() })
    .parse(await c.req.json());
  if (targetId === c.get("userId")) throw new ApiError("INVALID_TARGET");
  await c.env.DB.prepare(
    "INSERT INTO blocks(id,user_id,target_id) SELECT ?,?,id FROM users WHERE id=? ON CONFLICT(user_id,target_id) DO NOTHING",
  )
    .bind(crypto.randomUUID(), c.get("userId"), targetId)
    .run();
  return ok(c, { blocked: true });
});
trust.post("/reports", requireAuth, async (c) => {
  const input = z
    .object({
      targetId: z.string().uuid(),
      reason: z.string().trim().min(3).max(1000),
    })
    .parse(await c.req.json());
  if (input.targetId === c.get("userId")) throw new ApiError("INVALID_TARGET");
  await rateLimit(c.env.DB, `report:${c.get("userId")}`, 10, 3600);
  const result = await c.env.DB.prepare(
    "INSERT INTO reports(id,reporter_id,target_id,reason,created_at) SELECT ?,?,id,?,? FROM users WHERE id=? RETURNING id",
  )
    .bind(
      crypto.randomUUID(),
      c.get("userId"),
      input.reason,
      now(),
      input.targetId,
    )
    .first();
  if (!result) throw new ApiError("NOT_FOUND", 404);
  return ok(c, result);
});
