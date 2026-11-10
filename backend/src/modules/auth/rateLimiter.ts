import { ApiError } from "../../middleware/errors";
import { AUTH_POLICY } from "./policy";
import { consumeRollingRateLimits, type RollingRateLimitRule } from "./repository";

export async function enforceOtpSendRateLimits(
  db: D1Database,
  params: { phoneHash: string; ipHash: string; deviceHash?: string | null; nowSec: number },
) {
  const rules: RollingRateLimitRule[] = [
    {
      key: `rl:p15:${params.phoneHash}`,
      bucketSeconds: 60,
      windowSeconds: AUTH_POLICY.phoneWindow15m,
      maxCount: AUTH_POLICY.phoneMax15m,
    },
    {
      key: `rl:p1h:${params.phoneHash}`,
      bucketSeconds: 60,
      windowSeconds: AUTH_POLICY.phoneWindow1h,
      maxCount: AUTH_POLICY.phoneMax1h,
    },
    {
      key: `rl:p24:${params.phoneHash}`,
      bucketSeconds: 3600,
      windowSeconds: AUTH_POLICY.phoneWindow24h,
      maxCount: AUTH_POLICY.phoneMax24h,
    },
    {
      key: `rl:ip1h:${params.ipHash}`,
      bucketSeconds: 60,
      windowSeconds: AUTH_POLICY.ipWindow1h,
      maxCount: AUTH_POLICY.ipMax1h,
    },
  ];

  if (params.deviceHash) {
    rules.push(
      {
        key: `rl:d1h:${params.deviceHash}`,
        bucketSeconds: 60,
        windowSeconds: AUTH_POLICY.deviceWindow1h,
        maxCount: AUTH_POLICY.deviceMax1h,
      },
      {
        key: `rl:d24:${params.deviceHash}`,
        bucketSeconds: 3600,
        windowSeconds: AUTH_POLICY.deviceWindow24h,
        maxCount: AUTH_POLICY.deviceMax24h,
      },
    );
  }

  const result = await consumeRollingRateLimits(db, rules, params.nowSec);
  if (!result.allowed) {
    throw new ApiError(
      "OTP_RATE_LIMITED",
      429,
      "Too many attempts. Please try again later.",
      Math.max(1, result.retryAfter ?? 60),
    );
  }
}

export async function enforceOtpVerifyRateLimits(
  db: D1Database,
  params: { ipHash: string; deviceHash?: string | null; nowSec: number },
) {
  const rules: RollingRateLimitRule[] = [
    {
      key: `rl:ipv1h:${params.ipHash}`,
      bucketSeconds: 60,
      windowSeconds: AUTH_POLICY.ipWindow1h,
      maxCount: AUTH_POLICY.ipVerifyMax1h,
    },
  ];
  if (params.deviceHash) {
    rules.push({
      key: `rl:dv1h:${params.deviceHash}`,
      bucketSeconds: 60,
      windowSeconds: AUTH_POLICY.deviceWindow1h,
      maxCount: AUTH_POLICY.ipVerifyMax1h,
    });
  }

  const result = await consumeRollingRateLimits(db, rules, params.nowSec);
  if (!result.allowed) {
    throw new ApiError(
      "OTP_RATE_LIMITED",
      429,
      "Too many attempts. Please try again later.",
      Math.max(1, result.retryAfter ?? 60),
    );
  }
}
