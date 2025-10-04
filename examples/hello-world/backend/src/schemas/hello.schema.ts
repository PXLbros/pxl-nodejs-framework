import { z } from 'zod';
import type { RouteSchemaDefinition } from '@scpxl/nodejs-framework/webserver';

/**
 * Schema for POST /api/hello endpoint
 * Accepts a name and returns a personalized greeting
 */
export const helloSchema = {
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
