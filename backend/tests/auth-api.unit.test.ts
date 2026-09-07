import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { authFingerprint, hash } from "../src/modules/auth/session";
import { consumeAuthEvents } from "../src/modules/auth/audit";
const repo = vi.hoisted(() => ({ createUserSession: vi.fn(), findActiveSession: vi.fn(), revokeSession: vi.fn(), writeAuthEvent: vi.fn() }));
vi.mock("../src/modules/auth/repository", () => repo);
const challengeId = "5a77c229-38ab-4a1e-834f-3e9692708420";
const phone = "+919999999991";
const secret = "unit-test-only-fingerprint-key-0000000000";
let touches = 0;
let env: any;
let events: any[];
let waits: Promise<unknown>[];
let coordination: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;
const db = new Proxy({}, { get() { touches++; throw new Error("No database calls allowed"); } });
beforeEach(() => {
  vi.resetAllMocks(); touches = 0; events = []; waits = [];
  log = vi.spyOn(console, "log").mockImplementation(() => {}); errors = vi.spyOn(console, "error").mockImplementation(() => {});
  coordination = vi.fn(async (url: string) => url.includes("limit-") || url.endsWith("/verify")
    ? Response.json({ success: true }) : Response.json({ requestId: challengeId, expiresIn: 300, resendAfter: 60, otpLength: 4 }));
  env = { DB: db, APP_ENV: "staging", OTP_PROVIDER: "msg91", AUTH_HASH_KEY: secret, ALLOWED_ORIGIN: "https://preview.example.test",
    AUTH_COORDINATOR: { idFromName: (name: string) => name, get: () => ({ fetch: coordination }) },
    AUTH_EVENTS: { send: vi.fn(async (event: unknown) => { events.push(event); }) } };
  repo.createUserSession.mockResolvedValue({ id: "user", name: "", area: "" });
  repo.findActiveSession.mockResolvedValue({ id: "user", name: "", area: "", expiresAt: 9999999999 });
  repo.revokeSession.mockResolvedValue(undefined); repo.writeAuthEvent.mockResolvedValue(undefined);
});
afterEach(async () => { await Promise.all(waits); expect(touches).toBe(0); });
async function request(path: string, body?: unknown, headers = {}, protocol = "https:") {
  return app.request(`${protocol}//api.example.test/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  }, env, { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} } as never);
}
const verifyBody = { phone, requestId: challengeId, otp: "0123" };

describe("auth API, session and audit contracts with repository calls replaced", () => {
  it("normalizes phone before coordination and returns safe challenge metadata", async () => {
    const response = await request("send-otp", { phone: "99999 99991" }); const result = await response.json();
    expect(response.status).toBe(200); expect(result.data.requestId).toBe(challengeId);
    expect(JSON.parse(coordination.mock.calls[1]![1].body).phone).toBe(phone);
    expect(repo.createUserSession).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(result.requestId).toBe(response.headers.get("X-Request-Id"));
  });
  it.each(["123", "12345", "123456", 1234, "abcd"])("rejects invalid OTP %s before coordination", async (otp) => {
    expect((await request("verify-otp", { ...verifyBody, otp })).status).toBe(400); expect(coordination).not.toHaveBeenCalled(); expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it("requires the matching opaque challenge reference", async () => {
    expect((await request("verify-otp", { phone, otp: "0123" })).status).toBe(400); expect(coordination).not.toHaveBeenCalled();
  });
  it("sanitizes malformed JSON with a trace ID", async () => {
    const response = await request("send-otp", "{broken"); const body = await response.json();
    expect(response.status).toBe(400); expect(body.error.code).toBe("VALIDATION_ERROR"); expect(body.requestId).toBeTruthy();
  });
  it("rejects oversized input", async () => {
    expect((await request("send-otp", { phone: "1".repeat(17000) })).status).toBe(413);
  });
  it("rejects HTTP without contacting a provider or repository", async () => {
    expect((await request("send-otp", { phone }, {}, "http:")).status).toBe(503); expect(coordination).not.toHaveBeenCalled();
  });
  it("fails closed when bindings are missing", async () => {
    delete env.AUTH_COORDINATOR; expect((await request("send-otp", { phone })).status).toBe(503);
  });
  it("returns Retry-After for rate limits and does not create a session", async () => {
    coordination.mockResolvedValue(Response.json({ code: "OTP_RATE_LIMITED", message: "Try later", retryAfter: 60 }, { status: 429 }));
    const response = await request("verify-otp", verifyBody); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60"); expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it("creates a random 256-bit credential only after verification and persists only its hash", async () => {
    const first = await (await request("verify-otp", verifyBody)).json();
    const second = await (await request("verify-otp", verifyBody)).json();
    expect(first.data.token).toMatch(/^[a-f0-9]{64}$/); expect(first.data.token).not.toBe(second.data.token);
    const args = repo.createUserSession.mock.calls[0]!;
    expect(args[1]).toBe(phone); expect(args[2]).toBe(await hash(first.data.token)); expect(args[4] - args[3]).toBe(30 * 86400);
    expect(coordination.mock.invocationCallOrder[1]).toBeLessThan(repo.createUserSession.mock.invocationCallOrder[0]!);
    expect(JSON.stringify(events)).not.toContain(first.data.token); expect(JSON.stringify(log.mock.calls)).not.toContain(first.data.token);
  });
  it("never creates a session when MSG91 rejects the code", async () => {
    coordination.mockImplementation(async (url: string) => url.endsWith("/verify") ? Response.json({ code: "INVALID_OTP", message: "Invalid code" }, { status: 400 }) : Response.json({ success: true }));
    expect((await request("verify-otp", verifyBody)).status).toBe(400); expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it("refuses suspended accounts without returning credentials", async () => {
    repo.createUserSession.mockResolvedValue(undefined);
    const response = await request("verify-otp", verifyBody); expect(response.status).toBe(403); expect(await response.text()).not.toContain('"token"');
  });
  it("sanitizes persistence failure and does not return a token", async () => {
    repo.createUserSession.mockRejectedValue(new Error("SQL private credential secret"));
    const response = await request("verify-otp", verifyBody); const text = await response.text();
    expect(response.status).toBe(500); expect(text).not.toContain("SQL"); expect(text).not.toContain('"token"'); expect(JSON.stringify(errors.mock.calls)).not.toContain("SQL");
  });
  it.each(["expired", "revoked", "suspended", "unverified", "unknown"])("rejects %s session outcomes from persistence", async () => {
    repo.findActiveSession.mockResolvedValue(null);
    expect((await request("session", undefined, { Authorization: "Bearer test-session" })).status).toBe(401);
    expect(repo.findActiveSession.mock.calls[0]![1]).toBe(await hash("test-session"));
  });
  it("requires authentication before session lookup", async () => {
    expect((await request("session")).status).toBe(401); expect(repo.findActiveSession).not.toHaveBeenCalled();
  });
  it("revokes the hashed credential on logout", async () => {
    expect((await request("logout", {}, { Authorization: "Bearer test-session" })).status).toBe(200);
    expect(repo.revokeSession.mock.calls[0]![1]).toBe(await hash("test-session")); expect(events[0].eventType).toBe("AUTH_LOGOUT");
  });
  it("enforces exact browser origins and exposes only safe tracing headers", async () => {
    const allowed = await request("send-otp", { phone }, { Origin: env.ALLOWED_ORIGIN });
    const denied = await request("send-otp", { phone }, { Origin: "https://evil.example.test" });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGIN); expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(allowed.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
  });
  it("keeps phone, IP, OTP, and fingerprint secret out of logs and queued audit payloads", async () => {
    await request("verify-otp", verifyBody); const serialized = JSON.stringify([events, log.mock.calls, errors.mock.calls]);
    for (const sensitive of [phone, "192.0.2.10", '"otp"', secret]) expect(serialized).not.toContain(sensitive);
    expect(events[0].phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("does not fail login when asynchronous audit enqueue fails", async () => {
    env.AUTH_EVENTS.send.mockRejectedValue(new Error("private queue payload"));
    expect((await request("verify-otp", verifyBody)).status).toBe(200); await Promise.all(waits);
    expect(JSON.stringify(errors.mock.calls)).toContain("AUTH_AUDIT_ENQUEUE_FAILED"); expect(JSON.stringify(errors.mock.calls)).not.toContain("private queue");
  });
  it("ACKs an audit only after the mocked writer succeeds", async () => {
    const message = { body: { id: "event", requestId: "trace" }, ack: vi.fn(), retry: vi.fn() };
    await consumeAuthEvents({ messages: [message] } as never, env);
    expect(message.ack).toHaveBeenCalledTimes(1); expect(message.retry).not.toHaveBeenCalled();
    expect(repo.writeAuthEvent.mock.invocationCallOrder[0]).toBeLessThan(message.ack.mock.invocationCallOrder[0]!);
  });
  it("retries failed audit writes without exposing event details", async () => {
    repo.writeAuthEvent.mockRejectedValue(new Error("private database details"));
    const message = { body: { id: "event", requestId: "trace" }, ack: vi.fn(), retry: vi.fn() };
    await consumeAuthEvents({ messages: [message] } as never, env);
    expect(message.retry).toHaveBeenCalledTimes(1); expect(message.ack).not.toHaveBeenCalled(); expect(JSON.stringify(errors.mock.calls)).not.toContain("private database");
  });
  it("uses keyed domain-separated fingerprints", async () => {
    expect(await authFingerprint(secret, `phone:${phone}`)).not.toBe(await authFingerprint(secret, `ip:${phone}`));
    expect(await authFingerprint(secret, phone)).not.toBe(await authFingerprint(secret + "different", phone));
    await expect(authFingerprint("short", phone)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
