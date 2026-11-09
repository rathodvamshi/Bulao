import { apiBaseUrl } from "./config";
import { fetchWithTimeout } from "./network";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryAfter?: number,
    public requestId?: string,
    public status?: number,
  ) {
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

// In-flight deduplication map for concurrent GET requests
const inFlightGets = new Map<string, Promise<any>>();

async function executeApi<T>(
  base: string,
  path: string,
  body: unknown,
  reqMethod: string,
  token: string | null,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${base}${path}`,
      {
        method: reqMethod,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        redirect: "error",
      },
      20000,
    );
  } catch (error) {
    console.error(`[API Network Error] ${reqMethod} ${path}:`, error);
    throw new ApiError("Check your connection and try again.", "NETWORK_ERROR");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    console.error(`[API Invalid JSON] ${reqMethod} ${path} ${response.status}`);
    throw new ApiError(
      "The service is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
    );
  }

  if (!response.ok || !result.success) {
    const requestId = result?.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
    console.warn(
      `[API Error ${response.status}] ${reqMethod} ${path}${requestId ? ` [request ${requestId}]` : ""}:`,
      result?.error?.message ?? "Failed",
    );

    // Handle 401 - session expired
    // IMPORTANT: Only trigger logout if this is NOT the verify-widget-otp endpoint
    if (
      response.status === 401 &&
      token &&
      token === getAuthToken?.() &&
      handleAuthExpired &&
      !path.includes("verify-widget-otp")
    ) {
      console.log("[API Auth Expired] Triggering logout handler");
      handleAuthExpired();
    }
    throw new ApiError(
      result.error?.message ?? "Something went wrong. Please try again.",
      result.error?.code ?? "UNKNOWN",
      result.error?.retryAfter,
      requestId,
      response.status,
    );
  }

  console.log(`[API 200] ${reqMethod} ${path}`);
  return result.data as T;
}

export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const base = apiBaseUrl();
  const token = getAuthToken?.() || null;
  const reqMethod = method ?? (body ? "POST" : "GET");

  if (reqMethod === "GET") {
    const dedupeKey = `${token || "anon"}:${path}`;
    const pending = inFlightGets.get(dedupeKey);
    if (pending) {
      return pending as Promise<T>;
    }
    const promise = executeApi<T>(base, path, body, reqMethod, token).finally(() => {
      inFlightGets.delete(dedupeKey);
    });
    inFlightGets.set(dedupeKey, promise);
    return promise;
  }

  return executeApi<T>(base, path, body, reqMethod, token);
}
