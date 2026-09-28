import { assertUnblocked } from "../trust/permissions";
import type { Context } from "hono";
import { formatDirectPhone } from "@bulao/domain";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
export async function interactionDetail(c: Context<AppEnv>) {
  const row = await c.env.DB.prepare(
    "SELECT i.*,s.phone_visible,s.archived_at,u.suspended AS owner_suspended,v.suspended AS worker_suspended,CASE WHEN i.kind='service' THEN s.title ELSE COALESCE(j.title,r.name) END AS title,j.area AS job_area,j.latitude AS job_latitude,j.longitude AS job_longitude,j.starts_at AS job_starts_at,u.name AS owner_name,v.name AS worker_name,u.phone AS owner_phone,v.phone AS worker_phone FROM interactions i LEFT JOIN jobs j ON j.id=i.job_id LEFT JOIN roles r ON r.id=j.role_id LEFT JOIN service_profiles s ON s.id=i.service_id LEFT JOIN categories cat ON cat.id=s.category_id JOIN users u ON u.id=i.owner_id JOIN users v ON v.id=i.worker_id WHERE i.id=? AND (i.owner_id=? OR i.worker_id=?)",
  )
    .bind(c.req.param("id"), c.get("userId"), c.get("userId"))
    .first<{
      phone_visible: number;
      archived_at: number | null;
      owner_suspended: number;
      worker_suspended: number;
      id: string;
      kind: string;
      status: string;
      title: string;
      owner_id: string;
      worker_id: string;
      owner_name: string;
      worker_name: string;
      owner_phone: string;
      worker_phone: string;
      area: string;
      job_area: string;
      latitude: number;
      longitude: number;
      job_latitude: number;
      job_longitude: number;
      scheduled_at: number;
      job_starts_at: number;
      details: string;
    }>();
  if (!row)
    throw new ApiError("NOT_FOUND", 404, "This connection could not be found.");
  await assertUnblocked(c.env.DB, row.owner_id, row.worker_id);
  const accepted = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(row.status);
  const owner = c.get("userId") === row.owner_id;
  return ok(c, {
    id: row.id,
    jobId: (row as any).job_id,
    title: row.title,
    status: row.status,
    details: row.details,
    area: row.area ?? row.job_area,
    scheduledAt: row.scheduled_at ?? row.job_starts_at,
    otherName: owner ? row.worker_name : row.owner_name,
    otherId: owner ? row.worker_id : row.owner_id,
    phone: accepted && !row.owner_suspended && !row.worker_suspended && (row.kind !== "service" || row.archived_at === null) ? formatDirectPhone(owner ? row.worker_phone : row.owner_phone) : null,
    location: accepted
      ? {
          latitude: row.latitude ?? row.job_latitude,
          longitude: row.longitude ?? row.job_longitude,
        }
      : null,
    cancelledBy: (row as any).cancelled_by,
    cancellationReason: (row as any).cancellation_reason,
    cancelledAt: (row as any).cancelled_at,
    acceptedAt: (row as any).accepted_at,
    rejectedAt: (row as any).rejected_at,
    createdAt: (row as any).created_at,
  });
}
