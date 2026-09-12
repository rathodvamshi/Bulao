import { apiClient } from "./apiClient";
import type { Job } from "./types";

export interface SearchJobsParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  categoryId?: string | null;
  categoryIds?: readonly string[];
  cursor?: string;
}

export interface SearchJobsResult {
  items: Job[];
  nextCursor: string | null;
}

export const jobApi = {
  getJob: (id: string, token?: string | null) => apiClient.get<Job>(`/jobs/${encodeURIComponent(id)}`, token),
  apply: (id: string, token: string) => apiClient.post<{ id: string }>(`/jobs/${encodeURIComponent(id)}/apply`, {}, token),
  searchJobs: async (
    params: SearchJobsParams,
    token?: string | null
  ): Promise<SearchJobsResult> => {
    const searchParams = new URLSearchParams();
    searchParams.append("latitude", params.latitude.toString());
    searchParams.append("longitude", params.longitude.toString());
    searchParams.append("radiusKm", params.radiusKm.toString());
    if (params.categoryId) searchParams.append("categoryId", params.categoryId);
    if (params.categoryIds?.length) searchParams.append("categoryIds", params.categoryIds.join(","));
    if (params.cursor) searchParams.append("cursor", params.cursor);

    return apiClient.get<SearchJobsResult>(`/jobs?${searchParams.toString()}`, token);
  },
};
