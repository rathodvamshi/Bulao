# Phone login investigation — 2026-09-10

## Confirmed failure

The mobile app sends and verifies an OTP through the MSG91 widget, then calls
`POST /api/v1/auth/verify-widget-otp` to obtain a Bulao session.

A diagnostic request containing malformed JSON (no phone, OTP or credentials)
to the API configured in `mobile/.env` returned HTTP 401, `AUTH_REQUIRED`,
“Please sign in to continue.” Health returned HTTP 200. Trace ID for the failing
request: `e11b40b4-9cdc-447f-b223-60045937adf2`.

The local widget handler parses JSON before touching the database, so it would
return 400 for this request. The deployed behavior differs from the local code.
The trust router was also mounted at `/api/v1` with wildcard authentication,
which turned missing endpoints into misleading 401 responses.

This reproduces a Bulao API failure, not an MSG91 OTP rejection. A successful
real-device login still needs to be verified after deployment and app reload.

## Changes

- Register widget session exchange inside the auth router at both existing API prefixes.
- Require MSG91's access token, validate it server-side, and match the verified
  identifier to the entered number before creating a hashed Bulao session.
- Preserve existing widget accounts' country-code-plus-number representation.
- Apply trust authentication to its three protected routes, without masking missing routes.
- Pass the widget verification token from the mobile app instead of its send request ID.
- Keep proof only in memory while retrying a failed session exchange; remove OTP/token logs.
- Use country-code-plus-number for widget requests, and preserve the request ID
  when a successful resend only returns a status message.
- Publish the Bulao token before navigation; prevent an old request's 401 from
  logging out a newly established session.
- Distinguish backend deployment errors, provider configuration rejection,
  invalid proof, phone mismatch and provider availability errors.

Provider contract: [MSG91 Verify Access Token](https://docs.msg91.com/otp-widget/verify-access-token).
POST to `https://api.msg91.com/api/v5/widget/verifyAccessToken`, with the server
`authkey` header and JSON `access-token`. Documented success is
`{ "type": "success", "message": "919999999999" }`.

## Validation

- Backend and mobile TypeScript checks passed.
- Worker bundle passed using the installed esbuild resolved through Wrangler's real package path.
- Full configured test suite: 108 passed, 1 failed. The failure is the existing
  browser storage policy assertion: `authStorage.ts` uses browser persistent
  storage. The same storage code is present in HEAD and was not changed here.
- New regression tests cover the full widget route, session validation,
  missing proof, mismatched phone, provider failures, protected routes,
  mobile proof handoff, stale deployments and stale-session 401 responses.
- No OTP was sent and no live session was created by the diagnostic request.

## Deployment

The first staging deployment attempt was blocked because Wrangler had no
Cloudflare login/API token. Cloudflare sign-in is required to update the live
Worker. Reload the mobile app after the backend update so it sends verification
proof. Do not test using a pre-update OTP challenge.
