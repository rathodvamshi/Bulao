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
    `SELECT 
       id, name, area, photo_url AS photoUrl, phone, phone_verified AS phoneVerified, created_at AS createdAt,
       COALESCE((SELECT ROUND(AVG(stars),1) FROM reviews WHERE target_id=users.id), 5.0) AS rating,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id) AS totalReviews,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id AND stars=5) AS stars5,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id AND stars=4) AS stars4,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id AND stars=3) AS stars3,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id AND stars=2) AS stars2,
       (SELECT COUNT(*) FROM reviews WHERE target_id=users.id AND stars=1) AS stars1,
       (SELECT COUNT(*) FROM interactions WHERE status='COMPLETED' AND (owner_id=users.id OR worker_id=users.id)) AS completed,
       (SELECT COUNT(*) FROM interactions WHERE status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') AND (owner_id=users.id OR worker_id=users.id)) AS acceptedJobs,
       (SELECT COUNT(*) FROM interactions WHERE cancelled_by=users.id AND accepted_at IS NOT NULL) AS lateCancellations,
       (SELECT COUNT(*) FROM interactions WHERE cancelled_by=users.id AND accepted_at IS NULL) AS preAcceptanceWithdrawals
     FROM users WHERE id=? AND suspended=0`,
  )
    .bind(id)
    .first<any>();
  if (!profile) throw new ApiError("NOT_FOUND", 404);

  // Phone privacy barrier: Only allow viewer to see phone if self or has active accepted engagement
  let canViewPhone = false;
  if (user) {
    if (user.id === id) {
      canViewPhone = true;
    } else {
      const activeEngagement = await c.env.DB.prepare(
        `SELECT id FROM interactions 
         WHERE status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') 
         AND ((owner_id=? AND worker_id=?) OR (owner_id=? AND worker_id=?)) 
         LIMIT 1`,
      )
        .bind(user.id, id, id, user.id)
        .first();
      if (activeEngagement) canViewPhone = true;
    }
  }

  const completedCount = Number(profile.completed || 0);
  const lateCancellations = Number(profile.lateCancellations || 0);
  const totalCommitted = completedCount + lateCancellations;
  const completionRate = totalCommitted > 0 ? Math.round((completedCount / totalCommitted) * 100) : 100;

  const reviews = await c.env.DB.prepare(
    `SELECT 
       r.id, r.stars, r.body, r.created_at AS createdAt, u.name AS author,
       COALESCE(roles.name, cats.name, 'Verified Work') AS jobTitle
     FROM reviews r 
     JOIN users u ON u.id=r.author_id 
     LEFT JOIN interactions i ON i.id=r.interaction_id
     LEFT JOIN jobs j ON j.id=i.job_id
     LEFT JOIN roles roles ON roles.id=j.role_id
     LEFT JOIN service_profiles sp ON sp.id=i.service_id
     LEFT JOIN categories cats ON cats.id=sp.category_id
     WHERE r.target_id=? 
     ORDER BY r.created_at DESC 
     LIMIT 20`,
  )
    .bind(id)
    .all();
  return ok(c, {
    ...profile,
    phone: canViewPhone ? profile.phone : null,
    cancelledJobs: lateCancellations,
    lateCancellations,
    completionRate,
    reliabilityScore: completionRate,
    reviews: reviews.results,
  });
});
