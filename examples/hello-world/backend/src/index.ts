/**
 * Hello World Example - PXL Framework
 *
 * A minimal example showing how to create a simple API with the PXL framework.
 * This example uses direct source imports for easy development and testing.
 */

import 'dotenv/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import { WebApplication, type WebApplicationConfig } from '../../../../src/application/index.js';
import { WebServerBaseController, WebServerRouteType } from '../../../../src/webserver/index.js';
import { WebSocketServerBaseController } from '../../../../src/websocket/index.js';

/**
 * API Controller
 * Handles all API endpoints for this example
 */
class ApiController extends WebServerBaseController {
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
    return reply.send({
      name: 'PXL Framework - Hello World API',
      version: '1.0.0',
      framework: '@scpxl/nodejs-framework',
      endpoints: [
        { method: 'GET', path: '/api/ping', description: 'Health check' },
        { method: 'POST', path: '/api/hello', description: 'Greeting endpoint' },
        { method: 'GET', path: '/api/info', description: 'API information' },
      ],
    });
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

    // Return an acknowledgement that the message was accepted
    return {
      success: true,
    };
  };
}

const webServerHost = process.env.HOST || '0.0.0.0';
const webServerPort = parseInt(process.env.PORT || '3000', 10);
const webSocketHost = process.env.WS_HOST || webServerHost;
const webSocketPort = parseInt(process.env.WS_PORT || String(webServerPort), 10);
const publicWebSocketHost = process.env.WS_PUBLIC_HOST || (webSocketHost === '0.0.0.0' ? 'localhost' : webSocketHost);
const webSocketUrl = process.env.WS_URL || `ws://${publicWebSocketHost}:${webSocketPort}/ws`;

// Create application configuration
const config: WebApplicationConfig = {
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
    debug: {
      printRoutes: false,
    },
    routes: [
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
  },

  // Redis - required by framework validation (won't be used in this example)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // Queue - required by framework validation (won't be used in this example)
  queue: {
    processorsDirectory: './processors',
    queues: [],
  },

  // Auth - required by framework validation (won't be used in this example)
  auth: {
    jwtSecretKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },

  // Performance monitoring (optional)
  performanceMonitoring: {
    enabled: true,
  },
};

async function main() {
  // Create and configure the application
  const app = new WebApplication(config);

  // Start the application
  await app.start();

  console.log(`
🚀 Hello World API is running!

  URL: http://${webServerHost}:${webServerPort}
  WS:  ${webSocketUrl}

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
