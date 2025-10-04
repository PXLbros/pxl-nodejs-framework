# Configuration

You configure the framework by passing a plain object into the `Application` constructor. Each top-level key enables & configures a module. Omit a section to skip initialization.

## High-Level Structure

```ts
interface AppConfig {
  webserver?: { port?: number; routesDirectory?: string; controllersDirectory?: string; host?: string };
  websocket?: { enabled?: boolean; path?: string; maxPayload?: number };
  queue?: { enabled?: boolean; prefix?: string };
  redis?: { host: string; port?: number; password?: string; db?: number };
  cache?: { enabled?: boolean; defaultTtlMs?: number };
  database?: {
    /* MikroORM options: entities, migrations, etc. */
  };
  logger?: { level?: string; json?: boolean; redact?: string[] };
  lifecycle?: { gracefulShutdown?: { timeoutMs?: number } };
  performance?: { enabled?: boolean; thresholds?: Partial<Record<string, number>> };
  auth?: { jwt?: { issuer?: string; audience?: string; publicKey?: string; privateKey?: string } };
  command?: {
    /* CLI specific configuration */
  };
  // ... future extensions
}
```

Note: The exact TypeScript interface may differ; inspect exported types in `@scpxl/nodejs-framework` for authoritative definitions.

## Minimal Example

```ts
new Application({
  webserver: { port: 3000 },
  logger: { level: 'info' },
});
```

## Full(er) Example

```ts
new Application({
  webserver: { port: Number(process.env.PORT) || 3000, routesDirectory: 'src/routes' },
  websocket: { enabled: true, path: '/ws' },
  queue: { enabled: true, prefix: 'app' },
  redis: { host: process.env.REDIS_HOST || '127.0.0.1', port: 6379 },
  cache: { enabled: true, defaultTtlMs: 60_000 },
  database: {
    /* MikroORM config (entities, migrations, driver) */
  },
  logger: { level: process.env.LOG_LEVEL || 'info', json: process.env.NODE_ENV === 'production' },
  lifecycle: { gracefulShutdown: { timeoutMs: 15000 } },
  performance: { enabled: true, thresholds: { http: 800, database: 400 } },
  auth: { jwt: { issuer: 'my-service', audience: 'api-clients' } },
});
```

## Merging & Defaults

- Framework merges your object with internal defaults per module.
- Unknown keys are ignored (future proofing).
- Provide only overrides; stick with defaults where possible.

## Module Reference

### Web Server (`webserver`)

| Key                    | Type   | Default   | Description                                                 |
| ---------------------- | ------ | --------- | ----------------------------------------------------------- |
| `port`                 | number | 3000      | Listen port                                                 |
| `host`                 | string | `0.0.0.0` | Bind interface                                              |
| `routesDirectory`      | string | undefined | Auto-load route definitions (files exporting route objects) |
| `controllersDirectory` | string | undefined | Optional controller class auto-registration                 |

### WebSocket (`websocket`)

| Key          | Type    | Default      | Notes                           |
| ------------ | ------- | ------------ | ------------------------------- |
| `enabled`    | boolean | false        | Must be true to start WS server |
| `path`       | string  | `/ws`        | Upgrade path                    |
| `maxPayload` | number  | 1MB (approx) | Reject oversized messages       |

### Queue (`queue`)

| Key       | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `enabled` | boolean | false   | Enable BullMQ integration |
| `prefix`  | string  | `pxl`   | Queue key namespace       |

### Redis (`redis`)

| Key        | Type   | Default   | Description      |
| ---------- | ------ | --------- | ---------------- |
| `host`     | string | required  | Redis host       |
| `port`     | number | 6379      | Port             |
| `password` | string | undefined | Auth password    |
| `db`       | number | 0         | Logical DB index |

### Cache (`cache`)

| Key            | Type    | Default       | Description                    |
| -------------- | ------- | ------------- | ------------------------------ |
| `enabled`      | boolean | true          | Toggle cache manager           |
| `defaultTtlMs` | number  | 0 (no expiry) | Default TTL for set operations |

### Database (`database`)

Pass through MikroORM configuration (entities, migrations, seeding). Common keys:

| Key          | Type   | Description                      |
| ------------ | ------ | -------------------------------- |
| `entities`   | any[]  | Entity classes/paths             |
| `migrations` | object | MikroORM migration config        |
| `dbName`     | string | Database name (if not using URL) |
| `clientUrl`  | string | Connection string                |

### Logger (`logger`)

| Key      | Type     | Default   | Description                                   |
| -------- | -------- | --------- | --------------------------------------------- |
| `level`  | string   | `info`    | Minimum level (e.g. debug, info, warn, error) |
| `json`   | boolean  | env based | Structured JSON output toggle                 |
| `redact` | string[] | []        | Keys to redact from logs                      |

### Lifecycle (`lifecycle`)

| Key                          | Type   | Default | Description                                     |
| ---------------------------- | ------ | ------- | ----------------------------------------------- |
| `gracefulShutdown.timeoutMs` | number | 10000   | Max total shutdown duration before forcing exit |

### Performance (`performance`)

| Key          | Type    | Default                  | Description                                                                   |
| ------------ | ------- | ------------------------ | ----------------------------------------------------------------------------- |
| `enabled`    | boolean | true                     | Master toggle                                                                 |
| `thresholds` | object  | Module-specific defaults | Override per operation type (http, database, cache, queue, websocket, custom) |

### Auth (`auth.jwt`)

| Key          | Type   | Description                      |
| ------------ | ------ | -------------------------------- |
| `issuer`     | string | JWT issuer claim                 |
| `audience`   | string | JWT audience claim               |
| `publicKey`  | string | Verification key (if asymmetric) |
| `privateKey` | string | Signing key                      |

## Environment Variable Mapping

Create a helper to translate process env into config:

```ts
export function buildConfig(): AppConfig {
  return {
    webserver: { port: Number(process.env.PORT) || 3000 },
    logger: { level: process.env.LOG_LEVEL || 'info' },
    redis: process.env.REDIS_HOST
      ? { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) || 6379 }
      : undefined,
  };
}
```

## Validation

Use a schema library (e.g. `zod` or `joi`) to validate env + config early. Example with zod:

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().optional(),
  REDIS_HOST: z.string().optional(),
});

const env = EnvSchema.parse(process.env);
```

Fail fast at boot if required configuration is missing.

## Progressive Activation

Start with only `webserver + logger`, then add modules as needs emerge. This keeps initial complexity low and surfaces integration boundaries clearly.

## Overriding Defaults at Runtime

You can compose config objects:

```ts
const base = buildConfig();
const testOverrides = { logger: { level: 'error' } };
const finalConfig = { ...base, ...testOverrides };
```

Avoid deep-merging arrays (prefer explicit replacement) to prevent subtle bugs.

## Common Pitfalls

| Issue                          | Cause                               | Mitigation                                |
| ------------------------------ | ----------------------------------- | ----------------------------------------- |
| Redis connect errors spam logs | Wrong host / network                | Make `redis` optional until stable        |
| Hanging shutdown               | Long DB query in `onShutdown`       | Add timeout and cancel/abort logic        |
| High p95 latency               | Thresholds too high to notice early | Lower per-module thresholds incrementally |

## Next

- See environment specifics: [Environment Variables](/guides/env)
- Explore performance thresholds: [Performance](/concepts/performance)
- Add observability: [Performance Monitoring](/guides/performance-monitoring)

---

Planned additions: generated type reference & dynamic schema docs.
