import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../migrations/0031_job_completion_disputes.sql", import.meta.url), "utf8");

describe("job completion dispute migration", () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  it("records a rejection, notifies the other party, and allows a clean resubmission", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);
      CREATE TABLE jobs(id TEXT PRIMARY KEY,workers INTEGER NOT NULL);
      CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT,title TEXT,message TEXT,data TEXT,read INTEGER,created_at INTEGER);
      CREATE TABLE interactions(
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, job_id TEXT, service_id TEXT,
        owner_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL,
        owner_confirmed_at INTEGER, worker_confirmed_at INTEGER,
        accepted_at INTEGER, created_at INTEGER
      );
    `);
    db.exec(migration);
    db.exec(`INSERT INTO users VALUES ('provider','Provider'),('seeker','Seeker'); INSERT INTO jobs VALUES ('job',1);`);
    db.exec(`INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,owner_confirmed_at,created_at)
      VALUES ('interaction','job','job','provider','seeker','IN_PROGRESS',100,90);`);

    db.prepare(`UPDATE interactions SET completion_rejected_at=200,completion_rejected_by='seeker',
      completion_rejection_reason='Work is still unfinished',owner_confirmed_at=NULL WHERE id='interaction'`).run();
    expect(db.prepare("SELECT completion_rejected_by,owner_confirmed_at FROM interactions WHERE id='interaction'").get())
      .toEqual({ completion_rejected_by: "seeker", owner_confirmed_at: null });
    const providerNotification = db.prepare("SELECT user_id,type,data FROM notifications").get() as { user_id: string; type: string; data: string };
    expect(providerNotification).toMatchObject({ user_id: "provider", type: "JOB_COMPLETION_REJECTED" });
    expect(JSON.parse(providerNotification.data).recipientRole).toBe("provider");

    db.prepare(`UPDATE interactions SET owner_confirmed_at=300,completion_rejected_at=NULL,
      completion_rejected_by=NULL,completion_rejection_reason=NULL WHERE id='interaction'`).run();
    db.prepare(`UPDATE interactions SET worker_confirmed_at=400,status='COMPLETED' WHERE id='interaction'`).run();
    expect(db.prepare("SELECT status,completion_rejected_at FROM interactions WHERE id='interaction'").get())
      .toEqual({ status: "COMPLETED", completion_rejected_at: null });

    db.exec(`INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,worker_confirmed_at,created_at)
      VALUES ('reverse','job','job','provider','seeker','IN_PROGRESS',500,90);`);
    db.prepare(`UPDATE interactions SET completion_rejected_at=600,completion_rejected_by='provider',
      completion_rejection_reason='Please finish the remaining work',worker_confirmed_at=NULL WHERE id='reverse'`).run();
    const seekerNotification = db.prepare("SELECT user_id,type,data FROM notifications WHERE data LIKE '%reverse%'").get() as { user_id: string; type: string; data: string };
    expect(seekerNotification).toMatchObject({ user_id: "seeker", type: "JOB_COMPLETION_REJECTED" });
    expect(JSON.parse(seekerNotification.data).recipientRole).toBe("seeker");
  });

  it("rejects completion without both confirmations and prevents status completion while disputed", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);
      CREATE TABLE jobs(id TEXT PRIMARY KEY,workers INTEGER NOT NULL);
      CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT,type TEXT,title TEXT,message TEXT,data TEXT,read INTEGER,created_at INTEGER);
      CREATE TABLE interactions(id TEXT PRIMARY KEY,kind TEXT,job_id TEXT,service_id TEXT,owner_id TEXT,worker_id TEXT,status TEXT,
        owner_confirmed_at INTEGER,worker_confirmed_at INTEGER,accepted_at INTEGER,created_at INTEGER);
    `);
    db.exec(migration);
    db.exec(`INSERT INTO users VALUES ('provider','Provider'),('seeker','Seeker'); INSERT INTO jobs VALUES ('job',1);
      INSERT INTO interactions(id,kind,job_id,owner_id,worker_id,status,owner_confirmed_at,completion_rejected_at,created_at)
      VALUES ('interaction','job','job','provider','seeker','IN_PROGRESS',100,200,90);`);
    expect(() => db.prepare("UPDATE interactions SET status='COMPLETED',worker_confirmed_at=300 WHERE id='interaction'").run())
      .toThrow(/COMPLETION_REQUIRED/);
    expect(() => db.prepare("UPDATE interactions SET owner_confirmed_at=NULL WHERE id='interaction'").run())
      .toThrow(/IMMUTABLE_CONFIRMATION/);
  });
});
