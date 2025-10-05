import { describe, it, expect } from 'vitest';
import { defineAction } from '../../../src/webserver/define-action.js';
import { z } from 'zod';
import type { RouteSchemaDefinition } from '../../../src/webserver/webserver.interface.js';

describe('defineAction', () => {
  describe('with schema', () => {
    it('should return handler when schema is provided', () => {
      const schema = {
        body: z.object({ name: z.string() }),
      } satisfies RouteSchemaDefinition;

      const handler = async (request: any, reply: any) => {
        return reply.send({ message: `Hello ${request.body.name}` });
      };

      const action = defineAction(schema, handler);

      expect(action).toBe(handler);
    });

    it('should throw error when schema is provided but handler is missing', () => {
      const schema = {
        body: z.object({ name: z.string() }),
      } satisfies RouteSchemaDefinition;

      expect(() => {
        // @ts-expect-error Testing invalid call
        defineAction(schema);
      }).toThrow('Handler is required when schema is provided');
    });
  });

  describe('without schema', () => {
    it('should return handler when no schema is provided', () => {
      const handler = async (request: any, reply: any) => {
        return reply.send({ message: 'Hello' });
      };

      const action = defineAction(handler);

      expect(action).toBe(handler);
    });
  });
});
