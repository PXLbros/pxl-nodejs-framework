import { z } from 'zod';
import { defineRoute } from '@scpxl/nodejs-framework/webserver';
import type { RouteSchemaDefinition } from '@scpxl/nodejs-framework/webserver';

/**
 * Hello routes demonstrating typed route definitions with Zod schemas
 */

// Define schema inline to avoid relative import issues
const helloSchema = {
  body: z.object({
    name: z.string().min(1).max(100).optional().default('World'),
  }),
  response: {
    200: z.object({
      message: z.string(),
      timestamp: z.string(),
      receivedName: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;

export const routes = [
  /**
   * POST /api/hello-typed
   * Typed route with inline handler - full type inference for request.body
   */
  defineRoute({
    method: 'POST',
    path: '/api/hello-typed',
    schema: helloSchema,
    handler: async (request, reply) => {
      // TypeScript knows request.body has shape: { name?: string }
      const { name = 'World' } = request.body;

      return reply.send({
        message: `Hello, ${name}! (from typed route)`,
        timestamp: new Date().toISOString(),
        receivedName: name,
      });
    },
  }),
];
