import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AuthCoordinator } from "../src/modules/auth/coordinator";
import { ApiError } from "../src/middleware/errors";
const provider = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), resend: vi.fn() }));
vi.mock("../src/providers/otp/provider", () => ({ otpProvider: () => provider }));
const at = 1800000000;
const phone = "+919999999991";
function fixture(overrides = {}) {
  return { sends: [], blockedUntil: 0, challenge: { id: "challenge", expiresAt: at + 300, attempts: 0, used: false, ready: true }, ...overrides };
}
// Mocked storage callbacks with one test fixture, not a database/SQL emulator.
function coordinator(initial: unknown = fixture()) {
  let snapshot = structuredClone(initial);
  let alarm: number | null = null;
  const storage = {
    get: vi.fn(async () => structuredClone(snapshot)),
    put: vi.fn(async (_key: string, value: unknown) => { snapshot = structuredClone(value); }),
    setAlarm: vi.fn(async (time: number) => { alarm = time; }),
    getAlarm: vi.fn(async () => alarm),
    deleteAll: vi.fn(async () => { snapshot = undefined; }),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(storage)),
  };
  const state = { storage, blockConcurrencyWhile: async (fn: () => unknown) => fn() };
  const object = new AuthCoordinator(state as never, {} as never);
  const request = (action: string, input = {}) => object.fetch(new Request(`https://auth.internal/${action}`, {
    method: "POST", body: JSON.stringify({ phone, requestId: "challenge", otp: "0123", ...input }),
  }));
  return { request, storage, object, snapshot: () => snapshot as ReturnType<typeof fixture> };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(at * 1000); vi.resetAllMocks(); provider.send.mockResolvedValue(undefined); provider.resend.mockResolvedValue(undefined); provider.verify.mockResolvedValue(true); });
afterEach(() => vi.useRealTimers());

describe("OTP coordination with storage and MSG91 mocked", () => {
  it("sends a fresh four-digit five-minute challenge without persisting phone or OTP", async () => {
    const c = coordinator(); const res = await c.request("send"); const body = await res.json();
    expect(body).toMatchObject({ otpLength: 4, expiresIn: 300, resendAfter: 60 });
    expect(body.requestId).not.toBe("challenge"); expect(provider.send).toHaveBeenCalledWith(phone);
    expect(JSON.stringify(c.snapshot())).not.toContain(phone); expect(JSON.stringify(c.snapshot())).not.toContain("0123");
  });
  it.each([300, 301])("rejects a code at/after expiry (%s seconds) before MSG91", async (seconds) => {
    const c = coordinator(); vi.setSystemTime((at + seconds) * 1000);
    expect((await c.request("verify")).status).toBe(400); expect(provider.verify).not.toHaveBeenCalled();
  });
  it("accepts immediately before expiry and consumes the challenge", async () => {
    const c = coordinator(); vi.setSystemTime((at + 299) * 1000);
    expect((await c.request("verify")).status).toBe(200); expect(c.snapshot().challenge.used).toBe(true);
    expect((await c.request("verify")).status).toBe(400); expect(provider.verify).toHaveBeenCalledTimes(1);
  });
  it("rejects verification that finishes after expiry", async () => {
    provider.verify.mockImplementation(async () => { vi.setSystemTime((at + 301) * 1000); return true; });
    expect((await coordinator().request("verify")).status).toBe(400);
  });
  it.each(["resend", "send"])("applies shared SMS cooldown to %s", async (action) => {
    const c = coordinator(fixture({ sends: [at - 59] }));
    const res = await c.request(action); expect(res.status).toBe(429); expect(await res.json()).toMatchObject({ retryAfter: 1 });
    expect(provider.send).not.toHaveBeenCalled(); expect(provider.resend).not.toHaveBeenCalled();
  });
  it("resends at the cooldown boundary without resetting expiry or attempts", async () => {
    const initial = fixture({ sends: [at - 60] }); initial.challenge.attempts = 3;
    const c = coordinator(initial); expect((await c.request("resend")).status).toBe(200);
    expect(c.snapshot().challenge).toMatchObject({ expiresAt: at + 300, attempts: 3 }); expect(provider.resend).toHaveBeenCalledWith(phone);
  });
  it("limits a phone to three sends in a rolling ten-minute window", async () => {
    const c = coordinator(fixture({ sends: [at - 500, at - 300, at - 100] }));
    expect((await c.request("send")).status).toBe(429); expect(provider.send).not.toHaveBeenCalled();
  });
  it("applies the independent daily phone ceiling", async () => {
    const c = coordinator(fixture({ sends: Array.from({ length: 10 }, (_, i) => at - 10000 + i * 700) }));
    expect((await c.request("send")).status).toBe(429);
  });
  it.each([["limit-send", 10], ["limit-verify", 30]] as const)("limits IP %s before provider calls", async (action, max) => {
    const c = coordinator(Array.from({ length: max }, () => at - 1));
    expect((await c.request(action)).status).toBe(429); expect(provider.send).not.toHaveBeenCalled(); expect(provider.verify).not.toHaveBeenCalled();
  });
  it("allows IP requests once the sliding window expires", async () => {
    const c = coordinator(Array.from({ length: 10 }, () => at - 600)); expect((await c.request("limit-send")).status).toBe(200);
  });
  it("blocks five wrong attempts, including new sends until block expiry", async () => {
    provider.verify.mockResolvedValue(false); const c = coordinator();
    for (let i = 0; i < 4; i++) expect((await c.request("verify")).status).toBe(400);
    expect((await c.request("verify")).status).toBe(429); expect((await c.request("send")).status).toBe(429);
    expect(provider.verify).toHaveBeenCalledTimes(5);
    vi.setSystemTime((at + 600) * 1000); expect((await c.request("send")).status).toBe(200);
  });
  it("rejects a concurrent operation while the provider request is pending", async () => {
    let complete!: (value: boolean) => void;
    provider.verify.mockImplementation(() => new Promise<boolean>((resolve) => { complete = resolve; }));
    const c = coordinator(); const first = c.request("verify");
    for (let i = 0; i < 30 && !complete; i++) await Promise.resolve();
    expect(complete).toBeTypeOf("function");
    expect((await c.request("send")).status).toBe(429);
    complete(true); expect((await first).status).toBe(200);
  });
  it("fails closed on an ambiguous send timeout and spends SMS quota", async () => {
    provider.send.mockRejectedValue(new Error("private provider details")); const c = coordinator();
    const res = await c.request("send"); expect(res.status).toBe(503); expect(await res.text()).not.toContain("private");
    expect(c.snapshot().challenge.ready).toBe(false); expect(c.snapshot().sends).toHaveLength(1);
  });
  it("counts provider verification outages toward the attempt ceiling", async () => {
    provider.verify.mockRejectedValue(new ApiError("PROVIDER_UNAVAILABLE", 503, "Unavailable")); const c = coordinator();
    for (let i = 0; i < 5; i++) expect((await c.request("verify")).status).toBe(503);
    expect((await c.request("verify")).status).toBe(429); expect(provider.verify).toHaveBeenCalledTimes(5);
  });
  it("rejects an unrelated challenge before contacting MSG91", async () => {
    const c = coordinator(); expect((await c.request("verify", { requestId: "unrelated" })).status).toBe(400); expect(provider.verify).not.toHaveBeenCalled();
  });
});
it("persists the final-attempt block before the provider can complete", async () => {
  let complete!: (value: boolean) => void;
  provider.verify.mockImplementation(() => new Promise<boolean>((resolve) => { complete = resolve; }));
  const initial = fixture(); initial.challenge.attempts = 4;
  const c = coordinator(initial); const pending = c.request("verify");
  for (let i = 0; i < 30 && !complete; i++) await Promise.resolve();
  expect(c.snapshot().blockedUntil).toBe(at + 600);
  // Even after an expired lease, restarting from the persisted fixture stays blocked.
  vi.setSystemTime((at + 31) * 1000);
  expect((await coordinator(c.snapshot()).request("send")).status).toBe(429);
  complete(true); expect((await pending).status).toBe(200); expect(c.snapshot().blockedUntil).toBe(0);
});
