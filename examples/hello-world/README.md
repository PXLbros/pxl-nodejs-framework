# Hello World Example

A full-stack example demonstrating the PXL Framework's core features including REST API, WebSocket real-time communication, database operations, and Vue 3 frontend integration.

## Features Demonstrated

### Backend (Node.js + PXL Framework)

- ✅ **REST API Endpoints**: Health checks, greeting endpoints, CRUD operations
- ✅ **WebSocket Server**: Real-time bidirectional communication
- ✅ **Controller-Based Routing**: Organized message handling
- ✅ **Database Integration**: MikroORM with PostgreSQL for persistent greetings
- ✅ **CORS Configuration**: Cross-origin resource sharing for development
- ✅ **Graceful Shutdown**: Clean resource cleanup

### Frontend (Vue 3 + TypeScript + Vite)

- ✅ **REST API Client**: Fetch-based API communication
- ✅ **WebSocket Client**: Real-time message handling
- ✅ **Auto-Reconnection**: Resilient WebSocket connection
- ✅ **Live Message Feed**: Real-time greeting broadcasts
- ✅ **CRUD Interface**: Create, read, update, delete greetings
- ✅ **Responsive Design**: Modern, gradient-based UI

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- PostgreSQL (optional, for database features)
- Redis (optional, for WebSocket cross-worker coordination)

### Installation

```bash
# From the framework root
npm run example:install

# Or install individually
cd examples/hello-world/backend && npm install
cd examples/hello-world/frontend && npm install
```

### Running the Example

#### Option 1: Run Backend + Frontend Together

```bash
# From framework root
npm run example:hello-world
```

This starts:

- Backend API on `http://localhost:4000`
- Frontend UI on `http://localhost:5173`
- WebSocket server on `ws://localhost:4000/ws`

#### Option 2: Run Individually

```bash
# Terminal 1: Backend
npm run example:hello-world:backend

# Terminal 2: Frontend
npm run example:hello-world:frontend
```

Then open http://localhost:5173 in your browser.

### With Database (Optional)

To enable persistent greetings storage:

```bash
# Start PostgreSQL
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hello_world \
  postgres:16

# Update backend/.env
DB_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE_NAME=hello_world

# Restart backend
npm run example:hello-world:backend
```

The database schema will be auto-created on first run.

## Architecture

### Backend Structure

```
backend/
├── src/
│   ├── index.ts              # Application entry point
│   ├── entities/
│   │   └── Greeting.ts       # MikroORM entity for greetings
│   ├── routes/               # Auto-loaded REST routes
│   │   ├── hello.routes.ts
│   │   └── greetings.routes.ts
│   └── schemas/              # Zod validation schemas
│       ├── hello.schema.ts
│       └── greetings.schema.ts
└── package.json
```

### Frontend Structure

```
frontend/
├── src/
│   ├── App.vue               # Main application component
│   ├── api/
│   │   └── client.ts         # REST + WebSocket client
│   └── main.ts               # Application entry point
└── package.json
```

## WebSocket Protocol

### Message Format

All WebSocket messages follow this structure:

```typescript
{
  type: string;      // Message category
  action: string;    // Specific action
  data?: any;        // Optional payload
}
```

### Supported Messages

#### Client → Server

**1. Send Greeting**

```json
{
  "type": "hello",
  "action": "greet",
  "data": {
    "name": "Alice",
    "message": "Hello everyone!"
  }
}
```

**2. Join Room** (System Controller)

```json
{
  "type": "system",
  "action": "joinRoom",
  "data": {
    "roomName": "general",
    "username": "Alice"
  }
}
```

**3. Leave Room** (System Controller)

```json
{
  "type": "system",
  "action": "leaveRoom",
  "data": {
    "roomName": "general"
  }
}
```

#### Server → Client

**1. Connection Acknowledgment**

```json
{
  "type": "hello",
  "action": "connected",
  "data": {
    "message": "Connected to the PXL Hello World WebSocket!",
    "clientId": "abc123",
    "timestamp": "2025-10-05T12:00:00.000Z"
  }
}
```

**2. Broadcast Greeting**

```json
{
  "type": "hello",
  "action": "greeting",
  "data": {
    "name": "Alice",
    "message": "Hello everyone!",
    "clientId": "abc123",
    "timestamp": "2025-10-05T12:00:00.000Z"
  }
}
```

**3. Room Joined**

```json
{
  "type": "user",
  "action": "leftRoom",
  "data": {
    "roomName": "general"
  }
}
```

### WebSocket Controller Implementation

The backend uses a controller to handle WebSocket messages:

```typescript
// backend/src/index.ts
class HelloWebSocketController extends WebSocketServerBaseController {
  public greet = (clientWebSocket: WebSocket, webSocketClientId: string, data: any) => {
    const name = data?.name?.trim() || 'World';
    const message = data?.message?.trim() || `${name} says hello!`;

    // Broadcast to ALL connected clients (including sender)
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'hello',
        action: 'greeting',
        data: {
          name,
          message,
          clientId: webSocketClientId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  };
}
```

**Route Configuration:**

```typescript
webSocket: {
  routes: [
    {
      type: 'hello',           // Matches message.type
      action: 'greet',         // Matches message.action
      controllerName: 'hello',
      controller: HelloWebSocketController,
    },
  ],
}
```

### Frontend WebSocket Client

```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:4000/ws');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = event => {
  const message = JSON.parse(event.data);

  // Handle greeting broadcasts
  if (message.type === 'hello' && message.action === 'greeting') {
    displayGreeting(message.data);
  }
};

// Send greeting
ws.send(
  JSON.stringify({
    type: 'hello',
    action: 'greet',
    data: {
      name: 'Alice',
      message: 'Hello from the browser!',
    },
  }),
);
```

## REST API Endpoints

### Health & Info

**GET /** - Landing page with API overview
**GET /api/ping** - Health check
**GET /api/info** - API information and available endpoints

### Greetings (Hello)

**POST /api/hello**

- Send a greeting (non-persistent)
- Body: `{ "name": "Alice" }`
- Response: `{ "message": "Hello, Alice!", "timestamp": "...", "receivedName": "Alice" }`

### Greetings (Database CRUD)

**GET /api/greetings** - List all greetings
**GET /api/greetings/:id** - Get greeting by ID
**POST /api/greetings** - Create new greeting

- Body: `{ "name": "Alice", "message": "Hello!" }`

**PUT /api/greetings/:id** - Update greeting

- Body: `{ "name": "Bob", "message": "Updated!" }`

**DELETE /api/greetings/:id** - Delete greeting

## Environment Variables

### Backend Configuration

Create `backend/.env`:

```env
# Server
HOST=0.0.0.0
PORT=4000

# WebSocket
WS_HOST=0.0.0.0
WS_PORT=4000
WS_PUBLIC_HOST=localhost
WS_URL=ws://localhost:4000/ws

# Database (optional)
DB_ENABLED=false
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE_NAME=hello_world

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=dev-secret-change-in-production
RATE_LIMIT_ENABLED=false
```

### Frontend Configuration

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/ws
```

## Key Features Explained

### 1. Controller-Based Routing

Both REST and WebSocket use controllers for organized request handling:

**REST Controller:**

```typescript
class ApiController extends WebServerBaseController {
  public ping = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok', message: 'pong' });
  };
}
```

**WebSocket Controller:**

```typescript
class HelloWebSocketController extends WebSocketServerBaseController {
  public greet = (ws: WebSocket, clientId: string, data: any) => {
    // Handle greeting
  };
}
```

### 2. Real-Time Broadcasting

The WebSocket controller broadcasts messages to all connected clients:

```typescript
this.webSocketServer.sendMessageToAll({
  data: {
    type: 'hello',
    action: 'greeting',
    data: { name, message, clientId, timestamp },
  },
});
```

This enables:

- Multiple browser tabs seeing the same greetings in real-time
- Cross-worker broadcasting via Redis (in cluster mode)
- Instant UI updates without polling

### 3. Authentication (Optional)

Add JWT authentication to WebSocket connections:

```typescript
// Backend: Configure auth
auth: {
  jwtSecretKey: process.env.JWT_SECRET,
}

// Frontend: Connect with token
const token = 'your-jwt-token';
const ws = new WebSocket(`ws://localhost:4000/ws?token=${token}`);

// Backend: Access authenticated user
const client = this.webSocketServer.clientManager.getClient({ clientId });
const userId = client?.user?.userId;
```

### 4. Room Support

Group clients for targeted messaging:

```typescript
// Client joins room
ws.send(
  JSON.stringify({
    type: 'system',
    action: 'joinRoom',
    data: { roomName: 'general', username: 'Alice' },
  }),
);

// Server broadcasts to room only
const roomClients = this.webSocketServer.rooms.get('general');
// ... send to room members
```

### 5. Database Integration

Persistent storage with MikroORM:

```typescript
// Entity
@Entity()
export class Greeting {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  message!: string;

  @Property()
  createdAt = new Date();
}

// Usage in controller
const em = this.databaseInstance.getEntityManager();
const greeting = em.create(Greeting, { name, message });
await em.persistAndFlush(greeting);
```

## Testing the Example

### 1. Test WebSocket Connection

Open browser console and connect:

```javascript
const ws = new WebSocket('ws://localhost:4000/ws');

ws.onopen = () => {
  console.log('Connected!');
  ws.send(
    JSON.stringify({
      type: 'hello',
      action: 'greet',
      data: { name: 'Test', message: 'Hello from console!' },
    }),
  );
};

ws.onmessage = e => {
  console.log('Received:', JSON.parse(e.data));
};
```

### 2. Test Multi-Tab Sync

1. Open http://localhost:5173 in two browser tabs
2. Send a greeting from Tab 1
3. See the greeting appear in real-time in Tab 2

### 3. Test API Endpoints

```bash
# Health check
curl http://localhost:4000/api/ping

# Send greeting
curl -X POST http://localhost:4000/api/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# Create greeting (if DB enabled)
curl -X POST http://localhost:4000/api/greetings \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","message":"Hello World!"}'

# List greetings
curl http://localhost:4000/api/greetings
```

## Troubleshooting

### WebSocket Connection Failed

**Problem:** Cannot connect to WebSocket server

**Solutions:**

- Ensure backend is running: `npm run example:hello-world:backend`
- Check WebSocket URL matches: `WS_URL` in backend `.env` and `VITE_WS_URL` in frontend `.env`
- Verify firewall allows WebSocket connections
- Check browser console for errors

### CORS Errors

**Problem:** API requests blocked by CORS

**Solutions:**

- Ensure CORS is enabled in backend config (already configured in this example)
- Verify frontend URL matches allowed origins
- Check browser console for specific CORS error details

### Database Connection Failed

**Problem:** Cannot connect to PostgreSQL

**Solutions:**

- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Verify credentials in `backend/.env` match your database
- Check database exists: `hello_world`
- Ensure `DB_ENABLED=true` in `.env`

### Greetings Not Appearing in Real-Time

**Problem:** Messages sent via WebSocket not showing for other clients

**Solutions:**

- Check both browser tabs are connected (status indicator should show "Connected")
- Verify backend WebSocket server is running
- Check browser console for WebSocket errors
- Ensure Redis is running if using cluster mode

## Extending the Example

### Add New WebSocket Message Types

1. Create a new controller method:

```typescript
class HelloWebSocketController extends WebSocketServerBaseController {
  public typing = (ws: WebSocket, clientId: string, data: any) => {
    // Broadcast typing indicator
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'hello',
        action: 'typing',
        data: { clientId, username: data.username },
      },
    });
    return { success: true };
  };
}
```

2. Add route:

```typescript
{
  type: 'hello',
  action: 'typing',
  controllerName: 'hello',
  controller: HelloWebSocketController,
}
```

3. Send from frontend:

```typescript
ws.send(
  JSON.stringify({
    type: 'hello',
    action: 'typing',
    data: { username: 'Alice' },
  }),
);
```

### Add Room-Based Chat

1. Join room on connection:

```typescript
// Frontend
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'system',
      action: 'joinRoom',
      data: { roomName: 'general', username: 'Alice' },
    }),
  );
};
```

2. Broadcast to room only:

```typescript
// Backend controller
const client = this.webSocketServer.clientManager.getClient({ clientId });
const roomName = client?.roomName;

if (roomName) {
  const roomClients = this.webSocketServer.rooms.get(roomName);
  // Send to room members only
}
```

## Learn More

- [WebSocket Guide](../../docs/guides/websocket.md) - Comprehensive WebSocket documentation
- [WebSocket API Reference](../../docs/api/websocket.md) - Complete API reference
- [WebSocket Concepts](../../docs/concepts/websocket.md) - Architecture and patterns
- [Framework Documentation](../../README.md) - Main framework documentation

## License

ISC - Same as the PXL Framework
