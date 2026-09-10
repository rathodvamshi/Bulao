import { apiClient } from "./apiClient";
import type { Job } from "./types";

export interface SearchJobsParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  categoryId?: string | null;
  cursor?: string;
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
    searchParams.append("radiusKm", params.radiusKm.toString());
    if (params.categoryId) searchParams.append("categoryId", params.categoryId);
    if (params.cursor) searchParams.append("cursor", params.cursor);

    return apiClient.get<SearchJobsResult>(`/jobs?${searchParams.toString()}`, token);
  },
};
