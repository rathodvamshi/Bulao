export type MapProviderName = "google" | "maplibre";
export interface ProviderTelemetry {
  enabled: boolean;
  healthy: boolean;
  used: number;
  limit: number;
  observedAt: number;
}
export interface MapPolicy {
  primary: MapProviderName;
  fallback: MapProviderName;
  fallbackEnabled: boolean;
  safetyFraction: number;
  maxAgeMs: number;
}
export function chooseMap(
  policy: MapPolicy,
  telemetry: Partial<Record<MapProviderName, ProviderTelemetry>>,
  now: number,
): MapProviderName | null {
  if (policy.safetyFraction <= 0 || policy.safetyFraction >= 1) return null;
  const safe = (name: MapProviderName) => {
    const value = telemetry[name];
    return (
      value?.enabled &&
      value.healthy &&
      value.limit > 0 &&
      value.used >= 0 &&
      value.observedAt <= now &&
      now - value.observedAt <= policy.maxAgeMs &&
      value.used < value.limit * policy.safetyFraction
    );
  };
  if (safe(policy.primary)) return policy.primary;
  if (policy.fallbackEnabled && safe(policy.fallback)) return policy.fallback;
  return null;
}
