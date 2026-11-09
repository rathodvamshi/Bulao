import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumePushQueue, resolvePushCopy, runPushMaintenance } from "../src/modules/notifications/push";

const migration = readFileSync(new URL("../migrations/0030_android_push_notifications.sql", import.meta.url), "utf8");

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE notifications(
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,data TEXT,read INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL
    );
    CREATE TABLE jobs(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,area TEXT,address TEXT,latitude REAL,longitude REAL);
    CREATE TABLE interactions(id TEXT PRIMARY KEY,kind TEXT,job_id TEXT,owner_id TEXT,worker_id TEXT,status TEXT);
    CREATE TABLE reviews(id TEXT PRIMARY KEY,interaction_id TEXT,target_id TEXT,stars INTEGER);
    CREATE TABLE service_profiles(id TEXT PRIMARY KEY,user_id TEXT);
    CREATE TABLE service_ratings(id TEXT PRIMARY KEY,service_id TEXT,provider_id TEXT,customer_id TEXT,stars INTEGER,feedback TEXT,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE service_offline_payments(interaction_id TEXT PRIMARY KEY,provider_confirmed_at INTEGER,customer_confirmed_at INTEGER,updated_at INTEGER NOT NULL DEFAULT 1);
  `);
  sqlite.exec(migration);
  sqlite.prepare("INSERT INTO users(id,name) VALUES(?,?)").run("user-1", "Employer");
  sqlite.prepare("INSERT INTO users(id,name) VALUES(?,?)").run("user-2", "Worker");
  const deliveries: { body: { deliveryId: string } }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          return {
            run: async () => {
              const result = sqlite.prepare(sql).run(...values);
              return { meta: { changes: Number(result.changes) } };
            },
            first: async <T,>() => sqlite.prepare(sql).get(...values) as T | undefined,
            all: async <T,>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
          };
        },
      };
    },
    async batch(statements: { run: () => Promise<{ meta: { changes: number } }> }[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
  const env = {
    DB: db,
    PUSH_DELIVERIES: {
      async sendBatch(messages: { body: { deliveryId: string } }[]) {
        deliveries.push(...messages);
      },
    },
  } as any;
  const addDevice = (installationId = "device-1", token = "ExpoPushToken[abcdefghijklmnop1234567890]") => {
    sqlite.prepare(
      `INSERT INTO push_devices(installation_id,user_id,expo_push_token,platform,active,created_at,updated_at,last_seen_at)
       VALUES(?, 'user-1', ?, 'android', 1, 1, 1, 1)`,
    ).run(installationId, token);
  };
  const addNotification = (id = "notification-1", type = "APPLICATION_CREATED", title = "Private applicant name", message = "Sensitive private content") => {
    sqlite.prepare("INSERT INTO notifications(id,user_id,type,title,message,data,created_at) VALUES(?, 'user-1', ?, ?, ?, ?, ?)")
      .run(id, type, title, message, JSON.stringify({ recipientRole: "provider", jobId: "secret-job-id" }), Math.floor(Date.now() / 1000));
  };
  return { sqlite, env, deliveries, addDevice, addNotification };
}

function queueMessage(deliveryId: string) {
  let acknowledged = false;
  let retried = false;
  return {
    message: { body: { deliveryId }, ack: () => { acknowledged = true; }, retry: () => { retried = true; } },
    state: () => ({ acknowledged, retried }),
  };
}

describe("durable Android push delivery", () => {
  const fixtures: ReturnType<typeof fixture>[] = [];
  const createFixture = () => {
    const value = fixture();
    fixtures.push(value);
    return value;
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const value of fixtures.splice(0)) value.sqlite.close();
  });

  it("creates an outbox record for every direct notification insert and expands to active devices", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    value.sqlite.prepare("INSERT INTO notifications(id,user_id,type,title,message,data,created_at) VALUES('notification-2','user-1','SERVICE_REQUEST','T','M','{}',2)").run();
    expect(value.sqlite.prepare("SELECT COUNT(*) AS count FROM notification_push_outbox").get()?.count).toBe(2);
    await runPushMaintenance(value.env);
    expect(value.deliveries).toHaveLength(2);
    expect(value.sqlite.prepare("SELECT COUNT(*) AS count FROM push_deliveries").get()?.count).toBe(2);
    expect(value.sqlite.prepare("SELECT COUNT(*) AS count FROM notification_push_outbox WHERE state='expanded'").get()?.count).toBe(2);
  });

  it("creates job application and status notifications inside the D1 lifecycle transaction", () => {
    const value = createFixture();
    value.sqlite.prepare("INSERT INTO jobs(id,owner_id,title) VALUES('job-1','user-1','Kitchen help')").run();
    value.sqlite.prepare("INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status) VALUES('interaction-1','job','job-1','user-1','user-2','PENDING')").run();
    value.sqlite.prepare("UPDATE interactions SET status='ACCEPTED' WHERE id='interaction-1'").run();
    value.sqlite.prepare("UPDATE jobs SET area='New area' WHERE id='job-1'").run();
    value.sqlite.prepare("INSERT INTO reviews(id,interaction_id,target_id,stars) VALUES('review-1','interaction-1','user-2',5)").run();
    value.sqlite.prepare("INSERT INTO interactions(id,kind,owner_id,worker_id,status) VALUES('service-1','service','user-1','user-2','COMPLETED')").run();
    value.sqlite.prepare("INSERT INTO service_profiles(id,user_id) VALUES('service-profile-1','user-1')").run();
    value.sqlite.prepare("INSERT INTO service_ratings(id,service_id,provider_id,customer_id,stars,feedback,created_at) VALUES('service-rating-1','service-profile-1','user-1','user-2',5,'Good',1)").run();
    value.sqlite.prepare("INSERT INTO service_offline_payments(interaction_id) VALUES('service-1')").run();
    value.sqlite.prepare("UPDATE service_offline_payments SET provider_confirmed_at=10 WHERE interaction_id='service-1'").run();
    value.sqlite.prepare("UPDATE service_offline_payments SET customer_confirmed_at=11 WHERE interaction_id='service-1'").run();
    const rows = value.sqlite.prepare("SELECT user_id,type,data FROM notifications ORDER BY rowid").all() as any[];
    expect(rows.map((row) => [row.user_id, row.type])).toEqual([
      ["user-1", "APPLICATION_CREATED"],
      ["user-2", "APPLICATION_ACCEPTED"],
      ["user-2", "JOB_LOCATION_UPDATED"],
      ["user-2", "REVIEW_RECEIVED"],
      ["user-1", "SERVICE_REVIEW_RECEIVED"],
      ["user-2", "SERVICE_OFFLINE_PAYMENT_UPDATED"],
      ["user-1", "SERVICE_OFFLINE_PAYMENT_CONFIRMED"],
    ]);
    expect(value.sqlite.prepare("SELECT COUNT(*) AS count FROM notification_push_outbox").get()?.count).toBe(7);
    expect(JSON.parse(rows[0].data)).toMatchObject({ interactionId: "interaction-1", jobId: "job-1", workerId: "user-2", recipientRole: "provider" });
  });

  it("submits action-oriented push copy with deep-link data, tracks an Expo ticket, and records receipt", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    await runPushMaintenance(value.env);
    const deliveryId = value.deliveries[0].body.deliveryId;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/push/send")) {
        const message = JSON.parse(String(init?.body));
        expect(message.title).toBe("New Job Applicant");
        expect(message.body).toBe("A candidate applied for your job. Tap to review profile and hire.");
        expect(message.data).toMatchObject({
          notificationId: "notification-1",
          role: "provider",
          context: "hire",
          type: "APPLICATION_CREATED",
          jobId: "secret-job-id",
        });
        return new Response(JSON.stringify({ data: { status: "ok", id: "ticket-1" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { "ticket-1": { status: "ok" } } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const queued = queueMessage(deliveryId);
    await consumePushQueue({ messages: [queued.message] } as any, value.env);
    expect(queued.state()).toEqual({ acknowledged: true, retried: false });
    expect(value.sqlite.prepare("SELECT state,expo_ticket_id FROM push_deliveries WHERE id=?").get(deliveryId)).toEqual({ state: "receipt_pending", expo_ticket_id: "ticket-1" });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
    await runPushMaintenance(value.env);
    expect(value.sqlite.prepare("SELECT state FROM push_deliveries WHERE id=?").get(deliveryId)?.state).toBe("accepted");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries temporary provider failure without acknowledging it as accepted", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    await runPushMaintenance(value.env);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 429 })));
    const queued = queueMessage(value.deliveries[0].body.deliveryId);
    await consumePushQueue({ messages: [queued.message] } as any, value.env);
    expect(queued.state()).toEqual({ acknowledged: true, retried: false });
    const row = value.sqlite.prepare("SELECT state,last_error_code,next_attempt_at FROM push_deliveries WHERE id=?").get(value.deliveries[0].body.deliveryId) as any;
    expect(row.state).toBe("pending");
    expect(row.last_error_code).toBe("HTTP_429");
    expect(row.next_attempt_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("disables a device after Expo reports it is no longer registered", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    await runPushMaintenance(value.env);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { status: "error", message: "Device is not registered", details: { error: "DeviceNotRegistered" } } }), { status: 200 })));
    const deliveryId = value.deliveries[0].body.deliveryId;
    await consumePushQueue({ messages: [queueMessage(deliveryId).message] } as any, value.env);
    expect(value.sqlite.prepare("SELECT state FROM push_deliveries WHERE id=?").get(deliveryId)?.state).toBe("disabled");
    expect(value.sqlite.prepare("SELECT active FROM push_devices WHERE installation_id='device-1'").get()?.active).toBe(0);
  });

  it("never sends an old account's pending notification after the installation changes owners", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    await runPushMaintenance(value.env);
    value.sqlite.prepare("UPDATE push_devices SET user_id='user-2' WHERE installation_id='device-1'").run();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const deliveryId = value.deliveries[0].body.deliveryId;
    await consumePushQueue({ messages: [queueMessage(deliveryId).message] } as any, value.env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(value.sqlite.prepare("SELECT state,last_error_code FROM push_deliveries WHERE id=?").get(deliveryId)).toEqual({ state: "disabled", last_error_code: "ACCOUNT_CHANGED" });
  });

  it("keeps work recoverable when queue publishing fails", async () => {
    const value = createFixture();
    value.addDevice();
    value.addNotification();
    value.env.PUSH_DELIVERIES.sendBatch = vi.fn(async () => { throw new Error("queue unavailable"); });
    await runPushMaintenance(value.env);
    expect(value.sqlite.prepare("SELECT state,last_error_code FROM push_deliveries").get()).toEqual({ state: "pending", last_error_code: "QUEUE_UNAVAILABLE" });
  });

  describe("resolvePushCopy content strategies", () => {
    it("generates clear, action-oriented copy for seeker completion confirmations", () => {
      const copy = resolvePushCopy({
        type: "JOB_COMPLETION_CONFIRMATION",
        recipientRole: "seeker",
        title: "Confirm completed work",
        message: 'The provider marked "Deep Home Cleaning" complete. Open your request to confirm the work.',
      } as any);
      expect(copy.title).toBe("Confirm Work: Deep Home Cleaning");
      expect(copy.body).toBe("The provider marked the work complete. Tap to verify and close.");
    });

    it("generates clear copy for provider completion confirmations", () => {
      const copy = resolvePushCopy({
        type: "JOB_COMPLETION_CONFIRMATION",
        recipientRole: "provider",
        title: "Confirm completed work",
        message: 'The seeker marked "Plumbing Repair" complete. Open the application to confirm the work.',
      } as any);
      expect(copy.title).toBe("Verify Completion: Plumbing Repair");
      expect(copy.body).toBe("Worker marked the job complete. Tap to verify and release payment.");
    });

    it("generates clear copy for completed jobs", () => {
      const seekerCopy = resolvePushCopy({
        type: "JOB_COMPLETED",
        recipientRole: "seeker",
        title: "Job completed — share your feedback",
        message: '"Office Painting" was marked completed. Please rate your experience!',
      } as any);
      expect(seekerCopy.title).toBe("Work Completed: Office Painting");
      expect(seekerCopy.body).toBe("Work is complete! Tap to rate your experience and leave a review.");

      const providerCopy = resolvePushCopy({
        type: "JOB_COMPLETED",
        recipientRole: "provider",
        title: "Job completed — share your feedback",
        message: '"Office Painting" was marked completed. Please rate your experience!',
      } as any);
      expect(providerCopy.title).toBe("Job Completed: Office Painting");
      expect(providerCopy.body).toBe("Job was finished successfully! Tap to rate the worker.");
    });

    it("generates clear copy for new applicants with name and job title", () => {
      const copy = resolvePushCopy({
        type: "APPLICATION_CREATED",
        recipientRole: "provider",
        title: "New Job Application",
        message: 'Ramesh applied for "Warehouse Staff".',
      } as any);
      expect(copy.title).toBe("New Applicant: Warehouse Staff");
      expect(copy.body).toBe("Ramesh applied for your job. Tap to review profile and hire.");
    });

    it("generates celebratory copy for accepted applications", () => {
      const copy = resolvePushCopy({
        type: "APPLICATION_ACCEPTED",
        recipientRole: "seeker",
        title: "Application Accepted!",
        message: 'Your application for "Delivery Executive" was accepted.',
      } as any);
      expect(copy.title).toBe("You're Hired for Delivery Executive! 🎉");
      expect(copy.body).toBe("Your application was accepted! Tap to view worksite map & contact details.");
    });

    it("generates informative copy for new nearby jobs", () => {
      const copy = resolvePushCopy({
        type: "NEW_JOB_NEARBY",
        recipientRole: "provider",
        title: "New Work: Plumber in Madhapur",
        message: "₹900/day in Madhapur. Tap to review and apply.",
      } as any);
      expect(copy.title).toBe("New Work: Plumber in Madhapur");
      expect(copy.body).toBe("₹900/day in Madhapur. Tap to review and apply.");
    });
  });
});
