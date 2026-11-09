import { dispatchPendingPushes } from "../notifications/push";
import { matchAndNotifyNearbyWorkers } from "./matcher";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { jobSchema, formatDirectPhone } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { jobs, roles, categories } from "../../db/schema";

import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth, rateLimit, identify } from "../auth/session";
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

async function resolveJobCategoryAndRole(
  db: ReturnType<typeof drizzle>,
  categoryId: string,
  roleId: string,
): Promise<{ categoryId: string; roleId: string }> {
  const cleanCatId = (categoryId || "general").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "general";
  const cleanRoleId = (roleId || "general-work").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "general-work";

  // Check if category exists; if not, dynamically create it in database
  const cat = await db.select().from(categories).where(eq(categories.id, cleanCatId)).get();
  if (!cat) {
    const catName = cleanCatId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    await db.insert(categories).values({
      id: cleanCatId,
      kind: "job",
      name: catName,
      icon: "📋",
    }).onConflictDoNothing();
  }

  // Check if role exists; if not, dynamically create it linked to the category
  const role = await db.select().from(roles).where(eq(roles.id, cleanRoleId)).get();
  if (!role) {
    const roleName = cleanRoleId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    await db.insert(roles).values({
      id: cleanRoleId,
      categoryId: cleanCatId,
      name: roleName,
      icon: "💼",
    }).onConflictDoNothing();
  }

  return { categoryId: cleanCatId, roleId: cleanRoleId };
}

// ── GET /jobs (Discovery) ──
jobRoutes.get("/", async (c) => ok(c, await nearby(c, "job")));

// Archive a listing while retaining its immutable work and reputation history.
export async function archiveJobAndCloseRelations(
  db: D1Database,
  jobId: string,
  userId: string,
) {
  const job = await db
    .prepare("SELECT id, owner_id, title, role_id, pay_paise, pay_unit FROM jobs WHERE id = ?")
    .bind(jobId)
    .first<{
      id: string;
      owner_id: string;
      title: string;
      role_id: string;
      pay_paise: number;
      pay_unit: string;
    }>();

  if (!job) {
    throw new ApiError("JOB_NOT_FOUND", 404, "This job could not be found.");
  }
  if (job.owner_id !== userId) {
    throw new ApiError("UNAUTHORIZED", 403, "Only the job provider can delete this job.");
  }

  const nowTs = now();

  // 1. Preserve immutable snapshot of job title, role, pay on all related interactions (if columns exist)
  try {
    await db
      .prepare(
        `UPDATE interactions
         SET job_title_snapshot = COALESCE(NULLIF(job_title_snapshot, ''), ?),
             role_name_snapshot = COALESCE(NULLIF(role_name_snapshot, ''), (SELECT name FROM roles WHERE id = ?), 'Worker'),
             pay_paise_snapshot = COALESCE(pay_paise_snapshot, ?),
             pay_unit_snapshot = COALESCE(pay_unit_snapshot, ?)
         WHERE job_id = ?`,
      )
      .bind(job.title || "", job.role_id, job.pay_paise, job.pay_unit, jobId)
      .run();
  } catch {
    // Columns from migration 0027 may not be present in all environments yet
  }

  // 2. Close the listing first. The acceptance trigger rejects new hires once
  // status is DELETED, so a concurrent accept cannot slip into the close flow.
  await db
    .prepare(
      "UPDATE jobs SET status = 'DELETED', deleted_at = COALESCE(deleted_at, ?), archived_at = COALESCE(archived_at, ?) WHERE id = ? AND owner_id = ?",
    )
    .bind(nowTs, nowTs, jobId, userId)
    .run();

  // The migration trigger normally closes these rows atomically with the job.
  // This guarded repair also handles databases that have not applied that trigger yet.
  await db.prepare(`
    UPDATE interactions
    SET status = 'CANCELLED', cancelled_by = ?,
        cancellation_reason = 'Job closed by employer', cancelled_at = ?
    WHERE job_id = ? AND kind = 'job'
      AND (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')
        OR (status = 'CANCELLED' AND cancelled_by IS NULL))
  `).bind(userId, nowTs, jobId).run();

  // The job-close trigger cancels open applications, records the provider, and
  // notifies affected seekers. Remove stale provider-side application alerts.
  await db
    .prepare("DELETE FROM notifications WHERE json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.jobId') = ? AND type IN ('APPLICATION_CREATED', 'JOB_APPLICATION_ALERT')")
    .bind(jobId)
    .run();

  return { id: jobId, deleted: true, status: "DELETED" };
}

// Kept as an export alias for existing callers while the lifecycle name is updated.
export const deleteJobAndPurgeRelations = archiveJobAndCloseRelations;

// ── DELETE /jobs/:id (Archive listing and retain work history) ──
jobRoutes.delete("/:id", requireAuth, async (c) => {
  const jobId = c.req.param("id");
  const userId = c.get("userId");
  const result = await archiveJobAndCloseRelations(c.env.DB, jobId, userId);
  return ok(c, result);
});

// ── POST /jobs/:id/action (Status Change or Delete) ──
jobRoutes.post("/:id/action", requireAuth, async (c) => {
  const { action } = z
    .object({ action: z.enum(["pause", "publish", "cancel", "delete"]) })
    .parse(await c.req.json());

  const jobId = c.req.param("id");
  const userId = c.get("userId");

  if (action === "delete") {
    const result = await archiveJobAndCloseRelations(c.env.DB, jobId, userId);
    return ok(c, { ...result, status: "DELETED" });
  }

  const row = await drizzle(c.env.DB)
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();
  if (!row) throw new ApiError("JOB_NOT_FOUND", 404);
  if (row.ownerId !== userId) throw new ApiError("UNAUTHORIZED", 403);
  let next =
    action === "pause" && row.status === "PUBLISHED"
      ? "PAUSED"
      : action === "publish" && row.status === "PAUSED"
        ? "PUBLISHED"
        : action === "cancel" &&
            ["PUBLISHED", "PAUSED", "FILLED"].includes(row.status)
          ? "CANCELLED"
          : null;
  if (action === "publish" && row.status === "PAUSED") {
    const reserved = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM interactions WHERE job_id=? AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')").bind(row.id).first<{ count: number }>();
    const withinWindow = row.duration === "ongoing" || (row.endsAt != null && row.endsAt >= now() - 7 * 86400) || row.startsAt >= now() - 30 * 86400;
    next = !withinWindow ? "EXPIRED" : asCount(reserved?.count) >= row.workers ? "FILLED" : "PUBLISHED";
  }
  if (!next) throw new ApiError("INVALID_TRANSITION", 409);
  const changed = await c.env.DB.prepare(
    "UPDATE jobs SET status=? WHERE id=? AND owner_id=? AND status=? RETURNING id,status",
  )
    .bind(next, row.id, userId, row.status)
    .first();
  if (!changed) throw new ApiError("STATE_CHANGED", 409);

  if (action === "cancel") {
    // The migrated trigger normally records this with the status change; repair
    // legacy databases whose older trigger only changed the status.
    await c.env.DB.prepare(`
      UPDATE interactions
      SET cancelled_by = ?, cancellation_reason = 'Job closed by employer', cancelled_at = ?
      WHERE job_id = ? AND kind = 'job' AND status = 'CANCELLED' AND cancelled_by IS NULL
    `).bind(userId, now(), row.id).run();
    await c.env.DB.prepare(
      "DELETE FROM notifications WHERE json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.jobId') = ? AND type IN ('APPLICATION_CREATED', 'JOB_APPLICATION_ALERT')",
    ).bind(row.id).run();
  }

  return ok(c, changed);
});

// Provider can mark accepted hires complete without a separate start step.
// Accepted work moves to IN_PROGRESS, and each seeker still confirms
// completion individually before their interaction becomes COMPLETED.
jobRoutes.post("/:id/complete-work", requireAuth, async (c) => {
  const jobId = c.req.param("id");
  const userId = c.get("userId");
  const job = await c.env.DB.prepare(
    "SELECT id,owner_id,status FROM jobs WHERE id=?",
  ).bind(jobId).first<{ id: string; owner_id: string; status: string }>();
  if (!job) throw new ApiError("JOB_NOT_FOUND", 404, "This job could not be found.");
  if (job.owner_id !== userId) throw new ApiError("UNAUTHORIZED", 403, "Only the job provider can mark this work complete.");
  if (["CANCELLED", "DELETED"].includes(job.status)) throw new ApiError("INVALID_TRANSITION", 409, "Closed jobs cannot be marked complete.");

  const result = await c.env.DB.prepare(
    `UPDATE interactions
       SET owner_confirmed_at=?, completion_rejected_at=NULL, completion_rejected_by=NULL, completion_rejection_reason=NULL, status=CASE WHEN status='IN_PROGRESS' AND worker_confirmed_at IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
     WHERE job_id=? AND owner_id=? AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS') AND owner_confirmed_at IS NULL
     RETURNING id,status`,
  ).bind(now(), jobId, userId).all<{ id: string; status: string }>();
  if (!result.success) throw new ApiError("DATABASE_ERROR", 503, "Could not update job completion. Please retry.");

  const rows = (result.results || []) as Array<{ id: string; status: string }>;
  const completedCount = rows.filter((row) => row.status === "COMPLETED").length;
  const awaitingSeekerCount = rows.length - completedCount;
  return ok(c, {
    markedCount: rows.length,
    completedCount,
    awaitingSeekerCount,
  });
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

  const resolved = await resolveJobCategoryAndRole(db, input.categoryId, input.roleId);
  input.categoryId = resolved.categoryId;
  input.roleId = resolved.roleId;

  await rateLimit(c.env.DB, `publish:${c.get("userId")}`, 30, 86400);
  const id = crypto.randomUUID();
  await db
    .insert(jobs)
    .values({ ...input, id, ownerId: c.get("userId"), createdAt: now() })
    .onConflictDoNothing();

  const matchTask = matchAndNotifyNearbyWorkers(
    {
      id,
      ownerId: c.get("userId"),
      categoryId: input.categoryId,
      roleId: input.roleId,
      title: input.title,
      area: input.area,
      latitude: input.latitude,
      longitude: input.longitude,
      payPaise: input.payPaise,
      payUnit: input.payUnit,
    },
    c.env
  );
  if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
    c.executionCtx.waitUntil(matchTask);
  } else {
    void matchTask;
  }

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
  return ok(c, { id: saved?.id || id });
});


// ── GET /jobs/provider/history (Top recent completed jobs and engagements) ──
jobRoutes.get("/provider/history", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Math.max(Number(c.req.query("limit") || 15), 1), 50);
  const offset = Math.max(Number(c.req.query("offset") || 0), 0);

  const historyQuery = await c.env.DB.prepare(`
    SELECT 
      j.id,
      j.role_id as roleId,
      j.category_id as categoryId,
      COALESCE(NULLIF(j.title, ''), r.name, 'Job') as title,
      COALESCE(r.icon, '💼') as roleIcon,
      COALESCE(cat.name, 'General') as categoryName,
      COALESCE(cat.icon, '📋') as categoryIcon,
      j.area,
      j.latitude,
      j.longitude,
      j.starts_at as startsAt,
      j.workers,
      COALESCE(j.experience, 'any') as experience,
      COALESCE(j.duration, 'one') as duration,
      COALESCE(j.hours, 'full') as hours,
      j.extras,
      j.details,
      j.pay_paise as payPaise,
      j.pay_unit as payUnit,
      j.status,
      j.created_at as createdAt,
      COALESCE(j.archived_at, j.deleted_at, j.created_at) as archivedAt,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') AS completedCount,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) AS acceptedCount,
      (SELECT MAX(MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at))) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') AS lastCompletedAt
    FROM jobs j
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories cat ON cat.id = j.category_id
    WHERE j.owner_id = ? AND NOT EXISTS (SELECT 1 FROM user_hidden_job_history h WHERE h.user_id=? AND h.job_id=j.id) AND (
      UPPER(j.status) IN ('COMPLETED', 'EXPIRED')
      OR EXISTS (
        SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED'
      )
      OR (j.status = 'DELETED' AND EXISTS (
        SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED'
      ))
    )
    ORDER BY COALESCE(lastCompletedAt, j.created_at) DESC, j.id DESC
    LIMIT ? OFFSET ?
  `).bind(userId, userId, limit, offset).all();

  const totalCountRes = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM jobs j
    WHERE j.owner_id = ? AND NOT EXISTS (SELECT 1 FROM user_hidden_job_history h WHERE h.user_id=? AND h.job_id=j.id) AND (
      UPPER(j.status) IN ('COMPLETED', 'EXPIRED')
      OR EXISTS (
        SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED'
      )
      OR (j.status = 'DELETED' AND EXISTS (
        SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED'
      ))
    )
  `).bind(userId, userId).first<{ count: number }>();

  const total = asCount(totalCountRes?.count);
  const rows = historyQuery.results || [];

  const items = await Promise.all(
    rows.map(async (job: any) => {
      const workersRes = await c.env.DB.prepare(`
        SELECT 
          u.id,
          u.name,
          u.photo_url as photoUrl,
          i.id as interactionId,
          i.status,
          MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) as completedAt,
          (SELECT stars FROM reviews WHERE interaction_id=i.id AND author_id=?) as myRating,
          (SELECT body FROM reviews WHERE interaction_id=i.id AND author_id=?) as myFeedback,
          (SELECT stars FROM reviews WHERE interaction_id=i.id AND target_id=?) as receivedRating,
          (SELECT body FROM reviews WHERE interaction_id=i.id AND target_id=?) as receivedFeedback
        FROM interactions i
        JOIN users u ON u.id = i.worker_id
        WHERE i.job_id = ? AND i.kind = 'job' AND i.status = 'COMPLETED'
        ORDER BY MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) DESC
        LIMIT 10
      `).bind(userId, userId, userId, userId, job.id).all();

      return {
        ...job,
        completedWorkers: workersRes.results || [],
        applicantCount: asCount(job.acceptedCount),
        completedCount: asCount(job.completedCount),
        remainingWorkers: Math.max(0, Number(job.workers || 0) - asCount(job.acceptedCount)),
        hasReviews: (workersRes.results || []).some((w: any) => w.myRating || w.receivedRating),
      };
    })
  );

  return ok(c, {
    items,
    total,
    hasMore: offset + items.length < total,
    limit,
    offset,
  });
});

// Hide a completed job posting from this provider's history only.
jobRoutes.delete("/provider/history/:id", requireAuth, async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("id");
  const owned = await c.env.DB.prepare("SELECT id, status FROM jobs WHERE id=? AND owner_id=?")
    .bind(jobId, userId).first<{ id: string; status: string }>();
  if (!owned) throw new ApiError("JOB_NOT_FOUND", 404, "Job history entry not found.");
  const eligible = await c.env.DB.prepare(`
    SELECT 1 FROM jobs j
    WHERE j.id = ? AND (
      UPPER(j.status) IN ('COMPLETED', 'EXPIRED')
      OR EXISTS (SELECT 1 FROM interactions i WHERE i.job_id = j.id AND i.kind = 'job' AND i.status = 'COMPLETED')
    )
  `).bind(jobId).first();
  if (!eligible) throw new ApiError("INVALID_STATE", 409, "Only completed or historical jobs can be removed.");
  await c.env.DB.prepare("INSERT INTO user_hidden_job_history(user_id, job_id) VALUES(?, ?) ON CONFLICT(user_id, job_id) DO NOTHING")
    .bind(userId, jobId).run();
  return ok(c, { id: jobId, deleted: true });
});

// ── GET /jobs/provider/:ownerId/active (Active jobs posted by an employer) ──
jobRoutes.get("/provider/:ownerId/active", async (c) => {
  const ownerId = c.req.param("ownerId");
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  const hasUser = Boolean(user?.id);

  const activeJobsSql = `
    SELECT
      j.id,
      j.owner_id AS ownerId,
      j.role_id AS roleId,
      j.category_id AS categoryId,
      COALESCE(NULLIF(j.title, ''), r.name, 'Job') AS title,
      COALESCE(r.name, 'Worker') AS roleName,
      COALESCE(r.icon, '💼') AS roleIcon,
      COALESCE(cat.name, 'General') AS categoryName,
      COALESCE(cat.icon, '📋') AS categoryIcon,
      j.area,
      j.latitude,
      j.longitude,
      j.starts_at AS startsAt,
      j.ends_at AS endsAt,
      COALESCE(j.duration, 'one') AS duration,
      COALESCE(j.hours, 'full') AS hours,
      COALESCE(j.start_time, '09:00') AS startTime,
      COALESCE(j.end_time, '17:00') AS endTime,
      j.workers,
      j.pay_paise AS payPaise,
      j.pay_unit AS payUnit,
      COALESCE(j.details, '') AS details,
      j.status,
      j.created_at AS createdAt,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) AS acceptedCount,
      MAX(0, j.workers - (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))) AS remainingWorkers
      ${hasUser ? ", (SELECT status FROM interactions i WHERE i.job_id=j.id AND i.worker_id=? AND i.kind='job' LIMIT 1) AS myApplicationStatus" : ""}
    FROM jobs j
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories cat ON cat.id = j.category_id
    WHERE j.owner_id = ?
      AND UPPER(j.status) = 'PUBLISHED'
      AND j.deleted_at IS NULL
      AND j.archived_at IS NULL
      AND (j.duration = 'ongoing' OR (j.ends_at IS NOT NULL AND j.ends_at >= unixepoch() - 86400) OR (j.ends_at IS NULL AND j.starts_at >= unixepoch() - 86400 * 3))
      AND (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) < j.workers
    ORDER BY j.starts_at ASC, j.created_at DESC
    LIMIT 20
  `;
  const binds = hasUser ? [user!.id, ownerId] : [ownerId];
  const activeJobs = await c.env.DB.prepare(activeJobsSql).bind(...binds).all();
  return ok(c, activeJobs?.results ?? []);
});

// ── GET /jobs/provider/stats ──
jobRoutes.get("/provider/stats", requireAuth, async (c) => {
  const userId = c.get("userId");
  const period = z.enum(["week", "month", "all"]).catch("month").parse((c.req.query("period") || "month").toLowerCase());
  const nowSec = now();
  const windowSec = period === "week" ? 7 * 86400 : period === "all" ? nowSec : 30 * 86400;
  const currentStart = period === "all" ? 0 : nowSec - windowSec;
  const previousStart = period === "all" ? 0 : nowSec - windowSec * 2;

  const snapshot = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN UPPER(status) = 'PUBLISHED' AND (duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30) THEN 1 ELSE 0 END) as active
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

  const allAccepted = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
      AND (accepted_at IS NOT NULL OR status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED'))
  `).bind(userId).first();

  const allCompleted = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM interactions
    WHERE owner_id = ? AND kind = 'job' AND status = 'COMPLETED'
  `).bind(userId).first();

  const periodJobs = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as previousCount
    FROM jobs
    WHERE owner_id = ?
  `).bind(currentStart, previousStart, currentStart, userId).first();

  const periodResponses = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as previousCount
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
  `).bind(currentStart, previousStart, currentStart, userId).first();

  const periodAccepted = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN COALESCE(accepted_at, created_at) >= ? AND (accepted_at IS NOT NULL OR status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')) THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN COALESCE(accepted_at, created_at) >= ? AND COALESCE(accepted_at, created_at) < ? AND (accepted_at IS NOT NULL OR status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')) THEN 1 ELSE 0 END) as previousCount
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
  `).bind(currentStart, previousStart, currentStart, userId).first();

  const periodCompleted = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN MAX(COALESCE(worker_confirmed_at, created_at), COALESCE(owner_confirmed_at, created_at)) >= ? AND status = 'COMPLETED' THEN 1 ELSE 0 END) as currentCount,
      SUM(CASE WHEN MAX(COALESCE(worker_confirmed_at, created_at), COALESCE(owner_confirmed_at, created_at)) >= ? AND MAX(COALESCE(worker_confirmed_at, created_at), COALESCE(owner_confirmed_at, created_at)) < ? AND status = 'COMPLETED' THEN 1 ELSE 0 END) as previousCount
    FROM interactions
    WHERE owner_id = ? AND kind = 'job'
  `).bind(currentStart, previousStart, currentStart, userId).first();

  // Headline counts are lifetime totals. Period-specific counts remain available
  // separately for trends; deleting a listing must never rewrite this history.
  const jobsPosted = asCount(snapshot?.total);
  const hired = asCount(allAccepted?.count);
  const completed = asCount(allCompleted?.count);
  const jobsPostedInPeriod = asCount(periodJobs?.currentCount);
  const hiredInPeriod = asCount(periodAccepted?.currentCount);
  const completedInPeriod = asCount(periodCompleted?.currentCount);
  const interested = period === "all" ? asCount(allResponses?.count) : asCount(periodResponses?.currentCount);
  const active = asCount(snapshot?.active);
  const currentHiresRow = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count FROM interactions
    WHERE owner_id = ? AND kind = 'job' AND status IN ('ACCEPTED', 'IN_PROGRESS')
  `).bind(userId).first();

  return ok(c, {
    jobsPosted,
    active,
    interested,
    hired,
    currentHires: asCount(currentHiresRow?.count),
    completed,
    jobsPostedInPeriod,
    hiredInPeriod,
    completedInPeriod,
    acceptedJobs: hired,
    activeJobsPosted: active,
    pendingResponses: asCount(pending?.count),
    period,
    trends: {
      jobsPosted: period === "all" ? null : trendPct(jobsPostedInPeriod, asCount(periodJobs?.previousCount)),
      interested: period === "all" ? null : trendPct(interested, asCount(periodResponses?.previousCount)),
      hired: period === "all" ? null : trendPct(hiredInPeriod, asCount(periodAccepted?.previousCount)),
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
      COALESCE(NULLIF(j.title, ''), r.name, 'Job') as title,
      COALESCE(r.icon, '💼') as roleIcon,
      COALESCE(cat.name, 'General') as categoryName,
      COALESCE(cat.icon, '📋') as categoryIcon,
      j.area,
      j.latitude,
      j.longitude,
      j.starts_at as startsAt,
      j.workers,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) AS acceptedCount,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') AS completedCount,
      COALESCE(j.experience, 'any') as experience,
      COALESCE(j.duration, 'one') as duration,
      COALESCE(j.hours, 'full') as hours,
      j.extras,
      j.details,
      j.pay_paise as payPaise,
      j.pay_unit as payUnit,
      CASE 
        WHEN (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') >= j.workers THEN 'COMPLETED'
        WHEN (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') > 0 AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('PENDING','ACCEPTED','IN_PROGRESS')) THEN 'COMPLETED'
        WHEN j.status IN ('PUBLISHED','PAUSED') AND NOT (j.duration='ongoing' OR (j.ends_at IS NOT NULL AND j.ends_at>=unixepoch()-86400*7) OR j.starts_at>=unixepoch()-86400*30) THEN 'EXPIRED' 
        ELSE j.status 
      END AS status,
      j.created_at as createdAt,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS') AND i.owner_confirmed_at IS NULL) AS workAwaitingProviderCount,
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='IN_PROGRESS' AND i.owner_confirmed_at IS NOT NULL) AS workAwaitingSeekerCount
    FROM jobs j
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories cat ON cat.id = j.category_id
    WHERE j.owner_id = ? AND NOT EXISTS (SELECT 1 FROM user_hidden_job_history h WHERE h.user_id=? AND h.job_id=j.id) AND (
      UPPER(j.status) IN ('PUBLISHED', 'PAUSED', 'FILLED', 'COMPLETED', 'EXPIRED')
      OR (j.status = 'DELETED' AND EXISTS (
        SELECT 1 FROM interactions i WHERE i.job_id = j.id AND i.kind = 'job' AND i.status = 'COMPLETED'
      ))
    )
    ORDER BY j.created_at DESC
    LIMIT 20
  `).bind(userId, userId).all();

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
      const countRes = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT worker_id) as count
        FROM interactions
        WHERE job_id = ? AND kind = 'job'
      `).bind(job.id).first();
      const applicantCount = asCount(countRes?.count);

      let applicants: any[] = [];
      // Keep the count authoritative if optional applicant preview data is unavailable.
      if (applicantCount > 0) {
        try {
          const applicantsRes = await c.env.DB.prepare(`
            SELECT 
              u.id,
              u.name,
              u.photo_url as photoUrl
            FROM interactions i
            JOIN users u ON u.id = i.worker_id
            WHERE i.job_id = ? AND i.kind = 'job'
              AND i.id=(SELECT latest.id FROM interactions latest WHERE latest.job_id=i.job_id AND latest.worker_id=i.worker_id AND latest.kind='job' ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
            ORDER BY i.created_at DESC
            LIMIT 4
          `).bind(job.id).all();
          applicants = applicantsRes.results || [];
        } catch (err) {
          console.error(`Error loading applicant previews for job ${job.id}:`, err);
        }
      }

      return {
        ...job,
        applicantCount,
        acceptedCount: asCount(job.acceptedCount),
        completedCount: asCount(job.completedCount),
        remainingWorkers: Math.max(0, Number(job.workers || 0) - asCount(job.acceptedCount)),
        workAwaitingProviderCount: asCount(job.workAwaitingProviderCount),
        workAwaitingSeekerCount: asCount(job.workAwaitingSeekerCount),
        applicants,
      };
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
      (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) AS acceptedCount,
      COALESCE(j.experience, 'any') AS experience,
      j.pay_paise AS payPaise,
      j.pay_unit AS payUnit,
      COALESCE(j.paid_when, 'after') AS paidWhen,
      j.extras,
      COALESCE(j.details, '') AS details,
      CASE WHEN j.status IN ('PUBLISHED','PAUSED') AND NOT (j.duration='ongoing' OR (j.ends_at IS NOT NULL AND j.ends_at>=unixepoch()-86400*7) OR j.starts_at>=unixepoch()-86400*30) THEN 'EXPIRED' ELSE j.status END AS status,
      j.created_at AS createdAt,
      COALESCE(u.name, 'Employer') AS ownerName,
      u.phone AS ownerPhone,
      u.photo_url AS ownerPhotoUrl,
      u.phone_verified AS ownerVerified,
      (SELECT ROUND(AVG(stars),1) FROM reviews WHERE target_id=u.id) AS ownerRating,
      (SELECT COUNT(*) FROM reviews WHERE target_id=u.id) AS ownerReviewsCount
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
      "This job was deleted or is no longer available.",
    );
  }

  const currentUser = await identify(c.env.DB, c.req.header("Authorization"));
  const currentUserId = currentUser?.id;
  const isOwner = Boolean(currentUserId && currentUserId === job.ownerId);
  const isOnlineJob =
    String(job.area || "").trim().toLowerCase() === "online" ||
    /work mode\s*:\s*online/i.test(String(job.details || ""));

  let myApplication: { id: string; status: string; acceptedAt: number | null } | null = null;
  if (currentUserId && !isOwner) {
    const appRow = await c.env.DB.prepare(
      "SELECT id, status, accepted_at AS acceptedAt FROM interactions WHERE job_id = ? AND worker_id = ? ORDER BY created_at DESC, id DESC LIMIT 1"
    )
      .bind(job.id, currentUserId)
      .first<{ id: string; status: string; acceptedAt: number | null }>();
    if (appRow) {
      myApplication = { id: appRow.id, status: appRow.status, acceptedAt: appRow.acceptedAt };
    }
  }

  const hasWorkHistory = Boolean(myApplication && (
    myApplication.status === "COMPLETED" || myApplication.acceptedAt != null
  ));
  if (job.status === "DELETED" && !isOwner && !hasWorkHistory) {
    throw new ApiError("JOB_NOT_FOUND", 404, "This job was deleted and is no longer available.");
  }

  // Privacy barrier: hide provider phone unless viewer is the owner or an accepted applicant
  const isAccepted = myApplication && ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(myApplication.status);
  job.mapLatitude = job.latitude != null && Number.isFinite(Number(job.latitude)) ? Math.round(Number(job.latitude) * 10) / 10 : null;
  job.mapLongitude = job.longitude != null && Number.isFinite(Number(job.longitude)) ? Math.round(Number(job.longitude) * 10) / 10 : null;
  if (!isOwner && !isAccepted) {
    job.ownerPhone = null;
  } else if (job.ownerPhone) {
    job.ownerPhone = formatDirectPhone(job.ownerPhone);
  }

  if (isOnlineJob || (!isOwner && !isAccepted)) {
    // Exact worksite details stay private until a provider accepts the seeker.
    // Online jobs have no physical destination to reveal.
    job.address = "";
    job.latitude = null;
    job.longitude = null;
  }
  if (isOnlineJob) {
    job.mapLatitude = null;
    job.mapLongitude = null;
  }

  // Fetch applicant count & details for this job
  let applicantCount = 0;
  let applicants: any[] = [];
  try {
    const countRes = await c.env.DB.prepare(
      "SELECT COUNT(DISTINCT worker_id) as count FROM interactions WHERE job_id = ? AND kind = 'job'"
    )
      .bind(job.id)
      .first<any>();
    applicantCount = Number(countRes?.count || 0);

    if (applicantCount > 0 && isOwner) {
      const applicantsRes = await c.env.DB.prepare(`
        SELECT 
          i.id as applicationId,
          u.id,
          u.name,
          CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') THEN u.phone ELSE NULL END as phone,
          u.area,
          u.photo_url as photoUrl,
          i.created_at as appliedAt,
          (SELECT ROUND(AVG(r.stars), 1) FROM reviews r WHERE r.target_id = u.id) as rating,
          (SELECT COUNT(*) FROM reviews r WHERE r.target_id = u.id) as totalReviews,
          EXISTS(SELECT 1 FROM reviews rr WHERE rr.interaction_id=i.id AND rr.author_id=i.owner_id) as reviewedByProvider,
          i.owner_confirmed_at AS ownerConfirmedAt,
          i.worker_confirmed_at AS workerConfirmedAt,
          i.completion_rejected_at AS completionRejectedAt,
          i.completion_rejected_by AS completionRejectedBy,
          i.completion_rejection_reason AS completionRejectionReason,
          i.cancellation_reason as cancellationReason,
          i.status
        FROM interactions i
        JOIN users u ON u.id = i.worker_id
        WHERE i.job_id = ? AND i.kind = 'job'
          AND i.id=(SELECT latest.id FROM interactions latest WHERE latest.job_id=i.job_id AND latest.worker_id=i.worker_id AND latest.kind='job' ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
        ORDER BY i.created_at DESC
      `).bind(job.id).all();
      applicants = (applicantsRes.results || []).map((app: any) => ({
        ...app,
        phone: app.phone ? formatDirectPhone(app.phone) : null,
      }));
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
    acceptedCount: asCount(job.acceptedCount),
    remainingWorkers: Math.max(0, Number(job.workers || 0) - asCount(job.acceptedCount)),
    applicants,
    extras,
    myApplication,
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
  if (["CANCELLED", "DELETED"].includes(existing.status)) {
    throw new ApiError("INVALID_TRANSITION", 400, "Closed jobs cannot be edited.");
  }
  const reservedRes = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM interactions WHERE job_id=? AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')",
  ).bind(jobId).first<{ count: number }>();
  if (input.workers < asCount(reservedRes?.count)) {
    throw new ApiError("CAPACITY_BELOW_RESERVED", 409, "Required members cannot be fewer than workers already accepted.");
  }
  const resolved = await resolveJobCategoryAndRole(db, input.categoryId, input.roleId);
  input.categoryId = resolved.categoryId;
  input.roleId = resolved.roleId;

  try {
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
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes("CAPACITY_BELOW_RESERVED")) {
      throw new ApiError("CAPACITY_BELOW_RESERVED", 409, "Required members cannot be fewer than workers already accepted.");
    }
    throw error;
  }

  return ok(c, { id: jobId, updated: true });
});

// ── POST /jobs/:id/apply ──
jobRoutes.post("/:id/apply", requireAuth, async (c) => {
  const job = await drizzle(c.env.DB)
    .select()
    .from(jobs)
    .where(eq(jobs.id, c.req.param("id")))
    .get();
  if (!job) {
    throw new ApiError(
      "JOB_NOT_FOUND",
      404,
      "This job is no longer available.",
    );
  }
  const isExpired = !(job.duration === "ongoing" || (job.endsAt != null && job.endsAt >= now() - 7 * 86400) || job.startsAt >= now() - 30 * 86400);
  if (job.status !== "PUBLISHED" || isExpired) {
    throw new ApiError(
      "JOB_NOT_AVAILABLE",
      409,
      "This job is no longer accepting applications.",
    );
  }
  if (job.ownerId === c.get("userId")) {
    throw new ApiError(
      "SELF_APPLICATION",
      400,
      "Security Violation: You are the creator of this job posting and cannot apply to it.",
    );
  }
  const id = crypto.randomUUID();
  let result;
  try {
    const roleRow = await c.env.DB.prepare("SELECT name FROM roles WHERE id=?").bind(job.roleId).first<{ name: string }>();
    const roleName = roleRow?.name || "Worker";
    const titleSnapshot = job.title || roleName;
    try {
      result = await c.env.DB.prepare(
        "INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,details,created_at,job_title_snapshot,role_name_snapshot,pay_paise_snapshot,pay_unit_snapshot) VALUES(?,'job',?,?,?,'PENDING','',?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id",
      )
        .bind(id, job.id, job.ownerId, c.get("userId"), now(), titleSnapshot, roleName, job.payPaise, job.payUnit)
        .first();
    } catch (insertErr) {
      const errStr = String(insertErr);
      if (errStr.includes("no such column")) {
        result = await c.env.DB.prepare(
          "INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,details,created_at) VALUES(?,'job',?,?,?,'PENDING','',?) ON CONFLICT DO NOTHING RETURNING id",
        )
          .bind(id, job.id, job.ownerId, c.get("userId"), now())
          .first();
      } else {
        throw insertErr;
      }
    }
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes("JOB_UNAVAILABLE")) throw new ApiError("JOB_UNAVAILABLE", 409, "This job is no longer accepting applications.");
    throw error;
  }
  if (!result)
    throw new ApiError(
      "APPLICATION_EXISTS",
      409,
      "You've already applied to this job.",
    );

  if (c.executionCtx && c.env.PUSH_DELIVERIES) {
    c.executionCtx.waitUntil(dispatchPendingPushes(c.env).catch(() => {}));
  }
  return ok(c, { id });
});
