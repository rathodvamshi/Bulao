# Image storage and delivery

- All app artwork (including splash, login/OTP and category images) must be uploaded to the existing Cloudinary account and registered in D1. Do not add raster imports or hardcoded artwork URLs to screens.
- From the repository root, publish new artwork with `pnpm images:add --id <stable-id> --group <screen-group> --file mobile/assets/images/<file> --width <pixel-width>`. This verifies delivery and writes metadata to the current staging database. Read `docs/image-registry.md` for details. Never put upload credentials in mobile code.
- Render artwork with `AppImage assetId="<stable-id>"`. Render user photos through `AppImage` using the verified server URL. Use high priority for the visible hero/full preview and normal priority for thumbnails. Do not prefetch entire collections.
- User-selected photos must use `uploadImage(photo, purpose)` from `src/api/uploadImage.ts`. Persist only its returned URLs after confirmation, never a device URI.
- Story slides keep the sequential one-image-ahead loader. Screen backgrounds and text must remain usable if remote images fail; do not block startup, OTP or navigation on an image download.
- `pnpm images:check` enforces the remote-artwork/shared-loader policy and runs in CI. Do not weaken this check to add a local screen image.
- Native operating-system launch artwork/app icons, if introduced later, require build-time assets and are an explicit technical exception. Obtain that artwork through the publishing workflow but keep any required native launch asset available at build time; the native launch screen cannot call D1.
