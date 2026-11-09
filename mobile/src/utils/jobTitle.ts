/** Remove the legacy presentation prefix while preserving the stored job title. */
export function formatJobTitle(title?: string | null): string {
  return (title || "").replace(/^\s*Wanted:\s*/i, "").trim();
}
