import { useEffect, useState } from "react";

/**
 * Custom hook to enforce minimum loading time for skeleton screens
 * 
 * Prevents jarring flashes when data loads too quickly by ensuring
 * skeleton is displayed for at least a minimum duration
 * 
 * @param isActuallyLoading - The real loading state from your query
 * @param minimumMs - Minimum time to show skeleton (default: 500ms)
 * @returns Whether to show loading state
 * 
 * @example
 * const { data, isLoading } = useQuery(...);
 * const showSkeleton = useMinimumLoadingTime(isLoading);
 * 
 * return showSkeleton ? <Skeleton /> : <Content data={data} />;
 */
export function useMinimumLoadingTime(
  isActuallyLoading: boolean,
  minimumMs: number = 500
): boolean {
  const [showLoading, setShowLoading] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    // When loading starts, record the start time
    if (isActuallyLoading && startTime === null) {
      setStartTime(Date.now());
      setShowLoading(true);
    }

    // When loading finishes, check if minimum time has elapsed
    if (!isActuallyLoading && startTime !== null) {
      const elapsed = Date.now() - startTime;
      const remaining = minimumMs - elapsed;

      if (remaining > 0) {
        // Wait for remaining time before hiding loading
        const timer = setTimeout(() => {
          setShowLoading(false);
          setStartTime(null);
        }, remaining);
        return () => clearTimeout(timer);
      } else {
        // Minimum time already elapsed, hide immediately
        setShowLoading(false);
        setStartTime(null);
      }
    }
  }, [isActuallyLoading, startTime, minimumMs]);

  return showLoading;
}

/**
 * Custom hook for staggered content reveal
 * 
 * Shows skeleton then progressively reveals content sections
 * Great for dashboard-style pages with multiple data sources
 * 
 * @param isLoading - Loading state
 * @param sectionCount - Number of sections to stagger
 * @param delayMs - Delay between each section reveal
 * @returns Array of booleans indicating which sections to show
 * 
 * @example
 * const { data, isLoading } = useQuery(...);
 * const [showStats, showJobs, showActivity] = useStaggeredReveal(isLoading, 3, 150);
 * 
 * return (
 *   <>
 *     {showStats ? <Stats /> : <StatsSkeleton />}
 *     {showJobs ? <Jobs /> : <JobsSkeleton />}
 *     {showActivity ? <Activity /> : <ActivitySkeleton />}
 *   </>
 * );
 */
export function useStaggeredReveal(
  isLoading: boolean,
  sectionCount: number,
  delayMs: number = 150
): boolean[] {
  const [visibleSections, setVisibleSections] = useState<boolean[]>(
    new Array(sectionCount).fill(false)
  );

  useEffect(() => {
    if (!isLoading) {
      // Progressively reveal each section
      const timers = visibleSections.map((_, index) =>
        setTimeout(() => {
          setVisibleSections((prev) => {
            const next = [...prev];
            next[index] = true;
            return next;
          });
        }, index * delayMs)
      );

      return () => timers.forEach(clearTimeout);
    } else {
      // Reset when loading starts
      setVisibleSections(new Array(sectionCount).fill(false));
    }
  }, [isLoading, sectionCount, delayMs]);

  return visibleSections;
}

/**
 * Custom hook for smart skeleton duration tracking
 * 
 * Tracks how long skeleton screens are displayed for analytics
 * 
 * @param isLoading - Loading state
 * @param onComplete - Callback with duration when loading completes
 * 
 * @example
 * useSkeletonDuration(isLoading, (duration) => {
 *   analytics.track('skeleton_shown', { duration, screen: 'home' });
 * });
 */
export function useSkeletonDuration(
  isLoading: boolean,
  onComplete?: (durationMs: number) => void
): void {
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading && startTime === null) {
      setStartTime(Date.now());
    }

    if (!isLoading && startTime !== null) {
      const duration = Date.now() - startTime;
      onComplete?.(duration);
      setStartTime(null);
    }
  }, [isLoading, startTime, onComplete]);
}

/**
 * Custom hook for timeout-based skeleton fallback
 * 
 * Shows error/warning after skeleton displays for too long
 * 
 * @param isLoading - Loading state
 * @param timeoutMs - Max time before showing timeout state
 * @returns Whether timeout has been exceeded
 * 
 * @example
 * const { data, isLoading } = useQuery(...);
 * const hasTimedOut = useSkeletonTimeout(isLoading, 10000);
 * 
 * if (hasTimedOut) return <TimeoutError />;
 * if (isLoading) return <Skeleton />;
 * return <Content data={data} />;
 */
export function useSkeletonTimeout(
  isLoading: boolean,
  timeoutMs: number = 10000
): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  return timedOut;
}
