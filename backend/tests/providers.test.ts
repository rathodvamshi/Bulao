import { describe, it, expect, vi } from "vitest";
import { Msg91OtpProvider } from "../src/providers/otp/msg91";
describe("MSG91 boundary (no paid calls)", () => {
  it("sends the key in headers and sets four-digit expiry policy", async () => {
    const transport = vi.fn(async () =>
      Response.json({ type: "success", request_id: "test-request-id", message: "id" }),
    );
    const provider = new Msg91OtpProvider("test-key", "template", transport);
    const requestId = await provider.send("+919999999991");
    expect(requestId).toBe("test-request-id");
    const [url, options] = transport.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.searchParams.has("authkey")).toBe(false);
    expect(url.searchParams.get("otp_length")).toBe("4");
    expect(url.searchParams.get("otp_expiry")).toBe("5");
    expect(options.headers).toMatchObject({ authkey: "test-key" });
  });
  it("never treats already-verified or unknown success as fresh verification", async () => {
    const provider = new Msg91OtpProvider("test", "template", async () =>
      Response.json({
        type: "success",
        message: "Mobile no. already verified",
      }),
    );
    expect(await provider.verify("+919999999991", "1234")).toBe(false);
  });
  it("resends by SMS without supplying a new OTP or extending expiry", async () => {
    const transport = vi.fn(async () => Response.json({ type: "success" }));
    const provider = new Msg91OtpProvider("test-key", "template", transport);
    await provider.resend("+919999999991");
    const [url, options] = transport.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v5/otp/retry");
    expect(url.searchParams.get("retrytype")).toBe("text");
    expect(url.searchParams.has("request_id")).toBe(false);
    expect(url.searchParams.has("otp")).toBe(false);
    expect(url.searchParams.has("otp_expiry")).toBe(false);
    expect(url.searchParams.has("authkey")).toBe(false);
    expect(options.headers).toMatchObject({ authkey: "test-key" });
  });
  it("accepts only explicit valid verification and handles outages", async () => {
    const provider = new Msg91OtpProvider("test", "template", async () =>
      Response.json({ type: "success", message: "OTP verified success" }),
    );
    expect(await provider.verify("+919999999991", "1234")).toBe(true);
    const failed = new Msg91OtpProvider(
      "test",
      "template",
      async () => new Response("", { status: 503 }),
    );
    await expect(failed.send("+919999999991")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });
});
