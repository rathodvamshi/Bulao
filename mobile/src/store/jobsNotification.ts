import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SimpleJob = {
  id: string;
  applicantCount: number;
};

interface JobsNotificationState {
  seenApplicantCounts: Record<string, number>; // jobId -> applicantCount when last seen
  workerAdjustments: Record<string, number>; // jobId -> added workers count
  markJobSeen: (jobId: string, currentApplicantCount: number) => void;
  markAllJobsSeen: (jobs: SimpleJob[]) => void;
  isJobUnseen: (jobId: string, currentApplicantCount: number) => boolean;
  hasAnyUnseenJobs: (jobs?: SimpleJob[]) => boolean;
  getAdjustedWorkers: (jobId: string, baseWorkers?: number) => number;
  incrementWorkers: (jobId: string) => number;
}

export const useJobsNotification = create<JobsNotificationState>()(
  persist(
    (set, get) => ({
      seenApplicantCounts: {},
      workerAdjustments: {},

      markJobSeen: (jobId: string, currentApplicantCount: number) => {
        set((state) => ({
          seenApplicantCounts: {
            ...state.seenApplicantCounts,
            [jobId]: Math.max(state.seenApplicantCounts[jobId] || 0, currentApplicantCount),
          },
        }));
      },

      markAllJobsSeen: (jobs) => {
        const nextCounts: Record<string, number> = { ...get().seenApplicantCounts };
        jobs.forEach((j) => {
          nextCounts[j.id] = Math.max(nextCounts[j.id] || 0, j.applicantCount || 0);
        });
        set({ seenApplicantCounts: nextCounts });
      },

      isJobUnseen: (jobId: string, currentApplicantCount: number) => {
        if (!currentApplicantCount || currentApplicantCount <= 0) return false;
        const seenCount = get().seenApplicantCounts[jobId] || 0;
        return currentApplicantCount > seenCount;
      },

      hasAnyUnseenJobs: (jobs) => {
        if (!jobs || jobs.length === 0) return false;
        const { seenApplicantCounts } = get();
        return jobs.some((j) => {
          const count = j.applicantCount || 0;
          if (count <= 0) return false;
          const seen = seenApplicantCounts[j.id] || 0;
          return count > seen;
        });
      },

      getAdjustedWorkers: (jobId: string, baseWorkers: number = 1) => {
        const added = get().workerAdjustments[jobId] || 0;
        return Math.max(1, (baseWorkers || 1) + added);
      },

      incrementWorkers: (jobId: string) => {
        const currentAdded = get().workerAdjustments[jobId] || 0;
        const nextAdded = currentAdded + 1;
        set((state) => ({
          workerAdjustments: {
            ...state.workerAdjustments,
            [jobId]: nextAdded,
          },
        }));
        return nextAdded;
      },
    }),
    {
      name: "bulao-jobs-notification-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
