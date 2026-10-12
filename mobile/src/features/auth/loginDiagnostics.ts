import { Keyboard } from "react-native";

// Opt-in lifecycle diagnostics. Never log phone numbers, codes, or tokens.
export function traceLogin(event: string) {
  if (process.env.EXPO_PUBLIC_AUTH_DEBUG === "1") {
    console.debug(`[Bulao auth ${Date.now()}] ${event}`);
  }
}

export function dismissLoginKeyboard(reason: string) {
  traceLogin(`dismiss:${reason}`);
  Keyboard.dismiss();
}
