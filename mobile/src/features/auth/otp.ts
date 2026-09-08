export async function sendOtp(phone: string) { const { api } = await import("../../api/client"); return api("/auth/send-otp", { phone }); }

