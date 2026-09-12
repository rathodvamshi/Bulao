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

export type GenderType = "any" | "male" | "female" | "custom";

export type PostWorkState = {
  // Step 1: Category + Role
  category: string;
  categoryName: string;
  role: string;
  roleName: string;

  // Step 2 / Stage 3: What, how many, gender & experience
  title: string;
  workers: number;
  genderType: GenderType;
  maleWorkers: number;
  femaleWorkers: number;
  experience: ExperienceLevel;
  experiences: ExperienceLevel[];

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

  // Editing mode
  editingJobId: string | null;

  // Current step
  currentStep: number;

  // Actions
  setCategory: (id: string, name: string) => void;
  setRole: (id: string, name: string) => void;
  setDetails: (
    title: string,
    workers: number,
    experience: ExperienceLevel,
    genderType?: GenderType,
    maleWorkers?: number,
    femaleWorkers?: number,
    description?: string,
    experiences?: ExperienceLevel[]
  ) => void;
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
  initForEdit: (job: any) => void;
  resetFlow: () => void;
};

const initialState = {
  editingJobId: null as string | null,
  category: "",
  categoryName: "",
  role: "",
  roleName: "",
  title: "",
  workers: 1,
  genderType: "any" as GenderType,
  maleWorkers: 1,
  femaleWorkers: 0,
  experience: "any" as ExperienceLevel,
  experiences: ["any"] as ExperienceLevel[],
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

  setDetails: (
    title,
    workers,
    experience,
    genderType = "any",
    maleWorkers = 1,
    femaleWorkers = 0,
    description = "",
    experiences = ["any"]
  ) =>
    set((state) => ({
      title,
      workers,
      experience,
      experiences,
      genderType,
      maleWorkers,
      femaleWorkers,
      description: description !== undefined ? description : state.description,
    })),

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

  initForEdit: (job: any) => {
    const rawExtras: string[] = Array.isArray(job.extras)
      ? job.extras
      : typeof job.extras === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(job.extras);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

    let startDate = new Date();
    if (job.startsAt) {
      const sNum = typeof job.startsAt === "number" ? job.startsAt : parseInt(String(job.startsAt), 10);
      if (!isNaN(sNum)) {
        startDate = sNum > 1e11 ? new Date(sNum) : new Date(sNum * 1000);
      }
    }

    let endDate: Date | null = null;
    if (job.endsAt) {
      const eNum = typeof job.endsAt === "number" ? job.endsAt : parseInt(String(job.endsAt), 10);
      if (!isNaN(eNum)) {
        endDate = eNum > 1e11 ? new Date(eNum) : new Date(eNum * 1000);
      }
    }

    let payAmount = "";
    if (job.payPaise !== undefined && job.payPaise !== null) {
      const p = Number(job.payPaise);
      if (!isNaN(p)) payAmount = String(Math.round(p / 100));
    } else if (job.payAmount !== undefined && job.payAmount !== null) {
      payAmount = String(job.payAmount);
    }

    const rawWorkers = parseInt(String(job.workers), 10);
    const workers = !isNaN(rawWorkers) && rawWorkers > 0 ? rawWorkers : 1;

    const rawLat = job.latitude !== undefined && job.latitude !== null ? parseFloat(String(job.latitude)) : NaN;
    const rawLng = job.longitude !== undefined && job.longitude !== null ? parseFloat(String(job.longitude)) : NaN;

    const rawExp = job.experience ? String(job.experience).toLowerCase() : "any";
    const experience: ExperienceLevel = rawExp.includes("expert") ? "expert" : rawExp.includes("some") ? "some" : "any";

    const rawDuration = job.duration ? String(job.duration).toLowerCase() : "one";
    const duration: Duration = (rawDuration === "few" || rawDuration === "ongoing") ? rawDuration : "one";

    const rawHours = job.hours ? String(job.hours).toLowerCase() : "full";
    const hours: Hours = rawHours === "custom" ? "custom" : "full";

    const rawPayUnit = job.payUnit ? String(job.payUnit).toLowerCase() : "day";
    const payUnit: PayUnit = ["hour", "day", "job", "month"].includes(rawPayUnit) ? (rawPayUnit as PayUnit) : "day";

    const rawPaidWhen = (job.paidWhen || job.payWhen) ? String(job.paidWhen || job.payWhen).toLowerCase() : "after";
    const payWhen: PayWhen = ["after", "daily", "weekly", "monthly"].includes(rawPaidWhen) ? (rawPaidWhen as PayWhen) : "after";

    const rawGender = (job.gender || job.genderType) ? String(job.gender || job.genderType).toLowerCase() : "any";
    const genderType: GenderType = rawGender === "male" ? "male" : rawGender === "female" ? "female" : "any";

    const categoryId = job.categoryId || job.category || "";
    const roleId = job.roleId || job.role || "";
    const categoryName = job.categoryName || "";
    const roleName = job.roleName || job.title || "";
    const title = job.customTitle || job.title || "";
    const description = job.details || job.description || "";
    const locality = job.area || job.locality || "";
    const address = job.address || "";

    set({
      ...initialState,
      editingJobId: job.id || null,
      category: categoryId,
      categoryName,
      role: roleId,
      roleName,
      title,
      workers,
      genderType,
      maleWorkers: workers,
      femaleWorkers: 0,
      experience,
      experiences: [experience],
      latitude: !isNaN(rawLat) ? rawLat : null,
      longitude: !isNaN(rawLng) ? rawLng : null,
      locality,
      address,
      savedPlaceId: null,
      startDate: !isNaN(startDate.getTime()) ? startDate : new Date(),
      duration,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
      hours,
      startTime: job.startTime || "09:00",
      endTime: job.endTime || "17:00",
      payAmount,
      payUnit,
      payWhen,
      extras: rawExtras,
      benefits: rawExtras,
      photoUrl: null,
      description,
      currentStep: 1,
    });
  },

  resetFlow: () => set(initialState),
}));

