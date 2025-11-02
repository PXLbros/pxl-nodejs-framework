import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { WebApplication } from '../../../src/application/index.js';
import type { WebApplicationConfig } from '../../../src/application/index.js';
import { defineRoute, type RouteSchemaDefinition } from '../../../src/webserver/index.js';
import { waitForServer } from '../../utils/helpers/test-server.js';

describe('Hello World - Typed Routes Integration', () => {
  let app: WebApplication;
  let baseUrl: string;

  beforeAll(async () => {
    // Use in-memory Redis for testing to avoid requiring external Redis instance
    process.env.PXL_REDIS_IN_MEMORY = 'true';

    const port = 4100; // Use different port to avoid conflicts
    baseUrl = `http://localhost:${port}`;

    const config: WebApplicationConfig = {
      name: 'hello-world-typed-routes-test',
      instanceId: 'test-typed-routes',
      rootDirectory: process.cwd(),

      webServer: {
        enabled: true,
        host: '0.0.0.0',
        port,
        cors: {
          enabled: true,
          urls: ['*'],
        },
        log: {
          startUp: false,
        },
        debug: {
          printRoutes: false,
        },
        // Include typed routes - handlers defined inline with proper validation
        routes: [
          {
            type: 'default',
            method: 'GET',
            path: '/api/ping',
            handler: async (_request, reply) => {
              return reply.send({
                status: 'ok',
                message: 'pong',
                timestamp: new Date().toISOString(),
              });
            },
          } as any,
          // POST /api/hello-typed - with schema validation
          defineRoute({
            method: 'POST',
            path: '/api/hello-typed',
            schema: {
              body: z.object({
                name: z.string().min(1).max(100).optional().default('World'),
              }),
            } as RouteSchemaDefinition,
            handler: async (request, reply) => {
              const body = request.body as { name?: string };
              const { name = 'World' } = body || {};
              return reply.send({
                message: `Hello, ${name}! (from typed route)`,
                timestamp: new Date().toISOString(),
                receivedName: name,
              });
            },
          }) as any,
          // GET /api/greetings-typed/:id
          defineRoute({
            method: 'GET',
            path: '/api/greetings-typed/:id',
            schema: {
              params: z.object({
                id: z.string().regex(/^\d+$/, 'ID must be a number'),
              }),
            } as RouteSchemaDefinition,
            handler: async (_request, reply) => {
              // Mock implementation - returns 404 as expected by test
              return reply.status(404).send({ error: 'Greeting not found' });
            },
          }) as any,
          // POST /api/greetings-typed
          defineRoute({
            method: 'POST',
            path: '/api/greetings-typed',
            schema: {
              body: z.object({
                name: z.string().min(1).max(100),
                message: z.string().min(1).max(500),
              }),
            } as RouteSchemaDefinition,
            handler: async (request, reply) => {
              const body = request.body as { name: string; message: string };
              const { name, message } = body;
              // Mock response
              const greeting = {
                id: 1,
                name,
                message,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              return reply.status(201).send({ greeting });
            },
          }) as any,
          // PUT /api/greetings-typed/:id
          defineRoute({
            method: 'PUT',
            path: '/api/greetings-typed/:id',
            schema: {
              params: z.object({
                id: z.string().regex(/^\d+$/, 'ID must be a number'),
              }),
              body: z
                .object({
                  name: z.string().min(1).max(100).optional(),
                  message: z.string().min(1).max(500).optional(),
                })
                .strict()
                .optional(),
            } as RouteSchemaDefinition,
            handler: async (_request, reply) => {
              // Mock implementation - returns 404 as expected by test
              return reply.status(404).send({ error: 'Greeting not found' });
            },
          }) as any,
          // DELETE /api/greetings-typed/:id
          defineRoute({
            method: 'DELETE',
            path: '/api/greetings-typed/:id',
            schema: {
              params: z.object({
                id: z.string().regex(/^\d+$/, 'ID must be a number'),
              }),
            } as RouteSchemaDefinition,
            handler: async (_request, reply) => {
              // Mock implementation - returns 404 as expected by test
              return reply.status(404).send({ error: 'Greeting not found' });
            },
          }) as any,
        ],
      },

      redis: {
        host: 'localhost',
        port: 6379,
      },

      queue: {
        processorsDirectory: './processors',
        queues: [],
      },

      auth: {
        jwtSecretKey: 'test-secret',
      },
    };

    app = new WebApplication(config);
    await app.start();

    // Wait for server to be ready with proper timeout
    await waitForServer(port, 30000);
  });

  afterAll(async () => {
    if (app) {
      await app.stop();
    }
  });

  describe('POST /api/hello-typed', () => {
    it('should accept valid request with name', async () => {
      const response = await fetch(`${baseUrl}/api/hello-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'TypeScript' }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        message: 'Hello, TypeScript! (from typed route)',
        receivedName: 'TypeScript',
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should use default name when not provided', async () => {
      const response = await fetch(`${baseUrl}/api/hello-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        message: 'Hello, World! (from typed route)',
        receivedName: 'World',
      });
    });

    it('should validate request body schema', async () => {
      const response = await fetch(`${baseUrl}/api/hello-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 123 }), // Invalid: should be string
      });

      // Zod validation should reject this
      expect(response.status).toBe(400);
    });

    it('should reject name that is too long', async () => {
      const longName = 'a'.repeat(101); // Max is 100

      const response = await fetch(`${baseUrl}/api/hello-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: longName }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Typed CRUD routes', () => {
    it('should handle GET /api/greetings-typed/:id with params validation', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed/1`);

      // Should either succeed or return 404, but not validation error
      expect([200, 404]).toContain(response.status);
    });

    it('should reject invalid ID format', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed/invalid`);

      // Schema requires numeric ID
      expect(response.status).toBe(400);
    });

    it('should handle POST /api/greetings-typed with body validation', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          message: 'Test message',
        }),
      });

      expect(response.status).toBe(201);
    });

    it('should reject POST with missing required fields', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          // message is missing
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject POST with message too long', async () => {
      const longMessage = 'a'.repeat(501); // Max is 500

      const response = await fetch(`${baseUrl}/api/greetings-typed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          message: longMessage,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle PUT /api/greetings-typed/:id with optional fields', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      // Should either succeed or return 404
      expect([200, 404]).toContain(response.status);
    });

    it('should handle DELETE /api/greetings-typed/:id', async () => {
      const response = await fetch(`${baseUrl}/api/greetings-typed/1`, {
        method: 'DELETE',
      });

      // Should either succeed with 204 or return 404
      expect([204, 404]).toContain(response.status);
    });
  });
});
