import type { QueryClient } from "@tanstack/react-query";

const JOB_LIFECYCLE_QUERY_KEYS = [
  ["provider-recent-jobs"],
  ["provider-job-history"],
  ["provider-stats"],
  ["provider-notifications"],
  ["provider-completion-activity"],
  ["seeker-notifications"],
  ["seeker-completion-activity"],
  ["activity"],
  ["interactions"],
  ["my-jobs"],
  ["jobs"],
  ["job"],
  ["my-applications"],
  ["applications"],
  ["profiles"],
  ["profile"],
  ["me"],
  ["reviews"],
] as const;

/** Refresh every screen whose data can change when job work or reviews change. */
export function invalidateJobLifecycleQueries(client: QueryClient) {
  return Promise.allSettled(
    JOB_LIFECYCLE_QUERY_KEYS.map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}
