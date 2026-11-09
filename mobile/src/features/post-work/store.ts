import { create } from "zustand";
import { generateSmartTitle, CategoryDetails } from "../../utils/titleGenerator";
import {
  DynamicJobAnswers,
  generateDynamicJobTitle,
  sanitizeAnswersForSubcategory,
  SubcategoryId,
} from "./dynamicCategories";

export type ExperienceLevel = "any" | "some" | "expert";
export type Duration = "one" | "few" | "ongoing";
export type Hours = "full" | "custom";
export type PayUnit = "day" | "job" | "hour" | "month";
export type PayWhen = "after" | "daily" | "weekly" | "monthly";

export type WorkMode = "home" | "online" | "center" | "site" | "flexible";
export type ScheduleType = "one_time" | "fixed_duration" | "recurring" | "ongoing";
export type PayMode = "fixed" | "negotiable" | "discuss" | "demo_first";
export type PayBasis = "hour" | "day" | "task" | "session" | "week" | "month" | "project";
export type PaymentFrequency = "completion" | "session" | "daily" | "weekly" | "monthly" | "milestone";

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

  // Dynamic Specification Answers
  dynamicAnswers: DynamicJobAnswers;

  // Step 2 / Stage 3: Title, Dynamic Category Details & Universal Fields
  title: string;
  suggestedTitle: string;
  titleSource: "auto" | "manual";
  categoryDetails: CategoryDetails;
  workers: number;
  numberOfStudents: number;
  genderType: GenderType;
  maleWorkers: number;
  femaleWorkers: number;
  experience: ExperienceLevel;
  experiences: ExperienceLevel[];
  languages: string[];
  description: string;

  // Step 3 / Stage 4: Where + Work Mode
  workMode: WorkMode;
  latitude: number | null;
  longitude: number | null;
  locality: string;
  address: string;
  savedPlaceId: string | null;

  // Step 4 / Stage 5: When (Adaptive Schedule)
  scheduleType: ScheduleType;
  selectedDays: string[];
  timeSlotPreset: string;
  startDate: Date;
  duration: Duration;
  endDate: Date | null;
  hours: Hours;
  startTime: string;
  endTime: string;

  // Step 5 / Stage 6: Pay + Terms + Benefits
  payAmount: string;
  payMode: PayMode;
  payBasis: PayBasis;
  paymentFrequency: PaymentFrequency;
  demoFeeTerms: string;
  payUnit: PayUnit;
  payWhen: PayWhen;
  extras: string[];
  benefits: string[];
  photoUrl: string | null;

  // Editing mode
  editingJobId: string | null;

  // Current step (1 to 7)
  currentStep: number;

  // Actions
  setCategory: (id: string, name: string) => void;
  setRole: (id: string, name: string) => void;
  setTitle: (title: string, source?: "auto" | "manual") => void;
  resetToSuggestedTitle: () => void;
  setCategoryDetails: (details: Partial<CategoryDetails>) => void;
  setDynamicAnswers: (answers: Partial<DynamicJobAnswers>) => void;
  setLanguages: (languages: string[]) => void;
  setDetails: (
    title: string,
    workers: number,
    experience: ExperienceLevel,
    genderType?: GenderType,
    maleWorkers?: number,
    femaleWorkers?: number,
    description?: string,
    experiences?: ExperienceLevel[],
    categoryDetails?: Partial<CategoryDetails>,
    numberOfStudents?: number,
    languages?: string[]
  ) => void;
  setWorkMode: (mode: WorkMode) => void;
  setLocation: (
    lat: number,
    lng: number,
    locality: string,
    address?: string,
    savedPlaceId?: string,
    workMode?: WorkMode
  ) => void;
  setSchedule: (
    startDate: Date,
    duration: Duration,
    endDate: Date | null,
    hours: Hours,
    startTime: string,
    endTime: string
  ) => void;
  setAdaptiveSchedule: (params: {
    scheduleType: ScheduleType;
    startDate: Date;
    endDate?: Date | null;
    selectedDays?: string[];
    timeSlotPreset?: string;
    hours?: Hours;
    startTime?: string;
    endTime?: string;
  }) => void;
  setPay: (
    amount: string,
    unit: PayUnit,
    when: PayWhen,
    extras: string[],
    benefits: string[],
    photo: string | null,
    description: string
  ) => void;
  setAdaptivePay: (params: {
    payAmount: string;
    payMode?: PayMode;
    payBasis?: PayBasis;
    paymentFrequency?: PaymentFrequency;
    demoFeeTerms?: string;
    extras?: string[];
    benefits?: string[];
  }) => void;
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
  dynamicAnswers: {} as DynamicJobAnswers,
  title: "",
  suggestedTitle: "",
  titleSource: "auto" as "auto" | "manual",
  categoryDetails: {} as CategoryDetails,
  workers: 1,
  numberOfStudents: 1,
  genderType: "any" as GenderType,
  maleWorkers: 1,
  femaleWorkers: 0,
  experience: "some" as ExperienceLevel,
  experiences: [] as ExperienceLevel[],
  languages: [] as string[],
  workMode: "" as unknown as WorkMode,
  latitude: null as number | null,
  longitude: null as number | null,
  locality: "",
  address: "",
  savedPlaceId: null as string | null,
  scheduleType: "" as unknown as ScheduleType,
  selectedDays: [] as string[],
  timeSlotPreset: "",
  startDate: null as unknown as Date,
  duration: "" as unknown as Duration,
  endDate: null as Date | null,
  hours: "" as unknown as Hours,
  startTime: "",
  endTime: "",
  payAmount: "",
  payMode: "" as unknown as PayMode,
  payBasis: "" as unknown as PayBasis,
  paymentFrequency: "" as unknown as PaymentFrequency,
  demoFeeTerms: "",
  payUnit: "" as unknown as PayUnit,
  payWhen: "" as unknown as PayWhen,
  extras: [] as string[],
  benefits: [] as string[],
  photoUrl: null as string | null,
  description: "",
  currentStep: 1,
};

export const usePostWorkStore = create<PostWorkState>((set, get) => ({
  ...initialState,

  setCategory: (id, name) =>
    set((state) => {
      const categoryChanged = state.category !== id;
      const newCategoryDetails = categoryChanged ? {} : state.categoryDetails;
      const newDynamicAnswers = categoryChanged ? ({} as DynamicJobAnswers) : state.dynamicAnswers;
      const newRole = categoryChanged ? "" : state.role;
      const newRoleName = categoryChanged ? "" : state.roleName;

      const suggested = newRole
        ? generateDynamicJobTitle(id, newRole, newDynamicAnswers) ||
          generateSmartTitle(id, name, newRole, newRoleName, newCategoryDetails)
        : "";
      const title = state.titleSource === "auto" ? suggested : state.title || suggested;

      return {
        category: id,
        categoryName: name,
        role: newRole,
        roleName: newRoleName,
        categoryDetails: newCategoryDetails,
        dynamicAnswers: newDynamicAnswers,
        suggestedTitle: suggested,
        title,
      };
    }),

  setRole: (id, name) =>
    set((state) => {
      const sanitizedAnswers = sanitizeAnswersForSubcategory(
        id as SubcategoryId,
        state.dynamicAnswers
      );
      const suggested =
        generateDynamicJobTitle(state.category, id, sanitizedAnswers) ||
        generateSmartTitle(
          state.category,
          state.categoryName,
          id,
          name,
          state.categoryDetails
        );
      const title = state.titleSource === "auto" ? suggested : state.title || suggested;

      return {
        role: id,
        roleName: name,
        dynamicAnswers: sanitizedAnswers,
        suggestedTitle: suggested,
        title,
      };
    }),

  setDynamicAnswers: (partialAnswers) =>
    set((state) => {
      const merged: DynamicJobAnswers = {
        ...state.dynamicAnswers,
        ...partialAnswers,
      };
      const suggested =
        generateDynamicJobTitle(state.category, state.role, merged) ||
        state.suggestedTitle;
      const title = state.titleSource === "auto" ? suggested : state.title || suggested;

      return {
        dynamicAnswers: merged,
        suggestedTitle: suggested,
        title,
      };
    }),

  setTitle: (newTitle, source = "manual") =>
    set({
      title: newTitle,
      titleSource: source,
    }),

  resetToSuggestedTitle: () =>
    set((state) => ({
      title: state.suggestedTitle,
      titleSource: "auto",
    })),

  setCategoryDetails: (newDetails) =>
    set((state) => {
      const updatedDetails = { ...state.categoryDetails, ...newDetails };
      const suggested = generateSmartTitle(
        state.category,
        state.categoryName,
        state.role,
        state.roleName,
        updatedDetails
      );
      const title = state.titleSource === "auto" ? suggested : state.title || suggested;

      // Sync student count if present
      const numberOfStudents =
        updatedDetails.numberOfStudents !== undefined
          ? updatedDetails.numberOfStudents
          : state.numberOfStudents;

      // Sync teaching format to workMode if changed
      let workMode = state.workMode;
      if (updatedDetails.teachingFormat) {
        if (updatedDetails.teachingFormat === "online") workMode = "online";
        else if (updatedDetails.teachingFormat === "center") workMode = "center";
        else if (updatedDetails.teachingFormat === "home") workMode = "home";
        else if (updatedDetails.teachingFormat === "flexible") workMode = "flexible";
      }

      return {
        categoryDetails: updatedDetails,
        suggestedTitle: suggested,
        title,
        numberOfStudents,
        workMode,
      };
    }),

  setLanguages: (languages) =>
    set({
      languages,
    }),

  setDetails: (
    title,
    workers,
    experience,
    genderType = "any",
    maleWorkers = 1,
    femaleWorkers = 0,
    description = "",
    experiences = ["any"],
    categoryDetails,
    numberOfStudents,
    languages
  ) =>
    set((state) => {
      const updatedCatDetails = categoryDetails
        ? { ...state.categoryDetails, ...categoryDetails }
        : state.categoryDetails;
      const suggested = generateSmartTitle(
        state.category,
        state.categoryName,
        state.role,
        state.roleName,
        updatedCatDetails
      );

      return {
        title: title || state.title || suggested,
        suggestedTitle: suggested,
        workers,
        numberOfStudents: numberOfStudents !== undefined ? numberOfStudents : state.numberOfStudents,
        experience,
        experiences,
        languages: languages !== undefined ? languages : state.languages,
        genderType,
        maleWorkers,
        femaleWorkers,
        description: description !== undefined ? description : state.description,
        categoryDetails: updatedCatDetails,
      };
    }),

  setWorkMode: (mode) =>
    set((state) => {
      let formatVal: "home" | "center" | "online" | "flexible" = "home";
      if (mode === "online") formatVal = "online";
      else if (mode === "center") formatVal = "center";
      else if (mode === "flexible") formatVal = "flexible";

      const updatedDetails = {
        ...state.categoryDetails,
        teachingFormat: formatVal,
      };
      return {
        workMode: mode,
        categoryDetails: updatedDetails,
      };
    }),

  setLocation: (lat, lng, locality, address = "", savedPlaceId?: string | null, workMode?: WorkMode) =>
    set((state) => ({
      latitude: lat,
      longitude: lng,
      locality,
      address,
      savedPlaceId: savedPlaceId || null,
      workMode: workMode || state.workMode,
    })),

  setSchedule: (startDate, duration, endDate, hours, startTime, endTime) =>
    set({
      startDate,
      duration,
      endDate,
      hours,
      startTime,
      endTime,
    }),

  setAdaptiveSchedule: ({
    scheduleType,
    startDate,
    endDate = null,
    selectedDays = [],
    timeSlotPreset = "",
    hours = "" as unknown as Hours,
    startTime = "",
    endTime = "",
  }) =>
    set({
      scheduleType,
      startDate,
      endDate,
      selectedDays,
      timeSlotPreset,
      hours,
      startTime,
      endTime,
      duration: scheduleType === "one_time" ? "one" : scheduleType === "fixed_duration" ? "few" : scheduleType === "ongoing" ? "ongoing" : ("" as unknown as Duration),
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

  setAdaptivePay: ({
    payAmount,
    payMode = "" as unknown as PayMode,
    payBasis = "" as unknown as PayBasis,
    paymentFrequency = "" as unknown as PaymentFrequency,
    demoFeeTerms = "",
    extras = [],
    benefits = [],
  }) => {
    // Map payBasis to payUnit
    let payUnit: PayUnit = "" as unknown as PayUnit;
    if (payBasis === "month") payUnit = "month";
    else if (payBasis === "hour") payUnit = "hour";
    else if (payBasis === "task" || payBasis === "session" || payBasis === "project") payUnit = "job";
    else if (payBasis === "day") payUnit = "day";

    // Map paymentFrequency to payWhen
    let payWhen: PayWhen = "" as unknown as PayWhen;
    if (paymentFrequency === "monthly") payWhen = "monthly";
    else if (paymentFrequency === "weekly") payWhen = "weekly";
    else if (paymentFrequency === "daily") payWhen = "daily";
    else if (paymentFrequency === "completion") payWhen = "after";

    set({
      payAmount,
      payMode,
      payBasis,
      paymentFrequency,
      demoFeeTerms,
      payUnit,
      payWhen,
      extras,
      benefits,
    });
  },

  nextStep: () =>
    set((state) => ({ currentStep: Math.min(7, state.currentStep + 1) })),

  prevStep: () =>
    set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),

  goToStep: (step) =>
    set({ currentStep: Math.max(1, Math.min(7, step)) }),

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

    const genderFromDetails = String(job.details || "").match(/gender preference:\s*(male|female|any gender)/i)?.[1];
    const rawGender = String(job.gender || job.genderType || genderFromDetails || "any").toLowerCase();
    const genderType: GenderType = rawGender === "male" ? "male" : rawGender === "female" ? "female" : "any";

    const categoryId = job.categoryId || job.category || "";
    const roleId = job.roleId || job.role || "";
    const categoryName = job.categoryName || "";
    const roleName = job.roleName || job.title || "";
    const title = job.customTitle || job.title || "";
    const description = job.details || job.description || "";
    const locality = job.area || job.locality || "";
    const address = job.address || "";

    // Parse categoryDetails if stored in details or as structured object
    let categoryDetails: CategoryDetails = {};
    if (job.categoryDetails && typeof job.categoryDetails === "object") {
      categoryDetails = job.categoryDetails;
    } else if (job.metadata && typeof job.metadata === "object") {
      categoryDetails = job.metadata;
    }

    set({
      ...initialState,
      editingJobId: job.id || null,
      category: categoryId,
      categoryName,
      role: roleId,
      roleName,
      title,
      suggestedTitle: title,
      titleSource: "manual",
      categoryDetails,
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
