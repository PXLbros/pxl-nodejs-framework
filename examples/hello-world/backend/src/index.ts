/**
 * Hello World Example - PXL Framework
 *
 * A minimal example showing how to create a simple API with the PXL framework.
 * This example uses direct source imports for easy development and testing.
 */

import 'dotenv/config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { WebApplication, type WebApplicationConfig } from '../../../../src/application/index.js';
import { WebServerBaseController, WebServerRouteType } from '../../../../src/webserver/index.js';

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

// Create application configuration
const config: WebApplicationConfig = {
  name: 'hello-world-api',
  rootDirectory: process.cwd(),

  // Web server configuration
  webServer: {
    enabled: true,
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    cors: {
      enabled: true,
      urls: ['*'], // Allow all origins for development
    },
    controllersDirectory: './controllers', // Required by framework
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

  URL: http://${config.webServer.host}:${config.webServer.port}

  Try these endpoints:
  - GET  http://localhost:${config.webServer.port}/api/ping
  - POST http://localhost:${config.webServer.port}/api/hello
  - GET  http://localhost:${config.webServer.port}/api/info

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
