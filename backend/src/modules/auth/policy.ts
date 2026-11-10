import { z } from "zod";

export const AUTH_POLICY = Object.freeze({
  otpDigits: 4,
  otpLifetime: 300,
  resendCooldown: 60,
  resendCooldowns: [30, 45, 60] as readonly number[],
  // Strict rolling OTP limits (Spec Section 7)
  phoneMax15m: 3,
  phoneWindow15m: 900,
  phoneMax1h: 5,
  phoneWindow1h: 3600,
  phoneMax24h: 10,
  phoneWindow24h: 86400,
  deviceMax1h: 5,
  deviceWindow1h: 3600,
  deviceMax24h: 15,
  deviceWindow24h: 86400,
  ipMax1h: 10,
  ipWindow1h: 3600,
  ipVerifyMax1h: 30,
  // Coordinator compatibility constants
  phoneSends: 5,
  sendWindow: 600,
  phoneDailySends: 15,
  ipSends: 10,
  ipVerifications: 30,
  verificationAttempts: 5,
  verificationBlock: 600,
  providerTimeoutMs: 10000,
  maxSmsRetries: 2,
  smsRetryBackoffMs: 250,
  operationLease: 30,
  sessionLifetime: 30 * 86400,
});

export type OtpPurpose = "login" | "phone_change";
export const otpPurposeSchema = z.enum(["login", "phone_change"]);
export const installationIdSchema = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);

export function progressiveResendCooldown(resendCount: number): number {
  const idx = Math.max(0, Math.min(resendCount, AUTH_POLICY.resendCooldowns.length - 1));
  return AUTH_POLICY.resendCooldowns[idx] ?? 60;
}

export const phoneSchema = z.string().max(32).transform((value) => {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}).pipe(z.string().regex(/^\+91[6-9]\d{9}$/));

export const otpSchema = z.string().regex(new RegExp(`^\\d{${AUTH_POLICY.otpDigits}}$`));

// State using this pure policy is persisted only in Cloudflare Durable Objects or D1.
export function recentAttempts(values: number[], at: number, window: number) {
  return values.filter((value) => value > at - window);
}
