import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock } from 'node:test';
import WebServer from '../../../src/webserver/webserver.js';
import { mockRedisInstance } from '../../utils/mocks/redis-mocks.js';
import { mockDatabaseInstance } from '../../utils/mocks/database-mocks.js';
import { mockQueueManager } from '../../utils/mocks/queue-mocks.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import type { WebServerOptions, WebServerRoute } from '../../../src/webserver/webserver.interface.js';
import { WebServerRouteType } from '../../../src/webserver/webserver.interface.js';
import { z } from 'zod';

// Mock Fastify
vi.mock('fastify', () => {
  const mockFastifyInstance = {
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    addHook: vi.fn(),
    route: vi.fn(),
    printRoutes: vi.fn().mockReturnValue('mocked routes'),
    setValidatorCompiler: vi.fn(),
    setSerializerCompiler: vi.fn(),
    server: {
      listening: true,
      address: vi.fn().mockReturnValue({ port: 3001 }),
    },
    version: '4.0.0',
  };

  // Add withTypeProvider method that returns the instance
  mockFastifyInstance.withTypeProvider = vi.fn(() => mockFastifyInstance);

  return {
    default: vi.fn(() => mockFastifyInstance),
  };
});

// Mock plugins
vi.mock('@fastify/cors', () => ({ default: vi.fn() }));
vi.mock('@fastify/helmet', () => ({ default: vi.fn() }));
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));
vi.mock('@fastify/multipart', () => ({ default: vi.fn() }));

// Mock fastify-type-provider-zod
vi.mock('fastify-type-provider-zod', () => ({
  serializerCompiler: vi.fn(),
  validatorCompiler: vi.fn(),
}));

// Mock utilities
vi.mock('../../../src/util/index.js', async () => {
  const actual = await vi.importActual('../../../src/util/index.js');
  return {
    ...actual,
    File: {
      pathExists: vi.fn().mockResolvedValue(false),
    },
    Loader: {
      loadModulesInDirectory: vi.fn().mockResolvedValue({}),
      loadEntityModule: vi.fn().mockResolvedValue({ schema: null }),
    },
  };
});

// Mock logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('WebServer', () => {
  let applicationConfig: ApplicationConfig;
  let options: WebServerOptions;
  let routes: WebServerRoute[] | undefined;
  let mockEventManager: any;
  let mockLifecycleManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    applicationConfig = {
      name: 'test-app',
      instanceId: 'test-instance',
      rootDirectory: '/test/root',
    };

    options = {
      host: '0.0.0.0',
      port: 3001,
      controllersDirectory: '/test/controllers',
      cors: { enabled: false },
      security: { helmet: { enabled: true }, rateLimit: { enabled: true } },
      debug: { printRoutes: false, simulateSlowConnection: { enabled: false, delay: 0 } },
      log: { startUp: false },
    };

    routes = [];

    mockEventManager = {
      emit: mock.fn(),
      on: mock.fn(),
    };

    mockLifecycleManager = {
      registerComponent: mock.fn(),
      shutdown: mock.fn(),
      addReadinessCheck: mock.fn(),
    };
  });

  describe('constructor', () => {
    it('should create WebServer instance with default options', () => {
      const webServer = new WebServer({
        applicationConfig,
        options: {},
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      expect(webServer).toBeDefined();
      expect(webServer.fastifyServer).toBeDefined();
    });

    it('should merge provided options with defaults', () => {
      const customOptions = {
        host: '127.0.0.1',
        port: 4000,
      };

      const webServer = new WebServer({
        applicationConfig,
        options: customOptions,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      expect(webServer).toBeDefined();
    });

    it('should use custom bodyLimit and connectionTimeout', () => {
      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          bodyLimit: 50 * 1024 * 1024,
          connectionTimeout: 20 * 1000,
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      expect(webServer).toBeDefined();
    });
  });

  describe('load', () => {
    it('should load webserver and configure all components', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      // Verify that fastify register was called for plugins
      expect(webServer.fastifyServer.register).toHaveBeenCalled();
      expect(webServer.fastifyServer.addHook).toHaveBeenCalledWith('onListen', expect.any(Function));
      expect(webServer.fastifyServer.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
      expect(webServer.fastifyServer.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
      expect(webServer.fastifyServer.addHook).toHaveBeenCalledWith('onError', expect.any(Function));
      expect(webServer.fastifyServer.addHook).toHaveBeenCalledWith('onClose', expect.any(Function));
    });

    it('should configure CORS when enabled', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          cors: { enabled: true, urls: ['http://localhost:3000'] },
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      expect(webServer.fastifyServer.register).toHaveBeenCalled();
    });

    it('should configure multipart uploads', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      expect(webServer.fastifyServer.register).toHaveBeenCalled();
    });

    it('should load routes from configured routes directory', async () => {
      const routesDirectory = '/test/routes';
      const { File, Loader } = await import('../../../src/util/index.js');

      class AutoController {
        public auto = vi.fn();

        public constructor(..._args: any[]) {}
      }

      vi.mocked(File.pathExists).mockImplementation(async path => {
        if (path === routesDirectory) {
          return true;
        }

        if (path === options.controllersDirectory) {
          return true;
        }

        return false;
      });

      vi.mocked(Loader.loadModulesInDirectory).mockImplementation(async ({ directory }) => {
        if (directory === routesDirectory) {
          return {
            autoRoutes: {
              type: WebServerRouteType.Default,
              method: 'GET',
              path: '/auto-loaded',
              controller: AutoController,
              action: 'auto',
            },
          };
        }

        return {};
      });

      routes = undefined;

      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          routesDirectory,
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      expect(webServer.fastifyServer.route).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/auto-loaded',
          method: 'GET',
        }),
      );

      vi.mocked(File.pathExists).mockResolvedValue(false);
      vi.mocked(Loader.loadModulesInDirectory).mockResolvedValue({});
    });

    it('should throw a helpful error when routesDirectory and explicit routes are both configured', async () => {
      const routesDirectory = '/conflict/routes';

      class StaticController {
        public index = vi.fn();
      }

      routes = [
        {
          type: WebServerRouteType.Default,
          method: 'GET',
          path: '/static',
          controller: StaticController,
          action: 'index',
        },
      ];

      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          routesDirectory,
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await expect(webServer.load()).rejects.toThrow(/Invalid web server configuration/);
    });

    it('should register routes with Zod schemas via handler-only definitions', async () => {
      routes = [
        {
          type: WebServerRouteType.Default,
          method: 'POST',
          path: '/typed',
          handler: vi.fn(),
          schema: {
            body: z.object({ name: z.string() }),
            response: {
              200: z.object({ ok: z.boolean() }),
            },
          },
        } as WebServerRoute,
      ];

      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      // With fastify-type-provider-zod, we now pass Zod schemas directly
      // The schema should be the raw Zod object, not converted to JSON Schema
      const routeCalls = vi.mocked(webServer.fastifyServer.route).mock.calls;
      const typedRouteCall = routeCalls.find((call: any) => call[0].url === '/typed');

      expect(typedRouteCall).toBeDefined();
      expect(typedRouteCall![0]).toMatchObject({
        url: '/typed',
        method: 'POST',
      });
      // Schema is passed as-is (Zod schemas), not converted
      expect(typedRouteCall![0].schema).toBeDefined();
      expect(typedRouteCall![0].schema.body).toBeDefined();
      expect(typedRouteCall![0].schema.response).toBeDefined();
    });

    it('should add health check routes', async () => {
      const { File } = await import('../../../src/util/index.js');
      vi.mocked(File.pathExists).mockResolvedValue(true);

      const webServer = new WebServer({
        applicationConfig,
        options,
        routes: [],
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      // Health routes should be added
      expect(webServer.fastifyServer.route).toHaveBeenCalled();
    });

    it('should skip security configuration when disabled', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          security: {
            helmet: { enabled: false },
            rateLimit: { enabled: false },
          },
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      expect(webServer).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start the webserver', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();
      await webServer.start();

      expect(webServer.fastifyServer.listen).toHaveBeenCalledWith({
        host: options.host,
        port: options.port,
      });
    });

    it('should stop the webserver', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();
      await webServer.start();
      await webServer.stop();

      expect(webServer.fastifyServer.close).toHaveBeenCalled();
    });

    it('should handle start errors', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const error = new Error('Failed to start');
      vi.mocked(webServer.fastifyServer.listen).mockRejectedValueOnce(error);

      await expect(webServer.start()).rejects.toThrow('Failed to start');
    });
  });

  describe('isReady', () => {
    it('should return false before start', () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      expect(webServer.isReady()).toBe(false);
    });

    it('should return true after start', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();
      await webServer.start();

      expect(webServer.isReady()).toBe(true);
    });

    it('should return false after stop', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();
      await webServer.start();
      await webServer.stop();

      expect(webServer.isReady()).toBe(false);
    });
  });

  describe('defineRoute', () => {
    it('should define a route with valid controller action', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const mockControllerInstance = {
        testAction: vi.fn(),
      };

      await webServer.defineRoute({
        controllerInstance: mockControllerInstance,
        controllerName: 'TestController',
        routeMethod: 'GET',
        routePath: '/test',
        routeAction: 'testAction',
      });

      expect(webServer.fastifyServer.route).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          handler: expect.any(Function),
        }),
      );
    });

    it('should throw error for invalid action name', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const mockControllerInstance = {
        testAction: vi.fn(),
      };

      await expect(
        webServer.defineRoute({
          controllerInstance: mockControllerInstance,
          controllerName: 'TestController',
          routeMethod: 'GET',
          routePath: '/test',
          routeAction: '__proto__',
        }),
      ).rejects.toThrow('Invalid controller action name');
    });

    it('should throw error when controller action not found', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const mockControllerInstance = {};

      await expect(
        webServer.defineRoute({
          controllerInstance: mockControllerInstance,
          controllerName: 'TestController',
          routeMethod: 'GET',
          routePath: '/test',
          routeAction: 'missingAction',
        }),
      ).rejects.toThrow('Web server controller action not found');
    });
  });

  describe('log', () => {
    it('should log messages using Logger', async () => {
      const webServer = new WebServer({
        applicationConfig,
        options,
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const { Logger } = await import('../../../src/logger/index.js');

      webServer.log('Test message', { test: 'meta' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'webServer',
        message: 'Test message',
        meta: { test: 'meta' },
      });
    });
  });

  describe('CORS warnings', () => {
    it('should warn about wildcard CORS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const webServer = new WebServer({
        applicationConfig,
        options: {
          ...options,
          cors: { enabled: true, urls: ['*'] },
        },
        routes,
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const { Logger } = await import('../../../src/logger/index.js');

      await webServer.load();

      expect(Logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Wildcard CORS'),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('route configuration', () => {
    it('should warn when controllers directory not found', async () => {
      const { File } = await import('../../../src/util/index.js');
      vi.mocked(File.pathExists).mockResolvedValue(false);

      const webServer = new WebServer({
        applicationConfig,
        options,
        routes: [],
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      await webServer.load();

      const LoggerModule = await import('../../../src/logger/index.js');
      expect(LoggerModule.Logger.warn).toHaveBeenCalled();
    });
  });
});
