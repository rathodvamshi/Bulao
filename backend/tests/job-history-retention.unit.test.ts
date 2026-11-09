import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { deleteJobAndPurgeRelations } from "../src/modules/jobs/routes";

describe("Job History, Reputation and Metrics Retention", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");

    // Initialize required tables
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        area TEXT NOT NULL DEFAULT '',
        suspended INTEGER NOT NULL DEFAULT 0,
        photo_url TEXT,
        created_at INTEGER NOT NULL,
        phone_verified INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL
      );

      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '👤'
      );

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        area TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER,
        duration TEXT NOT NULL DEFAULT 'one',
        hours TEXT NOT NULL DEFAULT 'full',
        start_time TEXT NOT NULL DEFAULT '09:00',
        end_time TEXT NOT NULL DEFAULT '17:00',
        workers INTEGER NOT NULL,
        pay_paise INTEGER NOT NULL,
        pay_unit TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'PUBLISHED',
        archived_at INTEGER,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE interactions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        job_id TEXT,
        service_id TEXT,
        owner_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        owner_confirmed_at INTEGER,
        worker_confirmed_at INTEGER,
        area TEXT,
        latitude REAL,
        longitude REAL,
        scheduled_at INTEGER,
        details TEXT NOT NULL DEFAULT '',
        cancelled_by TEXT,
        cancellation_reason TEXT,
        cancelled_at INTEGER,
        accepted_at INTEGER,
        rejected_at INTEGER,
        job_title_snapshot TEXT,
        role_name_snapshot TEXT,
        pay_paise_snapshot INTEGER,
        pay_unit_snapshot TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE reviews (
        id TEXT PRIMARY KEY,
        interaction_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        stars INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE service_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        area TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE service_ratings (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        stars INTEGER NOT NULL,
        feedback TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // Seed users, category, role
    db.exec(`
      INSERT INTO users (id, phone, name, area, created_at) VALUES
        ('provider-1', '919876543210', 'Ramesh Builder', 'Madhapur', 1000),
        ('seeker-1', '919876543211', 'Suresh Painter', 'Kondapur', 1000),
        ('seeker-2', '919876543212', 'Mahesh Helper', 'Hitec City', 1000);

      INSERT INTO categories (id, kind, name, icon) VALUES
        ('construction', 'job', 'Construction', '🏗️');

      INSERT INTO roles (id, category_id, name, icon) VALUES
        ('painter', 'construction', 'Wall Painter', '🎨');
    `);
  });

  afterEach(() => {
    db.close();
  });

  // Mock D1Database wrapper around node:sqlite DatabaseSync
  function createD1Mock(): any {
    return {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          first: async () => db.prepare(sql).get(...args) || null,
          run: async () => {
            db.prepare(sql).run(...args);
            return { success: true };
          },
        }),
      }),
      batch: async (statements: any[]) => {
        for (const stmt of statements) {
          // If statement object has execute or run
        }
      },
    };
  }

  it("safely archives deleted job without deleting reviews, completed work, or dropping metrics", async () => {
    const d1 = createD1Mock();

    // 1. Post a job
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, workers, pay_paise, pay_unit, title, details, status, created_at)
      VALUES ('job-1', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, 2000, 2, 80000, 'day', 'Interior Wall Painting', 'Full flat paint', 'PUBLISHED', 1000);
    `);

    // 2. Seeker 1 applies, accepted, completes work
    db.exec(`
      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, owner_confirmed_at, worker_confirmed_at, accepted_at, created_at)
      VALUES ('int-1', 'job', 'job-1', 'provider-1', 'seeker-1', 'COMPLETED', 1500, 1500, 1100, 1050);
    `);

    // 3. Both parties review each other
    db.exec(`
      INSERT INTO reviews (id, interaction_id, author_id, target_id, stars, body, created_at)
      VALUES 
        ('rev-1', 'int-1', 'seeker-1', 'provider-1', 5, 'Great employer, on-time payment!', 1600),
        ('rev-2', 'int-1', 'provider-1', 'seeker-1', 5, 'Excellent paint finish, highly recommended!', 1600);
    `);

    // 4. Seeker 2 has a pending application
    db.exec(`
      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, created_at)
      VALUES ('int-2', 'job', 'job-1', 'provider-1', 'seeker-2', 'PENDING', 1200);
    `);

    // Provider baseline metrics before deletion
    const baselineJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE owner_id='provider-1'").get() as any;
    const baselineHires = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE owner_id='provider-1' AND status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')").get() as any;
    const baselineCompleted = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE owner_id='provider-1' AND status='COMPLETED'").get() as any;
    const baselineReviews = db.prepare("SELECT COUNT(*) as count, AVG(stars) as avgStars FROM reviews WHERE target_id='provider-1'").get() as any;

    expect(baselineJobs.count).toBe(1);
    expect(baselineHires.count).toBe(1);
    expect(baselineCompleted.count).toBe(1);
    expect(baselineReviews.count).toBe(1);
    expect(baselineReviews.avgStars).toBe(5);

    // Seeker baseline metrics before deletion
    const seekerBaselineCompleted = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE worker_id='seeker-1' AND status='COMPLETED'").get() as any;
    const seekerBaselineReviews = db.prepare("SELECT COUNT(*) as count, AVG(stars) as avgStars FROM reviews WHERE target_id='seeker-1'").get() as any;
    expect(seekerBaselineCompleted.count).toBe(1);
    expect(seekerBaselineReviews.count).toBe(1);

    // 5. Provider deletes the job
    const result = await deleteJobAndPurgeRelations(d1, "job-1", "provider-1");
    expect(result.deleted).toBe(true);

    // 6. VERIFY: Job record is NOT removed from database; it is marked DELETED with deleted_at timestamp
    const jobRow = db.prepare("SELECT * FROM jobs WHERE id='job-1'").get() as any;
    expect(jobRow).toBeDefined();
    expect(jobRow.status).toBe("DELETED");
    expect(jobRow.deleted_at).toBeGreaterThan(0);

    // 7. VERIFY: Completed interaction is NOT deleted and has immutable snapshot preserved
    const completedInt = db.prepare("SELECT * FROM interactions WHERE id='int-1'").get() as any;
    expect(completedInt).toBeDefined();
    expect(completedInt.status).toBe("COMPLETED");
    expect(completedInt.job_title_snapshot).toBe("Interior Wall Painting");
    expect(completedInt.role_name_snapshot).toBe("Wall Painter");
    expect(completedInt.pay_paise_snapshot).toBe(80000);
    expect(completedInt.pay_unit_snapshot).toBe("day");

    // 8. VERIFY: Pending interaction was cancelled with clear reason
    const pendingInt = db.prepare("SELECT * FROM interactions WHERE id='int-2'").get() as any;
    expect(pendingInt).toBeDefined();
    expect(pendingInt.status).toBe("CANCELLED");
    expect(pendingInt.cancellation_reason).toBe("Job closed by employer");

    // 9. VERIFY: All reviews are 100% retained and neither provider nor seeker ratings dropped!
    const reviewsAfter = db.prepare("SELECT * FROM reviews WHERE interaction_id='int-1'").all() as any[];
    expect(reviewsAfter.length).toBe(2);

    // Provider metrics AFTER deletion: Total jobs, Hired, Completed, and Rating NEVER drop
    const afterJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE owner_id='provider-1'").get() as any;
    const afterActiveJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE owner_id='provider-1' AND status='PUBLISHED'").get() as any;
    const afterHires = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE owner_id='provider-1' AND status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')").get() as any;
    const afterCompleted = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE owner_id='provider-1' AND status='COMPLETED'").get() as any;
    const afterReviews = db.prepare("SELECT COUNT(*) as count, AVG(stars) as avgStars FROM reviews WHERE target_id='provider-1'").get() as any;

    expect(afterJobs.count).toBe(1); // Lifetime postings count preserved!
    expect(afterActiveJobs.count).toBe(0); // Active count correctly drops from 1 to 0
    expect(afterHires.count).toBe(1); // Workers hired count preserved!
    expect(afterCompleted.count).toBe(1); // Completed jobs count preserved!
    expect(afterReviews.count).toBe(1); // Review count preserved!
    expect(afterReviews.avgStars).toBe(5); // Rating average preserved!

    // Seeker metrics AFTER deletion: Completed jobs count and reviews NEVER drop
    const seekerAfterCompleted = db.prepare("SELECT COUNT(*) as count FROM interactions WHERE worker_id='seeker-1' AND status='COMPLETED'").get() as any;
    const seekerAfterReviews = db.prepare("SELECT COUNT(*) as count, AVG(stars) as avgStars FROM reviews WHERE target_id='seeker-1'").get() as any;
    expect(seekerAfterCompleted.count).toBe(1);
    expect(seekerAfterReviews.count).toBe(1);
    expect(seekerAfterReviews.avgStars).toBe(5);
  });

  it("returns top 15 recent completed jobs in history queries with title snapshot fallback", () => {
    // Insert 20 completed interactions for seeker-1 to verify top 15 limit and order
    for (let i = 1; i <= 20; i++) {
      db.prepare(`
        INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, job_title_snapshot, role_name_snapshot, pay_paise_snapshot, pay_unit_snapshot, worker_confirmed_at, created_at)
        VALUES (?, 'job', NULL, 'provider-1', 'seeker-1', 'COMPLETED', ?, 'Painter', 50000, 'day', ?, ?)
      `).run(`history-int-${i}`, `Completed Job #${i}`, 2000 + i * 10, 1000 + i * 10);
    }

    const historyTop15 = db.prepare(`
      SELECT id, job_title_snapshot AS title, worker_confirmed_at AS completedAt
      FROM interactions
      WHERE worker_id = 'seeker-1' AND kind = 'job' AND status = 'COMPLETED'
      ORDER BY worker_confirmed_at DESC
      LIMIT 15 OFFSET 0
    `).all() as any[];

    expect(historyTop15.length).toBe(15);
    // Newest should be Job #20
    expect(historyTop15[0].title).toBe("Completed Job #20");
    // 15th item should be Job #6
    expect(historyTop15[14].title).toBe("Completed Job #6");

    // Second page / load more (remaining 5)
    const historyNext = db.prepare(`
      SELECT id, job_title_snapshot AS title, worker_confirmed_at AS completedAt
      FROM interactions
      WHERE worker_id = 'seeker-1' AND kind = 'job' AND status = 'COMPLETED'
      ORDER BY worker_confirmed_at DESC
      LIMIT 15 OFFSET 15
    `).all() as any[];

    expect(historyNext.length).toBe(5);
    expect(historyNext[0].title).toBe("Completed Job #5");
    expect(historyNext[4].title).toBe("Completed Job #1");
  });

  it("strictly separates worker reputation and employer reputation, never crediting an author with their own review", () => {
    // Scenario:
    // provider-1 hires seeker-1 for a job.
    // Interaction is COMPLETED with both confirmations.
    // Seeker-1 rates provider-1 (4 stars, "Good employer") -> Employer review
    // Provider-1 rates seeker-1 (5 stars, "Skilled painter") -> Worker review
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, workers, pay_paise, pay_unit, title, details, status, created_at)
      VALUES ('job-sep-1', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, 2000, 1, 80000, 'day', 'Interior Painting', '', 'PUBLISHED', 1000);

      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, owner_confirmed_at, worker_confirmed_at, accepted_at, created_at)
      VALUES ('int-sep-1', 'job', 'job-sep-1', 'provider-1', 'seeker-1', 'COMPLETED', 1500, 1500, 1100, 1050);

      INSERT INTO reviews (id, interaction_id, author_id, target_id, stars, body, created_at)
      VALUES
        ('rev-employer-recvd', 'int-sep-1', 'seeker-1', 'provider-1', 4, 'Good employer, pays fairly.', 1600),
        ('rev-worker-recvd', 'int-sep-1', 'provider-1', 'seeker-1', 5, 'Skilled painter, worked fast.', 1600);
    `);

    // 1. Check Seeker's Worker Reputation (Reviews providers gave seekers for completed jobs)
    const seekerReputation = db.prepare(`
      SELECT ROUND(AVG(r.stars),1) AS rating, COUNT(r.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN r.stars=4 THEN 1 ELSE 0 END), 0) AS stars4,
        COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
      FROM reviews r JOIN interactions i ON i.id=r.interaction_id
      WHERE r.target_id='seeker-1' AND i.kind='job' AND i.worker_id='seeker-1' AND i.owner_id=r.author_id
        AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
    `).get() as any;

    expect(seekerReputation.rating).toBe(5);
    expect(seekerReputation.totalReviews).toBe(1);
    expect(seekerReputation.stars5).toBe(1);
    expect(seekerReputation.stars4).toBe(0); // 4-star given to provider is NOT counted on seeker!
    expect(seekerReputation.totalFeedback).toBe(1);

    // 2. Check Provider's Employer Reputation (Reviews seekers gave providers for completed jobs)
    const providerReputation = db.prepare(`
      SELECT ROUND(AVG(r.stars),1) AS rating, COUNT(r.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN r.stars=4 THEN 1 ELSE 0 END), 0) AS stars4,
        COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
      FROM reviews r JOIN interactions i ON i.id=r.interaction_id
      WHERE r.target_id='provider-1' AND i.kind='job' AND i.owner_id='provider-1' AND i.worker_id=r.author_id
        AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
    `).get() as any;

    expect(providerReputation.rating).toBe(4);
    expect(providerReputation.totalReviews).toBe(1);
    expect(providerReputation.stars4).toBe(1);
    expect(providerReputation.stars5).toBe(0); // 5-star given to seeker is NOT counted on provider!
    expect(providerReputation.totalFeedback).toBe(1);

    // 3. Verify reviews feed matches recipient only
    const seekerReviews = db.prepare(`
      SELECT r.id, r.stars, r.author_id, r.target_id, r.body
      FROM reviews r JOIN interactions i ON i.id=r.interaction_id
      WHERE r.target_id='seeker-1' AND i.kind='job' AND i.worker_id='seeker-1' AND i.owner_id=r.author_id
    `).all() as any[];
    expect(seekerReviews.length).toBe(1);
    expect(seekerReviews[0].id).toBe('rev-worker-recvd');
    expect(seekerReviews[0].stars).toBe(5);

    const providerReviews = db.prepare(`
      SELECT r.id, r.stars, r.author_id, r.target_id, r.body
      FROM reviews r JOIN interactions i ON i.id=r.interaction_id
      WHERE r.target_id='provider-1' AND i.kind='job' AND i.owner_id='provider-1' AND i.worker_id=r.author_id
    `).all() as any[];
    expect(providerReviews.length).toBe(1);
    expect(providerReviews[0].id).toBe('rev-employer-recvd');
    expect(providerReviews[0].stars).toBe(4);
  });

  it("strictly isolates service-provider ratings from job employer ratings and never blends them", () => {
    // Provider-1 has:
    // 1. One job employer review (3 stars)
    // 2. One customer service rating (5 stars)
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, workers, pay_paise, pay_unit, title, details, status, created_at)
      VALUES ('job-srv-1', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, 2000, 1, 80000, 'day', 'Site Work', '', 'PUBLISHED', 1000);

      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, owner_confirmed_at, worker_confirmed_at, accepted_at, created_at)
      VALUES ('int-srv-1', 'job', 'job-srv-1', 'provider-1', 'seeker-2', 'COMPLETED', 1500, 1500, 1100, 1050);

      INSERT INTO reviews (id, interaction_id, author_id, target_id, stars, body, created_at)
      VALUES ('rev-job-emp', 'int-srv-1', 'seeker-2', 'provider-1', 3, 'Average job experience', 1600);

      INSERT INTO service_profiles (id, user_id, category_id, area, created_at)
      VALUES ('sp-1', 'provider-1', 'construction', 'Madhapur', 1000);

      INSERT INTO service_ratings (id, service_id, provider_id, customer_id, stars, feedback, created_at)
      VALUES ('sr-1', 'sp-1', 'provider-1', 'seeker-1', 5, 'Super service, five stars!', 1700);
    `);

    // Employer Job Reputation Query: MUST BE EXACTLY 3 STARS, 1 review (NOT blended with 5-star service rating!)
    const employerJobReputation = db.prepare(`
      SELECT ROUND(AVG(r.stars), 1) AS rating, COUNT(r.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN r.stars=3 THEN 1 ELSE 0 END), 0) AS stars3
      FROM reviews r
      JOIN interactions i ON i.id = r.interaction_id
      WHERE r.target_id='provider-1' AND i.kind='job' AND i.owner_id='provider-1' AND i.worker_id=r.author_id
        AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
    `).get() as any;

    expect(employerJobReputation.rating).toBe(3);
    expect(employerJobReputation.totalReviews).toBe(1);
    expect(employerJobReputation.stars3).toBe(1);
    expect(employerJobReputation.stars5).toBe(0); // Never blended!

    // Service Reputation Query: MUST BE EXACTLY 5 STARS, 1 review (kept in its own source)
    const serviceReputation = db.prepare(`
      SELECT ROUND(AVG(sr.stars), 1) AS rating, COUNT(sr.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN sr.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN sr.stars=3 THEN 1 ELSE 0 END), 0) AS stars3
      FROM service_ratings sr
      WHERE sr.provider_id='provider-1'
    `).get() as any;

    expect(serviceReputation.rating).toBe(5);
    expect(serviceReputation.totalReviews).toBe(1);
    expect(serviceReputation.stars5).toBe(1);
    expect(serviceReputation.stars3).toBe(0); // Never blended!
  });

  it("correctly reports null rating and 0 counts for empty reputation states without default 5 stars", () => {
    // User with no reviews at all
    db.exec(`
      INSERT INTO users (id, phone, name, area, created_at)
      VALUES ('new-user', '919876543299', 'New Person', 'Gachibowli', 1000);
    `);

    const emptyWorkerReputation = db.prepare(`
      SELECT ROUND(AVG(r.stars), 1) AS rating, COUNT(r.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
      FROM reviews r
      JOIN interactions i ON i.id = r.interaction_id
      WHERE r.target_id='new-user' AND i.kind='job' AND i.worker_id='new-user' AND i.owner_id=r.author_id
        AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
    `).get() as any;

    expect(emptyWorkerReputation.rating).toBeNull();
    expect(emptyWorkerReputation.totalReviews).toBe(0);
    expect(emptyWorkerReputation.stars5).toBe(0);
    expect(emptyWorkerReputation.totalFeedback).toBe(0);

    const emptyEmployerReputation = db.prepare(`
      SELECT ROUND(AVG(r.stars), 1) AS rating, COUNT(r.id) AS totalReviews,
        COALESCE(SUM(CASE WHEN r.stars=5 THEN 1 ELSE 0 END), 0) AS stars5,
        COALESCE(SUM(CASE WHEN TRIM(COALESCE(r.body,''))<>'' THEN 1 ELSE 0 END), 0) AS totalFeedback
      FROM reviews r
      JOIN interactions i ON i.id = r.interaction_id
      WHERE r.target_id='new-user' AND i.kind='job' AND i.owner_id='new-user' AND i.worker_id=r.author_id
        AND i.status='COMPLETED' AND i.owner_confirmed_at IS NOT NULL AND i.worker_confirmed_at IS NOT NULL
    `).get() as any;

    expect(emptyEmployerReputation.rating).toBeNull();
    expect(emptyEmployerReputation.totalReviews).toBe(0);
    expect(emptyEmployerReputation.stars5).toBe(0);
    expect(emptyEmployerReputation.totalFeedback).toBe(0);
  });

  it("returns only active jobs with open spots, excluding filled, expired, paused, and deleted jobs", () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Job 1: Published, ongoing, 2 workers needed, 0 hired -> ACTIVE (2 spots left)
    // Job 2: Published, started recently, 1 worker needed, 1 hired -> FILLED (0 spots left -> EXCLUDED)
    // Job 3: PAUSED -> EXCLUDED
    // Job 4: DELETED -> EXCLUDED
    // Job 5: Published, ended 10 days ago (expired) -> EXCLUDED
    // Job 6: Published, starts tomorrow, 3 workers needed, 1 hired -> ACTIVE (2 spots left)
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, ends_at, duration, workers, pay_paise, pay_unit, title, details, status, deleted_at, archived_at, created_at)
      VALUES
        ('job-act-1', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec - 1000}, NULL, 'ongoing', 2, 90000, 'day', 'Active Wall Painting', '', 'PUBLISHED', NULL, NULL, ${nowSec - 2000}),
        ('job-fil-2', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec - 1000}, NULL, 'ongoing', 1, 80000, 'day', 'Filled Painting Job', '', 'PUBLISHED', NULL, NULL, ${nowSec - 2000}),
        ('job-pau-3', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec + 1000}, NULL, 'ongoing', 2, 80000, 'day', 'Paused Job', '', 'PAUSED', NULL, NULL, ${nowSec - 2000}),
        ('job-del-4', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec + 1000}, NULL, 'ongoing', 2, 80000, 'day', 'Deleted Job', '', 'DELETED', ${nowSec - 500}, NULL, ${nowSec - 2000}),
        ('job-exp-5', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec - 20 * 86400}, ${nowSec - 10 * 86400}, 'one', 2, 80000, 'day', 'Expired Job', '', 'PUBLISHED', NULL, NULL, ${nowSec - 25 * 86400}),
        ('job-act-6', 'provider-1', 'construction', 'painter', 'Kondapur', 17.46, 78.36, ${nowSec + 86400}, NULL, 'one', 3, 100000, 'day', 'Upcoming Paint Project', '', 'PUBLISHED', NULL, NULL, ${nowSec - 1000});

      -- Fill Job 2
      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, accepted_at, created_at)
      VALUES ('int-fil-2', 'job', 'job-fil-2', 'provider-1', 'seeker-1', 'ACCEPTED', ${nowSec - 500}, ${nowSec - 600});

      -- Hire 1 worker on Job 6 (2 spots remain)
      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, accepted_at, created_at)
      VALUES ('int-act-6', 'job', 'job-act-6', 'provider-1', 'seeker-2', 'ACCEPTED', ${nowSec - 500}, ${nowSec - 600});
    `);

    const activeJobs = db.prepare(`
      SELECT
        j.id,
        j.title,
        j.workers,
        (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) AS acceptedCount,
        MAX(0, j.workers - (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))) AS remainingWorkers
      FROM jobs j
      WHERE j.owner_id = 'provider-1'
        AND UPPER(j.status) = 'PUBLISHED'
        AND j.deleted_at IS NULL
        AND j.archived_at IS NULL
        AND (j.duration = 'ongoing' OR (j.ends_at IS NOT NULL AND j.ends_at >= unixepoch() - 86400) OR (j.ends_at IS NULL AND j.starts_at >= unixepoch() - 86400 * 3))
        AND (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) < j.workers
      ORDER BY j.starts_at ASC, j.created_at DESC
    `).all() as any[];

    // Must return ONLY Job 1 and Job 6!
    expect(activeJobs.length).toBe(2);
    
    const job1 = activeJobs.find(j => j.id === 'job-act-1');
    expect(job1).toBeDefined();
    expect(job1.title).toBe('Active Wall Painting');
    expect(job1.remainingWorkers).toBe(2);

    const job6 = activeJobs.find(j => j.id === 'job-act-6');
    expect(job6).toBeDefined();
    expect(job6.title).toBe('Upcoming Paint Project');
    expect(job6.remainingWorkers).toBe(2); // 3 total - 1 accepted = 2

    // Verify filled, paused, deleted, and expired jobs are completely excluded
    expect(activeJobs.some(j => j.id === 'job-fil-2')).toBe(false);
    expect(activeJobs.some(j => j.id === 'job-pau-3')).toBe(false);
    expect(activeJobs.some(j => j.id === 'job-del-4')).toBe(false);
    expect(activeJobs.some(j => j.id === 'job-exp-5')).toBe(false);
  });

  it("returns completed and expired jobs in provider history query matching activity page requirements", () => {
    const nowSec = 10000;
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, workers, pay_paise, pay_unit, title, status, created_at) VALUES
        ('job-hist-completed-1', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec}, 1, 50000, 'day', 'Completed Paint Work', 'COMPLETED', ${nowSec - 1000}),
        ('job-hist-active', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec + 1000}, 1, 50000, 'day', 'Ongoing Live Work', 'PUBLISHED', ${nowSec - 500}),
        ('job-hist-interaction-done', 'provider-1', 'construction', 'painter', 'Madhapur', 17.44, 78.38, ${nowSec - 2000}, 1, 60000, 'day', 'Work Done With Seeker', 'PUBLISHED', ${nowSec - 3000});

      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, owner_confirmed_at, worker_confirmed_at, created_at) VALUES
        ('int-hist-done', 'job', 'job-hist-interaction-done', 'provider-1', 'seeker-1', 'COMPLETED', ${nowSec - 1500}, ${nowSec - 1500}, ${nowSec - 2500});
    `);

    const historyJobs = db.prepare(`
      SELECT 
        j.id,
        j.title,
        j.status,
        (SELECT COUNT(*) FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED') AS completedCount
      FROM jobs j
      WHERE j.owner_id = 'provider-1' AND (
        UPPER(j.status) IN ('COMPLETED', 'EXPIRED')
        OR EXISTS (
          SELECT 1 FROM interactions i WHERE i.job_id=j.id AND i.kind='job' AND i.status='COMPLETED'
        )
      )
      ORDER BY j.created_at DESC
    `).all() as any[];

    // Must include both completed jobs: the one with status COMPLETED and the one with completed interactions
    expect(historyJobs.length).toBe(2);
    expect(historyJobs.some(j => j.id === 'job-hist-completed-1')).toBe(true);
    expect(historyJobs.some(j => j.id === 'job-hist-interaction-done')).toBe(true);
    // Active job must be excluded
    expect(historyJobs.some(j => j.id === 'job-hist-active')).toBe(false);
  });

  it("handles notification access for deleted jobs, ensuring seekers are told job is unavailable while owners see deleted state", () => {
    const nowSec = 20000;
    db.exec(`
      INSERT INTO jobs (id, owner_id, category_id, role_id, area, latitude, longitude, starts_at, workers, pay_paise, pay_unit, title, status, deleted_at, archived_at, created_at) VALUES
        ('job-notif-deleted', 'provider-1', 'construction', 'painter', 'Kondapur', 17.46, 78.36, ${nowSec}, 1, 40000, 'day', 'Deleted Tile Work', 'DELETED', ${nowSec - 100}, ${nowSec - 100}, ${nowSec - 2000});

      -- Cancelled interaction without completed history
      INSERT INTO interactions (id, kind, job_id, owner_id, worker_id, status, cancelled_by, cancellation_reason, created_at) VALUES
        ('int-notif-deleted', 'job', 'job-notif-deleted', 'provider-1', 'seeker-99', 'CANCELLED', 'provider-1', 'Job closed by employer', ${nowSec - 1500});
    `);

    // 1. Query for the job by owner vs non-owner
    const jobRow = db.prepare("SELECT id, owner_id, status FROM jobs WHERE id = 'job-notif-deleted'").get() as any;
    expect(jobRow).toBeDefined();
    expect(jobRow.status).toBe('DELETED');

    // For non-owner without completed history (e.g. seeker-99):
    const seekerInteraction = db.prepare(
      "SELECT id, status, accepted_at FROM interactions WHERE job_id = 'job-notif-deleted' AND worker_id = 'seeker-99'"
    ).get() as any;
    const hasWorkHistory = Boolean(seekerInteraction && (seekerInteraction.status === 'COMPLETED' || seekerInteraction.accepted_at != null));

    // Seeker cannot view the deleted job listing; must be reported as unavailable
    const isOwnerForSeeker = jobRow.owner_id === 'seeker-99';
    const isSeekerBlocked = jobRow.status === 'DELETED' && !isOwnerForSeeker && !hasWorkHistory;
    expect(isSeekerBlocked).toBe(true);

    // For owner:
    const isOwner = jobRow.owner_id === 'provider-1';
    expect(isOwner).toBe(true);
    // Owner sees status DELETED so the client displays the explicit unavailable deletion explanation
    expect(jobRow.status).toBe('DELETED');
  });
});
