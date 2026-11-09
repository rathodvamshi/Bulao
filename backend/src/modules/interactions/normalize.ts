type InteractionRow = {
  id?: string | null;
  kind?: string | null;
  jobId?: string | null;
  ownerId?: string | null;
  workerId?: string | null;
};

/**
 * Keep one visible job application per job and seeker. Old rejected or
 * cancelled attempts can remain in the database for audit/history, but the
 * newest attempt is the one that belongs in the current applications feed.
 */
export function dedupeLatestJobApplications<T extends InteractionRow>(rows: T[]): T[] {
  const seenIds = new Set<string>();
  const seenJobs = new Set<string>();
  const normalized: T[] = [];

  for (const row of rows) {
    if (!row.id || seenIds.has(row.id)) continue;
    seenIds.add(row.id);

    if (row.kind !== "job") {
      normalized.push(row);
      continue;
    }

    // Ignore malformed/self-linked records instead of exposing a false match.
    if (!row.jobId || !row.ownerId || !row.workerId || row.ownerId === row.workerId) {
      continue;
    }

    const key = `${row.jobId}:${row.workerId}`;
    if (seenJobs.has(key)) continue;
    seenJobs.add(key);
    normalized.push(row);
  }

  return normalized;
}
