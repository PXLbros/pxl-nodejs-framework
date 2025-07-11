# PXL Node.js Framework: Email Removal & Package Upgrade Plan

## Phase 1: Email Support Removal

### 1.1 Files to Remove

#### Core Email Module Directory

- `/src/email/` (entire directory)
  - `emailer.ts` - Abstract base class for email functionality
  - `index.ts` - Email module exports
  - `emailers/gmail.ts` - Gmail email implementation using nodemailer
  - `emailers/sendgrid.ts` - SendGrid email implementation
  - `emailers/smtp.ts` - SMTP email implementation using nodemailer

#### Built/Compiled Email Files

- `/dist/email/` (entire directory)
  - All compiled JavaScript and TypeScript definition files for email functionality

### 1.2 Package Dependencies to Remove

From `package.json`:

- `nodemailer` (production dependency)
- `@sendgrid/mail` (production dependency)
- `@types/nodemailer` (development dependency)

### 1.3 Source Code Updates

- `/src/index.ts` - Remove line 15: `export * from './email/index.js';`

### 1.4 Documentation Updates

- `/CLAUDE.md` - Remove email service mention on line 101
- `/CLAUDE.testing.md` - Remove email service references on lines 162, 248, 286, 323

### 1.5 Post-Removal Tasks

1. Run `npm install` to update package-lock.json
2. Run `npm run build` to regenerate dist folder without email module
3. Run `npm run test` to ensure no broken imports

## Phase 2: Package Cleanup (Unused Dependencies)

### 2.1 Unused Packages to Remove

Based on codebase analysis, these packages are not used and can be safely removed:

```json
{
  "dependencies": {
    "@sentry-internal/tracing": "^7.114.0", // ❌ UNUSED
    "@sentry/cli": "^2.27.0", // ❌ UNUSED
    "envalid": "^8.0.0" // ❌ UNUSED
  }
}
```

## Phase 3: Package Upgrades

### 3.1 Critical Upgrades (Major Breaking Changes)

#### 3.1.1 Sentry Packages: 8.x → 9.x

- **Current**: `@sentry/node@8.55.0`, `@sentry/profiling-node@8.55.0`
- **Target**: `@sentry/node@9.37.0`, `@sentry/profiling-node@9.37.0`

**⚠️ BREAKING CHANGES:**

- Minimum Node.js version: 18.0.0+ (currently using 22.0.0+, so compatible)
- Minimum TypeScript version: 5.0.4+ (currently using 5.6.3, so compatible)
- Removed APIs: `getCurrentHub()`, `Hub`, `getCurrentHubShim()`
- Options removed: `enableTracing`, `autoSessionTracking`

**Migration Required:**

1. Replace `enableTracing: true` with `tracesSampleRate: 1`
2. Remove usage of deprecated Hub APIs (check `/src/logger/logger.ts`)
3. Update `beforeSendSpan` hooks to not return `null`

#### 3.1.2 Node.js Types: 22.x → 24.x

- **Current**: `@types/node@22.16.2`
- **Target**: `@types/node@24.0.13`

**⚠️ BREAKING CHANGES:**

- Corresponds to Node.js 24.x features
- Potential type definition changes

**Migration Required:**

1. Full TypeScript compilation test
2. Review Node.js 24.x changelog for API changes
3. Update TypeScript compiler if needed

#### 3.1.3 dotenv: 16.x → 17.x

- **Current**: `dotenv@16.6.1`
- **Target**: `dotenv@17.2.0`

**⚠️ BREAKING CHANGES:**

- `quiet` now defaults to `false` (will show log messages)
- Browser support removed for `path`, `os`, `crypto`

**Migration Required:**

```javascript
// Update usage to maintain quiet behavior
require('dotenv').config({ quiet: true });
```

#### 3.1.4 Redis: 4.x → 5.x

- **Current**: `redis@4.7.1`
- **Target**: `redis@5.6.0`

**⚠️ BREAKING CHANGES:**

- `client.QUIT()` deprecated → use `client.close()`
- `client.disconnect()` → use `client.destroy()`
- SCAN commands now yield collections instead of individual items

**Migration Required:**

1. Update all Redis usage in `/src/redis/` directory
2. Review connection management in `/src/redis/manager.ts`
3. Test thoroughly due to significant API changes

#### 3.1.5 Yargs: 17.x → 18.x

- **Current**: `yargs@17.7.2`
- **Target**: `yargs@18.0.0`

**⚠️ BREAKING CHANGES:**

- Minimum Node.js: ^20.19.0 || ^22.12.0 || >=23 (current 22.0.0+ compatible)
- Singleton usage removed
- ESM first approach

**Migration Required:**

1. Update usage in `/src/command/command-manager.ts`
2. Replace singleton usage with explicit instantiation
3. Update imports to proper ESM format

#### 3.1.6 ESLint Config Prettier: 9.x → 10.x

- **Current**: `eslint-config-prettier@9.1.0`
- **Target**: `eslint-config-prettier@10.1.5`

**⚠️ BREAKING CHANGES:**

- Flat config support with new import path

**Migration Required:**

```javascript
// For flat config users
import eslintConfigPrettier from 'eslint-config-prettier/flat';
```

#### 3.1.7 TypeDoc: 0.26.x → 0.28.x

- **Current**: `typedoc@0.26.11`
- **Target**: `typedoc@0.28.7`

**⚠️ BREAKING CHANGES:**

- ESM conversion required for plugins
- TypeScript 5.0+ required (already using 5.6.3)
- Configuration changes: `packages` → `entryPoints`

**Migration Required:**

1. Update TypeDoc configuration
2. Convert any plugins to ESM
3. Update configuration options

### 3.2 Minor Upgrades (Low Risk)

#### 3.2.1 Sharp: 0.33.x → 0.34.x

- **Current**: `sharp@0.33.5`
- **Target**: `sharp@0.34.3`

**Minor Breaking Changes:**

- `removeAlpha` now removes ALL alpha channels
- GIF output behavior changes

#### 3.2.2 TypeScript: 5.6.x → 5.8.x

- **Current**: `typescript@5.6.3`
- **Target**: `typescript@5.8.3`

**Minor Breaking Changes:**

- JSON import assertions required for `.json` imports
- TypedArray generics updates
- Stricter never-initialized variables checking

## Phase 4: Implementation Plan

### 4.1 Pre-Upgrade Checklist

- [ ] Full backup of current codebase
- [ ] Ensure all tests pass with current versions
- [ ] Document current functionality that depends on email
- [ ] Review Node.js version compatibility (22.0.0+ required)

### 4.2 Upgrade Sequence

#### Step 1: Remove Email Support

1. [ ] Remove email directories and files
2. [ ] Remove email dependencies from package.json
3. [ ] Update source code exports
4. [ ] Update documentation
5. [ ] Run `npm install` and `npm run build`
6. [ ] Run `npm run test` to ensure no broken imports

#### Step 2: Remove Unused Dependencies

1. [ ] Remove `@sentry-internal/tracing`
2. [ ] Remove `@sentry/cli`
3. [ ] Remove `envalid`
4. [ ] Run `npm install`

#### Step 3: Upgrade Dependencies (Staged Approach)

1. [ ] **Stage 1**: Low-risk upgrades
   - `sharp@0.34.3`
   - `eslint-config-prettier@10.1.5`
   - Test and validate

2. [ ] **Stage 2**: Medium-risk upgrades
   - `typescript@5.8.3`
   - `dotenv@17.2.0`
   - `typedoc@0.28.7`
   - Test and validate

3. [ ] **Stage 3**: High-risk upgrades
   - `@sentry/node@9.37.0`
   - `@sentry/profiling-node@9.37.0`
   - `@types/node@24.0.13`
   - Test and validate

4. [ ] **Stage 4**: Critical upgrades
   - `redis@5.6.0`
   - `yargs@18.0.0`
   - Test and validate

### 4.3 Testing Strategy

After each stage:

- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Test core functionality manually

### 4.4 Validation Checklist

- [ ] All TypeScript compilation passes
- [ ] All linting passes
- [ ] All tests pass
- [ ] All build processes work
- [ ] Documentation generates correctly
- [ ] Core framework functionality works:
  - [ ] Database connections
  - [ ] Redis connections
  - [ ] Queue processing
  - [ ] Web server
  - [ ] WebSocket server
  - [ ] Authentication
  - [ ] Logging
  - [ ] CLI commands

### 4.5 Rollback Plan

If any stage fails:

1. Revert to previous package.json
2. Run `npm install`
3. Investigate specific breaking changes
4. Apply targeted fixes
5. Retry upgrade

## Phase 5: Post-Upgrade Tasks

### 5.1 Update Documentation

- [ ] Update CLAUDE.md with new package versions
- [ ] Update any version-specific documentation
- [ ] Update changelog/release notes

### 5.2 Version Bump

- [ ] Decide on version bump strategy (major/minor/patch)
- [ ] Update version in package.json
- [ ] Create release notes highlighting email removal

### 5.3 Testing in Consumer Applications

- [ ] Test framework in actual applications
- [ ] Validate all exported functionality
- [ ] Check for any missing dependencies

## Risk Assessment

### High Risk Items

1. **Redis 4→5 upgrade**: Significant API changes
2. **Sentry 8→9 upgrade**: Major version with breaking changes
3. **@types/node 22→24**: Potential type compatibility issues

### Medium Risk Items

1. **Yargs 17→18**: Node.js version requirements and API changes
2. **TypeDoc 0.26→0.28**: Configuration and plugin changes
3. **dotenv 16→17**: Default behavior changes

### Low Risk Items

1. **Sharp 0.33→0.34**: Minor breaking changes
2. **TypeScript 5.6→5.8**: Minor version upgrade
3. **eslint-config-prettier 9→10**: Backward compatible

## Expected Benefits

### Email Removal

- Reduced bundle size
- Fewer dependencies to maintain
- Simplified API surface
- Removed security attack vectors

### Package Upgrades

- Latest security patches
- Performance improvements
- Better TypeScript support
- Modern Node.js features
- Bug fixes and stability improvements

### Cleanup Benefits

- Reduced dependency tree
- Faster installs
- Lower maintenance overhead
- Cleaner package.json

## Timeline Estimate

- **Email removal**: 2-4 hours
- **Package cleanup**: 1 hour
- **Package upgrades**: 8-12 hours (including testing)
- **Documentation updates**: 1-2 hours
- **Total**: 12-19 hours

## Notes

- All upgrades should be tested in a separate branch
- Consider using npm-check-updates for future maintenance
- Document any custom migration steps discovered during upgrade
- Keep detailed changelog of all changes made
