import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { identify } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";
export const profiles = new Hono<AppEnv>();
profiles.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  if (user && user.id !== id) await assertUnblocked(c.env.DB, user.id, id);
  const profile = await c.env.DB.prepare(
    "SELECT id,name,area,photo_url AS photoUrl,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE target_id=users.id) AS rating,(SELECT COUNT(*) FROM interactions WHERE status='COMPLETED' AND (owner_id=users.id OR worker_id=users.id)) AS completed FROM users WHERE id=? AND suspended=0",
  )
    .bind(id)
    .first();
  if (!profile) throw new ApiError("NOT_FOUND", 404);
  const reviews = await c.env.DB.prepare(
    "SELECT r.stars,r.body,u.name AS author FROM reviews r JOIN users u ON u.id=r.author_id WHERE target_id=? ORDER BY r.created_at DESC LIMIT 20",
  )
    .bind(id)
    .all();
  return ok(c, { ...profile, reviews: reviews.results });
});
