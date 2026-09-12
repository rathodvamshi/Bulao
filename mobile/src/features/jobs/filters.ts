import type { Job } from "../../api/types";

// Stable IDs from the shared backend catalog. Shop & Hotel spans two categories.
export const workCategories = [
  { label: "Events", ids: ["events"] },
  { label: "Tuitions", ids: ["education"] },
  { label: "Shop & Hotel", ids: ["shops", "food"] },
  { label: "Constructions", ids: ["construction"] },
  { label: "House", ids: ["household"] },
] as const;

export function categorySearch(label: string | null) {
  const category = workCategories.find(item => item.label === label);
  if (!category) return {};
  return category.ids.length === 1 ? { categoryId: category.ids[0] } : { categoryIds: category.ids };
}

export function applicationLabel(job: Job, userId?: string, at = Date.now() / 1000) {
  if (job.hasApplied) return "Applied";
  if (userId && job.ownerId === userId) return "Your job";
  if (job.status !== "PUBLISHED") return job.status === "FILLED" ? "Filled" : "Unavailable";
  if (job.startsAt < at) return "Expired";
  return "Apply";
}
