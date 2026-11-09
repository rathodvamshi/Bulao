// Schedule one look-ahead image only. Cancellation stops timers and ignores an
// in-flight native prefetch result (expo-image cannot abort an active prefetch).
export function preloadNextStoryImage(
  url: string,
  load: (url: string) => Promise<boolean>,
  onReady: () => void,
) {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  let attempts = 0;
  const run = async () => {
    if (!active) return;
    attempts += 1;
    let success = false;
    try { success = await load(url); } catch { /* Keep the displayed image. */ }
    if (!active) return;
    if (success) onReady();
    else if (attempts < 2) timer = setTimeout(run, 2500);
  };
  // Let the current image finish appearing before starting another download.
  timer = setTimeout(run, 500);
  return () => { active = false; clearTimeout(timer); };
}
