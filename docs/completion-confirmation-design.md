# Job completion confirmation — root cause and end-to-end design

## Implementation update

The original root-cause note predates migration `0026_job_worker_completion_prompt.sql`, which added the reciprocal seeker-first notification. Current implementation retains the existing `IN_PROGRESS` / `COMPLETED` interaction model and adds a separate, nullable dispute record rather than a new lifecycle status.

- Migration `0031_job_completion_disputes.sql` stores the rejection time, actor and short reason; the database notification trigger writes a single role-targeted inbox event, and migration `0030`'s outbox trigger queues its push delivery.
- `POST /applications/:id/action { action: "reject_completion" }` authorizes either participant, accepts only the participant who has not already confirmed, and atomically records the rejection while clearing the rejected request timestamp. A later confirmation clears the dispute and resumes the same workflow.
- Home continues to use the role-scoped `/applications/completion-pending` queue. This is intentionally separate from the paginated `/activity` feed: the feed is capped, so old skipped actions must not become unreachable. Rejected items are excluded from auto-prompts and remain visible through Activity/Work cards.
- The shared job completion sheet and both role-specific Activity cards call the same interaction action. Rating remains available only after mutual confirmation; the existing review uniqueness and authorization rules remain authoritative.
- Verification run: backend typecheck passed; mobile typecheck passed; full backend suite passed (18 files / 172 tests); targeted dispute migration tests passed (2 tests), covering both request directions, notification recipient, resubmission and completion guard.

Deployment is not performed here. Apply migration `0031` through the normal database migration release process before shipping clients that use the dispute action.

> The audit and proposal below document the pre-implementation state. Where their recommendations differ from the implementation update above (for example, the table-based issue proposal), the implementation update is authoritative.

## Decision

Keep the existing two-person completion model. Add one reciprocal notification path for the missing direction, one shared pending-confirmation prompt, and one explicit issue flow. Reuse the existing interaction state, activity feed, action endpoint, notification inbox, and review system. Do not build a second completion state machine, a second notification pipeline, or a second review system.

This proposal is for **job interactions**. Service requests have different notification handling and should be brought into the same flow only as a separately scoped follow-up after their behavior is traced and agreed.

## Root-cause findings

The repository already contains most of this feature:

1. `interactions.owner_confirmed_at` and `worker_confirmed_at` are the two confirmations. The first confirmation leaves the interaction `IN_PROGRESS`; the second sets it to `COMPLETED`. Database guards prevent `COMPLETED` without both timestamps, and reviews require both confirmations.
2. A provider can mark accepted hires complete from the job activity screen through `POST /jobs/:id/complete-work`. It updates each eligible interaction separately, so multi-worker jobs already complete per worker. A provider can also confirm one interaction through the existing interaction action.
3. The seeker confirms through the existing `POST /applications/:id/action { action: "confirm" }` action. The request detail screen already shows who confirmed and the waiting state.
4. Migration `0022_job_completion_prompts.sql` already inserts `JOB_COMPLETION_CONFIRMATION` when the **provider/owner** confirms first. It already inserts `JOB_COMPLETED` for both participants when the second confirmation completes the interaction.
5. The notification inbox routes both existing event types to the interaction. The activity API already includes interaction IDs, both confirmation timestamps, title, date, area, pay, counterpart name, status and review state. It is sufficient to find pending confirmations without adding a new endpoint.
6. Rating entry points already exist: seekers can be prompted from request detail, and providers can rate completed seekers from the job applicant/rating queue. Reviews are participant-specific and server-authorized.

**Actual gap:** when the seeker/worker confirms first, no `JOB_COMPLETION_CONFIRMATION` is created for the provider. The current migration listens only to `owner_confirmed_at`. The API action does not add a completion notification itself, and should stay that way if the database trigger remains the single notification writer. Otherwise route plus trigger will create duplicates. The separate job completion route also writes confirmation timestamps directly, so notification logic must cover both write paths.

**Do not reimplement:** two-sided status transitions, review eligibility, completion notifications for the provider-first case, final review notifications, notification deep-link routing, activity data, or existing rating forms.

## One canonical pipeline

`interaction row → DB conditional update → DB trigger inserts one in-app notification → activity/home reads interaction state → shared prompt opens existing request → existing confirm action → server returns current state → existing review entry point`

The interaction row is authoritative. Notifications are pointers to actions, never the source of whether an action is pending. The home prompt and request screen must use the same eligibility rules and existing confirmation mutation.

### Flow A — provider marks work complete first

1. Provider taps **Mark work completed** in the existing activity flow. For a multi-worker post, show the existing per-seeker count/confirmation and process each interaction separately.
2. Existing provider completion route writes `owner_confirmed_at`; interaction remains `IN_PROGRESS`.
3. Existing trigger inserts one `JOB_COMPLETION_CONFIRMATION` for the seeker, with `interactionId`, `jobId`, and `recipientRole: seeker`.
4. Seeker's home/activity refresh finds the interaction where `status=IN_PROGRESS`, owner confirmation exists, and worker confirmation is null. The shared bottom sheet may appear. If dismissed, keep a persistent pending card and the existing notification entry.
5. Seeker chooses **Confirm completed** or **There’s an issue**.
6. Confirm calls the existing application action. If accepted, its conditional update sets `worker_confirmed_at`, transitions to `COMPLETED`, and the existing final-completion trigger creates the current `JOB_COMPLETED` notifications for both sides.
7. Both participants can use their existing review entry points; each review is independent and optional.

### Flow B — seeker marks work complete first

1. Seeker taps **Mark work completed** on the existing request detail; use the same shared completion prompt component/confirmation interaction as Flow A.
2. Existing application action writes `worker_confirmed_at`; interaction remains `IN_PROGRESS`.
3. **Add one reciprocal DB trigger** on the first `worker_confirmed_at` update. If the new status is still `IN_PROGRESS`, insert one `JOB_COMPLETION_CONFIRMATION` for the provider with the same identifiers and `recipientRole: provider`.
4. Provider home/activity finds the interaction where `status=IN_PROGRESS`, worker confirmation exists, and owner confirmation is null. Show the same shared bottom sheet and persistent card.
5. Provider confirms using the existing application action. The interaction becomes `COMPLETED`; the existing final-completion trigger sends the existing `JOB_COMPLETED` event to both participants.
6. Reuse the provider's existing review queue/form. Do not add another provider rating flow.

If the second confirmation is written immediately (for example, worker confirmed first and provider uses the bulk complete-work action), the interaction becomes `COMPLETED` directly. The reciprocal *pending* notification must not be emitted in that case; the existing final-completion trigger is the correct event.

## Prompt design and ownership

Build one reusable completion prompt/sheet and mount it from the authenticated home/activity shell. It consumes pending interaction rows from the existing activity query; opening its CTA routes into the existing request detail or invokes the same request action after showing the same detail. Do not build a second API, screen-specific mutation, or duplicate rating modal.

Eligibility is computed from current server state, not notification unread status:

- Interaction belongs to the signed-in user.
- `kind = job`, `status = IN_PROGRESS`.
- Exactly one of owner/worker completion timestamps is set.
- The signed-in participant's timestamp is null.
- No open completion issue exists.

Prompt details: job title, counterpart name, scheduled date/time and area. Show pay only if the existing interaction/job contract reliably returns it. Do not expose exact address, phone, or other data beyond current authorization.

Use one bottom sheet at a time; show a count when multiple interactions are pending. Dismissal snoozes the sheet for the current app session, not the underlying action. A persistent home/activity card and inbox notification remain until action. Recheck server state on screen focus/app foreground and before action. A stale push or notification opens the current interaction state, not a stale action. Do not add a new push system as part of this work; the current notification inbox is the baseline. Push can be a later delivery layer over the same events.

## Issue / not-complete path

Use **There’s an issue** rather than **Reject**. `REJECTED` belongs to the pre-acceptance application state and must not be reused for a completion disagreement.

The issue action is available only to the participant who has not confirmed, while the interaction is still `IN_PROGRESS`, the other participant has confirmed, and no issue is already open. Require one reason code:

- Work is not finished
- Work differs from what we agreed
- Quality concern
- Payment disagreement
- Safety or conduct concern
- Other (requires a short explanation)

Implementation needs one new `completion_issues` table, scoped uniquely to an interaction's one active issue. Store `interaction_id`, opener, reason code, private note, status, created/updated times, and resolution actor/time. Retain history; do not overwrite confirmation timestamps. Keep notes private from notification payloads and public reviews. For safety/conduct, route the details only to the support/safety path; show the other participant a neutral “A concern was reported” message.

When an issue opens, leave the interaction `IN_PROGRESS`, keep the first confirmation as recorded, block the second confirmation and reviews, and show **Needs resolution** to both parties. Do not present a false resolution tool: v1 resolution is completed by the issue opener after they resolve the concern directly or with support. Their **Confirm completed** action closes the issue as resolved and records their confirmation in the same server transaction. If they do not agree the job is complete, they leave it open and use the support path. Never auto-confirm or auto-close on timeout.

If the interaction completes before an issue request reaches the server, return a state conflict and direct the user to the existing general report/safety path; do not reverse a completed interaction. This race is settled by the server's conditional update/transaction.

## Minimal implementation plan (no duplicate feature paths)

1. **Database:** add one migration with the worker-first notification trigger and the completion issue table/indexes/guards. Keep migration `0022`'s existing owner-first and final-completion triggers. Do not add notification inserts to the API routes.
2. **API:** retain the existing confirm action. Permit it from `ACCEPTED` as well as `IN_PROGRESS`, moving the interaction to `IN_PROGRESS` after the first confirmation; this matches the existing provider bulk-completion behavior and lets a seeker mark accepted work complete without waiting for a separate start action. Add only one issue-opening action/route and extend the existing `/activity` response with open-issue status if needed. Do not add `/activity/pending-actions`; `/activity` already has the required interaction projection. Enforce participant, state, reason, idempotency and open-issue checks server-side. Use a transaction/conditional writes so issue-vs-confirm races have one winner.
3. **Mobile:** add one shared bottom sheet and persistent pending card using current activity data. Reuse request detail and its existing confirm mutation. Reuse existing review entry points. Add an issue form/state to request detail, not a parallel workflow.
4. **Review/notifications:** keep existing notification names/payload routing and review rules. Make the new worker-first trigger use the established `JOB_COMPLETION_CONFIRMATION` type. Keep current `JOB_COMPLETED` final event. Do not manually insert the same event from route code.
5. **Release:** apply the additive migration only through the project's approved migration process, deploy backend before enabling the client UI, and release behind a feature flag. Verify both directions, bulk completion, multi-worker isolation, issue-vs-confirm races, notification uniqueness, stale inbox taps, account switching, and review eligibility before broad enablement.

## Exact behavior for failure and edge cases

- **Repeated submit/network retry:** first-confirm and issue creation are conditional/idempotent; return current state instead of creating duplicate prompts or issues.
- **Simultaneous confirm and issue:** transaction/conditional update decides the winner. If completion wins, do not reopen it; if issue wins, second confirmation is blocked until the opener resolves it.
- **Provider bulk completion:** one interaction update per accepted seeker; one prompt per eligible seeker; already-confirmed rows are skipped; completed rows do not get a confirmation prompt.
- **Multiple pending jobs:** queue/count them; never overwrite one with another or show stacked sheets.
- **Dismissed/read/deleted notification:** pending action remains visible from `/activity`; notification read/delete does not confirm or resolve anything.
- **Cancelled, rejected, withdrawn, deleted job:** no actionable completion prompt. Preserve existing history and use safe fallback title if source job details are unavailable.
- **Offline, stale data, duplicate taps:** disable while submitting; do not show success until server confirms; refresh after conflict.
- **Logout/account switch:** clear cached queue and load `/activity` for the new authenticated user.
- **Rating:** available only after `COMPLETED`; optional and once per person/interaction as enforced by current review rules. Issue details never enter a public review.
- **No response:** do not auto-complete, penalize, or auto-rate. Keep the pending action and offer neutral reminders only after reminder timing and quiet hours are explicitly chosen.
- **Privacy/accessibility:** no sensitive notes in notifications; support large text, screen readers, reduced motion, keyboard/switch access, localized labels, and non-color-only actions.

## Not in this implementation

- New completion status values or a replacement interaction model.
- New notification service, new pending-actions endpoint, separate completion screen, second review system, or client-side notification writes.
- Automatic completion, automatic dispute adjudication, payments/escrow, or public reputation changes from issue reports.
- Service-request parity until separately scoped; current service action handling returns through a different path and needs its own trace before changes.

## Scope and workspace note

This is a design update only. The workspace currently contains many unrelated modified and untracked files. Keep implementation changes limited to the approved files for this feature and preserve unrelated work. No application code or migration was changed by this document update.
