import { z } from 'zod';
import type { RouteSchemaDefinition } from '@scpxl/nodejs-framework/webserver';

/**
 * Schema for GET /api/greetings/:id endpoint
 * Retrieves a single greeting by ID
 */
export const getGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  response: {
    200: z.object({
      greeting: z.object({
        id: z.number(),
        name: z.string(),
        message: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;

/**
 * Schema for POST /api/greetings endpoint
 * Creates a new greeting
 */
export const createGreetingSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
  }),
  response: {
    201: z.object({
      greeting: z.object({
        id: z.number(),
        name: z.string(),
        message: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    }),
    400: z.object({
      error: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;

/**
 * Schema for PUT /api/greetings/:id endpoint
 * Updates an existing greeting
 */
export const updateGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    message: z.string().min(1).max(500).optional(),
  }),
  response: {
    200: z.object({
      greeting: z.object({
        id: z.number(),
        name: z.string(),
        message: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;

/**
 * Schema for DELETE /api/greetings/:id endpoint
 * Deletes a greeting
 */
export const deleteGreetingSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  response: {
    204: z.undefined(),
    404: z.object({
      error: z.string(),
    }),
  },
} satisfies RouteSchemaDefinition;
