# Application

The `Application` orchestrates lifecycle of all subsystems: web server, websocket, database, queues, cache, services.

## Lifecycle

```mermaid
graph TD
  A[create Application] --> B[configure modules]
  B --> C[start()]
  C --> D[init logger]
  D --> E[init cache/redis]
  E --> F[init database]
  F --> G[start queue workers]
  G --> H[start web server]
  H --> I[start websocket]
```

`start()` only initializes modules you've configured. `stop()` tears them down in reverse order.

## Creating

```ts
import { Application } from '@pxl/nodejs-framework';

const app = new Application({
  webserver: { port: 3000 },
  redis: { host: '127.0.0.1', port: 6379 },
  logger: { level: 'info' },
});
```

## Accessing Modules

After `start()`:

```ts
app.logger.info('Started');
app.webserver.fastify; // raw Fastify instance
app.redis.client; // redis client
app.queue.manager; // queue manager
```

Avoid accessing modules before `start()`.

## Services

You can structure business logic into services. A recommended pattern:

```ts
class UserService {
  constructor(private app: Application) {}
  async createUser(data: any) {
    // use app.database / app.queue / app.logger
  }
}
```

Inject the `Application` or extract only needed dependencies.

## Error Handling

Use the logger and Fastify error hooks. Wrap async startup sequences if external services are required.

## Monitoring

The framework exposes performance helpers (see performance section) you can instrument for latency and resource tracking.
