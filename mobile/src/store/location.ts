/**
 * Location Store
 *
 * Persists the user's selected location to AsyncStorage via zustand persist
 * so it survives app restarts. The sheet only auto-shows if the user is
 * authenticated but has NO previously saved location.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Location } from "@bulao/domain";
import type { SavedLocation } from "../api/locationApi";

interface LocationState {
  /** The currently selected work location (persisted across restarts) */
  location: Location | null;
  /** Saved locations fetched from the backend (not persisted, re-fetched each session) */
  savedLocations: SavedLocation[];
  /** Whether the location selection sheet is visible */
  isLocationSheetVisible: boolean;

  setLocation: (location: Location) => void;
  clearLocation: () => void;
  setSavedLocations: (locations: SavedLocation[]) => void;
  setLocationSheetVisible: (visible: boolean) => void;
}

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      savedLocations: [],
      isLocationSheetVisible: false,

      setLocation: (location) => set({ location }),
      clearLocation: () => set({ location: null }),
      setSavedLocations: (savedLocations) => set({ savedLocations }),
      setLocationSheetVisible: (isLocationSheetVisible) =>
        set({ isLocationSheetVisible }),
    }),
    {
      name: "bulao-location",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the selected location — don't persist sheet state or saved list
      partialize: (state) => ({ location: state.location }),
    }
  )
);
