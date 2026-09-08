/**
 * API Client
 * 
 * Centralized API client with:
 * - Automatic Authorization header injection
 * - 401 session expiration handling
 * - Network error handling
 * - Request timeout
 * - JSON parsing
 */

import { apiBaseUrl } from './config';
import { fetchWithTimeout } from './network';

const DEFAULT_TIMEOUT = 15000; // 15 seconds

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
  requestId?: string;
};

export type ApiClientOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  timeout?: number;
  token?: string | null;
  headers?: Record<string, string>;
};

/**
 * API Client Error
 */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isAuthError(): boolean {
    return this.code === 'AUTH_REQUIRED' || this.code === 'UNAUTHORIZED' || this.status === 401;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Global 401 handler
 * This can be set by the app to handle session expiration
 */
let global401Handler: (() => void) | null = null;

export function set401Handler(handler: () => void) {
  global401Handler = handler;
}

/**
 * Make an authenticated API request
 * 
 * @param endpoint - API endpoint (e.g., '/users/me')
 * @param options - Request options
 * @returns Parsed JSON response
 * @throws ApiClientError on failure
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    timeout = DEFAULT_TIMEOUT,
    token,
    headers: customHeaders = {},
  } = options;

  const url = `${apiBaseUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Inject Authorization header if token provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      },
      timeout
    );

    // Parse response
    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      // Response not JSON
      if (!response.ok) {
        throw new ApiClientError(
          'SERVER_ERROR',
          `Server error: ${response.status}`,
          response.status
        );
      }
      throw new ApiClientError('PARSE_ERROR', 'Invalid response format', response.status);
    }

    // Handle 401 - Session expired
    if (response.status === 401) {
      console.warn('API: 401 Unauthorized - session expired');
      
      // Trigger global 401 handler
      if (global401Handler) {
        global401Handler();
      }

      throw new ApiClientError(
        data.error?.code || 'AUTH_REQUIRED',
        data.error?.message || 'Please sign in to continue.',
        401
      );
    }

    // Handle other error status codes
    if (!response.ok) {
      throw new ApiClientError(
        data.error?.code || 'SERVER_ERROR',
        data.error?.message || 'Something went wrong. Please try again.',
        response.status,
        data.error?.retryAfter
      );
    }

    // Success - return data
    if (!data.success || data.data === undefined || data.data === null) {
      throw new ApiClientError('INVALID_RESPONSE', 'Invalid response format', response.status);
    }

    return data.data as T;
  } catch (error) {
    // Network errors (timeout, connection refused, DNS, etc.)
    if (error instanceof TypeError || (error as any).name === 'AbortError') {
      throw new ApiClientError(
        'NETWORK_ERROR',
        'Unable to connect. Check your internet connection.',
        0
      );
    }

    // Re-throw ApiClientError as-is
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Unknown error
    console.error('API request error:', error);
    throw new ApiClientError(
      'UNKNOWN',
      'Something went wrong. Please try again.',
      0
    );
  }
}

/**
 * Convenience methods
 */
export const apiClient = {
  get: <T = any>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'GET', token }),

  post: <T = any>(endpoint: string, body?: any, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'POST', body, token }),

  patch: <T = any>(endpoint: string, body?: any, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body, token }),

  delete: <T = any>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'DELETE', token }),
};
