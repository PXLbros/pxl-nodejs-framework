# WebSocket Concepts

The PXL Framework's WebSocket module provides real-time, bidirectional communication between server and clients with enterprise features like room-based messaging, authentication, and multi-worker coordination.

## Core Concepts

### Message-Based Architecture

WebSocket communication is organized around structured messages with a consistent protocol:

```typescript
{
  type: string;      // Message category (e.g., 'chat', 'notification', 'system')
  action: string;    // Specific action (e.g., 'send', 'update', 'delete')
  data?: any;        // Optional payload
}
```

This structure enables:

- **Controller-based routing**: Messages are routed to specific controller methods based on `type` and `action`
- **Type safety**: Predictable message format for both client and server
- **Scalability**: Easy to add new message types without breaking existing code

### Client Management

The WebSocket server maintains a registry of connected clients with:

- **Unique Client IDs**: Auto-generated identifier for each connection
- **User Metadata**: Store authenticated user info (from JWT) and custom data
- **Connection State**: Track connection status and last activity
- **WebSocket Reference**: Direct access to underlying WebSocket connection (when on same worker)

```typescript
// Client structure
{
  clientId: string;
  ws: WebSocket | null;  // null if on different worker
  lastActivity: number;
  user?: {
    userId: number;
    payload: Record<string, unknown>;
  };
  roomName?: string | null;
  // ... custom metadata
}
```

### Room-Based Messaging

Rooms group clients together for targeted broadcasts, similar to channels or topics:

```
Room: "chat:general"
├── Client A (User 1)
├── Client B (User 2)
└── Client C (User 3)

Room: "game:lobby:5"
├── Client D (User 4)
└── Client E (User 5)
```

**Key Features**:

- Clients can join/leave rooms dynamically
- Broadcast messages to all room members
- Room membership synced across workers via Redis
- Optional multi-room support (clients in multiple rooms simultaneously)

### Multi-Worker Coordination

In cluster mode, WebSocket connections are distributed across workers. Redis pub/sub enables coordination:

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Worker 1  │       │   Worker 2  │       │   Worker 3  │
│  Client A   │       │  Client B   │       │  Client C   │
│  Client D   │       │  Client E   │       │  Client F   │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                      ┌──────▼──────┐
                      │    Redis    │
                      │   Pub/Sub   │
                      └─────────────┘
```

**How it works**:

1. Worker 1 receives a message from Client A
2. Worker 1 publishes to Redis with event type `SendMessageToAll`
3. All workers (1, 2, 3) receive the Redis event
4. Each worker broadcasts to its local clients (A, D on Worker 1; B, E on Worker 2; C, F on Worker 3)

**Synchronized Events**:

- Client connect/disconnect notifications
- Room join/leave operations
- Cross-worker broadcasts
- Client metadata updates

### Controller-Based Routing

Messages are routed to controller methods based on type and action:

```typescript
// Route definition
{
  type: 'chat',
  action: 'send',
  controllerName: 'chat',
  controller: ChatController
}

// Incoming message
{
  type: 'chat',
  action: 'send',
  data: { text: 'Hello!' }
}

// Routes to: ChatController.send()
```

Controllers inherit from `WebSocketServerBaseController` and have access to:

- `webSocketServer`: Send messages, manage clients
- `redisInstance`: Direct Redis access
- `queueManager`: Enqueue background jobs
- `databaseInstance`: Database operations

### Authentication Flow

JWT tokens authenticate WebSocket connections:

```
1. Client requests: ws://server/ws?token=<jwt>
2. Server validates JWT using configured secret
3. Extract user info from token (userId from 'sub' claim)
4. Store in client metadata: { userId, payload }
5. If invalid → reject with 401 Unauthorized
```

Authenticated user info is available in all controller methods:

```typescript
const client = this.webSocketServer.clientManager.getClient({ clientId });
const userId = client?.user?.userId;
const userRole = client?.user?.payload?.role;
```

### Lifecycle Management

WebSocket servers follow the application lifecycle:

```
1. Configure: Load routes and controllers
2. Start: Initialize WebSocket server, subscribe to Redis events
3. Runtime: Handle connections, route messages, coordinate across workers
4. Shutdown: Close connections gracefully, unsubscribe from Redis, cleanup
```

**Graceful Shutdown**:

- Stop accepting new connections
- Close all client WebSocket connections
- Unsubscribe from all Redis events
- Clean up intervals and timers
- Reset client and room managers

### Inactive Client Management

Automatically clean up abandoned connections:

1. Track `lastActivity` timestamp per client (updated on each message)
2. Periodic check runs at configured interval (e.g., every 60 seconds)
3. Clients inactive longer than threshold (e.g., 5 minutes) are disconnected
4. Frees server resources and prevents memory leaks

### Performance Monitoring

WebSocket health is tracked in the performance monitoring system:

- **Active Connections**: Current connected client count
- **Rooms**: Number of active rooms
- **Message Throughput**: Messages per second
- **Connection Events**: Connect/disconnect rates

## Architecture Patterns

### Event-Driven Communication

```typescript
// Server broadcasts event
websocket.sendMessageToAll({
  data: {
    type: 'user',
    action: 'statusChanged',
    data: { userId: 123, status: 'online' },
  },
});

// Clients listen and react
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'user' && msg.action === 'statusChanged') {
    updateUserStatus(msg.data.userId, msg.data.status);
  }
};
```

### Request-Response Pattern

```typescript
// Client sends request
ws.send(
  JSON.stringify({
    type: 'user',
    action: 'getProfile',
    data: { userId: 123 },
  }),
);

// Server controller processes and responds
export default class UserController extends WebSocketServerBaseController {
  public async getProfile(ws: WebSocket, clientId: string, data: any) {
    const profile = await this.fetchUserProfile(data.userId);

    // Response sent back to requesting client
    return {
      success: true,
      profile,
    };
  }
}
```

### Publish-Subscribe with Rooms

```typescript
// Clients subscribe by joining room
ws.send(
  JSON.stringify({
    type: 'system',
    action: 'joinRoom',
    data: { roomName: 'stock:AAPL' },
  }),
);

// Server publishes updates to room subscribers
const room = websocket.rooms.get('stock:AAPL');
room?.forEach(clientId => {
  const client = websocket.clientManager.getClient({ clientId });
  if (client?.ws) {
    websocket.sendClientMessage(client.ws, {
      type: 'stock',
      action: 'priceUpdate',
      data: { symbol: 'AAPL', price: 150.25 },
    });
  }
});
```

## Design Principles

1. **Separation of Concerns**: Controllers handle business logic, managers handle infrastructure
2. **Scalability First**: Redis pub/sub enables horizontal scaling across workers
3. **Type Safety**: Structured messages with consistent protocol
4. **Fault Tolerance**: Graceful degradation, automatic cleanup, error handling
5. **Developer Experience**: Intuitive API, comprehensive events, debugging support

## Common Use Cases

- **Chat Applications**: Real-time messaging with rooms and presence
- **Live Updates**: Dashboard metrics, notifications, feed updates
- **Collaborative Editing**: Simultaneous document editing
- **Gaming**: Multiplayer game state synchronization
- **IoT/Monitoring**: Device status streaming, sensor data
- **Trading/Finance**: Live market data, order updates

## Learn More

- [WebSocket Guide](../guides/websocket.md) - Comprehensive implementation guide
- [WebSocket API Reference](../api/websocket.md) - Complete API documentation
- [Hello World Example](https://github.com/PXLbros/pxl-nodejs-framework/tree/main/examples/hello-world) - Working example with Vue 3 frontend
