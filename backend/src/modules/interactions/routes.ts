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
      CASE WHEN i.kind='service' THEN s.title ELSE COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity') END AS title,
      COALESCE(r.name, 'Worker') AS roleName,
      COALESCE(c.name, 'General') AS categoryName,
      CASE WHEN i.kind='service' THEN s.base_price_paise ELSE j.pay_paise END AS payPaise,
      CASE WHEN i.kind='service' THEN s.pricing_model ELSE j.pay_unit END AS payUnit,
      COALESCE(i.area,j.area) AS area,
      j.starts_at AS startsAt,
      u.id AS otherId,
      u.name AS otherName,
      CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') AND u.suspended=0 AND (i.kind='job' OR s.archived_at IS NULL) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=i.owner_id AND b.target_id=i.worker_id) OR (b.user_id=i.worker_id AND b.target_id=i.owner_id)) THEN u.phone ELSE NULL END AS otherPhone,
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
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawAction = String(body.action || body.next || body.status || "").trim().toLowerCase();
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;

  const actionMap: Record<string, "accept" | "reject" | "withdraw" | "start" | "confirm" | "cancel" | "delete"> = {
    accept: "accept",
    reject: "reject",
    withdraw: "withdraw",
    start: "start",
    confirm: "confirm",
    cancel: "cancel",
    close: "cancel",
    delete: "delete",
    remove: "delete",
  };

  const action = actionMap[rawAction];
  if (!action) {
    throw new ApiError("INVALID_ACTION", 400, "Please check your request and try again.");
  }

  const row = await c.env.DB.prepare("SELECT * FROM interactions WHERE id=?")
    .bind(c.req.param("id"))
    .first<Interaction>();
  if (!row) throw new ApiError("NOT_FOUND", 404, "This request is no longer available.");
  const uid = c.get("userId");
  if (uid !== row.owner_id && uid !== row.worker_id)
    throw new ApiError("UNAUTHORIZED", 403, "You do not have permission for this action.");

  if (action === "delete" && row.kind === "service") throw new ApiError("HISTORY_RETAINED", 409, "Cancel an active request; service history is retained.");
  if (row.kind === "service" && row.status === "REJECTED") throw new ApiError("INVALID_TRANSITION", 409, "This request was rejected. Create a new request.");
  if (row.kind === "service" && ["accept", "start"].includes(action)) {
    await assertUnblocked(c.env.DB, row.owner_id, row.worker_id);
    const active = await c.env.DB.prepare("SELECT s.id FROM service_profiles s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.available=1 AND s.archived_at IS NULL AND u.suspended=0").bind(row.service_id).first();
    if (!active) throw new ApiError("SERVICE_UNAVAILABLE", 409, "The service is unavailable.");
  }
  if (action === "delete") {
    await c.env.DB.prepare("DELETE FROM interactions WHERE id = ?").bind(row.id).run();
    return ok(c, { id: row.id, deleted: true, status: "DELETED" });
  }
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

  // Service notifications are committed atomically by database triggers.
  if (row.kind === "service") return ok(c, result);

  // Send event notifications
  if (next === "ACCEPTED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      recipientRole: "seeker",
      type: "APPLICATION_ACCEPTED",
      title: "Application Accepted!",
      message: `Your application for "${title}" was accepted! You can now view the contact details.`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  } else if (next === "REJECTED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      recipientRole: "seeker",
      type: "APPLICATION_REJECTED",
      title: "Application Update",
      message: `Your application for "${title}" was rejected by the provider.`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  } else if (next === "CANCELLED_BY_SEEKER") {
    await createNotification(c.env.DB, {
      userId: row.owner_id,
      recipientRole: "provider",
      type: "APPLICATION_CANCELLED_BY_SEEKER",
      title: "Job Cancelled by Seeker",
      message: `The seeker cancelled the job "${title}". Reason: ${reason}`,
      data: { interactionId: row.id, jobId: row.job_id, reason },
    });
  } else if (next === "CANCELLED_BY_PROVIDER") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      recipientRole: "seeker",
      type: "APPLICATION_CANCELLED_BY_PROVIDER",
      title: "Job Cancelled by Provider",
      message: `The provider cancelled the job "${title}". Reason: ${reason}`,
      data: { interactionId: row.id, jobId: row.job_id, reason },
    });
  } else if ((result as any)?.status === "COMPLETED") {
    await createNotification(c.env.DB, {
      userId: row.worker_id,
      recipientRole: "seeker",
      type: "JOB_COMPLETED",
      title: "Job Completed!",
      message: `"${title}" was marked completed. Please rate your experience!`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
    await createNotification(c.env.DB, {
      userId: row.owner_id,
      recipientRole: "provider",
      type: "JOB_COMPLETED",
      title: "Job Completed!",
      message: `"${title}" was marked completed. Please rate your experience!`,
      data: { interactionId: row.id, jobId: row.job_id },
    });
  }

  return ok(c, result);
});
