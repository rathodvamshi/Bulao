# App-wide image system

Image bytes are stored in the existing Cloudinary account. Cloudflare D1 stores the registry and photo ownership metadata. Binary blobs/Base64 are not stored in SQL. Client disk caching is deliberately retained to avoid downloading images on every visit.

## Current screens

- `splash-background`: animated in-app splash; remote artwork, with independent text/logo animation and a plain background while loading. Startup never waits for the artwork. The operating-system launch screen is separate and cannot make API calls; this project currently specifies no custom bitmap for it.
- `login-hero`: shared by phone, OTP and name steps.
- `category-plumber`, `category-electrician`: service category and selection screens.
- Story collections: 15 Hire Someone and 10 Request Service images, served through the existing story endpoint. Bundled first-scene fallbacks have been removed; cached remote images or plain backgrounds are used instead.
- Profile avatars, provider cards, service photos and galleries: `AppImage` with verified URLs already stored in user/service records.

Original artwork remains in `mobile/assets/images` as publishing source material; screens do not import it, so those originals are not bundled. Icons/fonts and the text-drawn logo remain code/font assets.

## Loading

`GET /api/v1/assets` returns only curated public artwork metadata, never user photos. One shared request restores a cached manifest, refreshes it in the background and deduplicates simultaneous requests. Metadata stays fresh in memory for five minutes. No images are downloaded merely because their metadata is listed.

Images load when their components mount. High priority goes to splash, authentication artwork and full-screen photo previews; ordinary cards use normal priority. `AppImage` sets memory/disk caching and a short fade. Our Cloudinary c_limit URLs are resized into reusable width buckets based on explicit display width and device pixel density, or a 640px normal/1440px high-priority limit. Cropped avatars and other providers' URLs are preserved. Lists should use virtualized components for large datasets rather than mounting every row.

Story playback loads the current image first, waits 500ms after it is ready, and preloads only one following scene. It waits for the next image before advancing. Pausing/backgrounding cancels scheduled work; already-running native downloads cannot be aborted by expo-image.

An uncached image cannot appear on a first offline launch. Screens remain functional with their plain backgrounds, labels and icons. Cached images are reused when available, subject to OS cache eviction. There is no promise of zero network latency.

## Publish new screen artwork

Place an original PNG/JPEG/WebP under `mobile/assets/images`, then run from the repository root:

```powershell
pnpm images:add --id welcome-banner --group onboarding --file mobile/assets/images/welcome-banner.png --width 1080
```

The command reads operator credentials from environment variables or existing `backend/secrets.json`, uploads with a content-hashed public ID and overwrite=false, verifies CDN delivery, writes D1 metadata in staging, and saves the manifest entry. It does not deploy production. On failure it exits without claiming success; rerunning is safe. `pnpm images:publish` republishes all registered artwork. `--prepare-only` uploads/verifies and generates SQL without executing it.

Use it in a screen:

```tsx
<AppImage assetId="welcome-banner" priority="high" style={{width:360,height:240}} />
```

This is an explicit publish command, not a background filesystem watcher. Merely dropping an arbitrary file in the repository does not upload it. New local bitmap imports and raw image components are rejected by `pnpm images:check` and CI. For future automated deployment, supply credentials through CI secrets; never embed them in the app.

## User-uploaded images

Every current picker calls `uploadImage(photo, 'profile' | 'service')`: authorize → signed Cloudinary upload → server verification → D1 transaction → return verified URLs. `/images/confirm` inserts/updates `uploaded_image_assets` and updates the profile photo in the same transaction when applicable. Private owner records are not exposed by the public artwork endpoint. Existing profile/service photos already have URLs in their existing database records; the new upload ledger covers confirmations from this deployment onward.

## Checks

Run `pnpm images:check`, `pnpm typecheck`, backend tests and an Android export. Device testing should include first offline launch, a cached offline relaunch, image failures, OTP input responsiveness, gallery scrolling and background/resume. No new photo should be claimed as saved before D1 confirmation succeeds.

## Deployment verification — 2026-10-24

- Staging Worker version `f947fd25-6885-46f3-8512-59c05371ec1c` publishes the registry and verified-upload ledger.
- The four public artwork records and CDN URLs passed live checks; the 25 story images remain available through their existing ordered collections.
- TypeScript and image-policy checks passed. Android export including Hermes compilation passed; its asset list contains no `mobile/assets/images` artwork.
- Upload persistence is covered by mocked-provider tests for profile/service transactions and rejected verification. Live checks confirm upload registration requires authentication; no real user photo was submitted as a test.
- Physical-device visual/offline testing and app-store distribution have not been performed.
