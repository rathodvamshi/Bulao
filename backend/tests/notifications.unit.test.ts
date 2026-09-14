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
  const request = (path: string, method = "GET") =>
    app.request(
      path,
      {
        method,
        headers: { Authorization: "Bearer test-session" },
      },
      {
        DB: {
          prepare: (sql: string) => ({
            bind: (...args: (string | number)[]) => ({
              all: async () => ({ results: db.prepare(sql).all(...args) }),
              first: async () => db.prepare(sql).get(...args),
              run: async () => db.prepare(sql).run(...args),
            }),
          }),
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
    ]);
    expect(await ids("seeker")).toEqual([
      "malformed",
      "seeker-completed",
      "seeker-legacy",
      "seeker-new",
    ]);
    expect((await inbox("provider")).unreadCount).toBe(3);
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
      ).toBe(role === "provider" ? 4 : 3);
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
    expect((await inbox("provider")).unreadCount).toBe(2);
    await request("/provider-new/unread?role=provider", "POST");
    expect((await inbox("provider")).unreadCount).toBe(3);
    await request("/provider-new?role=provider", "DELETE");
    expect(await ids("provider")).not.toContain("provider-new");
    expect((await inbox("seeker")).unreadCount).toBe(4);
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

  it.each(["provider", "seeker"] as const)(
    "accepts an explicitly verified %s inbox",
    (role) => {
      const response = {
        role,
        items: [{ id: "only-this-role", recipientRole: role }],
        unreadCount: 1,
      };
      expect(validateNotificationInbox(response, role)).toBe(response);
    },
  );
});
