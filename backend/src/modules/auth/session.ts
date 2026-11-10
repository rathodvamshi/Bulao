import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { findActiveSession } from "./repository";
export const now = () => Math.floor(Date.now() / 1000);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hash(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
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
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return toHex(bytes);
}

/**
 * Generates a cryptographically secure numeric OTP using rejection sampling
 * to eliminate modulo bias across 0..10^digits-1.
 */
export function generateCryptographicOtp(digits = 4): string {
  const maxVal = Math.pow(10, digits);
  const limit = Math.floor(0x100000000 / maxVal) * maxVal;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return String(value % maxVal).padStart(digits, "0");
}

/**
 * Derives independent HMAC and AES-GCM subkeys via HKDF-SHA256 from Worker secret.
 */
export async function deriveOtpKeys(secret: string): Promise<{ hmacKey: CryptoKey; aesKey: CryptoKey }> {
  if (!secret || secret.length < 32) {
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  }
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const salt = textEncoder.encode("bulao-otp-hkdf-salt-v1");
  const [hmacKey, aesKey] = await Promise.all([
    crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: textEncoder.encode("bulao-otp-hmac-v1") },
      baseKey,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign", "verify"],
    ),
    crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: textEncoder.encode("bulao-otp-aes-gcm-v1") },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
  ]);
  return { hmacKey, aesKey };
}

export async function computeOtpHmac(
  hmacKey: CryptoKey,
  challengeId: string,
  purpose: string,
  phoneHash: string,
  otp: string,
): Promise<string> {
  const payload = `${challengeId}:${purpose}:${phoneHash}:${otp}`;
  const sig = await crypto.subtle.sign("HMAC", hmacKey, textEncoder.encode(payload));
  return toHex(sig);
}

export async function verifyOtpHmac(
  hmacKey: CryptoKey,
  expectedHex: string,
  challengeId: string,
  purpose: string,
  phoneHash: string,
  otp: string,
): Promise<boolean> {
  const expectedBytes = fromHex(expectedHex);
  if (!expectedBytes) return false;
  const payload = `${challengeId}:${purpose}:${phoneHash}:${otp}`;
  return crypto.subtle.verify("HMAC", hmacKey, expectedBytes as BufferSource, textEncoder.encode(payload));
}

export async function encryptOtpForResend(
  aesKey: CryptoKey,
  otp: string,
  aadContext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode(aadContext) },
    aesKey,
    textEncoder.encode(otp),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptOtpForResend(
  aesKey: CryptoKey,
  encoded: string,
  aadContext: string,
): Promise<string> {
  const parts = encoded.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  }
  const iv = fromBase64Url(parts[1]!);
  const cipher = fromBase64Url(parts[2]!);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: textEncoder.encode(aadContext) },
    aesKey,
    cipher as BufferSource,
  );
  return textDecoder.decode(plain);
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
