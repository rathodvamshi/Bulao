import { z } from "zod";

export const AUTH_POLICY = Object.freeze({
  otpDigits: 4, otpLifetime: 300, resendCooldown: 60,
  phoneSends: 3, sendWindow: 600, phoneDailySends: 10, ipSends: 10,
  ipVerifications: 30, verificationAttempts: 5, verificationBlock: 600,
  providerTimeoutMs: 10000, operationLease: 30, sessionLifetime: 30 * 86400,
});

export const phoneSchema = z.string().max(32).transform((value) => {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}).pipe(z.string().regex(/^\+91[6-9]\d{9}$/));

export const otpSchema = z.string().regex(new RegExp(`^\\d{${AUTH_POLICY.otpDigits}}$`));

// State using this pure policy is persisted only in Cloudflare Durable Objects.
export function recentAttempts(values: number[], at: number, window: number) {
  return values.filter((value) => value > at - window);
}
