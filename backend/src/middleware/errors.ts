import type { Context } from "hono";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503 = 400,
    message = "Please check your details and try again.",
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export const ok = (c: Context, data: unknown) =>
  c.json({ success: true, data, error: null, requestId: c.get("requestId") });
