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

function asCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function trendPct(current: number, previous: number): number | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

// ── GET /jobs (Discovery) ──
jobRoutes.get("/", async (c) => ok(c, await nearby(c, "job")));

// ── POST /jobs/:id/action (Status Change) ──
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

// ── POST /jobs (Create New Job) ──
jobRoutes.post("/", requireAuth, async (c) => {
  const input = jobSchema
    .extend({ submissionKey: z.string().min(8).max(100) })
    .parse(await c.req.json());
  if (input.startsAt < now() - 3600 || input.startsAt > now() + 366 * 86400)
    throw new ApiError("INVALID_DATE");
  const db = drizzle(c.env.DB);
  const existing = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerId, c.get("userId")),
        eq(jobs.submissionKey, input.submissionKey),
      ),
    )
    .get();
  if (existing) return ok(c, existing);
  if (
    (input.duration === "few" && (!input.endsAt || input.endsAt <= input.startsAt)) ||
    (input.duration !== "few" && input.endsAt !== null) ||
    (input.hours === "custom" && input.endTime <= input.startTime)
  )
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

// ── GET /jobs/provider/stats ──
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

// ── GET /jobs/provider/recent ──
jobRoutes.get("/provider/recent", requireAuth, async (c) => {
  const userId = c.get("userId");
  
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
  if (jobsList.length === 0) {
    return ok(c, []);
  }
  
  const jobsWithApplicants = await Promise.all(
    jobsList.map(async (job: any) => {
      try {
        const countRes = await c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM interactions
          WHERE job_id = ? AND kind = 'job'
        `).bind(job.id).first();
        
        const applicantCount = Number(countRes?.count || 0);
        
        let applicants: any[] = [];
        if (applicantCount > 0) {
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

// ── GET /jobs/:id (Job Details) ──
jobRoutes.get("/:id", async (c) => {
  const jobId = c.req.param("id");
  console.log(`[API] GET /jobs/${jobId} requested`);

  const job = await c.env.DB.prepare(`
    SELECT 
      j.id,
      j.owner_id AS ownerId,
      j.category_id AS categoryId,
      j.role_id AS roleId,
      COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity') AS title,
      j.title AS customTitle,
      COALESCE(cat.name, 'General Work') AS categoryName,
      COALESCE(cat.icon, '📋') AS categoryIcon,
      COALESCE(r.name, j.title, 'Worker') AS roleName,
      COALESCE(r.icon, '🛠️') AS roleIcon,
      j.area,
      COALESCE(j.address, '') AS address,
      j.latitude,
      j.longitude,
      j.starts_at AS startsAt,
      COALESCE(j.duration, 'one') AS duration,
      j.ends_at AS endsAt,
      COALESCE(j.hours, 'full') AS hours,
      COALESCE(j.start_time, '09:00') AS startTime,
      COALESCE(j.end_time, '17:00') AS endTime,
      j.workers,
      COALESCE(j.experience, 'any') AS experience,
      j.pay_paise AS payPaise,
      j.pay_unit AS payUnit,
      COALESCE(j.paid_when, 'after') AS paidWhen,
      j.extras,
      COALESCE(j.details, '') AS details,
      j.status,
      j.created_at AS createdAt,
      COALESCE(u.name, 'Employer') AS ownerName,
      u.phone AS ownerPhone,
      u.photo_url AS ownerPhotoUrl
    FROM jobs j
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories cat ON cat.id = j.category_id
    LEFT JOIN users u ON u.id = j.owner_id
    WHERE j.id = ?
  `)
    .bind(jobId)
    .first<any>();

  if (!job) {
    console.warn(`[API] Job ${jobId} not found in database`);
    throw new ApiError(
      "JOB_NOT_FOUND",
      404,
      "This job is no longer available.",
    );
  }

  // Fetch applicant count & details for this job
  let applicantCount = 0;
  let applicants: any[] = [];
  try {
    const countRes = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE job_id = ? AND kind = 'job'"
    )
      .bind(job.id)
      .first<any>();
    applicantCount = Number(countRes?.count || 0);

    if (applicantCount > 0) {
      const applicantsRes = await c.env.DB.prepare(`
        SELECT 
          u.id,
          u.name,
          u.phone,
          u.area,
          u.photo_url as photoUrl,
          i.created_at as appliedAt,
          i.status
        FROM interactions i
        JOIN users u ON u.id = i.worker_id
        WHERE i.job_id = ? AND i.kind = 'job'
        ORDER BY i.created_at DESC
      `).bind(job.id).all();
      applicants = applicantsRes.results || [];
    }
  } catch (err) {
    console.error("[API] Error fetching applicant count/details:", err);
  }

  // Safe parse extras
  let extras: string[] = [];
  if (Array.isArray(job.extras)) {
    extras = job.extras;
  } else if (typeof job.extras === "string") {
    try {
      extras = JSON.parse(job.extras);
    } catch {
      extras = [];
    }
  }

  return ok(c, {
    ...job,
    applicantCount,
    applicants,
    extras,
  });
});

// ── PUT /jobs/:id (In-Place Update) ──
jobRoutes.put("/:id", requireAuth, async (c) => {
  const jobId = c.req.param("id");
  const userId = c.get("userId");
  const input = jobSchema.parse(await c.req.json());

  if (input.startsAt < now() - 86400 || input.startsAt > now() + 366 * 86400) {
    throw new ApiError("INVALID_DATE");
  }
  if (
    (input.duration === "few" && (!input.endsAt || input.endsAt <= input.startsAt)) ||
    (input.duration !== "few" && input.endsAt !== null) ||
    (input.hours === "custom" && input.endTime <= input.startTime)
  ) {
    throw new ApiError("INVALID_SCHEDULE", 400, "Please check the end date and working hours.");
  }

  const db = drizzle(c.env.DB);
  const existing = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();

  if (!existing) {
    throw new ApiError("JOB_NOT_FOUND", 404);
  }
  if (existing.ownerId !== userId) {
    throw new ApiError("UNAUTHORIZED", 403, "You do not have permission to edit this job.");
  }
  if (existing.status === "CANCELLED") {
    throw new ApiError("INVALID_TRANSITION", 400, "Cancelled jobs cannot be edited.");
  }

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

  await db
    .update(jobs)
    .set({
      categoryId: input.categoryId,
      roleId: input.roleId,
      title: input.title,
      area: input.area,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      startsAt: input.startsAt,
      duration: input.duration,
      endsAt: input.endsAt,
      hours: input.hours,
      startTime: input.startTime,
      endTime: input.endTime,
      workers: input.workers,
      experience: input.experience,
      payPaise: input.payPaise,
      payUnit: input.payUnit,
      paidWhen: input.paidWhen,
      extras: input.extras,
      details: input.details,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerId, userId)));

  return ok(c, { id: jobId, updated: true });
});

// ── POST /jobs/:id/apply ──
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
  if (job.ownerId === c.get("userId")) {
    throw new ApiError(
      "SELF_APPLICATION",
      400,
      "Security Violation: You are the creator of this job posting and cannot apply to it.",
    );
  }
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
