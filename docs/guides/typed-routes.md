---
title: Typed Routes & Schemas
---

# Typed Routes & Schemas

Starting in **v1.0.21** the web server exposes first-class support for **Zod-powered route schemas**. In **v1.0.23**, we've integrated `fastify-type-provider-zod` for automatic runtime validation and enhanced type safety.

Instead of pushing ad-hoc `validation` objects into Fastify at runtime, you can now describe request and response contracts with Zod and receive:

- Fully typed handlers with automatic type inference
- **Automatic runtime validation** - invalid requests are rejected with 400 errors
- Response serialization
- OpenAPI-ready metadata

This guide walks through the new APIs, how to adopt them in existing controllers, and what migration steps you may need if you were relying on the old `validation` property.

## Why typed routes?

- **Type inference end-to-end** – the shape of `params`, `querystring`, `body`, and `reply` flows directly into your controller methods.
- **Automatic validation** (v1.0.23+) – Zod schemas are validated by Fastify automatically. Invalid requests return detailed 400 error responses.
- **Native Fastify integration** – Powered by `fastify-type-provider-zod`, with full support for Zod 4.
- **Docs & client generation** – the framework now holds all the metadata needed to emit OpenAPI specs or SDKs later on.
- **Safer routing** – handlers are registered explicitly, removing the `any`-based reflective lookup that previously reached into controller instances.

## Quick Example

Here's a complete example showing validation in action:

```ts
// src/routes/users.routes.ts
import { defineRoute } from '@scpxl/nodejs-framework/webserver';
import type { RouteSchemaDefinition } from '@scpxl/nodejs-framework/webserver';
import { z } from 'zod';

const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
  }),
  response: {
    201: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;

export const routes = [
  defineRoute({
    method: 'POST',
    path: '/api/users',
    schema: createUserSchema,
    handler: async (request, reply) => {
      // request.body is typed as { email: string; name: string }
      // Validation has already passed - no need to check!

      const user = await createUser(request.body);
      return reply.status(201).send(user);
    },
  }),
];
```

**What happens:**

- Valid request: Handler executes with typed `request.body`
- Invalid email: Returns `400` with error message
- Missing name: Returns `400` with error message
- Name too long: Returns `400` with error message

All validation is automatic - you just write your business logic!

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
- **Validation is automatic** - Fastify will validate requests against the schema and return 400 errors for invalid data.
- The helper defaults to `WebServerRouteType.Default`, but you can pass `type` if you need entity routes.

**Under the hood** (v1.0.23+): The framework uses `fastify-type-provider-zod` which:

1. Passes Zod schemas directly to Fastify (no conversion needed!)
2. Configures validators and serializers automatically
3. Validates requests before they reach your handler
4. Returns detailed validation errors to clients

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

## Validation Error Responses

When a request fails validation (v1.0.23+), Fastify automatically returns a **400 Bad Request** with detailed error information:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/email must be a valid email"
}
```

The error messages come directly from Zod and include:

- The path to the invalid field (e.g., `body/email`, `params/id`)
- A description of what went wrong
- Multiple errors if multiple fields are invalid

You don't need to write validation code in your handlers - it's all automatic!

## Using `defineAction()` Helper

For controller methods, you can use the `defineAction()` helper to get full type inference:

```ts
import { defineAction } from '@scpxl/nodejs-framework/webserver';
import { z } from 'zod';

const helloSchema = {
  body: z.object({ name: z.string() }),
  response: { 200: z.object({ message: z.string() }) },
} satisfies RouteSchemaDefinition;

class MyController extends WebServerBaseController {
  // With schema - fully typed
  hello = defineAction(helloSchema, async (request, reply) => {
    // request.body.name is typed as string
    return reply.send({ message: `Hello ${request.body.name}` });
  });

  // Without schema - still works
  ping = defineAction(async (_request, reply) => {
    return reply.send({ status: 'pong' });
  });
}
```

The `defineAction()` helper is purely for type inference - it returns the handler function unchanged. The actual validation happens at the route registration level when you provide a `schema`.

## What about entity routes?

Entity controllers (`WebServerRouteType.Entity`) can also attach `schema`. The default CRUD definitions will inherit it for create/update variants. If you need per-action variations you can use `handler` overrides or define multiple routes with distinct schemas.

## Next up: OpenAPI

Because every route now carries canonical schemas, the framework can generate OpenAPI specs without additional annotations. A future release will add tooling to emit `/docs/json` dynamically—no changes will be required on your part beyond using the typed routes described above.

---

Questions or feedback? [Open an issue](https://github.com/PXLbros/pxl-nodejs-framework/issues/new) or reach out in the community Discord.
