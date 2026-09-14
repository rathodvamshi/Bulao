import { apiClient } from "./apiClient";
import type { Job } from "./types";

export interface SearchJobsParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  categoryId?: string | null;
  cursor?: string;
  all?: boolean;
}

export interface SearchJobsResult {
  items: Job[];
  nextCursor: string | null;
}

export const jobApi = {
  searchJobs: async (
    params: SearchJobsParams,
    token?: string | null
  ): Promise<SearchJobsResult> => {
    const searchParams = new URLSearchParams();
    searchParams.append("latitude", params.latitude.toString());
    searchParams.append("longitude", params.longitude.toString());
    if (params.radiusKm !== undefined) {
      searchParams.append("radiusKm", params.radiusKm.toString());
    }
    if (params.all) {
      searchParams.append("all", "true");
    }
    if (params.categoryId) searchParams.append("categoryId", params.categoryId);
    if (params.cursor) searchParams.append("cursor", params.cursor);

    return apiClient.get<SearchJobsResult>(`/jobs?${searchParams.toString()}`, token);
  },
};
