import type { Env } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { Msg91OtpProvider } from "./msg91";

export interface OtpProvider {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
  resend(phone: string): Promise<void>;
}

export function otpProvider(env: Env): OtpProvider {
  if (!["staging", "production"].includes(env.APP_ENV) || env.OTP_PROVIDER !== "msg91" ||
      !env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
    throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
  }
  return new Msg91OtpProvider(env.MSG91_AUTH_KEY, env.MSG91_TEMPLATE_ID);
}
