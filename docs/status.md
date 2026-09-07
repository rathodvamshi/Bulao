> Authentication revision: [Cloudflare + MSG91 setup](auth-setup.md) supersedes the older development-authentication, six-digit OTP, local database, and deployment-status statements below. The new code has not been tested or deployed. Legacy local integration tests are disabled.
# Delivery status

## Verified locally
- Strict TypeScript checks for domain, Worker and Expo application.
- 21 passing unit/integration tests across five files: authentication/session boundaries, OTP abuse limits, geographic edge cases, job/service journeys, two-party reviews, blocking, database capacity constraints, privacy and provider mocks. Development test sign-in rejects public deployment hostnames.
- Expo web production export. Browser preview loads the app, gets database localities and verifies development phone authentication.
- SQL migrations applied to the local Wrangler D1 instance; the real local Worker starts and answers API health.
- The loopback-only smoke script exercises real local Workers/D1 OTP, publishing retries, applications, two-way completion, reviews, service requests and logout; its explicit LOCAL QA fixtures remain in the local database.
- Job capacity and completion also move the parent job through FILLED and COMPLETED in the real local D1 smoke test. The migration was corrected for Wrangler's whitespace-sensitive CASE statement parser, then successfully applied.
- Worker packaging dry-run succeeded (no deployment); gzip bundle approximately 86 KiB at this checkpoint.

## Implemented, needs provider/device verification
- MSG91 send/verify adapter and configured approved template ID. Only mock calls are tested. Rotated staging auth key and a controlled real-phone delivery test are required.
- Cloudinary signed authorization, owner-bound upload intent, metadata verification, optimized URLs and photo-picker UI. Needs the restricted signed upload preset, rotated secrets and an end-to-end real image test. Portfolio/gallery UX is not implemented.
- Native Expo GPS, SecureStore, image picking and phone dialer need Android/iOS device tests. Expo web does not substitute for native verification.
- GitHub Actions and EAS configuration are present; no remote CI run, EAS build or store submission has occurred.

## Not implemented / release gates
- Native Google Maps and MapLibre/MapTiler renderers, geocoding and provider telemetry ingestion. Only provider-selection policy/interface/tests exist. Lists work without maps.
- Full filter set (role, pay, date, availability), custom calendar/time picker and service-problem chips; current UI supports category/radius and simple date/time choices.
- Persisted offline cache/drafts, session refresh/expiry UX, complete localization of remaining short labels, restored navigation intent after onboarding.
- Cursor pagination for large activity/review histories and keyset pagination for changing discovery data; current lists are bounded and discovery uses candidate offsets.
- Push notifications, reminder delivery, product analytics, reports moderation UI, suspension management, provider reconciliation and alerting. Minimal usage API is server-admin-only; no full operations dashboard.
- Retention/deletion jobs for OTP challenges, sessions, counters, upload intents and abandoned images; account deletion, privacy/consent policies, backup/restore drill and production WAF/rate rules.
- Production database/origin/secret provisioning, commercial fallback-map plan, external integration failure drills, abuse/load/accessibility/device E2E checks and independent security review.

No remote D1 migration or Worker deployment was performed. Existing local test records are fixtures, not real marketplace activity. Do not present this development implementation as production-ready.

## Migration maintenance
Wrangler applies committed SQL files in filename order. Triggers and integrity rules are intentionally explicit SQL. `0001_cloudy_ravenous.sql` is a no-op marker that reconciles Drizzle's generated snapshot with the reviewed custom migrations; it must not be replaced with duplicate generated DDL. Future schema changes should be generated, reviewed alongside the custom triggers, and tested on a fresh SQLite/D1 database and an existing migrated database before deployment.


## Provisioning checkpoint — 2026-09-07

Cloudflare created `bulao-production` (APAC), ID `4d2491e2-a3f9-4ff3-9978-828d1b24f1d1`. The existing `bulao-api-production` Worker now has a `DB` binding pointing to this ID; settings were read back successfully. No production database queries/test data or application migrations were used for this verification. `bulao-dev` was not modified.

The local authentication revision includes the confirmed MSG91 template adapter, four-digit UI, coordinated limits, D1 session migration, and queued audit handler. It is not deployed. Both Workers were found to have no secrets configured. Queue resources and the new Durable Object namespace still need provisioning when preparing the application deployment. The mobile public API setting now points to staging. User approval is required before any tests, typechecks, or UI checks; user will test UI manually. Any staging schema migration must also be explicitly cleared because the user requested that `bulao-dev` not be modified.

## Validation checkpoint — 2026-09-07

The authorized database-free validation is complete: 77 tests passed, 0 failed, three TypeScript checks passed, Worker bundle and Expo web export passed. Malformed provider response handling and final-attempt interruption lockout were fixed and regression-tested. See [validation report](auth-validation.md). No deployment, production changes, database calls, live credentials, or SMS were used in this validation turn. Secret configuration and approved staging provisioning/integration remain next.
