# Cost verification — 2026-09-07

Official sources checked during initial design; recheck when provisioning. No quota or price below is a runtime constant.

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): account for Worker compute/requests separately from database rows read/written and storage. Indexes matter to billed reads, not just response size.
- [Cloudinary pricing](https://cloudinary.com/pricing) and [credit accounting](https://cloudinary.com/documentation/billing_and_plans): transformations, storage and bandwidth share credit accounting. Monitor the actual account plan.
- [Google Maps pricing](https://mapsplatform.google.com/intl/en_uk/pricing/): usage is SKU-specific. Do not reuse historical blanket free-credit assumptions.
- [MapTiler pricing](https://www.maptiler.com/cloud/pricing/) and [terms](https://www.maptiler.com/terms/cloud/): the free plan is for noncommercial use and commercial R&D; do not budget a commercial production fallback as free.
- [MSG91 India OTP pricing](https://msg91.com/in/pricing/otp): varies with volume and taxes. Test numbers avoid charges locally; production OTP needs a funded account and applicable sender setup.

Cloudflare/Expo/Cloudinary/provider credentials, actual account limits, commercial MapTiler plan, Firebase billing and app-store enrollment are not provisioned by this repository. Verify R2, Firebase and EAS account pricing before enabling those integrations. Close-to-zero local operation is feasible; zero-cost production is not promised.
