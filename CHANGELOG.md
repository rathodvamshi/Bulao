# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Progress
- Job posting and browsing
- Service provider profiles
- Real-time interactions
- Payment integration

---

## [0.1.0] - 2025-01-08

### 🎉 Initial Release - Authentication System Complete

This is the first release of Bulao with a production-ready authentication system.

### ✨ Added

#### Authentication System
- **OTP-based Login**: Phone number authentication via MSG91
- **Secure Session Storage**: Token stored in SecureStore (iOS Keychain / Android Keystore)
- **Auto-login**: App restart automatically restores valid sessions
- **Session Persistence**: Sessions survive app restarts and device reboots
- **Server Validation**: Backend validates all sessions (source of truth)
- **Proper Logout**: Complete logout with server-side session revocation
- **Network Error Handling**: Distinguishes network errors from auth errors
- **Security**: SHA-256 hashed tokens in database

#### Mobile App (`mobile/`)
- Created centralized auth module (`src/auth/`)
  - `AuthContext.tsx` - React Context for auth state
  - `authApi.ts` - Authentication API calls
  - `authService.ts` - Business logic
  - `authStorage.ts` - SecureStore wrapper
  - `authTypes.ts` - Type definitions
- Implemented auth bootstrap flow on app startup
- Added proper navigation architecture (Auth Stack vs App Stack)
- Created splash screen with auth restoration
- Updated authentication screen with new system integration
- Added logout functionality in profile screen
- Implemented centralized API client with 401 handling

#### Backend (`backend/`)
- Fixed session creation in `/verify-widget-otp` endpoint
- Integrated real auth module functions
- Added proper phone normalization (removed `+` prefix)
- Fixed missing `created_at` column in session inserts
- Set `phone_verified=1` flag correctly
- Added comprehensive logging for debugging
- Implemented proper error handling

#### Documentation
- **README.md**: Complete project documentation
- **AUTHENTICATION_IMPLEMENTATION.md**: Technical auth system docs
- **AUTH_IMPLEMENTATION_SUMMARY.md**: Implementation summary
- **BACKEND_SESSION_FIX.md**: Session bug fix documentation
- **TESTING_AUTH_FIX.md**: Testing guide
- **SETUP_GUIDE.md**: Setup instructions
- **CONTRIBUTING.md**: Contribution guidelines
- **CHANGELOG.md**: This file

#### Development Tools
- Added debugging scripts for MSG91 testing
- Created comprehensive test files
- Added TypeScript configuration

### 🔧 Changed

- Migrated from Zustand session store to AuthContext
- Updated API client to use new auth system
- Improved error messages for users
- Enhanced logging throughout the app

### 🐛 Fixed

- **Critical**: Fixed backend session creation bug
  - Missing `created_at` column in sessions table
  - Wrong phone format (stored with `+`, expected without)
  - Missing `phone_verified=1` flag
- Fixed immediate logout after successful login
- Fixed session validation returning 401 incorrectly
- Fixed auth expired handler being called during login
- Fixed duplicate code in backend causing inconsistencies
- Resolved handler re-registration issues in mobile app

### 🔒 Security

- Implemented SHA-256 token hashing
- Used SecureStore for encrypted token storage
- Added server-side session validation
- Removed sensitive data from logs
- Implemented proper logout with session revocation
- Added rate limiting on auth endpoints
- Used parameterized queries to prevent SQL injection

### 📱 Mobile App Features

- Smooth splash screen
- No authentication screen flash on startup
- User-friendly error messages
- Retry mechanism for network errors
- Loading states for all async operations
- Proper keyboard handling

### 🔧 Backend Features

- Edge computing with Cloudflare Workers
- D1 SQLite database
- Durable Objects for auth coordination
- Queue system for auth events
- Comprehensive error handling
- Request ID tracking

### 📚 Testing

- Backend unit tests for auth system
- Manual testing procedures documented
- 12 test scenarios covered
- Type checking for all code

---

## Branch Information

### `main` Branch
- Latest stable code
- All tests passing
- Production-ready authentication system

### `auth` Branch
- Snapshot of authentication implementation
- Reference point for auth system completion
- All auth features complete and working

---

## Migration Guide

### From Previous Version (if applicable)

#### Mobile App

**Old Session Store:**
```typescript
const session = useSession();
const token = session.token;
await session.setToken(newToken);
```

**New Auth Context:**
```typescript
const auth = useAuth();
const token = auth.session?.token;
auth.login(user, session);
await auth.logout();
```

#### Backend

No breaking changes for API consumers. All endpoints remain the same.

---

## Known Issues

### Minor Issues

1. **MSG91 Library TypeScript Errors**: The MSG91 SDK has some TypeScript errors that don't affect functionality. These are in `node_modules` and can be ignored.

2. **SafeAreaView Deprecation Warning**: React Native shows a deprecation warning for SafeAreaView. This doesn't affect functionality and will be addressed in a future update.

3. **Linking Scheme Warning**: Expo shows a warning about missing linking scheme. This only affects deep linking which is not yet implemented.

### Workarounds

All issues have either been fixed or have known workarounds documented in the README.

---

## Upcoming Features

### Version 0.2.0 (Planned)

- [ ] Job posting and management
- [ ] Job browsing with filters
- [ ] Search functionality
- [ ] Location-based job discovery
- [ ] Basic profile management

### Version 0.3.0 (Planned)

- [ ] Service provider profiles
- [ ] Service browsing
- [ ] Application system
- [ ] Basic messaging

### Version 1.0.0 (Planned)

- [ ] Payment integration
- [ ] Review and rating system
- [ ] Advanced trust features
- [ ] Push notifications
- [ ] Production release

---

## Contributors

- **Vamshi Rathod** ([@rathodvamshi](https://github.com/rathodvamshi)) - Initial development

---

## Links

- **Repository**: https://github.com/rathodvamshi/Bulao
- **Issues**: https://github.com/rathodvamshi/Bulao/issues
- **Pull Requests**: https://github.com/rathodvamshi/Bulao/pulls

---

**Status**: ✅ Authentication System Complete and Production-Ready
