import { beforeEach, expect, it, vi } from "vitest";
import { jobApi } from "../../mobile/src/api/jobApi";
import { applicationLabel, categorySearch } from "../../mobile/src/features/jobs/filters";
import type { Job } from "../../mobile/src/api/types";
import { searchSchema } from "@bulao/domain";
beforeEach(() => { vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://example.test/api/v1"); });
it.each([
  ["Events", "events"], ["Tuitions", "education"], ["Constructions", "construction"], ["House", "household"],
])("sends the stable category ID for %s", async (label, id) => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, data: { items: [], nextCursor: null } }));
  await jobApi.searchJobs({ latitude: 0, longitude: 78, radiusKm: 5, ...categorySearch(label) }, "session");
  const url = new URL(String(vi.mocked(fetch).mock.calls[0]![0]));
  expect(url.searchParams.get("categoryId")).toBe(id);
  expect(url.searchParams.get("latitude")).toBe("0");
  expect(url.searchParams.get("radiusKm")).toBe("5");
});
it("sends shops and food together without changing the displayed filter", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, data: { items: [], nextCursor: null } }));
  await jobApi.searchJobs({ latitude: 17, longitude: 78, radiusKm: 15, ...categorySearch("Shop & Hotel") });
  const url = new URL(String(vi.mocked(fetch).mock.calls[0]![0]));
  expect(url.searchParams.get("categoryIds")).toBe("shops,food");
  expect(url.searchParams.has("categoryId")).toBe(false);
  expect(categorySearch(null)).toEqual({});
  expect(searchSchema.parse(Object.fromEntries(url.searchParams)).categoryIds).toEqual(["shops", "food"]);
});
it("requests fresh authenticated details and submits to the existing application endpoint", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ success: true, data: { id: "job" } }));
  await jobApi.getJob("job", "session"); await jobApi.apply("job", "session");
  expect(fetch).toHaveBeenNthCalledWith(1, "https://example.test/api/v1/jobs/job", expect.objectContaining({ cache: "no-store", headers: expect.objectContaining({ Authorization: "Bearer session" }) }));
  expect(fetch).toHaveBeenNthCalledWith(2, "https://example.test/api/v1/jobs/job/apply", expect.objectContaining({ method: "POST", body: "{}" }));
});
it.each([
  [{ status: "PUBLISHED", startsAt: 200 }, "Apply"],
  [{ status: "PUBLISHED", startsAt: 50 }, "Expired"],
  [{ status: "FILLED", startsAt: 200 }, "Filled"],
  [{ status: "CANCELLED", startsAt: 200 }, "Unavailable"],
  [{ status: "PAUSED", startsAt: 200 }, "Unavailable"],
  [{ status: "PUBLISHED", startsAt: 200, hasApplied: true }, "Applied"],
  [{ status: "FILLED", startsAt: 200, hasApplied: true }, "Applied"],
  [{ status: "PUBLISHED", startsAt: 200, ownerId: "me" }, "Your job"],
])("uses a non-applicable state when appropriate: %j", (job, label) => {
  expect(applicationLabel(job as Job, "me", 100)).toBe(label);
});
