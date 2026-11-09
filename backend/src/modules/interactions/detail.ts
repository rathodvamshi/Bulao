import { assertUnblocked } from "../trust/permissions";
import type { Context } from "hono";
import { formatDirectPhone, distanceKm } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";

export async function interactionDetail(c: Context<AppEnv>) {
  const row = await c.env.DB.prepare(
    `SELECT
       i.*,
       NULL AS owner_payment_confirmed_at,
       NULL AS worker_payment_confirmed_at,
       s.phone_visible,
       s.archived_at,
       s.latitude AS service_latitude,
       s.longitude AS service_longitude,
       u.suspended AS owner_suspended,
       v.suspended AS worker_suspended,
       u.photo_url AS owner_photo_url,
       v.photo_url AS worker_photo_url,
       u.phone_verified AS owner_phone_verified,
       v.phone_verified AS worker_phone_verified,
       u.created_at AS owner_created_at,
       v.created_at AS worker_created_at,
       CASE WHEN i.kind = 'service' THEN COALESCE(NULLIF(s.title, ''), cat.name, 'Service Request') ELSE COALESCE(NULLIF(j.title, ''), r.name, 'Job Opportunity') END AS title,
       j.area AS job_area,
       j.details AS job_details,
       j.address AS job_address,
       j.pay_paise AS job_pay_paise,
       j.pay_unit AS job_pay_unit,
       j.duration AS job_duration,
       j.hours AS job_hours,
       job_cat.name AS job_category_name,
       j.latitude AS job_latitude,
       j.longitude AS job_longitude,
       j.starts_at AS job_starts_at,
       u.name AS owner_name,
       v.name AS worker_name,
       u.phone AS owner_phone,
       v.phone AS worker_phone,
       EXISTS(SELECT 1 FROM reviews review WHERE review.interaction_id=i.id AND review.author_id=?) AS reviewed,
       (SELECT review.stars FROM reviews review WHERE review.interaction_id=i.id AND review.author_id=? LIMIT 1) AS my_review_stars,
       (SELECT review.body FROM reviews review WHERE review.interaction_id=i.id AND review.author_id=? LIMIT 1) AS my_review_body
     FROM interactions i
     LEFT JOIN jobs j ON j.id = i.job_id
     LEFT JOIN roles r ON r.id = j.role_id
     LEFT JOIN service_profiles s ON s.id = i.service_id
     LEFT JOIN categories cat ON cat.id = s.category_id
     LEFT JOIN categories job_cat ON job_cat.id = j.category_id
     JOIN users u ON u.id = i.owner_id
     JOIN users v ON v.id = i.worker_id
     WHERE i.id = ? AND (i.owner_id = ? OR i.worker_id = ?)`
  )
    .bind(c.get("userId"), c.get("userId"), c.get("userId"), c.req.param("id"), c.get("userId"), c.get("userId"))
    .first<any>();

  if (!row)
    throw new ApiError("NOT_FOUND", 404, "This connection could not be found.");

  // Optionally load offline payment confirmation if table exists
  try {
    const payment = await c.env.DB.prepare(
      "SELECT provider_confirmed_at, customer_confirmed_at FROM service_offline_payments WHERE interaction_id = ?"
    )
      .bind(row.id)
      .first<any>();
    if (payment) {
      row.owner_payment_confirmed_at = payment.provider_confirmed_at;
      row.worker_payment_confirmed_at = payment.customer_confirmed_at;
    }
  } catch {
    // service_offline_payments table not yet created
  }

  await assertUnblocked(c.env.DB, row.owner_id, row.worker_id);
  const accepted = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(row.status);
  const owner = c.get("userId") === row.owner_id;
  const otherId = owner ? row.worker_id : row.owner_id;
  const receivedReview = await c.env.DB.prepare(
    `SELECT r.id, r.stars, r.body, r.created_at AS createdAt,
            u.name AS authorName, u.photo_url AS authorPhotoUrl
       FROM reviews r
       JOIN users u ON u.id = r.author_id
      WHERE r.interaction_id = ? AND r.target_id = ? AND r.author_id = ?
      LIMIT 1`,
  )
    .bind(row.id, c.get("userId"), otherId)
    .first<any>();
  const isOnlineJob =
    row.kind === "job" &&
    (String(row.job_area || "").trim().toLowerCase() === "online" ||
      /work mode\s*:\s*online/i.test(String(row.job_details || "")));

  // Calculate distance between service/job origin and interaction destination
  const originLat = isOnlineJob ? null : row.service_latitude ?? row.job_latitude;
  const originLng = isOnlineJob ? null : row.service_longitude ?? row.job_longitude;
  const destLat = isOnlineJob ? null : row.latitude ?? row.job_latitude;
  const destLng = isOnlineJob ? null : row.longitude ?? row.job_longitude;
  let distKm: number | null = null;
  if (
    originLat != null &&
    originLng != null &&
    destLat != null &&
    destLng != null &&
    Number.isFinite(Number(originLat)) &&
    Number.isFinite(Number(originLng)) &&
    Number.isFinite(Number(destLat)) &&
    Number.isFinite(Number(destLng))
  ) {
    try {
      distKm =
        Math.round(
          distanceKm(
            { latitude: Number(originLat), longitude: Number(originLng) },
            { latitude: Number(destLat), longitude: Number(destLng) }
          ) * 10
        ) / 10;
    } catch {
      distKm = null;
    }
  }

  // Fetch trust statistics & ratings for the other person
  const statsPromise = c.env.DB.prepare(
    `SELECT
       (SELECT ROUND(AVG(stars), 1) FROM reviews WHERE target_id = ?) AS rating,
       (SELECT COUNT(*) FROM reviews WHERE target_id = ?) AS totalReviews,
       (SELECT COUNT(*) FROM interactions WHERE status = 'COMPLETED' AND (owner_id = ? OR worker_id = ?)) AS completed,
       (SELECT COUNT(*) FROM interactions WHERE cancelled_by = ? AND accepted_at IS NOT NULL) AS lateCancellations`
  )
    .bind(otherId, otherId, otherId, otherId, otherId)
    .first<any>();

  const reviewsPromise = c.env.DB.prepare(
    `SELECT
       r.id,
       r.stars,
       r.body,
       r.created_at AS createdAt,
       u.name AS authorName,
       u.photo_url AS authorPhotoUrl,
       COALESCE(roles.name, cats.name, 'Verified Engagement') AS jobTitle
     FROM reviews r
     JOIN users u ON u.id = r.author_id
     LEFT JOIN interactions i ON i.id = r.interaction_id
     LEFT JOIN jobs j ON j.id = i.job_id
     LEFT JOIN roles roles ON roles.id = j.role_id
     LEFT JOIN service_profiles sp ON sp.id = i.service_id
     LEFT JOIN categories cats ON cats.id = sp.category_id
     WHERE r.target_id = ?
     ORDER BY r.created_at DESC
     LIMIT 3`
  )
    .bind(otherId)
    .all();

  const [stats, reviews] = await Promise.all([statsPromise, reviewsPromise]);

  const completedCount = Number(stats?.completed || 0);
  const lateCancels = Number(stats?.lateCancellations || 0);
  const totalCommitted = completedCount + lateCancels;
  const completionRate =
    totalCommitted > 0 ? Math.round((completedCount / totalCommitted) * 100) : null;

  return ok(c, {
    id: row.id,
    kind: row.kind,
    isOwner: owner,
    serviceId: row.service_id ?? null,
    jobId: row.job_id ?? null,
    title: row.title,
    status: row.status,
    details: row.details,
    area: row.area ?? row.job_area,
    jobOverview: row.kind === "job" ? {
      title: row.title,
      categoryName: row.job_category_name ?? "Work opportunity",
      area: row.area ?? row.job_area,
      address: row.job_address ?? null,
      details: row.job_details ?? row.details,
      payPaise: row.job_pay_paise ?? null,
      payUnit: row.job_pay_unit ?? null,
      duration: row.job_duration ?? null,
      hours: row.job_hours ?? null,
      startsAt: row.scheduled_at ?? row.job_starts_at,
    } : null,
    receivedReview: receivedReview ? {
      id: receivedReview.id,
      stars: Number(receivedReview.stars),
      body: receivedReview.body ?? "",
      createdAt: receivedReview.createdAt,
      authorName: receivedReview.authorName,
      authorPhotoUrl: receivedReview.authorPhotoUrl ?? null,
    } : null,
    scheduledAt: row.scheduled_at ?? row.job_starts_at,
    otherName: owner ? row.worker_name : row.owner_name,
    otherId,
    otherPhotoUrl: owner ? row.worker_photo_url : row.owner_photo_url,
    otherPhoneVerified: Boolean(owner ? row.worker_phone_verified : row.owner_phone_verified),
    otherCreatedAt: owner ? row.worker_created_at : row.owner_created_at,
    otherRating: stats?.rating != null ? Number(stats.rating) : null,
    otherTotalReviews: Number(stats?.totalReviews || 0),
    otherCompletedCount: completedCount,
    otherCompletionRate: completionRate,
    distanceKm: distKm,
    recentReviews: reviews?.results || [],
    reviewed: Boolean(row.reviewed),
    myReview: row.my_review_stars == null ? null : {
      stars: Number(row.my_review_stars),
      body: row.my_review_body ?? "",
    },
    ownerConfirmedAt: row.owner_confirmed_at ?? null,
    workerConfirmedAt: row.worker_confirmed_at ?? null,
    completionRejectedAt: row.completion_rejected_at ?? null,
    completionRejectedBy: row.completion_rejected_by ?? null,
    completionRejectionReason: row.completion_rejection_reason ?? null,
    ownerPaymentConfirmedAt: row.owner_payment_confirmed_at ?? null,
    workerPaymentConfirmedAt: row.worker_payment_confirmed_at ?? null,
    phone:
      accepted &&
      !row.owner_suspended &&
      !row.worker_suspended
        ? formatDirectPhone(owner ? row.worker_phone : row.owner_phone)
        : null,
    location: accepted && !isOnlineJob
      ? {
          latitude: row.latitude ?? row.job_latitude,
          longitude: row.longitude ?? row.job_longitude,
        }
      : null,
    cancelledBy: row.cancelled_by,
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    createdAt: row.created_at,
  });
}
