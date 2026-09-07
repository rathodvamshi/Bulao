import { create } from "zustand";
import type { Location } from "@bulao/domain";
export const useLocation = create<{
  location: Location | null;
  setLocation: (location: Location) => void;
}>((set) => ({ location: null, setLocation: (location) => set({ location }) }));
