import { beforeEach, expect, it, vi } from "vitest";
import { createSession } from "../../mobile/src/auth/authApi";
import { completeLogin } from "../../mobile/src/auth/authService";
import { api, setAuthTokenGetter, setAuthExpiredHandler } from "../../mobile/src/api/client";

const storage = vi.hoisted(() => ({ saveSession: vi.fn() }));
vi.mock("../../mobile/src/auth/authStorage", () => storage);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1");
  setAuthTokenGetter(() => null);
});
it("sends widget proof and saves the returned Bulao session", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, data: {
    token: "session-token", expiresAt: 9999999999, user: { id: "user", name: "Name", area: "Area" },
  } }));
  const result = await completeLogin("919999999991", "provider-proof");
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({ identifier: "919999999991", accessToken: "provider-proof" });
  expect(storage.saveSession).toHaveBeenCalledWith(result.session);
  expect(result.session.token).toBe("session-token");
});
it("explains a stale API deployment instead of asking an OTP user to sign in", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to continue." } }, { status: 401 }));
  await expect(createSession("919999999991", "proof")).rejects.toThrow("login service needs an update");
  expect(storage.saveSession).not.toHaveBeenCalled();
});
it("preserves provider configuration errors separately from invalid sessions", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: false, error: { code: "PROVIDER_AUTH_REJECTED", message: "Phone verification configuration was rejected." } }, { status: 503 }));
  await expect(createSession("919999999991", "proof")).rejects.toMatchObject({ code: "PROVIDER_AUTH_REJECTED", retryable: true });
});
it("does not log out a new login when an older session request finishes with 401", async () => {
  let finish!: (r: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const logout = vi.fn(); setAuthExpiredHandler(logout);
  setAuthTokenGetter(() => "old-session");
  const pending = api("/users/me");
  setAuthTokenGetter(() => "new-session");
  finish(Response.json({ success: false, error: { code: "AUTH_REQUIRED" } }, { status: 401 }));
  await expect(pending).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  expect(logout).not.toHaveBeenCalled();
});
