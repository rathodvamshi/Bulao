import { Hono } from "hono";
import { z } from "zod";
import { transition, type State } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";
import { interactionDetail } from "./detail";
type Interaction = {
  id: string;
  owner_id: string;
  worker_id: string;
  status: State;
  owner_confirmed_at: number | null;
  worker_confirmed_at: number | null;
  kind: string;
};
export const interactions = new Hono<AppEnv>();
interactions.use("*", requireAuth);
interactions.get("/:id", interactionDetail);
interactions.post("/:id/action", async (c) => {
  const { action } = z
    .object({
      action: z.enum([
        "accept",
        "reject",
        "withdraw",
        "start",
        "confirm",
        "cancel",
      ]),
    })
    .parse(await c.req.json());
  const row = await c.env.DB.prepare("SELECT * FROM interactions WHERE id=?")
    .bind(c.req.param("id"))
    .first<Interaction>();
  if (!row) throw new ApiError("NOT_FOUND", 404);
  const uid = c.get("userId");
  if (uid !== row.owner_id && uid !== row.worker_id)
    throw new ApiError("UNAUTHORIZED", 403);
  const side = uid === row.owner_id ? "owner" : "worker";
  if (action === "accept")
    await assertUnblocked(c.env.DB, row.owner_id, row.worker_id);
  let next: State;
  try {
    next = transition(row.status, action, side);
  } catch {
    throw new ApiError(
      "INVALID_TRANSITION",
      409,
      "This action is no longer available. Refresh and try again.",
    );
  }
  let result;
  if (action === "confirm") {
    const own = side === "owner" ? "owner_confirmed_at" : "worker_confirmed_at",
      other = side === "owner" ? "worker_confirmed_at" : "owner_confirmed_at";
    result = await c.env.DB.prepare(
      `UPDATE interactions SET ${own}=?,status=CASE WHEN ${other} IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END WHERE id=? AND status='IN_PROGRESS' AND ${own} IS NULL RETURNING id,status`,
    )
      .bind(now(), row.id)
      .first();
  } else
    result = await c.env.DB.prepare(
      "UPDATE interactions SET status=? WHERE id=? AND status=? RETURNING id,status",
    )
      .bind(next, row.id, row.status)
      .first();
  if (!result)
    throw new ApiError(
      "STATE_CHANGED",
      409,
      "This action was already handled. Refresh to see the latest status.",
    );
  return ok(c, result);
});
