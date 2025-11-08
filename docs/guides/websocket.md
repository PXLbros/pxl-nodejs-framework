# WebSocket Guide

The PXL Framework provides comprehensive WebSocket support for building real-time applications with features like room-based messaging, authentication, and multi-worker coordination.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Server-Side Implementation](#server-side-implementation)
- [Client-Side Implementation](#client-side-implementation)
- [Room Management](#room-management)
- [Authentication](#authentication)
- [Multi-Worker Coordination](#multi-worker-coordination)
- [Broadcasting Utilities](#broadcasting-utilities)
- [Subscriber Utilities](#subscriber-utilities)
- [Subscriber Middleware](#subscriber-middleware)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The WebSocket module provides:

- **Bidirectional Communication**: Real-time messaging between server and clients
- **Room-Based Messaging**: Group clients into rooms for targeted broadcasts
- **Controller-Based Routing**: Organize WebSocket handlers using controllers
- **Authentication**: JWT-based WebSocket authentication
- **Multi-Worker Support**: Redis-based pub/sub for scaling across workers
- **Client Management**: Track connected clients with metadata
- **Automatic Cleanup**: Graceful shutdown and inactive client management

## Quick Start

### Basic WebSocket Server

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  webserver: { port: 3000 },
  websocket: {
    enabled: true,
    type: 'server',
    url: 'ws://localhost:3000/ws',
  },
  redis: { host: '127.0.0.1', port: 6379 },
});

await app.start();
console.log('WebSocket server running at ws://localhost:3000/ws');
```

### Basic WebSocket Client

```typescript
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  ws.send(
    JSON.stringify({
      type: 'chat',
      action: 'message',
      data: { text: 'Hello!' },
    }),
  );
});

ws.on('message', data => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message);
});
```

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                WebSocket Server                      │
│  ┌───────────────────────────────────────────────┐  │
│  │          Client Manager                       │  │
│  │  - Track connected clients                    │  │
│  │  - Manage client metadata                     │  │
│  │  - Handle authentication                      │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │          Room Manager                         │  │
│  │  - Create/delete rooms                        │  │
│  │  - Add/remove clients from rooms              │  │
│  │  - Broadcast to room members                  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │      Controller-Based Routing                 │  │
│  │  - Route messages to controllers              │  │
│  │  - type + action → controller method          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                           │
                           ├─── Redis Pub/Sub
                           │    (Multi-worker coordination)
                           │
                  ┌────────┴────────┐
                  │                 │
            Worker 1           Worker 2
```

### Message Flow

1. **Client connects** → Server assigns client ID
2. **Client sends message** → Server routes to controller based on `type` and `action`
3. **Controller processes** → Returns response or broadcasts to other clients
4. **Cross-worker messages** → Published via Redis, received by all workers

## Configuration

### WebSocket Server Configuration

```typescript
const config = {
  webSocket: {
    enabled: true,
    type: 'server', // 'server' or 'client'
    host: '0.0.0.0',
    url: 'ws://localhost:3000/ws',

    // Controllers and routing
    controllersDirectory: './src/websocket/controllers',
    routes: [
      {
        type: 'chat', // Message type
        action: 'send', // Message action
        controllerName: 'chat', // Controller file name
        controller: ChatController, // Optional: direct class reference
      },
    ],

    // Debug options
    debug: {
      printRoutes: true, // Log registered routes on startup
    },

    // Room configuration
    rooms: {
      clientCanJoinMultipleRooms: true, // Allow clients in multiple rooms
    },

    // Inactive client management
    disconnectInactiveClients: {
      enabled: true,
      inactiveTime: 300000, // 5 minutes in milliseconds
      intervalCheckTime: 60000, // Check every minute
      log: false, // Log disconnections
    },

    // Event handlers
    events: {
      onServerStarted: ({ webSocketServer }) => {
        console.log('WebSocket server started');
      },
      onConnected: ({ ws, clientId }) => {
        console.log(`Client ${clientId} connected`);
      },
      onDisconnected: ({ clientId }) => {
        console.log(`Client ${clientId} disconnected`);
      },
      onMessage: ({ ws, clientId, data }) => {
        console.log(`Message from ${clientId}:`, data);
      },
      onError: ({ error }) => {
        console.error('WebSocket error:', error);
      },
    },

    subscriberHandlers: {
      directory: path.join(baseDir, 'websocket', 'subscribers'),
    },
  },
};
```

## Server-Side Implementation

### Creating a WebSocket Controller

Controllers organize your WebSocket message handlers:

```typescript
// src/websocket/controllers/chat.controller.ts
import { WebSocketServerBaseController } from '@scpxl/nodejs-framework/websocket';
import type { WebSocket } from 'ws';

export default class ChatController extends WebSocketServerBaseController {
  /**
   * Handle chat messages
   * Route: type: 'chat', action: 'send'
   */
  public send = (ws: WebSocket, clientId: string, data: any) => {
    const message = data?.text || '';
    const username = data?.username || 'Anonymous';

    // Broadcast to all clients
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'chat',
        action: 'message',
        data: {
          username,
          message,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Return acknowledgment to sender
    return {
      success: true,
      messageId: Date.now(),
    };
  };

  /**
   * Handle typing indicators
   * Route: type: 'chat', action: 'typing'
   */
  public typing = (ws: WebSocket, clientId: string, data: any) => {
    const username = data?.username || 'Anonymous';

    this.webSocketServer.broadcastToAllClients({
      data: {
        type: 'chat',
        action: 'userTyping',
        data: { username },
      },
      excludeClientId: clientId, // Don't send back to sender
    });

    return { success: true };
  };
}
```

### Registering Routes

```typescript
import ChatController from './controllers/chat.controller.js';

const config = {
  webSocket: {
    routes: [
      {
        type: 'chat',
        action: 'send',
        controllerName: 'chat',
        controller: ChatController,
      },
      {
        type: 'chat',
        action: 'typing',
        controllerName: 'chat',
        controller: ChatController,
      },
    ],
  },
};
```

### Sending Messages

```typescript
// Broadcast to all clients
app.websocket.server.sendMessageToAll({
  data: {
    type: 'notification',
    action: 'alert',
    data: { message: 'Server maintenance in 5 minutes' },
  },
});

// Send to specific client
const client = app.websocket.server.clientManager.getClient({
  clientId: 'some-client-id',
});
if (client?.ws) {
  app.websocket.server.sendClientMessage(client.ws, {
    type: 'private',
    action: 'message',
    data: { text: 'Hello!' },
  });
}
```

### Using WebSocket Service

The `WebSocketService` provides a higher-level API:

```typescript
import { WebSocketService } from '@scpxl/nodejs-framework/websocket';

// In your application
const wsService = new WebSocketService({
  webSocketServer: app.websocket.server,
  redisInstance: app.redis.instance,
  workerId: String(process.pid),
});

// Broadcast to all clients
await wsService.broadcast({
  type: 'notification',
  action: 'update',
  data: { message: 'New features available!' },
});

// Send to specific rooms
await wsService.sendToRooms(['room1', 'room2'], {
  type: 'chat',
  action: 'message',
  data: { text: 'Hello room members!' },
});

// Convenience methods
await wsService.sendUserMessage('profileUpdated', { userId: 123 });
await wsService.sendSystemMessage('maintenance', { minutes: 5 });
await wsService.sendErrorMessage('authFailed', new Error('Invalid token'));
```

## Client-Side Implementation

### Browser WebSocket Client

```typescript
// Frontend (Browser)
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');

  // Send a message
  ws.send(
    JSON.stringify({
      type: 'chat',
      action: 'send',
      data: {
        username: 'Alice',
        text: 'Hello everyone!',
      },
    }),
  );
};

ws.onmessage = event => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);

  // Handle different message types
  switch (message.type) {
    case 'chat':
      if (message.action === 'message') {
        displayChatMessage(message.data);
      } else if (message.action === 'userTyping') {
        showTypingIndicator(message.data.username);
      }
      break;
    case 'notification':
      showNotification(message.data.message);
      break;
  }
};

ws.onerror = error => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
  // Implement reconnection logic
};
```

### Node.js WebSocket Client

```typescript
import { WebSocketClient } from '@scpxl/nodejs-framework/websocket';

const client = new WebSocketClient({
  applicationConfig: config,
  options: {
    url: 'ws://localhost:3000/ws',
    controllersDirectory: './src/websocket/controllers/client',
    events: {
      onConnected: ({ ws, clientId }) => {
        console.log('Connected:', clientId);
      },
      onMessage: ({ data }) => {
        console.log('Received:', data);
      },
    },
  },
  redisInstance: app.redis.instance,
  queueManager: app.queue.manager,
  databaseInstance: app.database.instance,
  routes: [],
});

await client.load();
await client.connectToServer();

// Send messages
client.sendClientMessage({
  type: 'chat',
  action: 'send',
  data: { text: 'Hello from Node.js client' },
});
```

## Room Management

### Joining Rooms

Rooms allow you to group clients and broadcast messages to specific groups.

```typescript
// Server-side: Join a room
await app.websocket.server.joinRoom({
  ws: clientWebSocket,
  userId: 123,
  username: 'alice',
  userType: 'member',
  roomName: 'general',
});

// System controller (built-in)
// Clients can join rooms by sending:
// { type: 'system', action: 'joinRoom', data: { roomName: 'general', username: 'alice' } }
```

### Leaving Rooms

```typescript
// Server-side: Leave a room
app.websocket.server.leaveRoom({
  ws: clientWebSocket,
  roomName: 'general',
});

// System controller (built-in)
// Clients can leave rooms by sending:
// { type: 'system', action: 'leaveRoom', data: { roomName: 'general' } }
```

### Broadcasting to Rooms

```typescript
// Get clients in a room
const roomClients = app.websocket.server.rooms.get('general');

if (roomClients) {
  roomClients.forEach(clientId => {
    const client = app.websocket.server.clientManager.getClient({ clientId });
    if (client?.ws) {
      app.websocket.server.sendClientMessage(client.ws, {
        type: 'chat',
        action: 'message',
        data: { text: 'Room-specific message' },
      });
    }
  });
}

// Using WebSocketService
const wsService = new WebSocketService({ webSocketServer: app.websocket.server });
await wsService.sendToRooms(['general', 'announcements'], {
  type: 'announcement',
  action: 'new',
  data: { text: 'Important update!' },
});
```

### Room Configuration

```typescript
const config = {
  webSocket: {
    rooms: {
      // Allow clients to be in multiple rooms simultaneously
      clientCanJoinMultipleRooms: true,
    },
  },
};
```

When `clientCanJoinMultipleRooms: false`, joining a new room automatically removes the client from their current room.

## Authentication

### JWT Authentication

WebSocket connections can be authenticated using JWT tokens passed as query parameters:

```typescript
// Frontend: Connect with authentication
const token = 'your-jwt-token';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
```

### Server-Side Authentication

The server automatically validates JWT tokens if provided:

```typescript
const config = {
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY,
  },
  webSocket: {
    enabled: true,
    events: {
      onConnected: ({ ws, clientId }) => {
        // Access authenticated user info from client manager
        const client = app.websocket.server.clientManager.getClient({ clientId });
        const userId = client?.user?.userId;
        const userPayload = client?.user?.payload;

        console.log(`User ${userId} connected`);
      },
    },
  },
};
```

### Authentication Flow

1. Client requests WebSocket connection with `?token=<jwt>` query parameter
2. Server validates JWT using configured secret key
3. If valid, extracts user ID from token payload (`sub` claim)
4. Stores user info in client metadata
5. If invalid, connection is rejected with 401 Unauthorized

### Accessing User Data in Controllers

```typescript
export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    // Get authenticated user info
    const client = this.webSocketServer.clientManager.getClient({ clientId });
    const userId = client?.user?.userId;
    const userEmail = client?.user?.email;

    if (!userId) {
      return { error: 'Authentication required' };
    }

    // Process message with user context
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'chat',
        action: 'message',
        data: {
          userId,
          userEmail,
          message: data.text,
        },
      },
    });

    return { success: true };
  };
}
```

## Multi-Worker Coordination

When running multiple Node.js workers (cluster mode), WebSocket connections are distributed across workers. Redis pub/sub enables cross-worker communication.

### How It Works

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Worker 1  │       │   Worker 2  │       │   Worker 3  │
│  (Client A) │       │  (Client B) │       │  (Client C) │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       └─────────────┬───────┴─────────────────────┘
                     │
              ┌──────▼──────┐
              │    Redis    │
              │   Pub/Sub   │
              └─────────────┘
```

1. Client A (on Worker 1) sends a message
2. Worker 1 publishes to Redis: `WebSocketRedisSubscriberEvent.SendMessageToAll`
3. All workers (1, 2, 3) receive the Redis message
4. Each worker broadcasts to its local clients

### Automatic Events

The framework automatically coordinates these events across workers:

- `ClientConnected` - Notify all workers when a client connects
- `ClientDisconnected` - Notify all workers when a client disconnects
- `ClientJoinedRoom` - Sync room membership across workers
- `ClientLeftRoom` - Sync room changes across workers
- `SendMessageToAll` - Broadcast to all clients across all workers
- `DisconnectClient` - Request to disconnect a client (on any worker)
- `MessageError` - Forward errors to specific clients
- `QueueJobCompleted` - Notify about completed queue jobs
- `QueueJobError` - Notify about failed queue jobs
- `Custom` - Custom application events

### Custom Cross-Worker Messages

```typescript
// Send custom message across workers
app.websocket.server.sendCustomMessage({
  data: {
    type: 'custom',
    action: 'userStatusChanged',
    userId: 123,
    status: 'online',
  },
});

// src/websocket/subscribers/custom.ts
import { defineWebSocketSubscriber, WebSocketRedisSubscriberEvent } from '@scpxl/nodejs-framework/websocket';

export default defineWebSocketSubscriber({
  channel: WebSocketRedisSubscriberEvent.Custom,
  handle: ({ message, webSocketServer }) => {
    if (message.type === 'custom' && message.action === 'userStatusChanged') {
      webSocketServer.sendMessageToAll({
        data: {
          type: 'status',
          action: 'update',
          data: {
            userId: message.userId,
            status: message.status,
          },
        },
      });
    }
  },
});
```

### Subscriber Matching and Ordering

- Pick one of `channel`, `channels`, or `match` when calling `defineWebSocketSubscriber` to describe how a handler should be triggered.
- `match` accepts a string, regular expression, predicate function, or an array mixing any of those for advanced routing.
- Use `priority` to decide execution order when more than one handler matches the same payload (higher runs first).
- Add `name` and `description` so operational logs and the debug printer call out the handler you expect.

```typescript
// src/websocket/subscribers/queue-dashboard.ts
export default defineWebSocketSubscriber({
  name: 'queueDashboard',
  description: 'Forward queue updates to the live dashboard',
  channels: [WebSocketRedisSubscriberEvent.QueueJobCompleted, WebSocketRedisSubscriberEvent.QueueJobError],
  priority: 20,
  handle: ({ channel, message, webSocketServer }) => {
    webSocketServer.sendCustomMessage({
      data: {
        type: 'queue',
        action: channel === WebSocketRedisSubscriberEvent.QueueJobCompleted ? 'done' : 'errored',
        data: message,
      },
    });
  },
});
```

```typescript
// src/websocket/subscribers/segment-targeting.ts
export default defineWebSocketSubscriber({
  name: 'segmentTargeting',
  match: [/^analytics:/, ({ message }) => message?.segment === 'vip'],
  handle: ({ message, queueManager }) => {
    queueManager.add('analytics', { message });
  },
});
```

## Broadcasting Utilities

The framework provides convenient methods for broadcasting messages to different client groups.

### Broadcast to All Clients

```typescript
// Broadcast to all connected clients
app.websocket.server.broadcastToAllClients({
  data: {
    type: 'notification',
    action: 'update',
    data: { message: 'Server maintenance in 5 minutes' },
  },
});

// Broadcast to all except sender
app.websocket.server.broadcastToAllClients({
  data: {
    /* ... */
  },
  excludeClientId: sendingClientId,
});

// Broadcast with custom filtering
app.websocket.server.broadcastToAllClients({
  data: {
    /* ... */
  },
  predicate: ({ clientId, userData }) => {
    // Only broadcast to premium users
    return userData?.subscription === 'premium';
  },
});
```

### Broadcast to Room

```typescript
// Broadcast to all clients in a room
app.websocket.server.broadcastToRoom({
  roomName: 'general',
  data: {
    type: 'chat',
    action: 'message',
    data: { text: 'Welcome to general chat!' },
  },
});

// Broadcast to room excluding sender
app.websocket.server.broadcastToRoom({
  roomName: 'general',
  data: {
    /* ... */
  },
  excludeClientId: sendingClientId,
});
```

### Broadcast to Specific Users

```typescript
// Broadcast to specific user IDs
app.websocket.server.broadcastToUsers({
  userIds: [123, 456, 789],
  data: {
    type: 'notification',
    action: 'personalAlert',
    data: { message: 'This is for you!' },
  },
});
```

### Broadcast to Single Client

```typescript
// Broadcast to a specific client
app.websocket.server.broadcastToClient({
  clientId: 'specific-client-id',
  data: {
    type: 'private',
    action: 'message',
    data: { text: 'Private message' },
  },
});
```

## Subscriber Utilities

The framework provides composable utilities for building WebSocket subscriber handlers with common patterns like validation, error handling, rate limiting, and more.

### Creating Matchers

```typescript
import { matchByProperty, matchByPropertyPredicate } from '@scpxl/nodejs-framework/websocket';

// Match by exact property value
export default defineWebSocketSubscriber({
  match: matchByProperty('type', 'analytics'),
  handle: ({ message }) => {
    /* ... */
  },
});

// Match by property predicate
export default defineWebSocketSubscriber({
  match: matchByPropertyPredicate('priority', value => value > 5),
  handle: ({ message }) => {
    /* ... */
  },
});

// Combine multiple matchers
export default defineWebSocketSubscriber({
  match: [/^analytics:/, matchByProperty('userId', 123)],
  handle: ({ message }) => {
    /* ... */
  },
});
```

### Error Handling

```typescript
import { withErrorHandler } from '@scpxl/nodejs-framework/websocket';

const handler = async ({ webSocketServer, message }) => {
  // Your handler logic
};

export default defineWebSocketSubscriber({
  channel: 'custom',
  handle: withErrorHandler(handler, (error, context) => {
    console.error(`Error in channel ${context.channel}:`, error.message);
    // Send error notification to client
  }),
});
```

### Rate Limiting

```typescript
import { withRateLimit } from '@scpxl/nodejs-framework/websocket';

const handler = async ({ webSocketServer }) => {
  webSocketServer.broadcastToAllClients({
    data: {
      /* ... */
    },
  });
};

// Allow max 10 executions per 1 minute
export default defineWebSocketSubscriber({
  channel: 'updates',
  handle: withRateLimit(
    handler,
    10, // max executions
    60000, // 1 minute window
    context => {
      console.log('Rate limit exceeded for channel:', context.channel);
    },
  ),
});
```

### Retry Logic

```typescript
import { withRetry } from '@scpxl/nodejs-framework/websocket';

const handler = async ({ databaseInstance }) => {
  // Attempt database operation
  const result = await databaseInstance.query('SELECT ...');
  return result;
};

// Retry up to 3 times with 1 second delay and exponential backoff
export default defineWebSocketSubscriber({
  channel: 'database-sync',
  handle: withRetry(
    handler,
    3, // max retries
    1000, // initial delay (1 second)
    2, // backoff multiplier (exponential)
  ),
});
```

### Validation

```typescript
import { withValidation } from '@scpxl/nodejs-framework/websocket';

const handler = async ({ message, webSocketServer }) => {
  webSocketServer.broadcastToAllClients({
    data: message,
  });
};

export default defineWebSocketSubscriber({
  channel: 'messages',
  handle: withValidation(message => {
    // Validate message structure
    if (!message?.type) throw new Error('Missing type');
    if (!message?.action) throw new Error('Missing action');
    if (!message?.data) throw new Error('Missing data');
  }, handler),
});
```

### Conditional Execution

```typescript
import { withFilter } from '@scpxl/nodejs-framework/websocket';

const handler = async ({ webSocketServer, message }) => {
  // Only broadcast to authenticated users
  webSocketServer.broadcastToAllClients({
    data: message,
    predicate: ({ userData }) => !!userData?.userId,
  });
};

export default defineWebSocketSubscriber({
  channel: 'protected',
  handle: withFilter(context => {
    // Only execute if conditions are met
    return context.message?.authenticated === true;
  }, handler),
});
```

### Composing Handlers

```typescript
import { composeHandlers, withLogging, withErrorHandler, withRateLimit } from '@scpxl/nodejs-framework/websocket';

const validateMessage = async ({ message }) => {
  if (!message?.data) throw new Error('Invalid message');
};

const broadcastMessage = async ({ webSocketServer, message }) => {
  webSocketServer.broadcastToAllClients({ data: message });
};

const logMetrics = async ({ channel, message }) => {
  console.log(`Processed message on ${channel}:`, message.type);
};

export default defineWebSocketSubscriber({
  channel: 'analytics',
  handle: composeHandlers([
    withLogging(validateMessage, 'validate'),
    withLogging(broadcastMessage, 'broadcast'),
    withLogging(logMetrics, 'metrics'),
  ]),
});
```

## Subscriber Middleware

Middleware allows you to intercept and modify handler execution for cross-cutting concerns like logging, timing, and error recovery.

### Using Built-in Middleware

```typescript
import {
  defineWebSocketSubscriber,
  loggingMiddleware,
  timingMiddleware,
  rateLimitMiddleware,
} from '@scpxl/nodejs-framework/websocket';

export default defineWebSocketSubscriber({
  channels: ['updates'],
  handle: async ({ webSocketServer, message }) => {
    webSocketServer.broadcastToAllClients({
      data: message,
    });
  },
  middleware: [
    loggingMiddleware('updatesBroadcaster'),
    timingMiddleware(),
    rateLimitMiddleware(10, 60000), // 10 per minute
  ],
});
```

### Custom Middleware

```typescript
import type { WebSocketSubscriberMiddleware } from '@scpxl/nodejs-framework/websocket';

const authenticationMiddleware: WebSocketSubscriberMiddleware = {
  name: 'authentication',
  onBefore: async context => {
    // Check if message is authenticated
    const isAuthenticated = context.message?.authenticated === true;
    if (!isAuthenticated) {
      console.warn('Unauthenticated message on channel:', context.channel);
      return false; // Skip handler execution
    }
    return true; // Proceed with handler
  },
};

const metricsMiddleware: WebSocketSubscriberMiddleware = {
  name: 'metrics',
  onAfter: async (context, result) => {
    // Record metrics after successful execution
    console.log('Handler executed successfully', {
      channel: context.channel,
      resultType: typeof result,
    });
  },
  onError: async (context, error) => {
    // Handle errors
    console.error('Handler error:', error.message);
    return false; // Don't suppress the error
  },
};

export default defineWebSocketSubscriber({
  channels: ['secure-updates'],
  handle: async ({ webSocketServer, message }) => {
    webSocketServer.broadcastToAllClients({
      data: message,
    });
  },
  middleware: [authenticationMiddleware, metricsMiddleware],
});
```

### Middleware Execution Flow

Middleware executes in three phases:

1. **Before** - Runs before the handler, can skip handler execution
2. **Handler** - Your subscriber handler runs here
3. **After** - Runs after successful execution
4. **Error** - Runs if handler throws, can suppress or propagate error

```typescript
interface WebSocketSubscriberMiddleware {
  name: string;

  // Called before handler (can return false to skip handler)
  onBefore?: (context) => boolean | Promise<boolean>;

  // Called after successful handler execution
  onAfter?: (context, result) => void | Promise<void>;

  // Called if handler throws (return true to suppress error)
  onError?: (context, error) => boolean | Promise<boolean>;
}
```

## Advanced Features

### Inactive Client Management

Automatically disconnect clients that haven't sent messages within a timeout period:

```typescript
const config = {
  webSocket: {
    disconnectInactiveClients: {
      enabled: true,
      inactiveTime: 300000, // 5 minutes
      intervalCheckTime: 60000, // Check every minute
      log: true, // Log disconnections
    },
  },
};
```

How it works:

1. Each client has a `lastActivity` timestamp updated on every message
2. Periodic check runs at `intervalCheckTime` interval
3. Clients inactive longer than `inactiveTime` are disconnected
4. Useful for cleaning up abandoned connections

### Client Metadata

Store custom data with each client:

```typescript
// Get client
const client = app.websocket.server.clientManager.getClient({ clientId });

// Update client metadata
app.websocket.server.clientManager.updateClient({
  clientId,
  key: 'preferences',
  data: { theme: 'dark', notifications: true },
});

// Access metadata in controllers
export default class UserController extends WebSocketServerBaseController {
  public updatePreferences = (ws: WebSocket, clientId: string, data: any) => {
    this.webSocketServer.clientManager.updateClient({
      clientId,
      key: 'preferences',
      data,
    });

    return { success: true };
  };
}
```

### Performance Monitoring

WebSocket connections are tracked in the performance monitoring system:

```typescript
const config = {
  performanceMonitoring: {
    enabled: true,
  },
};

// Access WebSocket performance data
app.performance.getWebSocketHealth();
// Returns: { status: 'healthy', activeConnections: 42, rooms: 5, ... }
```

### Graceful Shutdown

WebSocket servers automatically handle graceful shutdown:

```typescript
// Cleanup happens automatically on app.stop()
await app.stop();

// The framework will:
// 1. Stop accepting new connections
// 2. Close all client connections gracefully
// 3. Unsubscribe from Redis events
// 4. Clean up intervals and timers
// 5. Reset managers and state
```

## Best Practices

### 1. Message Protocol

Define a consistent message structure:

```typescript
interface WebSocketMessage {
  type: string; // Category: 'chat', 'notification', 'system'
  action: string; // Specific action: 'send', 'typing', 'update'
  data?: any; // Payload
}
```

### 2. Error Handling

Always handle errors in controllers:

```typescript
export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    try {
      // Validate input
      if (!data?.text || typeof data.text !== 'string') {
        return {
          error: 'Invalid message format',
          code: 'INVALID_MESSAGE',
        };
      }

      // Process message
      this.webSocketServer.sendMessageToAll({
        data: {
          /* ... */
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error in chat.send:', error);
      return {
        error: 'Failed to send message',
        code: 'SEND_ERROR',
      };
    }
  };
}
```

### 3. Authentication

Always authenticate sensitive operations:

```typescript
export default class AdminController extends WebSocketServerBaseController {
  public broadcast = (ws: WebSocket, clientId: string, data: any) => {
    const client = this.webSocketServer.clientManager.getClient({ clientId });
    const userRole = client?.user?.payload?.role;

    if (userRole !== 'admin') {
      return { error: 'Unauthorized', code: 'FORBIDDEN' };
    }

    // Admin-only logic
    this.webSocketServer.sendMessageToAll({ data });
    return { success: true };
  };
}
```

### 4. Room Naming

Use consistent, hierarchical room names:

```typescript
// Good
'chat:general';
'chat:support';
'game:lobby:1';
'notifications:user:123';

// Avoid
'room1';
'lobby';
'general_chat';
```

### 5. Connection Management

Implement reconnection logic on the client:

```typescript
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      console.log('Disconnected');
      this.reconnect(url);
    };

    this.ws.onerror = error => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => this.connect(url), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
}
```

### 6. Rate Limiting

Prevent message flooding:

```typescript
export default class ChatController extends WebSocketServerBaseController {
  private messageRateLimits = new Map<string, { count: number; resetAt: number }>();

  public send = (ws: WebSocket, clientId: string, data: any) => {
    // Check rate limit
    const limit = this.messageRateLimits.get(clientId);
    const now = Date.now();

    if (limit) {
      if (now < limit.resetAt) {
        if (limit.count >= 10) {
          return { error: 'Rate limit exceeded', code: 'RATE_LIMIT' };
        }
        limit.count++;
      } else {
        limit.count = 1;
        limit.resetAt = now + 60000; // 1 minute
      }
    } else {
      this.messageRateLimits.set(clientId, { count: 1, resetAt: now + 60000 });
    }

    // Process message
    this.webSocketServer.sendMessageToAll({ data });
    return { success: true };
  };
}
```

### 7. Logging

Log important events:

```typescript
import { Logger } from '@scpxl/nodejs-framework/logger';

export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    const client = this.webSocketServer.clientManager.getClient({ clientId });

    Logger.info({
      message: 'Chat message sent',
      meta: {
        clientId,
        userId: client?.user?.userId,
        messageLength: data?.text?.length,
      },
    });

    this.webSocketServer.sendMessageToAll({ data });
    return { success: true };
  };
}
```

## Troubleshooting

### Connection Refused

**Problem**: Client cannot connect to WebSocket server

**Solutions**:

- Verify server is running: `lsof -i :3000`
- Check firewall settings
- Ensure correct URL scheme (`ws://` or `wss://`)
- Verify CORS settings if connecting from browser

### Authentication Failed

**Problem**: Connection rejected with 401 Unauthorized

**Solutions**:

- Verify JWT secret key is configured correctly
- Check token expiration
- Ensure token is in query parameter: `?token=<jwt>`
- Validate token claims (must have `sub` for user ID)

```typescript
// Debug token validation
const config = {
  webSocket: {
    events: {
      onConnected: ({ ws, clientId }) => {
        const client = app.websocket.server.clientManager.getClient({ clientId });
        console.log('Authenticated user:', client?.user);
      },
    },
  },
};
```

### Messages Not Received Across Workers

**Problem**: Messages sent from one worker not received by clients on other workers

**Solutions**:

- Verify Redis is running and configured correctly
- Check Redis pub/sub is working: `redis-cli MONITOR`
- Ensure all workers connect to same Redis instance
- Verify `workerId` is unique per worker

```typescript
// Debug Redis pub/sub
const config = {
  webSocket: {
    subscriberHandlers: {
      handlers: [
        {
          channels: ['*'],
          handle: ({ channel, message }) => {
            console.log('Redis event received:', channel, message);
          },
        },
      ],
    },
  },
};
```

### Room Messages Not Delivered

**Problem**: Messages sent to room not received by room members

**Solutions**:

- Verify client joined room successfully
- Check room exists: `app.websocket.server.rooms.get('room-name')`
- Ensure client ID is in room's client set
- Verify room name matches exactly (case-sensitive)

```typescript
// Debug room membership
app.websocket.server.roomManager.printRooms();
```

### Memory Leaks

**Problem**: Memory usage increases over time

**Solutions**:

- Enable inactive client disconnection
- Implement cleanup in event handlers
- Remove event listeners on disconnect
- Clear rate limit maps periodically

```typescript
// Clean up rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, limit] of this.messageRateLimits.entries()) {
    if (now > limit.resetAt + 3600000) {
      // 1 hour old
      this.messageRateLimits.delete(clientId);
    }
  }
}, 600000); // Every 10 minutes
```

### High Latency

**Problem**: Slow message delivery

**Solutions**:

- Check Redis latency: `redis-cli --latency`
- Monitor network conditions
- Reduce message size
- Implement message batching
- Use rooms to limit broadcast scope

```typescript
// Batch messages
const messageQueue: any[] = [];
setInterval(() => {
  if (messageQueue.length > 0) {
    app.websocket.server.sendMessageToAll({
      data: {
        type: 'batch',
        action: 'messages',
        data: messageQueue.splice(0),
      },
    });
  }
}, 100); // Send every 100ms
```

### Connection Drops

**Problem**: Clients frequently disconnected

**Solutions**:

- Implement heartbeat/ping-pong
- Increase inactive timeout
- Check network stability
- Implement reconnection logic on client

```typescript
// Server heartbeat
setInterval(() => {
  app.websocket.server.sendMessageToAll({
    data: { type: 'system', action: 'ping' },
  });
}, 30000); // Every 30 seconds

// Client response
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.type === 'system' && message.action === 'ping') {
    ws.send(JSON.stringify({ type: 'system', action: 'pong' }));
  }
};
```

## Related Documentation

- [WebSocket API Reference](../api/websocket.md)
- [WebSocket Concepts](../concepts/websocket.md)
- [Authentication Guide](./authentication.md)
- [Performance Monitoring](./performance-monitoring.md)
- [Hello World Example](https://github.com/PXLbros/pxl-nodejs-framework/tree/main/examples/hello-world)
