# Bulao login implementation

The existing Expo login route now uses the supplied bundled WebP hero with Metro's 1x/2x/3x asset selection. Image sizes: 24,998 / 61,638 / 101,240 bytes. The old PNG is no longer imported by the login route. Floating icons remain in the artwork.

The native form renders immediately, independently of image loading. The hero has a sky placeholder and a 240ms opacity fade (disabled for reduced motion), bottom alignment, and a 280–420 logical pixel height. The white content-sized sheet overlaps by 48 pixels. A bounded page width avoids oversized tablet imagery. Keyboard events replace the artwork with a compact brand header; KeyboardAvoidingView and ScrollView keep the form reachable. All new button/link targets are at least 48 pixels tall.

The phone input is India-only, reflecting the existing backend validation and +91 identifier. It is deliberately not a nonfunctional country picker. It strips non-digits, limits to ten digits, supports telephone autofill, and submits via Done. Continue requires a valid Indian mobile number. Existing synchronous in-flight guards prevent duplicate OTP requests. Errors distinguish connectivity, rate limits, and server failures.

Existing MSG91 send/verify/retry, secure session exchange, 60-second resend cooldown, five-minute expiration, and name completion are retained. The current widget is configured for four digits; the OTP UI now follows challenge.otpLength. Do not change production OTP length until the provider configuration is confirmed.

## Dependencies before release

- Supply the approved SVG logo and full-screen reference. The current live text wordmark, tagline, blue tokens, and screen copy are provisional; the attachments only contain the hero, so exact full-screen parity cannot be claimed.
- Supply EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL together. Configured URLs render accessible legal links. Without them the footer uses neutral copy, never fabricated legal documents.
- WhatsApp verification has no integration in this app. Its button is intentionally omitted until a supported delivery flow is available.
- Hindi/Telugu translations and final typography require approved copy/specifications.

## Device acceptance checks

On Android and iOS, inspect 360×640, 390×844, and 430×932 viewports: check all three faces and the logo; open the keyboard; use large text; verify the form and primary action remain scrollable. Exercise invalid numbers, offline, provider/server failures, rate limiting, double taps, SMS autofill, expiry/resend, back navigation, existing-user sign-in, and new-user name completion. Inspect image density selection in native release builds. Measure meaningful paint on a low-end Android device; the under-one-second target is not yet measured.

## Validation performed

- Mobile TypeScript check passed.
- Six error-mapping checks passed.
- All three WebP density files are below 200 KB.
- Calculated central-face clearance checked at the three requested screen sizes, including enlarged wordmark text. This is not a rendered/device crop test.
- Web export is blocked by the existing react-native-maps import in app/post-work/location.tsx; native-only map internals cannot be bundled for web.
- Android production JavaScript/assets export passed (1,742 modules), including all three hero density variants. This is a bundle check, not an installed APK or physical-device test.

## No-scroll layout revision

The login route uses a fixed flex viewport with no ScrollView. Intrinsic form/footer heights determine the space left for the hero; short screens use tighter spacing and the hero disappears when there is insufficient room. Opening the keyboard hides artwork, the phone heading, WhatsApp/trust content, and legal footer. The OTP screen also reduces nonessential copy while typing. iOS uses KeyboardAvoidingView padding; Android relies on the window resize behavior to avoid double keyboard compensation. WhatsApp unavailability uses a dialog rather than increasing page height. Source reviewed only: no app, builds, previews, or tests run for this revision, per user instruction. Earlier scroll-based guidance above is superseded.

## Screenshot review and typography correction

Source-only review identified an OEM/system-font fallback, artwork width shrinking below the page width, branding overlapping the illustration, and an undeclared compact prop in OtpStep. The screen now bundles Lato Regular/Bold with the SIL Open Font License (assets/fonts/Lato-OFL.txt), uses registered font aliases for both text and inputs, keeps the supplied artwork full-width, and measures brand height before placing the artwork. Helper/legal text has greater size/contrast and the inactive Continue state has a distinct visible blue.

expo-font ~14.0.12 is now a direct dependency, reusing the version already in the lockfile. Synchronize dependencies before the next launch. No dependency install, app launch, preview, build, or tests were run for this revision. The no-scroll layout remains. Visual/device behavior is not verified.

Suggested release follow-up: connect WhatsApp verification and valid legal destinations, or visibly identify their unavailable state; replace the code-drawn brand mark with the approved logo asset when supplied.
