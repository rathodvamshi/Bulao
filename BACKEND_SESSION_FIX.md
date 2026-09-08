# Backend Session Creation Fix

## The Bug

The `/verify-widget-otp` endpoint in `backend/src/app.ts` was creating sessions incorrectly, causing immediate 401 errors after login.

### What Was Wrong

1. **Missing `created_at` column**
   ```sql
   -- BROKEN (app.ts)
   INSERT INTO sessions (hash, user_id, expires_at) VALUES (?, ?, ?)
   
   -- CORRECT (repository.ts)
   INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,id,?,? FROM users...
   ```

2. **Wrong phone format**
   - app.ts stored phone with `+` prefix: `+917569408235`
   - Real auth system expects phone WITHOUT `+`: `917569408235`
   - When `/auth/me` looked up the user by phone, it couldn't find them!

3. **Missing phone_verified flag**
   - app.ts didn't set `phone_verified=1`
   - `/auth/me` checks for `phone_verified=1`
   - Result: User created but couldn't authenticate

4. **Duplicate code**
   - app.ts had its own `hash()` and `createUserSession()` functions
   - These were slightly different from the real auth module
   - Led to inconsistencies

## The Fix

### Changed `/verify-widget-otp` endpoint to use the real auth functions:

```typescript
// Import real functions from auth module
const { hash } = await import("./modules/auth/session");
const { createUserSession } = await import("./modules/auth/repository");

// Normalize phone (remove + prefix)
let phone = identifier.replace(/^\+/, '');
if (phone.length === 10) {
  phone = '91' + phone; // Add country code
}

// Use the REAL createUserSession that works properly
const user = await createUserSession(c.env.DB, phone, tokenHash, at, expiresAt);
```

### Removed duplicate helper functions

Deleted the broken `hash()` and `createUserSession()` from app.ts.

## What the Real createUserSession Does

```typescript
// From backend/src/modules/auth/repository.ts
export async function createUserSession(db: D1Database, phone: string, tokenHash: string, at: number, expiresAt: number) {
  const results = await db.batch([
    // 1. Create or update user with phone_verified=1
    db.prepare("INSERT INTO users(id,phone,created_at,updated_at,last_login_at,phone_verified) VALUES(?,?,?,?,?,1) ON CONFLICT(phone) DO UPDATE SET phone_verified=1,updated_at=excluded.updated_at,last_login_at=excluded.last_login_at WHERE users.suspended=0")
      .bind(crypto.randomUUID(), phone, at, at, at),
    
    // 2. Create session with ALL required columns including created_at
    db.prepare("INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,id,?,? FROM users WHERE phone=? AND suspended=0")
      .bind(tokenHash, at, expiresAt, phone),
    
    // 3. Return user only if not suspended
    db.prepare("SELECT id,name,area FROM users WHERE phone=? AND suspended=0").bind(phone),
  ]);
  return results[2]?.results[0] as { id: string; name: string; area: string } | undefined;
}
```

## How Sessions Are Validated

When `/auth/me` validates a session:

```sql
SELECT u.id, u.name, u.area, s.expires_at 
FROM sessions s 
JOIN users u ON u.id = s.user_id 
WHERE s.hash = ? 
  AND s.revoked_at IS NULL 
  AND s.expires_at > ?
  AND u.suspended = 0 
  AND u.phone_verified = 1  ← MUST BE 1!
```

## Expected Behavior Now

### Before Fix
```
✅ OTP verified
✅ Session "created" (but wrong format)
❌ /auth/me returns 401 (can't find valid session)
❌ Immediate logout
```

### After Fix
```
✅ OTP verified
✅ Session created correctly
✅ /auth/me returns 200 with user data
✅ User stays logged in
✅ App restart keeps user logged in
```

## Test After Deploying

```bash
# Run the mobile app
# Login with OTP
# Should see these logs:

LOG  authApi: Session created successfully
LOG  Auth: Session saved, login complete
LOG  Auth context: Login
LOG  api() called: /users/me hasToken: true
LOG  api() response: /users/me 200  ← NOW 200, not 401!
LOG  api() success: /users/me
# User stays logged in! ✅
```

## Verify in D1

```bash
# Check that session was created properly
wrangler d1 execute DB --env staging --command "
  SELECT 
    substr(hash, 1, 10) as hash,
    user_id,
    datetime(created_at, 'unixepoch') as created,
    datetime(expires_at, 'unixepoch') as expires,
    revoked_at
  FROM sessions 
  ORDER BY created_at DESC 
  LIMIT 1
"
```

Should show:
- ✅ hash: has value
- ✅ user_id: UUID
- ✅ created_at: recent timestamp
- ✅ expires_at: 30 days in future
- ✅ revoked_at: NULL

## Files Changed

1. **`backend/src/app.ts`**
   - Fixed `/verify-widget-otp` endpoint
   - Now uses real auth module functions
   - Removed duplicate/broken helpers
   - Added proper logging

## Deployment

```bash
cd backend
pnpm deploy:staging
```

Status: ✅ **Deployed Successfully**

---

**The authentication system should now work end-to-end!**
