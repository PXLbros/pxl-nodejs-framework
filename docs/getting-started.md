# Getting Started

This guide takes you from zero to a running PXL application, then points you to deeper topics.

## Prerequisites

- Node.js >= 22 (as required in `package.json`)
- A package manager: npm / pnpm / yarn
- (Optional) Redis + Postgres if you plan to enable cache / database early

## 1. Initialize Project

```bash
mkdir my-pxl-app && cd my-pxl-app
npm init -y
npm install @scpxl/nodejs-framework typescript ts-node @types/node --save-dev
npx tsc --init --moduleResolution node16 --target ES2022 --module ES2022
```

Add a convenience script to `package.json`:

```json
{
  "scripts": {
    "dev": "node --loader ts-node/esm src/app.ts",
    "start": "node dist/app.js",
    "build": "tsc -p ."
  }
}
```

## 2. Basic App

Create `src/app.ts`:

```ts
import { Application } from '@scpxl/nodejs-framework';

const app = new Application({
  webserver: { port: Number(process.env.PORT) || 3000 },
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

app.webserver.route({ method: 'GET', url: '/health', handler: async () => ({ ok: true }) });

await app.start();

// Graceful signals
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig as NodeJS.Signals, () => app.stop()));
```

Run in dev:

```bash
npm run dev
```

## 3. Add More Modules

Enable WebSocket + Queue + Redis + Database (incrementally):

```ts
const app = new Application({
  webserver: { port: 3000 },
  websocket: { enabled: true, path: '/ws' },
  queue: { enabled: true },
  redis: { host: process.env.REDIS_HOST || '127.0.0.1', port: 6379 },
  database: {
    // MikroORM config (e.g. entities, dbName, driver, migrations)
  },
  logger: { level: 'info' },
});
```

WebSocket usage:

```ts
app.websocket.onConnection(client => {
  client.sendJSON({ welcome: true });
});
```

Queue processing:

```ts
app.queue.process('email:send', async job => {
  // job.data
});
```

## 4. Suggested Directory Structure

```
src/
  app.ts
  routes/
    user.routes.ts
  services/
    user.service.ts
  queue/
    email.worker.ts
  websocket/
    gateway.ts
  database/
    entities/
    migrations/
  config/
    index.ts
```

## 5. Configuration Patterns

Centralize config mapping environment variables into the Application options:

```ts
// src/config/index.ts
export function buildConfig() {
  return {
    webserver: { port: Number(process.env.PORT) || 3000 },
    logger: { level: process.env.LOG_LEVEL || 'info' },
    redis: process.env.REDIS_HOST
      ? { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) || 6379 }
      : undefined,
  };
}
```

## 6. Development vs Production

| Aspect              | Development          | Production                         |
| ------------------- | -------------------- | ---------------------------------- |
| Running             | ts-node loader       | Pre-built JS in `dist/`            |
| Logging             | `debug` or `info`    | `info` or `warn`                   |
| Error surfacing     | Verbose stack traces | Sanitized message / error IDs      |
| Queue workers       | Often co-located     | Split processes / autoscaled       |
| Performance monitor | Always on (log slow) | Adjust thresholds + export metrics |

Build for production:

```bash
npm run build
npm start
```

## 7. Type Safety Tips

- Export a singleton `Application` instance only after `start()` if sharing.
- Narrow types in services instead of passing entire `app` when practical.
- Use `as const` for route configs when helpful for inference.

## 8. Adding Commands (Preview)

You can create reusable CLI tasks (e.g. seeding, maintenance). A full guide will live at `/guides/commands`.

## 9. Graceful Shutdown

Avoid abrupt exits; always call `app.stop()` to flush logs & close connections. Use the included lifecycle hooks for staged teardown.

## 10. Troubleshooting

| Symptom                 | Possible Cause               | Fix                                           |
| ----------------------- | ---------------------------- | --------------------------------------------- |
| Process hangs on exit   | Pending timers / connections | Ensure `app.stop()` called; track disposables |
| Route not registered    | Added after `start()`        | Register routes before `await app.start()`    |
| Redis errors at startup | Redis not reachable          | Make module optional or delay until ready     |
| Slow responses          | Database thresholds exceeded | Inspect performance report, add indices       |

## 11. Next Steps

- Learn lifecycle: [Lifecycle](/concepts/lifecycle)
- Explore services: [Services](/concepts/services)
- Configure deeply: [Configuration](/guides/configuration)
- Add observability: [Performance Monitoring](/guides/performance-monitoring)
- Prepare for scale: [Scaling](/guides/scaling)
- Testing patterns: [Testing](/guides/testing)

## 12. Example Extension

Add a custom service:

```ts
export class UserService {
  constructor(private app: Application) {}
  async create(data: { email: string }) {
    // use this.app.logger / this.app.database
  }
}
```

Instantiate lazily or wire into a simple DI registry.

---

Have feedback? Open an issue or PR.
