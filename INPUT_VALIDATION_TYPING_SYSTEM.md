# Input Validation & Route Typing System Implementation Plan

## Overview

This document outlines the implementation plan for adding comprehensive input validation and route typing to the PXL Node.js Framework. The goal is to replace the current custom validation approach with Fastify's native schema validation powered by Zod for type safety.

## Current State Analysis

### Problems with Current Implementation

1. **Custom `compileValidationSchema`**: Non-standard validation using `request.compileValidationSchema` instead of Fastify's native AJV
2. **Mixed Validation Libraries**: Both Joi (for entities) and custom validation (for routes)
3. **Lack of Type Safety**: Routes and controller actions use `any` types extensively
4. **No Schema Reuse**: Validation schemas are not reusable or composable
5. **Poor Error Messages**: Validation errors are not properly formatted
6. **No OpenAPI Support**: Cannot generate API documentation from schemas

## Proposed Architecture

### Core Components

#### 1. Validation Infrastructure (`src/validation/`)

```
src/validation/
├── index.ts                    # Main exports
├── zod-to-json-schema.ts      # Zod → JSON Schema converter
├── route-schema.ts             # Route schema type definitions
├── validation-error.ts         # Error formatting utilities
└── type-provider.ts           # Fastify type provider setup
```

#### 2. Schema Library (`src/schemas/`)

```
src/schemas/
├── index.ts                    # Schema exports
├── common.ts                   # Common schemas (pagination, IDs, etc.)
├── entity.ts                   # Entity-specific schema builders
└── responses.ts               # Standard response schemas
```

#### 3. Enhanced Type System

- Fully typed route definitions
- Generic controller actions
- Type-safe request/reply objects
- Automatic type inference from schemas

## Implementation Details

### Phase 1: Core Infrastructure

#### 1.1 Install Dependencies

```bash
npm install zod-to-json-schema
npm install --save-dev @types/json-schema
```

#### 1.2 Create Zod to JSON Schema Converter

```typescript
// src/validation/zod-to-json-schema.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function convertZodSchema(schema: z.ZodSchema): any {
  return zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  });
}

export function buildFastifySchema(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  response?: Record<number, z.ZodSchema>;
}) {
  const fastifySchema: any = {};

  if (schemas.body) {
    fastifySchema.body = convertZodSchema(schemas.body);
  }
  if (schemas.query) {
    fastifySchema.querystring = convertZodSchema(schemas.query);
  }
  if (schemas.params) {
    fastifySchema.params = convertZodSchema(schemas.params);
  }
  if (schemas.response) {
    fastifySchema.response = {};
    for (const [code, schema] of Object.entries(schemas.response)) {
      fastifySchema.response[code] = convertZodSchema(schema);
    }
  }

  return fastifySchema;
}
```

#### 1.3 Define Route Schema Types

```typescript
// src/validation/route-schema.ts
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface RouteSchema {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
  response?: {
    [statusCode: number]: z.ZodSchema;
  };
}

export type TypedRequest<TSchema extends RouteSchema> = FastifyRequest<{
  Body: TSchema['body'] extends z.ZodSchema ? z.infer<TSchema['body']> : unknown;
  Querystring: TSchema['query'] extends z.ZodSchema ? z.infer<TSchema['query']> : unknown;
  Params: TSchema['params'] extends z.ZodSchema ? z.infer<TSchema['params']> : unknown;
  Headers: TSchema['headers'] extends z.ZodSchema ? z.infer<TSchema['headers']> : unknown;
}>;

export type TypedReply<TSchema extends RouteSchema> = FastifyReply;
```

### Phase 2: Update Route System

#### 2.1 Update Route Interfaces

```typescript
// src/webserver/webserver.interface.ts
import type { RouteSchema } from '../validation/route-schema.js';

export interface TypedRoute {
  type?: WebServerRouteType;
  path: string;
  method: HTTPMethods | HTTPMethods[];
  controllerName?: string;
  controller?: WebServerBaseControllerType;
  action: string;
  schema?: RouteSchema; // Zod schemas instead of old validation
}
```

#### 2.2 Update WebServer Route Registration

```typescript
// src/webserver/webserver.ts (modified registerRoute method)
private async registerRoute({
  routePath,
  routeMethod,
  routeAction,
  routeSchema,
  controllerName,
  controllerInstance,
}: {
  routePath: string;
  routeMethod: HTTPMethods | HTTPMethods[];
  routeAction: string;
  routeSchema?: RouteSchema;
  controllerName: string;
  controllerInstance: any;
}): Promise<void> {
  const controllerHandler = controllerInstance[routeAction];

  if (!controllerHandler) {
    throw new Error(`Action ${routeAction} not found in controller ${controllerName}`);
  }

  // Convert Zod schemas to JSON Schema for Fastify
  const fastifySchema = routeSchema ? buildFastifySchema(routeSchema) : undefined;

  this.fastifyServer.route({
    method: routeMethod,
    url: routePath,
    schema: fastifySchema,  // Use Fastify's native schema validation
    handler: controllerHandler,
    errorHandler: (error, request, reply) => {
      if (error.validation) {
        return this.handleValidationError(error, reply);
      }
      throw error;
    }
  });
}
```

### Phase 3: Common Schemas

#### 3.1 Create Common Validation Schemas

```typescript
// src/schemas/common.ts
import { z } from 'zod';

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  'sort-order': z.enum(['ASC', 'DESC']).default('ASC').optional(),
});

export const SearchQuerySchema = z.object({
  search: z.string().optional(),
  filters: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return {};
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }),
});

export const TimestampSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

#### 3.2 Create Response Schemas

```typescript
// src/schemas/responses.ts
import { z } from 'zod';

export const ApiErrorSchema = z.object({
  message: z.string(),
  type: z.enum(['validation', 'authentication', 'authorization', 'not_found', 'server_error', 'client_error']),
  timestamp: z.string(),
  requestId: z.string(),
  details: z.any().optional(),
});

export const ApiResponseSchema = <T extends z.ZodSchema>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string(),
        requestId: z.string(),
      })
      .passthrough()
      .optional(),
    error: ApiErrorSchema.optional(),
  });

export const PaginatedResponseSchema = <T extends z.ZodSchema>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total_items: z.number(),
    page: z.number(),
    total_pages: z.number(),
    limit: z.number(),
  });
```

### Phase 4: Update Controllers

#### 4.1 Typed Base Controller

```typescript
// src/webserver/controller/base.ts
import type { TypedRequest, TypedReply, RouteSchema } from '../../validation/route-schema.js';

export type TypedControllerAction<TSchema extends RouteSchema = RouteSchema> = (
  request: TypedRequest<TSchema>,
  reply: TypedReply<TSchema>,
) => Promise<void> | void;

export default abstract class BaseController {
  // ... existing code ...

  protected sendTypedResponse<T>(reply: FastifyReply, data: T, statusCode: number = 200): void {
    reply.status(statusCode).send({
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: reply.request.id,
      },
    });
  }
}
```

#### 4.2 Typed Entity Controller

```typescript
// src/webserver/controller/entity.ts
import { z } from 'zod';
import { IdParamSchema, PaginationQuerySchema, SearchQuerySchema } from '../../schemas/common.js';
import type { TypedControllerAction } from './base.js';

// Define schemas for each action
const getManySchema = {
  query: PaginationQuerySchema.merge(SearchQuerySchema).extend({
    populate: z.string().optional(),
  }),
};

const getOneSchema = {
  params: IdParamSchema,
  query: z.object({
    populate: z.string().optional(),
  }),
};

export default abstract class EntityController extends BaseController {
  // Typed actions
  public getMany: TypedControllerAction<typeof getManySchema> = async (request, reply) => {
    // request.query is now fully typed
    const { page, limit, search, filters, sort, 'sort-order': sortOrder } = request.query;
    // ... implementation
  };

  public getOne: TypedControllerAction<typeof getOneSchema> = async (request, reply) => {
    // request.params.id is typed as number
    const { id } = request.params;
    // ... implementation
  };
}
```

### Phase 5: Entity Validation Migration

#### 5.1 Replace Joi with Zod in Dynamic Entity

```typescript
// src/database/dynamic-entity.ts
import { z } from 'zod';

export class DynamicEntity {
  // Replace Joi schemas with Zod
  public static schema: z.ZodSchema;
  public static schemaUpdate: z.ZodSchema;

  public static validate<T>(
    item: T,
    isCreating: boolean,
  ): {
    success: boolean;
    data?: T;
    error?: z.ZodError;
  } {
    const schema = isCreating ? this.schema : this.schemaUpdate;
    const result = schema.safeParse(item);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }

  // Generate Zod schema from entity metadata
  public static generateSchema(): z.ZodSchema {
    // Implementation to generate schema from MikroORM metadata
  }
}
```

## Usage Examples

### Example 1: Simple Route with Validation

```typescript
// Define schema
const createUserSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().int().min(0).max(120).optional(),
  }),
  response: {
    201: z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
      age: z.number().optional(),
      createdAt: z.string(),
    }),
  },
};

// Controller
class UserController extends BaseController {
  public createUser: TypedControllerAction<typeof createUserSchema> = async (request, reply) => {
    // request.body is fully typed
    const { name, email, age } = request.body;

    const user = await this.userService.create({ name, email, age });

    // Response must match schema
    this.sendTypedResponse(reply, user, 201);
  };
}

// Route definition
const route: TypedRoute = {
  path: '/users',
  method: 'POST',
  controller: UserController,
  action: 'createUser',
  schema: createUserSchema,
};
```

### Example 2: Entity Route with Complex Query

```typescript
const searchProductsSchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    category: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z.coerce.boolean().optional(),
    tags: z
      .string()
      .transform(val => val.split(','))
      .optional(),
  }),
};

class ProductController extends EntityController {
  public searchProducts: TypedControllerAction<typeof searchProductsSchema> = async (request, reply) => {
    const { page, limit, category, minPrice, maxPrice, inStock, tags } = request.query;
    // All query params are properly typed and validated
  };
}
```

## Testing Strategy

### Unit Tests

```typescript
// test/unit/validation/zod-to-json-schema.test.ts
describe('Zod to JSON Schema Converter', () => {
  it('should convert simple Zod schema to JSON Schema', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const jsonSchema = convertZodSchema(zodSchema);

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties.name.type).toBe('string');
    expect(jsonSchema.properties.age.type).toBe('number');
  });
});
```

### Integration Tests

```typescript
// test/integration/typed-routes.test.ts
describe('Typed Routes', () => {
  it('should validate request body', async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: '', // Invalid: empty string
        email: 'invalid-email', // Invalid: not an email
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBeDefined();
  });
});
```

## Migration Guide

### For Route Definitions

```typescript
// Before
const route = {
  path: '/users/:id',
  method: 'GET',
  controller: UserController,
  action: 'getUser',
  validation: {
    type: 'params',
    schema: { id: { type: 'number' } },
  },
};

// After
const route: TypedRoute = {
  path: '/users/:id',
  method: 'GET',
  controller: UserController,
  action: 'getUser',
  schema: {
    params: z.object({
      id: z.coerce.number().positive(),
    }),
  },
};
```

### For Entity Validation

```typescript
// Before (Joi)
class User extends DynamicEntity {
  static schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
  });
}

// After (Zod)
class User extends DynamicEntity {
  static schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });
}
```

## Benefits

1. **Type Safety**: Complete type inference from schemas to controllers
2. **Performance**: Fastify's compiled validators are faster than runtime validation
3. **Developer Experience**: Auto-completion and compile-time type checking
4. **Standards Compliance**: Uses JSON Schema standard for validation
5. **OpenAPI Ready**: Can generate OpenAPI documentation from schemas
6. **Error Quality**: Better validation error messages with field-level details
7. **Reusability**: Schemas can be composed and reused across routes

## Timeline

- **Week 1**: Core infrastructure and validation utilities
- **Week 2**: Update route system and WebServer
- **Week 3**: Migrate controllers and create common schemas
- **Week 4**: Replace entity validation and add tests
- **Week 5**: Documentation and examples

## Open Questions

1. Should we support multiple validation libraries (Zod + others)?
2. Should validation errors include field paths in a specific format?
3. How should we handle file upload validation?
4. Should we auto-generate schemas from database entities?

## Success Metrics

- [ ] All routes use typed schemas
- [ ] No `any` types in controller actions
- [ ] 100% of validation uses Fastify's native system
- [ ] Validation errors follow consistent format
- [ ] Full TypeScript inference working
- [ ] Tests cover all validation scenarios
- [ ] Documentation includes migration examples
