# Hello World Backend - PXL Framework Example

A minimal API built with the PXL Node.js Framework demonstrating basic web server functionality.

## Features

- ✅ Simple REST API with Fastify
- ✅ CORS enabled for frontend integration
- ✅ Direct source imports from framework
- ✅ Hot reload with tsx watch mode
- ✅ TypeScript support
- ✅ Graceful shutdown handling
- ✅ Performance monitoring (optional)

## Prerequisites

- Node.js 22+
- npm or yarn

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Copy environment file:**

   ```bash
   cp .env.example .env
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

The API will start at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start with hot reload (recommended for development)
- `npm start` - Start without hot reload
- `npm run typecheck` - Run TypeScript type checking

## API Endpoints

### GET /api/ping

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "message": "pong",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/hello

Greeting endpoint that echoes back a personalized message.

**Request:**

```json
{
  "name": "Alice"
}
```

**Response:**

```json
{
  "message": "Hello, Alice!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "receivedName": "Alice"
}
```

### GET /api/info

Returns information about the API.

**Response:**

```json
{
  "name": "PXL Framework - Hello World API",
  "version": "1.0.0",
  "framework": "@scpxl/nodejs-framework",
  "endpoints": [...]
}
```

## Configuration

Edit `.env` file to customize:

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)
- `REDIS_HOST` - Redis host (required by framework validation, default: localhost)
- `REDIS_PORT` - Redis port (required by framework validation, default: 6379)
- `JWT_SECRET` - JWT secret key (required by framework validation)

**Note:** Redis, Queue, and Auth configs are required by the framework's validation schema even though they're not actively used in this simple example.

## Architecture

This example demonstrates:

1. **Direct Source Imports**: Imports framework code directly from `../../../../src/` for instant updates during development
2. **WebApplication**: Uses the framework's `WebApplication` class which extends `BaseApplication` with Fastify
3. **Controller-Based Routing**: Uses the framework's proper controller pattern with `WebServerBaseController`
4. **Config-Based Routes**: Routes are defined in the config with controller classes and action methods
5. **Minimal Configuration**: Provides required config fields (redis, queue, auth) even though they're not used
6. **Graceful Shutdown**: Proper signal handling for clean process termination

**Note:** The framework's config validation requires `redis`, `queue`, and `auth` fields even for minimal examples. These are provided with default values but not actively used in this simple example.

## Project Structure

```
backend/
├── src/
│   └── index.ts      # Application entry point with controller and routes
├── controllers/      # Empty directory required by framework (uses inline controllers)
│   └── .gitkeep
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── .env.example      # Environment variables template
└── README.md         # This file
```

## How It Works

The example uses the framework's controller-based routing system:

1. **ApiController** - Extends `WebServerBaseController` with three action methods:
   - `ping()` - Health check endpoint
   - `hello()` - Greeting endpoint
   - `info()` - API information endpoint

2. **Routes Configuration** - Routes are defined in the config:

   ```typescript
   routes: [
     { type: WebServerRouteType.Default, method: 'GET', path: '/api/ping', controller: ApiController, action: 'ping' },
     // ... more routes
   ];
   ```

3. **Framework Lifecycle** - The framework automatically:
   - Creates the webServer during `app.start()`
   - Registers routes from config during `webServer.load()`
   - Starts listening on the configured port

## Next Steps

- Add database integration (MikroORM)
- Enable Redis for caching
- Add WebSocket support
- Implement authentication
- Add queue processing

See the `api-basic` example (coming soon) for a full-featured implementation.

## Testing the API

Using curl:

```bash
# Ping
curl http://localhost:3000/api/ping

# Hello
curl -X POST http://localhost:3000/api/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# Info
curl http://localhost:3000/api/info
```

Using the frontend:

```bash
cd ../frontend
npm install
npm run dev
```

Then open http://localhost:5173
