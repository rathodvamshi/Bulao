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
  const radiusLimit = Math.min(Math.max(input.radiusKm, 1), 50);
  const box = boundingBox(input.latitude, input.longitude, radiusLimit);
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  const table = kind === "job" ? "jobs" : "service_profiles";
  const alias = "p";
  const owner = kind === "job" ? "owner_id" : "user_id";
  const fields =
    kind === "job"
      ? "p.id,p.owner_id AS ownerId,COALESCE(NULLIF(p.title, ''), r.name, 'Work Opportunity') AS title,p.title AS customTitle,p.role_id AS roleId,COALESCE(r.name, 'Worker') AS roleName,COALESCE(r.icon, '🛠️') AS roleIcon,p.category_id AS categoryId,COALESCE(cat.name, 'General Work') AS categoryName,COALESCE(cat.icon, '📋') AS categoryIcon,p.area,COALESCE(p.address, '') AS address,p.latitude,p.longitude,p.pay_paise AS payPaise,p.pay_unit AS payUnit,COALESCE(p.paid_when, 'after') AS paidWhen,p.starts_at AS startsAt,COALESCE(p.duration, 'one') AS duration,p.ends_at AS endsAt,COALESCE(p.hours, 'full') AS hours,COALESCE(p.start_time, '09:00') AS startTime,COALESCE(p.end_time, '17:00') AS endTime,p.workers,COALESCE(p.experience, 'any') AS experience,COALESCE(p.details, '') AS details,p.extras,p.status,p.created_at AS createdAt,(SELECT COUNT(*) FROM interactions i WHERE i.job_id=p.id AND i.kind='job') AS applicantCount"
      : "p.id,p.user_id AS userId,u.name AS title,c.name AS category,p.area,p.latitude,p.longitude,p.radius_km AS radiusKm,p.experience,p.available,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE target_id=p.user_id) AS rating,(SELECT COUNT(*) FROM interactions WHERE status='COMPLETED' AND (owner_id=p.user_id OR worker_id=p.user_id)) AS completed";
  const join =
    kind === "job"
      ? "LEFT JOIN roles r ON r.id=p.role_id LEFT JOIN categories cat ON cat.id=p.category_id"
      : "JOIN categories c ON c.id=p.category_id";
  
  const nowSec = now();
  const recentStartsCutoff = nowSec - 30 * 86400; // Open published jobs scheduled/started within 30 days
  const recentEndsCutoff = nowSec - 7 * 86400;    // Multi-day jobs open until 7 days past end date
  const conditions = [
    kind === "job"
      ? "p.status='PUBLISHED' AND (p.duration='ongoing' OR (p.ends_at IS NOT NULL AND p.ends_at>=?) OR p.starts_at>=?)"
      : "p.available=1",
    "u.suspended=0",
  ];
  const args: unknown[] =
    kind === "job" ? [recentEndsCutoff, recentStartsCutoff] : [];

  conditions.push("p.latitude BETWEEN ? AND ?");
  args.push(box.minLat, box.maxLat);
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

  const cosLat = Math.cos((input.latitude * Math.PI) / 180);
  const cosLatSq = (cosLat * cosLat).toFixed(8);
  const latNum = Number(input.latitude).toFixed(8);
  const lonNum = Number(input.longitude).toFixed(8);
  const distSqExpr = `((p.latitude - (${latNum})) * (p.latitude - (${latNum})) + (p.longitude - (${lonNum})) * (p.longitude - (${lonNum})) * ${cosLatSq})`;

  const pageSize = kind === "job" ? 10 : 20;
  const orderBy = kind === "job" ? `${distSqExpr} ASC, p.created_at DESC` : "p.id";
  const result = await c.env.DB.prepare(
    `SELECT ${fields} FROM ${table} p ${join} JOIN users u ON u.id=p.${owner} WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy} LIMIT ${pageSize + 1} OFFSET ?`,
  )
    .bind(...args)
    .all<Candidate>();
  const candidates = result.results.slice(0, pageSize);
  const items = candidates
    .map((row) => ({ ...row, distanceKm: distanceKm(input, row) }))
    .filter(
      (row) =>
        row.distanceKm <= radiusLimit &&
        (kind === "job" || row.distanceKm <= (row.radiusKm ?? 0)),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(({ latitude, longitude, ...row }) => ({
      ...row,
      distanceKm: Math.round(row.distanceKm * 10) / 10,
    }));
  return {
    items,
    nextCursor: result.results.length > pageSize ? input.cursor + pageSize : null,
    order: kind === "job" ? "distance_asc" : "id",
  };
}
