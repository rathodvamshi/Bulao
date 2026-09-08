import { afterEach, expect, it, vi } from "vitest";
import { apiBaseUrl } from "../../mobile/src/api/config";
import { fetchWithTimeout } from "../../mobile/src/api/network";
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(["", "/", "/api", "/api/v1"])("normalizes Worker base %s for all mobile endpoints", (suffix) => {
  vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", `https://staging.example.test${suffix}`);
  expect(apiBaseUrl()).toBe("https://staging.example.test/api/v1");
});
it("clears native request timers after a successful response", async () => {
  vi.useFakeTimers(); vi.mocked(fetch).mockResolvedValue(new Response("ok"));
  await fetchWithTimeout("https://staging.example.test", {}, 1000);
  expect(vi.getTimerCount()).toBe(0);
});
it("aborts a hung native request and cleans up its timer", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const pending = expect(fetchWithTimeout("https://staging.example.test", {}, 1000)).rejects.toThrow("aborted");
  await vi.advanceTimersByTimeAsync(1000); await pending;
  expect(vi.getTimerCount()).toBe(0);
});
