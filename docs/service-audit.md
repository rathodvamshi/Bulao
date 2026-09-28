# Service audit and implementation contract

## Read-only audit (23 September 2026, before implementation)

Architecture: Expo Router screens call the generic mobile API client, Hono routes execute raw D1 SQL or Drizzle queries, and Cloudflare D1 persists SQLite tables. There is no separate service repository. Existing uncommitted work is preserved.

Confirmed issues:
- Discovery selects users.phone regardless of phone_visible. Interaction detail/list, activity and public profile also bypass the setting after acceptance.
- Public service detail reads an unset auth context; it does not check suspension, blocking or availability. Errors become misleading 404s; search errors become successful empty arrays.
- Search uses fixed Hyderabad coordinates, ignores server pagination, invents missing mode/verification/name/location, and counts completed work as reviews. Search categories do not match database IDs.
- Detail calls a hardcoded phone number. Booking uses provider/fallback coordinates. Search retries alternate write endpoints.
- Create silently substitutes categories, coerces raw phoneVisible, and retries partial inserts that lose fields. Create and patch validation diverge. Social values live in wizard state while social_links is unused.
- Drizzle declares user/category unique although migration 0012 explicitly removes uniqueness. Active-request uniqueness already exists in migration 0001; do not invent a second duplicate mechanism.
- Delete routes disagree and can erase request history or fail foreign keys. Requests lack creation notifications. Shared job notification wording is used for services.
- Ratings include provider-authored reviews of customers; any stranger can submit a service rating. Report endpoint writes rating IDs into a users foreign key and returns success on failure.
- Legacy offer form and unused detail modal compete with the wizard/detail implementation. ManageServices uses POST for a PATCH operation.
- Dashboard suggestions display invented ratings/distances. Migration 0011 backfilled hours/mode/prices; provenance of existing values is unknown.
- Existing catalog seeds are categories/roles/location choices, not evidence of actual provider offerings. No live database inspection has been performed.

## Canonical contract and endpoint map

| Screen / operation | Endpoint | Persistence |
|---|---|---|
| Wizard create/edit | POST /services, PATCH /services/:id | service_profiles, authenticated user ownership |
| My collection / owner detail | GET /services/mine | service_profiles + categories + per-service ratings |
| Search | GET /services?latitude&longitude&radiusKm&categoryId&q&cursor | active listings, non-suspended users, block exclusion, exact distance |
| Public detail | GET /services/:id | same listing, provider and per-service reviews |
| Public provider listings | GET /services/provider/:providerId/listings | same canonical projection, active listings only |
| Archive | DELETE /services/:id | archived_at; retain interactions and ratings |
| Request form | POST /requests | interactions (owner=provider, worker=seeker) |
| Request inbox/detail | GET /activity, GET /interactions, GET /interactions/:id | participant-only interactions |
| Request transitions | POST /interactions/:id/action | guarded update, existing state machine |
| Rating/report | POST /services/:id/ratings, POST /services/:id/ratings/:ratingId/report | completed-customer ratings; review reports |

All endpoints above are under /api/v1. Compatibility request aliases may remain for older installed clients; the mobile app uses one write endpoint.

| Field | Database source | Rule |
|---|---|---|
| id / providerId | service_profiles.id / user_id | immutable identity; user FK |
| categoryId / categoryName | category_id / categories.name | existing service category only |
| title / description | title / description | provider text; missing text is not fabricated |
| location / coverage | area, latitude, longitude, radius_km | validated coordinates, exact stored radius |
| experienceYears | experience | stored nonnegative integer; legacy provenance unverified |
| offeredServices | offered_services JSON | selected/provider-entered values only |
| mode / pricing / hours | service_mode, pricing_model, base_price_paise, operating_hours | show stored values, neutral missing state |
| photos | portfolio_urls JSON | canonical photo collection |
| phoneVisible / phone | phone_visible / users.phone | opt-in direct calls; disabled stays private after acceptance; owner may inspect own number |
| available / archivedAt | available / archived_at | active/paused; archive is terminal for discovery and new requests |
| wizardState | wizard_state JSON | owner-only editing metadata, not public display source |
| createdAt / updatedAt | created_at / updated_at | new writes record actual times; older listings retain null rather than invented dates |
| rating / totalReviews | service_ratings + customer-authored reviews | service-specific aggregates, unrated=null |

Request lifecycle: provider accepts/rejects PENDING; seeker withdraws PENDING; provider starts ACCEPTED; each participant confirms IN_PROGRESS, both confirmations complete it. Either participant can cancel an active request. Service REJECTED is terminal. Completed/cancelled history is retained. Suspended/blocked providers cannot receive new requests. Archived/paused listings cannot be accepted or started.

Verification boundary: local source checks are distinct from deployed API/database verification. No live data is deleted based on guessed seed provenance. User will perform final app testing as requested. Deployment and migration application remain separate from local implementation.

## Implemented result

`readServices` now supplies one explicit listing projection for owner collection, public detail and public provider listings. Discovery is a deliberately smaller projection of those same fields and matching per-service rating rules. Dedicated service ratings supersede the same customer's older interaction reviews; provider-authored reviews of seekers are excluded from service ratings. Public profile renders actual account/review data and actual services rather than manufacturing role-specific achievements.

Create/patch share domain validation. New services require a real title, category, location, coverage, experience, service mode and pricing choice. Phone visibility defaults to false and only validated booleans are accepted. Fixed/hourly pricing requires a supplied price. Social links persist canonically in social_links. Photos selected in the wizard upload through existing signed Cloudinary authorization and service-purpose confirmation; device-local photo paths are rejected on save. Service-photo confirmation does not replace the user's avatar. Cloudinary runtime availability is unverified.

Migration 0016 adds archive and timestamp fields, aligns the multiple-listing index, preserves the existing unique active-request constraint, validates updates/transitions/ratings, adds a dedicated review-report table, permits genuinely unscheduled requests, and creates atomic service notifications. It does not erase historical records or guess old timestamps. Archive refuses listings with active requests; close those first. Direct request deletion is refused for services. Pause blocks new requests, acceptance and starting; existing in-progress requests can still be completed or cancelled.

Phone behavior:
- Search/public service detail: only phone_visible=1 exposes the account phone. Public read filters suspended providers and checks authenticated viewer blocks.
- Owner collection/detail: authenticated owner may see their own account number and editing metadata.
- Request detail/list/activity: authenticated participants only. Seeker phone unlocks after acceptance; provider phone additionally requires phone_visible=1. Blocked/suspended counterparts and archived service contacts are not exposed.
- General profile: own phone is visible; accepted service relationships do not override disabled provider phone. Independently authorized job relationships retain their existing job contact rules.
- This is a per-service opt-in for public calling, not an account-wide phone secrecy setting. A phone already made public on another enabled listing cannot be made unknown retroactively.

Search uses real selected coordinates and actual database category IDs, debounces text, traverses server candidate pages (including empty filtered pages), and offers retry states. Results are stable ID-page order with distance ordering within a page; the UI no longer claims global nearest-first sorting. Requests use the seeker's selected location, exact coverage and one canonical POST /requests call. They never retry a different endpoint. Request UI supports accept, reject, withdraw, start, both completion confirmations and cancellation. Cache keys include viewer context and mutation invalidation covers listing/detail/search/profile/request/stat queries; focused screens refetch.

Provider stats now honor week/month/all for listing creation and incoming request cohorts. Active listing count is the current total. Older listings without creation timestamps are counted in all-time totals but cannot honestly be assigned to a week/month. Completed stats refer to completed requests in that creation cohort, not revenue or completions during the period.

Removed/replaced:
- Unreferenced ServiceDetailsModal, legacy competing offer implementation (route now opens the wizard).
- Partial database-write fallback, category substitution, frontend alternate-write retry chain, job-stat fallback.
- Fixed Hyderabad booking/search coordinates, fabricated saved Home Base, GPS failure substitution, fake phone numbers.
- Dummy public-profile service, ratings/review counts, achievements, skills, badges, pricing and completion counts.
- Dashboard suggestion ratings/distances, example provider preview and its styles, invented marketing counters and simulated save checkmarks, unsupported verified reward badge.
- Existing catalog and illustrative onboarding assets remain distinct from real service records. No provider seed records were found in the inspected migration inserts. Live seed/provenance inspection remains outstanding.

## Verification and deployment boundary

Focused SQLite regression check: `node scripts/check-service-integrity.cjs` passed. It uses an in-memory fixture of the existing tables and selected migrations, not a D1 emulator or a live database. It verifies migration syntax, active-request uniqueness, zero-coordinate preservation, two-party completion, archive/history guards, rating eligibility, the actual discovery phone/rating SQL projection, and notification-failure rollback. It does not certify the complete historical migration chain.

Backend and mobile TypeScript checks passed after implementation. No broad test suite, Android build, emulator session or repeated app testing was run. Diff whitespace inspection also identified pre-existing whitespace issues in unrelated files, which were left untouched. The upload authorization limit is now 30 per account/day to accommodate the wizard's twelve-photo capacity and retries.

| Feature | DB SQL checked | Backend source | API contract source | Frontend source | Live end-to-end |
|---|---|---|---|---|---|
| Create/edit | constraints checked | implemented | aligned | connected | UNVERIFIED |
| Search | actual projection checked | implemented | aligned | pagination/filter/error states | UNVERIFIED |
| Detail/profile | source reviewed | shared projection | aligned | real records only | UNVERIFIED |
| Archive | guard/history checked | implemented | aligned | existing delete action | UNVERIFIED |
| Phone restriction | search SQL checked | all service read paths reviewed | conditional/null | real phone only | UNVERIFIED |
| Request creation | uniqueness/location/rollback checked | implemented | POST /requests | selected location | UNVERIFIED |
| Request lifecycle | transitions/completion checked | actor/CAS guards | /interactions/:id/action | controls connected | UNVERIFIED |
| Notifications | atomic triggers checked | service triggers | existing role inbox | existing inbox | UNVERIFIED |
| Photos | not a live upload | existing storage extended | purpose=service | actual upload connected | UNVERIFIED |

Before deploying: run backend/service-integrity-audit.sql read-only against the intended database and inspect the migration ledger/schema. Apply 0016 only once after 0011–0015 and the existing interaction/notification migrations are present, then deploy the matching backend before using the updated mobile app. This task did not apply remote migrations, deploy, inspect production rows, or modify credentials.

Remaining verification: historical defaults (especially hours, mode, price and visibility) cannot be attributed to the provider from code alone. Existing invalid records, missing columns, orphaned records, duplicate requests, legacy local-image URLs and old unqualified ratings need the prepared database audit. Do not bulk-delete or backfill guessed values. Existing deployments may have drifted migration histories; reconcile their actual schema first. Uploaded-but-unpublished photo cleanup remains governed by the existing storage system.

User app check after the migration/backend update: create a service with distinctive data and photos; find it from a second account; compare listing/detail/profile; edit and pause/resume; toggle phone visibility and check it before and after acceptance; request twice; accept/start/confirm from both accounts; verify both inboxes, history, cancellation, archive and review eligibility. Also check missing location, no search results and network error/retry. No Android/manual session was run here, per the user's request.
