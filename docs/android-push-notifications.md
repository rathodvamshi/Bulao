# Android push notifications

## Design

Bulao's D1 `notifications` table is the source of truth. Migration `0030_android_push_notifications.sql` creates a push outbox from every inbox insert, including inserts made by D1 triggers. A scheduled Worker expands outbox records into per-installation delivery rows and enqueues due rows. The queue consumer submits privacy-safe text to Expo Push Service; a scheduled receipt check records FCM handoff results and disables unregistered tokens.

The delivery state is deliberately durable in D1. Queue messages are wake-ups, not the only copy of work. A scheduled reconciliation re-enqueues stale queued or leased rows. Temporary failures back off and retry; permanent failures stay visible to administrators and can be replayed through the authenticated push operations endpoint. An Expo/FCM acceptance is not proof that Android displayed a notification. The inbox remains the recovery path.

Push copy is generic and must never include names, phone numbers, precise locations, or cancellation reasons. Payload data contains only the inbox notification ID, recipient role, and destination context. Opening a push fetches the authenticated notification from the API before navigating.

## Firebase and Expo setup

1. Create or select a Firebase project and add the Android app package `in.bulao.app`.
2. Enable Firebase Cloud Messaging and download `google-services.json`.
3. Set `GOOGLE_SERVICES_JSON` to that file's path for the Android build. Keep service-account private keys out of the repository.
4. Link this Expo project with EAS and set `EXPO_PUBLIC_EAS_PROJECT_ID` for local/development/production builds. The runtime needs this ID to create Expo push tokens.
5. In EAS credentials, configure the Firebase Cloud Messaging V1 service-account key for Android push sending. Keep the private JSON outside source control.
6. Build and install a development build or Play Store build on a physical Android device. Expo Go is not a valid push-delivery test target for this project.

The settings screen asks for notification permission only after the user chooses **Enable**. If permission is granted, the app registers the current Android installation with the authenticated Worker and refreshes its registration on login, app foreground, and Expo token change. Logout disables that installation before the session is revoked.

## Cloudflare setup and release order

Create the staging and production delivery and dead-letter queues before deploying:

```powershell
pnpm --filter @bulao/backend exec wrangler queues create bulao-push-deliveries-staging
pnpm --filter @bulao/backend exec wrangler queues create bulao-push-deliveries-staging-dlq
pnpm --filter @bulao/backend exec wrangler queues create bulao-push-deliveries-production
pnpm --filter @bulao/backend exec wrangler queues create bulao-push-deliveries-production-dlq
```

The Worker needs the optional `EXPO_PUSH_ACCESS_TOKEN` secret if Expo push security is enabled for the project. Set it separately for each environment with Wrangler; never put it in a client variable or commit it. Without Expo push security configured, the Worker can use the Expo endpoint without this secret.

Set `ADMIN_USER_IDS` for the intended operations account(s); otherwise the push health and replay endpoints correctly remain unavailable. `GET /api/v1/notifications/ops/push-deliveries` returns state counts, oldest pending time, and up to 100 failed delivery IDs without device tokens or notification text. `POST /api/v1/notifications/ops/push-deliveries/retry` accepts `{ "deliveryIds": ["<32-character-delivery-id>"] }` and requeues only failed rows.

Release in this order:

1. Review and apply migration `0030` to staging.
2. Create staging queues, deploy the Worker with staging Queue bindings and the one-minute scheduled trigger, and confirm the Worker can run scheduled and queue events.
3. Configure the Expo/Firebase Android credentials and build a development client.
4. Exercise token registration, real notification delivery, receipt processing, tap routing, logout, retry, and invalid-token cleanup on physical Android devices.
5. Inspect `/api/v1/notifications/ops/push-deliveries` as an administrator and verify failed rows can be retried with `/api/v1/notifications/ops/push-deliveries/retry`.
6. Apply the migration and create queues in production only after staging has passed. Then deploy the production Worker and release the Android build.

Do not deploy the Worker before the matching migration and queue resources exist. The production Worker currently has a placeholder allowed origin; this task does not change production configuration or apply migrations remotely.

## Failure handling and operations

- D1 outbox rows are expanded in bounded batches. Pending records remain in D1 if the Worker or Queue is unavailable.
- Queue delivery uses an expiring D1 lease, so duplicate queue messages do not normally submit the same record concurrently. A crash after Expo accepts a request but before its ticket is stored can still result in a duplicate retry; the inbox ID makes the destination idempotent.
- Expo tickets are not treated as delivery receipts. The scheduled worker checks receipts, marks provider acceptance, and disables `DeviceNotRegistered` tokens.
- Temporary network, provider, rate-limit, missing-receipt, queue, and database errors are retried. Invalid/permanent payload or recipient errors are retained as failed rows for inspection and manual replay.
- Monitor delivery state counts, oldest pending age, `PUSH_*` error logs, Cloudflare queue backlog, dead-letter messages, and Expo receipts. The project currently has no external alerting dashboard.
- Replaying a failed record may send a duplicate if the earlier provider attempt had an ambiguous outcome. This is the at-least-once tradeoff; never delete a failed record to make the queue look healthy.

## Known delivery boundary

No push provider can promise that every phone displays every notification. Android permission, channel settings, battery policy, network availability, FCM behavior, and device state remain outside Bulao's control. The reliable product behavior is a durable inbox entry, tracked provider handoff, bounded retries, visible failures, and inbox refresh on app open.
