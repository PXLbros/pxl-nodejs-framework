# Authentication Guide

Authentication in the PXL Framework provides JWT-based authentication for your applications.

## Overview

This guide covers:

- JWT token generation and validation
- Protecting routes with authentication
- WebSocket authentication
- User session management

## JWT Authentication

The framework includes built-in JWT support for securing your API endpoints and WebSocket connections.

### Configuration

Configure JWT authentication in your application config:

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY,
  },
  webserver: {
    port: 3000,
  },
});
```

### Generating Tokens

Use the Auth utility to generate JWT tokens:

```typescript
import { Auth } from '@scpxl/nodejs-framework/auth';

const token = Auth.generateJWT({
  payload: {
    sub: 123, // User ID (required)
    email: 'user@example.com',
    role: 'admin',
  },
  secretKey: process.env.JWT_SECRET_KEY,
  expiresIn: '24h',
});
```

### Validating Tokens

Validate JWT tokens in your routes:

```typescript
import { Auth } from '@scpxl/nodejs-framework/auth';

const decoded = Auth.verifyJWT({
  token: request.headers.authorization?.replace('Bearer ', ''),
  secretKey: process.env.JWT_SECRET_KEY,
});

if (!decoded) {
  return reply.code(401).send({ error: 'Invalid token' });
}

const userId = decoded.sub;
```

## Protecting Routes

Use Fastify hooks to protect routes:

```typescript
// In your route definition
fastify.get(
  '/protected',
  {
    preHandler: async (request, reply) => {
      const token = request.headers.authorization?.replace('Bearer ', '');

      const decoded = Auth.verifyJWT({
        token,
        secretKey: process.env.JWT_SECRET_KEY,
      });

      if (!decoded) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Attach user to request
      request.user = decoded;
    },
  },
  async (request, reply) => {
    return { message: 'Protected data', userId: request.user.sub };
  },
);
```

## WebSocket Authentication

WebSocket connections can be authenticated using JWT tokens passed as query parameters.

### Client-Side

```typescript
const token = 'your-jwt-token';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
```

### Server-Side

The framework automatically validates the JWT token when a WebSocket connection is established:

```typescript
const app = new WebApplication({
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY,
  },
  webSocket: {
    enabled: true,
    type: 'server',
    url: 'ws://localhost:3000/ws',
    events: {
      onConnected: ({ ws, clientId }) => {
        // Access authenticated user
        const client = app.websocket.server.clientManager.getClient({ clientId });
        const userId = client?.user?.userId;
        const userPayload = client?.user?.payload;

        console.log(`User ${userId} connected`);
      },
    },
  },
});
```

### Using Authentication in Controllers

Access authenticated user data in WebSocket controllers:

```typescript
import { WebSocketServerBaseController } from '@scpxl/nodejs-framework/websocket';

export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    const client = this.webSocketServer.clientManager.getClient({ clientId });
    const userId = client?.user?.userId;
    const userRole = client?.user?.payload?.role;

    if (!userId) {
      return { error: 'Authentication required' };
    }

    // Process authenticated request
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'chat',
        action: 'message',
        data: {
          userId,
          message: data.text,
        },
      },
    });

    return { success: true };
  };
}
```

## Best Practices

1. **Use strong secret keys**: Generate secure random strings for JWT secret keys
2. **Set appropriate expiration**: Use reasonable token expiration times (e.g., 24h for access tokens)
3. **Validate on every request**: Always validate tokens before processing sensitive operations
4. **Handle errors gracefully**: Return appropriate HTTP status codes (401 for auth failures)
5. **Secure token storage**: On the client side, store tokens securely (e.g., httpOnly cookies)

## Related Documentation

- [WebSocket Guide](./websocket.md)
- [Auth Concepts](../concepts/auth.md)
- [Configuration Overview](./configuration.md)
