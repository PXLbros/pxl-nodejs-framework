import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'node:test';
import { StatusCodes } from 'http-status-codes';
import BaseController from '../../../../src/webserver/controller/base.js';
import { mockRedisInstance } from '../../../utils/mocks/redis-mocks.js';
import { mockDatabaseInstance } from '../../../utils/mocks/database-mocks.js';
import { mockQueueManager } from '../../../utils/mocks/queue-mocks.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Mock JWT
vi.mock('../../../../src/auth/jwt.js', () => ({
  default: {
    importJwtSecretKey: vi.fn().mockResolvedValue('mock-secret-key'),
    jwtVerify: vi.fn().mockResolvedValue({
      payload: { sub: '123', exp: Date.now() + 3600000 },
    }),
  },
}));

// Mock Logger
vi.mock('../../../../src/logger/index.js', () => ({
  Logger: {
    custom: vi.fn(),
    error: vi.fn(),
  },
}));

// Concrete implementation for testing
class TestController extends BaseController {
  public testMethod() {
    return 'test';
  }

  public async testAuthenticateRequest(request: FastifyRequest, reply: FastifyReply) {
    return this.authenticateRequest(request, reply);
  }

  public testSendSuccessResponse(args: any) {
    return this.sendSuccessResponse(args);
  }

  public testSendNotFoundResponse(reply: FastifyReply, message?: string) {
    return this.sendNotFoundResponse(reply, message);
  }

  public testSendErrorResponse(args: any) {
    return this.sendErrorResponse(args);
  }
}

describe('BaseController', () => {
  let controller: TestController;
  let mockReply: FastifyReply;
  let mockRequest: FastifyRequest;
  let mockEventManager: any;
  let mockLifecycleManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEventManager = {
      emit: mock.fn(),
      on: mock.fn(),
    };

    mockLifecycleManager = {
      registerComponent: mock.fn(),
      shutdown: mock.fn(),
    };

    controller = new TestController({
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test',
      },
      webServerOptions: {
        host: '0.0.0.0',
        port: 3001,
        controllersDirectory: '/test/controllers',
        errors: { verbose: false },
      },
      redisInstance: mockRedisInstance as any,
      queueManager: mockQueueManager as any,
      eventManager: mockEventManager,
      databaseInstance: mockDatabaseInstance as any,
      lifecycleManager: mockLifecycleManager,
    });

    // Create mock Fastify request and reply
    mockRequest = {
      id: 'test-request-id',
      headers: {},
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      request: mockRequest,
    } as any;
  });

  describe('constructor', () => {
    it('should initialize controller with dependencies', () => {
      expect(controller).toBeDefined();
      expect(controller.testMethod()).toBe('test');
    });
  });

  describe('sendSuccessResponse', () => {
    it('should send success response with data', () => {
      const data = { message: 'Success' };

      controller.testSendSuccessResponse({
        reply: mockReply,
        data,
      });

      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
          meta: expect.objectContaining({
            timestamp: expect.any(String),
            requestId: 'test-request-id',
          }),
        }),
      );
    });

    it('should send success response with custom status code', () => {
      const data = { message: 'Created' };

      controller.testSendSuccessResponse({
        reply: mockReply,
        data,
        statusCode: StatusCodes.CREATED,
      });

      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        }),
      );
    });

    it('should include custom meta in response', () => {
      const data = { message: 'Success' };
      const customMeta = { custom: 'value' };

      controller.testSendSuccessResponse({
        reply: mockReply,
        data,
        meta: customMeta,
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            custom: 'value',
          }),
        }),
      );
    });
  });

  describe('sendNotFoundResponse', () => {
    it('should send not found response with default message', () => {
      controller.testSendNotFoundResponse(mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Resource not found',
            type: 'not_found',
            timestamp: expect.any(String),
            requestId: 'test-request-id',
          }),
        }),
      );
    });

    it('should send not found response with custom message', () => {
      const customMessage = 'User not found';

      controller.testSendNotFoundResponse(mockReply, customMessage);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: customMessage,
          }),
        }),
      );
    });
  });

  describe('sendErrorResponse', () => {
    it('should send error response with Error instance in development', () => {
      const error = new Error('Test error');

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
      });

      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Test error'),
            type: 'validation',
          }),
        }),
      );
    });

    it('should send error response with string error in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = 'Custom error message';

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Custom error message',
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should send generic message for Error in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal error');

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Something went wrong',
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error details when verbose is enabled', () => {
      const verboseController = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
          errors: { verbose: true },
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const error = new Error('Verbose error');

      verboseController.testSendErrorResponse({
        reply: mockReply,
        error,
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Verbose error'),
            details: expect.objectContaining({
              stack: expect.any(String),
              name: 'Error',
            }),
          }),
        }),
      );
    });

    it('should use custom status code', () => {
      const error = new Error('Unauthorized');

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
        statusCode: StatusCodes.UNAUTHORIZED,
      });

      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });

    it('should use custom error type', () => {
      const error = new Error('Test error');

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
        errorType: 'authentication',
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'authentication',
          }),
        }),
      );
    });

    it('should handle non-Error objects in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = { weird: 'object' };

      controller.testSendErrorResponse({
        reply: mockReply,
        error,
      });

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'An unknown error occurred',
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('authenticateRequest', () => {
    it('should authenticate valid JWT token', async () => {
      const controllerWithAuth = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          auth: {
            jwtSecretKey: 'test-secret',
          },
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      mockRequest.headers.authorization = 'Bearer valid-token';

      const result = await controllerWithAuth.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toEqual({
        userId: 123,
        payload: { sub: '123', exp: expect.any(Number) },
      });
    });

    it('should return null when JWT secret not configured', async () => {
      mockRequest.headers.authorization = 'Bearer token';

      const result = await controller.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toBeNull();
      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return null when no auth header provided', async () => {
      const controllerWithAuth = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          auth: {
            jwtSecretKey: 'test-secret',
          },
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      const result = await controllerWithAuth.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toBeNull();
      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });

    it('should return null when auth header does not start with Bearer', async () => {
      const controllerWithAuth = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          auth: {
            jwtSecretKey: 'test-secret',
          },
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      mockRequest.headers.authorization = 'Basic token';

      const result = await controllerWithAuth.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toBeNull();
      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });

    it('should return null when token verification fails', async () => {
      const Jwt = await import('../../../../src/auth/jwt.js');
      vi.mocked(Jwt.default.jwtVerify).mockRejectedValueOnce(new Error('Invalid token'));

      const controllerWithAuth = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          auth: {
            jwtSecretKey: 'test-secret',
          },
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      mockRequest.headers.authorization = 'Bearer invalid-token';

      const result = await controllerWithAuth.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toBeNull();
      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });

    it('should return null when token payload has no sub', async () => {
      const Jwt = await import('../../../../src/auth/jwt.js');
      vi.mocked(Jwt.default.jwtVerify).mockResolvedValueOnce({
        payload: { exp: Date.now() + 3600000 },
      } as any);

      const controllerWithAuth = new TestController({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          auth: {
            jwtSecretKey: 'test-secret',
          },
        },
        webServerOptions: {
          host: '0.0.0.0',
          port: 3001,
          controllersDirectory: '/test/controllers',
        },
        redisInstance: mockRedisInstance as any,
        queueManager: mockQueueManager as any,
        eventManager: mockEventManager,
        databaseInstance: mockDatabaseInstance as any,
        lifecycleManager: mockLifecycleManager,
      });

      mockRequest.headers.authorization = 'Bearer token-without-sub';

      const result = await controllerWithAuth.testAuthenticateRequest(mockRequest, mockReply);

      expect(result).toBeNull();
      expect(mockReply.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });
  });
});
