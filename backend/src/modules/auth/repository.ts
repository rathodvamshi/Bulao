import type { AuthEvent } from "./audit";

// D1-only boundary. Database-free tests replace these functions, never a SQL engine.
export async function createUserSession(db: D1Database, phone: string, tokenHash: string, at: number, expiresAt: number) {
  const results = await db.batch([
    db.prepare("INSERT INTO users(id,phone,created_at,updated_at,last_login_at,phone_verified) VALUES(?,?,?,?,?,1) ON CONFLICT(phone) DO UPDATE SET phone_verified=1,updated_at=excluded.updated_at,last_login_at=excluded.last_login_at WHERE users.suspended=0")
      .bind(crypto.randomUUID(), phone, at, at, at),
    db.prepare("INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,id,?,? FROM users WHERE phone=? AND suspended=0")
      .bind(tokenHash, at, expiresAt, phone),
    db.prepare("SELECT id,name,area FROM users WHERE phone=? AND suspended=0").bind(phone),
  ]);
  return results[2]?.results[0] as { id: string; name: string; area: string } | undefined;
}

export function findActiveSession(db: D1Database, tokenHash: string, at: number) {
  return db.prepare("SELECT u.id,u.name,u.area,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.suspended=0 AND u.phone_verified=1")
    .bind(tokenHash, at).first<{ id: string; name: string; area: string; expiresAt: number }>();
}

export async function revokeSession(db: D1Database, tokenHash: string, at: number) {
  await db.prepare("UPDATE sessions SET revoked_at=? WHERE hash=? AND revoked_at IS NULL").bind(at, tokenHash).run();
}

export async function writeAuthEvent(db: D1Database, e: AuthEvent) {
  await db.prepare("INSERT INTO auth_events(id,request_id,user_id,phone_hash,ip_hash,event_type,created_at,success,code) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(e.id, e.requestId, e.userId, e.phoneHash, e.ipHash, e.eventType, e.createdAt, e.success ? 1 : 0, e.code).run();
}
