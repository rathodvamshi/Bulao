import type { Location } from "@bulao/domain";
import type { QueryClient } from "@tanstack/react-query";
import type { ServiceItem } from "../features/profile/types";
import { api } from "./client";

export function tenDigitPhone(value: string | null | undefined): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

export function servicePhoneVisible(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export type ServiceSearchItem = {
  id: string; userId?: string; title: string; providerName: string; providerPhoto: string | null;
  shopPhotoUrl?: string | null; categoryIcon?: string; providerPhone?: string | null; ownerPhone?: string | null;
  providerVerified?: boolean | number; phoneVisible?: boolean | number;
  serviceMode?: string | null; offeredServices?: string[] | string;
  categoryId: string; category: string; area: string; distanceKm: number;
  rating: number | null; totalReviews: number; pricingModel: string | null; basePricePaise: number | null;
};
export const serviceApi = {
  mine: () => api<ServiceItem[]>("/services/mine"),
  detail: (id: string) => api<ServiceItem>(`/services/${encodeURIComponent(id)}`),
  providerListings: (id: string) => api<ServiceItem[]>(`/services/provider/${encodeURIComponent(id)}/listings`),
  search: (location: Location, categoryId: string, q: string, cursor: number) => {
    const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), radiusKm: "50", cursor: String(cursor) });
    if (categoryId) params.set("categoryId", categoryId);
    if (q.trim()) params.set("q", q.trim());
    return api<{ items: ServiceSearchItem[]; nextCursor: number | null }>(`/services?${params}`);
  },
  request: (serviceId: string, location: Location, details: string, scheduledAt?: number) => {
    const area = String(location.area ?? "").trim();
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    const cleanDetails = details.trim();
    if (area.length < 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("Choose a valid service location first.");
    }
    if (!cleanDetails) throw new Error("Add a few details about the service you need.");
    return api<{ id: string }>("/service-requests", {
      serviceId, area, latitude, longitude, details: cleanDetails,
      ...(scheduledAt === undefined ? {} : { scheduledAt: Math.floor(scheduledAt) }),
    });
  },
};
export async function invalidateServiceQueries(client: QueryClient) {
  await client.invalidateQueries({ predicate: ({ queryKey }) => [
    "my-services", "myServices", "nearby", "db-services-search", "service-detail",
    "service-stats", "service-recent", "activity", "activity-interactions", "interaction",
    "service-notifications", "notifications", "profile", "profile-services", "connection",
  ].includes(String(queryKey[0])) });
}
