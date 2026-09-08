import type { Env } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { otpProvider } from "../../providers/otp/provider";
import { AUTH_POLICY as P, recentAttempts } from "./policy";
import { now } from "./session";

type Challenge = { id: string; expiresAt: number; attempts: number; used: boolean; ready: boolean; msg91RequestId?: string };
type State = {
  sends: number[];
  blockedUntil: number;
  busy?: { id: string; until: number };
  challenge?: Challenge;
};
type Input = { phone: string; requestId?: string; otp?: string; traceId?: string; msg91RequestId?: string };

// One Cloudflare object per keyed phone hash or keyed IP hash. No local storage.
export class AuthCoordinator {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    try {
      const action = new URL(request.url).pathname.slice(1);
      if (action === "limit-send" || action === "limit-verify") {
        await this.limit(action);
        return Response.json({ success: true });
      }
      if (!["send", "resend", "verify"].includes(action)) return new Response(null, { status: 404 });
      const input = await request.json<Input>();
      const provider = otpProvider(this.env, input.traceId);
      const operation = crypto.randomUUID();
      const at = now();
      // Alarm is set before writes so abandoned state always has a cleanup task.
      await this.state.storage.setAlarm(Date.now() + 86401 * 1000);
      const challenge = await this.state.storage.transaction(async (tx) => {
        const state = await tx.get<State>("phone") ?? { sends: [], blockedUntil: 0 };
        if (state.blockedUntil > at) throw blocked(state.blockedUntil - at);
        if (state.busy && state.busy.until > at) throw blocked(state.busy.until - at);
        if (action === "send") {
          this.reserveSend(state, at);
          state.challenge = { id: crypto.randomUUID(), expiresAt: at + P.otpLifetime, attempts: 0, used: false, ready: false };
        } else {
          const current = state.challenge;
          if (!current || current.id !== input.requestId || current.used || !current.ready || current.expiresAt <= at) {
            throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired. Request a new code.");
          }
          if (current.attempts >= P.verificationAttempts) throw blocked(P.verificationBlock);
          if (action === "resend") this.reserveSend(state, at);
          else {
            current.attempts++;
            if (current.attempts === P.verificationAttempts) state.blockedUntil = at + P.verificationBlock;
          }
        }
        state.busy = { id: operation, until: at + P.operationLease };
        await tx.put("phone", state);
        return state.challenge!;
      });

      let valid = false;
      let msg91RequestId: string | undefined;
      let failure: unknown;
      try {
        if (action === "send") {
          msg91RequestId = await provider.send(input.phone);
        } else if (action === "resend") {
          await provider.resend(input.phone);
        } else {
          valid = await provider.verify(input.phone, input.otp!);
        }
      } catch (error) { failure = error; }

      const accepted = await this.state.storage.transaction(async (tx) => {
        const state = await tx.get<State>("phone");
        if (!state || state.busy?.id !== operation || state.challenge?.id !== challenge.id) return false;
        delete state.busy;
        const current = state.challenge;
        if (action === "send") {
          current.ready = !failure;
          if (!failure && msg91RequestId) {
            current.msg91RequestId = msg91RequestId;
          }
        }
        if (action === "verify") {
          if (valid && !failure && current.expiresAt > now()) {
            current.used = true;
            state.blockedUntil = 0;
          }
          else {
            valid = false;
            if (current.attempts >= P.verificationAttempts) {
              current.used = true;
              state.blockedUntil = now() + P.verificationBlock;
            }
          }
        }
        await tx.put("phone", state);
        return true;
      });
      if (!accepted) throw new ApiError("INVALID_OTP", 400, "That request expired. Request a new code.");
      if (failure) throw failure;
      if (action === "verify") {
        if (!valid) {
          if (challenge.attempts >= P.verificationAttempts) throw blocked(P.verificationBlock);
          throw new ApiError("INVALID_OTP", 400, "That code is invalid or expired.");
        }
        return Response.json({ success: true });
      }
      return Response.json({
        requestId: challenge.id,
        expiresIn: Math.max(0, challenge.expiresAt - now()),
        resendAfter: P.resendCooldown,
        otpLength: P.otpDigits,
        msg91RequestId: msg91RequestId ?? challenge.msg91RequestId,
      });
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError("PROVIDER_UNAVAILABLE", 503, "Phone verification is temporarily unavailable.");
      return Response.json({ code: safe.code, message: safe.message, retryAfter: safe.retryAfter }, { status: safe.status });
    }
  }

  private reserveSend(state: State, at: number) {
    state.sends = recentAttempts(state.sends, at, 86400);
    const recent = recentAttempts(state.sends, at, P.sendWindow);
    const last = state.sends.at(-1);
    if (last !== undefined && at - last < P.resendCooldown) throw blocked(last + P.resendCooldown - at);
    if (recent.length >= P.phoneSends) throw blocked(recent[0]! + P.sendWindow - at);
    if (state.sends.length >= P.phoneDailySends) throw blocked(state.sends[0]! + 86400 - at);
    state.sends.push(at);
  }

  private async limit(action: string) {
    const at = now();
    await this.state.storage.setAlarm(Date.now() + (P.sendWindow + 1) * 1000);
    await this.state.storage.transaction(async (tx) => {
      const attempts = recentAttempts(await tx.get<number[]>(action) ?? [], at, P.sendWindow);
      const max = action === "limit-send" ? P.ipSends : P.ipVerifications;
      if (attempts.length >= max) throw blocked(attempts[0]! + P.sendWindow - at);
      attempts.push(at);
      await tx.put(action, attempts);
    });
  }

  async alarm() {
    // Block new events during the short storage-only cleanup.
    await this.state.blockConcurrencyWhile(async () => {
      const alarm = await this.state.storage.getAlarm();
      if (alarm !== null && alarm > Date.now()) return;
      await this.state.storage.deleteAll();
    });
  }
}

function blocked(retryAfter: number) {
  return new ApiError("OTP_RATE_LIMITED", 429, "Too many attempts. Please try again later.", Math.max(1, Math.ceil(retryAfter)));
}
