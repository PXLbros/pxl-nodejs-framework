# PXL Node.js Framework

A comprehensive Node.js framework for building modern applications with support for web servers, databases, queues, caching, and more.

Opinionated TypeScript framework combining Fastify, WebSockets, Redis, BullMQ, and MikroORM under a unified Application lifecycle.

## Install

```bash
npm install @scpxl/nodejs-framework
```

## Quick Start

```ts
import { Application } from '@scpxl/nodejs-framework';

const app = new Application({
  webserver: { port: 3000 },
  logger: { level: 'info' },
});

await app.start();

app.webserver.route({
  method: 'GET',
  url: '/health',
  handler: async () => ({ ok: true }),
});
```

## Add WebSocket

```ts
app.websocket.onConnection(client => {
  client.sendJSON({ welcome: true });
});
```

## Add Queue Job

```ts
await app.queue.manager.add('email', { userId: 123 });
```

## Configuration Example

```ts
new Application({
  webserver: { port: 3000 },
  websocket: { enabled: true },
  queue: { enabled: true },
  redis: { host: '127.0.0.1', port: 6379 },
  database: {
    /* MikroORM config */
  },
  logger: { level: 'info' },
});
```

## Features

- Unified lifecycle (start/stop all subsystems)
- Fastify routing + raw access
- WebSocket client + room management
- BullMQ queue integration
- MikroORM database integration
- Redis cache + pub/sub
- Structured logging
- Utilities & services layer

## Documentation

Full docs & guides (VitePress) + API reference (TypeDoc).

- Getting Started, Concepts, Guides
- API: https://pxlbros.github.io/pxl-nodejs-framework/

To run local docs site (once cloned):

```bash
npm run docs:site:dev
```

## Graceful Shutdown

```ts
process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());
```

## Example Service Pattern

```ts
class UserService {
  constructor(private app: Application) {}
  async register(data: any) {
    // use app.database / app.queue / app.logger
  }
}
```

## When Not to Use

If you only need a single HTTP server or minimal script, this framework may be heavier than needed.

## Contributing

Issues and PRs welcome. Development scripts remain available:

```bash
npm run dev     # watch build
npm run build   # production build
```

---

Released under ISC License.
