import type { Env } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { otpProvider } from "../../providers/otp/provider";
import { AUTH_POLICY, progressiveResendCooldown, type OtpPurpose } from "./policy";
import { enforceOtpSendRateLimits, enforceOtpVerifyRateLimits } from "./rateLimiter";
import {
  claimOtpResend,
  consumeOtpChallenge,
  createOtpChallenge,
  findActiveOtpChallenge,
  findLockedOtpChallenge,
  findOtpChallengeById,
  findOtpChallengeByIdempotency,
  markOtpChallengeFailed,
  recordFailedOtpAttempt,
  recordOtpDelivery,
  updateOtpDeliveryByProviderId,
  upsertOtpDevice,
} from "./repository";
import {
  authFingerprint,
  computeOtpHmac,
  decryptOtpForResend,
  deriveOtpKeys,
  encryptOtpForResend,
  generateCryptographicOtp,
  now,
  verifyOtpHmac,
} from "./session";

export interface RequestOtpInput {
  phone: string;
  purpose: OtpPurpose;
  ip: string;
  installationId?: string;
  idempotencyKey?: string;
  requestId?: string;
  userId?: string | null;
  traceId?: string;
}

export interface RequestOtpResponse {
  requestId: string;
  expiresIn: number;
  resendAfter: number;
  otpLength: number;
  phoneHash: string;
  ipHash: string;
  deviceHash: string | null;
}

export interface VerifyOtpInput {
  phone: string;
  requestId: string;
  otp: string;
  purpose: OtpPurpose;
  ip: string;
  installationId?: string;
  userId?: string | null;
  traceId?: string;
}

export interface VerifyOtpResult {
  phoneHash: string;
  ipHash: string;
  deviceHash: string | null;
}

function getOtpKeyMaterial(env: Env): string {
  return env.OTP_ENCRYPTION_KEY || env.AUTH_HASH_KEY;
}

function normalizeWebhookStatus(rawStatus: unknown): "SENT" | "DELIVERED" | "FAILED" | null {
  if (typeof rawStatus !== "string") return null;
  const s = rawStatus.trim().toLowerCase();
  if (["delivered", "delivrd", "success"].includes(s)) return "DELIVERED";
  if (["sent", "submitted", "queued", "accepted"].includes(s)) return "SENT";
  if (["failed", "undelivered", "undeliv", "rejected", "expired", "error"].includes(s)) return "FAILED";
  return null;
}

export async function requestOtp(env: Env, input: RequestOtpInput): Promise<RequestOtpResponse> {
  const db = env.DB;
  const at = now();
  const [phoneHash, ipHash, deviceHash] = await Promise.all([
    authFingerprint(env.AUTH_HASH_KEY, `phone:${input.phone}`),
    authFingerprint(env.AUTH_HASH_KEY, `ip:${input.ip}`),
    input.installationId ? authFingerprint(env.AUTH_HASH_KEY, `device:${input.installationId}`) : Promise.resolve(null),
  ]);

  // 1. Check idempotency key first so client network retries don't burn rate limits or send duplicate SMS
  if (input.idempotencyKey) {
    const idempotent = await findOtpChallengeByIdempotency(db, phoneHash, input.purpose, input.idempotencyKey, at);
    if (idempotent) {
      const resendAfter = idempotent.cooldownUntil && idempotent.cooldownUntil > at
        ? idempotent.cooldownUntil - at
        : progressiveResendCooldown(idempotent.resendCount);
      return {
        requestId: idempotent.id,
        expiresIn: Math.max(0, idempotent.expiresAt - at),
        resendAfter,
        otpLength: AUTH_POLICY.otpDigits,
        phoneHash,
        ipHash,
        deviceHash,
      };
    }
  }

  // 2. Enforce 10-minute verification lockout if previous challenge hit max wrong attempts
  const locked = await findLockedOtpChallenge(db, phoneHash, input.purpose, at);
  if (locked) {
    throw new ApiError(
      "OTP_RATE_LIMITED",
      429,
      "Too many attempts. Please try again later.",
      Math.max(1, locked.cooldownUntil - at),
    );
  }

  // 3. Check existing active challenge before creating another or hitting provider
  const active = await findActiveOtpChallenge(db, phoneHash, input.purpose, at);
  if (active && active.cooldownUntil && at < active.cooldownUntil) {
    throw new ApiError(
      "OTP_RATE_LIMITED",
      429,
      "Too many attempts. Please try again later.",
      Math.max(1, active.cooldownUntil - at),
    );
  }

  // 4. Enforce atomic phone (15m/1h/24h), device (1h/24h), and IP (1h) rate limits
  await enforceOtpSendRateLimits(db, { phoneHash, ipHash, deviceHash, nowSec: at });

  if (deviceHash) {
    await upsertOtpDevice(db, deviceHash, at, input.userId);
  }

  const [{ hmacKey, aesKey }, provider] = await Promise.all([
    deriveOtpKeys(getOtpKeyMaterial(env)),
    Promise.resolve(otpProvider(env, input.traceId)),
  ]);

  if (!provider.sendCustomOtp) {
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  }

  // 5A. Active challenge exists -> atomically claim resend and reuse the exact same active OTP
  if (active) {
    const nextResendCount = active.resendCount + 1;
    const nextCooldown = progressiveResendCooldown(nextResendCount);
    const nextCooldownUntil = at + nextCooldown;

    const claimed = await claimOtpResend(db, active.id, nextCooldownUntil, at);
    if (!claimed || !claimed.otpEncrypted) {
      // Concurrent resend already claimed this slot
      throw new ApiError("OTP_RATE_LIMITED", 429, "Too many attempts. Please try again later.", nextCooldown);
    }

    const aadContext = `${active.id}:${input.purpose}:${phoneHash}`;
    const otp = await decryptOtpForResend(aesKey, claimed.otpEncrypted, aadContext);
    const delivery = await provider.sendCustomOtp(input.phone, otp);

    await recordOtpDelivery(db, {
      id: crypto.randomUUID(),
      challengeId: active.id,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: delivery.status,
      errorCode: delivery.errorCode,
      attemptNumber: claimed.resendCount + 1,
      nowSec: at,
    });

    if (delivery.status === "FAILED") {
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn't resend a code. Please try again later.");
    }

    return {
      requestId: active.id,
      expiresIn: Math.max(0, claimed.expiresAt - at),
      resendAfter: nextCooldown,
      otpLength: AUTH_POLICY.otpDigits,
      phoneHash,
      ipHash,
      deviceHash,
    };
  }

  // 5B. No active challenge -> generate fresh cryptographic 4-digit OTP and store HMAC + AES-GCM copy
  const challengeId = crypto.randomUUID();
  const otp = generateCryptographicOtp(AUTH_POLICY.otpDigits);
  const expiresAt = at + AUTH_POLICY.otpLifetime;
  const initialCooldown = progressiveResendCooldown(0);
  const cooldownUntil = at + initialCooldown;
  const aadContext = `${challengeId}:${input.purpose}:${phoneHash}`;

  const [otpHmac, otpEncrypted] = await Promise.all([
    computeOtpHmac(hmacKey, challengeId, input.purpose, phoneHash, otp),
    encryptOtpForResend(aesKey, otp, aadContext),
  ]);

  await createOtpChallenge(db, {
    id: challengeId,
    phoneHash,
    purpose: input.purpose,
    otpHmac,
    otpEncrypted,
    expiresAt,
    cooldownUntil,
    idempotencyKey: input.idempotencyKey,
    provider: env.OTP_PROVIDER,
    nowSec: at,
  });

  const delivery = await provider.sendCustomOtp(input.phone, otp);
  await recordOtpDelivery(db, {
    id: crypto.randomUUID(),
    challengeId,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId,
    status: delivery.status,
    errorCode: delivery.errorCode,
    attemptNumber: 1,
    nowSec: at,
  });

  if (delivery.status === "FAILED") {
    await markOtpChallengeFailed(db, challengeId);
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn't send a code. Please try again later.");
  }

  return {
    requestId: challengeId,
    expiresIn: AUTH_POLICY.otpLifetime,
    resendAfter: initialCooldown,
    otpLength: AUTH_POLICY.otpDigits,
    phoneHash,
    ipHash,
    deviceHash,
  };
}

export async function verifyOtp(env: Env, input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const db = env.DB;
  const at = now();
  const [phoneHash, ipHash, deviceHash] = await Promise.all([
    authFingerprint(env.AUTH_HASH_KEY, `phone:${input.phone}`),
    authFingerprint(env.AUTH_HASH_KEY, `ip:${input.ip}`),
    input.installationId ? authFingerprint(env.AUTH_HASH_KEY, `device:${input.installationId}`) : Promise.resolve(null),
  ]);

  await enforceOtpVerifyRateLimits(db, { ipHash, deviceHash, nowSec: at });

  const challenge = await findOtpChallengeById(db, input.requestId);
  if (!challenge || challenge.phoneHash !== phoneHash || challenge.purpose !== input.purpose) {
    throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired. Request a new code.");
  }

  if (challenge.status === "LOCKED" || challenge.attempts >= AUTH_POLICY.verificationAttempts) {
    const retryAfter = challenge.cooldownUntil && challenge.cooldownUntil > at
      ? challenge.cooldownUntil - at
      : AUTH_POLICY.verificationBlock;
    throw new ApiError("OTP_RATE_LIMITED", 429, "Too many attempts. Please try again later.", Math.max(1, retryAfter));
  }

  if (challenge.status !== "PENDING" || challenge.expiresAt <= at || !challenge.otpHmac) {
    throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired. Request a new code.");
  }

  const { hmacKey } = await deriveOtpKeys(getOtpKeyMaterial(env));
  const valid = await verifyOtpHmac(hmacKey, challenge.otpHmac, challenge.id, input.purpose, phoneHash, input.otp);

  if (!valid) {
    const updated = await recordFailedOtpAttempt(
      db,
      challenge.id,
      AUTH_POLICY.verificationAttempts,
      at + AUTH_POLICY.verificationBlock,
    );
    if (updated && (updated.status === "LOCKED" || updated.attempts >= AUTH_POLICY.verificationAttempts)) {
      throw new ApiError(
        "OTP_RATE_LIMITED",
        429,
        "Too many attempts. Please try again later.",
        AUTH_POLICY.verificationBlock,
      );
    }
    throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired.");
  }

  const consumed = await consumeOtpChallenge(
    db,
    challenge.id,
    phoneHash,
    input.purpose,
    at,
    AUTH_POLICY.verificationAttempts,
  );
  if (!consumed) {
    throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired. Request a new code.");
  }

  if (deviceHash) {
    await upsertOtpDevice(db, deviceHash, at, input.userId);
  }

  return { phoneHash, ipHash, deviceHash };
}

export async function handleDeliveryWebhook(
  env: Env,
  payload: Record<string, unknown>,
  providedSecret?: string | null,
): Promise<{ updated: number }> {
  if (env.MSG91_WEBHOOK_SECRET) {
    if (!providedSecret || providedSecret !== env.MSG91_WEBHOOK_SECRET) {
      throw new ApiError("UNAUTHORIZED", 401, "Invalid webhook signature.");
    }
  } else {
    // Reject unsigned status mutations when webhook secret isn't provisioned
    throw new ApiError("UNAUTHORIZED", 401, "Webhook verification secret is not configured.");
  }

  const rawId = payload.request_id ?? payload.requestId ?? payload.reqId;
  const providerMessageId = typeof rawId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(rawId) ? rawId : null;
  const status = normalizeWebhookStatus(payload.status ?? payload.event ?? payload.delivery_status);
  if (!providerMessageId || !status) {
    return { updated: 0 };
  }

  const rawReason = payload.reason ?? payload.error_code ?? payload.description;
  const errorCode = typeof rawReason === "string" ? rawReason.slice(0, 64) : null;
  const updated = await updateOtpDeliveryByProviderId(env.DB, providerMessageId, status, errorCode, now());
  return { updated };
}
