# Contributing to PXL Node.js Framework

Thank you for your interest in contributing to the PXL Node.js Framework! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and considerate of others
- Welcome newcomers and help them get started
- Focus on what is best for the community and the project
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** >= 22.0.0 (check with `node --version`)
- **npm** >= 10.0.0 (check with `npm --version`)
- **Git** for version control
- **Docker** (optional, for running Redis/PostgreSQL locally)
- A code editor with TypeScript support (VS Code recommended)

### Finding Issues to Work On

- Check the [GitHub Issues](https://github.com/pxlbros/pxl-nodejs-framework/issues) page
- Look for issues labeled `good first issue` for beginner-friendly tasks
- Look for issues labeled `help wanted` for contributions needed
- Feel free to ask questions on issues before starting work

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/pxl-nodejs-framework.git
cd pxl-nodejs-framework

# Add upstream remote
git remote add upstream https://github.com/pxlbros/pxl-nodejs-framework.git
```

### 2. Install Dependencies

```bash
npm install
```

This will:

- Install all dependencies
- Set up Husky pre-commit hooks
- Build the framework automatically

### 3. Build the Framework

```bash
# Clean build
npm run build

# Development build with watch mode
npm run dev
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 5. Verify Everything Works

```bash
# Run all checks (linting, formatting, type checking)
npm run check-all
```

If all checks pass, you're ready to start developing!

---

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a new branch for your feature
git checkout -b feature/my-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

**Branch Naming Convention:**

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring without behavior changes
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks (dependencies, configs, etc.)

### 2. Make Your Changes

- Write clean, readable code
- Follow the code style guidelines (see below)
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run tests
npm test

# Check coverage
npm run test:coverage

# Verify types
npm run typecheck

# Check linting
npm run lint

# Check formatting
npm run prettier

# Or run all checks at once
npm run check-all
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
# Format: <type>(<scope>): <description>

git commit -m "feat(webserver): add rate limiting support"
git commit -m "fix(database): resolve connection pool leak"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(queue): add integration tests for job processing"
```

**Commit Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic changes)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements
- `ci:` - CI/CD changes

**Pre-commit Hooks:**

Husky runs linting and formatting automatically on staged files. If checks fail, the commit will be blocked. Fix the issues and try again.

### 5. Push and Create Pull Request

```bash
# Push your branch to your fork
git push origin feature/my-feature-name

# Go to GitHub and create a Pull Request
```

---

## Code Style Guidelines

### TypeScript Guidelines

1. **Use TypeScript Strict Mode**
   - All code must pass `npm run typecheck`
   - Avoid using `any` - use proper types or `unknown`
   - Prefer interfaces for object shapes, types for unions/intersections

2. **File Naming**
   - Use kebab-case: `my-feature.ts`, `user-service.ts`
   - Use `.interface.ts` for interface-only files
   - Use `.type.ts` for type-only files

3. **Import Conventions**

   ```typescript
   // ✅ Correct - Use .js extensions in imports (ESM requirement)
   import { Logger } from '../logger/index.js';
   import { WebServer } from '../webserver/webserver.js';

   // ❌ Incorrect - Missing .js extension
   import { Logger } from '../logger';
   ```

4. **Async/Await**
   - Prefer `async/await` over Promises and callbacks
   - Always handle errors with try/catch or propagate them
   - Use `Promise.all()` for concurrent operations

5. **Error Handling**
   ```typescript
   // ✅ Good - Specific error handling
   try {
     await operation();
   } catch (error) {
     if (error instanceof SpecificError) {
       // Handle specific error
     }
     throw error; // Re-throw if can't handle
   }
   ```

### Code Organization

1. **File Structure**

   ```typescript
   // 1. Imports (grouped: external, internal, types)
   import { WebServer } from 'fastify';
   import { Logger } from '../logger/index.js';
   import type { Config } from './config.interface.js';

   // 2. Constants
   const DEFAULT_PORT = 3000;

   // 3. Types/Interfaces
   interface Options {
     port: number;
   }

   // 4. Class/Function implementation
   export class MyService {
     // ...
   }
   ```

2. **Class Structure**

   ```typescript
   export class MyService {
     // 1. Public properties
     public name: string;

     // 2. Private properties
     private config: Config;

     // 3. Constructor
     constructor(config: Config) {
       this.config = config;
     }

     // 4. Public methods
     public async start() {}

     // 5. Private methods
     private initialize() {}
   }
   ```

### Linting and Formatting

We use **ESLint** and **Prettier** with pre-configured rules:

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check formatting
npm run prettier

# Auto-format code
npm run prettier:fix
```

**Editor Setup (VS Code):**

Install recommended extensions:

- ESLint
- Prettier
- EditorConfig

Your editor will auto-format on save if configured properly.

---

## Testing Requirements

### Coverage Requirements

All pull requests must maintain **80% code coverage** across:

- Lines
- Branches
- Functions
- Statements

```bash
# Check coverage
npm run test:coverage
```

### Test Organization

```
test/
├── unit/           # Unit tests (isolated, mocked dependencies)
├── integration/    # Integration tests (real dependencies)
└── e2e/            # End-to-end tests (full application flows)
```

### Writing Tests

We use **Vitest** for testing:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService(testConfig);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should initialize correctly', () => {
    expect(service).toBeDefined();
    expect(service.name).toBe('test-service');
  });

  it('should handle async operations', async () => {
    const result = await service.process({ data: 'test' });
    expect(result.success).toBe(true);
  });

  it('should throw error for invalid input', () => {
    expect(() => service.validate(null)).toThrow('Invalid input');
  });
});
```

### Test Guidelines

1. **Test Naming**: Use descriptive `it('should ...')` format
2. **Arrange-Act-Assert**: Structure tests clearly
3. **One Assertion Per Test**: Keep tests focused
4. **Mock External Dependencies**: Use mocks for databases, APIs, etc.
5. **Test Edge Cases**: Include error conditions and boundary values
6. **Async Testing**: Use `async/await` properly

---

## Pull Request Process

### Before Submitting

✅ **Checklist:**

- [ ] Code follows style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Coverage meets 80% threshold
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting is correct (`npm run prettier`)
- [ ] Documentation is updated (if applicable)
- [ ] CHANGELOG.md is updated (for significant changes)
- [ ] Commit messages follow conventional commits format
- [ ] Branch is up to date with `main`

### Creating the Pull Request

1. **Title**: Use descriptive title following conventional commits
   - `feat: Add WebSocket authentication`
   - `fix: Resolve memory leak in queue processor`

2. **Description**: Include:

   ```markdown
   ## Summary

   Brief description of changes

   ## Changes

   - Added feature X
   - Fixed bug Y
   - Updated documentation Z

   ## Testing

   - Added unit tests for new feature
   - Verified integration tests pass
   - Manual testing performed

   ## Screenshots (if applicable)

   [Add screenshots for UI changes]

   ## Breaking Changes (if any)

   - Describe any breaking changes
   - Migration guide if needed

   ## Related Issues

   Closes #123
   Relates to #456
   ```

3. **Labels**: Add appropriate labels:
   - `bug` - Bug fixes
   - `enhancement` - New features
   - `documentation` - Documentation updates
   - `breaking` - Breaking changes

### Review Process

1. **Automated Checks**: CI/CD will run tests, linting, and type checking
2. **Code Review**: Maintainers will review your code
3. **Address Feedback**: Make requested changes
4. **Approval**: Once approved, a maintainer will merge your PR

### After Merge

- Your changes will be included in the next release
- Delete your feature branch
- Update your fork's main branch

```bash
git checkout main
git pull upstream main
git push origin main
git branch -d feature/my-feature-name
```

---

## Release Process

Releases are managed by maintainers using semantic versioning:

- **Major** (v2.0.0) - Breaking changes
- **Minor** (v1.1.0) - New features (backward compatible)
- **Patch** (v1.0.1) - Bug fixes (backward compatible)

### Release Commands

```bash
# Patch release (1.0.0 → 1.0.1)
npm run release -- --patch

# Minor release (1.0.0 → 1.1.0)
npm run release -- --minor

# Major release (1.0.0 → 2.0.0)
npm run release -- --major

# Specific version
npm run release -- --version 2.1.5

# Dry run (preview without publishing)
npm run release -- --dry-run
```

---

## Getting Help

### Documentation

- [README.md](README.md) - Framework overview and quick start
- [CLAUDE.md](CLAUDE.md) - Development guide and architecture
- [TODO.md](TODO.md) - Roadmap and planned features
- [API Documentation](https://pxlbros.github.io/pxl-nodejs-framework/)

### Community Support

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community discussions
- **Pull Requests**: For code reviews and collaboration

### Contact Maintainers

For urgent issues or questions, contact:

- Email: devops@pxlagency.com
- GitHub: [@pxlbros](https://github.com/pxlbros)

---

## Recognition

Contributors are recognized in:

- GitHub Contributors page
- Release notes (for significant contributions)
- Project documentation (for major features)

Thank you for contributing to the PXL Node.js Framework! 🎉

---

**Built with ❤️ by [PXL Agency](https://pxlagency.com)**
