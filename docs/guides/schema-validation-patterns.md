# Schema Validation Patterns

This guide demonstrates how to use the framework's built-in Zod schemas to create consistent, type-safe validation patterns across your application.

## Common Schemas

The framework provides a comprehensive set of reusable schemas in `@scpxl/nodejs-framework/schemas`:

### ID Schemas

```typescript
import { NumericIdSchema, UuidSchema, OptionalNumericIdSchema } from '@scpxl/nodejs-framework/schemas';

// Numeric ID (positive integer)
const userId = NumericIdSchema.parse('123'); // 123 (coerced to number)

// UUID v4
const sessionId = UuidSchema.parse('550e8400-e29b-41d4-a716-446655440000');

// Optional ID (for updates)
const id = OptionalNumericIdSchema.parse(undefined); // undefined
```

### Pagination Schemas

```typescript
import {
  PaginationQuerySchema,
  createPaginatedResponseSchema,
  type PaginationQuery,
  type PaginatedResponse,
} from '@scpxl/nodejs-framework/schemas';

// Query parameters
const query: PaginationQuery = PaginationQuerySchema.parse({
  page: '1', // Coerced to number
  limit: '20', // Coerced to number
});

// Response schema
const UserSchema = z.object({
  id: NumericIdSchema,
  name: z.string(),
  email: z.string().email(),
});

const PaginatedUsersSchema = createPaginatedResponseSchema(UserSchema);

// Type inference
type PaginatedUsers = PaginatedResponse<z.infer<typeof UserSchema>>;
```

### Sorting & Filtering

```typescript
import {
  SortOrderSchema,
  SortQuerySchema,
  SearchQuerySchema,
  ListQuerySchema,
  type ListQuery,
} from '@scpxl/nodejs-framework/schemas';

// Sort parameters
const sort = SortOrderSchema.parse('desc'); // 'desc' | 'DESC' | 'asc' | 'ASC'

// Combined list query (pagination + sorting + search)
const listQuery: ListQuery = ListQuerySchema.parse({
  page: '1',
  limit: '20',
  sort: 'createdAt',
  'sort-order': 'desc',
  search: 'john',
});
```

### Response Schemas

```typescript
import {
  createSuccessResponseSchema,
  createApiResponseSchema,
  ErrorResponseSchema,
  type ErrorResponse,
} from '@scpxl/nodejs-framework/schemas';

// Success response wrapper
const UserResponseSchema = createSuccessResponseSchema(UserSchema);
// { data: User }

// API response (success or error)
const ApiResponseSchema = createApiResponseSchema(UserSchema);
// { data: User } | { error: string, message?: string, ... }

// Error response
const error: ErrorResponse = {
  error: 'Not Found',
  message: 'User not found',
  statusCode: 404,
  details: { userId: '123' },
};
```

### Field Schemas

```typescript
import {
  EmailSchema,
  UrlSchema,
  PhoneSchema,
  DateStringSchema,
  NonEmptyStringSchema,
  TrimmedStringSchema,
  BooleanSchema,
} from '@scpxl/nodejs-framework/schemas';

// Email
const email = EmailSchema.parse('user@example.com');

// URL
const website = UrlSchema.parse('https://example.com');

// Phone (E.164 format)
const phone = PhoneSchema.parse('+1234567890');

// ISO 8601 date string
const createdAt = DateStringSchema.parse('2025-01-01T00:00:00Z');

// Non-empty string
const name = NonEmptyStringSchema.parse('John Doe');

// Trimmed non-empty string
const username = TrimmedStringSchema.parse('  john  '); // 'john'

// Boolean (with string coercion)
const active = BooleanSchema.parse('true'); // true
const inactive = BooleanSchema.parse(false); // false
```

### Timestamp Schemas

```typescript
import { TimestampSchema, OptionalTimestampSchema } from '@scpxl/nodejs-framework/schemas';

// Created/Updated timestamps
const timestamps = TimestampSchema.parse({
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Optional timestamps
const partialTimestamps = OptionalTimestampSchema.parse({
  createdAt: new Date(),
  // updatedAt is optional
});
```

### Utility Schemas

```typescript
import { CommaSeparatedStringSchema, JsonStringSchema } from '@scpxl/nodejs-framework/schemas';

// Comma-separated string to array
const tags = CommaSeparatedStringSchema.parse('tag1, tag2, tag3');
// ['tag1', 'tag2', 'tag3']

// JSON string parser
const data = JsonStringSchema.parse('{"key": "value"}');
// { key: 'value' }
```

### Health Check Schema

```typescript
import { HealthCheckResponseSchema, type HealthCheckResponse } from '@scpxl/nodejs-framework/schemas';

const health: HealthCheckResponse = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  services: {
    database: { status: 'up' },
    redis: { status: 'up' },
    queue: { status: 'degraded', message: 'High latency' },
  },
};
```

## Practical Patterns

### Building Entity Schemas

Create reusable entity schemas using common framework schemas:

```typescript
import { z } from 'zod';
import { NumericIdSchema, NonEmptyStringSchema, EmailSchema, TimestampSchema } from '@scpxl/nodejs-framework/schemas';

// Base entity schema with timestamps
const UserSchema = z
  .object({
    id: NumericIdSchema,
    email: EmailSchema,
    name: NonEmptyStringSchema.max(100),
    bio: z.string().max(500).optional(),
  })
  .merge(TimestampSchema);

type User = z.infer<typeof UserSchema>;
```

### CRUD Route Schemas

Use schema composition for consistent CRUD operations:

```typescript
import { defineRoute } from '@scpxl/nodejs-framework/webserver';
import { ErrorResponseSchema } from '@scpxl/nodejs-framework/schemas';

// GET /users/:id
const getUserSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  response: {
    200: z.object({ user: UserSchema }),
    404: ErrorResponseSchema,
  },
};

// POST /users
const createUserSchema = {
  body: UserSchema.omit({ id: true, createdAt: true, updatedAt: true }),
  response: {
    201: z.object({ user: UserSchema }),
    400: ErrorResponseSchema,
  },
};

// PUT /users/:id
const updateUserSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: UserSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
  response: {
    200: z.object({ user: UserSchema }),
    404: ErrorResponseSchema,
  },
};

// DELETE /users/:id
const deleteUserSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  response: {
    204: z.undefined(),
    404: ErrorResponseSchema,
  },
};

export const routes = [
  defineRoute({
    method: 'GET',
    path: '/users/:id',
    schema: getUserSchema,
    handler: async (request, reply) => {
      const { id } = request.params; // Fully typed!
      // ...
    },
  }),
  // ... other routes
];
```

### Pagination with Sorting

Combine pagination, sorting, and search for list endpoints:

```typescript
import { ListQuerySchema } from '@scpxl/nodejs-framework/schemas';

const listUsersSchema = {
  querystring: ListQuerySchema,
  response: {
    200: createPaginatedResponseSchema(UserSchema),
  },
};

defineRoute({
  method: 'GET',
  path: '/users',
  schema: listUsersSchema,
  handler: async (request, reply) => {
    const { page, limit, sort, 'sort-order': sortOrder, search } = request.query;

    // All parameters are validated and typed
    // page: number
    // limit: number (1-100)
    // sort?: string
    // sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc'
    // search?: string

    // ... fetch users with pagination
  },
});
```

### Nested Object Validation

Validate complex nested structures:

```typescript
const AddressSchema = z.object({
  street: NonEmptyStringSchema.max(200),
  city: NonEmptyStringSchema.max(100),
  state: NonEmptyStringSchema.length(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: NonEmptyStringSchema.default('US'),
});

const UserWithAddressSchema = UserSchema.extend({
  address: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
});
```

### Conditional Validation

Use Zod's conditional refinements:

```typescript
const CreateOrderSchema = z
  .object({
    items: z.array(OrderItemSchema).min(1),
    shippingMethod: z.enum(['standard', 'express', 'overnight']),
    shippingAddress: AddressSchema,
    billingAddress: AddressSchema.optional(),
    sameAsBilling: BooleanSchema.optional(),
  })
  .refine(
    data => {
      // If sameAsBilling is true, billingAddress is required
      if (data.sameAsBilling && !data.billingAddress) {
        return false;
      }
      return true;
    },
    {
      message: 'Billing address is required when sameAsBilling is true',
      path: ['billingAddress'],
    },
  );
```

### Schema Reuse Across Layers

Share schemas between routes, services, and database:

```typescript
// schemas/user.schema.ts
export const UserSchema = z
  .object({
    id: NumericIdSchema,
    email: EmailSchema,
    name: NonEmptyStringSchema,
  })
  .merge(TimestampSchema);

export const CreateUserDtoSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateUserDtoSchema = CreateUserDtoSchema.partial();

export type User = z.infer<typeof UserSchema>;
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

// routes/users.routes.ts
import { CreateUserDtoSchema, UpdateUserDtoSchema } from '../schemas/user.schema';

// services/user.service.ts
import type { CreateUserDto, UpdateUserDto } from '../schemas/user.schema';

class UserService {
  async create(data: CreateUserDto): Promise<User> {
    // Validate at service layer too
    const validated = CreateUserDtoSchema.parse(data);
    // ...
  }
}
```

## Best Practices

### 1. Use Framework Schemas

✅ **Do**: Use framework schemas for consistency

```typescript
import { NonEmptyStringSchema } from '@scpxl/nodejs-framework/schemas';

const schema = z.object({
  name: NonEmptyStringSchema.max(100),
});
```

❌ **Don't**: Reinvent validation patterns

```typescript
const schema = z.object({
  name: z.string().min(1).max(100), // Less reusable
});
```

### 2. Compose Schemas

✅ **Do**: Build complex schemas from simple ones

```typescript
const BaseSchema = z.object({ id: NumericIdSchema });
const TimestampedSchema = BaseSchema.merge(TimestampSchema);
const FullSchema = TimestampedSchema.extend({ name: NonEmptyStringSchema });
```

❌ **Don't**: Duplicate schema definitions

```typescript
const Schema1 = z.object({ id: z.number(), createdAt: z.date() });
const Schema2 = z.object({ id: z.number(), createdAt: z.date(), name: z.string() });
```

### 3. Export Types

✅ **Do**: Export inferred types for use across your app

```typescript
export const UserSchema = z.object({...});
export type User = z.infer<typeof UserSchema>;
```

### 4. Validate Early

✅ **Do**: Validate at route boundaries

```typescript
const schema = { body: CreateUserDtoSchema };
// Validation happens automatically before handler runs
```

### 5. Use Descriptive Errors

✅ **Do**: Add custom error messages

```typescript
const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');
```

## Examples

See the [hello-world example](../../examples/hello-world/backend/src/routes/) for complete working examples using common schemas.

## Related

- [Typed Routes Guide](./typed-routes.md)
- [Security Best Practices](./security.md)
- [Error Handling](./error-handling.md)
- [WebServer Concept](../concepts/webserver.md)

## Resources

- [Zod Documentation](https://zod.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
