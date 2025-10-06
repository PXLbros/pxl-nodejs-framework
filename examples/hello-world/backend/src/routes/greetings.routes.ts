import { z } from 'zod';
import { defineRoute } from '@scpxl/nodejs-framework/webserver';
import type { RouteSchemaDefinition } from '@scpxl/nodejs-framework/webserver';
import {
  NumericIdSchema,
  NonEmptyStringSchema,
  TimestampSchema,
  ErrorResponseSchema,
} from '@scpxl/nodejs-framework/schemas';

/**
 * Greetings routes demonstrating typed CRUD operations with Zod schemas
 * These routes use common reusable schemas from the framework for consistency
 */

// Reusable Greeting schema using common framework schemas
const GreetingSchema = z
  .object({
    id: NumericIdSchema,
    name: NonEmptyStringSchema.max(100),
    message: NonEmptyStringSchema.max(500),
  })
  .merge(TimestampSchema);

// Define schemas using common framework patterns
const getGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  response: {
    200: z.object({
      greeting: GreetingSchema,
    }),
    404: ErrorResponseSchema,
  },
} satisfies RouteSchemaDefinition;

const createGreetingSchema = {
  body: GreetingSchema.omit({ id: true, createdAt: true, updatedAt: true }),
  response: {
    201: z.object({
      greeting: GreetingSchema,
    }),
    400: ErrorResponseSchema,
  },
} satisfies RouteSchemaDefinition;

const updateGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  body: GreetingSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
  response: {
    200: z.object({
      greeting: GreetingSchema,
    }),
    404: ErrorResponseSchema,
  },
} satisfies RouteSchemaDefinition;

const deleteGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  response: {
    204: z.undefined(),
    404: ErrorResponseSchema,
  },
} satisfies RouteSchemaDefinition;

export const routes = [
  /**
   * GET /api/greetings-typed/:id
   * Get a greeting by ID with typed params
   */
  defineRoute({
    method: 'GET',
    path: '/api/greetings-typed/:id',
    schema: getGreetingSchema,
    handler: async (request, reply) => {
      // TypeScript knows request.params has shape: { id: string }
      const { id } = request.params;

      // Note: In a real application, you'd get databaseInstance from somewhere
      // For this demo, we'll show the type-safe structure
      // const em = databaseInstance.getEntityManager();
      // const greeting = await em.findOne(Greeting, { id: parseInt(id, 10) });

      // Mock response for demonstration
      const greeting = null;

      if (!greeting) {
        return reply.status(404).send({ error: 'Greeting not found' });
      }

      return reply.send({ greeting });
    },
  }),

  /**
   * POST /api/greetings-typed
   * Create a greeting with typed body
   */
  defineRoute({
    method: 'POST',
    path: '/api/greetings-typed',
    schema: createGreetingSchema,
    handler: async (request, reply) => {
      // TypeScript knows request.body has shape: { name: string, message: string }
      const { name, message } = request.body;

      // Validation already happened via Zod schema
      // const em = databaseInstance.getEntityManager();
      // const greeting = em.create(Greeting, { name, message });
      // await em.persistAndFlush(greeting);

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
  }),

  /**
   * PUT /api/greetings-typed/:id
   * Update a greeting with typed params and body
   */
  defineRoute({
    method: 'PUT',
    path: '/api/greetings-typed/:id',
    schema: updateGreetingSchema,
    handler: async (request, reply) => {
      // TypeScript knows request.params has { id: string }
      // and request.body has { name?: string, message?: string }
      const { id } = request.params;
      const body = request.body;

      // Mock response
      const greeting = null;

      if (!greeting) {
        return reply.status(404).send({ error: 'Greeting not found' });
      }

      return reply.send({ greeting });
    },
  }),

  /**
   * DELETE /api/greetings-typed/:id
   * Delete a greeting with typed params
   */
  defineRoute({
    method: 'DELETE',
    path: '/api/greetings-typed/:id',
    schema: deleteGreetingSchema,
    handler: async (request, reply) => {
      // TypeScript knows request.params has { id: string }
      const { id } = request.params;

      // Mock response
      const greeting = null;

      if (!greeting) {
        return reply.status(404).send({ error: 'Greeting not found' });
      }

      return reply.status(204).send();
    },
  }),
];
