import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { jobSchema } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { jobs, roles } from "../../db/schema";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth, rateLimit } from "../auth/session";
import { nearby } from "../locations/search";
import { assertUnblocked } from "../trust/permissions";
export const jobRoutes = new Hono<AppEnv>();
jobRoutes.get("/", async (c) => ok(c, await nearby(c, "job")));
jobRoutes.post("/:id/action", requireAuth, async (c) => {
  const { action } = z
    .object({ action: z.enum(["pause", "publish", "cancel"]) })
    .parse(await c.req.json());
  const row = await drizzle(c.env.DB)
    .select()
    .from(jobs)
    .where(eq(jobs.id, c.req.param("id")))
    .get();
  if (!row) throw new ApiError("JOB_NOT_FOUND", 404);
  if (row.ownerId !== c.get("userId")) throw new ApiError("UNAUTHORIZED", 403);
  const next =
    action === "pause" && row.status === "PUBLISHED"
      ? "PAUSED"
      : action === "publish" && row.status === "PAUSED"
        ? "PUBLISHED"
        : action === "cancel" &&
            ["PUBLISHED", "PAUSED", "FILLED"].includes(row.status)
          ? "CANCELLED"
          : null;
  if (!next) throw new ApiError("INVALID_TRANSITION", 409);
  const changed = await c.env.DB.prepare(
    "UPDATE jobs SET status=? WHERE id=? AND owner_id=? AND status=? RETURNING id,status",
  )
    .bind(next, row.id, c.get("userId"), row.status)
    .first();
  if (!changed) throw new ApiError("STATE_CHANGED", 409);
  return ok(c, changed);
});
jobRoutes.post("/", requireAuth, async (c) => {
  const input = jobSchema
    .extend({ submissionKey: z.string().min(8).max(100) })
    .parse(await c.req.json());
  if (input.startsAt < now() || input.startsAt > now() + 366 * 86400)
    throw new ApiError("INVALID_DATE");
  const db = drizzle(c.env.DB);
  const existing = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.ownerId, c.get("userId")), eq(jobs.submissionKey, input.submissionKey))).get();
  if (existing) return ok(c, existing);
  if ((input.duration === "few" && (!input.endsAt || input.endsAt <= input.startsAt)) ||
      (input.duration !== "few" && input.endsAt !== null) ||
      (input.hours === "custom" && input.endTime <= input.startTime))
    throw new ApiError("INVALID_SCHEDULE", 400, "Please check the end date and working hours.");
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, input.roleId))
    .get();
  if (!role || role.categoryId !== input.categoryId)
    throw new ApiError("INVALID_ROLE");
  await rateLimit(c.env.DB, `publish:${c.get("userId")}`, 30, 86400);
  const id = crypto.randomUUID();
  await db
    .insert(jobs)
    .values({ ...input, id, ownerId: c.get("userId"), createdAt: now() })
    .onConflictDoNothing();
  const saved = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerId, c.get("userId")),
        eq(jobs.submissionKey, input.submissionKey),
      ),
    )
    .get();
  return ok(c, saved);
});
jobRoutes.get("/:id", async (c) => {
  const job = await c.env.DB.prepare(
    "SELECT j.id,j.owner_id AS ownerId,r.name AS title,j.area,j.starts_at AS startsAt,j.workers,j.pay_paise AS payPaise,j.pay_unit AS payUnit,j.details,j.status,u.name AS ownerName FROM jobs j JOIN roles r ON r.id=j.role_id JOIN users u ON u.id=j.owner_id WHERE j.id=? AND u.suspended=0",
  )
    .bind(c.req.param("id"))
    .first();
  if (!job)
    throw new ApiError(
      "JOB_NOT_FOUND",
      404,
      "This job is no longer available.",
    );
  return ok(c, job);
});
jobRoutes.post("/:id/apply", requireAuth, async (c) => {
  const job = await drizzle(c.env.DB)
    .select()
    .from(jobs)
    .where(eq(jobs.id, c.req.param("id")))
    .get();
  if (!job || job.status !== "PUBLISHED" || job.startsAt < now())
    throw new ApiError(
      "JOB_NOT_AVAILABLE",
      409,
      "This job is no longer accepting applications.",
    );
  if (job.ownerId === c.get("userId")) throw new ApiError("SELF_APPLICATION");
  await assertUnblocked(c.env.DB, job.ownerId, c.get("userId"));
  const id = crypto.randomUUID();
  const result = await c.env.DB.prepare(
    "INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,details,created_at) VALUES(?,'job',?,?,?,'PENDING','',?) ON CONFLICT(job_id,worker_id) DO NOTHING RETURNING id",
  )
    .bind(id, job.id, job.ownerId, c.get("userId"), now())
    .first();
  if (!result)
    throw new ApiError(
      "APPLICATION_EXISTS",
      409,
      "You've already applied to this job.",
    );
  return ok(c, { id });
});

jobRoutes.get("/provider/stats", requireAuth, async (c) => {
  const userId = c.get("userId");
  
  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) as paused,
      SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END) as hired,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM jobs
    WHERE owner_id = ?
  `).bind(userId).first();

  const applications = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM interactions
    WHERE owner_id = ? AND kind = 'job' AND status = 'PENDING'
  `).bind(userId).first();

  return ok(c, {
    jobsPosted: stats?.total || 0,
    active: stats?.active || 0,
    interested: applications?.count || 0,
    hired: stats?.hired || 0,
    completed: stats?.completed || 0,
  });
});

jobRoutes.get("/provider/recent", requireAuth, async (c) => {
  const userId = c.get("userId");
  
  const recentJobs = await c.env.DB.prepare(`
    SELECT 
      j.id,
      r.name as title,
      c.name as categoryName,
      j.area,
      j.pay_paise as payPaise,
      j.pay_unit as payUnit,
      j.status,
      (SELECT COUNT(*) FROM interactions WHERE job_id = j.id AND kind = 'job') as applicantCount
    FROM jobs j
    JOIN roles r ON r.id = j.role_id
    JOIN categories c ON c.id = j.category_id
    WHERE j.owner_id = ?
    ORDER BY j.created_at DESC
    LIMIT 10
  `).bind(userId).all();

  return ok(c, recentJobs.results || []);
});
