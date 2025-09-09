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
