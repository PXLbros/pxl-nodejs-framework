# Breaking Changes

This document lists breaking changes introduced since tag `v1.0.21` (tag not found in repository). The closest prior published tag available is `v1.0.20`, so differences are computed from `v1.0.20` to current `main`.

> If `v1.0.21` is later pushed, regenerate this report using that tag as the baseline.

## Summary

- Modified core application & webserver interfaces
- Extended command abstraction signature
- Added typed / schema-driven routing constructs (Fastify + Zod generics)
- Adjusted default WebServer option limits (body + connection timeouts)
- Introduced optional `routesDirectory` dynamic loading behavior
- Added optional logging configuration flag: `log.showRequestIdInConsole`
- Tweaked error serialization (uses `safeSerializeError` where non-Error values were passed)

## Detailed Changes

### 1. Command Interface Change

`src/command/command.ts`

```diff
-  public abstract run(): Promise<void>;
+  public abstract run(argv?: unknown): Promise<void>;
```

**Impact:** All custom command subclasses must update their `run` method signature to accept an (optional) argument. Omitting the parameter compiles, but TypeScript may flag strict override mismatches.

**Migration:**

```ts
class MyCommand extends Command {
  public async run(argv?: unknown): Promise<void> {
    // existing logic
  }
}
```

### 2. WebServer Type System Enhancements

`src/webserver/webserver.interface.ts`

New imports & generics introduce Zod-powered schemas and typed handlers:

- `RouteSchemaDefinition`, `RouteHandlerContext`, `RouteHandler`
- `AnyRouteSchemaDefinition`
- `ControllerAction` integrated into route definition via optional `handler` field

Changed route interface fields:

```diff
- action: string;              (in DefaultWebServerRoute)
+ action?: string;             (now optional when using `handler`)

- validationSchema?: RouteValidationSchema;
+ validationSchema?: RouteValidationSchema | RouteValidationSchema[];
```

Added fields:

- `handler?: ControllerAction<any>` (typed route handler alternative to `action`)
- `schema?: AnyRouteSchemaDefinition` (Zod-centric schema definition replacing/augmenting previous validation approach)

**Impact:** Existing route definitions relying on a mandatory `action` must either retain `action` or migrate to `handler`. Mixed usage should ensure only one resolution path is taken in any loader logic.

**Migration Guidance:**

- For previous single schema objects, no change needed unless adopting arrays.
- To migrate to typed handler:

```ts
export const routes: DefaultWebServerRoute[] = [
  {
    method: 'GET',
    path: '/health',
    handler: async (req, reply) => ({ status: 'ok' }),
    schema: {
      response: { 200: z.object({ status: z.string() }) },
    },
  },
];
```

### 3. WebServer Options Defaults Adjusted

`WebServerOptions` modifications:

```diff
- /** Maximum request body size in bytes (default: 100MB) */
+ /** Maximum request body size in bytes (default: 25MB) */
- /** Connection timeout in milliseconds (default: 30s) */
+ /** Connection timeout in milliseconds (default: 10s) */
+ /** Optional directory containing route definition files */
+  routesDirectory?: string;
```

**Impact:** Applications depending on the previous larger body limit or longer connection timeout may see request rejections or earlier disconnects.

**Migration:** Explicitly set old values if required:

```ts
const app = new WebApplication({
  webServer: {
    maxRequestBodySize: 100 * 1024 * 1024,
    connectionTimeout: 30_000,
  },
});
```

If using `routesDirectory`, ensure the directory exists; loader now checks existence.

### 4. Logging Configuration

Added optional flag in `ApplicationLogConfig`:

```diff
+ showRequestIdInConsole?: boolean;
```

When set, `BaseApplication` configures `Logger` with `{ showRequestIdInConsole }`.

**Impact:** None unless you rely on previous console log format consistency. Setting the flag changes log output shape by adding request identifiers (if supported downstream).

**Migration:**

```ts
const app = new WebApplication({
  log: { showRequestIdInConsole: true },
});
```

### 5. Error Serialization Hardening

`BaseApplication` now uses `safeSerializeError` when coercing non-`Error` throwables into `Error` instances.

**Impact:** Log output / error reporting payloads for thrown primitives or unusual objects will differ (more structured). Parsing logic expecting raw `String(value)` should be reviewed.

**Migration:** Update any log scrapers or tests asserting exact error message text for non-Error throws.

### 6. Meta Field Normalization in Promise Rejections

Change of `meta: { promise }` to `meta: { promise: String(promise) }` within unhandled rejection / rejection tracking.

**Impact:** If internal observability tooling expected a non-string reference, adjust accordingly.

### 7. Validation Schema Flexibility

Route `validationSchema` now accepts an array, enabling composition.

**Migration:** Combine previous layered validations:

```ts
validationSchema: [baseSchema, extendedSchema];
```

Ensure downstream merging logic supports arrays (framework update supplies this internally).

### 8. Removal of Legacy Root Files

Removed docs/utility meta files (e.g., `CHANGELOG.md`, `ENHANCEMENTS.md`, `pxl.js`, various `CLAUDE.*` files). If external automation parsed them, redirect automation to new consolidated documentation paths in `docs/`.

## Potential Non-Breaking (Additive) Changes Worth Noting

- Added `routesDirectory` driven dynamic route loading (opt-in)
- More explicit serialization for errors improves observability consistency
- `Logger.error` (object signature) now automatically injects `name` and `stack` into `meta` when an `Error` instance is provided. This enhances debuggability by surfacing stack traces directly in log aggregation pipelines.

### Logger.error Stack & Name Injection

Previously, calling:

```ts
Logger.error({ error: new Error('Boom'), message: 'Action failed', meta: { foo: 'bar' } });
```

produced a log meta payload of only `{ foo: 'bar' }` and discarded the stack trace.

Now it yields (conceptually):

```jsonc
{
  "foo": "bar",
  "name": "Error",
  "stack": "Error: Boom\n    at ...",
}
```

If you had tests asserting the exact `meta` object shape, update them to use `expect.objectContaining` (vitest/jest) or adjust schema expectations to allow these additional keys.

Positional overload (`Logger.error(error, 'msg')`) is unchanged; only the object signature auto-enrichment was modified.

**Impact:** Improved diagnostics. Potentially breaking only if code/tests depended on an exact match of `meta` keys.

## Regeneration Instructions

To rebuild this file (once `v1.0.21` exists or for a future tag):

```bash
git diff --name-status <fromTag>...<toRef>
# inspect interfaces
git diff <fromTag>...<toRef> -- src/webserver/webserver.interface.ts
```

## Semantic Versioning Note

Because these changes include signature modifications and tighter defaults, they warrant at least a minor (possibly major if strict semantic guarantees were advertised) version bump. Assess external consumption of `Command.run()` and webserver route typing before deciding.

---

_Last generated against baseline tag `v1.0.20`._
