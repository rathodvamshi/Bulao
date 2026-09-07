import { beforeEach, afterEach, describe, it, expect } from "vitest";
import app from "../src/app";
import { testDatabase } from "./sqlite-d1";
import type { Env } from "../src/config/env";
let fixture: ReturnType<typeof testDatabase>;
let env: Env;
beforeEach(() => {
  fixture = testDatabase();
  env = {
    DB: fixture.db,
    APP_ENV: "development",
    OTP_PROVIDER: "development",
    DEV_OTP: "123456",
    DEV_PHONES: "+919999999991,+919999999992,+919999999993",
    ALLOWED_ORIGIN: "http://localhost:8081",
  };
});
afterEach(() => fixture.sqlite.close());
async function call(
  path: string,
  body?: unknown,
  token?: string,
  method?: string,
) {
  const response = await app.request(
    `http://localhost/api/v1${path}`,
    {
      method: method ?? (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );
  return {
    status: response.status,
    ...((await response.json()) as { data: any; error: any; success: boolean }),
  };
}
async function register(phone: string) {
  const sent = await call("/auth/send-otp", { phone });
  expect(sent.status).toBe(200);
  const verified = await call("/auth/verify-otp", {
    challengeId: sent.data.challengeId,
    code: "123456",
  });
  expect(verified.status).toBe(200);
  return verified.data as { token: string; user: { id: string } };
}
const job = () => ({
  submissionKey: crypto.randomUUID(),
  categoryId: "food",
  roleId: "kitchen-helper",
  latitude: 17.4948,
  longitude: 78.3996,
  area: "Kukatpally",
  startsAt: Math.floor(Date.now() / 1000) + 86400,
  workers: 1,
  payPaise: 70000,
  payUnit: "day",
  details: "Evening help",
});
describe("jobs and two-way trust", () => {
  it("registers, posts, discovers, applies, accepts, completes and reviews both ways", async () => {
    const owner = await register("+919999999991"),
      worker = await register("+919999999992"),
      stranger = await register("+919999999993");
    expect(
      (
        await call(
          "/users/me",
          { name: "Asha", area: "Kukatpally" },
          owner.token,
          "PATCH",
        )
      ).status,
    ).toBe(200);
    const posted = await call("/jobs", job(), owner.token);
    expect(posted.status).toBe(200);
    const nearby = await call("/jobs?latitude=17.4948&longitude=78.3996");
    expect(nearby.data.items).toHaveLength(1);
    expect(nearby.data.items[0]).not.toHaveProperty("latitude");
    expect(
      (await call(`/jobs/${posted.data.id}/apply`, {}, owner.token)).status,
    ).toBe(400);
    const applied = await call(
      `/jobs/${posted.data.id}/apply`,
      {},
      worker.token,
    );
    expect(applied.status).toBe(200);
    const id = applied.data.id;
    const other = await call(
      `/jobs/${posted.data.id}/apply`,
      {},
      stranger.token,
    );
    expect(
      (await call(`/jobs/${posted.data.id}/apply`, {}, worker.token)).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "accept" },
          stranger.token,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "accept" },
          worker.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 5, body: "" },
          worker.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "accept" },
          owner.token,
        )
      ).data.status,
    ).toBe("ACCEPTED");
    expect(
      (
        await call(
          `/applications/${other.data.id}/action`,
          { action: "accept" },
          owner.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "start" },
          owner.token,
        )
      ).data.status,
    ).toBe("IN_PROGRESS");
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "confirm" },
          owner.token,
        )
      ).data.status,
    ).toBe("IN_PROGRESS");
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 5, body: "" },
          owner.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "confirm" },
          worker.token,
        )
      ).data.status,
    ).toBe("COMPLETED");
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 5, body: "Good work" },
          owner.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 4, body: "Clear instructions" },
          worker.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 5, body: "" },
          worker.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "/reviews",
          { interactionId: id, stars: 5, body: "" },
          stranger.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/applications/${id}/action`,
          { action: "cancel" },
          owner.token,
        )
      ).status,
    ).toBe(409);
    expect(
      (await call("/activity", undefined, worker.token)).data.interactions[0]
        .reviewed,
    ).toBe(1);
  });
  it("requires authentication, valid role and valid coordinates", async () => {
    expect((await call("/jobs", job())).status).toBe(401);
    const owner = await register("+919999999991");
    expect(
      (await call("/jobs", { ...job(), roleId: "shop-helper" }, owner.token))
        .status,
    ).toBe(400);
    expect(
      (await call("/jobs", { ...job(), latitude: 95 }, owner.token)).status,
    ).toBe(400);
  });
});
describe("service marketplace", () => {
  it("supports request → acceptance → completion → review and blocks duplicate active requests", async () => {
    const pro = await register("+919999999991"),
      customer = await register("+919999999992");
    const profile = await call(
      "/services",
      {
        categoryId: "electrician",
        latitude: 17.4948,
        longitude: 78.3996,
        area: "Kukatpally",
        radiusKm: 5,
        experience: 3,
        available: true,
      },
      pro.token,
    );
    expect(profile.status).toBe(200);
    const payload = {
      serviceId: profile.data.id,
      details: "Fix a fan",
      latitude: 17.4948,
      longitude: 78.3996,
      area: "Kukatpally",
      scheduledAt: Math.floor(Date.now() / 1000) + 86400,
    };
    const request = await call("/service-requests", payload, customer.token);
    expect(request.status).toBe(200);
    expect(
      (await call("/service-requests", payload, customer.token)).status,
    ).toBe(409);
    for (const action of ["accept", "start", "confirm"])
      expect(
        (
          await call(
            `/service-requests/${request.data.id}/action`,
            { action },
            pro.token,
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await call(
          `/service-requests/${request.data.id}/action`,
          { action: "confirm" },
          customer.token,
        )
      ).data.status,
    ).toBe("COMPLETED");
    expect(
      (
        await call(
          "/reviews",
          { interactionId: request.data.id, stars: 5, body: "On time" },
          customer.token,
        )
      ).status,
    ).toBe(200);
    const nearby = await call("/services?latitude=17.4948&longitude=78.3996");
    expect(nearby.data.items[0].rating).toBe(5);
    expect(
      (await call("/blocks", { targetId: pro.user.id }, customer.token)).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/services?latitude=17.4948&longitude=78.3996",
          undefined,
          customer.token,
        )
      ).data.items,
    ).toHaveLength(0);
    expect(
      (await call("/service-requests", payload, customer.token)).status,
    ).toBe(403);
    expect(
      (
        await call(
          "/reports",
          { targetId: pro.user.id, reason: "Unsafe behaviour" },
          customer.token,
        )
      ).status,
    ).toBe(200);
  });
});
describe("OTP and session boundaries", () => {
  it("does not expose test sign-in on a deployed public hostname", async () => {
    const response = await app.request(
      "https://bulao-example.workers.dev/api/v1/auth/send-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+919999999991" }),
      },
      env,
    );
    expect(response.status).toBe(503);
  });
  it("limits attempts and prevents challenge replay", async () => {
    const sent = await call("/auth/send-otp", { phone: "+919999999991" });
    const input = { challengeId: sent.data.challengeId, code: "000000" };
    for (let i = 0; i < 5; i++)
      expect((await call("/auth/verify-otp", input)).status).toBe(400);
    expect(
      (await call("/auth/verify-otp", { ...input, code: "123456" })).status,
    ).toBe(400);
  });
  it("rate limits resends, consumes OTP once and revokes logout", async () => {
    const sent = await call("/auth/send-otp", { phone: "+919999999991" });
    expect(
      (await call("/auth/send-otp", { phone: "+919999999991" })).status,
    ).toBe(429);
    const verified = await call("/auth/verify-otp", {
      challengeId: sent.data.challengeId,
      code: "123456",
    });
    expect(
      (
        await call("/auth/verify-otp", {
          challengeId: sent.data.challengeId,
          code: "123456",
        })
      ).status,
    ).toBe(400);
    expect((await call("/auth/logout", {}, verified.data.token)).status).toBe(
      200,
    );
    expect(
      (await call("/users/me", undefined, verified.data.token)).status,
    ).toBe(401);
  });
  it("fails closed outside development", async () => {
    env.APP_ENV = "production";
    expect(
      (await call("/auth/send-otp", { phone: "+919999999991" })).status,
    ).toBe(503);
  });
});
