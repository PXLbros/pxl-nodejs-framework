# Error Handling Guide

The PXL Framework provides comprehensive error handling mechanisms to help you build robust applications.

## Overview

This guide covers:

- Custom error classes
- Error handling in routes
- Global error handlers
- Logging errors
- Best practices

## Custom Error Classes

The framework includes several built-in error classes:

```typescript
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '@scpxl/nodejs-framework/errors';

// Throw custom errors
throw new NotFoundError('User not found');
throw new ValidationError('Invalid email format');
throw new UnauthorizedError('Authentication required');
```

## Error Handling in Routes

Use try-catch blocks to handle errors in your route handlers:

```typescript
fastify.get('/users/:id', async (request, reply) => {
  try {
    const user = await getUserById(request.params.id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return { user };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    Logger.error({ message: 'Error fetching user', error });
    return reply.code(500).send({ error: 'Internal server error' });
  }
});
```

## Global Error Handler

Configure a global error handler for your Fastify server:

```typescript
fastify.setErrorHandler((error, request, reply) => {
  Logger.error({
    message: 'Request error',
    error,
    url: request.url,
    method: request.method,
  });

  if (error instanceof ValidationError) {
    return reply.code(400).send({ error: error.message });
  }

  if (error instanceof NotFoundError) {
    return reply.code(404).send({ error: error.message });
  }

  if (error instanceof UnauthorizedError) {
    return reply.code(401).send({ error: error.message });
  }

  if (error instanceof ForbiddenError) {
    return reply.code(403).send({ error: error.message });
  }

  return reply.code(500).send({ error: 'Internal server error' });
});
```

## Async Error Handling

Fastify automatically catches errors thrown in async route handlers:

```typescript
fastify.get('/data', async (request, reply) => {
  // Errors are automatically caught and passed to error handler
  const data = await fetchDataThatMightThrow();
  return { data };
});
```

## Validation Errors

Use validation schemas to catch errors early:

```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

fastify.post('/users', async (request, reply) => {
  try {
    const validated = userSchema.parse(request.body);
    const user = await createUser(validated);
    return { user };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    throw error;
  }
});
```

## Logging Errors

Use the framework's logger to log errors:

```typescript
import { Logger } from '@scpxl/nodejs-framework/logger';

try {
  await riskyOperation();
} catch (error) {
  Logger.error({
    message: 'Operation failed',
    error,
    meta: {
      userId: request.user?.id,
      operation: 'riskyOperation',
    },
  });

  throw error;
}
```

## WebSocket Error Handling

Handle errors in WebSocket controllers:

```typescript
export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    try {
      if (!data?.text) {
        return {
          error: 'Message text is required',
          code: 'VALIDATION_ERROR',
        };
      }

      this.webSocketServer.sendMessageToAll({
        data: {
          type: 'chat',
          action: 'message',
          data: { text: data.text },
        },
      });

      return { success: true };
    } catch (error) {
      Logger.error({ message: 'Chat send error', error });

      return {
        error: 'Failed to send message',
        code: 'SEND_ERROR',
      };
    }
  };
}
```

## Best Practices

1. **Use custom error classes**: Create specific error types for different failure scenarios
2. **Log with context**: Include relevant metadata when logging errors
3. **Return appropriate status codes**: Use proper HTTP status codes for different error types
4. **Don't expose internal details**: Don't leak implementation details in error messages
5. **Handle errors at the right level**: Catch errors where you have enough context to handle them
6. **Use async/await properly**: Always await promises to ensure errors are caught
7. **Validate early**: Use validation schemas to catch errors before processing

## Related Documentation

- [Logger Concepts](../concepts/logger.md)
- [Configuration Guide](./configuration.md)
- [Testing Guide](./testing.md)
