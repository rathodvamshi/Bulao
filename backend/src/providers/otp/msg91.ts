import type { OtpProvider } from "./provider";
import { ApiError } from "../../middleware/errors";
import { AUTH_POLICY } from "../../modules/auth/policy";
type Transport = typeof fetch;

// MSG91 response types
interface Msg91SendResponse {
  type: string;
  request_id: string;
  message?: string;
}

interface Msg91VerifyResponse {
  type: string;
  message?: string;
}

export class Msg91OtpProvider implements OtpProvider {
  constructor(
    private key: string,
    private templateId: string,
    private transport: Transport = (input, init) => fetch(input, init),
    private requestId?: string,
    private env?: { APP_ENV?: string },
    private widgetId?: string,
    private tokenAuth?: string,
  ) {}

  private async request<T>(url: URL, method: string): Promise<T> {
    let status: number | null = null;
    const operation = url.pathname.endsWith("/verify") ? "verify" : url.pathname.endsWith("/retry") ? "resend" : "send";
    try {
      // Log request details (sanitized - no authkey, phone, or OTP)
      const mobileParam = url.searchParams.get("mobile");
      if (mobileParam) {
        const startsWith91 = mobileParam.startsWith("91");
        const length = mobileParam.length;
        const pattern = /^\d+$/.test(mobileParam);
        console.log(JSON.stringify({
          event: "MSG91_REQUEST",
          requestId: this.requestId,
          operation,
          method,
          url: `${url.origin}${url.pathname}`,
          hasAuthHeader: true,
          mobileFormat: { startsWith91, length, isNumeric: pattern },
        }));
      }

      const transport = this.transport;
      const response = await transport(url, {
        method,
        headers: { authkey: this.key, "Content-Type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
        signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
        redirect: "manual",
      });

      status = response.status;
      if (!response.ok) throw new Error("provider");
      const payload: unknown = await response.json();

      const providerRequestId = payload && typeof payload === "object" && "request_id" in payload ? payload.request_id : undefined;
      console.log(JSON.stringify({
        event: "MSG91_RESPONSE",
        requestId: this.requestId,
        operation,
        status,
        providerRequestId: typeof providerRequestId === "string" && /^[a-f0-9]{24}$/.test(providerRequestId) &&
          ![this.key, url.searchParams.get("mobile"), url.searchParams.get("otp")].some(value => value && providerRequestId.includes(value))
          ? providerRequestId : undefined,
      }));

      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          !("type" in payload) || typeof payload.type !== "string") throw new Error("provider");

      const result = payload as { type: string; message?: string };
      const message = typeof result.message === "string" ? result.message.toLowerCase() : "";
      const code = result.type === "success" ? "PROVIDER_SUCCESS"
        : /auth|key|unauthoriz|access denied/.test(message) ? "PROVIDER_AUTH_REJECTED"
        : /template|sender|dlt/.test(message) ? "PROVIDER_TEMPLATE_ERROR"
        : /balance|credit/.test(message) ? "PROVIDER_CREDITS_ERROR"
        : /otp|expired|verified/.test(message) ? "PROVIDER_OTP_REJECTED"
        : "PROVIDER_REJECTED";

      console.log(JSON.stringify({
        event: "MSG91_DEBUG",
        requestId: this.requestId,
        operation,
        status,
        code,
        msg91Type: ["success", "error"].includes(result.type) ? result.type : "unknown",
      }));

      return result as T;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const code = status === 401 || status === 403 ? "PROVIDER_AUTH_REJECTED"
        : status ? "PROVIDER_RESPONSE_ERROR"
        : error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "PROVIDER_TIMEOUT"
        : /illegal invocation|incorrect this/i.test(detail) ? "PROVIDER_RUNTIME_ERROR"
        : /header|ByteString|invalid character/i.test(detail) ? "PROVIDER_HEADER_ERROR"
        : /redirect/i.test(detail) ? "PROVIDER_REDIRECT_ERROR"
        : "PROVIDER_TRANSPORT_ERROR";

      console.log(JSON.stringify({ event: "MSG91_DEBUG", requestId: this.requestId, operation, status, code }));
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "Phone verification is temporarily unavailable. Please try again.",
      );
    }
  }

  async send(phone: string): Promise<string> {
    if (this.widgetId && this.tokenAuth) {
      const url = new URL("https://control.msg91.com/api/v5/widget/sendOtpMobile");
      const transport = this.transport;
      const response = await transport(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetId: this.widgetId,
          tokenAuth: this.tokenAuth,
          identifier: phone.replace(/^\+/, ""),
        }),
        signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
      });

      if (!response.ok) {
        console.error(JSON.stringify({ event: "MSG91_WIDGET_SEND_ERROR", status: response.status }));
        throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn't send a code. Please try again later.");
      }

      const data = await response.json() as { type?: string; message?: string };
      console.log(JSON.stringify({ event: "MSG91_WIDGET_SEND_RESPONSE", requestId: this.requestId, data }));
      if (data.type !== "success" || !data.message) {
        throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn't send a code. Please try again later.");
      }

      return data.message;
    }

    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.search = new URLSearchParams({
      mobile: phone.slice(1),
      template_id: this.templateId,
      otp_length: String(AUTH_POLICY.otpDigits),
      otp_expiry: String(AUTH_POLICY.otpLifetime / 60),
    }).toString();
    const result = await this.request<Msg91SendResponse>(url, "POST");

    if (result.type !== "success")
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "We couldn't send a code. Please try again later.",
      );

    if (typeof result.request_id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(result.request_id) || result.request_id.includes(this.key)) {
      console.error(JSON.stringify({ event: "MSG91_MISSING_REQUEST_ID", requestId: this.requestId }));
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
    }

    return result.request_id;
  }

  async verify(phone: string, code: string, msg91RequestId?: string): Promise<boolean> {
    // In staging, allow QA test code 1234 so testing isn't blocked by Indian carrier DLT delay
    if (this.env?.APP_ENV === "staging" && (code === "0000" || code === "1234")) {
      console.log(JSON.stringify({ event: "STAGING_TEST_OTP_ACCEPTED", phone, requestId: this.requestId }));
      return true;
    }

    if (this.widgetId && this.tokenAuth && msg91RequestId) {
      const url = new URL("https://control.msg91.com/api/v5/widget/verifyOtp");
      const transport = this.transport;
      const response = await transport(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetId: this.widgetId,
          tokenAuth: this.tokenAuth,
          reqId: msg91RequestId,
          otp: code,
        }),
        signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
      });

      if (!response.ok) {
        console.error(JSON.stringify({ event: "MSG91_WIDGET_VERIFY_ERROR", status: response.status }));
        return false;
      }

      const data = await response.json() as { type?: string; message?: string };
      console.log(JSON.stringify({ event: "MSG91_WIDGET_VERIFY_RESPONSE", requestId: this.requestId, type: data.type }));
      return data.type === "success";
    }

    const url = new URL("https://control.msg91.com/api/v5/otp/verify");
    url.search = new URLSearchParams({
      mobile: phone.slice(1),
      otp: code,
    }).toString();
    const result = await this.request<Msg91VerifyResponse>(url, "GET");
    const msg = (result.message || "").toLowerCase().trim();
    if (msg.includes("already verified")) return false;
    return (
      result.type === "success" &&
      (msg.includes("verified") || msg.includes("success") || msg === "")
    );
  }

  async resend(phone: string, msg91RequestId?: string): Promise<void> {
    if (this.widgetId && this.tokenAuth) {
      if (msg91RequestId) {
        try {
          const url = new URL("https://control.msg91.com/api/v5/widget/retryOtp");
          const transport = this.transport;
          const response = await transport(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              widgetId: this.widgetId,
              tokenAuth: this.tokenAuth,
              reqId: msg91RequestId,
            }),
            signal: AbortSignal.timeout(AUTH_POLICY.providerTimeoutMs),
          });
          const data = await response.json() as { type?: string };
          if (data.type === "success") return;
        } catch {
          // fallback to sendOtpMobile
        }
      }
      await this.send(phone);
      return;
    }

    const url = new URL("https://control.msg91.com/api/v5/otp/retry");
    url.search = new URLSearchParams({
      mobile: phone.slice(1),
      retrytype: "text",
    }).toString();
    const result = await this.request<Msg91VerifyResponse>(url, "GET");
    if (result.type !== "success") {
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "We couldn't resend a code. Please try again later.");
    }
  }
}
