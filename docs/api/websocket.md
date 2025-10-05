# WebSocket API Reference

Complete API reference for the PXL Framework WebSocket module.

## Table of Contents

- [WebSocketServer](#websocketserver)
- [WebSocketClient](#websocketclient)
- [WebSocketService](#websocketservice)
- [WebSocketClientManager](#websocketclientmanager)
- [WebSocketRoomManager](#websocketroommanager)
- [Controllers](#controllers)
- [Configuration Interfaces](#configuration-interfaces)

## WebSocketServer

Server-side WebSocket management with room support and multi-worker coordination.

### Properties

#### `clientManager`

```typescript
public clientManager: WebSocketClientManager
```

Manages connected clients and their metadata.

#### `rooms`

```typescript
public get rooms(): Map<string, Set<string>>
```

Map of room names to sets of client IDs in each room.

#### `type`

```typescript
public get type(): WebSocketType // Returns 'server'
```

Identifies this as a server-type WebSocket instance.

### Methods

#### `load()`

```typescript
public async load(): Promise<void>
```

Load and configure WebSocket routes and controllers. Must be called before `start()`.

#### `start()`

```typescript
public async start({ fastifyServer }: { fastifyServer: FastifyInstance }): Promise<{ server: WS }>
```

Start the WebSocket server and attach to Fastify HTTP server.

**Parameters:**

- `fastifyServer`: Fastify instance to attach WebSocket upgrade handler

**Returns:** Object containing the WebSocket server instance

**Example:**

```typescript
const { server } = await app.websocket.server.start({
  fastifyServer: app.webserver.server,
});
```

#### `stop()`

```typescript
public async stop(): Promise<void>
```

Gracefully stop the WebSocket server:

- Abort ongoing operations
- Clean up Redis subscribers
- Close all client connections
- Reset managers

#### `joinRoom()`

```typescript
public async joinRoom({
  ws,
  userId,
  userType,
  username,
  roomName,
}: {
  ws: WebSocket;
  userId?: number;
  userType?: string;
  username?: string;
  roomName: string;
}): Promise<boolean>
```

Add a client to a room with optional user data.

**Parameters:**

- `ws`: WebSocket connection
- `userId`: Optional user ID (will fetch user data from database)
- `userType`: Optional user type/role
- `username`: Optional display name
- `roomName`: Name of room to join

**Returns:** `true` on success

**Example:**

```typescript
await websocket.joinRoom({
  ws: clientSocket,
  userId: 123,
  username: 'Alice',
  userType: 'member',
  roomName: 'chat:general',
});
```

#### `leaveRoom()`

```typescript
public leaveRoom({ ws, roomName }: { ws: WebSocket; roomName: string }): void
```

Remove a client from a room.

**Parameters:**

- `ws`: WebSocket connection
- `roomName`: Name of room to leave

#### `sendClientMessage()`

```typescript
public sendClientMessage(ws: WebSocket, data: unknown, binary?: boolean): void
```

Send a message to a specific client.

**Parameters:**

- `ws`: WebSocket connection
- `data`: Message data (will be JSON stringified)
- `binary`: Optional, send as binary (default: false)

**Example:**

```typescript
websocket.sendClientMessage(ws, {
  type: 'notification',
  action: 'alert',
  data: { message: 'Welcome!' },
});
```

#### `sendMessage()`

```typescript
public sendMessage({ data }: { data: unknown }): void
```

Send a message via Redis pub/sub (for cross-worker messaging).

**Parameters:**

- `data`: Message data to publish

#### `sendMessageToAll()`

```typescript
public sendMessageToAll({ data }: { data: unknown }): void
```

Broadcast a message to all connected clients across all workers.

**Parameters:**

- `data`: Message data to broadcast

**Example:**

```typescript
websocket.sendMessageToAll({
  data: {
    type: 'announcement',
    action: 'new',
    data: { text: 'System maintenance in 10 minutes' },
  },
});
```

#### `sendCustomMessage()`

```typescript
public sendCustomMessage({ data }: { data: unknown }): void
```

Send a custom message via Redis pub/sub for application-specific cross-worker communication.

**Parameters:**

- `data`: Custom message data

#### `broadcastToAllClients()`

```typescript
public broadcastToAllClients({
  data,
  excludeClientId,
}: {
  data: { [key: string]: any };
  excludeClientId?: string;
}): void
```

Broadcast to all clients connected to this worker instance.

**Parameters:**

- `data`: Message data
- `excludeClientId`: Optional client ID to exclude from broadcast

#### `sendMessageError()`

```typescript
public sendMessageError({
  webSocketClientId,
  error,
}: {
  webSocketClientId: string;
  error: string;
}): void
```

Send an error message to a specific client (works across workers via Redis).

**Parameters:**

- `webSocketClientId`: Target client ID
- `error`: Error message

#### `getClients()`

```typescript
public getClients({ userType }: { userType?: string }): any[]
```

Get list of clients, optionally filtered by user type.

**Parameters:**

- `userType`: Optional user type filter

**Returns:** Array of client objects

## WebSocketClient

Client-side WebSocket connection manager.

### Properties

#### `type`

```typescript
public get type(): WebSocketType // Returns 'client'
```

Identifies this as a client-type WebSocket instance.

### Methods

#### `load()`

```typescript
public async load(): Promise<void>
```

Load and configure client-side routes and controllers.

#### `connectToServer()`

```typescript
public async connectToServer(): Promise<void>
```

Establish connection to WebSocket server.

**Example:**

```typescript
const client = new WebSocketClient(config);
await client.load();
await client.connectToServer();
```

#### `disconnect()`

```typescript
public disconnect(): void
```

Disconnect from server and clean up resources.

#### `isClientConnected()`

```typescript
public isClientConnected(): boolean
```

Check if client is currently connected.

**Returns:** `true` if connected and ready

#### `sendClientMessage()`

```typescript
public sendClientMessage(data: unknown, binary?: boolean): void
```

Send a message to the server.

**Parameters:**

- `data`: Message data (will be JSON stringified)
- `binary`: Optional, send as binary (default: false)

**Example:**

```typescript
client.sendClientMessage({
  type: 'chat',
  action: 'send',
  data: { text: 'Hello server!' },
});
```

#### `sendMessage()`

```typescript
public sendMessage(data: unknown): void
```

Alias for `sendClientMessage()`.

## WebSocketService

High-level service for simplified WebSocket messaging.

### Constructor

```typescript
constructor(options: WebSocketServiceOptions)
```

**Options:**

```typescript
interface WebSocketServiceOptions {
  webSocketServer?: WebSocketServer;
  redisInstance?: RedisInstance;
  workerId?: string;
}
```

### Methods

#### `broadcast()`

```typescript
async broadcast(message: WebSocketMessage): Promise<void>
```

Broadcast a message to all connected clients.

**Parameters:**

- `message`: Message object with `type`, `action`, and optional `data`

**Example:**

```typescript
const service = new WebSocketService({
  webSocketServer: app.websocket.server,
  redisInstance: app.redis.instance,
  workerId: String(process.pid),
});

await service.broadcast({
  type: 'notification',
  action: 'update',
  data: { message: 'New version available' },
});
```

#### `sendToClients()`

```typescript
async sendToClients(
  clientIds: string[],
  message: WebSocketMessage
): Promise<void>
```

Send a message to specific clients by ID.

**Parameters:**

- `clientIds`: Array of client IDs
- `message`: Message to send

**Note:** Currently broadcasts to all clients. Room-specific sending is available via `sendToRooms()`.

#### `sendToRooms()`

```typescript
async sendToRooms(
  roomNames: string[],
  message: WebSocketMessage
): Promise<void>
```

Send a message to all clients in specified rooms.

**Parameters:**

- `roomNames`: Array of room names
- `message`: Message to send

**Example:**

```typescript
await service.sendToRooms(['vip', 'moderators'], {
  type: 'admin',
  action: 'alert',
  data: { message: 'Review pending content' },
});
```

#### `sendUserMessage()`

```typescript
async sendUserMessage(action: string, data: any): Promise<void>
```

Convenience method for user-type messages.

**Parameters:**

- `action`: Message action
- `data`: Message data

**Example:**

```typescript
await service.sendUserMessage('profileUpdated', {
  userId: 123,
  changes: ['avatar', 'bio'],
});
```

#### `sendSystemMessage()`

```typescript
async sendSystemMessage(action: string, data: any): Promise<void>
```

Convenience method for system-type messages.

**Parameters:**

- `action`: Message action
- `data`: Message data

#### `sendErrorMessage()`

```typescript
async sendErrorMessage(action: string, error: any): Promise<void>
```

Convenience method for error messages.

**Parameters:**

- `action`: Error action
- `error`: Error object or details

## WebSocketClientManager

Manages connected WebSocket clients and their metadata.

### Methods

#### `addClient()`

```typescript
public addClient({
  clientId,
  ws,
  lastActivity,
  user,
}: {
  clientId: string;
  ws: WebSocket | null;
  lastActivity: number;
  user?: { userId: number; payload: any } | null;
}): void
```

Add a client to the registry.

**Parameters:**

- `clientId`: Unique client identifier
- `ws`: WebSocket connection (null if on different worker)
- `lastActivity`: Timestamp of last activity
- `user`: Optional authenticated user data

#### `removeClient()`

```typescript
public removeClient(clientId: string): void
```

Remove a client from the registry.

#### `getClient()`

```typescript
public getClient({
  clientId,
  requireWs,
}: {
  clientId: string;
  requireWs?: boolean;
}): WebSocketClient | undefined
```

Get a client by ID.

**Parameters:**

- `clientId`: Client identifier
- `requireWs`: If true, only return if WebSocket connection is available

**Returns:** Client object or undefined

#### `getClientId()`

```typescript
public getClientId({ ws }: { ws: WebSocket }): string | undefined
```

Get client ID from WebSocket connection.

**Returns:** Client ID or undefined

#### `getClients()`

```typescript
public getClients({ userType }: { userType?: string } = {}): WebSocketClient[]
```

Get all clients, optionally filtered by user type.

**Parameters:**

- `userType`: Optional user type filter

**Returns:** Array of client objects

#### `updateClient()`

```typescript
public updateClient({
  clientId,
  key,
  data,
}: {
  clientId: string;
  key: string;
  data: any;
}): void
```

Update client metadata.

**Parameters:**

- `clientId`: Client identifier
- `key`: Metadata key to update
- `data`: New value

**Example:**

```typescript
clientManager.updateClient({
  clientId: 'abc123',
  key: 'preferences',
  data: { theme: 'dark', notifications: true },
});
```

#### `disconnectClient()`

```typescript
public disconnectClient({
  clientId,
  code,
  reason,
}: {
  clientId: string;
  code?: number;
  reason?: string;
}): void
```

Disconnect a client.

**Parameters:**

- `clientId`: Client to disconnect
- `code`: Optional WebSocket close code
- `reason`: Optional close reason

#### `broadcastClientList()`

```typescript
public broadcastClientList(event?: string): void
```

Broadcast updated client list to all clients (internal use).

#### `cleanup()`

```typescript
public cleanup(): void
```

Clean up all clients and reset state.

## WebSocketRoomManager

Manages WebSocket rooms and client membership.

### Properties

#### `rooms`

```typescript
public rooms: Map<string, Set<string>>
```

Map of room names to sets of client IDs.

### Methods

#### `addClientToRoom()`

```typescript
public addClientToRoom({
  clientId,
  user,
  roomName,
  broadcast,
}: {
  clientId: string;
  user: any;
  roomName: string;
  broadcast?: boolean;
}): void
```

Add a client to a room.

**Parameters:**

- `clientId`: Client identifier
- `user`: User data
- `roomName`: Room to join
- `broadcast`: Whether to broadcast client list update (default: true)

#### `removeClientFromRoom()`

```typescript
public removeClientFromRoom({
  roomName,
  clientId,
  broadcast,
}: {
  roomName: string;
  clientId: string;
  broadcast?: boolean;
}): void
```

Remove a client from a room.

**Parameters:**

- `roomName`: Room to leave
- `clientId`: Client identifier
- `broadcast`: Whether to broadcast client list update (default: true)

#### `removeClientFromAllRooms()`

```typescript
public removeClientFromAllRooms({ clientId }: { clientId: string }): void
```

Remove a client from all rooms.

#### `isClientInRoom()`

```typescript
public isClientInRoom({
  clientId,
  roomName,
}: {
  clientId: string;
  roomName: string;
}): boolean
```

Check if a client is in a specific room.

**Returns:** `true` if client is in room

#### `getRoomClients()`

```typescript
public getRoomClients({ roomName }: { roomName: string }): string[]
```

Get all client IDs in a room.

**Returns:** Array of client IDs

#### `printRooms()`

```typescript
public printRooms(): void
```

Print room information to console (for debugging).

#### `cleanup()`

```typescript
public cleanup(): void
```

Clean up all rooms and reset state.

## Controllers

### WebSocketServerBaseController

Base class for server-side WebSocket controllers.

```typescript
export default abstract class WebSocketServerBaseController {
  protected webSocketServer: WebSocketServer;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor(params: WebSocketServerBaseControllerConstructorParams);
}
```

**Properties:**

- `webSocketServer`: Access to WebSocket server
- `redisInstance`: Redis client
- `queueManager`: Queue management
- `databaseInstance`: Database access

**Example:**

```typescript
import { WebSocketServerBaseController } from '@scpxl/nodejs-framework/websocket';

export default class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    // Access injected dependencies
    const userId = this.getUserId(clientId);

    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'chat',
        action: 'message',
        data: { userId, text: data.text },
      },
    });

    return { success: true };
  };

  private getUserId(clientId: string): number | undefined {
    const client = this.webSocketServer.clientManager.getClient({ clientId });
    return client?.user?.userId;
  }
}
```

### WebSocketClientBaseController

Base class for client-side WebSocket controllers.

```typescript
export default abstract class WebSocketClientBaseController {
  protected sendMessage: (data: unknown) => void;
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor(params: WebSocketClientBaseControllerConstructorParams);
}
```

**Properties:**

- `sendMessage`: Function to send messages to server
- `redisInstance`: Redis client
- `queueManager`: Queue management
- `databaseInstance`: Database access

## Configuration Interfaces

### WebSocketOptions

```typescript
interface WebSocketOptions {
  enabled: boolean;
  type: 'server' | 'client';
  host?: string;
  url: string;
  controllersDirectory: string;

  routes?: WebSocketRoute[];

  debug?: {
    printRoutes?: boolean;
  };

  rooms?: {
    clientCanJoinMultipleRooms?: boolean;
  };

  disconnectInactiveClients?: {
    enabled: boolean;
    inactiveTime?: number; // milliseconds
    intervalCheckTime?: number; // milliseconds
    log?: boolean;
  };

  events?: {
    onServerStarted?: (params: { webSocketServer: WS }) => void;

    onConnected?: (params: {
      ws: WebSocket;
      clientId: string;
      joinRoom?: (params: { userId?: string; userType?: string; username: string; roomName: string }) => void;
    }) => void;

    onDisconnected?: (params: { clientId?: string }) => void;

    onMessage?: (params: {
      ws: WebSocket;
      clientId: string;
      data: { type: string; action: string; data: unknown };
      redisInstance: RedisInstance;
      queueManager: QueueManager;
      databaseInstance: DatabaseInstance;
    }) => void;

    onError?: (params: { error: Error }) => void;
  };

  subscriberEventHandler?: (params: {
    channel: string;
    message: any;
    webSocketServer: WebSocketServer;
    databaseInstance: DatabaseInstance;
  }) => void;
}
```

### WebSocketRoute

```typescript
interface WebSocketRoute {
  type: string; // Message type (e.g., 'chat', 'notification')
  action: string; // Message action (e.g., 'send', 'update')
  controllerName: string; // Controller file name (without extension)
  controller?: any; // Optional: direct controller class reference
}
```

### WebSocketMessage

```typescript
interface WebSocketMessage {
  type: string; // Message type/category
  action: string; // Specific action
  data?: any; // Optional payload
}
```

### WebSocketRedisSubscriberEvent

Enum of Redis pub/sub event names for cross-worker coordination:

```typescript
enum WebSocketRedisSubscriberEvent {
  ClientConnected = 'WebSocket:ClientConnected',
  ClientDisconnected = 'WebSocket:ClientDisconnected',
  ClientJoinedRoom = 'WebSocket:ClientJoinedRoom',
  ClientLeftRoom = 'WebSocket:ClientLeftRoom',
  DisconnectClient = 'WebSocket:DisconnectClient',
  SendMessage = 'WebSocket:SendMessage',
  SendMessageToAll = 'WebSocket:SendMessageToAll',
  MessageError = 'WebSocket:MessageError',
  QueueJobCompleted = 'WebSocket:QueueJobCompleted',
  QueueJobError = 'WebSocket:QueueJobError',
  Custom = 'WebSocket:Custom',
}
```

## Type Definitions

### WebSocketClient

```typescript
interface WebSocketClient {
  clientId: string;
  ws: WebSocket | null;
  lastActivity: number;
  user?: {
    userId: number;
    payload: Record<string, unknown>;
  } | null;
  roomName?: string | null;
  [key: string]: any; // Custom metadata
}
```

### WebSocketType

```typescript
type WebSocketType = 'server' | 'client';
```

## Usage Examples

### Basic Server Setup

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  webSocket: {
    enabled: true,
    type: 'server',
    url: 'ws://localhost:3000/ws',
    controllersDirectory: './src/websocket/controllers',
    routes: [
      {
        type: 'chat',
        action: 'send',
        controllerName: 'chat',
      },
    ],
  },
  redis: { host: '127.0.0.1', port: 6379 },
});

await app.start();
```

### Using WebSocketService

```typescript
import { WebSocketService } from '@scpxl/nodejs-framework/websocket';

const wsService = new WebSocketService({
  webSocketServer: app.websocket.server,
  redisInstance: app.redis.instance,
  workerId: String(process.pid),
});

// Broadcast to all
await wsService.broadcast({
  type: 'notification',
  action: 'alert',
  data: { message: 'Server restart in 5 minutes' },
});

// Send to specific rooms
await wsService.sendToRooms(['vip', 'admin'], {
  type: 'announcement',
  action: 'new',
  data: { text: 'Early access to new features!' },
});

// Convenience methods
await wsService.sendUserMessage('statusChanged', { userId: 123, status: 'online' });
await wsService.sendSystemMessage('maintenance', { minutes: 5 });
await wsService.sendErrorMessage('invalidAction', new Error('Action not allowed'));
```

### Custom Controller

```typescript
import { WebSocketServerBaseController } from '@scpxl/nodejs-framework/websocket';
import type { WebSocket } from 'ws';

export default class GameController extends WebSocketServerBaseController {
  public move = async (ws: WebSocket, clientId: string, data: any) => {
    // Validate move
    const isValid = await this.validateMove(data);
    if (!isValid) {
      return { error: 'Invalid move' };
    }

    // Update game state in database
    await this.updateGameState(data);

    // Broadcast to room
    const client = this.webSocketServer.clientManager.getClient({ clientId });
    const roomName = client?.roomName;

    if (roomName) {
      const roomClients = this.webSocketServer.rooms.get(roomName);
      roomClients?.forEach(id => {
        const c = this.webSocketServer.clientManager.getClient({ clientId: id });
        if (c?.ws) {
          this.webSocketServer.sendClientMessage(c.ws, {
            type: 'game',
            action: 'moveMade',
            data: { playerId: clientId, move: data },
          });
        }
      });
    }

    return { success: true };
  };

  private async validateMove(data: any): Promise<boolean> {
    // Validation logic
    return true;
  }

  private async updateGameState(data: any): Promise<void> {
    // Database update
  }
}
```

## Related Documentation

- [WebSocket Guide](../guides/websocket.md) - Comprehensive implementation guide
- [WebSocket Concepts](../concepts/websocket.md) - Architecture and design patterns
- [Configuration Guide](../guides/configuration.md) - Application configuration
- [Hello World Example](../../examples/hello-world/README.md) - Working example
