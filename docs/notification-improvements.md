# Bulao notification improvements

Implemented for the shared inbox opened from Hire someone, Find a service and Find work.

## Findings and changes
- Service triggers already emit SERVICE_REQUEST and SERVICE_REQUEST_UPDATED with interactionId and recipientRole, but the inbox only navigated to jobs. Service rows now open the existing request detail screen.
- The backend previously returned only the latest 50 notifications. Added validated keyset pagination using timestamp plus ID, with a Load older updates action and ID deduplication.
- Failed refreshes previously erased existing rows and unread totals. Loaded content now remains available with a retry message.
- Rebuilt the screen with a white canvas, shared Inter typography, a compact navigation bar, unread summary, and one underline filter row. Search is revealed on demand. Compact notification rows use subtle unread backgrounds, two-line previews and timestamps. Tapping a row reads it and opens its destination; a native modal bottom sheet shows the full message, destination action, applicant profile, read/unread and deletion. Removed the measured floating menu, its anchor state, row-expansion state and duplicate filter controls.
- Added categories derived from loaded event types, including Services. Search and category filters apply to loaded updates; older updates can be loaded explicitly.
- Preserved authenticated user and recipient-role SQL predicates, mark-all-read, search, pull-to-refresh and existing destination error screens.
- Successful mutations invalidate dashboard badge queries. Reads are committed after server success, without optimistic rollback risk.
- Added stale-response protection and request locking. Normalized database read flags to booleans.
- Replaced substring-based event deduplication with exact JSON entity matching. This retains the existing five-minute suppression window; it is not an atomic idempotency guarantee.
- Removed the development notification preview route and duplicate-suppression debug logging.

## Files inspected
Notification screen, route, API adapter, debug route and jobs notification store; provider/service dashboard notification entry points; Find work unread loading; API client and notification type; job/request destination handling; backend notification routes and creation service; notification emission references in jobs/interactions; service notification migration 0016; mobile dependencies and root route registration.

## Files changed
- mobile/src/components/NotificationsScreen.tsx
- mobile/src/api/notifications.ts
- mobile/app/notifications.tsx
- mobile/src/components/service/ServiceDashboard.tsx (entry context only)
- mobile/app/notification-debug.tsx (removed)
- backend/src/modules/notifications/routes.ts
- backend/src/modules/notifications/service.ts

## Suggested next improvements
Add a dedicated customer-versus-service-owner inbox context only after defining the product roles: current backend scopes are seeker/provider, and service owner events belong to provider. Do not relabel these scopes in API calls.
For future push delivery, first implement device-token registration, permission handling and authenticated deep-link routing; no push SDK or registration flow was found in this audit. Existing settings copy claiming push/SMS availability needs a separate capability review.
Consider atomic event idempotency keys for concurrent backend retries and server-side search/filtering if inbox volume grows.

## Verification and limits
TypeScript compilation is used for debugging. No automated tests, API interaction tests or device visual tests were requested or run. Changes are local; backend pagination requires deployment. Existing unrelated workspace edits were preserved. No new dependencies or database migrations were introduced.

## Redesign follow-up
The shared screen uses AppText, AppTextInput and AppPressable to keep typography and action layout consistent with the app. The bottom sheet supports Android back, backdrop dismissal, a close button, safe-area padding and scrolling for long messages. No device visual validation or automated tests were run, per the requested build/debug scope.

## Deep debugging follow-up
- Confirmed on the connected phone that the running app still displays the old two-filter-row notification screen. The new design is therefore not yet visually verified on-device.
- Both mobile and backend TypeScript compilation passed after the debugging fixes; scoped diff whitespace checks passed.
- Added inbox refresh on navigation focus and app foreground, with subscription cleanup and stale-response protection.
- Kept the selected category visible after its last loaded notification is deleted or a refresh replaces the page.
- Corrected empty Unread messaging when the server reports unread items outside the loaded page, and avoided claiming caught-up after an initial load failure.
- Added API row and cursor validation before rendering, including strict boolean/0/1 read flags.
- Backend single-item read/unread writes now return not-found for absent or out-of-scope records instead of reporting success.
- Fixed Find a service back fallback to service-home; dismiss the keyboard before opening details/navigation; hide background accessibility elements while the sheet is open; allow long sheet content to shrink and scroll.
- Confirmed the bundled font metadata is Inter, Inter SemiBold and Inter Bold. The phone's old typography is not proof that the rebuilt screen has loaded.
- No automated tests or real notification mutations were run. Backend changes remain local and require deployment.

## Compact message previews
Cards now prioritize the event and actor, then the job title, with a one-line reason or next step only when available. Known backend message templates are formatted locally (for example, Rohit applied / job title). Removed repeated category labels and the Wanted prefix from previews, reduced icon/padding sizes, and moved the time to the right. Unknown templates fall back to original copy. The details sheet and accessibility label retain the complete original message; search still includes original text. Service status codes receive readable labels. No backend deployment is needed for these preview changes.

## Notification options polish
The overflow button now has a soft rounded surface within its 44-point touch target, pressed feedback and an accessible expanded state. The bottom sheet shows a compact notification summary with a read/unread badge, one prominent destination button, consistent icon-and-label secondary actions, and a visually separated delete row with a short explanation. Existing action handlers, scrolling, safe-area padding and dismissal behavior are retained. No new API or dependency is required.

## Structured notification details
The options sheet now uses labeled content blocks instead of a repeated paragraph. Known application/job messages show the job separately; cancellations show a highlighted Reason for cancellation block; accepted/completed events show their available next step. Service messages use request/next-step blocks. Unknown message formats preserve their wording in readable sentence/line blocks. Detail values are selectable, wrap without truncation and remain in the scrollable sheet. Original server messages remain unchanged.
