import { describe, it, expect } from "vitest";
import { transition, distanceKm, boundingBox, jobSchema, searchSchema, formatDirectPhone } from "@bulao/domain";
import { chooseMap } from "../src/providers/maps/policy";
describe("interaction permissions", () => {
  it("allows only the owner to accept or start", () => {
    expect(transition("PENDING", "accept", "owner")).toBe("ACCEPTED");
    expect(() => transition("PENDING", "accept", "worker")).toThrow();
    expect(() => transition("ACCEPTED", "start", "worker")).toThrow();
  });
  it("allows owner to re-accept a previously rejected application", () => {
    expect(transition("REJECTED", "accept", "owner")).toBe("ACCEPTED");
  });
  it("allows seeker and provider cancellations with proper attribution", () => {
    expect(transition("ACCEPTED", "cancel", "worker")).toBe("CANCELLED_BY_SEEKER");
    expect(transition("ACCEPTED", "cancel", "owner")).toBe("CANCELLED_BY_PROVIDER");
    expect(transition("PENDING", "withdraw", "worker")).toBe("CANCELLED_BY_SEEKER");
    expect(transition("PENDING", "cancel", "worker")).toBe("CANCELLED_BY_SEEKER");
    expect(transition("PENDING", "cancel", "owner")).toBe("CANCELLED_BY_PROVIDER");
  });
  it("does not complete on one confirmation or reopen completion", () => {
    expect(transition("IN_PROGRESS", "confirm", "owner")).toBe("IN_PROGRESS");
    expect(() => transition("COMPLETED", "start", "owner")).toThrow();
    expect(() => transition("PENDING", "confirm", "owner")).toThrow();
  });
});
describe("geography", () => {
  it("handles equal coordinates and the date line", () => {
    expect(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }),
    ).toBe(0);
    expect(
      distanceKm(
        { latitude: 0, longitude: 179.99 },
        { latitude: 0, longitude: -179.99 },
      ),
    ).toBeLessThan(3);
    const box = boundingBox(0, 179.99, 5);
    expect(box.minLon).toBeGreaterThan(box.maxLon);
  });
  it("handles the poles", () =>
    expect(boundingBox(90, 0, 5).allLongitudes).toBe(true));
});
describe("maps budget policy", () => {
  const policy = {
    primary: "google",
    fallback: "maplibre",
    fallbackEnabled: true,
    safetyFraction: 0.8,
    maxAgeMs: 1000,
  } as const;
  it("switches before the ceiling and fails closed on stale telemetry", () => {
    const value = {
      enabled: true,
      healthy: true,
      used: 80,
      limit: 100,
      observedAt: 1000,
    };
    expect(
      chooseMap(
        policy,
        { google: value, maplibre: { ...value, used: 0 } },
        1500,
      ),
    ).toBe("maplibre");
    expect(chooseMap(policy, { google: value }, 3000)).toBe(null);
    expect(chooseMap(policy, {}, 1500)).toBe(null);
  });
});
it("rejects invalid money, coordinates and worker count", () => {
  expect(
    jobSchema.safeParse({
      latitude: 100,
      longitude: 0,
      workers: 0,
      payPaise: -1,
    }).success,
  ).toBe(false);
});

describe("searchSchema validation & boundary enforcement", () => {
  it("defaults radius to 5 km and enforces max 50 km", () => {
    const defaultSearch = searchSchema.parse({
      latitude: 17.385,
      longitude: 78.486,
    });
    expect(defaultSearch.radiusKm).toBe(5);

    const maxSearch = searchSchema.parse({
      latitude: 17.385,
      longitude: 78.486,
      radiusKm: 50,
    });
    expect(maxSearch.radiusKm).toBe(50);

    // Rejects radius > 50
    expect(() =>
      searchSchema.parse({
        latitude: 17.385,
        longitude: 78.486,
        radiusKm: 50.01,
      }),
    ).toThrow();

    expect(() =>
      searchSchema.parse({
        latitude: 17.385,
        longitude: 78.486,
        radiusKm: 1000,
      }),
    ).toThrow();

    // Rejects radius < 1
    expect(() =>
      searchSchema.parse({
        latitude: 17.385,
        longitude: 78.486,
        radiusKm: 0,
      }),
    ).toThrow();
  });

  it("accurately tests 4.99, 5.00, 5.01 km and 49.99, 50.00, 50.01 km boundaries", () => {
    const origin = { latitude: 17.385044, longitude: 78.486671 };
    // 1 deg latitude is approx 111.195 km
    const kmPerDegreeLat = (Math.PI * 6371) / 180;

    const p4_99 = {
      latitude: origin.latitude + 4.99 / kmPerDegreeLat,
      longitude: origin.longitude,
    };
    const p5_00 = {
      latitude: origin.latitude + 5.0 / kmPerDegreeLat,
      longitude: origin.longitude,
    };
    const p5_01 = {
      latitude: origin.latitude + 5.01 / kmPerDegreeLat,
      longitude: origin.longitude,
    };

    const d4_99 = distanceKm(origin, p4_99);
    const d5_00 = distanceKm(origin, p5_00);
    const d5_01 = distanceKm(origin, p5_01);

    expect(d4_99).toBeLessThan(5.0);
    expect(Math.abs(d5_00 - 5.0)).toBeLessThan(0.001);
    expect(d5_01).toBeGreaterThan(5.0);

    // Nearest to farthest order
    expect(d4_99).toBeLessThan(d5_00);
    expect(d5_00).toBeLessThan(d5_01);

    // 50 km boundary checks
    const p49_99 = {
      latitude: origin.latitude + 49.99 / kmPerDegreeLat,
      longitude: origin.longitude,
    };
    const p50_00 = {
      latitude: origin.latitude + 50.0 / kmPerDegreeLat,
      longitude: origin.longitude,
    };
    const p50_01 = {
      latitude: origin.latitude + 50.01 / kmPerDegreeLat,
      longitude: origin.longitude,
    };

    const d49_99 = distanceKm(origin, p49_99);
    const d50_00 = distanceKm(origin, p50_00);
    const d50_01 = distanceKm(origin, p50_01);

    expect(d49_99).toBeLessThan(50.0);
    expect(Math.abs(d50_00 - 50.0)).toBeLessThan(0.001);
    expect(d50_01).toBeGreaterThan(50.0);

    // Nearest to farthest order
    expect(d49_99).toBeLessThan(d50_00);
    expect(d50_00).toBeLessThan(d50_01);
  });
});

describe("direct phone formatting without country code", () => {
  it("strips country code 91 from 12-digit Indian numbers", () => {
    expect(formatDirectPhone("917569408235")).toBe("7569408235");
    expect(formatDirectPhone("+917569408235")).toBe("7569408235");
    expect(formatDirectPhone("+91 75694 08235")).toBe("7569408235");
    expect(formatDirectPhone("+91-7569408235")).toBe("7569408235");
  });

  it("handles leading zero and 10-digit numbers directly", () => {
    expect(formatDirectPhone("07569408235")).toBe("7569408235");
    expect(formatDirectPhone("7569408235")).toBe("7569408235");
  });

  it("handles null, undefined, or empty values gracefully", () => {
    expect(formatDirectPhone(null)).toBe("");
    expect(formatDirectPhone(undefined)).toBe("");
    expect(formatDirectPhone("")).toBe("");
  });
});

