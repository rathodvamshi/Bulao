import type { AuthEvent } from "./audit";
import { ApiError } from "../../middleware/errors";

export interface RollingRateLimitRule {
  key: string;
  bucketSeconds: number;
  windowSeconds: number;
  maxCount: number;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  violatedKey?: string;
  retryAfter?: number;
}

export interface OtpChallengeRecord {
  id: string;
  phoneHash: string;
  purpose: string;
  otpHmac: string;
  otpEncrypted: string | null;
  status: string;
  resendCount: number;
  lastSentAt: number | null;
  cooldownUntil: number | null;
  idempotencyKey: string | null;
  expiresAt: number;
  attempts: number;
  used: number;
  createdAt: number | null;
}

// D1-only boundary. Database-free tests replace these functions, never a SQL engine.
export async function createUserSession(db: D1Database, phone: string, tokenHash: string, at: number, expiresAt: number) {
  const results = await db.batch([
    db.prepare("INSERT INTO users(id,phone,created_at,updated_at,last_login_at,phone_verified) VALUES(?,?,?,?,?,1) ON CONFLICT(phone) DO UPDATE SET phone_verified=1,updated_at=excluded.updated_at,last_login_at=excluded.last_login_at WHERE users.suspended=0")
      .bind(crypto.randomUUID(), phone, at, at, at),
    db.prepare("INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,id,?,? FROM users WHERE phone=? AND suspended=0")
      .bind(tokenHash, at, expiresAt, phone),
    db.prepare("SELECT id,name,area,phone FROM users WHERE phone=? AND suspended=0").bind(phone),
  ]);
  return results[2]?.results[0] as { id: string; name: string; area: string; phone?: string } | undefined;
}

export function findActiveSession(db: D1Database, tokenHash: string, at: number) {
  return db.prepare("SELECT u.id,u.name,u.area,u.phone,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.suspended=0 AND u.phone_verified=1")
    .bind(tokenHash, at).first<{ id: string; name: string; area: string; phone?: string; expiresAt: number }>();
}

export async function revokeSession(db: D1Database, tokenHash: string, at: number) {
  await db.prepare("UPDATE sessions SET revoked_at=? WHERE hash=? AND revoked_at IS NULL").bind(at, tokenHash).run();
}

export async function writeAuthEvent(db: D1Database, e: AuthEvent) {
  await db.prepare("INSERT INTO auth_events(id,request_id,user_id,phone_hash,ip_hash,event_type,created_at,success,code) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(e.id, e.requestId, e.userId, e.phoneHash, e.ipHash, e.eventType, e.createdAt, e.success ? 1 : 0, e.code).run();
}

export async function consumeRollingRateLimits(
  db: D1Database,
  rules: RollingRateLimitRule[],
  nowSec: number,
): Promise<RateLimitConsumeResult> {
  if (rules.length === 0) return { allowed: true };

  const prepared = rules.map((rule) => {
    const currentBucket = Math.floor(nowSec / rule.bucketSeconds);
    const bucketSpan = Math.max(1, Math.ceil(rule.windowSeconds / rule.bucketSeconds));
    const minBucket = currentBucket - bucketSpan + 1;
    const expiresAt = nowSec + rule.windowSeconds + rule.bucketSeconds;
    return {
      rule,
      currentBucket,
      minBucket,
      stmt: db
        .prepare(
          `INSERT INTO rate_limits (key, bucket, count, expires_at)
           SELECT ?, ?, 1, ?
           WHERE (SELECT COALESCE(SUM(count), 0) FROM rate_limits WHERE key = ? AND bucket >= ?) < ?
           ON CONFLICT(key, bucket) DO UPDATE SET
             count = rate_limits.count + 1,
             expires_at = excluded.expires_at
           WHERE (SELECT COALESCE(SUM(count), 0) FROM rate_limits WHERE key = ? AND bucket >= ?) < ?
           RETURNING count`,
        )
        .bind(
          rule.key,
          currentBucket,
          expiresAt,
          rule.key,
          minBucket,
          rule.maxCount,
          rule.key,
          minBucket,
          rule.maxCount,
        ),
    };
  });

  const batchResults = await db.batch(prepared.map((item) => item.stmt));
  const failedIndex = batchResults.findIndex((res) => !res.results || res.results.length === 0);
  if (failedIndex === -1) {
    return { allowed: true };
  }

  // Compensate any counters that incremented earlier in the same batch so rejected requests don't burn quota
  const rollbacks = prepared
    .filter((_, idx) => idx !== failedIndex && batchResults[idx]?.results && batchResults[idx]!.results.length > 0)
    .map((item) =>
      db
        .prepare("UPDATE rate_limits SET count = MAX(0, count - 1) WHERE key = ? AND bucket = ?")
        .bind(item.rule.key, item.currentBucket),
    );
  if (rollbacks.length > 0) {
    await db.batch(rollbacks);
  }

  const violated = prepared[failedIndex]!;
  const oldest = await db
    .prepare("SELECT MIN(bucket) AS oldestBucket FROM rate_limits WHERE key = ? AND bucket >= ? AND count > 0")
    .bind(violated.rule.key, violated.minBucket)
    .first<{ oldestBucket: number | null }>();

  const oldestBucket = oldest?.oldestBucket ?? violated.currentBucket;
  const resetAt = (oldestBucket * violated.rule.bucketSeconds) + violated.rule.windowSeconds;
  const retryAfter = Math.max(1, resetAt - nowSec);

  return {
    allowed: false,
    violatedKey: violated.rule.key,
    retryAfter,
  };
}

export async function upsertOtpDevice(
  db: D1Database,
  installationHash: string,
  nowSec: number,
  userId?: string | null,
) {
  await db
    .prepare(
      `INSERT INTO otp_devices (installation_hash, last_user_id, first_seen_at, last_seen_at, risk_score)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(installation_hash) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         last_user_id = COALESCE(excluded.last_user_id, otp_devices.last_user_id)`,
    )
    .bind(installationHash, userId ?? null, nowSec, nowSec)
    .run();
}

export function findActiveOtpChallenge(
  db: D1Database,
  phoneHash: string,
  purpose: string,
  nowSec: number,
) {
  return db
    .prepare(
      `SELECT id, phone_hash AS phoneHash, purpose, otp_hmac AS otpHmac, otp_encrypted AS otpEncrypted,
              status, resend_count AS resendCount, last_sent_at AS lastSentAt, cooldown_until AS cooldownUntil,
              idempotency_key AS idempotencyKey, expires_at AS expiresAt, attempts, used, created_at AS createdAt
       FROM otp_challenges
       WHERE phone_hash = ? AND purpose = ? AND status = 'PENDING' AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(phoneHash, purpose, nowSec)
    .first<OtpChallengeRecord>();
}

export function findOtpChallengeByIdempotency(
  db: D1Database,
  phoneHash: string,
  purpose: string,
  idempotencyKey: string,
  nowSec: number,
) {
  return db
    .prepare(
      `SELECT id, phone_hash AS phoneHash, purpose, otp_hmac AS otpHmac, otp_encrypted AS otpEncrypted,
              status, resend_count AS resendCount, last_sent_at AS lastSentAt, cooldown_until AS cooldownUntil,
              idempotency_key AS idempotencyKey, expires_at AS expiresAt, attempts, used, created_at AS createdAt
       FROM otp_challenges
       WHERE phone_hash = ? AND purpose = ? AND idempotency_key = ? AND status = 'PENDING' AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(phoneHash, purpose, idempotencyKey, nowSec)
    .first<OtpChallengeRecord>();
}

export async function createOtpChallenge(
  db: D1Database,
  input: {
    id: string;
    phoneHash: string;
    purpose: string;
    otpHmac: string;
    otpEncrypted: string;
    expiresAt: number;
    cooldownUntil: number;
    idempotencyKey?: string | null;
    provider: string;
    nowSec: number;
  },
) {
  await db.batch([
    db
      .prepare(
        "UPDATE otp_challenges SET status = 'EXPIRED', used = 1, otp_encrypted = NULL WHERE phone_hash = ? AND purpose = ? AND status = 'PENDING'",
      )
      .bind(input.phoneHash, input.purpose),
    db
      .prepare(
        `INSERT INTO otp_challenges (
           id, phone, phone_hash, purpose, otp_hmac, otp_encrypted, status,
           resend_count, last_sent_at, cooldown_until, idempotency_key,
           expires_at, attempts, used, provider, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, 0, 0, ?, ?)`,
      )
      .bind(
        input.id,
        input.phoneHash,
        input.phoneHash,
        input.purpose,
        input.otpHmac,
        input.otpEncrypted,
        input.nowSec,
        input.cooldownUntil,
        input.idempotencyKey ?? null,
        input.expiresAt,
        input.provider,
        input.nowSec,
      ),
  ]);
}

export function claimOtpResend(
  db: D1Database,
  challengeId: string,
  nextCooldownUntil: number,
  nowSec: number,
) {
  return db
    .prepare(
      `UPDATE otp_challenges
       SET resend_count = resend_count + 1,
           last_sent_at = ?,
           cooldown_until = ?
       WHERE id = ? AND status = 'PENDING' AND expires_at > ?
         AND (cooldown_until IS NULL OR cooldown_until <= ?)
       RETURNING resend_count AS resendCount, otp_encrypted AS otpEncrypted, expires_at AS expiresAt`,
    )
    .bind(nowSec, nextCooldownUntil, challengeId, nowSec, nowSec)
    .first<{ resendCount: number; otpEncrypted: string | null; expiresAt: number }>();
}

export function findOtpChallengeById(db: D1Database, challengeId: string) {
  return db
    .prepare(
      `SELECT id, phone_hash AS phoneHash, purpose, otp_hmac AS otpHmac, otp_encrypted AS otpEncrypted,
              status, resend_count AS resendCount, last_sent_at AS lastSentAt, cooldown_until AS cooldownUntil,
              idempotency_key AS idempotencyKey, expires_at AS expiresAt, attempts, used, created_at AS createdAt
       FROM otp_challenges
       WHERE id = ? LIMIT 1`,
    )
    .bind(challengeId)
    .first<OtpChallengeRecord>();
}

export function findLockedOtpChallenge(
  db: D1Database,
  phoneHash: string,
  purpose: string,
  nowSec: number,
) {
  return db
    .prepare(
      `SELECT id, cooldown_until AS cooldownUntil
       FROM otp_challenges
       WHERE phone_hash = ? AND purpose = ? AND status = 'LOCKED' AND cooldown_until > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(phoneHash, purpose, nowSec)
    .first<{ id: string; cooldownUntil: number }>();
}

export function recordFailedOtpAttempt(
  db: D1Database,
  challengeId: string,
  maxAttempts: number,
  lockedUntil: number,
) {
  return db
    .prepare(
      `UPDATE otp_challenges
       SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= ? THEN 'LOCKED' ELSE status END,
           cooldown_until = CASE WHEN attempts + 1 >= ? THEN ? ELSE cooldown_until END,
           otp_encrypted = CASE WHEN attempts + 1 >= ? THEN NULL ELSE otp_encrypted END
       WHERE id = ? AND status = 'PENDING'
       RETURNING attempts, status`,
    )
    .bind(maxAttempts, maxAttempts, lockedUntil, maxAttempts, challengeId)
    .first<{ attempts: number; status: string }>();
}

export function consumeOtpChallenge(
  db: D1Database,
  challengeId: string,
  phoneHash: string,
  purpose: string,
  nowSec: number,
  maxAttempts: number,
) {
  return db
    .prepare(
      `UPDATE otp_challenges
       SET status = 'CONSUMED', used = 1, consumed_at = ?, otp_encrypted = NULL
       WHERE id = ? AND phone_hash = ? AND purpose = ? AND status = 'PENDING' AND expires_at > ? AND attempts < ?
       RETURNING id`,
    )
    .bind(nowSec, challengeId, phoneHash, purpose, nowSec, maxAttempts)
    .first<{ id: string }>();
}

export async function markOtpChallengeFailed(db: D1Database, challengeId: string) {
  await db
    .prepare("UPDATE otp_challenges SET status = 'FAILED', used = 1, otp_encrypted = NULL WHERE id = ? AND status = 'PENDING'")
    .bind(challengeId)
    .run();
}

export async function recordOtpDelivery(
  db: D1Database,
  input: {
    id: string;
    challengeId: string;
    provider: string;
    providerMessageId?: string | null;
    status: string;
    errorCode?: string | null;
    attemptNumber: number;
    nowSec: number;
  },
) {
  await db
    .prepare(
      `INSERT INTO otp_deliveries (
         id, challenge_id, provider, provider_message_id, status, error_code, attempt_number, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.challengeId,
      input.provider,
      input.providerMessageId ?? null,
      input.status,
      input.errorCode ?? null,
      input.attemptNumber,
      input.nowSec,
      input.nowSec,
    )
    .run();
}

export async function updateOtpDeliveryByProviderId(
  db: D1Database,
  providerMessageId: string,
  status: string,
  errorCode: string | null,
  nowSec: number,
) {
  const result = await db
    .prepare(
      `UPDATE otp_deliveries
       SET status = ?, error_code = COALESCE(?, error_code), updated_at = ?
       WHERE provider_message_id = ?`,
    )
    .bind(status, errorCode, nowSec, providerMessageId)
    .run();
  return result.meta?.changes ?? 0;
}

export async function updateUserPhone(db: D1Database, userId: string, phone: string, nowSec: number) {
  const digits = phone.replace(/^\+91/, "");
  const existing = await db
    .prepare("SELECT id FROM users WHERE phone IN (?, ?, ?) AND id != ? LIMIT 1")
    .bind(phone, digits, `91${digits}`, userId)
    .first<{ id: string }>();
  if (existing) {
    throw new ApiError("PHONE_IN_USE", 400, "This mobile number is already linked to another Bulao account.");
  }
  await db
    .prepare("UPDATE users SET phone = ?, phone_verified = 1, updated_at = ? WHERE id = ?")
    .bind(phone, nowSec, userId)
    .run();
}

export async function cleanupExpiredOtpRecords(db: D1Database, nowSec: number) {
  await db.batch([
    db
      .prepare(
        "UPDATE otp_challenges SET status = 'EXPIRED', otp_encrypted = NULL WHERE status = 'PENDING' AND expires_at <= ?",
      )
      .bind(nowSec),
    db
      .prepare("DELETE FROM otp_challenges WHERE expires_at < ?")
      .bind(nowSec - 86400),
    db
      .prepare("DELETE FROM rate_limits WHERE expires_at IS NOT NULL AND expires_at < ?")
      .bind(nowSec),
  ]);
}
