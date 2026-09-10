import { apiBaseUrl } from "./config";
import { fetchWithTimeout } from "./network";

export class ApiError extends Error {
  constructor(message: string, public code: string, public retryAfter?: number, public requestId?: string) {
    super(message);
  }
}

// Global auth context getter - will be set by AuthProvider
let getAuthToken: (() => string | null) | null = null;
let handleAuthExpired: (() => void) | null = null;

export function setAuthTokenGetter(getter: () => string | null) {
  getAuthToken = getter;
}

export function setAuthExpiredHandler(handler: () => void) {
  handleAuthExpired = handler;
}

export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const base = apiBaseUrl();
  const token = getAuthToken?.() || null;
  
  console.log('api() called:', path, 'hasToken:', !!token);
  
  let response: Response;
  try {
    response = await fetchWithTimeout(`${base}${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
    }, 20000);
  } catch (error) {
    console.error('api() network error:', path, error);
    throw new ApiError("Check your connection and try again.", "NETWORK_ERROR");
  }
  
  console.log('api() response:', path, response.status);
  
  let result;
  try { result = await response.json(); }
  catch { throw new ApiError("The service is temporarily unavailable. Please try again.", "SERVICE_UNAVAILABLE"); }
  
  if (!response.ok || !result.success) {
    console.log('api() error response:', path, response.status, result);
    
    // Handle 401 - session expired
    // IMPORTANT: Only trigger logout if this is NOT the verify-widget-otp endpoint
    if (response.status === 401 && token && token === getAuthToken?.() && handleAuthExpired && !path.includes('verify-widget-otp')) {
      console.log('api() triggering auth expired handler');
      handleAuthExpired();
    }
    throw new ApiError(result.error?.message ?? "Something went wrong. Please try again.",
      result.error?.code ?? "UNKNOWN", result.error?.retryAfter, response.headers.get("X-Request-Id") ?? undefined);
  }
  
  console.log('api() success:', path);
  return result.data as T;
}
