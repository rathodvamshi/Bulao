import type { Context } from "hono";
import { boundingBox, distanceKm, searchSchema } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { identify, now } from "../auth/session";
type Candidate = {
  id: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;
  [key: string]: unknown;
};
export async function nearby(c: Context<AppEnv>, kind: "job" | "service") {
  const input = searchSchema.parse(c.req.query());
  const box = boundingBox(input.latitude, input.longitude, input.radiusKm);
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  const table = kind === "job" ? "jobs" : "service_profiles";
  const alias = "p";
  const owner = kind === "job" ? "owner_id" : "user_id";
  const fields =
    kind === "job"
      ? "p.id,r.name AS title,p.area,p.latitude,p.longitude,p.pay_paise AS payPaise,p.pay_unit AS payUnit,p.starts_at AS startsAt,p.workers"
      : "p.id,p.user_id AS userId,u.name AS title,c.name AS category,p.area,p.latitude,p.longitude,p.radius_km AS radiusKm,p.experience,p.available,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE target_id=p.user_id) AS rating,(SELECT COUNT(*) FROM interactions WHERE status='COMPLETED' AND (owner_id=p.user_id OR worker_id=p.user_id)) AS completed";
  const join =
    kind === "job"
      ? "JOIN roles r ON r.id=p.role_id"
      : "JOIN categories c ON c.id=p.category_id";
  const conditions = [
    kind === "job" ? "p.status='PUBLISHED' AND p.starts_at>?" : "p.available=1",
    "u.suspended=0",
    "p.latitude BETWEEN ? AND ?",
  ];
  const args: unknown[] =
    kind === "job" ? [now(), box.minLat, box.maxLat] : [box.minLat, box.maxLat];
  if (!box.allLongitudes) {
    conditions.push(
      box.minLon > box.maxLon
        ? "(p.longitude>=? OR p.longitude<=?)"
        : "p.longitude BETWEEN ? AND ?",
    );
    args.push(box.minLon, box.maxLon);
  }
  if (input.categoryId) {
    conditions.push("p.category_id=?");
    args.push(input.categoryId);
  }
  if (user) {
    conditions.push(
      `NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=${alias}.${owner}) OR (b.target_id=? AND b.user_id=${alias}.${owner}))`,
    );
    args.push(user.id, user.id);
  }
  // Candidate pages are explicit: clients continue even if exact filtering yields no items.
  args.push(input.cursor);
  const result = await c.env.DB.prepare(
    `SELECT ${fields} FROM ${table} p ${join} JOIN users u ON u.id=p.${owner} WHERE ${conditions.join(" AND ")} ORDER BY p.id LIMIT 21 OFFSET ?`,
  )
    .bind(...args)
    .all<Candidate>();
  const candidates = result.results.slice(0, 20);
  const items = candidates
    .map((row) => ({ ...row, distanceKm: distanceKm(input, row) }))
    .filter(
      (row) =>
        row.distanceKm <= input.radiusKm &&
        (kind === "job" || row.distanceKm <= (row.radiusKm ?? 0)),
    )
    .map(({ latitude, longitude, ...row }) => ({
      ...row,
      distanceKm: Math.round(row.distanceKm * 10) / 10,
    }));
  return {
    items,
    nextCursor: result.results.length > 20 ? input.cursor + 20 : null,
    order: "id",
  };
}
