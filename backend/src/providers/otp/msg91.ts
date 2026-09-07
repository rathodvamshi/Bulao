import type { OtpProvider } from "./provider";
import { ApiError } from "../../middleware/errors";
import { AUTH_POLICY } from "../../modules/auth/policy";
type Transport = typeof fetch;
export class Msg91OtpProvider implements OtpProvider {
  constructor(
    private key: string,
    private templateId: string,
    private transport: Transport = fetch,
  ) {}
  private async request(url: URL, method: string) {
    try {
      const response = await this.transport(url, {
        method,
        headers: { authkey: this.key, "Content-Type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
        signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
        redirect: "error",
      });
      if (!response.ok) throw new Error("provider");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          !("type" in payload) || typeof payload.type !== "string") throw new Error("provider");
      return payload as { type: string; message?: string };
    } catch {
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "Phone verification is temporarily unavailable. Please try again.",
      );
    }
  }
  async send(phone: string) {
    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.search = new URLSearchParams({
      mobile: phone.slice(1),
      template_id: this.templateId,
      otp_length: String(AUTH_POLICY.otpDigits),
      otp_expiry: String(AUTH_POLICY.otpLifetime / 60),
    }).toString();
    const result = await this.request(url, "POST");
    if (result.type !== "success")
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "We couldn’t send a code. Please try again later.",
      );
  }
  async verify(phone: string, code: string) {
    const url = new URL("https://control.msg91.com/api/v5/otp/verify");
    url.search = new URLSearchParams({
      mobile: phone.slice(1),
      otp: code,
    }).toString();
    const result = await this.request(url, "GET");
    return (
      result.type === "success" && result.message === "OTP verified success"
    );
  }
  async resend(phone: string) {
    const url = new URL("https://control.msg91.com/api/v5/otp/retry");
    url.search = new URLSearchParams({ mobile: phone.slice(1), retrytype: "text" }).toString();
    const result = await this.request(url, "GET");
    if (result.type !== "success") {
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn’t resend a code. Please try again later.");
    }
  }
}
