# Upgrade Guide

## v1.0.48 - Memory Management Improvements (BREAKING CHANGES)

This version introduces critical memory leak fixes and improved EntityManager lifecycle management. Several breaking changes ensure memory-safe defaults.

### Breaking Changes

#### 1. EntityController.entityManager Removed

**What changed:**

- `EntityController.entityManager` instance property removed
- EntityManager is now request-scoped (different instance per HTTP request)
- Automatic cleanup after each request

**Before (v1.x - Memory Leak):**

```typescript
class MyController extends EntityController {
  async customRoute(request: FastifyRequest, reply: FastifyReply) {
    // Used shared EntityManager - memory leak!
    const users = await this.entityManager.find('User', {});
    reply.send({ users });
  }
}
```

**After (v1.0.48 - Safe):**

```typescript
class MyController extends EntityController {
  async customRoute(request: FastifyRequest, reply: FastifyReply) {
    // Use withEntityManager for automatic cleanup
    await this.databaseInstance.withEntityManager(async em => {
      const users = await em.find('User', {});
      reply.send({ users });
    });
  }
}
```

**Or use hooks (recommended):**

```typescript
class MyController extends EntityController {
  protected async preGetMany({ entityManager, request, reply }) {
    // entityManager is automatically request-scoped
    const count = await entityManager.count('User', {});
  }
}
```

#### 2. EntityController Hook Behavior Change

Pre/post hooks now receive request-scoped EntityManager instead of shared instance.

**Impact:** If your hooks stored references to the EntityManager, they will now receive different instances per request (this is correct behavior for memory safety).

**Migration:** No code changes needed, but be aware that EntityManager references are no longer shared across requests.

### New Features

#### DatabaseInstance Helper Methods

**`withEntityManager(callback)`** - Automatic EntityManager cleanup

```typescript
await databaseInstance.withEntityManager(async em => {
  const user = await em.findOne('User', { id: 1 });
  return user;
});
// em.clear() called automatically, even if callback throws
```

**`withTransaction(callback)`** - Transactional with automatic cleanup

```typescript
await databaseInstance.withTransaction(async em => {
  const user = em.create('User', { name: 'John' });
  await em.persistAndFlush(user);
  return user;
});
```

**`getEntityManager()`** - Now deprecated with warning

Still available but deprecated. Use `withEntityManager()` instead to avoid manual cleanup.

#### BaseProcessor Lifecycle Hooks

Queue processors now support optional lifecycle hooks for resource management:

```typescript
class MyProcessor extends BaseProcessor {
  async beforeProcess({ job }) {
    // Setup logic before job processing
  }

  async process({ job }) {
    // Your job logic
    return result;
  }

  async afterProcess({ job, result, error }) {
    // Cleanup logic - ALWAYS called, even if process() throws
  }
}
```

**Helper method:**

```typescript
class MyProcessor extends BaseProcessor {
  async process({ job }) {
    // Automatic EntityManager cleanup
    return this.withEntityManager(async em => {
      const user = await em.findOne('User', { id: job.data.userId });
      return user;
    });
  }
}
```

### WebSocket Memory Management

WebSocket controllers are singletons - **never store EntityManager as instance property**.

**Updated documentation** added to `WebSocketServerBaseController` with examples of safe patterns.

### Migration Steps

1. **Update EntityController subclasses:**
   - Replace `this.entityManager` with `this.databaseInstance.withEntityManager()`
   - Or use request-scoped EM in hooks

2. **Review queue processors:**
   - Consider using lifecycle hooks for resource management
   - Use `this.withEntityManager()` for database operations

3. **Check WebSocket controllers:**
   - Ensure no EntityManager stored as instance property
   - Use `this.databaseInstance.withEntityManager()` per message

4. **Run tests:**

   ```bash
   npm test
   ```

5. **Monitor memory usage in production:**
   - Heap should stabilize, not grow indefinitely
   - Watch for GC frequency and request latency

### Documentation

- New guide: [Memory Management](./docs/guides/memory-management.md)
- Updated: [Database Guide](./docs/concepts/database.md)
- Updated: [Queue Guide](./docs/concepts/queue.md)

### Why These Changes?

**Problem:** MikroORM's EntityManager maintains an identity map that accumulates entities in memory. Without clearing it, memory grows unbounded until OOM crashes occur.

**Solution:** Request-scoped and operation-scoped EntityManagers with automatic cleanup prevent memory leaks while maintaining the benefits of the identity map pattern.

**Impact:** Applications running under sustained load will maintain stable memory usage instead of crashing after hours/days of operation.

---

## Pre-Launch Cleanup - Removed Features (v1.0.x)

The following backward compatibility features were removed **before the official launch** (when there were no users). These are documented here for historical reference only - no migration is needed since these features were never in a public release.

### 1. Legacy Route Validation System (Removed)

**What was removed:**

- `validation` property on route definitions (replaced by `schema` with Zod)
- `buildLegacySchema()` method in WebServer
- Support for old-style Joi validation schemas on routes

**Why it was removed:**
The framework now uses Zod exclusively for route validation, providing better TypeScript integration and type safety.

**Modern approach:**

```ts
// Use 'schema' with Zod instead
{
  method: 'POST',
  path: '/users',
  controller: UserController,
  action: 'create',
  schema: {
    body: z.object({
      email: z.string().email(),
      name: z.string().min(2),
    }),
  },
}
```

### 2. Config Schema Duplicate Fields (Removed)

**What was removed:**

- `url` field on route config (use `path` instead)
- `webServer` field on app config (use `web` instead)

**Why it was removed:**
Eliminated naming confusion and enforced consistent field names across the framework.

### 3. Legacy HMR Script (Removed)

**What was removed:**

- `dev:legacy` npm script for old HMR watcher

**Why it was removed:**
The new HMR system is more efficient and reliable. The legacy script is no longer needed.

---

## Entity Schema System Migration (Breaking Change)

This guide explains how to migrate from the legacy `schema` / `schemaCreate` / `schemaUpdate` pattern to the new unified `defineSchemas` system introduced in version NEXT (date: 2025-10-06).

> TL;DR: Delete `schema`, `schemaCreate`, `schemaUpdate`, and any calls to `configureSchemas`. Add a static block with `defineSchemas({ shape, updatableFields })`. Use `validateCreate()` and `validateUpdate()` only.

## Why This Change?

- Reduced duplication: A single `shape` becomes both the create contract and the basis for a safe partial update.
- Explicit mutability: `updatableFields` whitelists what can change after creation.
- Clear naming: `createSchema`, `updateSchema`, and optional `readSchema` are the only schema entry points.
- Predictable automation: Static `defineSchemas` eliminates manual assignments and prevents drift.

## Old vs New Overview

| Concern                | Legacy Pattern                                                     | New Pattern                                 |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Create Validation      | `schema` or `schemaCreate`                                         | `createSchema` (readonly, auto-generated)   |
| Update Validation      | `schemaUpdate` (hand-written or partial)                           | `updateSchema` (auto-derived + filtered)    |
| Read Shape             | Not standardized / ad-hoc                                          | `readSchema` (optional)                     |
| Wiring                 | Manual static property assignment or `configureSchemas`            | Single static block: `defineSchemas({...})` |
| Validation Entrypoints | `validate(item, isCreating)` + `validateCreate` + `validateUpdate` | `validateCreate` + `validateUpdate` only    |

## Before Migration Example

```ts
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { z } from 'zod';
import { DynamicEntity } from 'pxl/database/dynamic-entity';
import { buildEntitySchemas } from 'pxl/schemas/entity-builder';

@Entity()
export class LegacyUser extends DynamicEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @Property({ nullable: true })
  displayName?: string;

  // Option A: Manual
  static schema = z
    .object({
      email: z.string().email(),
      displayName: z.string().min(2).optional(),
    })
    .strict();

  static schemaUpdate = z
    .object({
      displayName: z.string().min(2).optional(),
    })
    .strict()
    .refine(obj => Object.keys(obj).length > 0, 'At least one field required');

  // Option B: Older helper (now removed)
  // static { this.configureSchemas({ shape: { email: z.string().email(), displayName: z.string().min(2).optional() }, updatableFields: ['displayName'] }) }
}
```

## After Migration Example (Canonical)

```ts
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { z } from 'zod';
import { DynamicEntity } from 'pxl/database/dynamic-entity';

@Entity()
export class User extends DynamicEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @Property({ nullable: true })
  displayName?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  static {
    this.defineSchemas({
      shape: {
        email: z.string().email(),
        displayName: z.string().min(2).optional(),
      },
      updatableFields: ['displayName'] as const,
      readAugment: {
        // optional: include persisted or system fields for projection
        id: z.number().int().positive(),
        createdAt: z.date(),
        updatedAt: z.date(),
      },
    });
  }
}
```

### What Gets Generated

- `createSchema` => strict object with: `email`, `displayName?`
- `updateSchema` => `Partial` of updatable subset: `{ displayName? }` + enforced non-empty object
- `readSchema` (optional) => merge(`createSchema.shape`, `readAugment`)

## Validation Usage (Before vs After)

```ts
// Before
LegacyUser.validateCreate(payload); // or validate(payload, true)
LegacyUser.validateUpdate(patch); // or validate(patch, false)

// After
User.validateCreate(payload); // returns { value?, error? }
User.validateUpdate(patch);
```

## Migration Steps (Checklist)

1. Remove any of: `schema`, `schemaCreate`, `schemaUpdate`, `configureSchemas`, `validate(item, isCreating)` calls.
2. Add a static block with `this.defineSchemas({ shape, updatableFields, readAugment? })`.
3. Rename any usages of old validation (`validate(x, true/false)`) to `validateCreate` / `validateUpdate`.
4. If you previously had custom logic to reject empty update objects, remove it—`updateSchema` now enforces non-empty by default.
5. If you require a read/projection schema (e.g., for DTO generation), supply `readAugment`.
6. Re-run tests / type checks.
7. (Optional) Add an upgrade note to your project README linking to this guide.

## Pattern Variants

### Minimal (No Updatable Fields)

```ts
static {
  this.defineSchemas({
    shape: { name: z.string() },
    updatableFields: [], // disallow all updates (every update attempt fails validation)
  });
}
```

### Allow All Fields To Be Updatable

```ts
const shape = { a: z.string(), b: z.number().int() };
static {
  this.defineSchemas({ shape, updatableFields: Object.keys(shape) as (keyof typeof shape)[] });
}
```

### Supplying readAugment Only Later

If you don’t need a `readSchema`, omit `readAugment`. You can extend later by redefining in a follow-up migration (not hot-swappable at runtime).

## Frequently Asked Questions

**Q: Can I still manually author `updateSchema`?**  
A: No—the framework derives it to eliminate divergence. If you need custom per-field transformations, do that post-parse.

**Q: How do I enforce that at least one of several fields is present on update?**  
A: Built-in: empty object is rejected automatically. Additional conditional constraints can be added by wrapping `validateUpdate` and refining the result.

**Q: Why a static block instead of decorators?**  
A: Static blocks run once, are tree-shake friendly, and keep schema logic colocated without extra reflection metadata.

**Q: Is `readSchema` required?**  
A: No. It’s opt-in for when you want an explicit output contract (e.g., API responses, serialization, OpenAPI generation).

## Troubleshooting

| Symptom                                                            | Cause                                                     | Fix                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `TypeError: Cannot read properties of undefined (reading 'parse')` | `defineSchemas` not executed (e.g., static block removed) | Ensure static block present and not behind conditional import                              |
| Update always fails with immutable field                           | Field missing from `updatableFields`                      | Add key to `updatableFields` array                                                         |
| Need to allow empty patch object                                   | Current system disallows it for safety                    | Manually patch `updateSchema` after generation (not recommended) or open a feature request |

## End-to-End Example (Create + Update Flow)

```ts
const createPayload = { email: 'dev@example.com', displayName: 'Dev' };
const { value: createValue, error: createErr } = User.validateCreate(createPayload);
if (createErr) throw createErr;

// Simulate persisting & later patching
const patch = { displayName: 'Developer' };
const { value: patchValue, error: patchErr } = User.validateUpdate(patch);
if (patchErr) throw patchErr;

// patchValue safely typed: { displayName?: string }
```

## Mechanical Migration (For Code Mods / LLM Agents)

You can instruct an automated tool / LLM using the following deterministic steps:

1. Search for regex: `static (schema(Update|Create)?|schema)\s*=|configureSchemas\(`
2. Capture all Zod object literals used for create definitions (the largest superset of fields) — call this `shape`.
3. Identify update schema: if it’s a strict subset identical in field types, extract field names to `updatableFields`; otherwise take intersection of identical definitions.
4. Generate a static block:

```ts
static {
  this.defineSchemas({
    shape: { /* fields from original create schema */ },
    updatableFields: [ /* derived list */ ] as const,
  });
}
```

5. Delete old static assignments.
6. Replace calls: `Entity.validate(payload, true)` → `Entity.validateCreate(payload)`; `false` → `validateUpdate`.
7. (Optional) If extra persistence fields were present only in read responses, map them into `readAugment`.

## Release Notes Snippet

```
BREAKING: Legacy entity schema API removed.
- Removed: schema, schemaCreate, schemaUpdate, configureSchemas, validate(item, isCreating)
- Added: defineSchemas({ shape, updatableFields, readAugment? })
- Use: validateCreate(data), validateUpdate(patch)
```

## Contributing Feedback

If you need advanced scenarios (conditional updatable sets, dynamic field groups, soft migrations), open an issue with a concrete example.

---

Migration complete? Run your test suite and commit with message:

```
chore: migrate entities to defineSchemas schema system
```

Happy shipping!
