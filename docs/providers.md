> Authentication revision: [Cloudflare + MSG91 setup](auth-setup.md) supersedes the older development-authentication, six-digit OTP, local database, and deployment-status statements below. The new code has not been tested or deployed. Legacy local integration tests are disabled.
# Provider setup

Never commit credentials or use the values previously pasted into chat. Rotate those keys and provision replacement secrets directly with `wrangler secret put NAME --env staging`. The account ID, database ID, cloud name and template ID are public configuration.

## MSG91
Staging selects the MSG91 adapter and configured template ID. Set `MSG91_AUTH_KEY` as a Worker secret. The approved template must match six digits and five-minute expiry. Adapter calls are bounded by local challenge attempt limits and D1 counters. A send is not retried automatically; unknown or already-verified responses do not authenticate. Test delivery with a controlled real phone before release. Official contracts: [send OTP](https://docs.msg91.com/otp/sendotp), [verify OTP](https://docs.msg91.com/otp/verify-otp). Firebase replacement needs its own token-verification flow; it is not implemented.

## Cloudinary
Set `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and `CLOUDINARY_UPLOAD_PRESET`. Create a **signed** upload preset allowing JPG/PNG/WebP only, maximum 5 MB, no overwrite, and disallow unsigned uploads. This provider-side size restriction is essential: the mobile-reported file size is untrusted. Upload authorization assigns an owner-specific public ID; confirmation uses server credentials to verify the stored asset before writing a transformed URL to D1. Limits: 10 authorizations per user/day, one-hour intent; upload counters are internal observations, not billing totals. Originals never appear in normal cards. Cloudinary credentials never enter mobile bundles. [Upload signatures and API](https://cloudinary.com/documentation/image_upload_api_reference).

## Maps
Policy and tests exist; native Google Maps and MapLibre renderers are still a release dependency. List discovery and GPS/manual locality selection have no map dependency. Supply app-restricted Google Android/iOS SDK keys, configure MapTiler domain/app restrictions and commercial plan, native builds and provider-reported usage. Do not use missing telemetry as a healthy default. No Maps API calls are made by nearby search.

## R2 and Upstash
Neither is needed for current marketplace flows. There is no reason to add a Redis bill or expose S3 credentials to the mobile app. Future private files should use a Worker R2 binding and short-lived downloads. A bucket name and retention/access rules are required before enabling documents.

## Environments
Default Wrangler config runs locally with development OTP. Staging uses `bulao-dev`, MSG91 and a separate Worker name. Production is deliberately not configured against the development database. Provision a separate production D1, CORS origin, WAF/rate-limit rules, signing credentials and EAS build settings before publishing. No remote migrations have been applied by the initial implementation.

