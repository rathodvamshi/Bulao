import { it, expect } from "vitest";
import { testDatabase } from "./sqlite-d1";
import app from "../src/app";
import { hash, now } from "../src/modules/auth/session";
it("enforces job capacity at the database boundary and cannot forge reviews", () => {
  const { sqlite } = testDatabase();
  try {
    for (const id of ["owner", "a", "b"])
      sqlite
        .prepare("INSERT INTO users(id,phone,created_at) VALUES(?,?,?)")
        .run(id, id, now());
    sqlite
      .prepare(
        "INSERT INTO jobs(id,owner_id,category_id,role_id,area,latitude,longitude,starts_at,workers,pay_paise,pay_unit,details,created_at) VALUES('j','owner','food','kitchen-helper','Area',0,0,?,1,100,'day','',?)",
      )
      .run(now() + 3600, now());
    for (const id of ["a", "b"])
      sqlite
        .prepare(
          "INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,created_at) VALUES(?,'job','j','owner',?,?)",
        )
        .run(id, id, now());
    sqlite.exec("UPDATE interactions SET status='ACCEPTED' WHERE id='a'");
    expect(() =>
      sqlite.exec("UPDATE interactions SET status='ACCEPTED' WHERE id='b'"),
    ).toThrow(/JOB_CAPACITY/);
    expect(() =>
      sqlite.exec("UPDATE interactions SET status='COMPLETED' WHERE id='a'"),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO reviews(id,interaction_id,author_id,target_id,stars,body,created_at) VALUES('r','a','owner','a',5,'',?)",
        )
        .run(now()),
    ).toThrow();
  } finally {
    sqlite.close();
  }
});
it("retries publishing without duplicates and protects phone/location before acceptance", async () => {
  const { db, sqlite } = testDatabase();
  const env = {
    DB: db,
    APP_ENV: "development",
    OTP_PROVIDER: "development",
    ALLOWED_ORIGIN: "http://localhost:8081",
  };
  try {
    const actors = ["owner", "worker", "stranger"];
    for (const id of actors) {
      sqlite
        .prepare("INSERT INTO users(id,phone,created_at) VALUES(?,?,?)")
        .run(id, `+91999999999${actors.indexOf(id) + 1}`, now());
      sqlite
        .prepare("INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)")
        .run(await hash(id), id, now() + 3600);
    }
    const call = async (path: string, token: string, body?: unknown) => {
      const res = await app.request(
        `http://localhost/api/v1${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        env,
      );
      return { status: res.status, ...((await res.json()) as { data: any }) };
    };
    const input = {
      submissionKey: "stable-test-submission",
      categoryId: "food",
      roleId: "kitchen-helper",
      area: "Area",
      latitude: 17.4,
      longitude: 78.4,
      startsAt: now() + 86400,
      workers: 1,
      payPaise: 70000,
      payUnit: "day",
      details: "",
    };
    const first = await call("/jobs", "owner", input);
    const retry = await call("/jobs", "owner", input);
    expect(first.data.id).toBe(retry.data.id);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM jobs").get()?.n).toBe(1);
    const application = await call(
      `/jobs/${first.data.id}/apply`,
      "worker",
      {},
    );
    const path = `/applications/${application.data.id}`;
    expect((await call(path, "worker")).data.phone).toBe(null);
    expect((await call(path, "stranger")).status).toBe(404);
    await call(`${path}/action`, "owner", { action: "accept" });
    expect((await call(path, "worker")).data.phone).toBe("+919999999991");
    expect(
      (
        await call(`/jobs/${first.data.id}/action`, "stranger", {
          action: "cancel",
        })
      ).status,
    ).toBe(403);
    await call(`/jobs/${first.data.id}/action`, "owner", { action: "cancel" });
    expect((await call(path, "worker")).data.phone).toBe(null);
    expect((await call(path, "worker")).data.status).toBe("CANCELLED");
  } finally {
    sqlite.close();
  }
});
