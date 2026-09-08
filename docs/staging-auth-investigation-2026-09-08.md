> Latest review: missing DLT Template ID confirmed in MSG91 SendOTP logs and template editor; backend fixes deployed and 93 tests pass. See [current auth review](auth-review-2026-09-08.md). Historical status and permission notes below are superseded where the new report states otherwise.

# Staging authentication investigation — 8 September 2026

Status: not end-to-end verified. Production was not accessed or modified during this investigation.

## Evidence

- User-supplied trace `1dde0ed4-4005-424f-9570-787dcb2a4637`: Send returned HTTP 200 / success, MSG91 transaction `3669686a58504e436f736733`. This proves acceptance, not SMS delivery.
- User-supplied Verify trace `bb9860c2-797b-40d2-ac7f-76b207f7f566`: MSG91 HTTP 500, Worker HTTP 503. Its root cause remains unconfirmed.
- Independently inspected the signed-in `bulao` dashboard: approved template `6a9e95cd898618ba1a007d22`, sender `Bulao`, wallet ₹50.
- SendOTP / All Logs, exact transaction ID, 7–8 September, India timezone: Nothing Here.
- Reports / Send OTP, 1–8 September: zero sent, delivered, failed, filtered and credit counts. SMS report initially also showed no data.
- Widget Analytics is a separate product report; its zero count does not establish failure of the existing-template API.
- KYC dialog explicitly requires KYC or manual verification to access features. This is a confirmed account activation issue, but is not yet proven to explain the missing transaction or Verify HTTP 500.
- AuthKey metadata is behind separate phone verification. The secret's ownership, key permissions and service activation cannot yet be confirmed. Cloudflare secret-list metadata does not reveal the stored key or prove account ownership.
- Read-only staging D1 aggregate query: 6 send-success events, 2 send-failure events, 2 verify-failure events; 0 users; 0 sessions. Queue/audit persistence works; successful authentication does not yet have evidence.

## Concrete fixes and validation

- Removed raw provider-response and provider-message logging; masked OTP in request diagnostics. Added an adversarial response/log-redaction regression test.
- Removed the undocumented requirement for clients to submit the provider request ID to Verify/Resend. Existing-template endpoints use mobile + OTP (Verify), or mobile + retrytype (Resend), with the auth header. Kept the provider transaction ID as diagnostic metadata and retained it across resend responses.
- Added `/api/v1/auth/me` as an alias of the existing authenticated session lookup.
- Retained phone/IP limits, cooldown, expiry, attempt limits, challenge checks, session hashing and queue bindings.
- Disabled legacy direct-provider diagnostic helpers that used an unverified account endpoint, unauthorized test numbers and raw response output. They were not executed.
- 92 database-free tests passed, zero failed, across nine suites. No real credentials/SMS/database calls in these tests.
- Backend and mobile TypeScript checks passed.
- 15 live staging endpoint checks passed: health/catalog; invalid send/verify/resend input; unsigned session/me/profile/logout; both auth route prefixes; browser CORS. These are not proof of authenticated endpoint success.
- Staging deployment: `7ff559c0-e981-4913-b9f9-98b64994c716`, Worker `bulao-api-staging`, D1 `bulao-dev`, staging audit queue producer/consumer.

## Remaining evidence required

1. Complete dashboard phone verification and inspect masked key metadata/service permissions. Confirm that the staging secret was provisioned from this exact company/key; do not reveal the key.
2. Complete the account's required KYC/manual verification directly with MSG91. Confirm LIVE status and OTP eligibility.
3. Locate the supplied transaction in provider records. If still absent, request MSG91 support to trace that ID and the separate Verify HTTP 500. No support message has been sent.
4. Only then run a new authorized real-phone attempt. User confirms receipt and enters the OTP in the app. Never infer delivery from API success.
5. Verify correct/wrong/expired OTP, resend, cooldown/limits, new and existing-user login, D1 user/session creation, authenticated me, logout invalidation and audit persistence. Behavioral contracts pass mocked tests; these live scenarios remain pending.

## Diagram corrections

Send creates a temporary challenge in a hosted Durable Object, not an authenticated D1 session. A successful Verify creates an opaque random session token; D1 stores its hash, not a JWT or plaintext credential. `AUTH_HASH_KEY` creates keyed phone/IP fingerprints. Queue events reflect application actions; a send-success audit event means provider acceptance, not handset delivery.

Sources: [MSG91 Verify API](https://docs.msg91.com/otp/verify-otp), [SendOTP reports](https://msg91.com/help/sendotp/where-to-find-sendotp-reports), [MSG91 KYC FAQ](https://msg91.com/help/msg91-common-faq-s).
