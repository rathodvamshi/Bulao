import { z } from "zod";
export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  area: z.string().trim().min(2).max(100),
});
export const jobSchema = locationSchema.extend({
  categoryId: z.string().min(1),
  roleId: z.string().min(1),
  startsAt: z.number().int().positive(),
  workers: z.number().int().min(1).max(100),
  payPaise: z.number().int().min(100).max(100000000),
  payUnit: z.enum(["hour", "day", "job", "month"]),
  details: z.string().trim().max(1000).default(""),
  title: z.string().trim().max(100).default(""),
  experience: z.enum(["any", "some", "expert"]).default("any"),
  address: z.string().trim().max(300).default(""),
  duration: z.enum(["one", "few", "ongoing"]).default("one"),
  endsAt: z.number().int().positive().nullable().default(null),
  hours: z.enum(["full", "custom"]).default("full"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("17:00"),
  paidWhen: z.enum(["after", "daily", "weekly", "monthly"]).default("after"),
  extras: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});
export const savedPlaceSchema = locationSchema.extend({
  label: z.string().trim().min(1).max(40),
  icon: z.enum(["home", "storefront", "business", "location"]).default("location"),
  address: z.string().trim().max(300).default(""),
});
export const serviceSchema = locationSchema.extend({
  categoryId: z.string().min(1),
  radiusKm: z.number().min(1).max(50),
  experience: z.number().int().min(0).max(70),
  available: z.boolean(),
});
export const searchSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(50).default(5),
  categoryId: z.string().optional(),
  categoryIds: z.string().max(500).transform(value => value.split(",")).pipe(z.array(z.string().min(1).max(100)).min(1).max(5)).optional(),
  cursor: z.coerce.number().int().nonnegative().default(0),
});
export type Location = z.infer<typeof locationSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type State =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CANCELLED";
export type Action =
  | "accept"
  | "reject"
  | "withdraw"
  | "start"
  | "confirm"
  | "cancel";
export function transition(
  state: State,
  action: Action,
  side: "owner" | "worker",
): State {
  if (state === "PENDING" && side === "owner" && action === "accept")
    return "ACCEPTED";
  if (state === "PENDING" && side === "owner" && action === "reject")
    return "REJECTED";
  if (state === "PENDING" && side === "worker" && action === "withdraw")
    return "WITHDRAWN";
  if (state === "ACCEPTED" && side === "owner" && action === "start")
    return "IN_PROGRESS";
  if (state === "IN_PROGRESS" && action === "confirm") return "IN_PROGRESS";
  if (
    (state === "PENDING" || state === "ACCEPTED" || state === "IN_PROGRESS") &&
    action === "cancel"
  )
    return "CANCELLED";
  throw new Error("INVALID_TRANSITION");
}
export function distanceKm(
  a: Pick<Location, "latitude" | "longitude">,
  b: Pick<Location, "latitude" | "longitude">,
): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
) {
  const latDelta = ((radiusKm / 6371) * 180) / Math.PI;
  const minLat = Math.max(-90, latitude - latDelta),
    maxLat = Math.min(90, latitude + latDelta);
  const lonDelta =
    minLat === -90 || maxLat === 90
      ? 180
      : (Math.asin(
          Math.min(
            1,
            Math.sin(radiusKm / 6371) / Math.cos((latitude * Math.PI) / 180),
          ),
        ) *
          180) /
        Math.PI;
  const wrap = (v: number) => ((v + 540) % 360) - 180;
  return {
    minLat,
    maxLat,
    minLon: wrap(longitude - lonDelta),
    maxLon: wrap(longitude + lonDelta),
    allLongitudes: lonDelta === 180,
  };
}
