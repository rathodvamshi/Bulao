# Authentication review — 8 September 2026

Status: backend fixes deployed to staging; SMS delivery is blocked by a confirmed missing DLT template mapping in MSG91.


## Confirmed delivery root cause

**SendOTP -> All Logs** shows requests in Pending state with pause reason **DLT Template id not found**:

| Time (IST, 8 Sep 2026) | Provider request ID | Status | Pause reason |
| --- | --- | --- | --- |
| 18:54:02 | 3669687232626833384c5767 | Pending | DLT Template id not found |
| 18:40:35 | 366968724e4963644b636535 | Pending | DLT Template id not found |
| 18:05:52 | 36696872655a444a494b4178 | Pending | DLT Template id not found |

The 18:40:35 request matches the exact provider reference in Cloudflare. Each row uses template `6a9e95cd898618ba1a007d22`, sender Bulao, country India, has no DLT TE ID or delivery timestamp, and is unverified. This directly explains acceptance without dispatch for those requests; it supersedes the earlier suspicion about empty reports/account credentials.

The template's editor shows **DLT Template ID is blank**. Its status is “Approved by MSG91”; that label does not establish DLT approval. SMS content is `Your Bulao verification code is ##OTP##. Do not share this code with anyone.`

Completion requires the actual DLT-approved content-template ID, matching approved message and sender/header. The user has been asked for these details. Do not guess an ID or insert the MSG91 template ID into the DLT field. Do not replace the Worker's MSG91_TEMPLATE_ID with a DLT number. No MSG91 template changes were saved.

After mapping the approved details and resolving any resulting validation, send a fresh code: old challenges have expired. Verify receipt, login, D1 user/session creation and logout. Until then, authentication is not end-to-end operational.

MSG91 documents this failure and the distinction between template identifiers: [Template ID not found on DLT](https://msg91.com/help/dlt-registration-in-india/error-description-template-id-not-found-on-dlt), [DLT mapping by API version](https://msg91.com/help/dlt-registration-in-india/map-sms-content-template-on-msg91-api-panel).

## Verified this review

- Signed-in Cloudflare: `bulao-api-staging`, `APP_ENV=staging`, `OTP_PROVIDER=msg91`, expected template, encrypted `AUTH_HASH_KEY` and `MSG91_AUTH_KEY`, enabled persisted invocation logs at 100% sampling.
- Bindings: hosted `AUTH_COORDINATOR`, `AUTH_EVENTS` producer/consumer on `bulao-auth-events-staging`, and D1 `bulao-dev` (`87983e8a-6759-4d17-a482-769b8bd31463`).
- D1 read-only checks: auth migration `0006_production_auth.sql` recorded; users/sessions/auth_events tables and expected columns present. Zero users, zero verified users, zero sessions, zero active sessions at the check. No schema changes or test account inserts performed.
- Audit totals at the check: 11 send successes; 12 send failures with PROVIDER_UNAVAILABLE; 9 send failures and 1 resend failure with OTP_RATE_LIMITED; 2 verify failures with PROVIDER_UNAVAILABLE; no successful app verification event.
- User confirms the app reaches the four-digit screen but the SMS does not arrive. A successful send response is provider acceptance, not handset delivery.
- Cloudflare historical logs include native-fetch receiver and unsupported redirect-mode errors, followed by a SendOTP HTTP 200 success at 18:40:35 IST. Provider reference: `366968724e4963644b636535`. It is not definitively correlated to the user's most recent attempt because no attempt timestamp was supplied.
- MSG91 `/otp/analytics`: 4 SMS OTPs sent and 1 verified for 1–8 September. Desktop navigation establishes this page belongs to **OTP Widget/SDK**, not the direct SendOTP API. Do not use it to validate this backend.
- MSG91 SMS report for 1–8 September: no records, zero counts. This is also not a transaction-specific SendOTP delivery receipt.
- MSG91 home: one SMS alert, “Invalid username or password or authkey Error 201.” Its request association is unknown; it does not prove the current SendOTP key is invalid.
- MSG91 AuthKey metadata: Bulao key enabled, Owner rules, IP security OFF, no whitelist. The stored Cloudflare secret value is not readable via secret metadata, so account/key equality remains unverified. No key was revealed, replaced, or created.

## Corrections delivered

- Removed query strings from MSG91 request diagnostics. The previous logger masked mobile but exposed the OTP during Verify.
- Invoke injected transport without the provider instance as its receiver; default fetch is wrapped. Keep Workers-compatible `redirect: manual` and fail closed on every redirect without forwarding credentials.
- Correct `OtpProvider.send()` to `Promise<string>` to match transaction ID handling. Backend typechecking previously failed on this contract.
- Updated stale redirect tests to assert rejection and one transport call; retained regression coverage for reflected credentials, malformed responses and raw-response redaction. Removed obsolete provider request-ID arguments in tests.
- Removed the unused MSG91 React Native SDK from the mobile manifest and lockfile. Removed unnecessary provider transaction metadata from mobile Verify/Resend payloads. Worker challenge `requestId` remains required.
- Mobile text says “OTP requested” instead of asserting delivery.
- Ignore `secrets.json` in Git. The pre-existing file was not printed or committed.
- Relabeled the existing seven-check script as a smoke test, with an explicit reminder that it does not test real login.

## Validation and deployment

- Initial full suite: 89 passed, 4 failed. After fixes: **93/93 passed across 9 suites**. These are database-free tests with mocked provider/storage boundaries, not carrier or remote-D1 lifecycle tests.
- Backend and mobile TypeScript checks passed. Mobile manifest and lockfile consistency checked with the installed YAML parser.
- Wrangler staging build passed.
- Deployed version `cfe1c0e8-ca98-477d-8f10-80c221043d1d` to staging with existing variables/secrets preserved. Previous version: `f6678708-319b-4ae7-b46e-51fc1e3dfdbf`.
- Post-deploy smoke checks: **7/7 passed** (health, invalid send/verify/resend, unsigned session/me/logout).
- Production was not deployed or queried. Mobile source changes require Expo reload/rebuild; native device execution was not independently verified.

## Actual API flow

Mobile -> POST /api/v1/auth/send-otp {phone} -> Worker validates and normalizes Indian phone -> HMAC-keyed IP/phone Durable Objects enforce limits -> MSG91 existing-template API accepts send -> return temporary challenge.

Mobile -> POST /api/v1/auth/verify-otp {phone, requestId, otp} -> Worker checks challenge/expiry/attempt budget -> MSG91 verifies -> consume challenge -> D1 atomic user upsert and hashed-session insert -> return opaque random session token -> native SecureStore.

GET /auth/session and /auth/me validate Bearer token against an unrevoked, unexpired session and verified, unsuspended user. POST /auth/logout revokes it. Browser sessions are memory-only; native sessions restore through SecureStore plus server validation.

Policy: four digits, five-minute expiry, 60-second resend cooldown, 3 sends/phone/10 minutes, 10 sends/phone/day, 10 sends/IP/10 minutes, 30 verifies/IP/10 minutes, 5 verification attempts/challenge and a ten-minute lockout. Sessions last 30 days. Resend does not extend challenge expiry.

## Remaining completion criteria

1. Map the user-provided DLT-approved content template ID, matching sender/header and exact text in the existing MSG91 SendOTP template. The missing mapping has been confirmed in its editor and transaction logs.
2. Resolve account/provider delivery restrictions, then one real app send with timestamp and request trace. User receives and enters the code in the app, not in chat.
3. Confirm first-user creation, subsequent login without duplicate user, new session, authenticated session/me, native restore, server logout/revocation, replay rejection and audit success. Resend, wrong-code/expiry and device autofill remain live acceptance checks.
4. Agree production origin and retention/cleanup policies before production rollout. Expired/revoked D1 sessions and audit records currently have no scheduled retention cleanup.

## Support follow-up draft (not sent)

Our Cloudflare staging Worker uses the existing-template Direct OTP API. MSG91 SendOTP -> All Logs shows requests `366968724e4963644b636535` (2026-09-08 18:40:35 IST) and `3669687232626833384c5767` (18:54:02 IST) as Pending with pause reason “DLT Template id not found.” Both reference MSG91 template `6a9e95cd898618ba1a007d22`, sender Bulao. That template is Approved by MSG91 but its DLT Template ID field is blank. Please confirm the DLT-approved content template and header/entity mapping required for this account, and validate it once our approved details are supplied. Please also confirm whether any pending sends need action after correction, and provide delivery status for a fresh post-fix test. Widget analytics are unrelated to this Direct API flow. Do not request API keys or OTPs in email/chat.
References: [MSG91 SendOTP report instructions](https://msg91.com/help/sendotp/where-to-find-sendotp-reports), [Cloudflare fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/), [MSG91 Verify API](https://docs.msg91.com/otp/verify-otp).
