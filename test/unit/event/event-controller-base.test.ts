import { describe, it, expect, vi, beforeEach } from 'vitest';
import BaseEventController from '../../../src/event/controller/base.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import type { RedisInstance } from '../../../src/redis/index.js';
import type { DatabaseInstance } from '../../../src/database/index.js';

// Create a concrete test class since BaseEventController is abstract
class TestEventController extends BaseEventController {
  // Add any test-specific methods if needed
}

describe('BaseEventController', () => {
  let controller: TestEventController;
  let mockApplicationConfig: ApplicationConfig;
  let mockRedisInstance: RedisInstance;
  let mockDatabaseInstance: DatabaseInstance;

  beforeEach(() => {
    mockApplicationConfig = {
      name: 'test-app',
      instanceId: 'test-instance',
    } as ApplicationConfig;

    mockRedisInstance = {} as RedisInstance;
    mockDatabaseInstance = {} as DatabaseInstance;

    controller = new TestEventController({
      applicationConfig: mockApplicationConfig,
      redisInstance: mockRedisInstance,
      databaseInstance: mockDatabaseInstance,
    });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(controller).toBeDefined();
      expect(controller['applicationConfig']).toBe(mockApplicationConfig);
      expect(controller['redisInstance']).toBe(mockRedisInstance);
      expect(controller['databaseInstance']).toBe(mockDatabaseInstance);
    });

    it('should set workerId from cluster worker', () => {
      // Worker ID should be set from cluster.worker?.id (undefined in test environment)
      expect(controller['workerId']).toBeUndefined();
    });

    it('should initialize logger', () => {
      expect(controller['logger']).toBeDefined();
    });

    it('should initialize log methods', () => {
      expect(controller.log).toBeDefined();
      expect(controller.log.error).toBeDefined();
      expect(controller.log.info).toBeDefined();
      expect(controller.log.warn).toBeDefined();
      expect(controller.log.debug).toBeDefined();
    });
  });

  describe('log methods', () => {
    it('should log error with Error instance', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const error = new Error('Test error');
      const message = 'Error occurred';
      const meta = { context: 'test' };

      controller.log.error(error, message, meta);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta: expect.objectContaining({
          context: 'test',
          error: 'Test error',
          stack: expect.any(String),
        }),
      });
    });

    it('should log error with non-Error value', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const error = 'String error';
      const message = 'Error occurred';

      controller.log.error(error, message);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta: expect.objectContaining({
          error: 'String error',
          stack: undefined,
        }),
      });
    });

    it('should log error without message', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const error = 'Simple error';

      controller.log.error(error);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message: 'Simple error',
      });
    });

    it('should log info message', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const message = 'Info message';
      const meta = { key: 'value' };

      controller.log.info(message, meta);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta,
      });
    });

    it('should log info message without meta', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const message = 'Info message';

      controller.log.info(message);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta: undefined,
      });
    });

    it('should log warn message', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const message = 'Warning message';
      const meta = { warning: 'test' };

      controller.log.warn(message, meta);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta,
      });
    });

    it('should log debug message', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const message = 'Debug message';
      const meta = { debug: 'info' };

      controller.log.debug(message, meta);

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message,
        meta,
      });
    });
  });

  describe('error handling edge cases', () => {
    it('should handle Error with undefined stack', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const error = new Error('Test');
      delete error.stack;

      controller.log.error(error, 'Test message');

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message: 'Test message',
        meta: expect.objectContaining({
          error: 'Test',
          stack: undefined,
        }),
      });
    });

    it('should handle null as error', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');

      controller.log.error(null, 'Null error');

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message: 'Null error',
        meta: expect.objectContaining({
          error: 'null',
        }),
      });
    });

    it('should handle undefined as error', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');

      controller.log.error(undefined, 'Undefined error');

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message: 'Undefined error',
        meta: expect.objectContaining({
          error: 'undefined',
        }),
      });
    });

    it('should handle object as error', () => {
      const customSpy = vi.spyOn(controller['logger'], 'custom');
      const errorObj = { code: 'ERR123', details: 'Something went wrong' };

      controller.log.error(errorObj, 'Object error');

      expect(customSpy).toHaveBeenCalledWith({
        level: 'event',
        message: 'Object error',
        meta: expect.objectContaining({
          error: '{"code":"ERR123","details":"Something went wrong"}',
          stack: undefined,
        }),
      });
    });
  });
});
