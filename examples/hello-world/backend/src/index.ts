/**
 * Hello World Example - PXL Framework
 *
 * A minimal example showing how to create a simple API with the PXL framework.
 * This example uses direct source imports for easy development and testing.
 */

import 'dotenv/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import { StatusCodes } from 'http-status-codes';
import type { EntityManager } from '@mikro-orm/postgresql';
import Redis from 'ioredis';
import { RedisMemoryServer } from 'redis-memory-server';
import { WebApplication, type WebApplicationConfig } from '../../../../src/application/index.js';
import { WebServerBaseController, WebServerRouteType } from '../../../../src/webserver/index.js';
import { WebSocketRedisSubscriberEvent, WebSocketServerBaseController } from '../../../../src/websocket/index.js';
import { Greeting } from './entities/Greeting.js';

type RedisConnectionDetails = {
  host: string;
  port: number;
  isEmbedded: boolean;
};

let embeddedRedis: RedisMemoryServer | null = null;
let embeddedRedisCleanupRegistered = false;

async function canConnectToRedis(host: string, port: number): Promise<boolean> {
  const client = new Redis({
    host,
    port,
    lazyConnect: true,
    retryStrategy: null,
    maxRetriesPerRequest: 0,
  });

  try {
    await client.connect();
    await client.ping();

    return true;
  } catch {
    return false;
  } finally {
    if (client.status === 'ready') {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    } else {
      client.disconnect();
    }
  }
}

function registerEmbeddedRedisCleanup(): void {
  if (embeddedRedisCleanupRegistered) {
    return;
  }

  const cleanup = async () => {
    if (!embeddedRedis) {
      return;
    }

    try {
      await embeddedRedis.stop();
    } catch {
      // ignore cleanup errors
    } finally {
      embeddedRedis = null;
    }
  };

  process.once('exit', () => {
    cleanup().catch(() => undefined);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      cleanup()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  }

  embeddedRedisCleanupRegistered = true;
}

async function ensureRedisAvailability(): Promise<RedisConnectionDetails> {
  const requestedHost = process.env.REDIS_HOST ?? 'localhost';
  const requestedPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);

  if (await canConnectToRedis(requestedHost, requestedPort)) {
    return {
      host: requestedHost,
      port: requestedPort,
      isEmbedded: false,
    };
  }

  const embeddedRedisEnabled = (process.env.PXL_EMBEDDED_REDIS ?? 'true').toLowerCase() !== 'false';
  const usingDefaultHost =
    !process.env.REDIS_HOST || ['localhost', '127.0.0.1'].includes(process.env.REDIS_HOST.toLowerCase());

  if (!embeddedRedisEnabled || !usingDefaultHost) {
    throw new Error(
      `Unable to connect to Redis at ${requestedHost}:${requestedPort}.` +
        (embeddedRedisEnabled
          ? ' Provide a reachable Redis instance or allow the example to manage its own by setting REDIS_HOST to localhost.'
          : ' Set PXL_EMBEDDED_REDIS=true (default) to allow the example to start an embedded Redis automatically.'),
    );
  }

  embeddedRedis = new RedisMemoryServer();
  await embeddedRedis.start();

  const host = await embeddedRedis.getHost();
  const port = await embeddedRedis.getPort();

  registerEmbeddedRedisCleanup();

  console.log(`[pxl] Started embedded Redis for the Hello World example at ${host}:${port}`);

  return {
    host,
    port,
    isEmbedded: true,
  };
}

/**
 * API Controller
 * Handles all API endpoints for this example
 */
class ApiController extends WebServerBaseController {
  /**
   * GET / - Landing page with quick links
   */
  public home = async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PXL Hello World</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background-color: #0f172a;
        color: #e2e8f0;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      main {
        max-width: 640px;
        padding: 2.5rem;
        background: rgba(15, 23, 42, 0.85);
        border-radius: 18px;
        box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(12px);
      }
      h1 {
        margin: 0 0 1rem;
        font-size: clamp(2.2rem, 5vw, 2.8rem);
      }
      p {
        margin: 0 0 1rem;
        line-height: 1.6;
      }
      ul {
        margin: 1.5rem 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.75rem;
      }
      li {
        background: rgba(30, 41, 59, 0.85);
        border-radius: 12px;
        padding: 0.9rem 1rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
      }
      a {
        color: #38bdf8;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        font-weight: 600;
      }
      footer {
        margin-top: 1.5rem;
        font-size: 0.875rem;
        color: rgba(226, 232, 240, 0.7);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>👋 Welcome to the PXL Hello World API</h1>
      <p>The backend server is running and ready. Try the sample endpoints below or launch the Vue frontend for a full demo.</p>
      <ul>
        <li><a href="/api/ping">GET /api/ping</a> — Health check</li>
        <li><a href="/api/info">GET /api/info</a> — API overview</li>
        <li><code>POST /api/hello</code> — Send <code>{ "name": "Ada" }</code> for a greeting</li>
      </ul>
      <footer>Frontend available at <code>examples/hello-world/frontend</code> → <code>npm run dev</code></footer>
    </main>
  </body>
</html>`;

    return reply.type('text/html; charset=utf-8').send(html);
  };

  /**
   * GET /api/ping - Health check endpoint
   */
  public ping = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * POST /api/hello - Greeting endpoint
   */
  public hello = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string } | undefined;
    const { name = 'World' } = body || {};

    return reply.send({
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
      receivedName: name,
    });
  };

  /**
   * GET /api/info - API information endpoint
   */
  public info = async (request: FastifyRequest, reply: FastifyReply) => {
    const endpoints = [
      { method: 'GET', path: '/api/ping', description: 'Health check' },
      { method: 'POST', path: '/api/hello', description: 'Greeting endpoint' },
      { method: 'GET', path: '/api/info', description: 'API information' },
      { method: 'GET', path: '/api/greetings', description: 'List all greetings' },
      { method: 'GET', path: '/api/greetings/:id', description: 'Get greeting by ID' },
      { method: 'POST', path: '/api/greetings', description: 'Create new greeting' },
      { method: 'PUT', path: '/api/greetings/:id', description: 'Update greeting' },
      { method: 'DELETE', path: '/api/greetings/:id', description: 'Delete greeting' },
    ];

    return reply.send({
      name: 'PXL Framework - Hello World API',
      version: '1.0.0',
      framework: '@scpxl/nodejs-framework',
      endpoints,
    });
  };
}

/**
 * Greetings Controller
 * Handles CRUD operations for Greeting entity
 */
class GreetingsController extends WebServerBaseController {
  private getEntityManagerOrRespond(reply: FastifyReply): EntityManager | null {
    const databaseInstance = this.databaseInstance as unknown as { getEntityManager?: () => EntityManager } | null;

    const entityManager = databaseInstance?.getEntityManager?.();

    if (!entityManager) {
      this.sendErrorResponse({
        reply,
        error:
          'Database is disabled for this example. Set DB_ENABLED=true in backend/.env and restart the backend to enable greeting persistence.',
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
        errorType: 'server_error',
      });

      return null;
    }

    return entityManager;
  }

  /**
   * GET /api/greetings - List all greetings
   */
  public list = async (request: FastifyRequest, reply: FastifyReply) => {
    const em = this.getEntityManagerOrRespond(reply);
    if (!em) {
      return;
    }

    const greetings = await em.find(Greeting, {});
    return reply.send({ greetings });
  };

  /**
   * GET /api/greetings/:id - Get greeting by ID
   */
  public get = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const em = this.getEntityManagerOrRespond(reply);
    if (!em) {
      return;
    }

    const greeting = await em.findOne(Greeting, { id: parseInt(id, 10) });

    if (!greeting) {
      return reply.status(404).send({ error: 'Greeting not found' });
    }

    return reply.send({ greeting });
  };

  /**
   * POST /api/greetings - Create new greeting
   */
  public create = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; message: string };

    if (!body.name || !body.message) {
      return reply.status(400).send({ error: 'Name and message are required' });
    }

    const em = this.getEntityManagerOrRespond(reply);
    if (!em) {
      return;
    }

    const greeting = em.create(Greeting, {
      name: body.name,
      message: body.message,
    });

    await em.persistAndFlush(greeting);

    return reply.status(201).send({ greeting });
  };

  /**
   * PUT /api/greetings/:id - Update greeting
   */
  public update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; message?: string };
    const em = this.getEntityManagerOrRespond(reply);
    if (!em) {
      return;
    }

    const greeting = await em.findOne(Greeting, { id: parseInt(id, 10) });

    if (!greeting) {
      return reply.status(404).send({ error: 'Greeting not found' });
    }

    if (body.name !== undefined) greeting.name = body.name;
    if (body.message !== undefined) greeting.message = body.message;

    await em.flush();

    return reply.send({ greeting });
  };

  /**
   * DELETE /api/greetings/:id - Delete greeting
   */
  public delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const em = this.getEntityManagerOrRespond(reply);
    if (!em) {
      return;
    }

    const greeting = await em.findOne(Greeting, { id: parseInt(id, 10) });

    if (!greeting) {
      return reply.status(404).send({ error: 'Greeting not found' });
    }

    await em.removeAndFlush(greeting);

    return reply.status(204).send();
  };
}

/**
 * WebSocket Controller
 * Handles real-time hello messages broadcast to all connected clients
 */
class HelloWebSocketController extends WebSocketServerBaseController {
  public greet = (clientWebSocket: WebSocket, webSocketClientId: string, data: any) => {
    const name = typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : 'World';
    const message =
      typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : `${name} says hello!`;

    const payload = {
      type: 'hello',
      action: 'greeting',
      data: {
        name,
        message,
        clientId: webSocketClientId,
        timestamp: new Date().toISOString(),
      },
    };

    // Broadcast the greeting to every connected client (including the sender)
    this.webSocketServer.sendMessageToAll({
      data: payload,
    });

    // Publish a cross-worker update that our subscriber example can observe
    this.webSocketServer.sendCustomMessage({
      data: {
        includeSender: true,
        type: 'system',
        action: 'statusUpdate',
        data: {
          status: `${name} just sent a hello`,
        },
      },
    });

    // Return an acknowledgement that the message was accepted
    return {
      success: true,
    };
  };
}

const webServerHost = process.env.HOST || '0.0.0.0';
const webServerPort = parseInt(process.env.PORT || '4000', 10);
const webSocketHost = process.env.WS_HOST || webServerHost;
const webSocketPort = parseInt(process.env.WS_PORT || String(webServerPort), 10);
const publicWebSocketHost = process.env.WS_PUBLIC_HOST || (webSocketHost === '0.0.0.0' ? 'localhost' : webSocketHost);
const webSocketUrl = process.env.WS_URL || `ws://${publicWebSocketHost}:${webSocketPort}/ws`;

/**
 * Security Configuration
 *
 * The framework enables Helmet and Rate Limiting by default for security:
 * - Helmet: Adds security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Rate Limiting: Prevents abuse (default: 1000 requests/minute per IP)
 *
 * You can customize or disable these features via the security config.
 * Set RATE_LIMIT_ENABLED=false in .env to disable rate limiting for development.
 */
const rateLimitEnv = process.env.RATE_LIMIT_ENABLED?.toLowerCase();
const rateLimitEnabled = rateLimitEnv === 'true' ? true : rateLimitEnv === 'false' ? false : undefined;

const webServerSecurity: WebApplicationConfig['webServer']['security'] =
  rateLimitEnabled === undefined
    ? undefined // Use framework defaults (helmet + rate limiting enabled)
    : {
        // Custom security configuration
        helmet: {
          enabled: true, // Keep helmet enabled (recommended for production)
        },
        rateLimit: {
          enabled: rateLimitEnabled,
          max: 100, // Max 100 requests per timeWindow
          timeWindow: '1 minute', // Time window for rate limiting
        },
      };

function buildConfig({ redisHost, redisPort }: { redisHost: string; redisPort: number }): WebApplicationConfig {
  return {
    name: 'hello-world-api',
    instanceId: `hello-world-${process.pid}`,
    rootDirectory: process.cwd(),

    // Web server configuration
    webServer: {
      enabled: true,
      host: webServerHost,
      port: webServerPort,
      cors: {
        enabled: true,
        urls: ['*'], // Allow all origins for development
      },
      controllersDirectory: './controllers', // Required by framework
      security: webServerSecurity,
      routesDirectory: './src/routes', // Auto-load typed routes from this directory
      debug: {
        printRoutes: false,
      },
      routes: [
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/',
          controller: ApiController,
          action: 'home',
        },
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/api/ping',
          controller: ApiController,
          action: 'ping',
        },
        {
          type: WebServerRouteType.Default,
          method: 'POST',
          path: '/api/hello',
          controller: ApiController,
          action: 'hello',
        },
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/api/info',
          controller: ApiController,
          action: 'info',
        },
        // Greetings CRUD routes
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/api/greetings',
          controller: GreetingsController,
          action: 'list',
        },
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/api/greetings/:id',
          controller: GreetingsController,
          action: 'get',
        },
        {
          type: WebServerRouteType.Default,
          method: 'POST',
          path: '/api/greetings',
          controller: GreetingsController,
          action: 'create',
        },
        {
          type: WebServerRouteType.Default,
          method: 'PUT',
          path: '/api/greetings/:id',
          controller: GreetingsController,
          action: 'update',
        },
        {
          type: WebServerRouteType.Default,
          method: 'DELETE',
          path: '/api/greetings/:id',
          controller: GreetingsController,
          action: 'delete',
        },
      ],
    },

    // WebSocket server configuration
    webSocket: {
      enabled: true,
      type: 'server',
      host: webSocketHost,
      url: webSocketUrl,
      controllersDirectory: './controllers',
      routes: [
        {
          type: 'hello',
          action: 'greet',
          controllerName: 'hello',
          controller: HelloWebSocketController,
        },
      ],
      events: {
        onConnected: ({ ws, clientId }) => {
          ws.send(
            JSON.stringify({
              type: 'hello',
              action: 'connected',
              data: {
                message: 'Connected to the PXL Hello World WebSocket!',
                clientId,
                timestamp: new Date().toISOString(),
              },
            }),
          );
        },
      },
      subscriberHandlers: {
        directory: './websocket/subscribers',
        handlers: [
          {
            name: 'logCustomRedisEvents',
            channels: [WebSocketRedisSubscriberEvent.Custom],
            priority: -10,
            handle: ({ channel, message }) => {
              console.log('[subscriber] Redis event received', { channel, message });
            },
          },
        ],
      },
    },

    // Database configuration
    database: {
      enabled: process.env.DB_ENABLED === 'true',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      databaseName: process.env.DB_DATABASE_NAME || 'hello_world',
      entitiesDirectory: './src/entities',
    },

    // Redis - required by framework validation
    redis: {
      host: redisHost,
      port: redisPort,
    },

    // Queue - required by framework validation
    queue: {
      processorsDirectory: './processors',
      queues: [],
    },

    // Auth - required by framework validation
    auth: {
      jwtSecretKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    },

    // Performance monitoring (optional)
    performanceMonitoring: {
      enabled: true,
    },
  };
}

async function main() {
  const redisConnection = await ensureRedisAvailability();

  // Expose resolved Redis details so dependent libraries/processes see accurate values
  process.env.REDIS_HOST = redisConnection.host;
  process.env.REDIS_PORT = String(redisConnection.port);

  const config = buildConfig({
    redisHost: redisConnection.host,
    redisPort: redisConnection.port,
  });

  // Create and configure the application
  const app = new WebApplication(config);

  // Start the application
  await app.start();

  // Replace 0.0.0.0 with localhost for display purposes
  const displayHost = webServerHost === '0.0.0.0' ? 'localhost' : webServerHost;

  console.log(`
🚀 Hello World API is running!

  URL: http://${displayHost}:${webServerPort}
  WS:  ${webSocketUrl}
  Redis: ${redisConnection.host}:${redisConnection.port}${redisConnection.isEmbedded ? ' (embedded)' : ''}

  Try these endpoints:
  - GET  http://localhost:${webServerPort}/api/ping
  - POST http://localhost:${webServerPort}/api/hello
  - GET  http://localhost:${webServerPort}/api/info
  - WS  Send { "type": "hello", "action": "greet", "data": { "name": "Ada", "message": "Hello there" } }


Press Ctrl+C to stop
  `);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Start the application
main().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
