import { expect, it } from "vitest";
import { Msg91OtpProvider } from "../src/providers/otp/msg91";
import { otpProvider } from "../src/providers/otp/provider";
it.each([null, [], {}, { type: 123 }])("sanitizes malformed provider payload %j", async (payload) => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => Response.json(payload));
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
});
it.each(["send", "verify", "resend"] as const)("sanitizes %s transport errors", async (method) => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => { throw new Error("test-only-key private provider response"); });
  await expect(service[method]("+919999999991", "0123")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
  try { await service[method]("+919999999991", "0123"); } catch (error) { expect(String(error)).not.toContain("test-only-key"); }
});
it("fails closed on unconfigured/development providers", () => {
  for (const env of [{}, { APP_ENV: "development", OTP_PROVIDER: "development", DEV_OTP: "0123" }, { APP_ENV: "staging", OTP_PROVIDER: "msg91" }]) {
    expect(() => otpProvider(env as never)).toThrow("temporarily unavailable");
  }
});
