> Latest review: missing DLT Template ID confirmed in MSG91 SendOTP logs and template editor; backend fixes deployed and 93 tests pass. See [current auth review](auth-review-2026-09-08.md). Historical status and permission notes below are superseded where the new report states otherwise.

> Validation update: 77 database-free tests, three TypeScript checks, and two local builds passed. See [validation report](auth-validation.md). No deployment is approved. The earlier testing-pending notes below describe the implementation checkpoint before this validation.

# Cloudflare + MSG91 authentication setup

Implementation status: authentication code written; tests/typechecks and application deployment await user approval. Production D1 was created and attached to the existing production Worker; the binding was verified through Cloudflare settings readback. No D1 migrations, database queries, or SMS calls were executed. Staging D1 was not modified.

## Confirmed environments

| Environment | Worker API | D1 | Database ID |
| --- | --- | --- | --- |
| Staging | https://bulao-api-staging.codecheck369.workers.dev | bulao-dev | 87983e8a-6759-4d17-a482-769b8bd31463 |
| Production | https://bulao-api-production.codecheck369.workers.dev | bulao-production | 4d2491e2-a3f9-4ff3-9978-828d1b24f1d1 |

Production `DB` binding was verified via Cloudflare API metadata, without production test traffic. The application code and migration `0006` are not deployed/applied. Cloudflare secret-name listings showed no secrets on either Worker at the time of this check.

The user confirmed the approved existing Bulao template, Sender ID Bulao, four digits, and five-minute expiry. Do not use MSG91 Widget.

## Remaining setup and provisioning

1. Use the confirmed staging API for all development/testing. Production application deployment and migrations remain gated on staging verification and confirmation.
2. The MSG91 template configuration is confirmed. Actual delivery still awaits a separately approved live SMS check.
3. Use only the existing template-based SendOTP/Verify/Retry APIs. No MSG91 Widget integration is planned.
4. Supply the browser preview origin if web preview will call staging. Native mobile requests do not require an Origin header. CORS is an exact allowlist, not authentication.
5. Provision `MSG91_AUTH_KEY` and `AUTH_HASH_KEY` as Worker secrets. Generate the latter with a cryptographically secure password generator, at least 32 characters. Never paste either into chat or client code. Keep the hash key stable: rotating it changes rate-limit object identities and audit fingerprints.

## Remote staging provisioning

The following commands are instructions, not commands already executed. Run from `backend` after confirming account/setup. They create Cloudflare resources and apply remote schema changes.

```sh
pnpm exec wrangler queues create bulao-auth-events-staging
pnpm exec wrangler queues create bulao-auth-events-staging-dlq
pnpm exec wrangler secret put MSG91_AUTH_KEY --env staging
pnpm exec wrangler secret put AUTH_HASH_KEY --env staging
pnpm exec wrangler d1 migrations apply DB --remote --env staging
pnpm exec wrangler deploy --env staging
```

The Worker creates its bound Durable Object namespace via the `v1-auth-coordinator` migration. `new_sqlite_classes` selects Cloudflare's hosted Durable Object storage backend. It does not create a local SQLite database. The D1 schema uses SQLite-compatible SQL on Cloudflare through the `env.DB` binding; Drizzle's sqlite-core is a schema DSL, not a local database connection.

Before deployment, replace the staging `ALLOWED_ORIGIN` placeholder with the exact approved HTTPS web origin (scheme, host, optional port; no trailing slash). If browser preview is unused, the placeholder permits no real browser origin. Configure Cloudflare edge rules to enforce HTTPS and apply account-level bot/abuse protection according to the account's available plan.

Set only the public backend URL in the mobile environment:

```text
EXPO_PUBLIC_API_BASE_URL=https://<deployed-worker-host>/api/v1
```

Restart/rebuild Expo after changing public environment values. The public API URL in mobile `.env` now points to the confirmed staging Worker; unrelated environment values were preserved. Existing local `.dev.vars` and `.wrangler` artifacts were not read or deleted. They are not used by the new workflow. `pnpm dev:api` now stops with guidance; do not invoke local Wrangler or local migrations directly.

The explicit `env.production` configuration now contains the confirmed Worker and new D1 ID, plus isolated Durable Object and audit/dead-letter Queue bindings for the later application deployment. Provision environment-specific secrets. Confirm the browser origin before browser testing. Apply production migrations and deploy application code only after staging validation and confirmation.

## API contract

Both `/api/auth` and the existing `/api/v1/auth` prefix are supported. All calls use HTTPS. Preserve the opaque challenge reference from send through resend/verify. Phone normalization accepts ten-digit Indian mobile numbers, `91` prefix, or `+91` prefix, with spaces/parentheses/hyphens. It rejects other countries and numbers not starting with 6–9.

```text
POST /send-otp     { phone }
POST /resend-otp   { phone, requestId }
POST /verify-otp   { phone, requestId, otp: "0123" }
GET  /session     Authorization: Bearer <session token>
POST /logout      Authorization: Bearer <session token>
```

Send/resend return `{ success: true, data: { requestId, expiresIn, resendAfter, otpLength }, error: null, requestId: <trace ID> }`. The nested `data.requestId` identifies the OTP challenge; the top-level `requestId` and `X-Request-Id` identify each HTTP operation. Provider references are never exposed. Verification returns `data.token`, `data.expiresAt`, and minimal `data.user`. Errors use `{ success: false, error: { code, message, retryAfter? }, requestId }`. Rate-limit responses include `Retry-After` seconds.

The extra challenge reference is deliberately required: phone plus OTP alone cannot select an old or unrelated challenge. Legacy six-digit `challengeId/code` clients must upgrade with this release.

## Data and concurrency

- `AUTH_POLICY` centralizes four digits, five-minute expiry, 60-second resend cooldown, three sends per phone per ten minutes, ten sends per phone per day, ten sends per IP per ten minutes, and thirty verification requests per IP per ten minutes.
- Five verification attempts per challenge; unsuccessful exhaustion blocks the phone for ten minutes. Provider errors also spend an attempt to prevent unlimited retries during ambiguous failures.
- A Durable Object keyed by an HMAC phone fingerprint persists send history, one challenge, attempts, expiry, and a short operation lease. Another object keyed by an HMAC IP fingerprint persists IP limits. Transactions reserve work before the provider call; a lease serializes send/resend/verify without holding a transaction across network I/O.
- A new send invalidates old challenges. Resend uses MSG91 SMS retry and does not extend Bulao's expiry or reset attempts. Success consumes the challenge before creating a session. If the client loses the verification response or D1 fails afterward, it must request a new OTP; consumed challenges cannot mint a second session.
- D1 atomically upserts users and inserts sessions in a batch. Existing `users.phone` is unique E.164; `suspended` is the existing account-status field. Existing table names remain `users` and `sessions` to preserve marketplace relationships.
- Session tokens contain 256 random bits. Only SHA-256 hashes enter D1. Sessions expire after thirty days, are revocable, and are rejected immediately for suspended accounts.
- Native SecureStore contains only the session credential. No profiles, phones, OTPs, or application records are persisted on the device. Browser sessions are transient and end on reload. React state/query results are transient rendering state, not an application database.
- Audit events use a Cloudflare Queue, with idempotent D1 inserts and a dead-letter queue. They contain keyed hashes, safe event/error codes, IDs, and timestamps, never phone/IP plaintext, OTPs, provider keys, or session tokens. Enqueue failures emit a safe log; audit delivery is best effort if Queue enqueue itself is unavailable. Monitor that log and the dead-letter queue.
- No KV binding is added: no public configuration cache is needed for this change, and authentication state needs strict coordination. No extra queue is used for SMS; delivery/verification stays synchronous with MSG91.
- Expired Durable Object state is automatically removed by alarms. D1 session/audit retention needs an approved operational policy and scheduled cleanup before long-term production operation. Legacy D1 challenge/cooldown tables are unused and retained for a separately reviewed cleanup migration.

## Validation awaiting permission

Ask before running any of these checks. UI testing belongs to the user.

Database-free automated checks proposed: workspace TypeScript checks; phone/OTP normalization and sliding-window boundary tests; mocked MSG91 send/verify/resend/error handling. These do not send SMS or create a database. Old local SQLite/API suites are excluded, the local database harness is disabled, and the old smoke command stops immediately. Remote concurrency/integration coverage has not replaced those suites yet.

User manual UI checks after staging setup:

1. Continue stays on the phone screen when delivery fails; invalid Indian numbers are rejected.
2. Receive four SMS digits; paste/autofill them, submit the real OTP, and reach the profile only after server success.
3. Wrong and expired codes remain signed out; verify cannot submit fewer than four digits.
4. Resend waits for the server cooldown, is disabled during requests, and does not extend the original expiry. After expiry, request a new OTP.
5. Change the number and confirm an earlier code cannot authenticate the new number.
6. Restart the native app and restore a valid session. Offline restoration shows Retry. Logout revokes the server session; subsequent requests require login.
7. Check keyboard, scrolling/layout on smaller devices, accessibility labels, and Android/iOS autofill.

Remote backend checks require separate approval and can incur SMS costs: racing sends/resends/verifications; replay after success; five-attempt lockout and cooldown expiry; separate phone/IP limits; duplicate-user protection; suspended/expired/revoked session rejection; D1 rollback and provider timeout behavior; CORS/no-store/error redaction; Queue retries and dead-letter monitoring. Do not label this production-ready before those checks.

## Official references

- [MSG91 OTP setup and Widget recommendation](https://msg91.com/help/sendotp/step-by-step-process-to-configure-otp)
- [SendOTP](https://docs.msg91.com/otp/sendotp), [Verify OTP](https://docs.msg91.com/otp/verify-otp), [SMS retry](https://docs.msg91.com/otp/resend-otp)
- [MSG91 Widget flow](https://docs.msg91.com/otp-widget)
- [Cloudflare Durable Object coordination](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)


## Staging database protection

The user explicitly requested that `bulao-dev` not be modified or deleted. The remote migration command above is a future provisioning instruction only. Obtain explicit clearance before applying staging schema migrations; do not interpret approval for database-free tests as approval for D1 changes. No production test traffic is permitted.
