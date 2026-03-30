---
title: SC/PXL Node.js Framework
---

# SC/PXL Node.js Framework

> Modular TypeScript framework unifying HTTP, WebSocket, Queue, Database, Cache, Auth, and Observability under a single lifecycle.

PXL sits between "roll everything yourself" and heavyweight monolith frameworks. It keeps you close to Fastify, BullMQ, MikroORM, Redis, and native primitives while providing structured lifecycle control, consistent patterns, and instrumentation.

## Core Value Proposition

| Challenge                     | Without PXL                       | With PXL                               |
| ----------------------------- | --------------------------------- | -------------------------------------- |
| Multi-subsystem startup       | Ad-hoc ordering & race conditions | Deterministic lifecycle phases         |
| Resource shutdown             | Forgotten timers / connections    | Tracked disposables & graceful timeout |
| Cross-cutting instrumentation | Copy/paste wrappers               | Built-in performance monitor           |
| Queue + HTTP cohesion         | Separate bootstrap scripts        | Unified Application context            |
| Config sprawl                 | Manual merging                    | Declarative module config              |
| Logging consistency           | Mixed formats                     | Structured logger integration          |

## Features At a Glance

- 🚀 Unified Application bootstrap (HTTP, WebSocket, Queue, DB, Cache, Auth)
- ⚙️ Deterministic lifecycle + hooks (`onInit`, `onStart`, `onReady`, `onBeforeShutdown`, `onShutdown`)
- 🧪 First-class testing patterns (fast unit + integration)
- 📊 Performance monitoring spans (HTTP, DB, cache, queue, websocket, custom)
- 🗃 MikroORM integration & optional migrations/seeding workflow
- 📨 Queue workers with BullMQ (isolated or in-process)
- 🔌 Structured services pattern for business logic
- 🕸 WebSocket client + room management
- 🧵 Request context & utilities
- 🔐 JWT utilities for auth flows

## Architecture (High-Level)

```
          ┌──────────────────────┐
          │      Application     │
          │  (orchestrator)      │
          └─────────┬────────────┘
     init/start/stop │ lifecycle events
                     │
 ┌──────────┬────────┼───────────┬───────────┬──────────┐
 │ WebServer│ WebSock│  Queue    │ Database  │  Cache   │ ...
 │ (Fastify)│ (WS)   │ (BullMQ)  │ (MikroORM)│ (Redis)  │
 └──────────┴────────┴───────────┴───────────┴──────────┘
        │            │            │             │
        └─────── Shared Logger / Performance Monitor / Request Context ───────┘
```

Each module is optional—omit it from config and it won't be initialized.

## Install

```bash
npm install @scpxl/nodejs-framework
# or
pnpm add @scpxl/nodejs-framework
# or
yarn add @scpxl/nodejs-framework
```

## Minimal App (HTTP Only)

```ts
// app.ts
import { Application } from '@scpxl/nodejs-framework';

const app = new Application({
  webserver: { port: 3000 },
  logger: { level: 'info' },
});

app.webserver.route({ method: 'GET', url: '/health', handler: async () => ({ ok: true }) });

await app.start();
console.log('App running on :3000');
```

Run (TypeScript ESM loader):

```bash
node --loader ts-node/esm app.ts
```

## Add WebSocket

```ts
const wss = app.websocket; // if enabled in config
wss.onConnection(client => {
  client.sendJSON({ welcome: true });
});
```

## Add Queue Worker

```ts
app.queue.process('email:send', async job => {
  // send email
});
```

## Graceful Shutdown Example

```ts
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig as NodeJS.Signals, () => app.stop()));
```

## Suggested Project Layout

```
src/
  app.ts
  services/
    user.service.ts
  routes/
    user.routes.ts
  queue/
    email.worker.ts
  websocket/
    gateway.ts
  database/
    entities/
    migrations/
```

## Production Notes

- Prefer explicit ports via `PORT` env.
- Separate queue-only worker processes if throughput differs from HTTP traffic.
- Feed performance metrics into your APM via periodic `perf.generateReport()`.
- Keep migrations versioned & run pre-boot.

## Next Steps

| Goal                       | Where to Go                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Understand lifecycle hooks | [Lifecycle](/concepts/lifecycle)                                                    |
| Configure modules          | [Configuration](/guides/configuration)                                              |
| Add commands / CLI tasks   | (Soon) [Commands & CLI](/guides/commands)                                           |
| Instrument performance     | [Performance](/concepts/performance) & [Monitoring](/guides/performance-monitoring) |
| Deploy & scale             | [Deployment](/guides/deployment) / [Scaling](/guides/scaling)                       |
| Explore API shapes         | API Reference (TypeDoc)                                                             |

---

Missing something? Open an issue or PR on GitHub.
