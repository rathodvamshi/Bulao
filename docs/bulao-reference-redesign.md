# Bulao reference redesign — 28 October 2026

## Changes
- `mobile/app/(tabs)/index.tsx`: reference-oriented logo, circular category controls, mint promotional card, equal-width radius controls, 10 km initial radius, keyboard interaction, retry feedback, and latest-request protection.
- `mobile/src/components/ui.tsx`: shared marketplace palette, preserving existing palette consumers.
- `mobile/src/components/JobCard.tsx`: compact card spacing, aligned Apply action, wrapping pay/title layout, real application status, unavailable-job guard matching backend expiry, and provider press propagation handling.
- `mobile/src/components/JobThumbnailCarousel.tsx`: failed media is removed from the carousel so multiple failing URLs cannot cycle indefinitely; all states retain the same thumbnail size.
- `mobile/app/profile/[id].tsx`: cover from provider work media, overlapping avatar beside identity, horizontal statistics tiles, real experience/verification/availability, expandable reviews, and working full-screen photo navigation.
- `mobile/app/(tabs)/_layout.tsx`: rounded navigation top corners and bottom safe-area accommodation.

## Preserved behavior
Existing API clients, authentication, job application mutation, notification navigation, location sheet, category IDs (Tuition and Education remain separate), radius filtering, owner applications, service details, contact privacy behavior, and reporting routes are retained. Existing uncommitted work in the repository was not reset.

## Differences from the reference
The exact promotional raster illustration is not an existing registered app asset; the banner currently uses the existing icon illustration, enlarged and restyled. Profile/job photography comes from actual records, not the screenshot's sample people. Languages and online status are omitted because the public DTO does not supply those fields. Completion rate is correctly labelled as completion rate, not response rate. The secondary profile action is labelled View Available Services to match its actual destination. No fake reviews, experience, verification, or availability were added.

## Verification
- Mobile TypeScript check passed after the final changes.
- `git diff --check` passed (line-ending warnings only).
- Image policy check fails on pre-existing direct/local image usage in `mobile/src/components/SplashScreen.tsx`; this file was not changed by this task.
- Expo web export is blocked by an existing native-only react-native-maps import through ServiceReviewStep.tsx. Android export with Hermes bytecode passed (1,730 modules). A sandbox temporary-directory write failure was resolved by setting process-local TEMP/TMP to output/bulao-build-temp. Output: output/bulao-redesign-android.
- No authenticated Android end-to-end run or multi-viewport visual comparison has been completed. Exact visual parity is not verified.



## Screenshot follow-up — layout and typography repair
The supplied device screenshot shows missing layout specifically on callback-styled Pressables (location selector, banner, provider row, primary button), while static-styled containers remain laid out. A shared AppPressable now resolves callback styles to ordinary style values before NativeWind interop. This is a targeted mitigation of the observed pattern; a live device comparison is still required to confirm it on the user's build.

AppText previously forwarded raw styles without applying any font. It now uses locally bundled Inter Regular/SemiBold/Bold through expo-font, with an explicit platform sans-serif fallback during loading. It preserves requested weights and allows accessibility scaling. The redesigned screens, job thumbnail and tab labels use this shared typography. AppTextInput shares the same loaded family and weight mapping. The root loads the actual font files; app.json now references these existing files instead of twelve missing font files. The open-source font license is included in mobile/assets/fonts/Inter-OFL.txt.

Validation: `node scripts/check-marketplace-ui.cjs` passed regression checks for static layout delivery, pressed/released state, event forwarding, disabled state, ref forwarding, typography and accessibility props. Mobile TypeScript passed. Android export results are reported below. The connected phone window did not expose the Bulao screen, so live visual verification remains pending. Reload the running Expo app to receive these source changes; the exported bundle does not automatically update an installed release.


Final follow-up checks: mobile TypeScript passed; component regression checks passed; Android Hermes export passed with 1,734 modules and all three Inter font assets included. Visual verification on the running device is still pending.

Home polish follow-up: preserved the current banner-free layout; refined header spacing, search/filter controls, category label weights, section hierarchy, radius buttons and card spacing/shadows. Added clear-search control, moved the category arrow outside the scrolling content and made it scroll to the remaining options, and fixed the inactive All category styling. Existing search/category/radius/application handlers remain in use. Device visual review remains pending.
