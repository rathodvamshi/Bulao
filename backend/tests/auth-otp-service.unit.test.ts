import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { AUTH_POLICY, progressiveResendCooldown } from "../src/modules/auth/policy";
import { handleDeliveryWebhook, requestOtp, verifyOtp } from "../src/modules/auth/otpService";
import {
  computeOtpHmac,
  decryptOtpForResend,
  deriveOtpKeys,
  encryptOtpForResend,
  generateCryptographicOtp,
  verifyOtpHmac,
} from "../src/modules/auth/session";
import { Msg91OtpProvider } from "../src/providers/otp/msg91";

const repo = vi.hoisted(() => ({
  createUserSession: vi.fn(),
  findActiveSession: vi.fn(),
  revokeSession: vi.fn(),
  writeAuthEvent: vi.fn(),
  consumeRollingRateLimits: vi.fn(),
  upsertOtpDevice: vi.fn(),
  findActiveOtpChallenge: vi.fn(),
  findLockedOtpChallenge: vi.fn(),
  findOtpChallengeByIdempotency: vi.fn(),
  createOtpChallenge: vi.fn(),
  claimOtpResend: vi.fn(),
  findOtpChallengeById: vi.fn(),
  recordFailedOtpAttempt: vi.fn(),
  consumeOtpChallenge: vi.fn(),
  markOtpChallengeFailed: vi.fn(),
  recordOtpDelivery: vi.fn(),
  updateOtpDeliveryByProviderId: vi.fn(),
  updateUserPhone: vi.fn(),
  cleanupExpiredOtpRecords: vi.fn(),
}));
vi.mock("../src/modules/auth/repository", () => repo);

const secret = "production-grade-otp-test-secret-key-00000000";
const phone = "+919876543210";
const installationId = "123e4567-e89b-12d3-a456-426614174000";

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    APP_ENV: "staging",
    OTP_PROVIDER: "msg91",
    MSG91_AUTH_KEY: "test-msg91-auth-key",
    MSG91_TEMPLATE_ID: "6a9e95cd898618ba1a007d22",
    MSG91_WEBHOOK_SECRET: "webhook-secret-token",
    AUTH_HASH_KEY: secret,
    OTP_ENCRYPTION_KEY: "separate-encryption-secret-key-000000000000",
    ALLOWED_ORIGIN: "https://example.test",
    AUTH_EVENTS: { send: vi.fn(async () => {}) },
    ...overrides,
  } as any;
}

describe("Production OTP System — Crypto, Lifecycle, Resend, Security & MSG91", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000 * 1000);
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    repo.consumeRollingRateLimits.mockResolvedValue({ allowed: true });
    repo.upsertOtpDevice.mockResolvedValue(undefined);
    repo.findActiveOtpChallenge.mockResolvedValue(null);
    repo.findLockedOtpChallenge.mockResolvedValue(null);
    repo.findOtpChallengeByIdempotency.mockResolvedValue(null);
    repo.createOtpChallenge.mockResolvedValue(undefined);
    repo.recordOtpDelivery.mockResolvedValue(undefined);
    repo.markOtpChallengeFailed.mockResolvedValue(undefined);
    repo.findActiveSession.mockResolvedValue({ id: "user-1", name: "User", area: "", expiresAt: 9999999999 });
    vi.mocked(fetch).mockImplementation(async () => Response.json({ type: "success", request_id: "msg91-id-1" }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates unbiased 4-digit CSPRNG OTPs and protects them with HKDF HMAC + AES-GCM", async () => {
    const samples = Array.from({ length: 25 }, () => generateCryptographicOtp(4));
    for (const s of samples) {
      expect(s).toMatch(/^\d{4}$/);
    }
    expect(new Set(samples).size).toBeGreaterThan(10);

    const { hmacKey, aesKey } = await deriveOtpKeys(secret);
    const aad = "challenge-1:login:phonehash-1";
    const encrypted = await encryptOtpForResend(aesKey, "0482", aad);
    expect(encrypted).not.toContain("0482");
    expect(await decryptOtpForResend(aesKey, encrypted, aad)).toBe("0482");
    await expect(decryptOtpForResend(aesKey, encrypted, "tampered-aad")).rejects.toThrow();

    const mac = await computeOtpHmac(hmacKey, "challenge-1", "login", "phonehash-1", "0482");
    expect(await verifyOtpHmac(hmacKey, mac, "challenge-1", "login", "phonehash-1", "0482")).toBe(true);
    expect(await verifyOtpHmac(hmacKey, mac, "challenge-1", "phone_change", "phonehash-1", "0482")).toBe(false);
    expect(await verifyOtpHmac(hmacKey, mac, "challenge-1", "login", "phonehash-1", "9999")).toBe(false);
  });

  it("reuses active challenge and decrypts the exact same OTP across progressive cooldowns (30s -> 45s -> 60s)", async () => {
    expect(progressiveResendCooldown(0)).toBe(30);
    expect(progressiveResendCooldown(1)).toBe(45);
    expect(progressiveResendCooldown(2)).toBe(60);
    expect(progressiveResendCooldown(5)).toBe(60);

    const env = makeEnv();
    let storedChallenge: any = null;
    repo.createOtpChallenge.mockImplementation(async (_db, record) => {
      storedChallenge = {
        ...record,
        resendCount: 0,
        lastSentAt: record.nowSec,
        attempts: 0,
        used: 0,
        status: "PENDING",
      };
    });

    // 1. Initial send -> fresh OTP, 30s cooldown, 5m expiry
    const first = await requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId });
    expect(first.resendAfter).toBe(30);
    expect(first.expiresIn).toBe(300);
    const sentUrl1 = new URL(vi.mocked(fetch).mock.calls[0]![0] as URL | string);
    const sentOtp1 = sentUrl1.searchParams.get("otp");
    expect(sentOtp1).toMatch(/^\d{4}$/);
    expect(sentUrl1.searchParams.get("template_id")).toBe("6a9e95cd898618ba1a007d22");

    // 2. Resend before 30s cooldown -> rejected 429 without sending SMS
    repo.findActiveOtpChallenge.mockImplementation(async () => storedChallenge);
    await expect(
      requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId }),
    ).rejects.toMatchObject({ status: 429, code: "OTP_RATE_LIMITED" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // 3. Advance 30s -> Resend #1 sends EXACT SAME OTP and applies 45s cooldown without resetting expiry
    vi.setSystemTime((1_800_000_000 + 30) * 1000);
    repo.claimOtpResend.mockImplementation(async (_db, _id, nextCooldownUntil) => {
      storedChallenge.resendCount += 1;
      storedChallenge.cooldownUntil = nextCooldownUntil;
      return {
        resendCount: storedChallenge.resendCount,
        otpEncrypted: storedChallenge.otpEncrypted,
        expiresAt: storedChallenge.expiresAt,
      };
    });

    const second = await requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId });
    expect(second.requestId).toBe(first.requestId);
    expect(second.resendAfter).toBe(45);
    expect(second.expiresIn).toBe(270); // Original 300s expiry preserved!
    const sentOtp2 = new URL(vi.mocked(fetch).mock.calls[1]![0] as URL | string).searchParams.get("otp");
    expect(sentOtp2).toBe(sentOtp1);

    // 4. Advance 45s -> Resend #2 applies 60s cooldown and keeps same OTP
    vi.setSystemTime((1_800_000_000 + 75) * 1000);
    const third = await requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId });
    expect(third.resendAfter).toBe(60);
    const sentOtp3 = new URL(vi.mocked(fetch).mock.calls[2]![0] as URL | string).searchParams.get("otp");
    expect(sentOtp3).toBe(sentOtp1);
  });

  it("enforces strict phone (3/15m, 5/1h, 10/24h), device (5/1h, 15/24h), and IP (10/1h) limits independently", async () => {
    const env = makeEnv();
    await requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId });
    const rules = repo.consumeRollingRateLimits.mock.calls[0]![1];
    const maxByPrefix = Object.fromEntries(rules.map((r: any) => [r.key.split(":")[1], r.maxCount]));
    expect(maxByPrefix).toEqual({
      p15: 3,
      p1h: 5,
      p24: 10,
      ip1h: 10,
      d1h: 5,
      d24: 15,
    });
  });

  it("prevents duplicate SMS on concurrent resend or idempotency retry", async () => {
    const env = makeEnv();
    const challenge = {
      id: "c-concurrent",
      phoneHash: "ph",
      purpose: "login",
      otpHmac: "hmac",
      otpEncrypted: "enc",
      status: "PENDING",
      resendCount: 0,
      lastSentAt: 1_800_000_000,
      cooldownUntil: 1_800_000_030,
      idempotencyKey: "idem-12345678",
      expiresAt: 1_800_000_300,
      attempts: 0,
      used: 0,
      createdAt: 1_800_000_000,
    };

    // Idempotent retry returns same challenge without hitting MSG91
    repo.findOtpChallengeByIdempotency.mockResolvedValue(challenge);
    const idem = await requestOtp(env, {
      phone,
      purpose: "login",
      ip: "192.0.2.1",
      idempotencyKey: "idem-12345678",
    });
    expect(idem.requestId).toBe("c-concurrent");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // Concurrent resend where atomic claim returns null -> rejected 429, no duplicate SMS
    vi.setSystemTime((1_800_000_000 + 35) * 1000);
    repo.findOtpChallengeByIdempotency.mockResolvedValue(null);
    repo.findActiveOtpChallenge.mockResolvedValue(challenge);
    repo.claimOtpResend.mockResolvedValue(null);

    await expect(
      requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1" }),
    ).rejects.toMatchObject({ status: 429, code: "OTP_RATE_LIMITED" });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("locks after 5 wrong OTP attempts, blocks fresh sends during 10-min lockout, and prevents concurrent replay", async () => {
    const env = makeEnv();
    let stored: any = null;
    repo.createOtpChallenge.mockImplementation(async (_db, r) => {
      stored = { ...r, status: "PENDING", attempts: 0, used: 0 };
    });
    repo.findOtpChallengeById.mockImplementation(async () => stored);

    const dispatched = await requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1", installationId });
    const sentOtp = new URL(vi.mocked(fetch).mock.calls[0]![0] as URL | string).searchParams.get("otp")!;

    // 4 wrong attempts -> 400 INVALID_OTP; 5th -> 429 LOCKED
    repo.recordFailedOtpAttempt.mockImplementation(async (_db, _id, max, lockedUntil) => {
      stored.attempts += 1;
      if (stored.attempts >= max) {
        stored.status = "LOCKED";
        stored.cooldownUntil = lockedUntil;
        stored.otpEncrypted = null;
      }
      return { attempts: stored.attempts, status: stored.status };
    });

    for (let i = 0; i < 4; i++) {
      await expect(
        verifyOtp(env, { phone, requestId: dispatched.requestId, otp: "9999", purpose: "login", ip: "192.0.2.1" }),
      ).rejects.toMatchObject({ status: 400, code: "INVALID_OTP" });
    }
    await expect(
      verifyOtp(env, { phone, requestId: dispatched.requestId, otp: "9999", purpose: "login", ip: "192.0.2.1" }),
    ).rejects.toMatchObject({ status: 429, code: "OTP_RATE_LIMITED" });

    // Even a fresh OTP send is blocked during the 10-min lockout
    repo.findLockedOtpChallenge.mockResolvedValue({ id: stored.id, cooldownUntil: stored.cooldownUntil });
    await expect(
      requestOtp(env, { phone, purpose: "login", ip: "192.0.2.1" }),
    ).rejects.toMatchObject({ status: 429, code: "OTP_RATE_LIMITED" });

    // Correct OTP replay / concurrent race: only 1st consume succeeds
    stored.status = "PENDING";
    stored.attempts = 0;
    let consumedOnce = false;
    repo.consumeOtpChallenge.mockImplementation(async () => {
      if (consumedOnce) return null;
      consumedOnce = true;
      stored.status = "CONSUMED";
      stored.used = 1;
      return { id: stored.id };
    });

    const [r1, r2] = await Promise.allSettled([
      verifyOtp(env, { phone, requestId: dispatched.requestId, otp: sentOtp, purpose: "login", ip: "192.0.2.1" }),
      verifyOtp(env, { phone, requestId: dispatched.requestId, otp: sentOtp, purpose: "login", ip: "192.0.2.1" }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual(["fulfilled", "rejected"]);
  });

  it("handles MSG91 transient retries, non-retryable timeouts, and permanent DLT/template errors safely", async () => {
    vi.useRealTimers();
    // 1. Transient 503 then 200 -> retries and succeeds
    const transportTransient = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ type: "error", message: "gateway busy" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ type: "success", request_id: "msg-ok-1" }, { status: 200 }));
    const providerTransient = new Msg91OtpProvider("test-provider-key", "6a9e95cd898618ba1a007d22", transportTransient);
    const res1 = await providerTransient.sendCustomOtp(phone, "4821");
    expect(res1).toMatchObject({ status: "ACCEPTED", providerMessageId: "msg-ok-1", attempts: 2 });
    expect(transportTransient).toHaveBeenCalledTimes(2);

    // 2. Timeout -> UNKNOWN without retrying (prevents double SMS billing)
    const transportTimeout = vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const providerTimeout = new Msg91OtpProvider("test-provider-key", "6a9e95cd898618ba1a007d22", transportTimeout);
    const res2 = await providerTimeout.sendCustomOtp(phone, "4821");
    expect(res2).toMatchObject({ status: "UNKNOWN", errorCode: "PROVIDER_TIMEOUT", attempts: 1 });
    expect(transportTimeout).toHaveBeenCalledTimes(1);

    // 3. Permanent template error -> FAILED without retrying
    const transportTemplate = vi
      .fn()
      .mockResolvedValue(Response.json({ type: "error", message: "Invalid DLT template_id" }, { status: 400 }));
    const providerTemplate = new Msg91OtpProvider("test-provider-key", "6a9e95cd898618ba1a007d22", transportTemplate);
    const res3 = await providerTemplate.sendCustomOtp(phone, "4821");
    expect(res3).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_TEMPLATE_ERROR", attempts: 1 });
    expect(transportTemplate).toHaveBeenCalledTimes(1);
  });

  it("validates webhook secret before updating delivery status", async () => {
    const env = makeEnv();
    await expect(
      handleDeliveryWebhook(env, { request_id: "msg91-id-1", status: "delivered" }, "wrong-secret"),
    ).rejects.toMatchObject({ status: 401 });

    repo.updateOtpDeliveryByProviderId.mockResolvedValue(1);
    const ok = await handleDeliveryWebhook(
      env,
      { request_id: "msg91-id-1", status: "delivered" },
      "webhook-secret-token",
    );
    expect(ok).toEqual({ updated: 1 });
    expect(repo.updateOtpDeliveryByProviderId).toHaveBeenCalledWith(
      env.DB,
      "msg91-id-1",
      "DELIVERED",
      null,
      expect.any(Number),
    );
  });

  it("routes /api/v1/users/phone/* through unified OtpService with purpose=phone_change and rejects backdoors", async () => {
    let savedChallenge: any = null;
    repo.createOtpChallenge.mockImplementation(async (_db, r) => {
      savedChallenge = { ...r, status: "PENDING", attempts: 0, used: 0 };
    });
    repo.findOtpChallengeById.mockImplementation(async () => savedChallenge);
    repo.consumeOtpChallenge.mockResolvedValue({ id: "chg-1" });
    repo.updateUserPhone.mockResolvedValue(undefined);

    const dbMock = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => null),
        })),
      })),
    };
    const env = makeEnv({ DB: dbMock });

    const sendRes = await app.request(
      "https://example.test/api/v1/users/phone/send-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-session",
          "CF-Connecting-IP": "192.0.2.5",
        },
        body: JSON.stringify({ newPhone: "9876500001", installationId }),
      },
      env,
      { waitUntil() {}, passThroughOnException() {} } as never,
    );
    expect(sendRes.status).toBe(200);
    const sendJson = await sendRes.json();
    expect(sendJson.data.devOtp).toBeUndefined();
    expect(sendJson.data.otpLength).toBe(AUTH_POLICY.otpDigits);
    expect(savedChallenge.purpose).toBe("phone_change");

    // Hardcoded 123456 or wrong 4-digit code must fail
    const badVerify = await app.request(
      "https://example.test/api/v1/users/phone/verify-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-session",
          "CF-Connecting-IP": "192.0.2.5",
        },
        body: JSON.stringify({ newPhone: "9876500001", requestId: sendJson.data.requestId, otp: "123456" }),
      },
      env,
      { waitUntil() {}, passThroughOnException() {} } as never,
    );
    expect(badVerify.status).toBe(400);

    // Exact OTP sent to MSG91 succeeds and updates phone
    const sentOtp = new URL(vi.mocked(fetch).mock.calls[0]![0] as URL | string).searchParams.get("otp")!;
    const goodVerify = await app.request(
      "https://example.test/api/v1/users/phone/verify-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-session",
          "CF-Connecting-IP": "192.0.2.5",
        },
        body: JSON.stringify({ newPhone: "9876500001", requestId: sendJson.data.requestId, otp: sentOtp, installationId }),
      },
      env,
      { waitUntil() {}, passThroughOnException() {} } as never,
    );
    expect(goodVerify.status).toBe(200);
    expect(repo.updateUserPhone).toHaveBeenCalledWith(dbMock, "user-1", "+919876500001", expect.any(Number));
  });
});
