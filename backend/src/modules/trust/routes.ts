import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { requireAuth, now, rateLimit } from "../auth/session";
export const trust = new Hono<AppEnv>();
trust.post("/reviews/bulk", requireAuth, async (c) => {
  const input = z
    .object({
      interactionIds: z.array(z.string().uuid()).min(1).max(100),
      stars: z.number().int().min(1).max(5),
      body: z.string().trim().max(1000).default(""),
    })
    .refine((value) => new Set(value.interactionIds).size === value.interactionIds.length, {
      message: "Each seeker can only be included once.",
      path: ["interactionIds"],
    })
    .parse(await c.req.json());
  const userId = c.get("userId");
  const idMarks = input.interactionIds.map(() => "?").join(",");
  const eligible = await c.env.DB.prepare(
    `SELECT COUNT(*) AS eligibleCount, COUNT(DISTINCT job_id) AS jobCount
     FROM interactions i
     WHERE i.id IN (${idMarks}) AND i.owner_id=? AND i.kind='job'
       AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL
       AND i.worker_confirmed_at IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.interaction_id=i.id AND r.author_id=?)`,
  )
    .bind(...input.interactionIds, userId, userId)
    .first<{ eligibleCount: number; jobCount: number }>();
  if (Number(eligible?.eligibleCount || 0) !== input.interactionIds.length || Number(eligible?.jobCount || 0) !== 1) {
    throw new ApiError(
      "REVIEW_NOT_ALLOWED",
      409,
      "Some seekers are no longer waiting for a rating. Refresh the list and try again.",
    );
  }

  const createdAt = now();
  const statements = input.interactionIds.map((interactionId) =>
    c.env.DB.prepare(
      `INSERT INTO reviews(id,interaction_id,author_id,target_id,stars,body,created_at)
       SELECT ?,i.id,?,i.worker_id,?,?,? FROM interactions i
       WHERE i.id=? AND i.owner_id=? AND i.kind='job' AND i.status='COMPLETED'
         AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL`,
    ).bind(
      crypto.randomUUID(),
      userId,
      input.stars,
      input.body,
      createdAt,
      interactionId,
      userId,
    ),
  );
  try {
    await c.env.DB.batch(statements);
  } catch {
    throw new ApiError(
      "REVIEW_SAVE_FAILED",
      503,
      "The group rating wasn't saved. Refresh the list and try again.",
    );
  }
  return ok(c, { reviewedCount: input.interactionIds.length });
});

trust.post("/reviews", requireAuth, async (c) => {
  const input = z
    .object({
      interactionId: z.string().uuid(),
      stars: z.number().int().min(1).max(5),
      body: z.string().trim().max(1000),
    })
    .parse(await c.req.json());
  let result = await c.env.DB.prepare(
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
  if (!result) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM reviews WHERE interaction_id=? AND author_id=?",
    ).bind(input.interactionId, c.get("userId")).first<{ id: string }>();
    if (!existing) {
      throw new ApiError(
        "REVIEW_NOT_ALLOWED",
        409,
        "Reviews unlock after both people confirm completion. Each person can review once.",
      );
    }
    return ok(c, { id: existing.id, alreadySubmitted: true });
  }

  // The review insert trigger writes its inbox event in the same D1 transaction.
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
