# 2026 Modernization Enhancements

Tracked improvements for pxl-nodejs-framework leveraging 2025/2026 ecosystem advancements.

**Current stack:** Fastify 5, MikroORM 7, TypeScript 6, Node 22, esbuild, Vitest 4, Zod 4, Biome 2.4, Pino

---

## Phase 1: Switch ESLint + Prettier -> Biome
- **Status:** Done
- **Impact:** High | **Effort:** Low-Medium
- **Changes:** Removed ESLint ^10.1.0 + Prettier ^3.8.1 + 6 related packages. Added Biome v2.4. Updated all scripts, husky hooks, and lint-staged config. Auto-fixed 165 files.

## Phase 2: Drop `dotenv` -> Node.js built-in .env loading
- **Status:** Done
- **Impact:** High | **Effort:** Low
- **Changes:** Removed `dotenv` dependency. Replaced `import 'dotenv/config'` with `process.loadEnvFile()` in all examples. Updated docs.

## Phase 3: Drop `glob` -> Node.js built-in `fs.glob()`
- **Status:** Done
- **Impact:** Medium | **Effort:** Low
- **Changes:** Removed `glob` dependency. Replaced with `node:fs` `globSync()` in esbuild config and `node:fs/promises` `glob()` in CLI routes command.

## Phase 4: Switch Winston -> Pino (Fastify native logger)
- **Status:** Done
- **Impact:** Very High | **Effort:** Medium
- **Changes:** Replaced Winston 3.19 with Pino + pino-pretty. Maintained identical public API (Logger.info/warn/error/debug/custom/log). 5-6x faster, native Fastify integration. Updated all logger tests. Exposes `pinoInstance` for Fastify logger integration.

## Phase 5: Migrate to TC39 Standard Decorators
- **Status:** Deferred
- **Impact:** High | **Effort:** Medium
- **Reason:** Framework uses old-style decorators in `FormField` (reflect-metadata based) and entity controller. Migration requires rewriting these to TC39 standard decorator signature -- a breaking change for consumers. Will revisit when MikroORM fully drops experimental decorator support.

## Phase 6: Implement `Symbol.dispose` / Explicit Resource Management
- **Status:** Done
- **Impact:** High | **Effort:** Low
- **Changes:** Added `[Symbol.asyncDispose]()` to `DatabaseManager`, `RedisManager`, `QueueManager`, and `BaseApplication`. Enables `await using` for automatic resource cleanup.

## Phase 7: Use Import Attributes for JSON
- **Status:** Skipped
- **Reason:** All JSON loading in the framework uses dynamic paths (`readFileSync` with computed paths). Import attributes require static paths known at compile time. No applicable use cases in framework source.

## Phase 8: Upgrade Node.js to 24 LTS
- **Status:** Deferred
- **Impact:** Medium | **Effort:** Low
- **Reason:** Requires Node 24 installed locally to test. When ready, update: `.nvmrc`, `.mise.toml`, `package.json` engines, esbuild target.
- **Benefits:** Stable Permission Model, Undici 7 (HTTP/2 + HTTP/3), `URLPattern` global, better perf

---

## Future / Monitor

| Item | Status | Notes |
|------|--------|-------|
| TC39 Standard Decorators | Deferred | Blocked by FormField/entity controller decorator patterns |
| Rolldown (Vite 8) | Monitor | esbuild still solid for library bundling |
| Node.js Permission Model | Document | Worth documenting as deployment best practice |
| AsyncContext (TC39) | Wait | Stage 2, years away. AsyncLocalStorage remains correct |
| TypeScript 7.0 (Go rewrite) | Prepare | Use `stableTypeOrdering` flag in TS 6 for forward-compat |
| Native TS execution for CLI | After decorators | Blocked by experimentalDecorators dependency |
| Zod 4 features | Incremental | Schema registries, built-in JSON Schema conversion |

---

## Dependencies Removed
- `eslint` + 6 related packages
- `prettier` + 2 related packages
- `dotenv`
- `glob`
- `winston`
- `lint-staged`

## Dependencies Added
- `@biomejs/biome` (dev)
- `pino`
- `pino-pretty`
