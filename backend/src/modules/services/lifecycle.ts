import { ApiError } from "../../middleware/errors";

export async function archiveService(db: D1Database, id: string, owner: string) {
  const result = await db.prepare(`UPDATE service_profiles SET archived_at=unixepoch(), updated_at=unixepoch(), available=0
    WHERE id=? AND user_id=? AND archived_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM interactions WHERE service_id=? AND status IN ('PENDING','ACCEPTED','IN_PROGRESS'))
    RETURNING id`).bind(id, owner, id).first();
  if (!result) throw new ApiError("SERVICE_HAS_ACTIVE_REQUESTS", 409, "Resolve active requests before deleting this service.");
}
