import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineRoute } from '../../../src/webserver/define-route.js';
import { defineAction } from '../../../src/webserver/define-action.js';
import type { RouteSchemaDefinition } from '../../../src/webserver/webserver.interface.js';
import { WebServerRouteType } from '../../../src/webserver/webserver.interface.js';
import WebServerBaseController from '../../../src/webserver/controller/base.js';

describe('defineRoute', () => {
  describe('with inline handler', () => {
    it('should create a route with handler and schema', () => {
      const schema = {
        body: z.object({ name: z.string() }),
        response: { 200: z.object({ message: z.string() }) },
      } satisfies RouteSchemaDefinition;

      const route = defineRoute({
        method: 'POST',
        path: '/hello',
        schema,
        handler: async (request, reply) => {
          // Type inference test - this should not have type errors
          const name: string = request.body.name;
          return reply.send({ message: `Hello ${name}` });
        },
      });

      expect(route).toEqual({
        type: WebServerRouteType.Default,
        method: 'POST',
        path: '/hello',
        schema,
        handler: expect.any(Function),
      });
    });

    it('should create a route without schema', () => {
      const route = defineRoute({
        method: 'GET',
        path: '/ping',
        handler: async (_request, reply) => {
          return reply.send({ status: 'ok' });
        },
      });

      expect(route).toEqual({
        type: WebServerRouteType.Default,
        method: 'GET',
        path: '/ping',
        handler: expect.any(Function),
      });
    });

    it('should support multiple HTTP methods', () => {
      const route = defineRoute({
        method: ['GET', 'POST'],
        path: '/multi',
        handler: async (_request, reply) => {
          return reply.send({ ok: true });
        },
      });

      expect(route.method).toEqual(['GET', 'POST']);
    });

    it('should create route with params schema', () => {
      const schema = {
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ id: z.string() }) },
      } satisfies RouteSchemaDefinition;

      const route = defineRoute({
        method: 'GET',
        path: '/items/:id',
        schema,
        handler: async (request, reply) => {
          const id: string = request.params.id;
          return reply.send({ id });
        },
      });

      expect(route.schema).toBeDefined();
      expect(route.path).toBe('/items/:id');
    });

    it('should create route with querystring schema', () => {
      const schema = {
        querystring: z.object({ search: z.string().optional() }),
        response: { 200: z.object({ results: z.array(z.string()) }) },
      } satisfies RouteSchemaDefinition;

      const route = defineRoute({
        method: 'GET',
        path: '/search',
        schema,
        handler: async (request, reply) => {
          const search: string | undefined = request.query.search;
          return reply.send({ results: search ? [search] : [] });
        },
      });

      expect(route.schema).toBeDefined();
    });
  });

  describe('with controller and action', () => {
    class TestController extends WebServerBaseController {
      testAction = async () => {
        return { success: true };
      };
    }

    it('should create a route with controller and action', () => {
      const route = defineRoute({
        method: 'POST',
        path: '/test',
        controller: TestController,
        action: 'testAction',
      });

      expect(route).toEqual({
        type: WebServerRouteType.Default,
        method: 'POST',
        path: '/test',
        controller: TestController,
        action: 'testAction',
      });
    });

    it('should create a route with controller, action, and schema', () => {
      const schema = {
        body: z.object({ data: z.string() }),
      } satisfies RouteSchemaDefinition;

      const route = defineRoute({
        method: 'POST',
        path: '/test',
        controller: TestController,
        action: 'testAction',
        schema,
      });

      expect(route.schema).toBeDefined();
      expect(route.controller).toBe(TestController);
      expect(route.action).toBe('testAction');
    });
  });
});

describe('defineAction', () => {
  it('should define a typed action with schema', () => {
    const schema = {
      body: z.object({ name: z.string() }),
      response: { 200: z.object({ message: z.string() }) },
    } satisfies RouteSchemaDefinition;

    const action = defineAction(schema, async (request, reply) => {
      // Type inference test
      const name: string = request.body.name;
      return reply.send({ message: `Hello ${name}` });
    });

    expect(action).toBeTypeOf('function');
  });

  it('should define an action without schema', () => {
    const action = defineAction(async (_request, reply) => {
      return reply.send({ ok: true });
    });

    expect(action).toBeTypeOf('function');
  });

  it('should work in a controller class', () => {
    const helloSchema = {
      body: z.object({ name: z.string() }),
      response: { 200: z.object({ greeting: z.string() }) },
    } satisfies RouteSchemaDefinition;

    class MyController extends WebServerBaseController {
      hello = defineAction(helloSchema, async (request, reply) => {
        const name: string = request.body.name;
        return reply.send({ greeting: `Hello ${name}` });
      });

      ping = defineAction(async (_request, reply) => {
        return reply.send({ status: 'pong' });
      });
    }

    expect(MyController).toBeDefined();
  });
});
