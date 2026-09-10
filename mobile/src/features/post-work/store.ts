import { create } from "zustand";

export type ExperienceLevel = "any" | "some" | "expert";
export type Duration = "one" | "few" | "ongoing";
export type Hours = "full" | "custom";
export type PayUnit = "day" | "job" | "hour" | "month";
export type PayWhen = "after" | "daily" | "weekly" | "monthly";

export type SavedPlace = {
  id: string;
  label: string;
  icon: string;
  latitude: number;
  longitude: number;
  locality: string;
  address: string;
};

export type PostWorkState = {
  // Step 1: Category + Role
  category: string;
  categoryName: string;
  role: string;
  roleName: string;

  // Step 2: What & how many
  title: string;
  workers: number;
  experience: ExperienceLevel;

  // Step 3: Where
  latitude: number | null;
  longitude: number | null;
  locality: string;
  address: string;
  savedPlaceId: string | null;

  // Step 4: When
  startDate: Date;
  duration: Duration;
  endDate: Date | null;
  hours: Hours;
  startTime: string;
  endTime: string;

  // Step 5: Pay + extras
  payAmount: string;
  payUnit: PayUnit;
  payWhen: PayWhen;
  extras: string[];
  benefits: string[];
  photoUrl: string | null;
  description: string;

  // Current step
  currentStep: number;

  // Actions
  setCategory: (id: string, name: string) => void;
  setRole: (id: string, name: string) => void;
  setDetails: (title: string, workers: number, experience: ExperienceLevel) => void;
  setLocation: (
    lat: number,
    lng: number,
    locality: string,
    address?: string,
    savedPlaceId?: string
  ) => void;
  setSchedule: (
    startDate: Date,
    duration: Duration,
    endDate: Date | null,
    hours: Hours,
    startTime: string,
    endTime: string
  ) => void;
  setPay: (
    amount: string,
    unit: PayUnit,
    when: PayWhen,
    extras: string[],
    benefits: string[],
    photo: string | null,
    description: string
  ) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  resetFlow: () => void;
};

const initialState = {
  category: "",
  categoryName: "",
  role: "",
  roleName: "",
  title: "",
  workers: 1,
  experience: "any" as ExperienceLevel,
  latitude: null,
  longitude: null,
  locality: "",
  address: "",
  savedPlaceId: null,
  startDate: new Date(),
  duration: "one" as Duration,
  endDate: null,
  hours: "full" as Hours,
  startTime: "09:00",
  endTime: "17:00",
  payAmount: "",
  payUnit: "day" as PayUnit,
  payWhen: "after" as PayWhen,
  extras: [],
  benefits: [],
  photoUrl: null,
  description: "",
  currentStep: 1,
};

export const usePostWorkStore = create<PostWorkState>((set) => ({
  ...initialState,

  setCategory: (id, name) =>
    set({ category: id, categoryName: name }),

  setRole: (id, name) =>
    set((state) => ({
      role: id,
      roleName: name,
      title: `${name} needed`,
    })),

  setDetails: (title, workers, experience) =>
    set({ title, workers, experience }),

  setLocation: (lat, lng, locality, address = "", savedPlaceId?: string | null) =>
    set({
      latitude: lat,
      longitude: lng,
      locality,
      address,
      savedPlaceId: savedPlaceId || null,
    }),

  setSchedule: (startDate, duration, endDate, hours, startTime, endTime) =>
    set({
      startDate,
      duration,
      endDate,
      hours,
      startTime,
      endTime,
    }),

  setPay: (amount, unit, when, extras, benefits, photo, description) =>
    set({
      payAmount: amount,
      payUnit: unit,
      payWhen: when,
      extras,
      benefits,
      photoUrl: photo,
      description,
    }),

  nextStep: () =>
    set((state) => ({ currentStep: Math.min(6, state.currentStep + 1) })),

  prevStep: () =>
    set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),

  goToStep: (step) =>
    set({ currentStep: Math.max(1, Math.min(6, step)) }),

  resetFlow: () => set(initialState),
}));
