import { describe, expect, it } from "vitest";
import { phoneSchema, otpSchema, recentAttempts } from "../src/modules/auth/policy";

describe("auth input and rate-limit boundaries (no database or external calls)", () => {
  it("normalizes supported Indian phone formats to one account key", () => {
    for (const phone of ["9876543210", "919876543210", "+91 98765-43210", " (+91) 9876543210 "]) {
      expect(phoneSchema.parse(phone)).toBe("+919876543210");
    }
  });
  it("rejects international numbers, malformed prefixes, and non-mobile numbers", () => {
    for (const phone of ["+12025550123", "5123456789", "+9198765432100", "++919876543210", "00919876543210", "98765x43210"]) {
      expect(phoneSchema.safeParse(phone).success).toBe(false);
    }
  });
  it("preserves leading zeros and rejects numeric/non-four-digit OTP input", () => {
    expect(otpSchema.parse("0123")).toBe("0123");
    for (const otp of [1234, "123", "12345", "123456", "12a4", " 1234"]) {
      expect(otpSchema.safeParse(otp).success).toBe(false);
    }
  });
  it("does not reset SMS limits at a fixed window boundary", () => {
    expect(recentAttempts([590, 595, 599], 601, 600)).toEqual([590, 595, 599]);
    expect(recentAttempts([1, 2, 600], 601, 600)).toEqual([2, 600]);
  });
});
