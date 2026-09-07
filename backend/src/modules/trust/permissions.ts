import { ApiError } from "../../middleware/errors";
export async function assertUnblocked(db: D1Database, a: string, b: string) {
  const active = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM users WHERE id IN (?,?) AND suspended=0",
    )
    .bind(a, b)
    .first<{ count: number }>();
  if (active?.count !== 2)
    throw new ApiError(
      "INTERACTION_UNAVAILABLE",
      403,
      "This interaction is unavailable.",
    );
  const blocked = await db
    .prepare(
      "SELECT id FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?) LIMIT 1",
    )
    .bind(a, b, b, a)
    .first();
  if (blocked)
    throw new ApiError(
      "INTERACTION_UNAVAILABLE",
      403,
      "This interaction is unavailable.",
    );
}
