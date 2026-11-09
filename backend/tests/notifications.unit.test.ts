import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { notificationRoutes } from "../src/modules/notifications/routes";
import { findActiveSession } from "../src/modules/auth/repository";
import { ApiError } from "../src/middleware/errors";
import { validateNotificationInbox } from "../../mobile/src/api/notifications";

vi.mock("../src/modules/auth/repository", () => ({
  findActiveSession: vi.fn(),
}));

// Pure in-memory SQL fixtures: no D1 emulator, external database or network.
describe("notification recipient and role isolation", () => {
  let db: DatabaseSync;
  const app = new Hono()
    .route("/", notificationRoutes)
    .onError((error, c) =>
      c.json(
        { error: error.message },
        error instanceof ApiError ? error.status : 500,
      ),
    );
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(
      path,
      {
        method,
        headers: { Authorization: "Bearer test-session", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      {
        DB: {
          prepare: (sql: string) => ({
            bind: (...args: (string | number)[]) => ({
              all: async () => ({ results: db.prepare(sql).all(...args) }),
              first: async () => db.prepare(sql).get(...args),
              run: async () => {
                const result = db.prepare(sql).run(...args);
                return { ...result, meta: { changes: Number(result.changes) } };
              },
            }),
          }),
          batch: async (statements: { run: () => Promise<{ meta: { changes: number } }> }[]) =>
            Promise.all(statements.map((statement) => statement.run())),
        },
      },
    );
  const inbox = async (role: string) => {
    const response = await request(`/?role=${role}`);
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.role).toBe(role);
    expect(
      data.items.every(
        (item: { recipientRole: string }) => item.recipientRole === role,
      ),
    ).toBe(true);
    return data as {
      items: { id: string; read: number }[];
      unreadCount: number;
    };
  };
  const ids = async (role: string) =>
    (await inbox(role)).items.map((n) => n.id).sort();

  beforeEach(() => {
    vi.mocked(findActiveSession).mockReset();
    vi.mocked(findActiveSession).mockResolvedValue({ id: "me" } as Awaited<
      ReturnType<typeof findActiveSession>
    >);
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE notifications (id TEXT, user_id TEXT, type TEXT, title TEXT, message TEXT, data TEXT, read INTEGER DEFAULT 0, created_at INTEGER DEFAULT 1);
      CREATE TABLE interactions (id TEXT, owner_id TEXT, worker_id TEXT);
      CREATE TABLE push_devices (
        installation_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,expo_push_token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,active INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE rate_limits (key TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(key,bucket));
      INSERT INTO interactions VALUES ('my-post', 'me', 'worker'), ('my-application', 'owner', 'me');
    `);
    const add = (
      id: string,
      type: string,
      data: string | null = null,
      user = "me",
    ) => {
      db.prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, 'Update', 'Test', ?)",
      ).run(id, user, type, data);
    };
    add("provider-new", "APPLICATION_CREATED", '{"recipientRole":"provider"}');
    add("provider-legacy", "APPLICATION_CANCELLED_BY_SEEKER");
    add("provider-completed", "JOB_COMPLETED", '{"interactionId":"my-post"}');
    add("service-request", "SERVICE_REQUEST", '{"recipientRole":"provider"}');
    add("service-prefix-lookalike", "SERVICEA_REQUEST", '{"recipientRole":"provider"}');
    add("seeker-new", "APPLICATION_ACCEPTED", '{"recipientRole":"seeker"}');
    add("seeker-legacy", "APPLICATION_CANCELLED_BY_PROVIDER");
    add(
      "seeker-completed",
      "JOB_COMPLETED",
      '{"interactionId":"my-application"}',
    );
    add("malformed", "APPLICATION_REJECTED", "not-json");
    add("unknown", "UNKNOWN_EVENT");
    add(
      "other-user",
      "APPLICATION_CREATED",
      '{"recipientRole":"provider"}',
      "someone-else",
    );
  });
  afterEach(() => db.close());

  it("separates both inboxes for one account, including legacy completions and malformed data", async () => {
    expect(await ids("provider")).toEqual([
      "provider-completed",
      "provider-legacy",
      "provider-new",
      "service-prefix-lookalike",
    ]);
    expect(await ids("seeker")).toEqual([
      "malformed",
      "seeker-completed",
      "seeker-legacy",
      "seeker-new",
    ]);
    expect((await inbox("provider")).unreadCount).toBe(4);
    expect((await inbox("seeker")).unreadCount).toBe(4);
  });

  it.each(["provider", "seeker"])(
    "mark-all-read only changes the %s inbox",
    async (role) => {
      expect((await request(`/read-all?role=${role}`, "POST")).status).toBe(
        200,
      );
      expect((await inbox(role)).unreadCount).toBe(0);
      expect(
        (await inbox(role === "provider" ? "seeker" : "provider")).unreadCount,
      ).toBe(4);
      expect(
        db
          .prepare("SELECT read FROM notifications WHERE id = 'other-user'")
          .get()?.read,
      ).toBe(0);
    },
  );

  it("cannot read, unread or delete notifications in the other role or account", async () => {
    for (const id of ["provider-new", "other-user"]) {
      await request(`/${id}/read?role=seeker`, "POST");
      expect(
        db.prepare("SELECT read FROM notifications WHERE id = ?").get(id)?.read,
      ).toBe(0);
      db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
      await request(`/${id}/unread?role=seeker`, "POST");
      expect(
        db.prepare("SELECT read FROM notifications WHERE id = ?").get(id)?.read,
      ).toBe(1);
      await request(`/${id}?role=seeker`, "DELETE");
      expect(
        db.prepare("SELECT id FROM notifications WHERE id = ?").get(id)?.id,
      ).toBe(id);
    }
  });

  it("persists read, unread and deletion in the correct inbox", async () => {
    await request("/provider-new/read?role=provider", "POST");
    expect((await inbox("provider")).unreadCount).toBe(3);
    await request("/provider-new/unread?role=provider", "POST");
    expect((await inbox("provider")).unreadCount).toBe(4);
    await request("/provider-new?role=provider", "DELETE");
    expect(await ids("provider")).not.toContain("provider-new");
    expect((await inbox("seeker")).unreadCount).toBe(4);
  });

  it("supports bulk deletion of selected notifications and delete all", async () => {
    const res1 = await request("/bulk-delete?role=provider&scope=work", "POST", {
      ids: ["provider-new", "provider-legacy"],
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()).data;
    expect(body1.success).toBe(true);
    expect(body1.count).toBe(2);

    expect(await ids("seeker")).toContain("seeker-new");
    expect(db.prepare("SELECT id FROM notifications WHERE id='service-request'").get()?.id).toBe("service-request");

    const badRes = await request("/bulk-delete?role=provider&scope=work", "POST", {});
    expect(badRes.status).toBe(400);

    const resAll = await request("/bulk-delete?role=provider&scope=work", "POST", {
      all: true,
    });
    expect(resAll.status).toBe(200);
    const bodyAll = (await resAll.json()).data;
    expect(bodyAll.success).toBe(true);
    expect((await inbox("provider")).items.length).toBe(0);

    expect((await inbox("seeker")).items.length).toBeGreaterThan(0);
    const serviceRes = await request("/?role=provider&scope=service");
    expect((await serviceRes.json()).data.items.length).toBe(1);
  });

  it("registers one authenticated Android installation and safely transfers a refreshed token", async () => {
    const token = "ExpoPushToken[abcdefghijklmnopqrstuvwx]";
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    expect((await request("/devices/register", "POST", { installationId: firstId, token, platform: "android" })).status).toBe(200);
    expect(db.prepare("SELECT installation_id,user_id,active FROM push_devices").all()).toEqual([
      { installation_id: firstId, user_id: "me", active: 1 },
    ]);
    vi.mocked(findActiveSession).mockResolvedValue({ id: "second-user" } as Awaited<ReturnType<typeof findActiveSession>>);
    expect((await request("/devices/register", "POST", { installationId: secondId, token, platform: "android" })).status).toBe(200);
    expect(db.prepare("SELECT installation_id,user_id,active FROM push_devices").all()).toEqual([
      { installation_id: secondId, user_id: "second-user", active: 1 },
    ]);
    expect((await request("/devices/unregister", "POST", { installationId: secondId })).status).toBe(200);
    expect(db.prepare("SELECT active FROM push_devices WHERE installation_id=?").get(secondId)?.active).toBe(0);
  });

  it("rejects non-Android and malformed token registrations and keeps admin delivery data private", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect((await request("/devices/register", "POST", { installationId: id, token: "not-a-token", platform: "android" })).status).toBe(400);
    expect((await request("/devices/register", "POST", { installationId: id, token: "ExpoPushToken[abcdefghijklmnopqrstuvwx]", platform: "ios" })).status).toBe(400);
    expect((await request("/ops/push-deliveries")).status).toBe(403);
    expect(db.prepare("SELECT COUNT(*) AS count FROM push_devices").get()?.count).toBe(0);
  });

  it("fetches only the authenticated user's exact notification and requires its role and scope", async () => {
    const own = await request("/provider-new?role=provider&scope=work");
    expect(own.status).toBe(200);
    expect((await own.json()).data.id).toBe("provider-new");
    expect((await request("/other-user?role=provider&scope=work")).status).toBe(404);
    expect((await request("/provider-new?role=provider&scope=service")).status).toBe(404);
  });

  it("keeps service events in their own feed and scopes read-all to that feed", async () => {
    const response = await request("/?role=provider&scope=service");
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([
      "service-request",
    ]);
    expect(data.unreadCount).toBe(1);

    expect(
      (await request("/read-all?role=provider&scope=service", "POST")).status,
    ).toBe(200);
    expect(
      db.prepare("SELECT read FROM notifications WHERE id = 'service-request'").get()?.read,
    ).toBe(1);
    expect(
      db.prepare("SELECT read FROM notifications WHERE id = 'service-prefix-lookalike'").get()?.read,
    ).toBe(0);
    expect(
      db.prepare("SELECT read FROM notifications WHERE id = 'provider-new'").get()?.read,
    ).toBe(0);
  });

  it("rejects absent or invalid roles instead of returning a combined inbox", async () => {
    for (const suffix of ["", "?role=admin"]) {
      expect((await request(`/${suffix}`)).status).toBe(400);
      expect((await request(`/read-all${suffix}`, "POST")).status).toBe(400);
      expect((await request(`/provider-new${suffix}`, "DELETE")).status).toBe(
        400,
      );
    }
  });

  it("rejects expired sessions", async () => {
    vi.mocked(findActiveSession).mockResolvedValue(null);
    expect((await request("/?role=provider")).status).toBe(401);
    expect(
      (await request("/provider-new?role=provider", "DELETE")).status,
    ).toBe(401);
  });
});

describe("mobile notification response verification", () => {
  it("rejects the old deployed API's combined inbox even when the request had a role", () => {
    const oldResponse = {
      items: [{ id: "provider-item", type: "APPLICATION_CREATED" }],
      unreadCount: 1,
    };
    for (const role of ["provider", "seeker"] as const) {
      expect(() => validateNotificationInbox(oldResponse, role)).toThrow();
    }
  });

  it("rejects cached responses for the other role and mixed notification items", () => {
    expect(() =>
      validateNotificationInbox(
        { role: "provider", items: [], unreadCount: 0 },
        "seeker",
      ),
    ).toThrow();
    expect(() =>
      validateNotificationInbox(
        {
          role: "seeker",
          items: [{ recipientRole: "provider" }],
          unreadCount: 1,
        },
        "seeker",
      ),
    ).toThrow();
  });

  it("filters an older unscoped API response before it reaches a product feed", () => {
    const legacyResponse = {
      role: "provider",
      items: [
        {
          id: "service-request",
          recipientRole: "provider",
          type: "SERVICE_REQUEST",
          title: "New service request",
          message: "Test",
          createdAt: 1,
          read: false,
        },
        {
          id: "job-application",
          recipientRole: "provider",
          type: "APPLICATION_CREATED",
          title: "New application",
          message: "Test",
          createdAt: 2,
          read: false,
        },
      ],
      unreadCount: 2,
    };

    const serviceInbox = validateNotificationInbox(
      legacyResponse,
      "provider",
      "service",
    );
    expect(serviceInbox.scopeVerified).toBe(false);
    expect(serviceInbox.items.map((item) => item.id)).toEqual([
      "service-request",
    ]);
    expect(serviceInbox.unreadCount).toBe(1);
  });

  it.each(["provider", "seeker"] as const)(
    "accepts an explicitly verified %s inbox",
    (role) => {
      const response = {
        role,
        items: [{
          id: "only-this-role",
          recipientRole: role,
          type: "APPLICATION_CREATED",
          title: "Update",
          message: "Test",
          createdAt: 1,
          read: false,
        }],
        unreadCount: 1,
      };
      expect(validateNotificationInbox(response, role)).toMatchObject(response);
    },
  );
});
