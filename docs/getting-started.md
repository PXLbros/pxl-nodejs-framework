# Getting Started

This guide walks you through installing and bootstrapping a minimal application.

## 1. Install

```bash
npm install @pxl/nodejs-framework
```

## 2. Basic App

Create `app.ts`:

```ts
import { Application } from '@pxl/nodejs-framework';

const app = new Application({
  webserver: { port: 3000 },
  logger: { level: 'info' },
});

await app.start();
```

Run it (TypeScript runtime):

```bash
node --loader ts-node/esm app.ts
```

Or compile with your own build pipeline.

## 3. Add HTTP Route

```ts
app.webserver.route({
  method: 'GET',
  url: '/hello',
  handler: async () => ({ message: 'Hello World' }),
});
```

## 4. Add WebSocket

```ts
app.websocket.onConnection(client => {
  client.sendJSON({ welcome: true });
});
```

## 5. Graceful Shutdown

```ts
process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());
```

## Configuration Overview

You pass an object to `new Application({...})` enabling/disabling subsystems. Common keys:

```ts
new Application({
  webserver: { port: 3000 },
  websocket: { enabled: true, path: '/ws' },
  queue: { enabled: true },
  database: {
    /* MikroORM options */
  },
  redis: { host: '127.0.0.1', port: 6379 },
  logger: { level: 'info' },
});
```

You can provide only what you need—omitted modules are skipped.

## Development Tips

- Use `logger` levels to reduce noise.
- Keep service logic in dedicated service classes for testability.
- Use queues for deferred work (video encoding, emails, etc.).

## Next

Dive into core concepts:

- [Application](/concepts/application)
- [Web Server](/concepts/webserver)
- [WebSocket](/concepts/websocket)
- [Queue](/concepts/queue)
- [Cache / Redis](/concepts/cache)

And browse the [full API reference](https://pxlbros.github.io/pxl-nodejs-framework/).
