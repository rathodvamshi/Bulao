import { api } from "./client";

export type SavedPlace = {
  id: string;
  userId: string;
  label: string;
  icon: string;
  latitude: number;
  longitude: number;
  locality: string;
  address: string;
  lastUsedAt: number;
  createdAt: number;
};

export type CreateSavedPlaceInput = {
  label: string;
  icon: string;
  latitude: number;
  longitude: number;
  locality: string;
  address?: string;
};

export const savedPlacesApi = {
  async getAll(): Promise<SavedPlace[]> {
    return api<SavedPlace[]>("/saved-places");
  },

  async create(input: CreateSavedPlaceInput): Promise<SavedPlace> {
    return api<SavedPlace>("/saved-places", input);
  },

  async updateLastUsed(id: string): Promise<void> {
    await api(`/saved-places/${id}/use`, {}, "PATCH");
  },

  async delete(id: string): Promise<void> {
    await api(`/saved-places/${id}`, undefined, "DELETE");
  },
};
