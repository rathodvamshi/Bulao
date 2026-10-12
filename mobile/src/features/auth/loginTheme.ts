import { Platform } from "react-native";

// Login-specific forest-green branding.
export const loginTheme = {
  primary: "#174C35", sky: "#FFFFFF", surface: "#FFFFFF",
  // Native system fonts (instant loading, zero bundle overhead)
  font:          Platform.OS === "android" ? "sans-serif" : "System",
  fontMedium:    Platform.OS === "android" ? "sans-serif-medium" : "System",
  fontSemiBold:  Platform.OS === "android" ? "sans-serif-medium" : "System",
  fontBold:      Platform.OS === "android" ? "sans-serif" : "System",
  fontDevanagari: Platform.OS === "android" ? "sans-serif" : "System",
  fontTelugu:     Platform.OS === "android" ? "sans-serif" : "System",
  fallbackFont: Platform.OS === "android" ? "sans-serif" : "System",
  whatsapp: "#00956B", whatsappBorder: "#20BF86", whatsappSurface: "#F5FCF9",
  ink: "#000000", muted: "#000000", border: "#CBD2E2",
  error: "#B03A2E", errorBg: "#FEECEB",
  radius: 16, cardRadius: 32, fieldHeight: 56, maxWidth: 480,
} as const;

export function loginError(failure: unknown): string {
  const item = failure as { message?: string; code?: string | number; status?: number } | null;
  const message = typeof item?.message === "string" ? item.message : "";
  const detail = String(item?.code ?? "") + " " + message;
  if (item?.status === 429 || /429|rate.?limit|too many|limit exceeded/i.test(detail))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (/network|offline|fetch|connect|timeout|timed out|abort/i.test(detail))
    return "Could not connect. Check your internet connection and try again.";
  if ((item?.status ?? 0) >= 500 || /server|unavailable|50[0234]/i.test(detail))
    return "The sign-in service is temporarily unavailable. Please try again shortly.";
  return message || "Could not sign you in. Please try again.";
}

// Must agree with the live MSG91 widget and UX copy (4-digit OTP).
const configuredOtpLength = Number(process.env.EXPO_PUBLIC_OTP_LENGTH || 4);
export const OTP_LENGTH = [4, 6].includes(configuredOtpLength) ? configuredOtpLength : 4;
