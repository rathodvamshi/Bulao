> Authentication revision: [Cloudflare + MSG91 setup](auth-setup.md) supersedes the older development-authentication, six-digit OTP, local database, and deployment-status statements below. The new code has not been tested or deployed. Legacy local integration tests are disabled.
# Bulao implementation design

## A. Architecture and repository assessment
The supplied workspace contains only `.git`; there is no application to migrate. Start a TypeScript npm-workspace modular monolith: Expo client → REST Worker → Drizzle → D1. Clients never hold database credentials. Marketplace participation requires a verified phone and active session; anonymous discovery is permitted. One person can hire, work and offer services without changing account roles.

## B. Structure
`mobile/app` contains Expo Router screens; `mobile/src` contains UI, API, localization, location and session modules. `backend/src/modules` owns auth, jobs, services and trust. `backend/src/db` owns schema; SQL migrations are committed. `packages/domain` owns validation and state transitions used by backend and tests. `docs` owns contracts and rollout decisions.

## C. Data model
Users have unique normalized phone numbers and suspension state. Profiles hold name and area. Sessions store token hashes and expiry. Categories and roles are seeded configuration. Jobs belong to an owner and category/role; applications uniquely pair job and worker. Service profiles pair user/category; requests pair customer/provider. Each accepted application/request is itself an interaction with two completion confirmation timestamps. Reviews reference exactly one interaction, target the other participant, require both confirmations, and are unique per author/interaction. Ratings are computed from reviews, never independently writable. Blocks are directional unique pairs, enforced in both directions for discovery and new interactions. Reports record reporter, target and reason. Provider usage is aggregated per provider/service/day, without credentials or phone numbers.

Money uses integer paise plus INR and a payment unit. Dates are UTC epoch seconds; UI uses local time. Precise coordinates stay out of public responses; public listings expose area and rounded distance. Index published/category/latitude and interaction participant/status query patterns. Foreign keys, unique constraints and conditional writes defend concurrent requests.

## D. API contract
Version prefix `/api/v1`. Responses `{success,data,error}`. Errors contain stable `code` and safe `message`. Bearer sessions are opaque random 256-bit tokens; store only SHA-256 hashes server-side. Lists use bounded pagination. Mutations use uniqueness and compare-and-set state transitions; never automatically retry a publish or OTP send.

| Method | Path | Purpose |
|---|---|---|
| POST | /auth/send-otp | Phone → challenge ID; cooldown and expiry |
| POST | /auth/verify-otp | Challenge + code → session + user |
| POST | /auth/logout | Revoke current session |
| GET/PATCH | /users/me | Read/update own basic profile |
| GET | /categories | Job categories/roles, service categories, locations |
| GET/POST | /jobs | Nearby search / publish validated job |
| GET | /jobs/:id | Job + owner trust summary |
| POST | /jobs/:id/apply | Unique application, no self application |
| GET | /activity | Own jobs/applications/requests |
| POST | /applications/:id/action | accept/reject/withdraw/start/confirm/cancel |
| GET/POST | /services | Search / create professional profile |
| POST | /service-requests | Request one selected professional |
| POST | /service-requests/:id/action | accept/reject/start/confirm/cancel |
| POST | /reviews | Two-way review after confirmed completion |
| POST | /reports, /blocks | Report or block another account |
| GET | /admin/usage | Server-authorized operational usage |

Acceptance reserves a job slot atomically; no more than worker_count can be accepted. Jobs and interactions are distinct state machines. Interaction states: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED, or PENDING → REJECTED/WITHDRAWN, with authorized cancellation before completion. First confirmation leaves IN_PROGRESS; second makes COMPLETED. Completion cannot be undone or repeated to inflate reputation.

## E. Authentication
Development uses explicit allowlisted test phones and a test OTP only in development. Nondevelopment fails closed without configured provider. MSG91 adapter must verify delivery/verification responses; Firebase uses client verification plus server verification of Firebase ID token (not a fictitious server SMS API). Bind each challenge to one provider; do not retry an uncertain SMS send with another vendor. Hash tokens, expire sessions, revoke at logout and reject suspended users. D1 atomic counters enforce send/verify limits before contacting paid providers. OTP values and auth headers are never logged.

## F. Location
Expo Location requests foreground permission after explanatory copy. Manual selection uses configured locality centroids and labels. GPS does not require reverse geocoding: an area label can be selected separately. D1 bounding-box candidates are followed by exact Haversine filtering in the Worker. Search uses deterministic bounded candidate cursor pagination with an explicit next cursor; never silently claims exhaustive nearest sorting after truncating candidates. Handle longitude wrap/poles. Service eligibility respects both search radius and professional travel radius. No background tracking.

## G. Maps
List discovery remains usable without maps. Map rendering and geocoding are separate interfaces. Central policy chooses Google or MapLibre/MapTiler based on server-supplied enabled status, observed usage, limit, freshness and configurable safety fraction. Stale/missing telemetry must not be advertised as healthy; omit maps if no configured provider is safe. Normal validation/zero-result responses are not outages. Native MapLibre and Google require development builds and independently restricted public SDK keys. Never display Google geocoding data on fallback maps without verifying applicable terms.

## H. External providers
OTP: send/verify challenge. Storage: authorize upload, verify asset ownership, return allowed thumbnail/medium/full URLs, delete. Notifications: send event with dedupe key. Maps: rendering policy and geocoding. Implement real adapters only with testable documented vendor contracts; unavailable providers fail explicitly, never fabricate successful delivery. Cloudinary signed uploads restrict type, size, owner folder; backend verifies asset before storing metadata. R2 is reserved for private documents with short-lived access.

## I. Cost
Do all marketplace search, filtering and distance calculation internally. Categories/localities cache 24 hours; invalidate by version. Auth and activity are private/no-store. Debounce text search, 20-item pages, resized images. No geocoding on GPS updates. Track attempted provider calls separately from successful calls and provider-reported billing. Configure quota safety fractions, never embed monetary assumptions in business rules. Unknown credits are unknown, not zero. Official pricing sources and commercial limitations are in `costs.md`.

## J. Security
Validate with Zod, parameterized SQL/Drizzle, exact ownership checks, bounded request sizes and query ranges. Unique constraints stop duplicate applications/reviews. Database triggers protect multi-statement race-sensitive invariants. Enforce blocks server-side. Public DTOs omit phones/exact addresses. SecureStore holds native tokens. Restrict CORS origins, return safe error envelopes and request IDs; log route template/status/latency/code only. Production requires WAF/rate-limit deployment, secret provisioning, retention/deletion policy, backup/restore drill and independent security review. Do not call an unprovisioned local build production-ready.

## K. UX/navigation
Four tabs: Home, Explore, Activity, Profile. Home asks Find Work / Hire Someone / Find a Service. Browse before signing in; meaningful actions route through short phone/name onboarding. Persistent visible area. Job posting uses role → location → date/time → headcount/pay → optional details → review. Service offering uses category → area/radius → experience/availability → review. Apply/request review before confirming; success links to Activity. Every fetch has loading/error/retry/empty handling. Mutations disable during submission and do not imply success until confirmed. English string dictionary is the initial translation layer, flexible layouts and 48px minimum buttons.

## L. Delivery phases
1. Foundation, schema, contracts and test harness.
2. Development auth, secure sessions, basic profile.
3. GPS/manual area and bounded geosearch.
4. Job publishing, discovery, applications and owner actions.
5. Service profiles, requests and state transitions.
6. Two-way completion, reviews, report/block.
7. Verified image upload adapter and optimized delivery.
8. Native map integrations, telemetry-driven provider choice.
9. Provider staging integration, E2E on Android/iOS, load/security/accessibility testing and EAS/store rollout.

No payments, chat, AI matching, microservices or wallet in V1. Implement and validate in this sequence; record unverified production dependencies honestly in the delivery status.

