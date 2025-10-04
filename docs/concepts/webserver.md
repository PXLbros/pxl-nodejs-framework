# Web Server

Powered by Fastify. Exposed at `app.webserver` after start.

## Adding Routes

```ts
app.webserver.route({
  method: 'GET',
  url: '/ping',
  handler: async () => ({ pong: true }),
});
```

## Automatic Route Discovery

Set `webServer.routesDirectory` in your application config to auto-load route definitions. Each `.ts`/`.js` file can export a single route, an array of routes, or an object with a `routes` array. Discovered routes are merged with statically configured routes before controllers are resolved.

```ts
// Application config
const app = new WebApplication({
  webServer: {
    enabled: true,
    port: 3000,
    controllersDirectory: './src/webserver/controllers',
    routesDirectory: './src/webserver/routes',
  },
  redis: { host: '127.0.0.1', port: 6379 },
});

// src/webserver/routes/health.ts
export default {
  type: 'default',
  method: 'GET',
  path: '/health',
  controllerName: 'health',
  action: 'status',
};
```

Invalid exports are skipped with a warning so you can fix the file without crashing the server.

## Raw Fastify

```ts
const fastify = app.webserver.fastify;
fastify.addHook('onRequest', async (req, reply) => {
  /* ... */
});
```

## JSON / Validation

Integrate validation libraries (e.g. Joi, Zod) at route level. Example with Joi:

```ts
import Joi from 'joi';

const schema = Joi.object({ name: Joi.string().required() });

app.webserver.route({
  method: 'POST',
  url: '/hello',
  handler: async req => {
    const body = schema.validate(req.body).value;
    return { hi: body.name };
  },
});
```

## Error Handling

Set a Fastify error handler:

```ts
fastify.setErrorHandler((err, _req, reply) => {
  app.logger.error(err);
  reply.status(500).send({ error: 'Internal' });
});
```
