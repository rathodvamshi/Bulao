import { api } from "../../api/client";
import type { UserData } from "../../auth";
import { getInstallationId, newRequestIdempotencyKey } from "../../utils/installationId";

export interface OtpDispatchResult {
  requestId: string;
  expiresIn: number;
  resendAfter: number;
  otpLength: number;
}

export interface VerifyLoginOtpResult {
  token: string;
  expiresAt: number;
  user: UserData;
  isNewUser: boolean;
}

export interface PhoneChangeSendResult extends OtpDispatchResult {
  newPhone: string;
  message: string;
}

export interface PhoneChangeVerifyResult {
  success: boolean;
  phone: string;
  phoneVerified: number;
  message: string;
}

export async function sendOtp(phone: string, idempotencyKey?: string): Promise<OtpDispatchResult> {
  const installationId = await getInstallationId();
  return api<OtpDispatchResult>("/auth/send-otp", {
    phone,
    installationId,
    idempotencyKey: idempotencyKey || newRequestIdempotencyKey(),
  });
}

export async function resendOtp(
  phone: string,
  requestId: string,
  idempotencyKey?: string,
): Promise<OtpDispatchResult> {
  const installationId = await getInstallationId();
  return api<OtpDispatchResult>("/auth/resend-otp", {
    phone,
    requestId,
    installationId,
    idempotencyKey: idempotencyKey || newRequestIdempotencyKey(),
  });
}

export async function verifyLoginOtp(
  phone: string,
  requestId: string,
  otp: string,
): Promise<VerifyLoginOtpResult> {
  const installationId = await getInstallationId();
  return api<VerifyLoginOtpResult>("/auth/verify-otp", {
    phone,
    requestId,
    otp,
    installationId,
  });
}

export async function sendPhoneChangeOtp(
  newPhone: string,
  idempotencyKey?: string,
): Promise<PhoneChangeSendResult> {
  const installationId = await getInstallationId();
  return api<PhoneChangeSendResult>(
    "/users/phone/send-otp",
    {
      newPhone,
      installationId,
      idempotencyKey: idempotencyKey || newRequestIdempotencyKey(),
    },
    "POST",
  );
}

export async function verifyPhoneChangeOtp(
  newPhone: string,
  requestId: string,
  otp: string,
): Promise<PhoneChangeVerifyResult> {
  const installationId = await getInstallationId();
  return api<PhoneChangeVerifyResult>(
    "/users/phone/verify-otp",
    {
      newPhone,
      requestId,
      otp,
      installationId,
    },
    "POST",
  );
}
