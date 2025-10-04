import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebServerPerformanceWrapper } from '../../../src/performance/webserver-performance.js';

const mockMonitor = {
  startMeasure: vi.fn(() => 'measure-start'),
  endMeasure: vi.fn(),
  measureAsync: vi.fn(async ({ fn }) => fn()),
};

describe('WebServerPerformanceWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WebServerPerformanceWrapper.setPerformanceMonitor(mockMonitor as any);
  });

  describe('createPerformanceMiddleware', () => {
    it('starts measurements and stores metadata for requests', async () => {
      const middleware = WebServerPerformanceWrapper.createPerformanceMiddleware({ includeHeaders: true });
      const request: any = {
        method: 'GET',
        url: '/users',
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
          host: 'localhost',
        },
      };
      const reply: any = {};

      await middleware(request, reply);

      expect(mockMonitor.startMeasure).toHaveBeenCalledWith('GET /users', 'http');
      expect(request.performanceMetadata).toEqual({
        method: 'GET',
        url: '/users',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        headers: request.headers,
      });
      expect(request.performanceStartMark).toBe('measure-start');
    });

    it('skips configured routes and methods', async () => {
      const middleware = WebServerPerformanceWrapper.createPerformanceMiddleware({
        skipRoutes: ['/health/live'],
        skipMethods: ['OPTIONS'],
      });
      const requestRoute: any = { method: 'GET', url: '/health/live', headers: {} };
      const requestMethod: any = { method: 'OPTIONS', url: '/users', headers: {} };

      await middleware(requestRoute, {} as any);
      await middleware(requestMethod, {} as any);

      expect(mockMonitor.startMeasure).not.toHaveBeenCalled();
      expect(requestRoute.performanceMetadata).toBeUndefined();
      expect(requestMethod.performanceMetadata).toBeUndefined();
    });
  });

  describe('createPerformanceHooks', () => {
    it('finalizes measurements on response send', async () => {
      const hooks = WebServerPerformanceWrapper.createPerformanceHooks();
      const request: any = {
        performanceStartMark: 'measure-start',
        performanceMetadata: {
          method: 'GET',
          url: '/users',
          ip: '127.0.0.1',
        },
      };
      const reply: any = { statusCode: 200 };
      const payload = JSON.stringify({ ok: true });

      const result = await hooks.onSend(request, reply, payload);

      expect(result).toBe(payload);
      expect(mockMonitor.endMeasure).toHaveBeenCalledWith('measure-start', {
        method: 'GET',
        url: '/users',
        ip: '127.0.0.1',
        statusCode: 200,
        contentLength: payload.length,
      });
    });

    it('records error metadata when response fails', async () => {
      const hooks = WebServerPerformanceWrapper.createPerformanceHooks();
      const request: any = {
        performanceStartMark: 'measure-start',
        performanceMetadata: { method: 'POST', url: '/users' },
      };
      const reply: any = { statusCode: 500 };
      const error = new Error('boom');

      await hooks.onError(request, reply, error);

      expect(mockMonitor.endMeasure).toHaveBeenCalledWith('measure-start', {
        method: 'POST',
        url: '/users',
        statusCode: 500,
        error: 'boom',
        errorName: 'Error',
      });
    });
  });

  describe('monitor helpers', () => {
    it('wraps controller methods with measureAsync', async () => {
      const operation = vi.fn().mockResolvedValue('done');

      const result = await WebServerPerformanceWrapper.monitorControllerMethod({
        controllerName: 'UserController',
        methodName: 'list',
        operation,
        metadata: { count: 5 },
      });

      expect(result).toBe('done');
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'UserController.list',
        type: 'http',
        fn: operation,
        metadata: { controller: 'UserController', method: 'list', count: 5 },
      });
    });

    it('wraps route handlers with measureAsync', async () => {
      const operation = vi.fn().mockResolvedValue('ok');

      await WebServerPerformanceWrapper.monitorRouteHandler({
        route: '/users',
        method: 'GET',
        operation,
        metadata: { page: 1 },
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'GET /users',
        type: 'http',
        fn: operation,
        metadata: { route: '/users', method: 'GET', page: 1 },
      });
    });

    it('wraps middleware with measureAsync', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await WebServerPerformanceWrapper.monitorMiddleware({
        middlewareName: 'validate-request',
        operation,
        metadata: { phase: 'pre-handler' },
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'middleware.validate-request',
        type: 'http',
        fn: operation,
        metadata: { middleware: 'validate-request', phase: 'pre-handler' },
      });
    });
  });
});
