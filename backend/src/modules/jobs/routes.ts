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
  if (input.startsAt < now() - 3600 || input.startsAt > now() + 366 * 86400)
    throw new ApiError("INVALID_DATE");
  const db = drizzle(c.env.DB);
  const existing = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.ownerId, c.get("userId")), eq(jobs.submissionKey, input.submissionKey))).get();
  if (existing) return ok(c, existing);
  if ((input.duration === "few" && (!input.endsAt || input.endsAt <= input.startsAt)) ||
      (input.duration !== "few" && input.endsAt !== null) ||
      (input.hours === "custom" && input.endTime <= input.startTime))
    throw new ApiError("INVALID_SCHEDULE", 400, "Please check the end date and working hours.");
  let role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, input.roleId))
    .get();

  if (!role) {
    role = await db
      .select()
      .from(roles)
      .where(eq(roles.categoryId, input.categoryId))
      .get();
    if (role) {
      input.roleId = role.id;
    }
  }

  if (role && role.categoryId !== input.categoryId) {
    input.categoryId = role.categoryId;
  }

  if (!role) {
    const defaultRole = await db.select().from(roles).get();
    if (defaultRole) {
      input.roleId = defaultRole.id;
      input.categoryId = defaultRole.categoryId;
    } else {
      throw new ApiError("INVALID_ROLE");
    }
  }
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

function asCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function trendPct(current: number, previous: number): number | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

jobRoutes.get("/provider/stats", requireAuth, async (c) => {
  const userId = c.get("userId");
  const period = (c.req.query("period") || "month").toLowerCase();
  const nowSec = now();
  const windowSec = period === "week" ? 7 * 86400 : period === "all" ? nowSec : 30 * 86400;
  const currentStart = period === "all" ? 0 : nowSec - windowSec;
  const previousStart = period === "all" ? 0 : nowSec - windowSec * 2;

  const snapshot = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) as paused,
      SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END) as hired,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM jobs
    WHERE owner_id = ?
  `).bind(userId).first();

  const pending = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM interactions
    WHERE owner_id = ? AND kind = 'job' AND status = 'PENDING'
  `).bind(userId).first();

  const allResponses = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
  `).bind(userId).first();

  const periodJobs = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as previousCount,
      SUM(CASE WHEN created_at >= ? AND status = 'FILLED' THEN 1 ELSE 0 END) as hiredCurrent,
      SUM(CASE WHEN created_at >= ? AND created_at < ? AND status = 'FILLED' THEN 1 ELSE 0 END) as hiredPrevious
    FROM jobs
    WHERE owner_id = ?
  `).bind(currentStart, previousStart, currentStart, currentStart, previousStart, currentStart, userId).first();

  const periodResponses = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as previousCount
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
  `).bind(currentStart, previousStart, currentStart, userId).first();

  const jobsPosted = period === "all" ? asCount(snapshot?.total) : asCount(periodJobs?.currentCount);
  const hired = period === "all" ? asCount(snapshot?.hired) : asCount(periodJobs?.hiredCurrent);
  const interested = period === "all" ? asCount(allResponses?.count) : asCount(periodResponses?.currentCount);
  const active = asCount(snapshot?.active);

  return ok(c, {
    jobsPosted,
    active,
    interested,
    hired,
    completed: asCount(snapshot?.completed),
    pendingResponses: asCount(pending?.count),
    period,
    trends: {
      jobsPosted: trendPct(jobsPosted, asCount(periodJobs?.previousCount)),
      interested: trendPct(interested, asCount(periodResponses?.previousCount)),
      hired: trendPct(hired, asCount(periodJobs?.hiredPrevious)),
      active: null,
    },
  });
});

jobRoutes.get("/provider/recent", requireAuth, async (c) => {
  const userId = c.get("userId");
  
  // Get recent jobs with all needed data
  const recentJobs = await c.env.DB.prepare(`
    SELECT 
      j.id,
      j.role_id as roleId,
      j.category_id as categoryId,
      COALESCE(r.name, j.title, 'Job') as title,
      COALESCE(r.icon, '💼') as roleIcon,
      COALESCE(cat.name, 'General') as categoryName,
      COALESCE(cat.icon, '📋') as categoryIcon,
      j.area,
      j.latitude,
      j.longitude,
      j.pay_paise as payPaise,
      j.pay_unit as payUnit,
      j.status,
      j.created_at as createdAt
    FROM jobs j
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories cat ON cat.id = j.category_id
    WHERE j.owner_id = ?
    ORDER BY j.created_at DESC
    LIMIT 20
  `).bind(userId).all();

  if (!recentJobs.success) {
    console.error('DB query failed:', recentJobs.error);
    throw new ApiError("DATABASE_ERROR", 503, "Database query failed");
  }

  const jobsList = recentJobs.results || [];
  
  // If no jobs, return empty array
  if (jobsList.length === 0) {
    return ok(c, []);
  }
  
  // Build final results with applicant data for each job
  const jobsWithApplicants = await Promise.all(
    jobsList.map(async (job: any) => {
      try {
        // Get applicant count for this specific job
        const countRes = await c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM interactions
          WHERE job_id = ? AND kind = 'job'
        `).bind(job.id).first();
        
        const applicantCount = Number(countRes?.count || 0);
        
        let applicants: any[] = [];
        if (applicantCount > 0) {
          // Get sample applicants
          const applicantsRes = await c.env.DB.prepare(`
            SELECT 
              u.id,
              u.name,
              u.photo_url as photoUrl
            FROM interactions i
            JOIN users u ON u.id = i.worker_id
            WHERE i.job_id = ? AND i.kind = 'job'
            ORDER BY i.created_at DESC
            LIMIT 4
          `).bind(job.id).all();
          applicants = applicantsRes.results || [];
        }
        
        return {
          ...job,
          applicantCount,
          applicants,
        };
      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err);
        // Return job with empty applicant data on error
        return {
          ...job,
          applicantCount: 0,
          applicants: [],
        };
      }
    })
  );

  return ok(c, jobsWithApplicants);
});
