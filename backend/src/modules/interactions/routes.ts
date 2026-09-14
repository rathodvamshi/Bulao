import { Hono } from "hono";
import { z } from "zod";
import { transition, type State, formatDirectPhone } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";
import { interactionDetail } from "./detail";
import { createNotification } from "../notifications/service";

type Interaction = {
  id: string;
  job_id: string | null;
  service_id: string | null;
  owner_id: string;
  worker_id: string;
  status: State;
  owner_confirmed_at: number | null;
  worker_confirmed_at: number | null;
  kind: string;
};
export const interactions = new Hono<AppEnv>();
interactions.use("*", requireAuth);

interactions.get("/", async (c) => {
  const uid = c.get("userId");
  const kind = c.req.query("kind") || "job";
  const role = c.req.query("role"); // "seeker" | "provider" | undefined
  const statusFilter = c.req.query("status"); // optional status filter

  let userCondition = "(i.owner_id = ? OR i.worker_id = ?)";
  const params: any[] = [];
  if (role === "seeker") {
    userCondition = "i.worker_id = ?";
    params.push(uid);
  } else if (role === "provider") {
    userCondition = "i.owner_id = ?";
    params.push(uid);
  } else {
    params.push(uid, uid);
  }

  let sql = `
    SELECT 
      i.id,
      i.kind,
      i.job_id AS jobId,
      i.service_id AS serviceId,
      i.status,
      i.owner_id AS ownerId,
      i.worker_id AS workerId,
      i.created_at AS createdAt,
      i.accepted_at AS acceptedAt,
      i.rejected_at AS rejectedAt,
      i.cancelled_at AS cancelledAt,
      i.cancelled_by AS cancelledBy,
      i.cancellation_reason AS cancellationReason,
      COALESCE(NULLIF(j.title, ''), r.name, c.name, 'Work Opportunity') AS title,
      COALESCE(r.name, 'Worker') AS roleName,
      COALESCE(c.name, 'General') AS categoryName,
      COALESCE(j.pay_paise, 0) AS payPaise,
      COALESCE(j.pay_unit, 'day') AS payUnit,
      COALESCE(j.area, '') AS area,
      j.starts_at AS startsAt,
      u.id AS otherId,
      u.name AS otherName,
      CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') THEN u.phone ELSE NULL END AS otherPhone,
      u.photo_url AS otherPhotoUrl,
      EXISTS(SELECT 1 FROM reviews WHERE interaction_id=i.id AND author_id=?) AS reviewed
    FROM interactions i
    LEFT JOIN jobs j ON j.id = i.job_id
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN service_profiles s ON s.id = i.service_id
    LEFT JOIN categories c ON c.id = s.category_id
    JOIN users u ON u.id = CASE WHEN i.owner_id = ? THEN i.worker_id ELSE i.owner_id END
    WHERE ${userCondition} AND i.kind = ?
  `;

  params.unshift(uid, uid);
  params.push(kind);

  if (statusFilter) {
    sql += " AND i.status = ?";
    params.push(statusFilter);
  }

  sql += " ORDER BY i.created_at DESC LIMIT 50";

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  const results = (rows.results || []).map((row: any) => ({
    ...row,
    otherPhone: row.otherPhone ? formatDirectPhone(row.otherPhone) : null,
  }));
  return ok(c, results);
});

interactions.get("/:id", interactionDetail);
interactions.post("/:id/action", async (c) => {
  const { action, reason } = z
    .object({
      action: z.enum([
        "accept",
        "reject",
        "withdraw",
        "start",
        "confirm",
        "cancel",
      ]),
      reason: z.string().trim().min(3).max(500).optional(),
    })
    .parse(await c.req.json());

  if (action === "cancel" && (!reason || reason.trim().length < 3)) {
    throw new ApiError(
      "REASON_REQUIRED",
      400,
      "Please provide a reason for cancellation.",
    );
  }

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

  // Fetch job or service title for notification
  let title = "Job Opportunity";
  if (row.job_id) {
    const jobRow = await c.env.DB.prepare("SELECT title FROM jobs WHERE id=?")
      .bind(row.job_id)
      .first<{ title: string }>();
    if (jobRow?.title) title = jobRow.title;
  }

  let result;
  const nowTs = now();
  if (action === "confirm") {
    const own = side === "owner" ? "owner_confirmed_at" : "worker_confirmed_at",
      other = side === "owner" ? "worker_confirmed_at" : "owner_confirmed_at";
    result = await c.env.DB.prepare(
      `UPDATE interactions SET ${own}=?,status=CASE WHEN ${other} IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END WHERE id=? AND status='IN_PROGRESS' AND ${own} IS NULL RETURNING id,status`,
    )
      .bind(nowTs, row.id)
      .first();
  } else if (action === "cancel") {
    result = await c.env.DB.prepare(
      "UPDATE interactions SET status=?, cancelled_by=?, cancellation_reason=?, cancelled_at=? WHERE id=? AND status=? RETURNING id,status",
    )
      .bind(next, uid, reason || "", nowTs, row.id, row.status)
      .first();
  } else if (action === "accept") {
    result = await c.env.DB.prepare(
      "UPDATE interactions SET status=?, accepted_at=? WHERE id=? AND status=? RETURNING id,status",
    )
      .bind(next, nowTs, row.id, row.status)
      .first();
  } else if (action === "reject") {
    result = await c.env.DB.prepare(
      "UPDATE interactions SET status=?, rejected_at=? WHERE id=? AND status=? RETURNING id,status",
    )
      .bind(next, nowTs, row.id, row.status)
      .first();
  } else {
    result = await c.env.DB.prepare(
      "UPDATE interactions SET status=? WHERE id=? AND status=? RETURNING id,status",
    )
      .bind(next, row.id, row.status)
      .first();
  }

  if (!result)
    throw new ApiError(
      "STATE_CHANGED",
      409,
      "This action was already handled. Refresh to see the latest status.",
    );

  // Send event notifications
  if (next === "ACCEPTED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      type: "APPLICATION_ACCEPTED",
      title: "Application Accepted!",
      message: `Your application for "${title}" was accepted! You can now view the contact details.`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  } else if (next === "REJECTED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      type: "APPLICATION_REJECTED",
      title: "Application Update",
      message: `Your application for "${title}" was rejected by the provider.`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  } else if (next === "CANCELLED_BY_SEEKER") {
    await createNotification(c.env.DB, {
      userId: row.owner_id,
      type: "APPLICATION_CANCELLED_BY_SEEKER",
      title: "Job Cancelled by Seeker",
      message: `The seeker cancelled the job "${title}". Reason: ${reason}`,
      data: { interactionId: row.id, jobId: row.job_id, reason },
    });
  } else if (next === "CANCELLED_BY_PROVIDER") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      type: "APPLICATION_CANCELLED_BY_PROVIDER",
      title: "Job Cancelled by Provider",
      message: `The provider cancelled the job "${title}". Reason: ${reason}`,
      data: { interactionId: row.id, jobId: row.job_id, reason },
    });
  } else if ((result as any)?.status === "COMPLETED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      type: "JOB_COMPLETED",
      title: "Job Completed!",
      message: `"${title}" was marked completed. Please rate your experience!`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
    await createNotification(c.env.DB, {
      userId: row.owner_id,
      type: "JOB_COMPLETED",
      title: "Job Completed!",
      message: `"${title}" was marked completed. Please rate your experience!`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  }

  return ok(c, result);
});
