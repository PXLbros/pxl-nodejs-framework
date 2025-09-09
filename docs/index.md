# PXL Node.js Framework

An opinionated, modular TypeScript framework for building scalable backends with Fastify, WebSockets, Redis, BullMQ, MikroORM, and more—under a unified Application lifecycle.

## Features

- Unified Application bootstrap (HTTP, WS, Queue, DB, Cache)
- Fastify-based web server with typed routing helpers
- WebSocket rooms & client management
- Queue processing via BullMQ
- MikroORM database integration
- Redis integration (caching + pub/sub)
- Structured logging
- Pluggable services & utilities

## When to Use

Use PXL when you want a batteries-included foundation for service backends or realtime APIs without committing to a giant monolith framework. It aims to stay close to underlying libraries while giving you:

- Consistent lifecycle & dependency wiring
- Performance monitoring hooks
- Clean module boundaries
- Extensible service layer

If you only need a single Fastify server or a lightweight script, this may be more than you need.

## Installation

```bash
npm install @pxl/nodejs-framework
```

(or `pnpm add` / `yarn add`).

## Quick Start

Create `app.ts`:

```ts
import { Application } from '@pxl/nodejs-framework';

const app = new Application({
  webserver: {
    port: 3000,
  },
  logger: { level: 'info' },
});

await app.start();

console.log('App running');
```

Run it:

```bash
node --loader ts-node/esm app.ts
```

## Add a Route

```ts
app.webserver.route({
  method: 'GET',
  url: '/health',
  handler: async () => ({ ok: true }),
});
```

## Next Steps

- Read the [Getting Started guide](/getting-started)
- Explore [Application concept](/concepts/application)
- View the [API reference](https://pxlbros.github.io/pxl-nodejs-framework/)

---

Need something missing? Open an issue or PR on GitHub.
