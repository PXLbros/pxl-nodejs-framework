# Linting Fix Plan

## Overview

This plan addresses the current linting errors and warnings in the PXL Node.js Framework codebase. The issues have been categorized by severity and a systematic approach is outlined for resolution.

## Current State Analysis

### Linting Configuration

- **ESLint**: Modern flat config (`eslint.config.js`) with TypeScript support
- **Prettier**: JSON configuration (`.prettierrc`) with 2-space indentation
- **Available Commands**:
  - `npm run lint` - Run ESLint with auto-fix
  - `npm run lint:check` - Run ESLint without fixing
  - `npm run format` - Run Prettier with auto-format
  - `npm run format:check` - Check Prettier formatting only
  - `npm run typecheck` - Run TypeScript type checking

### Current Issues Summary

- **Critical Errors**: 11 total (must fix)
- **Warnings**: 85 total (should fix)
- **Formatting Issues**: 13 files need Prettier formatting

## Phase 1: Fix Critical Errors (11 issues)

### 1. Global Type Definitions

**Issue**: `WebSocket` and `NodeJS` types not recognized
**Files Affected**: Multiple WebSocket and system files
**Solution**: Add global type definitions to ESLint config

### 2. Duplicate Imports

**Issue**: Duplicate imports in AWS S3 service
**File**: `src/services/aws/s3.ts`
**Solution**: Remove duplicate `fs` and `stream` imports

### 3. Test Setup Issues

**Issue**: `beforeEach`, `afterEach` not defined in test files
**Files Affected**: Test setup files
**Solution**: Configure Vitest globals in ESLint config

### 4. Regex Escaping

**Issue**: Unnecessary escape sequences in regex patterns
**File**: `src/util/str.ts`
**Solution**: Remove unnecessary backslashes in regex patterns

## Phase 2: Clean Up Warnings (85 issues)

### 1. Unused Variables and Imports (Majority of warnings)

**Solution Strategy**:

- Remove completely unused imports
- Add underscore prefix to intentionally unused parameters
- Review and clean up dead code

### 2. Security Warnings

**Issue**: Object injection sink warnings from security plugin
**Solution**: Review each case and suppress false positives with inline comments

### 3. Formatting Issues

**Issue**: 13 files need Prettier formatting
**Solution**: Run `npm run format` to auto-fix

## Phase 3: Configuration Improvements

### 1. Add .prettierignore

**Purpose**: Exclude unnecessary files from Prettier formatting
**Files to exclude**:

- `dist/`
- `node_modules/`
- `coverage/`
- `*.md` (documentation files)

### 2. Fine-tune ESLint Rules

**Improvements**:

- Configure global types properly
- Adjust unused variable rules for better developer experience
- Review security plugin configuration

### 3. Update Development Workflow

**Enhancements**:

- Ensure pre-commit hooks are working correctly
- Verify lint-staged configuration
- Test CI/CD pipeline integration

## Implementation Steps

1. **Run Initial Analysis**

   ```bash
   npm run lint:check
   npm run format:check
   npm run typecheck
   ```

2. **Fix Critical Errors**
   - Update ESLint config for global types
   - Fix duplicate imports
   - Resolve test setup issues
   - Fix regex escaping

3. **Clean Up Warnings**
   - Remove unused imports/variables
   - Address security warnings
   - Run Prettier formatting

4. **Improve Configuration**
   - Add .prettierignore file
   - Fine-tune ESLint rules
   - Test complete workflow

5. **Verify Success**
   ```bash
   npm run lint
   npm run format
   npm run typecheck
   npm run build
   ```

## Expected Outcomes

- **Zero linting errors**: All critical issues resolved
- **Minimal warnings**: Only legitimate warnings remaining
- **Consistent formatting**: All files properly formatted
- **Improved developer experience**: Better linting configuration
- **Maintainable codebase**: Clean, consistent code style

## Notes

- All changes will maintain existing code functionality
- Configuration changes will be backward compatible
- The plan focuses on fixing existing issues, not changing coding standards
- Each phase can be implemented independently if needed
