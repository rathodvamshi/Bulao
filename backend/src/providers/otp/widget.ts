import { ApiError } from "../../middleware/errors";
import { AUTH_POLICY, phoneSchema } from "../../modules/auth/policy";

// Contract: https://docs.msg91.com/otp-widget/verify-access-token
// A successful response's message is the verified identifier, not a status label.
export async function verifyWidgetToken(key: string | undefined, accessToken: string): Promise<string> {
  if (!key) throw new ApiError("PROVIDER_AUTH_REJECTED", 503, "Phone verification is not configured. Please contact support.");
  try {
    const response = await fetch("https://api.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: key },
      body: JSON.stringify({ "access-token": accessToken }),
      signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
      redirect: "manual",
    });
    if (response.status === 401 || response.status === 403)
      throw new ApiError("PROVIDER_AUTH_REJECTED", 503, "Phone verification configuration was rejected. Please contact support.");
    if (response.status === 429)
      throw new ApiError("OTP_RATE_LIMITED", 429, "Too many verification attempts. Please wait a minute.", 60);
    if (response.status >= 500 || (response.status >= 300 && response.status < 400)) throw new Error("provider unavailable");
    const payload = await response.json() as { type?: unknown; message?: unknown };
    if (!payload || typeof payload !== "object") throw new Error("invalid provider response");
    if (payload.type !== "success" || !response.ok) {
      const message = typeof payload.message === "string" ? payload.message : "";
      if (/authentication|authkey|auth key|invalid key|access denied/i.test(message))
        throw new ApiError("PROVIDER_AUTH_REJECTED", 503, "Phone verification configuration was rejected. Please contact support.");
      throw new ApiError("WIDGET_TOKEN_INVALID", 400, "Phone verification expired or was rejected. Please request a new OTP.");
    }
    const identifier = phoneSchema.safeParse(payload.message);
    if (!identifier.success) throw new Error("missing verified phone");
    return identifier.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Unable to confirm phone verification. Please try again.");
  }
}
