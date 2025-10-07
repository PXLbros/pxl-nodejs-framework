# Database

Backed by MikroORM.

## Config

Provide MikroORM options in the `database` key when constructing the application.

```ts
const app = new Application({
  database: {
    entities: [
      /* ... */
    ],
    dbName: 'app',
    type: 'postgresql',
  },
});
```

## Usage

```ts
await app.database.orm.em.find(User, {});
```

## Migrations

Use MikroORM CLI separately (not yet wrapped). Keep migrations in a `migrations/` folder.

## Entity Validation Schemas (Create / Update)

The framework historically exposed two static properties on an entity extending `DynamicEntity`:

```ts
static schema: z.ZodSchema;        // create input
static schemaUpdate: z.ZodSchema;   // update input (usually all optional)
```

This caused duplication because `schemaUpdate` repeated every field with `.optional()`. The modern pattern introduces clearer naming and a builder utility:

```ts
static schemaCreate?: z.ZodSchema;  // preferred new name
static schemaUpdate: z.ZodSchema;   // still required for updates
```

`schema` is still honored for backward compatibility, but new code should prefer `createSchema` / `updateSchema` (getter names) which proxy `schemaCreate` / `schemaUpdate`.

### Builder Utility

Use `buildEntitySchemas` from `src/schemas/entity-builder` OR let the entity call `defineSchemas` in a static initialization block for a declarative pattern.

```ts
import {
  buildEntitySchemas,
  HttpMethodSchema,
  HttpStatusCodeSchema,
} from '@pxl/nodejs-framework/schemas/entity-builder';
import { z } from 'zod';

const ApiLogSchemas = buildEntitySchemas({
  shape: {
    serviceName: z.string(),
    method: HttpMethodSchema,
    endpoint: z.string(),
    externalApiUrl: z.string().url(),
    statusCode: HttpStatusCodeSchema,
    durationMs: z.number().int().min(0),
    errorMessage: z.string().optional(),
  },
  // Only these fields are allowed to change after creation
  updatableFields: ['statusCode', 'durationMs', 'errorMessage'] as const,
});

export class ApiLog extends DynamicEntity {
  static {
    this.defineSchemas({
      shape: {
        serviceName: z.string(),
        method: HttpMethodSchema,
        endpoint: z.string(),
        externalApiUrl: z.string().url(),
        statusCode: HttpStatusCodeSchema,
        durationMs: z.number().int().min(0),
        errorMessage: z.string().optional(),
      },
      updatableFields: ['statusCode', 'durationMs', 'errorMessage'] as const,
    });
  }
}

// Access via standardized getters
ApiLog.createSchema; // same as schemaCreate
ApiLog.updateSchema; // same as schemaUpdate
```

By default, the update schema requires at least one field (configurable with `requireAtLeastOneOnUpdate: false`).

### Static Initialization Block Pattern

Each entity defines its validation contracts in a static initialization block for concise, side-effect-safe setup:

```ts
static {
  this.defineSchemas({ shape: { ... }, updatableFields: ['...'] as const });
}
```

The block runs exactly once when the class is evaluated, keeping schema logic colocated with the entity.

### Migration Path

1. Rename `schema` to `schemaCreate` (optional but recommended); keep `schema` until all usages updated.
2. Replace duplicated `schemaUpdate` definitions with `buildEntitySchemas`.
3. If some fields should not be modifiable post-create, list them in `updatableFields` and remove them from the base shape if they are system-managed.
4. Optionally switch to static block + `defineSchemas`.
5. Use helpers / getters:

- `DynamicEntity.validateCreate(data)` / `createSchema.parse(data)`
- `DynamicEntity.validateUpdate(data)` / `updateSchema.parse(patch)`
- `validate(data, isCreating)` (legacy) still works.

### Common Atoms

The builder exports shared atoms:

```ts
HttpMethodSchema; // enum of standard HTTP verbs
HttpStatusCodeSchema; // branded int between 100-599
```

### When to Use Strict Mode

All builder-derived schemas are `.strict()` by default to reject unknown keys. Override with `strict: false` if you intentionally allow passthrough data.

### Read / Persisted Shape

If you want a "read" schema (e.g., includes `id`, timestamps) provide `readAugment`. When using `defineSchemas`, the derived read schema is exposed via `readSchema`:

```ts
class User extends DynamicEntity {
  static {
    this.defineSchemas({
      shape: { email: z.string().email(), name: z.string() },
      updatableFields: ['name'] as const,
      readAugment: { id: z.string().uuid(), createdAt: z.date(), updatedAt: z.date() },
    });
  }
}

type UserCreateInput = z.infer<typeof User.createSchema>;
type UserUpdateInput = z.infer<typeof User.updateSchema>;
type UserRead = z.infer<typeof User.readSchema>;
```

### Rationale

- Eliminates boilerplate (no manual optional duplication)
- Explicit control over what fields can change
- Branded / atomic schemas improve semantic clarity
- Backward compatible (old `schema` still works)

### Future Enhancements (Planned)

- Automatic generation of filter / sort schemas
- Schema-driven form metadata integration
- Optional logging of validation error issue arrays
- Dev-only warnings when legacy names accessed (future)
