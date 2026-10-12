# Bulao login rebuild

## Current structure

- `LoginScreenLayout.tsx` owns the safe area, scrolling, hero, card, and legal footer.
- `LoginPhoneForm.tsx` owns the phone input and its local focus highlight.
- `LoginHero.tsx` renders the existing artwork and forest-green branding without animation.
- `auth.tsx` owns the phone/OTP/name workflow and server calls.

## Keyboard behavior

Removed the old custom keyboard hook, form/footer measurements,
window-height-based hero sizing, focus-driven parent updates, parallax, card lift,
form shaking, and animated step transitions. Removed the unused motion hook.

Android uses the native `softwareKeyboardLayoutMode: resize` configuration.
KeyboardAvoidingView is disabled on Android. iOS uses one standard
KeyboardAvoidingView with padding; ScrollView keyboard-inset adjustment is disabled
so the two approaches do not stack.

The form is scrollable, including on short screens and with larger text. ScrollView
keeps taps and dragging from dismissing the keyboard. Only a deliberate hero tap,
a successful step transition, or a platform action dismisses it. There is no
invisible pressable behind the input and no forced-refocus loop.

After the reported field-overlap issue, the layout now registers the active phone,
OTP, or name input and measures it after `keyboardDidShow`. It scrolls the field
above the keyboard with room for the primary button when space allows. On short
screens the field takes priority and the remaining controls are scrollable.
It adds a bottom spacer only for overlap not already handled by Android resize
or iOS keyboard avoidance, avoiding a second full keyboard-height adjustment.
Keyboard frame changes, viewport layout, and content-size changes refresh this
calculation. These listeners do not blur, dismiss, refocus, or remount the field.

Input reveal uses native animated scrolling unless Reduce Motion is enabled (or
its setting cannot be read). Duplicate target requests are skipped so keyboard
and layout notifications do not restart the same scroll. Stale measurement
callbacks are ignored, and manual dragging takes priority over automatic reveal.

The hero scales with width only. Focus changes only the local field border color;
it does not change border width, elevation, hero size, component identity, or parent
layout. Its visibility callback registers a ref and schedules measurement rather
than changing the form layout on focus. The phone input keeps focus when submitting
invalid input. Name entry no
longer auto-focuses during the OTP-to-name transition.

## Interface and auth behavior

Preserved white surfaces, forest-green branding, the updated hero image, the green
Continue button, inline legal links, and the six-digit OTP default. India (+91) is
shown as a fixed prefix instead of an interactive country selector. The field now
has a visible label and reserved error space.

Preserved OTP replacement/paste handling, resend focus after loading, retained-proof
session retries, duplicate-request guards, and auth-state-owned navigation. The
global LocationSheet stays unmounted on the auth route so its delayed modal cannot
interrupt onboarding.

## Verification limits

Performed source inspection, call-site searches, and tracked whitespace-diff review.
No tests, compilation, Expo commands, app/device runs, SMS sends, or live provider
configuration checks were performed, as requested. Runtime focus behavior remains
unverified. Android native configuration changes require a rebuilt app to apply.

Optional `EXPO_PUBLIC_AUTH_DEBUG=1` still logs screen/phone mount and unmount,
phone focus and blur, step transitions, and explicit dismissal reasons. It does
not log phone numbers, OTP values, or tokens. The removed keyboard hook no longer
logs native keyboard events. No environment files were changed.
