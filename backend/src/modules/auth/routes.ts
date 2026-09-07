import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/env";
import { ApiError, ok } from "../../middleware/errors";
import { authFingerprint, hash, now, requireAuth } from "./session";
import { AUTH_POLICY as P, phoneSchema, otpSchema } from "./policy";
import { audit } from "./audit";
import { createUserSession, findActiveSession, revokeSession } from "./repository";

export const auth = new Hono<AppEnv>();
auth.use("*", async (c, next) => {
  if (new URL(c.req.url).protocol !== "https:" || !["staging", "production"].includes(c.env.APP_ENV))
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Use the secure Bulao API to sign in.");
  if (!c.env.DB || !c.env.AUTH_COORDINATOR || !c.env.AUTH_EVENTS)
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  await next();
});

async function coordinated(c: import("hono").Context<AppEnv>, key: string, action: string, input = {}) {
  const stub = c.env.AUTH_COORDINATOR.get(c.env.AUTH_COORDINATOR.idFromName(key));
  const response = await stub.fetch(`https://auth.internal/${action}`, {
    method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json" },
  });
  const result = await response.json<{
    requestId: string; expiresIn: number; resendAfter: number; otpLength: number;
    code?: string; message?: string; retryAfter?: number;
  }>();
  if (!response.ok) {
    throw new ApiError(result.code ?? "PROVIDER_UNAVAILABLE", response.status === 429 ? 429 : response.status === 400 ? 400 : 503,
      result.message ?? "Phone verification is temporarily unavailable.", result.retryAfter);
  }
  return result;
}

for (const action of ["send", "resend", "verify"] as const) {
  auth.post(`/${action}-otp`, async (c) => {
    const input = (action === "send"
      ? z.object({ phone: phoneSchema })
      : action === "resend"
        ? z.object({ phone: phoneSchema, requestId: z.string().uuid() })
        : z.object({ phone: phoneSchema, requestId: z.string().uuid(), otp: otpSchema })
    ).parse(await c.req.json());
    const ip = c.req.header("CF-Connecting-IP");
    if (!ip) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
    const [phoneHash, ipHash] = await Promise.all([
      authFingerprint(c.env.AUTH_HASH_KEY, `phone:${input.phone}`),
      authFingerprint(c.env.AUTH_HASH_KEY, `ip:${ip}`),
    ]);
    let userId: string | null = null;
    try {
      await coordinated(c, `ip:${ipHash}`, action === "verify" ? "limit-verify" : "limit-send");
      const result = await coordinated(c, `phone:${phoneHash}`, action, input);
      if (action !== "verify") {
        audit(c, { eventType: `AUTH_OTP_${action.toUpperCase()}_SUCCESS`, success: true, userId, phoneHash, ipHash, code: null });
        return ok(c, result);
      }
      const at = now();
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await hash(token);
      const expiresAt = at + P.sessionLifetime;
      const user = await createUserSession(c.env.DB, input.phone, tokenHash, at, expiresAt);
      if (!user) throw new ApiError("UNAUTHORIZED", 403, "This account cannot sign in. Please contact support.");
      userId = user.id;
      audit(c, { eventType: "AUTH_OTP_VERIFY_SUCCESS", success: true, userId, phoneHash, ipHash, code: null });
      return ok(c, { token, expiresAt, user });
    } catch (error) {
      audit(c, { eventType: `AUTH_OTP_${action.toUpperCase()}_FAILED`, success: false, userId, phoneHash, ipHash,
        code: error instanceof ApiError ? error.code : "INTERNAL_ERROR" });
      throw error;
    }
  });
}

auth.get("/session", async (c) => {
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

