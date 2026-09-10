import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { hash } from "../src/modules/auth/session";

const repo = vi.hoisted(() => ({ createUserSession: vi.fn(), findActiveSession: vi.fn() }));
vi.mock("../src/modules/auth/repository", () => repo);
const phone = "919999999991";
const proof = "test-widget-verification-proof";
let env: any;
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  env = {
    DB: {}, APP_ENV: "staging", AUTH_HASH_KEY: "test-only-fingerprint-secret-00000000", MSG91_AUTH_KEY: "test-provider-key",
    AUTH_COORDINATOR: { idFromName: (s: string) => s, get: () => ({ fetch: async () => Response.json({ success: true }) }) },
    AUTH_EVENTS: { send: async () => {} }, ALLOWED_ORIGIN: "https://example.test",
  };
  repo.createUserSession.mockResolvedValue({ id: "user-1", name: "User", area: "" });
  vi.mocked(fetch).mockResolvedValue(Response.json({ type: "success", message: phone }));
});
function request(path: string, body: unknown, token?: string) {
  return app.request(`https://example.test/api/v1/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }, env, { waitUntil() {}, passThroughOnException() {} } as never);
}
describe("widget login through the complete application router", () => {
  it("exchanges provider proof without an existing session, then accepts the new session", async () => {
    const response = await request("auth/verify-widget-otp", { identifier: `+${phone}`, accessToken: proof });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.token).toMatch(/^[a-f0-9]{64}$/);
    expect(repo.createUserSession).toHaveBeenCalledWith(env.DB, phone, await hash(data.token), expect.any(Number), data.expiresAt);
    expect(fetch).toHaveBeenCalledWith("https://api.msg91.com/api/v5/widget/verifyAccessToken", expect.objectContaining({
      method: "POST", headers: { "Content-Type": "application/json", authkey: env.MSG91_AUTH_KEY },
      body: JSON.stringify({ "access-token": proof }), redirect: "manual",
    }));
    repo.findActiveSession.mockResolvedValue({ id: "user-1", name: "User", area: "", expiresAt: data.expiresAt });
    const me = await app.request("https://example.test/api/v1/auth/me", { headers: { Authorization: `Bearer ${data.token}` } }, env);
    expect(me.status).toBe(200);
    expect(repo.findActiveSession).toHaveBeenCalledWith(env.DB, await hash(data.token), expect.any(Number));
  });
  it("rejects the old phone-and-request-ID request without creating an account", async () => {
    expect((await request("auth/verify-widget-otp", { identifier: phone, requestId: "untrusted" })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled(); expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it("rejects proof belonging to a different number", async () => {
    const response = await request("auth/verify-widget-otp", { identifier: "919999999992", accessToken: proof });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("WIDGET_PHONE_MISMATCH");
    expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it.each([
    [200, { type: "error", message: "Token expired" }, 400, "WIDGET_TOKEN_INVALID"],
    [400, { type: "error", message: "Authentication failure" }, 503, "PROVIDER_AUTH_REJECTED"],
    [401, {}, 503, "PROVIDER_AUTH_REJECTED"],
    [429, {}, 429, "OTP_RATE_LIMITED"],
    [500, {}, 503, "PROVIDER_UNAVAILABLE"],
    [302, {}, 503, "PROVIDER_UNAVAILABLE"],
    [200, { type: "success", message: "verified" }, 503, "PROVIDER_UNAVAILABLE"],
  ])("maps provider status %s safely", async (status, payload, expectedStatus, code) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload, { status }));
    const response = await request("auth/verify-widget-otp", { identifier: phone, accessToken: proof });
    expect(response.status).toBe(expectedStatus);
    expect((await response.json()).error.code).toBe(code);
    expect(repo.createUserSession).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(proof);
  });
  it("fails closed on provider network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("private provider details"));
    const response = await request("auth/verify-widget-otp", { identifier: phone, accessToken: proof });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
    expect(repo.createUserSession).not.toHaveBeenCalled();
  });
  it("keeps missing routes distinguishable from protected routes", async () => {
    expect((await request("auth/not-a-route", {})).status).toBe(404);
    for (const path of ["reviews", "blocks", "reports"])
      expect((await request(path, {})).status).toBe(401);
  });
});
