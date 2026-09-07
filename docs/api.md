> Authentication revision: [Cloudflare + MSG91 setup](auth-setup.md) supersedes the older development-authentication, six-digit OTP, local database, and deployment-status statements below. The new code has not been tested or deployed. Legacy local integration tests are disabled.
# REST contract

Base `/api/v1`; JSON request/response; authenticated operations require `Authorization: Bearer <opaque session token>`. Successful responses wrap `data` in `{success:true,data,error:null}`; failures wrap `{code,message}` in `error`, with `data:null`. Body limit 16 KiB. Responses are no-store except the versioned category catalog (24 hours).

## Authentication
`POST /auth/send-otp {phone:"+91..."}` returns `{challengeId,expiresIn:300,resendAfter:60}`. Indian mobile E.164 only. Development accepts only configured test phones. `POST /auth/verify-otp {challengeId,code}` returns `{token,user:{id,name,area}}`. Challenges allow five attempts, expire, bind to their provider and invalidate older challenges. `POST /auth/logout {}` revokes the current token. `GET /users/me` returns own basic profile. `PATCH /users/me {name,area}` updates it.

## Categories and location
`GET /categories` returns `{categories:[{id,kind,name,icon}],roles:[{id,categoryId,name}],locations:[{id,area,latitude,longitude}],version}`. Localities are manually configured centroids; GPS coordinates require no external geocoding.

## Jobs
`POST /jobs` accepts `{submissionKey,categoryId,roleId,area,latitude,longitude,startsAt,workers,payPaise,payUnit,details}`. `submissionKey` is a stable 8–100 character ID for one submission; retrying it returns the original job ID. Dates are UTC epoch seconds, payment is integer paise, unit is `hour|day|job|month`. Role must belong to the job category. Payment 100–100000000 paise, workers 1–100, start within the coming year. Returns `{id}`.

`GET /jobs?latitude=&longitude=&radiusKm=5&categoryId=&cursor=0` returns `{items,nextCursor,order:"id"}`. Candidate pages scan 20 records plus one lookahead, then exact radius filtering; a page can be empty while `nextCursor` exists. Clients must follow the cursor. Ordering is stable-ID candidate order, **not guaranteed closest-first**. Offsets can shift as records change; switch to a snapshot/keyset cursor before high-churn deployment. Radius 1–50 km. Public responses omit precise coordinates and phone numbers. `GET /jobs/:id` returns public job detail. `POST /jobs/:id/apply {}` returns an interaction ID; no self/duplicate/blocked applications.

## Services
`POST /services {categoryId,area,latitude,longitude,radiusKm,experience,available}` creates one professional profile per user/category. `GET /services` accepts the same nearby parameters as jobs and includes name, user ID, category, area, distance, rating and confirmed completion count.

`POST /service-requests {serviceId,details,area,latitude,longitude,scheduledAt}` requests one selected professional. It does not broadcast a request. The location must lie within their service radius; scheduling is bounded to the next 90 days. One active request per customer/professional profile. Returns `{id}`.

## Activity and completion
`GET /activity` returns `{interactions,jobs}` belonging to the authenticated user (current initial limit 100 each; pagination is a release gate for large histories). `GET /applications/:id` or `/service-requests/:id` returns participant-only details. Contact phone and exact coordinates are released only while accepted/in progress, not to arbitrary authenticated users.

`POST /applications/:id/action` and `/service-requests/:id/action` accept `{action}`:
- owner accepts/rejects pending requests; applicant/customer withdraws pending requests;
- owner starts accepted work;
- either participant confirms in-progress work; the second distinct confirmation completes it;
- either participant may cancel before completion.

Conditional writes defend stale actions and database triggers defend capacity. Completed interactions cannot reopen. Reviews cannot exist without confirmed completion.

## Trust and images
`GET /profiles/:id` returns public profile, rating, confirmed completions and the latest 20 reviews. `POST /reviews {interactionId,stars,body}` derives the recipient server-side. Stars 1–5; body up to 1000 characters; one review per participant. `POST /reports {targetId,reason}` and `POST /blocks {targetId}` provide safety controls. Blocks are enforced both ways for discovery/new interactions; public anonymous data cannot be hidden from someone who signs out.

`POST /images/authorize {mimeType,bytes}` returns signed Cloudinary upload URL/fields. Upload the file directly, then `POST /images/confirm {assetId}`. The API verifies the asset with Cloudinary and stores the transformed profile image URL. Preset size/type restrictions must be configured provider-side.

`GET /admin/usage` requires an ID in server configuration `ADMIN_USER_IDS`. Counters are internal observations; unknown provider-reported credits remain `null`.

## Errors
401 `AUTH_REQUIRED`; 403 `UNAUTHORIZED`/`INTERACTION_UNAVAILABLE`; 404 `NOT_FOUND`/`JOB_NOT_FOUND`; 409 `APPLICATION_EXISTS`/`REQUEST_EXISTS`/`STATE_CHANGED`/`INVALID_TRANSITION`/`REVIEW_NOT_ALLOWED`/`JOB_FULL`; 429 `RATE_LIMITED`; 503 `PROVIDER_UNAVAILABLE`; 400 validation errors. Clients disable pending mutations and never automatically retry OTP send or publishing.

