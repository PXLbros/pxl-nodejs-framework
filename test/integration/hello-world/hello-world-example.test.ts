import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testServerRequest, waitForServer } from '../../utils/helpers/test-server.js';
import WebSocket from 'ws';
import type { WebApplicationConfig } from '../../../dist/application/index.js';
import { WebApplication } from '../../../dist/application/index.js';
import { WebSocketServerBaseController } from '../../../dist/websocket/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket as WSType } from 'ws';

/**
 * WebSocket Controller - Handles real-time messages
 */
class HelloWebSocketController extends WebSocketServerBaseController {
  public greet = (clientWebSocket: WSType, webSocketClientId: string, data: any) => {
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

    // Broadcast to all clients
    this.webSocketServer.sendMessageToAll({
      data: payload,
    });

    return {
      success: true,
    };
  };
}

describe('Hello World Example End-to-End', () => {
  let app: WebApplication;
  let testPort: number;
  const testHost = '127.0.0.1';
  let wsUrl: string;
  let baseUrl: string;

  beforeAll(async () => {
    // Use in-memory Redis for testing
    process.env.PXL_REDIS_IN_MEMORY = 'true';

    // Get test port
    const { getTestPort } = await import('../../utils/helpers/test-server.js');
    testPort = getTestPort();
    wsUrl = `ws://${testHost}:${testPort}/ws`;
    baseUrl = `http://${testHost}:${testPort}`;

    // Create application configuration
    const config: WebApplicationConfig = {
      name: 'hello-world-api-test',
      instanceId: `hello-world-test-${process.pid}`,
      rootDirectory: process.cwd(),

      // Web server configuration
      webServer: {
        enabled: true,
        host: testHost,
        port: testPort,
        cors: {
          enabled: true,
          urls: ['*'],
        },
        controllersDirectory: './controllers',
        debug: {
          printRoutes: false,
        },
        routes: [
          {
            type: 'default',
            method: 'GET',
            path: '/',
            handler: async (_request: FastifyRequest, reply: FastifyReply) => {
              return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PXL Hello World</title>
  </head>
  <body>
    <h1>Welcome to PXL Hello World API</h1>
  </body>
</html>`);
            },
          } as any,
          {
            type: 'default',
            method: 'GET',
            path: '/api/ping',
            handler: async (_request: FastifyRequest, reply: FastifyReply) => {
              return reply.send({
                status: 'ok',
                message: 'pong',
                timestamp: new Date().toISOString(),
              });
            },
          } as any,
          {
            type: 'default',
            method: 'POST',
            path: '/api/hello',
            handler: async (request: FastifyRequest, reply: FastifyReply) => {
              const body = request.body as { name?: string } | undefined;
              const { name = 'World' } = body || {};
              return reply.send({
                message: `Hello, ${name}!`,
                timestamp: new Date().toISOString(),
                receivedName: name,
              });
            },
          } as any,
          {
            type: 'default',
            method: 'GET',
            path: '/api/info',
            handler: async (_request: FastifyRequest, reply: FastifyReply) => {
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
            },
          } as any,
        ],
      },

      // WebSocket server configuration
      webSocket: {
        enabled: true,
        type: 'server',
        host: testHost,
        url: wsUrl,
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
          handlers: [],
        },
      },

      // Database disabled for this test
      database: {
        enabled: false,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        databaseName: 'hello_world',
      },

      // Redis configuration
      redis: {
        host: 'localhost',
        port: 6379,
      },

      // Queue configuration
      queue: {
        processorsDirectory: './processors',
        queues: [],
      },

      // Auth configuration
      auth: {
        jwtSecretKey: 'test-secret-key',
      },

      // Logging disabled for cleaner test output
      log: {
        startUp: false,
        shutdown: false,
      },
    };

    // Create and start the application
    app = new WebApplication(config);
    await app.start();

    // Wait for server to be ready (shorter timeout since we're in-process)
    await waitForServer(testPort, 15000);
  }, 20000);

  afterAll(async () => {
    if (app) {
      await app.stop();
    }
  }, 10000);

  describe('REST API Endpoints', () => {
    it('should respond to GET /api/ping', async () => {
      const response = await testServerRequest(testPort, '/api/ping');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('message', 'pong');
      expect(response.data).toHaveProperty('timestamp');
      expect(new Date(response.data.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond to POST /api/hello with name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: { name: 'Alice' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, Alice!');
      expect(response.data).toHaveProperty('receivedName', 'Alice');
      expect(response.data).toHaveProperty('timestamp');
    });

    it('should respond to POST /api/hello without name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: {},
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, World!');
      expect(response.data).toHaveProperty('receivedName', 'World');
    });

    it('should handle special characters in name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: { name: 'José María' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, José María!');
      expect(response.data).toHaveProperty('receivedName', 'José María');
    });

    it('should respond to GET /api/info', async () => {
      const response = await testServerRequest(testPort, '/api/info');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name', 'PXL Framework - Hello World API');
      expect(response.data).toHaveProperty('version', '1.0.0');
      expect(response.data).toHaveProperty('framework', '@scpxl/nodejs-framework');
      expect(response.data).toHaveProperty('endpoints');
      expect(Array.isArray(response.data.endpoints)).toBe(true);
      expect(response.data.endpoints.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await testServerRequest(testPort, '/api/unknown');
      expect(response.status).toBe(404);
    });

    it('should include CORS headers', async () => {
      const response = await testServerRequest(testPort, '/api/ping', {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('WebSocket Functionality', () => {
    it('should accept WebSocket connections', async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it.skip('should receive connection message', async () => {
      const ws = new WebSocket(wsUrl);

      const messages: any[] = [];

      const connectionMessage = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection message timeout. Received messages: ${JSON.stringify(messages)}`));
        }, 5000);

        ws.on('message', data => {
          const message = JSON.parse(data.toString());
          messages.push(message);

          if (message.type === 'hello' && message.action === 'connected') {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(connectionMessage).toHaveProperty('type', 'hello');
      expect(connectionMessage).toHaveProperty('action', 'connected');
      expect(connectionMessage.data).toHaveProperty('message');
      expect(connectionMessage.data).toHaveProperty('clientId');
      expect(connectionMessage.data.message).toContain('Connected');

      ws.close();
    });

    it.skip('should broadcast greetings to all clients', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      await Promise.all([
        new Promise<void>(resolve => client1.on('open', () => resolve())),
        new Promise<void>(resolve => client2.on('open', () => resolve())),
      ]);

      await new Promise(resolve => setTimeout(resolve, 500));

      const client1Greetings: any[] = [];
      const client2Greetings: any[] = [];

      const greetingReceived = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Greeting not received. Client1: ${client1Greetings.length}, Client2: ${client2Greetings.length}`,
            ),
          );
        }, 3000);

        let receivedCount = 0;
        const checkBoth = () => {
          receivedCount++;
          if (receivedCount >= 2) {
            clearTimeout(timeout);
            resolve();
          }
        };

        client1.on('message', data => {
          const message = JSON.parse(data.toString());
          if (message.type === 'hello' && message.action === 'greeting') {
            client1Greetings.push(message);
            checkBoth();
          }
        });

        client2.on('message', data => {
          const message = JSON.parse(data.toString());
          if (message.type === 'hello' && message.action === 'greeting') {
            client2Greetings.push(message);
            checkBoth();
          }
        });
      });

      client1.send(
        JSON.stringify({
          type: 'hello',
          action: 'greet',
          data: {
            name: 'Test User',
            message: 'Hello from test!',
          },
        }),
      );

      await greetingReceived;

      expect(client1Greetings.length).toBeGreaterThanOrEqual(1);
      expect(client2Greetings.length).toBeGreaterThanOrEqual(1);

      const greeting = client1Greetings[0];
      expect(greeting).toHaveProperty('type', 'hello');
      expect(greeting).toHaveProperty('action', 'greeting');
      expect(greeting.data).toHaveProperty('name', 'Test User');
      expect(greeting.data).toHaveProperty('message', 'Hello from test!');
      expect(greeting.data).toHaveProperty('clientId');

      client1.close();
      client2.close();
    }, 10000);
  });
});
