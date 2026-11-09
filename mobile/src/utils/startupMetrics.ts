const startupStartedAt = Date.now();
const recordedMilestones = new Set<string>();

/** Development-only launch milestones; never sends telemetry or logs user data. */
export function markStartupMilestone(name: string): void {
  if (!__DEV__ || recordedMilestones.has(name)) return;
  recordedMilestones.add(name);
  console.info(`[startup] ${name}: ${Date.now() - startupStartedAt}ms`);
}
