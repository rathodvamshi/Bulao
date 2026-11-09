import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { identify } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";
export const profiles = new Hono<AppEnv>();
profiles.get("/:id", async (c) => {
  const id = c.req.param("id");
  const jobId = c.req.query("jobId");
  const serviceId = c.req.query("serviceId");
  const role = c.req.query("role");
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  if (user && user.id !== id) await assertUnblocked(c.env.DB, user.id, id);
  // Keep the hiring overview on the same owner/job basis as provider dashboard stats.
  const profile = await c.env.DB.prepare(
    `SELECT
       id, name, area, photo_url AS photoUrl, phone, phone_verified AS phoneVerified, created_at AS createdAt,
       (SELECT COUNT(*) FROM interactions WHERE kind='job' AND status='COMPLETED' AND ${role === "seeker" ? "worker_id" : "owner_id"}=users.id) AS completed,
       (SELECT COUNT(*) FROM interactions WHERE kind='job' AND owner_id=users.id AND (accepted_at IS NOT NULL OR status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED'))) AS acceptedJobs,
       (SELECT COUNT(*) FROM interactions WHERE kind='job' AND owner_id=users.id AND status IN ('ACCEPTED', 'IN_PROGRESS')) AS currentHires,
       (SELECT COUNT(*) FROM jobs WHERE owner_id=users.id) AS jobsPosted,
       (SELECT COUNT(*) FROM jobs WHERE owner_id=users.id AND UPPER(status)='PUBLISHED' AND (duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30)) AS activeJobsPosted,
       (SELECT COUNT(*) FROM interactions WHERE kind='job' AND owner_id=users.id AND cancelled_by=users.id AND accepted_at IS NOT NULL) AS lateCancellations,
       (SELECT COUNT(*) FROM interactions WHERE kind='job' AND owner_id=users.id AND cancelled_by=users.id AND accepted_at IS NULL) AS preAcceptanceWithdrawals
     FROM users WHERE id=? AND suspended=0`,
  )
    .bind(id)
    .first<any>();
  if (!profile) throw new ApiError("NOT_FOUND", 404);

  // Contact privacy barrier: unlock only for the exact accepted job/service.
  let canViewPhone = false;
  if (user) {
    if (user.id === id) {
      canViewPhone = true;
    } else if (jobId) {
      const acceptedForThisJob = await c.env.DB.prepare(
        `SELECT id FROM interactions
         WHERE job_id=? AND owner_id=? AND worker_id=? AND kind='job'
           AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')
         LIMIT 1`,
      )
        .bind(jobId, id, user.id)
        .first();
      canViewPhone = Boolean(acceptedForThisJob);
    } else if (serviceId) {
      const acceptedForThisService = await c.env.DB.prepare(
        `SELECT id FROM interactions
         WHERE service_id=? AND owner_id=? AND worker_id=? AND kind='service'
           AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')
         LIMIT 1`,
      )
        .bind(serviceId, user.id, id)
        .first();
      canViewPhone = Boolean(acceptedForThisService);
    }
  }

  const completedCount = Number(profile.completed || 0);
  const lateCancellations = Number(profile.lateCancellations || 0);
  const totalCommitted = completedCount + lateCancellations;
  const completionRate = totalCommitted > 0 ? Math.round((completedCount / totalCommitted) * 100) : null;

  if (role === "seeker") {
    const [summaryResult, reviewsResult] = await c.env.DB.batch([
      c.env.DB.prepare(
        `SELECT ROUND(AVG(r.stars),1) AS rating, COUNT(r.id) AS totalReviews,
          COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
          COALESCE(SUM(CASE WHEN r.stars=4 THEN 1 ELSE 0 END), 0) AS stars4,
          COALESCE(SUM(CASE WHEN r.stars=3 THEN 1 ELSE 0 END), 0) AS stars3,
          COALESCE(SUM(CASE WHEN r.stars=2 THEN 1 ELSE 0 END), 0) AS stars2,
          COALESCE(SUM(CASE WHEN r.stars=1 THEN 1 ELSE 0 END), 0) AS stars1,
          COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
         FROM reviews r JOIN interactions i ON i.id=r.interaction_id
         WHERE r.target_id=? AND i.kind='job' AND i.worker_id=? AND i.owner_id=r.author_id
           AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL`,
      ).bind(id, id),
      c.env.DB.prepare(
        `SELECT r.id, r.stars, r.body, r.created_at AS createdAt, u.name AS author,
          COALESCE(NULLIF(j.title, ''), roles.name, 'Completed job') AS jobTitle
         FROM reviews r JOIN users u ON u.id=r.author_id
         JOIN interactions i ON i.id=r.interaction_id
         LEFT JOIN jobs j ON j.id=i.job_id
         LEFT JOIN roles ON roles.id=j.role_id
         WHERE r.target_id=? AND i.kind='job' AND i.worker_id=? AND i.owner_id=r.author_id
           AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
         ORDER BY r.created_at DESC, r.id DESC LIMIT 20`,
      ).bind(id, id),
    ]);
    const seekerSummary: any = summaryResult?.results?.[0] ?? {};
    return ok(c, {
      ...profile,
      ...seekerSummary,
      reputationType: "worker",
      activeJobs: [],
      area: user?.id === id ? profile.area : null,
      phone: canViewPhone ? profile.phone : null,
      contactUnlocked: canViewPhone,
      cancelledJobs: 0,
      lateCancellations: 0,
      completionRate: null,
      reliabilityScore: null,
      reviews: reviewsResult?.results ?? [],
    });
  }

  if (role === "service") {
    let serviceSummary: any = { rating: null, totalReviews: 0, totalFeedback: 0, stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0 };
    let serviceReviews: any[] = [];
    try {
      const [summaryResult, reviewsResult] = await c.env.DB.batch([
        c.env.DB.prepare(
          `SELECT ROUND(AVG(sr.stars), 1) AS rating, COUNT(sr.id) AS totalReviews,
             COALESCE(SUM(CASE WHEN sr.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
             COALESCE(SUM(CASE WHEN sr.stars=4 THEN 1 ELSE 0 END), 0) AS stars4,
             COALESCE(SUM(CASE WHEN sr.stars=3 THEN 1 ELSE 0 END), 0) AS stars3,
             COALESCE(SUM(CASE WHEN sr.stars=2 THEN 1 ELSE 0 END), 0) AS stars2,
             COALESCE(SUM(CASE WHEN sr.stars=1 THEN 1 ELSE 0 END), 0) AS stars1,
             COALESCE(SUM(CASE WHEN TRIM(COALESCE(sr.feedback,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
           FROM service_ratings sr
           WHERE sr.provider_id=?`,
        ).bind(id),
        c.env.DB.prepare(
          `SELECT sr.id, sr.stars, sr.feedback AS body, sr.created_at AS createdAt,
             u.name AS author, COALESCE(cats.name, 'Verified Service') AS jobTitle
           FROM service_ratings sr
           JOIN users u ON u.id=sr.customer_id
           LEFT JOIN service_profiles sp ON sp.id=sr.service_id
           LEFT JOIN categories cats ON cats.id=sp.category_id
           WHERE sr.provider_id=?
           ORDER BY sr.created_at DESC, sr.id DESC LIMIT 20`,
        ).bind(id),
      ]);
      serviceSummary = summaryResult?.results?.[0] ?? serviceSummary;
      serviceReviews = reviewsResult?.results ?? [];
    } catch (error) {
      if (!/no such table:\s*service_ratings/i.test(String((error as Error)?.message ?? error))) throw error;
      console.warn(`[Profile reputation compatibility] [${c.get("requestId")}] service_ratings is not present`);
    }
    return ok(c, {
      ...profile,
      ...serviceSummary,
      reputationType: "service",
      area: user?.id === id ? profile.area : null,
      phone: canViewPhone ? profile.phone : null,
      contactUnlocked: canViewPhone,
      cancelledJobs: lateCancellations,
      lateCancellations,
      completionRate,
      reliabilityScore: completionRate,
      reviews: serviceReviews,
    });
  }

  // Employer reputation: reviews seekers (workers) gave the provider (employer) for completed jobs.
  // Service ratings are strictly kept separate and not blended into the employer job rating.
  const [summaryResult, reviewsResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT ROUND(AVG(r.stars), 1) AS rating, COUNT(r.id) AS totalReviews,
         COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
         COALESCE(SUM(CASE WHEN r.stars=4 THEN 1 ELSE 0 END), 0) AS stars4,
         COALESCE(SUM(CASE WHEN r.stars=3 THEN 1 ELSE 0 END), 0) AS stars3,
         COALESCE(SUM(CASE WHEN r.stars=2 THEN 1 ELSE 0 END), 0) AS stars2,
         COALESCE(SUM(CASE WHEN r.stars=1 THEN 1 ELSE 0 END), 0) AS stars1,
         COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
       FROM reviews r
       JOIN interactions i ON i.id = r.interaction_id
       WHERE r.target_id=? AND i.kind='job' AND i.owner_id=? AND i.worker_id=r.author_id
         AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL`,
    ).bind(id, id),
    c.env.DB.prepare(
      `SELECT r.id, r.stars, r.body, r.created_at AS createdAt, u.name AS author,
         COALESCE(NULLIF(j.title, ''), roles.name, 'Verified Work') AS jobTitle
       FROM reviews r
       JOIN users u ON u.id = r.author_id
       JOIN interactions i ON i.id = r.interaction_id
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN roles roles ON roles.id = j.role_id
       WHERE r.target_id=? AND i.kind='job' AND i.owner_id=? AND i.worker_id=r.author_id
         AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
       ORDER BY r.created_at DESC, r.id DESC LIMIT 20`,
    ).bind(id, id),
  ]);
  const employerSummary: any = summaryResult?.results?.[0] ?? {};
  const employerReviews = reviewsResult?.results ?? [];

  // Query service reputation separately so the provider profile can display it in a distinct section
  let serviceReputation: any = null;
  try {
    const sResult = await c.env.DB.prepare(
      `SELECT ROUND(AVG(sr.stars), 1) AS rating, COUNT(sr.id) AS totalReviews,
         COALESCE(SUM(CASE WHEN TRIM(COALESCE(sr.feedback,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
       FROM service_ratings sr WHERE sr.provider_id=?`,
    ).bind(id).first();
    if (sResult) {
      serviceReputation = {
        rating: sResult.rating ?? null,
        totalReviews: Number(sResult.totalReviews || 0),
        totalFeedback: Number(sResult.totalFeedback || 0),
      };
    }
  } catch (error) {
    if (!/no such table:\s*service_ratings/i.test(String((error as Error)?.message ?? error))) throw error;
  }

  // Active jobs currently open and hiring by this provider
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
  const activeJobsBinds = hasUser ? [user!.id, id] : [id];
  let activeJobs: any[] = [];
  try {
    const activeJobsResult = await c.env.DB.prepare(activeJobsSql).bind(...activeJobsBinds).all();
    activeJobs = activeJobsResult?.results ?? [];
  } catch (error) {
    console.warn(`[Profile active jobs query] [${c.get("requestId")}] Could not query active jobs:`, error);
  }

  return ok(c, {
    ...profile,
    ...employerSummary,
    reputationType: "employer",
    serviceReputation,
    activeJobs,
    // A provider's precise area is private profile data; seekers use the job's
    // coarse location and receive any destination details through the job flow.
    area: user?.id === id ? profile.area : null,
    phone: canViewPhone ? profile.phone : null,
    contactUnlocked: canViewPhone,
    cancelledJobs: lateCancellations,
    lateCancellations,
    completionRate,
    reliabilityScore: completionRate,
    reviews: employerReviews,
  });
});
