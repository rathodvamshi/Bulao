type WidgetResponse = { type?: string; message?: string; reqId?: string; requestId?: string; code?: string | number };
type WidgetSdk = {
  initializeWidget(widgetId: string, tokenAuth: string): Promise<void>;
  sendOTP(body: { identifier: string }): Promise<WidgetResponse>;
  verifyOTP(body: { reqId: string; otp: string }): Promise<WidgetResponse>;
  retryOTP(body: { reqId: string; retryChannel?: number }): Promise<WidgetResponse>;
};

// The published SDK ships untyped .ts sources. Keep its boundary typed here,
// without changing node_modules or disabling strict checks for the application.
export const OTPWidget: WidgetSdk = (require("@msg91comm/sendotp-react-native") as { OTPWidget: WidgetSdk }).OTPWidget;

export function widgetProof(response: WidgetResponse): string {
  if (response?.type !== "success") {
    const code = response?.code;
    const label = typeof code === "number" || (typeof code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(code)) ? ` (${code})` : "";
    throw new Error(`MSG91${label}: ${response?.message || "OTP verification failed. Please try again."}`);
  }
  if (typeof response.message !== "string" || !response.message)
    throw new Error("MSG91 did not return verification proof. Please request a new OTP.");
  return response.message;
}
