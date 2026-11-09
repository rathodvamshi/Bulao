import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchAndNotifyNearbyWorkers, type JobForMatching } from "../src/modules/jobs/matcher";
import type { Env } from "../src/config/env";

describe("Nearby Job Candidate Matcher", () => {
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockEnv: Env;

  beforeEach(() => {
    mockPrepare = vi.fn();
    mockEnv = {
      DB: {
        prepare: mockPrepare,
      } as any,
      PUSH_DELIVERIES: {} as any,
    } as Env;
  });

  const testJob: JobForMatching = {
    id: "job-101",
    ownerId: "poster-001",
    categoryId: "tuition",
    roleId: "math-tutor",
    title: "10th Class Math Tutor",
    area: "Madhapur",
    latitude: 17.4483,
    longitude: 78.3915,
    payPaise: 50000,
    payUnit: "hr",
  };

  it("returns 0 if no candidates have active devices or matching signals", async () => {
    mockPrepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const count = await matchAndNotifyNearbyWorkers(testJob, mockEnv);
    expect(count).toBe(0);
  });

  it("matches and scores candidate with role profile and proximity", async () => {
    const candidateRow = {
      userId: "worker-001",
      hasCategoryProfile: 1,
      hasPastCategoryHistory: 0,
      userArea: "Madhapur",
      savedLat: 17.4500, // ~300 meters away
      savedLng: 78.3920,
    };

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT") && sql.includes("push_devices")) {
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [candidateRow] }),
        };
      }
      return {
        bind: vi.fn().mockReturnThis(),
        run: mockRun,
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
    });

    const count = await matchAndNotifyNearbyWorkers(testJob, mockEnv);
    expect(count).toBe(1);

    // Verify notification was inserted
    const insertCalls = mockPrepare.mock.calls.filter((c: any) =>
      String(c[0]).includes("INSERT INTO notifications")
    );
    expect(insertCalls.length).toBe(1);
  });

  it("skips candidate if distance is beyond 25km and has no category match", async () => {
    const farCandidate = {
      userId: "worker-far",
      hasCategoryProfile: 0,
      hasPastCategoryHistory: 0,
      userArea: "Warangal",
      savedLat: 17.9689, // ~150km away
      savedLng: 79.5941,
    };

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT") && sql.includes("push_devices")) {
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [farCandidate] }),
        };
      }
      return {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
    });

    const count = await matchAndNotifyNearbyWorkers(testJob, mockEnv);
    expect(count).toBe(0);
  });

  it("gracefully handles invalid/zero coordinates without throwing", async () => {
    const zeroCoordsJob: JobForMatching = {
      ...testJob,
      latitude: 0,
      longitude: 0,
    };

    const candidateRow = {
      userId: "worker-002",
      hasCategoryProfile: 1,
      hasPastCategoryHistory: 0,
      userArea: "Madhapur",
      savedLat: null,
      savedLng: null,
    };

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT") && sql.includes("push_devices")) {
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [candidateRow] }),
        };
      }
      return {
        bind: vi.fn().mockReturnThis(),
        run: mockRun,
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
    });

    const count = await matchAndNotifyNearbyWorkers(zeroCoordsJob, mockEnv);
    expect(count).toBe(1);
  });
});
