import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { verifyWidgetToken } from "../../providers/otp/widget";
import { audit } from "./audit";
import { requestOtp, verifyOtp } from "./otpService";
import { AUTH_POLICY as P, installationIdSchema, otpSchema, phoneSchema } from "./policy";
import { enforceOtpVerifyRateLimits } from "./rateLimiter";
import { createUserSession, findActiveSession, revokeSession, upsertOtpDevice } from "./repository";
import { authFingerprint, hash, now, requireAuth } from "./session";

export const auth = new Hono<AppEnv>();

auth.use("*", async (c, next) => {
  if (new URL(c.req.url).protocol !== "https:")
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  if (!c.env.DB || !c.env.AUTH_EVENTS || !c.env.AUTH_HASH_KEY || c.env.AUTH_HASH_KEY.length < 32)
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  await next();
});

const sendSchema = z.object({
  phone: phoneSchema,
  installationId: installationIdSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const resendSchema = z.object({
  phone: phoneSchema,
  requestId: z.string().uuid(),
  installationId: installationIdSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const verifySchema = z.object({
  phone: phoneSchema,
  requestId: z.string().uuid(),
  otp: otpSchema,
  installationId: installationIdSchema.optional(),
});

auth.post("/send-otp", async (c) => {
  const input = sendSchema.parse(await c.req.json());
  const ip = c.req.header("CF-Connecting-IP");
  if (!ip) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");

  const [phoneHash, ipHash] = await Promise.all([
    authFingerprint(c.env.AUTH_HASH_KEY, `phone:${input.phone}`),
    authFingerprint(c.env.AUTH_HASH_KEY, `ip:${ip}`),
  ]);

  try {
    const result = await requestOtp(c.env, {
      phone: input.phone,
      purpose: "login",
      ip,
      installationId: input.installationId,
      idempotencyKey: input.idempotencyKey,
      traceId: c.get("requestId"),
    });
    audit(c, { eventType: "AUTH_OTP_SEND_SUCCESS", success: true, userId: null, phoneHash, ipHash, code: null });
    return ok(c, {
      requestId: result.requestId,
      expiresIn: result.expiresIn,
      resendAfter: result.resendAfter,
      otpLength: result.otpLength,
    });
  } catch (error) {
    audit(c, {
      eventType: "AUTH_OTP_SEND_FAILED",
      success: false,
      userId: null,
      phoneHash,
      ipHash,
      code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
    });
    throw error;
  }
});

auth.post("/resend-otp", async (c) => {
  const input = resendSchema.parse(await c.req.json());
  const ip = c.req.header("CF-Connecting-IP");
  if (!ip) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");

  const [phoneHash, ipHash] = await Promise.all([
    authFingerprint(c.env.AUTH_HASH_KEY, `phone:${input.phone}`),
    authFingerprint(c.env.AUTH_HASH_KEY, `ip:${ip}`),
  ]);

  try {
    const result = await requestOtp(c.env, {
      phone: input.phone,
      purpose: "login",
      ip,
      requestId: input.requestId,
      installationId: input.installationId,
      idempotencyKey: input.idempotencyKey,
      traceId: c.get("requestId"),
    });
    audit(c, { eventType: "AUTH_OTP_RESEND_SUCCESS", success: true, userId: null, phoneHash, ipHash, code: null });
    return ok(c, {
      requestId: result.requestId,
      expiresIn: result.expiresIn,
      resendAfter: result.resendAfter,
      otpLength: result.otpLength,
    });
  } catch (error) {
    audit(c, {
      eventType: "AUTH_OTP_RESEND_FAILED",
      success: false,
      userId: null,
      phoneHash,
      ipHash,
      code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
    });
    throw error;
  }
});

auth.post("/verify-otp", async (c) => {
  const input = verifySchema.parse(await c.req.json());
  const ip = c.req.header("CF-Connecting-IP");
  if (!ip) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");

  const [phoneHash, ipHash] = await Promise.all([
    authFingerprint(c.env.AUTH_HASH_KEY, `phone:${input.phone}`),
    authFingerprint(c.env.AUTH_HASH_KEY, `ip:${ip}`),
  ]);

  let userId: string | null = null;
  try {
    const verified = await verifyOtp(c.env, {
      phone: input.phone,
      requestId: input.requestId,
      otp: input.otp,
      purpose: "login",
      ip,
      installationId: input.installationId,
      traceId: c.get("requestId"),
    });

    const at = now();
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hash(token);
    const expiresAt = at + P.sessionLifetime;
    const user = await createUserSession(c.env.DB, input.phone, tokenHash, at, expiresAt);
    if (!user) throw new ApiError("UNAUTHORIZED", 403, "This account cannot sign in. Please contact support.");
    userId = user.id;

    if (verified.deviceHash) {
      c.executionCtx.waitUntil(
        upsertOtpDevice(c.env.DB, verified.deviceHash, at, userId).catch(() => {}),
      );
    }

    const isNewUser = !user.name || user.name.trim() === "" || user.name.trim().toLowerCase() === "user";
    audit(c, { eventType: "AUTH_OTP_VERIFY_SUCCESS", success: true, userId, phoneHash, ipHash, code: null });
    return ok(c, { token, expiresAt, user, isNewUser });
  } catch (error) {
    audit(c, {
      eventType: "AUTH_OTP_VERIFY_FAILED",
      success: false,
      userId,
      phoneHash,
      ipHash,
      code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
    });
    throw error;
  }
});

// Legacy widget exchange preserved strictly for older deployed native clients during rollout.
auth.post("/verify-widget-otp", async (c) => {
  const input = z.object({ identifier: phoneSchema, accessToken: z.string().min(1).max(8192) }).parse(await c.req.json());
  const ip = c.req.header("CF-Connecting-IP");
  if (!ip) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  const [ipHash, phoneHash] = await Promise.all([
    authFingerprint(c.env.AUTH_HASH_KEY, `ip:${ip}`),
    authFingerprint(c.env.AUTH_HASH_KEY, `phone:${input.identifier}`),
  ]);
  let userId: string | null = null;
  try {
    await enforceOtpVerifyRateLimits(c.env.DB, { ipHash, nowSec: now() });
    const verifiedPhone = await verifyWidgetToken(c.env.MSG91_AUTH_KEY, input.accessToken);
    if (verifiedPhone !== input.identifier)
      throw new ApiError("WIDGET_PHONE_MISMATCH", 400, "The verified number does not match. Please request a new OTP.");
    const at = now();
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = at + P.sessionLifetime;
    const user = await createUserSession(c.env.DB, verifiedPhone.slice(1), await hash(token), at, expiresAt);
    if (!user) throw new ApiError("UNAUTHORIZED", 403, "This account cannot sign in. Please contact support.");
    userId = user.id;
    const isNewUser = !user.name || user.name.trim() === "" || user.name.trim().toLowerCase() === "user";
    audit(c, { eventType: "AUTH_WIDGET_VERIFY_SUCCESS", success: true, userId, phoneHash, ipHash, code: null });
    return ok(c, { token, expiresAt, user, isNewUser });
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
    console.error(JSON.stringify({ event: "AUTH_WIDGET_VERIFY_FAILED", requestId: c.get("requestId"), code }));
    audit(c, { eventType: "AUTH_WIDGET_VERIFY_FAILED", success: false, userId, phoneHash, ipHash, code });
    throw error;
  }
});

for (const path of ["/session", "/me"]) auth.get(path, async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError("AUTH_REQUIRED", 401, "Please sign in to continue.");
  const session = await findActiveSession(c.env.DB, await hash(header.slice(7)), now());
  if (!session) throw new ApiError("AUTH_REQUIRED", 401, "Please sign in to continue.");
  return ok(c, session);
});

auth.post("/logout", requireAuth, async (c) => {
  await revokeSession(c.env.DB, await hash(c.req.header("Authorization")!.slice(7)), now());
  audit(c, { eventType: "AUTH_LOGOUT", success: true, userId: c.get("userId"), phoneHash: null, ipHash: null, code: null });
  return ok(c, { revoked: true });
});
