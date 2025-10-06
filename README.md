# PXL Node.js Framework

[![npm version](https://img.shields.io/npm/v/@scpxl/nodejs-framework.svg)](https://www.npmjs.com/package/@scpxl/nodejs-framework)
[![Node.js Version](https://img.shields.io/node/v/@scpxl/nodejs-framework.svg)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

A comprehensive, production-ready Node.js framework for building modern applications with built-in support for web servers, databases, queues, caching, WebSockets, and more.

**Opinionated TypeScript framework** combining Fastify, WebSockets, Redis, BullMQ, and MikroORM under a unified Application lifecycle with graceful shutdown, health checks, and observability.

---

## ✨ Features

### 🚀 **Core Application System**

- **Unified Lifecycle Management** - Coordinated startup, readiness probes, and graceful shutdown
- **TypeScript-First** - Full type safety with strict mode enabled and comprehensive type definitions
- **Configuration Validation** - Zod-based schema validation with fail-fast error reporting
- **Modular Architecture** - Use only what you need via granular package exports

### 🌐 **Web & Networking**

- **Fastify Web Server** - High-performance HTTP server with route management and middleware
- **Route Autoloading** - Drop route modules into a directory and have them loaded automatically
- **WebSocket Support** - Real-time bidirectional communication with room-based routing
- **CORS & Security** - Built-in CORS, Helmet integration, and rate limiting support
- **File Uploads** - Multipart form data handling with configurable limits

### 💾 **Data & State Management**

- **PostgreSQL + MikroORM** - Type-safe database access with migrations and entities
- **Redis Integration** - Connection pooling, pub/sub, and caching via `ioredis`
- **Queue Processing (BullMQ)** - Background job processing with Redis-backed queues
- **LRU Caching** - High-performance in-memory caching with TTL support

### 🔧 **Developer Experience**

- **Structured Logging** - Winston-based logging with context and Sentry integration
- **CLI Commands** - Yargs-based command system for scripts and utilities
- **Hot Module Reload** - Fast development iteration with automatic rebuilds
- **Request Context** - Trace requests across async boundaries with correlation IDs
- **Error Handling** - Standardized error classes with detailed context

### ⚙️ **Operations & Observability**

- **Health Endpoints** - Liveness (`/health/live`) and readiness (`/health/ready`) probes
- **Performance Monitoring** - Track connection health, queue metrics, and resource usage
- **Graceful Shutdown** - Coordinated cleanup of connections, intervals, and resources
- **Cluster Support** - Multi-process scaling with built-in cluster management

### 🔐 **Security & Authentication**

- **JWT Authentication** - JOSE-based token signing and verification
- **Input Validation** - Zod schemas with runtime validation and type inference
- **AWS S3 Integration** - Secure file storage with presigned URLs
- **Prototype Pollution Protection** - Safe object operations and property access

---

## 📦 Installation

```bash
npm install @scpxl/nodejs-framework
```

**Requirements:**

- Node.js >= 22.0.0
- PostgreSQL (optional, for database features)
- Redis (optional, for caching and queues)

---

## 🚀 Quick Start

### Basic Web Application

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  webserver: {
    port: 3000,
    host: '0.0.0.0',
  },
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
  logger: {
    level: 'info',
  },
});

// Add routes
app.webserver.route({
  method: 'GET',
  url: '/api/health',
  handler: async (request, reply) => {
    return { status: 'healthy', timestamp: new Date() };
  },
});

// Start the application
await app.start();

console.log(`Server running at http://localhost:3000`);
```

### Type-Safe Routes with Zod

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';
import { defineRoute } from '@scpxl/nodejs-framework/webserver';
import { z } from 'zod';
import { PaginationQuerySchema, NumericIdSchema } from '@scpxl/nodejs-framework/schemas';

const app = new WebApplication({
  /* config */
});

// Define a typed route with automatic validation
const getUserRoute = defineRoute({
  method: 'GET',
  url: '/users/:id',
  schema: {
    params: z.object({ id: NumericIdSchema }),
    querystring: PaginationQuerySchema,
  },
  handler: async (request, reply) => {
    // TypeScript knows request.params.id is a number
    // and request.query has page/limit with defaults
    const user = await db.findUser(request.params.id);
    return { data: user };
  },
});

app.webserver.route(getUserRoute);
```

### With Database & Queue

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  webserver: { port: 3000 },
  database: {
    enabled: true,
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    databaseName: 'myapp',
    entitiesDirectory: './src/database/entities',
  },
  queue: {
    enabled: true,
    queues: [
      {
        id: 'email',
        jobs: [{ id: 'send-welcome', processor: './src/processors/email-processor.ts' }],
      },
    ],
  },
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

await app.start();

// Add a job to the queue
await app.queue.manager.addJobToQueue({
  queueId: 'email',
  jobId: 'send-welcome',
  data: { userId: 123, email: 'user@example.com' },
});
```

### Simple Load Test

Run lightweight load against any endpoint while iterating locally:

```bash
npm run load:test -- --url http://localhost:3000/health --requests 200 --concurrency 10
```

Switch to a time-based stream for soak-style checks:

```bash
npm run load:test -- --url http://localhost:3000/api/users --duration 30 --concurrency 8 --method POST --body '{"name":"Test"}' --header 'Content-Type: application/json'
```

The script reports latency percentiles, status code counts, and a few failure samples for quick feedback.

### WebSocket Server

Real-time bidirectional communication with room support and authentication:

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';
import { WebSocketServerBaseController } from '@scpxl/nodejs-framework/websocket';
import type { WebSocket } from 'ws';

// Create WebSocket controller
class ChatController extends WebSocketServerBaseController {
  public send = (ws: WebSocket, clientId: string, data: any) => {
    // Broadcast to all clients
    this.webSocketServer.sendMessageToAll({
      data: {
        type: 'chat',
        action: 'message',
        data: {
          clientId,
          text: data.text,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  };
}

const app = new WebApplication({
  name: 'chat-app',
  webserver: { port: 3000 },
  websocket: {
    enabled: true,
    type: 'server',
    url: 'ws://localhost:3000/ws',
    controllersDirectory: './controllers',
    routes: [
      {
        type: 'chat',
        action: 'send',
        controllerName: 'chat',
        controller: ChatController,
      },
    ],
    // Optional: JWT authentication
    // Clients connect with: ws://localhost:3000/ws?token=<jwt>
    events: {
      onConnected: ({ ws, clientId }) => {
        console.log('Client connected:', clientId);
        ws.send(
          JSON.stringify({
            type: 'system',
            action: 'connected',
            data: { clientId, message: 'Welcome!' },
          }),
        );
      },
    },
  },
  redis: { host: '127.0.0.1', port: 6379 },
  auth: {
    jwtSecretKey: process.env.JWT_SECRET || 'your-secret-key',
  },
});

await app.start();
console.log('WebSocket server running at ws://localhost:3000/ws');
```

#### Using Rooms

```typescript
// Client joins a room (built-in system controller)
// Send from client: { type: 'system', action: 'joinRoom', data: { roomName: 'general', username: 'Alice' } }

// Server-side: Broadcast to room members
const roomClients = app.websocket.server.rooms.get('general');
roomClients?.forEach(clientId => {
  const client = app.websocket.server.clientManager.getClient({ clientId });
  if (client?.ws) {
    app.websocket.server.sendClientMessage(client.ws, {
      type: 'room',
      action: 'message',
      data: { text: 'Room-specific announcement' },
    });
  }
});
```

#### Using WebSocket Service

Simplified API for common operations:

```typescript
import { WebSocketService } from '@scpxl/nodejs-framework/websocket';

const wsService = new WebSocketService({
  webSocketServer: app.websocket.server,
  redisInstance: app.redis.instance,
  workerId: String(process.pid),
});

// Broadcast to all clients
await wsService.broadcast({
  type: 'notification',
  action: 'alert',
  data: { message: 'New features available!' },
});

// Send to specific rooms
await wsService.sendToRooms(['vip', 'premium'], {
  type: 'offer',
  action: 'new',
  data: { discount: 20 },
});

// Convenience methods
await wsService.sendUserMessage('profileUpdated', { userId: 123 });
await wsService.sendSystemMessage('maintenance', { minutes: 5 });
```

See the [WebSocket Guide](./docs/guides/websocket.md) for complete documentation.

---

## 📚 Documentation

### Architecture

The framework is built around three main application types:

1. **`BaseApplication`** - Abstract base with Redis, Database, Queue, Events, Performance Monitoring
2. **`WebApplication`** - Extends `BaseApplication` with Fastify web server and WebSocket support
3. **`CommandApplication`** - Extends `BaseApplication` for CLI commands and scripts

### Core Components

| Component           | Description                                      | Import Path                               |
| ------------------- | ------------------------------------------------ | ----------------------------------------- |
| **Application**     | Main application classes                         | `@scpxl/nodejs-framework/application`     |
| **Logger**          | Structured logging with Winston                  | `@scpxl/nodejs-framework/logger`          |
| **Database**        | MikroORM integration and entity management       | `@scpxl/nodejs-framework/database`        |
| **WebServer**       | Fastify server and routing                       | `@scpxl/nodejs-framework/webserver`       |
| **WebSocket**       | WebSocket server and client                      | `@scpxl/nodejs-framework/websocket`       |
| **Queue**           | BullMQ job queue management                      | `@scpxl/nodejs-framework/queue`           |
| **Redis**           | Redis connection management                      | `@scpxl/nodejs-framework/redis`           |
| **Cache**           | High-level caching abstraction                   | `@scpxl/nodejs-framework/cache`           |
| **Auth**            | JWT authentication utilities                     | `@scpxl/nodejs-framework/auth`            |
| **Request Context** | Request correlation and tracing                  | `@scpxl/nodejs-framework/request-context` |
| **Lifecycle**       | Application lifecycle and shutdown management    | `@scpxl/nodejs-framework/lifecycle`       |
| **Error**           | Custom error classes                             | `@scpxl/nodejs-framework/error`           |
| **Utilities**       | File, string, time, URL helpers                  | `@scpxl/nodejs-framework/util`            |
| **Performance**     | Performance monitoring and metrics               | `@scpxl/nodejs-framework/performance`     |
| **API Requester**   | HTTP client wrapper (migrated to native `fetch`) | `@scpxl/nodejs-framework/api-requester`   |
| **Command**         | CLI command framework                            | `@scpxl/nodejs-framework/command`         |
| **Services**        | Additional service integrations (AWS S3, etc.)   | `@scpxl/nodejs-framework/services`        |
| **Schemas**         | Reusable Zod validation schemas                  | `@scpxl/nodejs-framework/schemas`         |

### Guides

Comprehensive guides for common tasks and features:

- **[Getting Started](./docs/getting-started.md)** - Installation and first steps
- **[Configuration](./docs/guides/configuration.md)** - Environment variables and config options
- **[WebSocket Guide](./docs/guides/websocket.md)** - Real-time communication setup
- **[Authentication Guide](./docs/guides/authentication.md)** - JWT auth implementation
- **[Typed Routes](./docs/guides/typed-routes.md)** - Type-safe routing with Zod validation
- **[Error Handling](./docs/guides/error-handling.md)** - Custom errors and error handling
- **[Commands](./docs/guides/commands.md)** - Building CLI commands
- **[Testing](./docs/guides/testing.md)** - Testing strategies and utilities
- **[Performance Monitoring](./docs/guides/performance-monitoring.md)** - Metrics and observability
- **[Simple Load Testing](./docs/guides/simple-load-test.md)** - Built-in load testing tool
- **[Hot Module Reload (HMR)](./docs/guides/hmr.md)** - Development workflow
- **[Deployment](./docs/guides/deployment.md)** - Production deployment guide
- **[Scaling](./docs/guides/scaling.md)** - Horizontal scaling strategies
- **[Logging](./docs/guides/logging.md)** - Structured logging best practices
- **[Environment Variables](./docs/guides/env.md)** - Managing environment configuration

### Key Patterns

#### Lifecycle Hooks

```typescript
const app = new WebApplication(config);

// Register lifecycle hooks
app.lifecycle.onStart(async () => {
  console.log('Application starting...');
});

app.lifecycle.onReady(async () => {
  console.log('Application ready for traffic');
});

app.lifecycle.onShutdown(async () => {
  console.log('Cleaning up resources...');
});

await app.start();
```

#### Graceful Shutdown

```typescript
const app = new WebApplication(config);

await app.start();

// Handle signals
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});
```

#### Service Injection Pattern

```typescript
class UserService {
  constructor(private app: WebApplication) {}

  async createUser(data: CreateUserDto) {
    // Use database
    const user = this.app.database.instance.em.create(User, data);
    await this.app.database.instance.em.flush();

    // Use queue
    await this.app.queue.manager.addJobToQueue({
      queueId: 'email',
      jobId: 'send-welcome',
      data: { userId: user.id },
    });

    // Use logger
    this.app.logger.info('User created', { userId: user.id });

    return user;
  }
}
```

---

## 📖 Examples

The `examples/` directory contains working demonstrations:

### Hello World Example

A full-stack example with:

- **Backend**: PXL WebApplication with TypeScript, WebSocket support, and API routes
- **Frontend**: Vue 3 + TypeScript + Vite with real-time WebSocket updates

**Run the example:**

```bash
# Install dependencies (one-time setup)
cd examples/hello-world/backend && npm install
cd ../frontend && npm install

# Run backend
npm run example --example=hello-world/backend

# Or run frontend (in another terminal)
npm run example --example=hello-world/frontend
```

Then open http://localhost:5173 to see the app.

### CLI Commands Example

Demonstrates the command framework with examples:

```bash
# Install dependencies (one-time setup)
cd examples/commands && npm install

# Run commands from repository root
npm run example --example=commands -- hello
npm run example --example=commands -- database-seed
npm run example --example=commands -- queue-process
```

See [examples/README.md](examples/README.md) for more details.

---

## 🛠️ Development

### CLI (`pxl`)

The framework now ships with a bundled CLI executable exposed as `pxl` when the package is installed.

Current capabilities:

- `pxl --version` / `pxl -v` / `pxl version` – Print framework version
- `pxl info` (or just `pxl`) – Display banner + roadmap

Planned subcommands (roadmap):

- `pxl doctor` – Environment diagnostics (Node version, dependency checks, Redis/Postgres availability)
- `pxl generate` – Scaffolding for applications, routes, commands, processors
- `pxl analyze` – Project inspection (unused files, dependency graph summary)

Usage examples:

```bash
# Show version
pxl --version

# Show framework banner and roadmap
pxl info

# (Future) Run doctor diagnostics
pxl doctor
```

Development Note:

When iterating locally, rebuild after CLI changes:

```bash
npm run build && pxl info
```

To test unpublished changes in another project via yalc:

```bash
npm run build:local
yalc add @scpxl/nodejs-framework
```

For contributions adding new subcommands, implement them in `src/cli/` and register via the yargs builder in `src/cli/index.ts`.

### Build Commands

```bash
# Development with hot-reload
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run prettier
npm run prettier:fix
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with UI
npm run test:ui
```

The framework maintains **80% code coverage** across all metrics (lines, branches, functions, statements) as enforced by Vitest thresholds.

### Framework Status Report

Generate a cross-platform project health snapshot (dependency counts, git status, directory sizes, large packages, outdated/age metrics):

```bash
npm run status
```

Optional flags:

```bash
npm run status -- --include-cache               # Include .turbo/ and .next/cache directories
npm run status -- --exclude "coverage,fixtures,**/*.snap"  # Additional exclude globs (comma-separated)
```

What it does:

- Collects repo & package metadata (version, scripts, dependency counts)
- Summarizes current git branch, last commit, and pending change counts
- Computes sizes for `src`, `dist`, and `node_modules` using fast native traversal (`fast-folder-size`) with a JS fallback, filtering via `.gitignore` / `.npmignore` plus exclusions
- Lists the largest packages in `node_modules` (top 8 by size)
- Ranks outdated dependencies by publish age and major version lag (uses `npm outdated` / `npm view`)
- Provides age distribution stats for installed top-level packages

Exclusions & Ignore Behavior:

- Always respects patterns found in `.gitignore` and `.npmignore` (except always keeps top-level `dist` & `node_modules`)
- Built-in default excludes: `coverage/`, `fixtures/`, and `**/*.snap`
- Skips heavy build caches (`.turbo`, `.next/cache`) unless `--include-cache` is passed

Return codes: exits with non-zero only on unexpected internal errors; missing npm or network failures simply degrade sections gracefully.

### Local Development with Yalc

For testing changes in consuming applications:

```bash
# Publish framework locally
npm run build:local

# In your consuming project
yalc add @scpxl/nodejs-framework

# Push updates after changes
npm run yalc:push
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Application
NODE_ENV=development
APP_NAME=my-app
APP_PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=myapp

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Logging
LOG_LEVEL=info

# Sentry (optional)
SENTRY_DSN=https://...
```

### TypeScript Configuration

The framework uses **ESNext** module target with `.js` extensions in imports:

```typescript
// ✅ Correct
import { WebApplication } from '@scpxl/nodejs-framework/application';

// ✅ Also correct (in framework source)
import { Logger } from '../logger/index.js';

// ❌ Incorrect (in framework source)
import { Logger } from '../logger'; // Missing .js extension
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │    Web      │  │   Command    │  │  Custom App   │  │
│  │ Application │  │ Application  │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          └─────────────────┴──────────────────┘
                            │
          ┌─────────────────▼──────────────────┐
          │        Base Application            │
          │  ┌──────────────────────────────┐  │
          │  │   Lifecycle Manager          │  │
          │  │  - Startup phases            │  │
          │  │  - Readiness probes          │  │
          │  │  - Graceful shutdown         │  │
          │  └──────────────────────────────┘  │
          └────────────────┬───────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
┌────▼─────┐      ┌────────▼────────┐   ┌───────▼──────┐
│  Redis   │      │    Database     │   │    Queue     │
│ Manager  │◄─────┤     Manager     │   │   Manager    │
└────┬─────┘      └────────┬────────┘   └───────┬──────┘
     │                     │                     │
┌────▼─────┐      ┌────────▼────────┐   ┌───────▼──────┐
│  Cache   │      │   MikroORM      │   │   BullMQ     │
│ Manager  │      │   PostgreSQL    │   │   Workers    │
└──────────┘      └─────────────────┘   └──────────────┘
```

---

## 🎯 When to Use PXL Framework

### ✅ **Good Fit**

- Building **APIs** or **microservices** with TypeScript
- Need **real-time features** via WebSockets
- Require **background job processing** with queues
- Want **structured application lifecycle** with health checks
- Building **full-stack applications** with unified backend framework
- Need **production-ready** defaults with observability built-in

### ⚠️ **Consider Alternatives**

- **Simple scripts** or **single-purpose utilities** - Framework may be heavier than needed
- **Serverless functions** - Better suited for lightweight frameworks
- **Non-TypeScript projects** - Framework is TypeScript-first

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup instructions
- Code style guidelines
- Testing requirements
- Pull request process

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run checks: `npm run check-all` (linting, prettier, typecheck)
5. Ensure tests pass: `npm test`
6. Commit with descriptive message
7. Push and create a Pull Request

---

## 🐛 Troubleshooting

### Database Connection Issues

```
Error: Connection to database failed
```

**Solution**: Ensure PostgreSQL is running and credentials are correct in `.env`

```bash
# Check PostgreSQL status
docker ps | grep postgres

# Start PostgreSQL with Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16
```

### Redis Connection Errors

```
Error: Redis connection refused
```

**Solution**: Ensure Redis is running

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change the port in configuration or kill the process using the port

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### TypeScript Module Resolution

```
Error: Cannot find module '../logger/index.js'
```

**Solution**: Ensure all imports in framework source code use `.js` extensions (required for ESM)

---

## 📄 License

[ISC License](LICENSE) - Copyright (c) PXL Agency

---

## 🔗 Links

- **Documentation**: https://pxlbros.github.io/pxl-nodejs-framework/
- **npm Package**: https://www.npmjs.com/package/@scpxl/nodejs-framework
- **GitHub Repository**: https://github.com/pxlbros/pxl-nodejs-framework
- **Issues**: https://github.com/pxlbros/pxl-nodejs-framework/issues
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **TODO/Roadmap**: [TODO.md](TODO.md)

---

## 💬 Support

For questions, issues, or feature requests:

- Open an [issue on GitHub](https://github.com/pxlbros/pxl-nodejs-framework/issues)
- Check existing [discussions](https://github.com/pxlbros/pxl-nodejs-framework/discussions)
- Review [documentation](https://pxlbros.github.io/pxl-nodejs-framework/)

---

**Built with ❤️ by [PXL Agency](https://pxlagency.com)**
