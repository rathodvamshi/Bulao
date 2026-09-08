import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { findActiveSession } from "./repository";
export const now = () => Math.floor(Date.now() / 1000);
export async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function identify(db: D1Database, header?: string) {
  if (!header?.startsWith("Bearer ")) return null;
  return findActiveSession(db, await hash(header.slice(7)), now());
}
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = await identify(c.env.DB, c.req.header("Authorization"));
  if (!user)
    throw new ApiError("AUTH_REQUIRED", 401, "Please sign in to continue.");
  c.set("userId", user.id);
  await next();
});
// Keyed hashing prevents phone/IP enumeration from rate-limit IDs or audit exports.
export async function authFingerprint(secret: string, value: string) {

  if (!secret || secret.length < 32) throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const bucket = Math.floor(now() / windowSeconds);
  const row = await db
    .prepare(
      "INSERT INTO rate_limits (key,bucket,count) VALUES (?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, bucket)
    .first<{ count: number }>();
  if (!row || row.count > limit)
    throw new ApiError("RATE_LIMITED", 429, "Please wait before trying again.");
}


