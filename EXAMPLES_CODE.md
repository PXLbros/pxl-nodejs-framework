# Examples – PXL Node.js Framework

This document specifies the scaffold for two example projects demonstrating core framework features:

1. `api-basic` – Minimal Node.js/TypeScript API showcasing framework capabilities
2. `web-vue` – Vite + Vue 3 frontend consuming the API (REST + WebSocket) and visualizing async + realtime behavior

---

## Goals

Provide runnable, concise, self‑documenting examples that demonstrate:

- Config & lifecycle (no in-framework `process.exit` usage; centralized launcher)
- Logging & (future) correlation ID hook
- Database (MikroORM) usage with a simple `Task` entity
- Redis usage for cache + BullMQ queue backend
- Queue processing + async state transitions
- Events → WebSocket broadcast loop
- Performance monitor activation & sample consumption endpoint
- Simple JWT auth protecting write routes
- Cache layer (task detail) with invalidation
- Graceful shutdown & lifecycle manager clearing timers

---

## Directory Layout

```
examples/
  README.md
  api-basic/
    package.json
    tsconfig.json
    .env.example
    docker-compose.yml
    README.md
    src/
      index.ts                # Bootstrap & graceful shutdown
      config.ts               # Framework config object (typed)
      application.ts          # Thin wrapper / subclass if needed
      routes/
        task.routes.ts        # Registers REST endpoints
        auth.routes.ts
      controllers/
        task.controller.ts
        auth.controller.ts
      database/
        entities/
          task.entity.ts      # MikroORM entity: id, title, status, createdAt, updatedAt
      services/
        task.service.ts       # CRUD + cache + queue enqueue
      queue/
        processors/
          task-processor.ts   # Consumes jobs, simulates processing, emits events
      event/
        task.events.ts        # Event names / helpers
      websocket/
        task.gateway.ts       # Broadcast task lifecycle updates
      cache/
        task.cache.ts         # get/set/invalidate helpers (Redis)
      auth/
        jwt.ts                # sign/verify utilities
        guard.ts              # Fastify preHandler for protected routes
      performance/
        metrics.route.ts      # Optional /metrics or /perf exposure
      util/
        request-id.plugin.ts  # (Optional) ALS request ID injector (placeholder)
  web-vue/
    package.json
    tsconfig.json
    vite.config.ts
    .env.example
    index.html
    README.md
    src/
      main.ts
      App.vue
      api/
        client.ts             # Fetch wrapper (JWT + request-id header)
      ws/
        client.ts             # WebSocket client w/ reconnect
      store/
        tasks.ts              # Reactive task store
        auth.ts               # JWT token + login state
      components/
        TaskList.vue
        NewTaskForm.vue
        TaskStatusFeed.vue
        PerfMetrics.vue
        AuthLogin.vue
      styles/
        base.css
```

---

## Feature Coverage Matrix

| Feature                  | api-basic | web-vue                                 |
| ------------------------ | --------- | --------------------------------------- |
| Config & lifecycle       | ✅        | (consumes)                              |
| Logging                  | ✅        | Displays request IDs (debug panel)      |
| DB (Task entity)         | ✅        | Reads tasks                             |
| Redis cache              | ✅        | Indirect benefit (faster detail reload) |
| Queue processing         | ✅        | Visual async state updates              |
| Events → WebSocket       | ✅        | Realtime feed                           |
| Performance monitor      | ✅        | Consumes /perf                          |
| JWT Auth                 | ✅        | Login / protected create                |
| Graceful shutdown        | ✅        | N/A (frontend)                          |
| Request ID (placeholder) | ✅        | Displays header                         |

---

## Data Model

### Task Entity

```ts
// task.entity.ts (conceptual)
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETE = ' COMPLETE',
  FAILED = 'FAILED',
}

@Entity()
export class Task {
  @PrimaryKey()
  id!: string; // uuid

  @Property()
  title!: string;

  @Property({ type: 'string' })
  status: TaskStatus = TaskStatus.PENDING;

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
```

---

## API Flow (Happy Path)

1. Client (web-vue) POST /auth/login -> receives JWT
2. Client POST /tasks (Authorization: Bearer <token>) -> Task created (status PENDING) & queue job enqueued
3. Queue processor picks job -> sets status PROCESSING -> (simulate delay) -> COMPLETE -> emits event
4. Event manager publishes TASK_PROCESSED -> WebSocket gateway broadcasts -> UI updates row
5. Metrics view polls /perf (or /metrics) for performance snapshot

---

## Key Modules (api-basic)

### config.ts

Provides strongly-typed configuration object (placeholder for future Zod validation). Enables performance monitor, event system, queue processors directory, etc.

### task.service.ts

- Create: insert row -> cache prime -> enqueue processing job
- Get: attempt cache -> fall back to DB -> populate cache
- List: DB query (no cache)
- Update (internal processor): DB update -> cache invalidate -> broadcast event

### task-processor.ts

- Receives job with taskId
- Marks PROCESSING -> waits (setTimeout) -> marks COMPLETE
- Emits TASK_PROCESSED through event manager

### task.gateway.ts

- Subscribes to TASK_PROCESSED events
- Broadcasts JSON { id, status, processedAt }

### auth.controller.ts & jwt.ts

- Simple in-memory user (e.g. user: demo / pass: demo) -> issues signed JWT (HS256)
- Guard verifies Authorization header and attaches user to request

### metrics.route.ts

- Returns performance monitor summary (raw text or structured JSON)

### request-id.plugin.ts (optional placeholder)

- Adds a UUIDv4 header to each response; future: integrate AsyncLocalStorage

---

## Example Endpoints

| Method | Path        | Description          | Auth | Notes                        |
| ------ | ----------- | -------------------- | ---- | ---------------------------- |
| POST   | /auth/login | Issue JWT            | No   | Body: { username, password } |
| POST   | /tasks      | Create task          | Yes  | Returns task + job id        |
| GET    | /tasks      | List tasks           | No   | Pagination optional          |
| GET    | /tasks/:id  | Get task             | No   | Cached                       |
| GET    | /perf       | Performance snapshot | No   | For demo only                |
| WS     | /ws         | Realtime channel     | N/A  | Broadcast task events        |

---

## Minimal Bootstrap (api-basic/src/index.ts)

```ts
import { requestExit, setExitHandler } from '../../src/lifecycle/exit.js';
import { createApp } from './application.js'; // wrapper that instantiates your derived BaseApplication

async function main() {
  const app = await createApp();
  await app.start();

  // Signals handled here (optional move from BaseApplication later)
  ['SIGINT', 'SIGTERM'].forEach(sig => {
    process.on(sig, () => {
      requestExit({ code: 0, reason: `signal:${sig}` });
    });
  });
}

setExitHandler(o => {
  // eslint-disable-next-line no-console
  console.log('[api-basic] exit', o);
  process.exit(o.code);
});

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  requestExit({ code: 1, reason: 'startup-failure', error: err });
});
```

---

## docker-compose.yml (api-basic)

```yaml
version: '3.9'
services:
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: example
      POSTGRES_USER: example
      POSTGRES_DB: example
    ports: ['5432:5432']
```

---

## Vue WebSocket Client (conceptual)

```ts
// ws/client.ts
export function connect({ url, onMessage }: { url: string; onMessage: (m: any) => void }) {
  let ws: WebSocket;
  let retry = 0;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 0;
    };
    ws.onmessage = e => onMessage(JSON.parse(e.data));
    ws.onclose = () => setTimeout(open, Math.min(1000 * 2 ** retry++, 10000));
  };
  open();
  return () => ws.close();
}
```

---

## Implementation Order

1. Scaffold `examples/` directory + placeholder READMEs
2. Add `api-basic` config, entity, service, controller, routes (create/list/get) – synchronous only
3. Add queue processor & async status change; integrate events + websocket broadcast
4. Add JWT auth + protect POST /tasks
5. Add cache layer for GET /tasks/:id
6. Enable performance monitor + /perf route
7. Add graceful shutdown logic in example bootstrap (signals)
8. Scaffold `web-vue` project (Vite + Vue 3 + TypeScript)
9. Implement login + task list + create form
10. Add WebSocket real-time updates + optimistic UI
11. Add performance metrics panel
12. Polish docs & feature matrix / troubleshooting section

---

## Troubleshooting Notes

| Issue                  | Symptom                    | Resolution                                           |
| ---------------------- | -------------------------- | ---------------------------------------------------- |
| DB not ready           | Connection errors on start | Ensure postgres container healthy; add retry/backoff |
| Queue stuck            | Tasks remain PENDING       | Check Redis connectivity; worker logs                |
| WebSocket not updating | No realtime events         | Verify event emission & gateway registration         |
| High shutdown time     | Forced-timeout exit        | Confirm all intervals tracked by LifecycleManager    |

---

## Future Enhancements (Optional)

- Add OpenAPI generation + Swagger UI example
- Introduce request correlation ID via AsyncLocalStorage
- Provide test harness script for CI (spin containers + run basic flow)
- Add streaming upload example or multipart handling

---

## Quick Start (Once Implemented)

```bash
# API
cd examples/api-basic
npm install
cp .env.example .env
docker compose up -d
npm run dev

# Web
cd ../web-vue
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173 and create a task.

---

## Maintenance

- Keep examples updated with breaking API changes (CI check that they build).
- Favor minimal code over abstraction; link back to framework docs for deep concepts.

---

End of spec.
