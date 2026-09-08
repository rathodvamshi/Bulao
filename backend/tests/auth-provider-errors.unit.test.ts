import { expect, it, vi } from "vitest";
import { Msg91OtpProvider } from "../src/providers/otp/msg91";
import { otpProvider } from "../src/providers/otp/provider";
it("does not log a credential reflected into a transaction ID", async () => {
  const key = "abcdefabcdefabcdefabcdef";
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const service = new Msg91OtpProvider(key, "test-template", async () => Response.json({type: "success", request_id: key}));
    await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
  } finally { log.mockRestore(); }
});
it("never logs OTP, phone, auth key or raw provider response", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const service = new Msg91OtpProvider("private-fixture-key", "test-template", async () =>
      Response.json({ type: "error", message: "private-fixture-key 7392 919999999991", otp: "7392" }));
    await expect(service.verify("+919999999991", "7392")).resolves.toBe(false);
    const output = JSON.stringify(log.mock.calls);
    for (const value of ["private-fixture-key", "7392", "919999999991", "rawBody"]) expect(output).not.toContain(value);
  } finally { log.mockRestore(); }
});
it("calls native transport without a provider receiver", async () => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async function (this: unknown) {
    expect(this).toBeUndefined();
    return Response.json({ type: "success", request_id: "test-req-id", message: "OTP verified success" });
  });
  const requestId = await service.send("+919999999991");
  expect(requestId).toBe("test-req-id");
  await expect(service.verify("+919999999991", "0123")).resolves.toBe(true);
  await service.resend("+919999999991");
});
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

// Keep the documented endpoint fixed. Even a same-host redirect must not receive credentials.
it.each(["control.msg91.com", "api.msg91.com"] as const)("rejects redirects without forwarding credentials to %s", async (host) => {
  const transport = vi.fn(async (_url: URL | RequestInfo, options?: RequestInit) => {
    expect(options?.redirect).toBe("manual");
    return new Response(null, { status: 302, headers: { location: `https://${host}/api/v5/otp` } });
  });
  const service = new Msg91OtpProvider("test-only-key", "test-template", transport);
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
  expect(transport).toHaveBeenCalledTimes(1);
});
it("rejects redirect to untrusted host", async () => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => {
    return new Response(null, {
      status: 302,
      headers: { location: "https://evil.com/api/v5/otp" },
    });
  });
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
});

it("rejects redirect with credentials in URL", async () => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => {
    return new Response(null, {
      status: 302,
      headers: { location: "https://control.msg91.com:8080/api/v5/otp" },
    });
  });
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
});

it("rejects redirect to HTTP (non-HTTPS)", async () => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => {
    return new Response(null, {
      status: 302,
      headers: { location: "http://control.msg91.com/api/v5/otp" },
    });
  });
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
});

it("rejects redirect to different pathname", async () => {
  const service = new Msg91OtpProvider("test-only-key", "test-template", async () => {
    return new Response(null, {
      status: 302,
      headers: { location: "https://control.msg91.com/api/v5/evil" },
    });
  });
  await expect(service.send("+919999999991")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
});
