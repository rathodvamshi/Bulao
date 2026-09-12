import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
const mocks = vi.hoisted(() => ({ findActiveSession: vi.fn(), get: vi.fn(), values: vi.fn(), insert: vi.fn() }));
vi.mock("../src/modules/auth/repository", () => ({ findActiveSession: mocks.findActiveSession }));
vi.mock("drizzle-orm/d1", () => ({ drizzle: () => ({
  select: () => ({ from: () => ({ where: () => ({ get: mocks.get }) }) }),
  insert: mocks.insert,
}) }));
let statements: { sql: string; args: unknown[] }[];
let detail: any;
let insertResult: unknown;
let existingApplication: unknown;
let roleValid: boolean;
let candidates: any[];
const env: any = { APP_ENV: "staging", ALLOWED_ORIGIN: "https://test.example" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  statements = []; insertResult = { id: "application" }; existingApplication = null; roleValid = true; candidates = [];
  detail = { id: "job", ownerId: "provider", title: "Worker", area: "Area", status: "PUBLISHED", startsAt: Math.floor(Date.now()/1000) + 3600 };
  mocks.findActiveSession.mockResolvedValue({ id: "seeker" });
  mocks.get.mockResolvedValue(detail);
  mocks.values.mockReturnValue({ onConflictDoNothing: vi.fn(async () => {}) });
  mocks.insert.mockReturnValue({ values: mocks.values });
  env.DB = { prepare: (sql: string) => {
    const statement = { sql, args: [] as unknown[] }; statements.push(statement);
    const query = {
      bind: (...args: unknown[]) => { statement.args = args; return query; },
      first: async () => {
        if (sql.startsWith("SELECT r.id")) return roleValid ? { id: "event-helper" } : null;
        if (sql.startsWith("INSERT INTO rate_limits")) return { count: 1 };
        if (sql.startsWith("SELECT j.id")) return detail ? { ...detail, hasApplied: statement.args[0] === "seeker" ? 1 : 0 } : null;
        if (sql.startsWith("INSERT INTO interactions")) return insertResult;
        if (sql.startsWith("SELECT id FROM interactions")) return existingApplication;
        if (sql.startsWith("SELECT COUNT(*) AS count FROM users")) return { count: 2 };
        if (sql.startsWith("SELECT id FROM blocks")) return null;
        throw new Error(`Unexpected query: ${sql}`);
      },
      all: async () => ({ results: candidates }),
    }; return query;
  } };
});
function request(path: string, body?: unknown, token: string | null = "session") {
  return app.request(`https://test.example/api/v1/jobs${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
}
const posting = () => ({ categoryId: "events", roleId: "event-helper", startsAt: Math.floor(Date.now()/1000)+3600,
  latitude: 17, longitude: 78, area: "Area", workers: 2, payPaise: 10000, payUnit: "day", submissionKey: "test-posting-key" });
describe("job details and applications", () => {
  it("returns fresh availability and only the caller's applied state", async () => {
    detail.status = "FILLED";
    const response = await request("/job");
    expect((await response.json()).data).toMatchObject({ status: "FILLED", hasApplied: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(statements.at(-1)?.args).toEqual(["seeker", "job"]);
    const anonymous = await request("/job", undefined, null);
    expect((await anonymous.json()).data.hasApplied).toBe(false);
    expect(statements.at(-1)?.args).toEqual([null, "job"]);
  });
  it("does not reuse another account's application flag", async () => {
    mocks.findActiveSession.mockResolvedValue({ id: "other-seeker" });
    expect((await (await request("/job")).json()).data.hasApplied).toBe(false);
    expect(statements.at(-1)?.args).toEqual(["other-seeker", "job"]);
  });
  it("returns 404 for deleted jobs", async () => {
    detail = null; expect((await request("/missing")).status).toBe(404);
  });
  it("requires sign-in to apply", async () => {
    expect((await request("/job/apply", {}, null)).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each(["FILLED", "PAUSED", "CANCELLED", "COMPLETED"])("rejects %s jobs", async status => {
    detail.status = status;
    const response = await request("/job/apply", {});
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("JOB_NOT_AVAILABLE");
    expect(statements.some(s => s.sql.startsWith("INSERT INTO interactions"))).toBe(false);
  });
  it("rejects expired jobs and self-applications", async () => {
    detail.startsAt = 1;
    expect((await request("/job/apply", {})).status).toBe(409);
    detail.startsAt = Math.floor(Date.now()/1000)+3600; detail.ownerId = "seeker";
    expect((await (await request("/job/apply", {})).json()).error.code).toBe("SELF_APPLICATION");
  });
  it("creates an application with a write-time availability guard", async () => {
    const response = await request("/job/apply", {});
    expect(response.status).toBe(200);
    const applicationId = (await response.json()).data.id;
    expect(applicationId).toMatch(/^[a-f0-9-]{36}$/);
    const insert = statements.find(s => s.sql.startsWith("INSERT INTO interactions"))!;
    expect(insert.sql).toContain("status='PUBLISHED' AND starts_at>=?");
    expect(insert.sql).toContain("ON CONFLICT(job_id,worker_id) DO NOTHING");
    expect(insert.args).toEqual([applicationId, "seeker", expect.any(Number), "job", expect.any(Number)]);
  });
  it("distinguishes a duplicate application from a job closed during application", async () => {
    insertResult = null; existingApplication = { id: "existing" };
    expect((await (await request("/job/apply", {})).json()).error.code).toBe("APPLICATION_EXISTS");
    existingApplication = null;
    expect((await (await request("/job/apply", {})).json()).error.code).toBe("JOB_NOT_AVAILABLE");
  });
});
describe("posting category validation", () => {
  it.each([
    { categoryId: "missing", roleId: "event-helper" },
    { categoryId: "shops", roleId: "event-helper" },
    { categoryId: "events", roleId: "missing-role" },
    { categoryId: "plumber", roleId: "service-role" },
  ])("rejects invalid combinations without substituting a role: %j", async pair => {
    mocks.get.mockResolvedValue(undefined); roleValid = false;
    const response = await request("", { ...posting(), ...pair });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_ROLE");
    expect(mocks.insert).not.toHaveBeenCalled();
    const validation = statements.find(s => s.sql.startsWith("SELECT r.id"))!;
    expect(validation.args).toEqual([pair.roleId, pair.categoryId]);
    expect(validation.sql).toContain("c.kind='job'");
  });
  it("preserves a valid selected category and role", async () => {
    mocks.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "posted" });
    expect((await request("", posting())).status).toBe(200);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "events", roleId: "event-helper" }));
  });
});
it("filters Shop & Hotel by both real IDs and excludes private coordinates", async () => {
  candidates = [{ ...detail, latitude: 17, longitude: 78, hasApplied: 1 }];
  const response = await request("?latitude=17&longitude=78&radiusKm=5&categoryIds=shops,food");
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.items[0].hasApplied).toBe(true);
  expect(data.items[0]).not.toHaveProperty("latitude");
  expect(data.items[0]).not.toHaveProperty("longitude");
  const query = statements.find(s => s.sql.startsWith("SELECT p.id"))!;
  expect(query.sql).toContain("p.category_id IN (?,?)");
  expect(query.args[0]).toBe("seeker");
  expect(query.args).toContain("shops"); expect(query.args).toContain("food");
});
