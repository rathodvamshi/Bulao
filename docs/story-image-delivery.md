# Story image delivery

The existing staging app uses Cloudflare D1 `bulao-dev` and Cloudinary `japfuiuz`. Image bytes live in Cloudinary; D1 stores metadata and an active revision for each story. Production is not changed by this setup.

## Data flow

`story-images.json → signed Cloudinary upload → delivery verification → D1 revision → GET /api/v1/stories/:collection → app disk cache`

Collections: `hire-someone` (15 bakery scenes) and `request-service` (10 kitchen scenes). All scene originals remain in the repository for future publishing but are no longer imported into the app bundle. The subsequent app-wide registry migration also moves splash, login/OTP and category artwork online; see `image-registry.md`.

Cloudinary public IDs are `bulao/app-stories/<collection>/<scene>-<sha256-prefix>`. Uploads use overwrite=false; changing file contents creates a new immutable asset. Delivery URLs contain Cloudinary's version and apply width limiting, automatic quality and format. Credentials are read only by the operator script, never returned to the app.

`story_images` stores revisions and per-scene order, accessibility label, dimensions and framing. `story_collections` points to the active revision. All images are verified before seed SQL is generated. The activation statement checks that every image row exists. Publishing a collection therefore cannot expose an incomplete revision. Previous revisions remain available for rollback.

## Publish

From repository root, with existing Cloudinary credentials in backend/secrets.json or environment variables:

```powershell
node backend/scripts/publish-story-images.mjs
```

Review `output/story-images/upload-report.json` and `publish.sql`. Apply the schema once with Wrangler D1 execute against staging, then apply only the generated seed. Do not apply unrelated pending migrations as part of an image update.

```powershell
cd backend
node node_modules/wrangler/bin/wrangler.js d1 execute DB --remote --env staging --file migrations/0019_story_collections.sql
node node_modules/wrangler/bin/wrangler.js d1 execute DB --remote --env staging --file ../output/story-images/publish.sql
node node_modules/wrangler/bin/wrangler.js deploy --env staging
```

Migration 0019 uses IF NOT EXISTS so the normal migration runner can safely record it later. Publishing is an operator-only process; no public write/upload endpoint was added. Manifest paths and captions are in `backend/scripts/story-images.json`. Keep sortOrder contiguous from zero. Never delete active or previous assets during a rollout.

## Client behavior

The app restores the last valid manifest from AsyncStorage, then refreshes it. Malformed manifests are rejected. The current image loads at high priority. Only after it loads, a 500ms delay lets it appear before prefetching exactly one next image. No bulk story download runs. Prefetching requires active playback, visibility and foreground state; pausing cancels scheduled work and ignores late completions. An already-running native prefetch cannot be aborted.

Automatic transitions wait for both the 5.2-second display interval and successful next-image prefetch. Slow or failed downloads leave the current picture visible. One retry runs after 2.5 seconds; persistent failures hold the current scene until navigation or playback resumes. Manual navigation loads the selected image directly at high priority. expo-image uses memory/disk caching. OS cache eviction is possible; first offline launch without cached images uses a plain background. Animations pause offscreen, in background, or for reduced-motion preference. A new revision resets the player safely.

Manifests have a five-minute HTTP cache lifetime. Existing mounted screens refresh on remount. An emergency rollback changes active_revision to a previously verified revision; clients receive it on their next refresh (allow for HTTP cache expiry). Do not remove previous image versions until old app sessions no longer need them.

## Verification

Run backend and mobile type checks, backend story route tests and a mobile web export. Verify both deployed API responses, all CDN delivery URLs, and counts/order in remote D1. Before an app-store release, also test on a device: first offline launch, cached offline relaunch, failed CDN request, manual navigation, reduced motion and background/resume. A custom native development build needs rebuilding after adding expo-image; SDK-compatible Expo Go includes it.

## Published 2026-10-24

- Staging Worker version: `c518b04d-9fe4-4773-88a7-51efe2a75ddb`.
- `hire-someone`: revision `586aec1e619d1633`, 15 scenes.
- `request-service`: revision `cdb75651f5ee22b7`, 10 scenes.
- All 25 CDN URLs and deployed ordered API records passed `node backend/scripts/verify-story-images.mjs`.
- All 131 backend tests passed; domain, backend and mobile TypeScript checks passed.
- The initial Android export including Hermes compilation passed outside the sandbox. Its two bundled fallback images were subsequently removed by the app-wide image-registry migration.
- Web export is blocked by the existing native-only `react-native-maps` import in `mobile/app/jobs/[id].tsx`. This image change does not alter that screen.
- Physical-device offline/animation testing and app-store distribution have not been performed.
