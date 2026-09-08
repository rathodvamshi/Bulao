# Contributing to Bulao

Thank you for your interest in contributing to Bulao! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Code Style](#code-style)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Our Standards

**Positive behaviors:**
- Being respectful and inclusive
- Accepting constructive criticism gracefully
- Focusing on what's best for the community
- Showing empathy towards others

**Unacceptable behaviors:**
- Harassment or discriminatory language
- Trolling or insulting comments
- Publishing others' private information
- Unprofessional conduct

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Node.js** 18+ installed
2. **pnpm** 8+ installed
3. **Git** configured with your name and email
4. **GitHub account**
5. **Cloudflare account** (for backend work)
6. **MSG91 account** (for auth work)

### Fork and Clone

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Bulao.git
   cd Bulao
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/rathodvamshi/Bulao.git
   ```

---

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Copy example files and fill in your credentials:

```bash
# Mobile
cp mobile/.env.example mobile/.env

# Backend
cp backend/.dev.vars.example backend/.dev.vars
```

### 3. Set Up Database

```bash
cd backend
pnpm db:migrate
```

### 4. Run Development Servers

```bash
# Terminal 1: Backend
cd backend
pnpm dev

# Terminal 2: Mobile
cd mobile
pnpm start
```

---

## Making Changes

### 1. Create a Branch

Create a descriptive branch name:

```bash
# Feature
git checkout -b feature/add-user-profile

# Bug fix
git checkout -b fix/auth-session-expiry

# Documentation
git checkout -b docs/update-setup-guide
```

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code patterns
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Type checking
cd mobile && pnpm typecheck
cd backend && pnpm typecheck

# Run tests
cd backend && pnpm test

# Manual testing
# Test on both iOS and Android if possible
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring (no feature/fix)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `ci`: CI/CD configuration

### Scope (Optional)

- `auth`: Authentication system
- `mobile`: Mobile app
- `backend`: Backend API
- `db`: Database
- `ui`: User interface

### Examples

```bash
# Good
feat(auth): add biometric authentication
fix(mobile): resolve session persistence bug
docs: update README with deployment steps
refactor(backend): improve auth coordinator logic

# Bad
update stuff
fixed bug
changes
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer:

```
feat(api)!: change user endpoint response format

BREAKING CHANGE: Users endpoint now returns nested user object
```

---

## Pull Request Process

### 1. Update Your Branch

Before creating a PR, sync with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Push Your Branch

```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request

1. Go to https://github.com/rathodvamshi/Bulao/pulls
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on Android
- [ ] Tested on iOS
- [ ] Backend tests pass
- [ ] Type checking passes

## Screenshots (if applicable)
Add screenshots

## Related Issues
Closes #123
```

### 4. Code Review

- Address review comments promptly
- Push changes to the same branch
- Keep discussion professional and constructive

### 5. Merge

Once approved, a maintainer will merge your PR.

---

## Testing

### Running Tests

```bash
# Backend unit tests
cd backend
pnpm test

# Backend type checking
pnpm typecheck

# Mobile type checking
cd mobile
pnpm typecheck
```

### Writing Tests

- Add tests for new features
- Ensure existing tests pass
- Aim for good coverage
- Test edge cases

### Manual Testing

- Test on physical devices when possible
- Test both Android and iOS
- Test different network conditions
- Test authentication flows thoroughly

---

## Code Style

### TypeScript

- Use TypeScript strictly (avoid `any`)
- Define proper types and interfaces
- Use meaningful variable names
- Keep functions small and focused

```typescript
// Good
interface User {
  id: string;
  name: string;
  phone: string;
}

async function validateUserSession(token: string): Promise<User> {
  // Implementation
}

// Bad
function validate(t: any) {
  // Implementation
}
```

### React/React Native

- Use functional components
- Use hooks properly
- Keep components small
- Extract reusable logic

```typescript
// Good
function ProfileScreen() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(['profile'], fetchProfile);
  
  if (isLoading) return <Loading />;
  
  return <View>...</View>;
}

// Bad
class Profile extends Component {
  // Class components are discouraged
}
```

### Backend

- Use async/await (avoid raw promises)
- Validate all input
- Use proper error handling
- Log important events

```typescript
// Good
async function createSession(phone: string): Promise<Session> {
  const validated = phoneSchema.parse(phone);
  
  try {
    const session = await db.createSession(validated);
    logger.info('Session created', { userId: session.userId });
    return session;
  } catch (error) {
    logger.error('Session creation failed', { error });
    throw new ApiError('SESSION_CREATE_FAILED', 500);
  }
}
```

### Formatting

We use Prettier for consistent formatting:

```bash
# Format code
pnpm format

# Check formatting
pnpm format:check
```

---

## Areas for Contribution

### 🟢 Good First Issues

- Documentation improvements
- UI/UX enhancements
- Bug fixes
- Test coverage
- Code comments

### 🟡 Intermediate

- New features
- API improvements
- Database optimizations
- Performance improvements

### 🔴 Advanced

- Architecture decisions
- Security enhancements
- Infrastructure setup
- Complex features

---

## Questions?

- **General**: Open a [Discussion](https://github.com/rathodvamshi/Bulao/discussions)
- **Bugs**: Open an [Issue](https://github.com/rathodvamshi/Bulao/issues)
- **Security**: Email security@bulao.app (placeholder)

---

## Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Project documentation

Thank you for contributing to Bulao! 🙏
