---
title: Typed Routes & Schemas
---

# Typed Routes & Schemas

Starting in v1.0.21 the web server exposes first-class support for **Zod-powered route schemas**. Instead of pushing ad-hoc `validation` objects into Fastify at runtime, you can now describe request and response contracts with Zod and receive fully typed handlers, automatic JSON Schema generation, and OpenAPI-ready metadata.

This guide walks through the new APIs, how to adopt them in existing controllers, and what migration steps you may need if you were relying on the old `validation` property.

## Why the change?

- **Type inference end-to-end** – the shape of `params`, `querystring`, `body`, and `reply` flows directly into your controller methods.
- **Native Fastify integration** – Zod definitions are converted to JSON Schema up front and passed to Fastify's `schema` field. That enables AJV-powered request validation, hooks, and ecosystem plugins with zero extra wiring.
- **Docs & client generation** – the framework now holds all the metadata needed to emit OpenAPI specs or SDKs later on.
- **Safer routing** – handlers are registered explicitly, removing the `any`-based reflective lookup that previously reached into controller instances.

## Defining a Typed Route

You can still describe routes inline on the `webserver` config, but the new `defineRoute` helper keeps things succinct and strongly typed.

```ts
import { defineRoute } from '@scpxl/nodejs-framework';
import { z } from 'zod';

export default [
  defineRoute({
    method: 'POST',
    path: '/users',
    schema: {
      body: z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }),
      response: {
        201: z.object({ id: z.string(), email: z.string().email() }),
      },
    },
    handler: async (request, reply) => {
      const user = await createUser(request.body);
      return reply.code(201).send(user);
    },
  }),
];
```

Key points:

- `schema` accepts any combination of `params`, `querystring`, `body`, `headers`, and `response` (use status codes as keys).
- The `handler` receives a `FastifyRequest` whose types are derived automatically from the Zod schema.
- The helper defaults to `WebServerRouteType.Default`, but you can pass `type` if you need entity routes.

Under the hood the framework converts each Zod schema via `z.toJSONSchema` and attaches it to Fastify. The `$schema` metadata is stripped to keep Fastify happy, but all validation rules stay intact.

## Using Controllers with Typed Actions

Controllers now expose aliases that make their method signatures clearer:

```ts
import { WebServerBaseController, ControllerAction, ControllerRequest } from '@scpxl/nodejs-framework';
import { z } from 'zod';

const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  response: {
    201: z.object({ id: z.string(), email: z.string().email(), name: z.string() }),
  },
} as const;

export type CreateUserSchema = typeof createUserSchema;

export default class UserController extends WebServerBaseController {
  public create: ControllerAction<CreateUserSchema> = async (request, reply) => {
    const user = await this.services.user.create(request.body);
    this.sendSuccessResponse({ reply, data: user, statusCode: 201 });
  };

  private runAudit(request: ControllerRequest<CreateUserSchema>) {
    // Access to fully typed request
    void request.body.email;
  }
}
```

- `ControllerAction<Schema>` enforces the request/response typing derived from `createUserSchema`.
- `ControllerRequest<Schema>` is available when you need helper methods that share the same typed request.
- Inside the controller you still have access to utilities like `sendSuccessResponse` and the application resources (database, redis, queues, etc.).

When registering the route you can continue to rely on controller auto-wiring by adding the schema next to the route definition:

```ts
import { WebServerRouteType } from '@scpxl/nodejs-framework';
import UserController from './controllers/user.controller.js';
import { createUserSchema } from './schemas/user.js';

export default [
  {
    type: WebServerRouteType.Default,
    method: 'POST',
    path: '/users',
    controller: UserController,
    action: 'create',
    schema: createUserSchema,
  },
];
```

Prefer a lighter approach? Provide the `handler` directly with the same schema object:

```ts
import { defineRoute } from '@scpxl/nodejs-framework';
import { createUserSchema } from './schemas/user.js';
import { userService } from './services/user.service.js';

export default [
  defineRoute({
    method: 'POST',
    path: '/users',
    schema: createUserSchema,
    handler: async (request, reply) => {
      const user = await userService.create(request.body);
      return reply.code(201).send(user);
    },
  }),
];
```

> Swap `userService` for whichever dependency container or module pattern you prefer—the important part is that `request.body` is fully typed and already validated.

## Handler-only Routes

For lightweight endpoints you can now omit `controller` entirely. Provide `handler` (and optionally `schema`) on the route definition and the web server will register it directly.

```ts
{
  method: 'GET',
  path: '/healthz',
  handler: async (_req, reply) => reply.send({ ok: true }),
  schema: {
    response: { 200: z.object({ ok: z.boolean() }) },
  },
}
```

> Remember to import `z` from `zod` when using inline schemas.

This is especially handy is especially handy for temporary endpoints, internal tooling, or when you want to colocate route logic with feature modules instead of controllers.

## Migration from `validation`

- The old `validation` block (custom schema definitions checked in `preValidation`) still works. During registration the framework will translate it to Fastify's `schema` field to avoid breaking existing code.
- New code should prefer `schema` with Zod definitions. You get static typing, better editor support, and a future-proof path to generated references.
- Replace direct usage of `request.compileValidationSchema` with Zod validation in the schema definition. No manual `preValidation` step is required anymore—Fastify handles it.
- When moving controllers over, type methods with `ControllerAction<YourSchema>` and adjust references to `request.body`, `request.params`, etc. (the types will now match the schema).

## What about entity routes?

Entity controllers (`WebServerRouteType.Entity`) can also attach `schema`. The default CRUD definitions will inherit it for create/update variants. If you need per-action variations you can use `handler` overrides or define multiple routes with distinct schemas.

## Next up: OpenAPI

Because every route now carries canonical schemas, the framework can generate OpenAPI specs without additional annotations. A future release will add tooling to emit `/docs/json` dynamically—no changes will be required on your part beyond using the typed routes described above.

---

Questions or feedback? [Open an issue](https://github.com/PXLbros/pxl-nodejs-framework/issues/new) or reach out in the community Discord.
