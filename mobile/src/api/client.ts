import { useSession } from "../store/session";
import { apiBaseUrl } from "./config";
export class ApiError extends Error {
  constructor(message: string, public code: string, public retryAfter?: number, public requestId?: string) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const base = apiBaseUrl();
  const token = useSession.getState().token;
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ApiError("Check your connection and try again.", "NETWORK_ERROR");
  }
  let result;
  try { result = await response.json(); }
  catch { throw new ApiError("The service is temporarily unavailable. Please try again.", "SERVICE_UNAVAILABLE"); }
  if (!response.ok || !result.success) {
    if (response.status === 401 && token && useSession.getState().token === token) await useSession.getState().setToken(null);
    throw new ApiError(result.error?.message ?? "Something went wrong. Please try again.",
      result.error?.code ?? "UNKNOWN", result.error?.retryAfter, response.headers.get("X-Request-Id") ?? undefined);
  }
  return result.data as T;
}
