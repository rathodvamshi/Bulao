# Bulao

Find nearby work, workers, and services.

Expo / React Native mobile app with a Cloudflare Workers API and Cloudflare D1. Authentication now uses the server-side MSG91 OTP adapter, Durable Objects for coordination, D1 users and hashed sessions, and a Queue for audit events.

## Authentication setup

Follow [Cloudflare + MSG91 setup](docs/auth-setup.md). The implementation passed database-free validation; secret configuration and approved staging integration are next. It is not a verified production deployment.

- All application persistence runs on Cloudflare. No local database or development OTP fallback.
- Point `EXPO_PUBLIC_API_BASE_URL` to the deployed HTTPS Worker, ending in `/api/v1`.
- Native secure credential storage holds only the session token. Web preview credentials are transient and disappear on reload.
- Do not run a local Worker, local migrations, or the retired smoke workflow.
- Keep MSG91 and fingerprint secrets only in Cloudflare Worker secrets.

Use Node 24 and pnpm 11.19.0 for the workspace. The mobile UI can run using `pnpm dev:mobile` after configuring its remote API URL. Ask the user before testing; they will manually test the UI.

## Validation

77 database-free tests, three TypeScript checks, and two local builds passed. See [validation results](docs/auth-validation.md) for fixes, coverage, limitations, and staging prerequisites. No deployment or real database/SMS calls were made during validation. Old SQLite-backed integration suites remain disabled. User approval is required before staging migrations or deployment.

The marketplace also includes jobs, services, profiles, discovery, applications, activity, completion, reviews, and trust flows. See [architecture](docs/architecture.md), [API](docs/api.md), [providers](docs/providers.md), and [status](docs/status.md) for scope and outstanding work.

