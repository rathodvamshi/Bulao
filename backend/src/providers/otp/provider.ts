import type { Env } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { Msg91OtpProvider } from "./msg91";

export type SmsDeliveryStatus = "PENDING" | "ACCEPTED" | "SENT" | "DELIVERED" | "FAILED" | "UNKNOWN";

export interface SmsDeliveryResult {
  status: SmsDeliveryStatus;
  provider: string;
  providerMessageId?: string;
  errorCode?: string;
  retryable: boolean;
  attempts: number;
}

export interface OtpProvider {
  send(phone: string): Promise<string>;
  verify(phone: string, code: string, msg91RequestId?: string): Promise<boolean>;
  resend(phone: string, msg91RequestId?: string): Promise<void>;
  sendCustomOtp?(phone: string, otp: string): Promise<SmsDeliveryResult>;
}

export function otpProvider(env: Env, requestId?: string): OtpProvider {
  if (!["staging", "production"].includes(env.APP_ENV) || env.OTP_PROVIDER !== "msg91" ||
      !env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
    console.log("MSG91_INIT_FAIL", "secret_present:", !!env.MSG91_AUTH_KEY, "template_present:", !!env.MSG91_TEMPLATE_ID, "env:", env.APP_ENV, "provider:", env.OTP_PROVIDER);
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  }
  return new Msg91OtpProvider(
    env.MSG91_AUTH_KEY,
    env.MSG91_TEMPLATE_ID,
    undefined,
    requestId,
    env,
    env.MSG91_WIDGET_ID,
    env.MSG91_TOKEN_AUTH,
  );
}
