# Bulao - Local Work Platform

**Bulao** is a mobile-first platform connecting local workers with customers for jobs and services in their area. Think "Uber for local work" - from plumbing and carpentry to event help and delivery services.

![Platform](https://img.shields.io/badge/Platform-React%20Native-blue)
![Backend](https://img.shields.io/badge/Backend-Cloudflare%20Workers-orange)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow)

---

## 🎯 Project Overview

### What is Bulao?

Bulao helps people find and hire local workers for everyday tasks:
- **For Customers**: Post a job or request a service
- **For Workers**: Find work opportunities nearby
- **Real-time**: Browse, apply, and confirm instantly

### Current Features (v0.1)

✅ **Authentication System** (Production-Ready)
- OTP-based login via MSG91
- Secure session persistence
- Auto-login on app restart
- Server-side session validation

🚧 **In Development**
- Job posting and browsing
- Service provider profiles
- Real-time interactions
- Trust and review system
- Payment integration

---

## 🏗️ Architecture

### Tech Stack

#### Mobile App
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: Zustand + React Query
- **Storage**: Expo SecureStore
- **Styling**: NativeWind (Tailwind CSS)

#### Backend
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Queue**: Cloudflare Queues
- **Durable Objects**: Auth Coordinator
- **ORM**: Drizzle ORM
- **Language**: TypeScript

#### Services
- **OTP Provider**: MSG91
- **Image Storage**: Cloudinary (planned)

### Architecture Diagram

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Workers (API)   │
├─────────────────┤
│ • Auth          │
│ • Jobs          │
│ • Services      │
│ • Interactions  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│   D1   │ │  MSG91   │
│Database│ │   OTP    │
└────────┘ └──────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **pnpm** 8+ ([Install](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/))
- **Expo CLI** (will be installed automatically)
- **Cloudflare Account** ([Sign up](https://dash.cloudflare.com/sign-up))
- **MSG91 Account** ([Sign up](https://msg91.com/))

### For Mobile Development
- **Android Studio** (for Android) OR **Xcode** (for iOS)
- **Expo Go App** (for testing on physical device)

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rathodvamshi/Bulao.git
cd Bulao
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for:
- `/mobile` - React Native app
- `/backend` - Cloudflare Workers API
- `/domain` - Shared types and schemas

### 3. Set Up Environment Variables

#### Mobile App

Create `mobile/.env`:

```env
# API Configuration
EXPO_PUBLIC_API_BASE_URL=https://bulao-api-staging.codecheck369.workers.dev/api/v1

# MSG91 Configuration (for OTP)
EXPO_PUBLIC_MSG91_WIDGET_ID=your_widget_id_here
EXPO_PUBLIC_MSG91_TOKEN_AUTH=your_token_auth_here
```

> **Note**: Get MSG91 credentials from your MSG91 dashboard after creating a SendOTP widget.

#### Backend

Create `backend/.dev.vars`:

```env
# Cloudflare Configuration
APP_ENV=development

# OTP Provider
OTP_PROVIDER=msg91
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_TEMPLATE_ID=your_template_id_here

# Image Upload (Optional - for future use)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security
AUTH_HASH_KEY=your_32_character_random_string_here

# CORS
ALLOWED_ORIGIN=http://localhost:8081
```

> **Security Note**: Never commit `.env` or `.dev.vars` files. They're already in `.gitignore`.

---

## 🏃 Running the Project

### Option 1: Run Both (Recommended)

```bash
# Terminal 1: Start backend
cd backend
pnpm dev

# Terminal 2: Start mobile app
cd mobile
pnpm start
```

### Option 2: Run Individually

#### Backend Only

```bash
cd backend
pnpm dev
```

The API will be available at `http://localhost:8787`

#### Mobile App Only

```bash
cd mobile
pnpm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator  
- Scan QR code with Expo Go app on your phone

---

## 🗄️ Database Setup

### Initialize D1 Database (Staging)

```bash
cd backend

# Create D1 database (first time only)
wrangler d1 create bulao-dev

# Apply migrations
pnpm db:migrate
```

### Generate New Migration

```bash
cd backend

# 1. Update schema in src/db/schema.ts
# 2. Generate migration
pnpm db:generate

# 3. Apply migration
pnpm db:migrate
```

### Query Database

```bash
# View users
wrangler d1 execute DB --env staging --command "SELECT * FROM users LIMIT 10"

# View sessions
wrangler d1 execute DB --env staging --command "SELECT * FROM sessions LIMIT 10"
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
pnpm test
```

### Type Checking

```bash
# Backend
cd backend
pnpm typecheck

# Mobile
cd mobile
pnpm typecheck
```

---

## 🚢 Deployment

### Deploy Backend to Cloudflare

```bash
cd backend

# Deploy to staging
pnpm deploy:staging

# Deploy to production (when ready)
wrangler deploy --env production
```

### Build Mobile App

```bash
cd mobile

# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

> **Note**: Configure EAS in `mobile/eas.json` before building.

---

## 📁 Project Structure

```
Bulao/
├── mobile/                 # React Native mobile app
│   ├── app/               # Expo Router screens
│   │   ├── (tabs)/       # Tab navigation screens
│   │   ├── auth.tsx      # Authentication screen
│   │   └── index.tsx     # Entry point / Bootstrap
│   ├── src/
│   │   ├── auth/         # Authentication module (NEW)
│   │   ├── api/          # API clients
│   │   ├── components/   # Reusable components
│   │   ├── features/     # Feature modules
│   │   └── store/        # State management
│   └── package.json
│
├── backend/               # Cloudflare Workers API
│   ├── src/
│   │   ├── modules/      # Feature modules
│   │   │   ├── auth/    # Authentication
│   │   │   ├── jobs/    # Job postings
│   │   │   └── services/ # Service providers
│   │   ├── db/          # Database schema
│   │   ├── providers/   # External services (MSG91)
│   │   └── app.ts       # Main application
│   ├── migrations/       # D1 migrations
│   └── wrangler.toml    # Cloudflare config
│
├── domain/               # Shared types/schemas
│   └── src/
│       └── index.ts
│
├── scripts/             # Utility scripts
├── docs/                # Additional documentation
└── package.json         # Workspace configuration
```

---

## 🔐 Authentication System

### How It Works

1. **User enters phone number** → MSG91 sends OTP
2. **User enters OTP** → Backend validates with MSG91
3. **Session created** → Token stored in SecureStore
4. **Auto-login** → App restart uses stored token
5. **Session validation** → Backend checks on every API call

### Security Features

- ✅ Encrypted token storage (iOS Keychain / Android Keystore)
- ✅ Hashed tokens in database (SHA-256)
- ✅ Server-side session validation
- ✅ 30-day session expiration
- ✅ Proper logout with server-side revocation
- ✅ No OTP or secrets stored on client

### API Endpoints

```
POST /api/v1/auth/verify-widget-otp  # Create session after OTP
GET  /api/v1/auth/me                 # Validate session
POST /api/v1/auth/logout             # Revoke session
```

---

## 📚 Documentation

Detailed documentation available in `/docs`:

- [`AUTHENTICATION_IMPLEMENTATION.md`](./AUTHENTICATION_IMPLEMENTATION.md) - Complete auth system docs
- [`AUTH_IMPLEMENTATION_SUMMARY.md`](./AUTH_IMPLEMENTATION_SUMMARY.md) - Implementation summary
- [`BACKEND_SESSION_FIX.md`](./BACKEND_SESSION_FIX.md) - Session creation fix details
- [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) - Detailed setup instructions
- [`CREDENTIALS.md`](./CREDENTIALS.md) - Credentials reference (DO NOT COMMIT)

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

#### 2. Metro bundler cache issues
```bash
cd mobile
rm -rf .expo
pnpm start --clear
```

#### 3. Backend deployment fails
```bash
# Ensure you're logged into Cloudflare
wrangler login

# Check wrangler.toml configuration
wrangler whoami
```

#### 4. OTP not received
- Check MSG91 dashboard for credit balance
- Verify phone number format (+91 for India)
- Check MSG91 template is approved

#### 5. Session not persisting
- Check SecureStore permissions
- Verify backend session creation logs
- Check D1 database for session records

### Getting Help

- Check existing [Issues](https://github.com/rathodvamshi/Bulao/issues)
- Create a new issue with:
  - Clear description
  - Steps to reproduce
  - Error logs
  - Environment details

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   pnpm typecheck
   pnpm test
   ```
5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add user profile editing"
   ```
6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or tooling changes

---

## 📋 Development Roadmap

### Phase 1: Authentication ✅ COMPLETE
- [x] OTP-based login
- [x] Session persistence
- [x] Auto-login on restart
- [x] Secure token storage

### Phase 2: Core Features 🚧 IN PROGRESS
- [ ] Job posting
- [ ] Job browsing and search
- [ ] Service provider profiles
- [ ] Application system

### Phase 3: Interactions
- [ ] Real-time notifications
- [ ] Chat system
- [ ] Confirmation workflow
- [ ] Review and rating system

### Phase 4: Trust & Safety
- [ ] Identity verification
- [ ] Background checks
- [ ] Dispute resolution
- [ ] Safety guidelines

### Phase 5: Payments
- [ ] Payment gateway integration
- [ ] Escrow system
- [ ] Payout management
- [ ] Invoicing

---

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. Email: [security@bulao.app](mailto:security@bulao.app) (placeholder)
3. Include:
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Security Measures

- All API requests use HTTPS
- Tokens hashed with SHA-256
- Rate limiting on auth endpoints
- Input validation and sanitization
- CORS protection
- SQL injection prevention (parameterized queries)

---

## 📝 License

This project is proprietary software. All rights reserved.

**Copyright © 2025 Bulao**

Unauthorized copying, distribution, or modification is prohibited.

---

## 👥 Team

- **Vamshi Rathod** - [@rathodvamshi](https://github.com/rathodvamshi)

---

## 📞 Contact

- **Email**: vamshi@bulao.app (placeholder)
- **GitHub**: [github.com/rathodvamshi/Bulao](https://github.com/rathodvamshi/Bulao)

---

## 🙏 Acknowledgments

- [Expo](https://expo.dev/) - React Native framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing
- [MSG91](https://msg91.com/) - OTP service
- [Hono](https://hono.dev/) - Lightweight web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM

---

**Built with ❤️ for local communities**
