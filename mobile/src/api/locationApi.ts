import { apiClient } from "./apiClient";
import type { Location } from "@bulao/domain";

export interface SavedLocation extends Location {
  id: string;
  label: "Home" | "Work" | "Other";
  address: string;
  isDefault: boolean;
}

export interface LocationSearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const locationApi = {
  searchLocation: async (query: string): Promise<LocationSearchResult[]> => {
    // We use OpenStreetMap's Nominatim API for geocoding since the backend doesn't support it directly.
    // Adding countrycodes=in restricts the search strictly to India.
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&addressdetails=1&limit=5`,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "BulaoApp/1.0",
        },
      }
    );
    if (!res.ok) return [];
    
    const data: any[] = await res.json();
    return data.map((item) => ({
      name: item.name || item.display_name.split(",")[0],
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));
  },

  getSavedLocations: async (token: string): Promise<SavedLocation[]> => {
    const { locations } = await apiClient.get<{ locations: SavedLocation[] }>(
      "/users/me/locations",
      token
    );
    return locations;
  },

  addSavedLocation: async (
    data: Omit<SavedLocation, "id" | "isDefault">,
    token: string
  ): Promise<SavedLocation> => {
    return apiClient.post<SavedLocation>("/users/me/locations", data, token);
  },

  deleteSavedLocation: async (id: string, token: string): Promise<void> => {
    await apiClient.delete(`/users/me/locations/${id}`, token);
  },
};
