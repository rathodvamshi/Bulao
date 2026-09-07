# Authentication validation — 2026-09-07

Final result: **77 tests passed, 0 failed, across 8 suites. Three TypeScript checks and two local builds passed.**

No deployment, Cloudflare provisioning, migration, database execution, real credential access, live MSG91 call, SMS, or production traffic occurred during this validation turn. UI behavior was not manually tested; that remains with the user.

## Checks performed

| Check | Result |
| --- | --- |
| Backend TypeScript | Pass, including rerun after fixes |
| Mobile TypeScript | Pass |
| Shared domain TypeScript | Pass |
| Worker esbuild bundle | Pass, local compilation only |
| Configured Expo web export | Pass; dotenv loading and telemetry disabled |
| Lint | No lint script/configuration is configured |
| Database-free Vitest | 77 passed / 0 failed / 8 suites |
| Compiled mobile bundle provider-secret reference scan | Pass |

Test breakdown: auth API/session/audit contracts 29; OTP coordinator 19; provider error handling 8; configuration/security 4; phone/OTP validation 4; MSG91 adapter 4; shared domain 6; existing image-provider boundary 3.

Coverage includes send/verify/SMS resend with mocked responses, four-digit validation including leading zeros, five-minute expiry boundaries and expiry during verification, cooldown, rolling phone/IP limits and daily ceiling, five-attempt blocking, replay rejection, operation lease protection, provider outages, unique random session credentials, hashed persistence inputs, session rejection/revocation contracts, safe errors and logs, asynchronous audit failure/retry/ACK behavior, phone normalization, exact CORS origins, no-store responses, and environment isolation.

The global fetch guard rejects unexpected network calls. Auth repository functions are replaced with mocks; a throwing DB proxy asserts zero DB-method accesses in every API/audit test. Coordinator tests use mocked storage callbacks over test fixtures, not a SQL engine or local database. No emulator was started. Persistence SQL/index predicates were inspected as source contracts only: actual D1 transactions, migrations, duplicate-user constraints, audit idempotency and cross-instance coordination still need approved staging integration verification.

## Errors found and fixes

- A regression test exposed an unsanitized TypeError for a null MSG91 JSON response. The provider now validates response structure inside its error boundary and returns the generic provider-unavailable error for malformed responses. All provider-error tests pass.
- Code review found that an interrupted final verification attempt could leave the phone without its persisted lockout. The coordinator now reserves the ten-minute block together with the fifth attempt, clears it on successful verification, and keeps it after an interrupted operation. A regression test covers lease expiry and restart from the persisted fixture.
- Extracted auth persistence into a D1 repository boundary so session and audit control flow can be exercised without database calls. Production behavior continues using the same parameterized D1 statements and atomic batch.
- Added 60 tests beyond the original 17, a network-denial test setup, and a local Worker build script.

The Expo build emitted only harmless terminal color-environment warnings. One test-file write initially used the wrong relative path and was corrected before the final run; it did not change application behavior.

## Readiness

Ready for secret configuration: **yes**. MSG91_AUTH_KEY and an environment-specific AUTH_HASH_KEY belong only in Cloudflare Worker secrets.

Ready for staging deployment: **code checks pass, but deployment is gated**. Configure the secrets, provision the audit/dead-letter Queues, confirm browser CORS origin if web preview is used, and obtain explicit approval for staging migrations and deployment. The existing instruction protecting bulao-dev still applies. Deployed integration behavior is not proven by these database-free tests.

Production: unchanged in this turn; no production testing or deployment is approved. Wait for the user to approve these results before deploying anything.

## Reproduction from workspace root

Use the installed Node CLI directly (the host pnpm wrapper may try to reinstall dependencies):

```text
node node_modules/typescript/bin/tsc -p backend/tsconfig.json
node node_modules/typescript/bin/tsc -p mobile/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json
node scripts/check-worker-build.mjs
```

From backend: `node node_modules/vitest/vitest.mjs run`.
From mobile: set EXPO_NO_DOTENV=1, EXPO_NO_TELEMETRY=1 and the public staging API URL, then run `node node_modules/expo/bin/cli export --platform web`.
