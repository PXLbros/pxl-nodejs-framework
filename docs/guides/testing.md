# Testing

PXL uses Vitest for unit, integration, and (optionally) end-to-end tests. This guide outlines recommended patterns for fast, reliable coverage.

## Test Categories

| Type                    | Scope                                   | Speed     | Goal                       |
| ----------------------- | --------------------------------------- | --------- | -------------------------- |
| Unit                    | Pure functions / services               | Very fast | Business logic correctness |
| Integration             | Multiple modules (webserver + db/redis) | Medium    | Wiring & side-effects      |
| CLI / Command           | Command handlers                        | Medium    | Operational tasks function |
| Performance (selective) | Critical paths w/ metrics               | Slower    | Detect regressions         |

## Scripts (package.json)

- `test` – all tests
- `test:unit` – subset (e.g. `test/unit`)
- `test:integration` – integration suite
- `test:coverage` – generate V8 coverage report
- `test:ui` – interactive UI (Vitest)

## Directory Layout

```

  unit/
    user.service.spec.ts
  integration/
    webserver.spec.ts
    queue.spec.ts
  utils/
    app-factory.ts
  setup.ts
  vitest-setup.ts
```

## Global Setup Files

- `test/setup.ts`: runtime bootstrap for env vars, polyfills
- `test/vitest-setup.ts`: registered in `vitest.config.ts` for hooks / custom matchers

## Application Factory (Recommended)

Create a reusable factory for tests to avoid duplication:

```ts
// test/utils/app-factory.ts
import { Application } from '@scpxl/nodejs-framework';

export async function createTestApp(overrides: any = {}) {
  const app = new Application({
    webserver: { port: 0 },
    logger: { level: 'error' },
    ...overrides,
  });
  await app.start();
  return app;
}
```

Usage:

```ts
import { describe, it, expect } from 'vitest';
import { createTestApp } from '../utils/app-factory';

describe('webserver', () => {
  it('responds /health', async () => {
    const app = await createTestApp();
    app.webserver.route({ method: 'GET', url: '/health', handler: () => ({ ok: true }) });

    const res = await app.webserver.fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ ok: true });
    await app.stop();
  });
});
```

## Redis & Database Strategies

| Goal                  | Strategy                                         |
| --------------------- | ------------------------------------------------ |
| Fast iteration        | Mock Redis client methods                        |
| Realistic integration | Use `redis-memory-server`                        |
| Full DB behavior      | Spin ephemeral Postgres (Testcontainers / local) |
| Pure unit tests       | Omit `database` + `redis` modules                |

Example (skipping Redis):

```ts
const app = await createTestApp({ redis: undefined, cache: { enabled: false } });
```

## Queue Testing

For deterministic queue tests:

1. Use an isolated queue prefix per test (`queue: { enabled: true, prefix: 'test-' + Date.now() }`).
2. Await job completion by listening for `completed` event.
3. Clean up by calling `await app.stop()` to close workers.

## WebSocket Testing

Use an in-process WebSocket client (e.g. `ws`) and connect against `fastify.server.address()`. Ensure you await `app.start()` before connecting.

## Performance Assertions (Optional)

Leverage `PerformanceMonitor` for threshold checks:

```ts
const perf = app.performance; // if surfaced
// run operation
const report = perf.generateReport();
expect(report.summary.averages.http).toBeLessThan(250);
```

Gate only the most critical paths to avoid flaky tests.

## Mocking Patterns

| Target        | Approach                            |
| ------------- | ----------------------------------- |
| External HTTP | Stub via nock / fetch mock          |
| Redis         | Replace methods with in-memory maps |
| Queue jobs    | Directly invoke processor function  |
| Logger noise  | Set level to `error`                |

## Example Unit Service Test

```ts
class UserService {
  constructor(private log: any) {}
  greet(name: string) {
    this.log.debug('greet', { name });
    return `Hello ${name}`;
  }
}

import { describe, it, expect, vi } from 'vitest';

describe('UserService', () => {
  it('greets user', () => {
    const logger = { debug: vi.fn() };
    const svc = new UserService(logger);
    expect(svc.greet('Dev')).toBe('Hello Dev');
  });
});
```

## Coverage Recommendations

- Focus on decision branches & failure modes (config missing, invalid input) rather than 100% line coverage.
- Track mutation of config merges and lifecycle hooks.

## CI Tips

| Concern        | Recommendation                                                        |
| -------------- | --------------------------------------------------------------------- |
| Flaky startup  | Add retry around ephemeral dependencies                               |
| Slow runs      | Split unit / integration in parallel jobs                             |
| Resource leaks | Ensure every test that creates `Application` calls `await app.stop()` |

## Troubleshooting

| Symptom                          | Likely Cause                       | Fix                                     |
| -------------------------------- | ---------------------------------- | --------------------------------------- |
| Jest/Vitest open handles warning | Unstopped Application / open timer | Ensure `app.stop()` and track intervals |
| Intermittent queue test failures | Shared queue namespace             | Use unique prefixes per test            |
| Port in use                      | Hard-coded port reused             | Use `port: 0` to get ephemeral port     |

## Next

- Instrument slow code: [Performance Monitoring](/guides/performance-monitoring)
- Add command tests: [Commands & CLI](/guides/commands)
- Deployment considerations: [Deployment](/guides/deployment)

---

Future addition: test utilities package export (factory helpers, mock builders).
