import { describe, it, expect } from "vitest";
import { transition, distanceKm, boundingBox, jobSchema } from "@bulao/domain";
import { chooseMap } from "../src/providers/maps/policy";
describe("interaction permissions", () => {
  it("allows only the owner to accept or start", () => {
    expect(transition("PENDING", "accept", "owner")).toBe("ACCEPTED");
    expect(() => transition("PENDING", "accept", "worker")).toThrow();
    expect(() => transition("ACCEPTED", "start", "worker")).toThrow();
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
