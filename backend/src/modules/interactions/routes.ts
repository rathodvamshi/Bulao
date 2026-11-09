import { dispatchPendingPushes } from "../notifications/push";
import { Hono } from "hono";
import { z } from "zod";
import { transition, type State, formatDirectPhone, distanceKm } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";
import { interactionDetail } from "./detail";
import { dedupeLatestJobApplications } from "./normalize";

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

interactions.get("/history", async (c) => {
  const uid = c.get("userId");
  const role = z.enum(["seeker", "provider"]).catch("seeker").parse(c.req.query("role") || "seeker");
  const limit = Math.min(Math.max(Number(c.req.query("limit") || 15), 1), 50);
  const offset = Math.max(Number(c.req.query("offset") || 0), 0);

  const userCondition = role === "seeker" ? "i.worker_id = ?" : "i.owner_id = ?";
  const rows = await c.env.DB.prepare(`
    SELECT
      i.id,
      i.kind,
      i.job_id AS jobId,
      i.service_id AS serviceId,
      i.status,
      i.owner_id AS ownerId,
      i.worker_id AS workerId,
      i.owner_confirmed_at AS ownerConfirmedAt,
      i.worker_confirmed_at AS workerConfirmedAt,
      i.completion_rejected_at AS completionRejectedAt,
      i.completion_rejected_by AS completionRejectedBy,
      i.completion_rejection_reason AS completionRejectionReason,
      MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) AS completedAt,
      i.created_at AS createdAt,
      i.accepted_at AS acceptedAt,
      COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity') AS title,
      COALESCE(NULLIF(i.role_name_snapshot, ''), r.name, 'Worker') AS roleName,
      COALESCE(c.name, 'General') AS categoryName,
      COALESCE(i.pay_paise_snapshot, j.pay_paise) AS payPaise,
      COALESCE(i.pay_unit_snapshot, j.pay_unit) AS payUnit,
      COALESCE(i.area, j.area) AS area,
      j.starts_at AS startsAt,
      u.id AS otherId,
      u.name AS otherName,
      u.photo_url AS otherPhotoUrl,
      EXISTS(SELECT 1 FROM reviews WHERE interaction_id=i.id AND author_id=?) AS reviewed,
      (SELECT stars FROM reviews WHERE interaction_id=i.id AND author_id=?) AS myRating,
      (SELECT body FROM reviews WHERE interaction_id=i.id AND author_id=?) AS myFeedback,
      (SELECT stars FROM reviews WHERE interaction_id=i.id AND target_id=?) AS receivedRating,
      (SELECT body FROM reviews WHERE interaction_id=i.id AND target_id=?) AS receivedFeedback
    FROM interactions i
    LEFT JOIN jobs j ON j.id = i.job_id
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN categories c ON c.id = j.category_id
    JOIN users u ON u.id = CASE WHEN i.owner_id = ? THEN i.worker_id ELSE i.owner_id END
    WHERE ${userCondition} AND i.kind = 'job' AND i.status = 'COMPLETED'
      AND NOT EXISTS (SELECT 1 FROM user_hidden_interaction_history h WHERE h.user_id=? AND h.interaction_id=i.id)
    ORDER BY MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) DESC, i.id DESC
    LIMIT ? OFFSET ?
  `).bind(uid, uid, uid, uid, uid, uid, uid, uid, limit, offset).all();

  const totalRes = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM interactions i
    WHERE ${userCondition} AND i.kind = 'job' AND i.status = 'COMPLETED'
      AND NOT EXISTS (SELECT 1 FROM user_hidden_interaction_history h WHERE h.user_id=? AND h.interaction_id=i.id)
  `).bind(uid, uid).first<{ count: number }>();

  const total = Number(totalRes?.count || 0);
  const items = (rows.results || []).map((row: any) => ({
    ...row,
    otherPhone: null,
  }));

  return ok(c, {
    items,
    total,
    hasMore: offset + items.length < total,
    limit,
    offset,
  });
});

interactions.get("/", async (c) => {
  const uid = c.get("userId");
  const kind = c.req.query("kind") || "job";
  const role = c.req.query("role"); // "seeker" | "provider" | undefined
  const statusFilter = c.req.query("status"); // optional status filter
  const serviceId = c.req.query("serviceId");
  const jobId = c.req.query("jobId");
  const limit = Math.min(Math.max(Number(c.req.query("limit") || 50), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") || 0), 0);

  if (serviceId && role === "provider") {
    const sp = await c.env.DB.prepare(
      "SELECT user_id FROM service_profiles WHERE id = ? AND archived_at IS NULL",
    )
      .bind(serviceId)
      .first<{ user_id: string }>();
    if (!sp || sp.user_id !== uid) {
      throw new ApiError(
        "UNAUTHORIZED",
        403,
        "You do not have permission to view requests for this service.",
      );
    }
  }

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
      i.owner_confirmed_at AS ownerConfirmedAt,
      i.worker_confirmed_at AS workerConfirmedAt,
      i.completion_rejected_at AS completionRejectedAt,
      i.completion_rejected_by AS completionRejectedBy,
      i.completion_rejection_reason AS completionRejectionReason,
      MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) AS completedAt,
      i.created_at AS createdAt,
      i.accepted_at AS acceptedAt,
      i.rejected_at AS rejectedAt,
      i.cancelled_at AS cancelledAt,
      i.cancelled_by AS cancelledBy,
      i.cancellation_reason AS cancellationReason,
      i.details AS details,
      i.scheduled_at AS scheduledAt,
      CASE WHEN i.kind='service' THEN s.title ELSE COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity') END AS title,
      COALESCE(r.name, 'Worker') AS roleName,
      COALESCE(c.name, 'General') AS categoryName,
      CASE WHEN i.kind='service' THEN s.base_price_paise ELSE j.pay_paise END AS payPaise,
      CASE WHEN i.kind='service' THEN s.pricing_model ELSE j.pay_unit END AS payUnit,
      COALESCE(i.area,j.area) AS area,
      j.starts_at AS startsAt,
      u.id AS otherId,
      u.name AS otherName,
      CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') AND u.suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=i.owner_id AND b.target_id=i.worker_id) OR (b.user_id=i.worker_id AND b.target_id=i.owner_id)) THEN u.phone ELSE NULL END AS otherPhone,
      u.photo_url AS otherPhotoUrl,
      (SELECT ROUND(AVG(r.stars), 1) FROM reviews r WHERE r.target_id = u.id) AS otherRating,
      (SELECT COUNT(*) FROM reviews r WHERE r.target_id = u.id) AS otherTotalReviews,
      EXISTS(SELECT 1 FROM reviews WHERE interaction_id=i.id AND author_id=?) AS reviewed,
      (SELECT stars FROM reviews WHERE interaction_id=i.id AND author_id=?) AS myRating,
      (SELECT body FROM reviews WHERE interaction_id=i.id AND author_id=?) AS myFeedback,
      (SELECT stars FROM reviews WHERE interaction_id=i.id AND target_id=?) AS receivedRating,
      (SELECT body FROM reviews WHERE interaction_id=i.id AND target_id=?) AS receivedFeedback
    FROM interactions i
    LEFT JOIN jobs j ON j.id = i.job_id
    LEFT JOIN roles r ON r.id = j.role_id
    LEFT JOIN service_profiles s ON s.id = i.service_id
    LEFT JOIN categories c ON c.id = CASE WHEN i.kind='service' THEN s.category_id ELSE j.category_id END
    JOIN users u ON u.id = CASE WHEN i.owner_id = ? THEN i.worker_id ELSE i.owner_id END
    WHERE ${userCondition} AND i.kind = ?
      AND NOT EXISTS (SELECT 1 FROM user_hidden_interaction_history h WHERE h.user_id=? AND h.interaction_id=i.id)
      AND i.owner_id != i.worker_id
      AND (
        (i.kind = 'job' AND i.job_id IS NOT NULL AND j.id IS NOT NULL AND j.owner_id = i.owner_id
          AND (i.status = 'COMPLETED' OR i.accepted_at IS NOT NULL OR j.status != 'DELETED'))
        OR
        (i.kind = 'service' AND i.service_id IS NOT NULL AND s.id IS NOT NULL AND s.user_id = i.owner_id)
      )
  `;

  // Five review lookups and one participant join precede the user filter values.
  params.unshift(uid, uid, uid, uid, uid, uid);
  params.push(kind);
  params.push(uid);

  if (serviceId) {
    sql += " AND i.service_id = ?";
    params.push(serviceId);
  }
  if (jobId) {
    sql += " AND i.job_id = ?";
    params.push(jobId);
  }

  if (statusFilter === "history" || statusFilter === "COMPLETED") {
    sql += " AND i.status = 'COMPLETED'";
  } else if (statusFilter) {
    sql += " AND i.status = ?";
    params.push(statusFilter);
  }

  if (statusFilter === "history" || statusFilter === "COMPLETED") {
    sql += " ORDER BY MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) DESC, i.id DESC";
  } else {
    sql += " ORDER BY i.created_at DESC, i.id DESC";
  }

  sql += " LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  const results = dedupeLatestJobApplications((rows.results || []).map((row: any) => ({
    ...row,
    otherPhone: row.otherPhone ? formatDirectPhone(row.otherPhone) : null,
  })));
  return ok(c, results);
});

// Return every job completion or review that still needs this user's action.
// Keep this separate from the paginated activity feed so older skipped items
// cannot disappear behind newer activity.
interactions.get("/completion-pending", async (c) => {
  const role = z.enum(["seeker", "provider"]).parse(c.req.query("role"));
  const uid = c.get("userId");
  const userCondition = role === "seeker" ? "i.worker_id = ?" : "i.owner_id = ?";
  const needsConfirmation = role === "seeker"
    ? "i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NULL"
    : "i.worker_confirmed_at IS NOT NULL AND i.owner_confirmed_at IS NULL";

  const rows = await c.env.DB.prepare(`
    SELECT
      i.id,
      i.kind,
      i.job_id AS jobId,
      i.status,
      i.owner_id AS ownerId,
      i.worker_id AS workerId,
      i.owner_confirmed_at AS ownerConfirmedAt,
      i.worker_confirmed_at AS workerConfirmedAt,
      i.completion_rejected_at AS completionRejectedAt,
      i.completion_rejected_by AS completionRejectedBy,
      i.completion_rejection_reason AS completionRejectionReason,
      COALESCE(NULLIF(i.job_title_snapshot, ''), NULLIF(j.title, ''), r.name, 'Work Opportunity') AS title,
      COALESCE(i.area, j.area) AS area,
      COALESCE(i.pay_paise_snapshot, j.pay_paise) AS payPaise,
      COALESCE(i.pay_unit_snapshot, j.pay_unit) AS payUnit,
      j.starts_at AS startsAt,
      u.name AS otherName,
      0 AS reviewed
    FROM interactions i
    LEFT JOIN jobs j ON j.id = i.job_id
    LEFT JOIN roles r ON r.id = j.role_id
    JOIN users u ON u.id = CASE WHEN i.owner_id = ? THEN i.worker_id ELSE i.owner_id END
    WHERE ${userCondition}
      AND i.kind = 'job'
      AND i.completion_rejected_at IS NULL
      AND (
        (i.status = 'IN_PROGRESS' AND ${needsConfirmation})
        OR
        (i.status = 'COMPLETED' AND NOT EXISTS (
          SELECT 1 FROM reviews review
          WHERE review.interaction_id = i.id AND review.author_id = ?
        ))
      )
    ORDER BY CASE WHEN i.status = 'IN_PROGRESS' THEN 0 ELSE 1 END,
      MAX(COALESCE(i.worker_confirmed_at, i.created_at), COALESCE(i.owner_confirmed_at, i.created_at)) DESC,
      i.id DESC
  `).bind(uid, uid, uid).all();

  return ok(c, { interactions: rows.results || [] });
});

interactions.get("/:id", interactionDetail);
interactions.post("/:id/offline-payment", async (c) => {
  const input = z.object({ action: z.enum(["confirm", "undo"]) }).parse(await c.req.json());
  const row = await c.env.DB.prepare(
    "SELECT i.id,i.kind,i.status,i.owner_id,i.worker_id,p.provider_confirmed_at AS owner_payment_confirmed_at,p.customer_confirmed_at AS worker_payment_confirmed_at FROM interactions i LEFT JOIN service_offline_payments p ON p.interaction_id=i.id WHERE i.id=?",
  ).bind(c.req.param("id")).first<any>();
  if (!row) throw new ApiError("NOT_FOUND", 404, "This request could not be found.");

  const userId = c.get("userId");
  if (userId !== row.owner_id && userId !== row.worker_id)
    throw new ApiError("UNAUTHORIZED", 403, "You cannot update this request.");
  if (row.kind !== "service" || row.status !== "COMPLETED")
    throw new ApiError("PAYMENT_CONFIRMATION_UNAVAILABLE", 409, "Offline payment can be confirmed after both people confirm the service is complete.");

  const ownColumn = userId === row.owner_id ? "owner_payment_confirmed_at" : "worker_payment_confirmed_at";
  const otherColumn = userId === row.owner_id ? "worker_payment_confirmed_at" : "owner_payment_confirmed_at";
  const ownConfirmed = row[ownColumn] != null;
  const otherConfirmed = row[otherColumn] != null;
  if (input.action === "confirm" && ownConfirmed)
    throw new ApiError("PAYMENT_ALREADY_CONFIRMED", 409, "You have already confirmed this offline payment.");
  if (input.action === "undo" && (!ownConfirmed || otherConfirmed))
    throw new ApiError("PAYMENT_CONFIRMATION_LOCKED", 409, "This confirmation can only be changed before the other person confirms.");

  const nowTs = now();
  if (input.action === "confirm") {
    await c.env.DB.prepare(
      "INSERT INTO service_offline_payments(interaction_id,updated_at) VALUES(?,?) ON CONFLICT(interaction_id) DO NOTHING",
    ).bind(row.id, nowTs).run();
  }
  const ownPaymentColumn = userId === row.owner_id ? "provider_confirmed_at" : "customer_confirmed_at";
  const otherPaymentColumn = userId === row.owner_id ? "customer_confirmed_at" : "provider_confirmed_at";
  const updateConfirmation = (expectOtherConfirmed: boolean) =>
    c.env.DB.prepare(
      `UPDATE service_offline_payments SET ${ownPaymentColumn}=?,updated_at=? WHERE interaction_id=? AND ${ownPaymentColumn} IS ${input.action === "confirm" ? "NULL" : "NOT NULL"} AND ${otherPaymentColumn} IS ${expectOtherConfirmed ? "NOT NULL" : "NULL"} RETURNING provider_confirmed_at AS ownerPaymentConfirmedAt, customer_confirmed_at AS workerPaymentConfirmedAt`,
    ).bind(input.action === "confirm" ? nowTs : null, nowTs, row.id).first<any>();

  let result = await updateConfirmation(otherConfirmed);
  // If the other person's first confirmation landed between our read and write,
  // retry once with that latest state instead of forcing a needless user retry.
  if (!result && input.action === "confirm" && !otherConfirmed) {
    const latest = await c.env.DB.prepare(
      `SELECT ${ownPaymentColumn} AS ownConfirmed, ${otherPaymentColumn} AS otherConfirmed FROM service_offline_payments WHERE interaction_id=?`,
    ).bind(row.id).first<{ ownConfirmed: number | null; otherConfirmed: number | null }>();
    if (latest?.ownConfirmed != null)
      throw new ApiError("PAYMENT_ALREADY_CONFIRMED", 409, "You have already confirmed this offline payment.");
    if (latest?.otherConfirmed != null) result = await updateConfirmation(true);
  }
  if (!result) throw new ApiError("STATE_CHANGED", 409, "Payment status changed. Refresh and try again.");

  return ok(c, { ...result, confirmedByMe: input.action === "confirm" });
});
interactions.post("/:id/action", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawAction = String(body.action || body.next || body.status || "").trim().toLowerCase();
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;

  const actionMap: Record<string, "accept" | "reject" | "reject_completion" | "withdraw" | "start" | "confirm" | "cancel" | "delete"> = {
    accept: "accept",
    reject: "reject",
    reject_completion: "reject_completion",
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
    if (row.status === "COMPLETED") {
      if (row.kind !== "job") throw new ApiError("HISTORY_RETAINED", 409, "Only completed job history can be removed.");
      await c.env.DB.prepare(`INSERT INTO user_hidden_interaction_history(user_id, interaction_id)
        VALUES(?, ?) ON CONFLICT(user_id, interaction_id) DO NOTHING`).bind(uid, row.id).run();
      return ok(c, { id: row.id, deleted: true, status: "DELETED" });
    }
    if (row.kind === "job") {
      throw new ApiError("HISTORY_RETAINED", 409, "Job applications are retained in work history and cannot be deleted.");
    }
    if (!["CANCELLED", "CANCELLED_BY_SEEKER", "CANCELLED_BY_PROVIDER", "WITHDRAWN", "REJECTED"].includes(row.status)) {
      throw new ApiError("INVALID_STATE", 400, "Applications can only be deleted after they are cancelled or rejected.");
    }
    await c.env.DB.prepare("DELETE FROM interactions WHERE id = ?").bind(row.id).run();
    return ok(c, { id: row.id, deleted: true, status: "DELETED" });
  }
  const side = uid === row.owner_id ? "owner" : "worker";
  if (action === "reject_completion") {
    if (row.kind !== "job" || row.status !== "IN_PROGRESS")
      throw new ApiError("INVALID_TRANSITION", 409, "Only active job completion requests can be disputed.");
    const otherConfirmation = side === "owner" ? row.worker_confirmed_at : row.owner_confirmed_at;
    const ownConfirmation = side === "owner" ? row.owner_confirmed_at : row.worker_confirmed_at;
    if (otherConfirmation == null || ownConfirmation != null)
      throw new ApiError("INVALID_TRANSITION", 409, "There is no completion request for you to reject.");
    const safeReason = (reason || "Work is not complete yet.").slice(0, 500);
    const clearedRequest = side === "owner" ? "worker_confirmed_at" : "owner_confirmed_at";
    const rejected = await c.env.DB.prepare(
      `UPDATE interactions
       SET completion_rejected_at=?, completion_rejected_by=?, completion_rejection_reason=?, ${clearedRequest}=NULL
       WHERE id=? AND status='IN_PROGRESS' AND completion_rejected_at IS NULL AND ${ownConfirmation} IS NULL AND ${clearedRequest} IS NOT NULL
       RETURNING id,status,completion_rejected_at AS completionRejectedAt,completion_rejected_by AS completionRejectedBy`
    ).bind(now(), uid, safeReason, row.id).first();
    if (!rejected) throw new ApiError("STATE_CHANGED", 409, "This completion request was already handled. Refresh to see the latest status.");
    return ok(c, rejected);
  }
  if (action === "confirm") {
    const alreadyConfirmed = side === "owner" ? row.owner_confirmed_at : row.worker_confirmed_at;
    if (alreadyConfirmed != null) {
      return ok(c, { id: row.id, status: row.status, alreadyConfirmed: true });
    }
  }
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

  let result;
  const nowTs = now();
  if (action === "confirm") {
    const own = side === "owner" ? "owner_confirmed_at" : "worker_confirmed_at",
      other = side === "owner" ? "worker_confirmed_at" : "owner_confirmed_at";
    result = await c.env.DB.prepare(
      `UPDATE interactions SET ${own}=?,completion_rejected_at=NULL,completion_rejected_by=NULL,completion_rejection_reason=NULL,status=CASE WHEN ${other} IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END WHERE id=? AND status IN ('ACCEPTED','IN_PROGRESS') AND ${own} IS NULL RETURNING id,status`,
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
    try {
      result = await c.env.DB.prepare(
        "UPDATE interactions SET status=?, accepted_at=? WHERE id=? AND status=? RETURNING id,status",
      )
        .bind(next, nowTs, row.id, row.status)
        .first();
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      if (message.includes("JOB_CAPACITY")) throw new ApiError("JOB_CAPACITY", 409, "All required member spots have already been accepted.");
      if (message.includes("JOB_UNAVAILABLE")) throw new ApiError("JOB_UNAVAILABLE", 409, "This job is no longer accepting applications.");
      throw error;
    }
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

  // Job notifications are emitted by D1 triggers with the state transition,
  // so the inbox row and push outbox cannot get out of sync with the mutation.
  if (c.executionCtx && c.env.PUSH_DELIVERIES) {
    c.executionCtx.waitUntil(dispatchPendingPushes(c.env).catch(() => {}));
  }
  return ok(c, result);
});
