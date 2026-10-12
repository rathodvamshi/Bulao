/**
 * LoginText — Auth-screen text wrapper backed by Bulao's bundled font system.
 *
 * Delegates to AppText for the actual font selection and capping logic so
 * both share the same behaviour. Kept as a thin re-export so existing imports
 * in LoginPhoneForm, loginStyles etc. don't need to change.
 */
import React, { createContext } from "react";
import { AppText, type AppTextProps } from "../../components/AppText";

export { AppText as LoginText };
export type { AppTextProps as LoginTextProps };

/** Context value: true once all Bulao font files have been loaded. */
export const LoginFontContext = createContext(false);
