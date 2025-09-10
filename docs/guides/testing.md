# Testing

Vitest is used for unit, integration, and coverage.

## Scripts

- `npm run test` – all tests
- `npm run test:unit` – unit only
- `npm run test:integration` – integration only
- `npm run test:coverage` – with V8 coverage

## Setup Files

Common setup lives in `test/setup.ts` and `test/vitest-setup.ts` (imported via config). Use these to register global mocks.

## Patterns

- Prefer fast unit tests (pure functions, services with mocked dependencies).
- For integration spin up ephemeral Redis (redis-memory-server) if needed.
- Use factories/helpers instead of raw object literals repeated everywhere.

## Example

```ts
import { describe, it, expect } from 'vitest';
import { Application } from '@scpxl/nodejs-framework';

describe('app', () => {
  it('boots web server', async () => {
    const app = new Application({ webserver: { port: 0 }, logger: { level: 'error' } });
    await app.start();
    expect(app.webserver.fastify.server.listening).toBe(true);
    await app.stop();
  });
});
```

## Coverage Gates

Consider enforcing minimums in CI to prevent regressions.
