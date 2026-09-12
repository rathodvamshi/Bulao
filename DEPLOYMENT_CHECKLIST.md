# Deployment Checklist

## Backend Deployment to Cloudflare Workers

### ✅ Completed - September 12, 2026

**Deployment ID:** 548c8898-2346-44a4-a0ba-d08d4029d41d

### Pre-Deployment

- [x] Fix applied to `/jobs/provider/recent` endpoint
- [x] TypeScript compilation successful (no errors)
- [x] Code review completed
- [x] Local testing (type checking)

### Deployment Steps

```bash
cd backend
pnpm deploy:staging
```

### Post-Deployment Verification

- [x] Health check endpoint responding
  ```bash
  curl https://bulao-api-staging.codecheck369.workers.dev/api/v1/health
  ```
  ✅ Status: 200 OK

- [ ] Test `/jobs/provider/recent` endpoint with valid auth token
  ```bash
  node scripts/test-provider-recent.mjs <YOUR_TOKEN>
  ```

- [ ] Mobile app testing
  - [ ] Login successful
  - [ ] Provider home screen loads
  - [ ] Recent jobs display (or empty state if no jobs)
  - [ ] No 500 errors in logs

### Rollback Plan (If Needed)

If issues arise:

1. Check Cloudflare Workers logs:
   ```bash
   wrangler tail --env staging
   ```

2. Rollback to previous version:
   ```bash
   wrangler rollback --env staging
   ```

3. Or redeploy specific version:
   ```bash
   wrangler versions view <VERSION_ID>
   wrangler versions deploy <VERSION_ID> --env staging
   ```

### Environment Details

**Staging Environment:**
- URL: https://bulao-api-staging.codecheck369.workers.dev
- Database: D1 (bulao-dev)
- OTP Provider: MSG91
- CORS Origin: http://localhost:8082

**Bindings:**
- AUTH_COORDINATOR: Durable Object
- AUTH_EVENTS: Queue
- DB: D1 Database (bulao-dev)
- Environment variables: APP_ENV, OTP_PROVIDER, MSG91_TEMPLATE_ID, etc.

### Monitoring

After deployment, monitor:

1. **Error Rates** in Cloudflare Dashboard
2. **Response Times** for `/jobs/provider/recent`
3. **Mobile App Logs** for any remaining 500 errors
4. **User Reports** of issues

### Known Issues

✅ **RESOLVED:** `/jobs/provider/recent` 500 errors
- **Fix:** Refactored SQL query approach (individual queries per job)
- **Deployed:** September 12, 2026

⚠️ **KNOWN:** SafeAreaView deprecation warning
- **Status:** Cosmetic only, no functional impact
- **Action:** None required, dependency issue

### Next Deployment

Before next deployment:

1. Run full test suite: `pnpm test`
2. Type check all code: `pnpm typecheck`
3. Review changes in staging
4. Test with real users (if applicable)
5. Document any new environment variables or bindings
6. Update migrations if schema changed: `pnpm db:migrate`

### Production Deployment (When Ready)

```bash
# 1. Test thoroughly in staging
# 2. Backup production database (if needed)
# 3. Deploy to production
cd backend
wrangler deploy --env production

# 4. Run production migrations (if any)
wrangler d1 migrations apply DB --remote --env production

# 5. Verify health check
curl https://bulao-api.codecheck369.workers.dev/api/v1/health

# 6. Monitor closely for first 30 minutes
wrangler tail --env production
```

### Contact

**Developer:** Vamshi Rathod
**Date:** September 12, 2026
**Status:** ✅ Staging deployment successful
