import cluster from 'node:cluster';
import * as Sentry from '@sentry/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Logger from '../../../src/logger/logger.js';
import * as requestContext from '../../../src/request-context/index.js';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({})),
}));

// Mock cluster
vi.mock('node:cluster', () => ({
  default: {
    isWorker: false,
    worker: undefined,
  },
}));

// Mock request context
vi.mock('../../../src/request-context/index.js', () => ({
  getRequestId: vi.fn(),
}));

// Get the internal logger instance for spying
const instance: any = Logger;

describe('Logger', () => {
  let logSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    logSpy = vi.spyOn(instance, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Logger;
      const instance2 = Logger;
      expect(instance1).toBe(instance2);
    });

    it('should have isSentryInitialized as false initially', () => {
      expect(Logger.isSentryInitialized).toBe(false);
    });
  });

  describe('debug method', () => {
    it('should support object signature', () => {
      Logger.debug({ message: 'Debug message', meta: { foo: 'bar' }, options: {} });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: 'Debug message',
        meta: { foo: 'bar' },
        options: {},
      });
    });

    it('should support positional signature with meta', () => {
      Logger.debug('Debug message', { userId: '123' });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: 'Debug message',
        meta: { userId: '123' },
        options: undefined,
      });
    });

    it('should support positional signature without meta', () => {
      Logger.debug('Simple debug');

      expect(logSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: 'Simple debug',
        meta: undefined,
        options: undefined,
      });
    });
  });

  describe('info method', () => {
    it('should support object signature', () => {
      Logger.info({ message: 'Info message', meta: { count: 42 }, options: {} });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'info',
        message: 'Info message',
        meta: { count: 42 },
        options: {},
      });
    });

    it('should support positional signature with meta', () => {
      Logger.info('User logged in', { email: 'test@example.com' });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'info',
        message: 'User logged in',
        meta: { email: 'test@example.com' },
        options: undefined,
      });
    });

    it('should support positional signature without meta', () => {
      Logger.info('Application started');

      expect(logSpy).toHaveBeenCalledWith({
        level: 'info',
        message: 'Application started',
        meta: undefined,
        options: undefined,
      });
    });
  });

  describe('warn method', () => {
    it('should support object signature', () => {
      Logger.warn({ message: 'Warning message', meta: { retries: 3 }, options: {} });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'warn',
        message: 'Warning message',
        meta: { retries: 3 },
        options: {},
      });
    });

    it('should support positional signature with meta', () => {
      Logger.warn('Deprecated API usage', { endpoint: '/old-api' });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'warn',
        message: 'Deprecated API usage',
        meta: { endpoint: '/old-api' },
        options: undefined,
      });
    });

    it('should support positional signature without meta', () => {
      Logger.warn('Low memory warning');

      expect(logSpy).toHaveBeenCalledWith({
        level: 'warn',
        message: 'Low memory warning',
        meta: undefined,
        options: undefined,
      });
    });
  });

  describe('error method', () => {
    beforeEach(() => {
      // Ensure Sentry is not initialized for most tests
      (instance as any).isSentryInitialized = false;
    });

    it('should support object signature with error and message', () => {
      const error = new Error('Test error');
      Logger.error({ error, message: 'Operation failed', meta: { operation: 'test' } });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: 'Operation failed: Test error',
        meta: expect.objectContaining({ operation: 'test', name: 'Error', stack: expect.any(String) }),
        options: undefined,
      });
    });

    it('should support object signature with error only', () => {
      const error = new Error('Test error');
      Logger.error({ error });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: error,
        meta: expect.objectContaining({ name: 'Error', stack: expect.any(String) }),
        options: undefined,
      });
    });

    it('should support positional signature with error and message', () => {
      const error = new Error('Database error');
      Logger.error(error, 'Failed to save user', { userId: '456' });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: 'Failed to save user: Database error',
        meta: { userId: '456' },
        options: undefined,
      });
    });

    it('should support positional signature with error only', () => {
      const error = new Error('Simple error');
      Logger.error(error);

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: error,
        meta: undefined,
        options: undefined,
      });
    });

    it('should handle non-Error objects in error logging', () => {
      Logger.error({ error: 'string error', message: 'Something went wrong' });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: 'Something went wrong: string error',
        meta: undefined,
        options: undefined,
      });
    });

    it('should capture exception in Sentry when initialized', () => {
      const error = new Error('Sentry test');
      (instance as any).isSentryInitialized = true;

      Logger.error({ error, message: 'Failed operation' });

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: 'Failed operation: Sentry test',
        meta: expect.objectContaining({ name: 'Error', stack: expect.any(String) }),
        options: undefined,
      });
    });

    it('should capture exception in Sentry for positional signature', () => {
      const error = new Error('Positional sentry test');
      (instance as any).isSentryInitialized = true;

      Logger.error(error, 'Failed positional');

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should not capture non-Error objects in Sentry', () => {
      (instance as any).isSentryInitialized = true;
      Logger.error({ error: 'string error' });

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('custom method', () => {
    it('should log with custom level', () => {
      Logger.custom({ level: 'command', message: 'Running command', meta: { cmd: 'build' } });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'command',
        message: 'Running command',
        meta: { cmd: 'build' },
        options: undefined,
      });
    });

    it('should work with all custom levels', () => {
      const levels: Array<'database' | 'redis' | 'webServer' | 'webSocket' | 'queue' | 'queueJob' | 'event'> = [
        'database',
        'redis',
        'webServer',
        'webSocket',
        'queue',
        'queueJob',
        'event',
      ];

      levels.forEach(level => {
        logSpy.mockClear();
        Logger.custom({ level, message: `${level} message` });

        expect(logSpy).toHaveBeenCalledWith({
          level,
          message: `${level} message`,
          meta: undefined,
          options: undefined,
        });
      });
    });
  });

  describe('log method - message handling', () => {
    let pinoLevelSpy: any;

    beforeEach(() => {
      logSpy.mockRestore();
    });

    it('should handle Error message with stack', () => {
      const error = new Error('Test error');
      pinoLevelSpy = vi.spyOn((instance as any).logger, 'error').mockImplementation(() => {});

      Logger.log({ level: 'error', message: error });

      expect(pinoLevelSpy).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('Test error'));
      pinoLevelSpy.mockRestore();
    });

    it('should handle string message', () => {
      pinoLevelSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.log({ level: 'info', message: 'String message' });

      expect(pinoLevelSpy).toHaveBeenCalledWith(expect.any(Object), 'String message');
      pinoLevelSpy.mockRestore();
    });

    it('should handle object message by stringifying', () => {
      pinoLevelSpy = vi.spyOn((instance as any).logger, 'debug').mockImplementation(() => {});
      const obj = { foo: 'bar', count: 42 };

      Logger.log({ level: 'debug', message: obj });

      expect(pinoLevelSpy).toHaveBeenCalledWith(expect.any(Object), JSON.stringify(obj));
      pinoLevelSpy.mockRestore();
    });

    it('should handle number message', () => {
      pinoLevelSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.log({ level: 'info', message: 42 });

      expect(pinoLevelSpy).toHaveBeenCalledWith(expect.any(Object), '42');
      pinoLevelSpy.mockRestore();
    });

    it('should pass meta through', () => {
      pinoLevelSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.log({ level: 'info', message: 'test', meta: { key: 'value' } });

      expect(pinoLevelSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'value' }), 'test');
      pinoLevelSpy.mockRestore();
    });
  });

  describe('Sentry integration', () => {
    beforeEach(() => {
      (instance as any).isSentryInitialized = false;
      vi.clearAllMocks();
    });

    it('should initialize Sentry with correct config', () => {
      Logger.initSentry({ sentryDsn: 'https://test@sentry.io/123', environment: 'production' });

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://test@sentry.io/123',
        integrations: expect.any(Object),
        tracesSampleRate: 1.0,
        environment: 'production',
      });
      expect(Logger.isSentryInitialized).toBe(true);
    });

    it('should warn and not initialize Sentry without DSN', () => {
      const warnSpy = vi.spyOn((instance as any).logger, 'warn').mockImplementation(() => {});

      Logger.initSentry({ sentryDsn: '', environment: 'production' });

      // Pino's warn is called with just a string message (no meta object prefix)
      expect(warnSpy).toHaveBeenCalledWith('Missing Sentry DSN when initializing Sentry');
      expect(Sentry.init).not.toHaveBeenCalled();
      expect(Logger.isSentryInitialized).toBe(false);

      warnSpy.mockRestore();
    });
  });

  describe('Request context integration', () => {
    it('should inject requestId from context when logging', () => {
      const getRequestIdMock = vi.mocked(requestContext.getRequestId);
      getRequestIdMock.mockReturnValue('req-123');

      logSpy.mockRestore();
      const pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test message');

      // buildMeta should inject requestId, and pino is called with (meta, message)
      expect(getRequestIdMock).toHaveBeenCalled();
      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-123' }), 'Test message');

      pinoInfoSpy.mockRestore();
    });

    it('should not override existing requestId', () => {
      const getRequestIdMock = vi.mocked(requestContext.getRequestId);
      getRequestIdMock.mockReturnValue('req-auto');

      logSpy.mockRestore();
      const pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test message', { requestId: 'req-manual' });

      expect(getRequestIdMock).toHaveBeenCalled();
      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-manual' }), 'Test message');

      pinoInfoSpy.mockRestore();
    });

    it('should handle missing requestId gracefully', () => {
      const getRequestIdMock = vi.mocked(requestContext.getRequestId);
      getRequestIdMock.mockReturnValue(undefined);

      logSpy.mockRestore();
      const pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test message');

      expect(getRequestIdMock).toHaveBeenCalled();
      // buildMeta returns {} when no meta and no requestId
      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.any(Object), 'Test message');

      pinoInfoSpy.mockRestore();
    });
  });

  describe('Cluster worker integration', () => {
    it('should add worker ID when running in worker mode', () => {
      const clusterMock = vi.mocked(cluster);
      (clusterMock as any).isWorker = true;
      (clusterMock as any).worker = { id: 3 } as any;

      logSpy.mockRestore();
      const pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test in worker');

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ Worker: 3 }), 'Test in worker');
      expect(clusterMock.isWorker).toBe(true);
      expect(clusterMock.worker?.id).toBe(3);

      // Cleanup
      (clusterMock as any).isWorker = false;
      (clusterMock as any).worker = undefined;
      pinoInfoSpy.mockRestore();
    });

    it('should not add worker ID when not in worker mode', () => {
      const clusterMock = vi.mocked(cluster);
      (clusterMock as any).isWorker = false;
      (clusterMock as any).worker = undefined;

      logSpy.mockRestore();
      const pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test not in worker');

      expect(pinoInfoSpy).toHaveBeenCalled();
      // Verify Worker is NOT in the meta
      const callArgs = pinoInfoSpy.mock.calls[0];
      expect(callArgs[0]).not.toHaveProperty('Worker');
      expect(clusterMock.isWorker).toBe(false);

      pinoInfoSpy.mockRestore();
    });
  });

  describe('Meta value serialization', () => {
    let pinoInfoSpy: any;

    beforeEach(() => {
      logSpy.mockRestore();
      pinoInfoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      pinoInfoSpy.mockRestore();
    });

    it('should handle null values in meta', () => {
      Logger.info('Test', { nullValue: null });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ nullValue: null }), 'Test');
    });

    it('should handle undefined values in meta', () => {
      Logger.info('Test', { undefinedValue: undefined });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ undefinedValue: undefined }), 'Test');
    });

    it('should handle string values in meta', () => {
      Logger.info('Test', { stringValue: 'hello' });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ stringValue: 'hello' }), 'Test');
    });

    it('should handle number values in meta', () => {
      Logger.info('Test', { numberValue: 42 });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ numberValue: 42 }), 'Test');
    });

    it('should handle boolean values in meta', () => {
      Logger.info('Test', { boolValue: true });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ boolValue: true }), 'Test');
    });

    it('should handle Error values in meta', () => {
      const error = new Error('Test error message');

      Logger.info('Test', { errorValue: error });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ errorValue: error }), 'Test');
    });

    it('should handle Promise values in meta', () => {
      const promise = Promise.resolve('test');

      Logger.info('Test', { promiseValue: promise });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ promiseValue: promise }), 'Test');
    });

    it('should handle plain object values in meta', () => {
      const obj = { foo: 'bar', count: 42 };

      Logger.info('Test', { objectValue: obj });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ objectValue: obj }), 'Test');
    });

    it('should handle circular reference objects in meta', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      Logger.info('Test', { circularValue: circular });

      expect(pinoInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ circularValue: circular }), 'Test');
    });
  });

  describe('Log format', () => {
    let pinoSpy: any;

    afterEach(() => {
      if (pinoSpy) pinoSpy.mockRestore();
    });

    it('should log messages with the correct level', () => {
      logSpy.mockRestore();
      pinoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test message');

      expect(pinoSpy).toHaveBeenCalledWith(expect.any(Object), 'Test message');
    });

    it('should log messages with meta', () => {
      logSpy.mockRestore();
      pinoSpy = vi.spyOn((instance as any).logger, 'info').mockImplementation(() => {});

      Logger.info('Test message', { userId: '123', action: 'login' });

      expect(pinoSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: '123', action: 'login' }), 'Test message');
    });

    it('should log messages without meta', () => {
      logSpy.mockRestore();
      pinoSpy = vi.spyOn((instance as any).logger, 'debug').mockImplementation(() => {});

      Logger.debug('Simple message');

      expect(pinoSpy).toHaveBeenCalledWith(expect.any(Object), 'Simple message');
    });
  });

  describe('Sentry error capture during logging', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logSpy.mockRestore();
    });

    it('should trigger error formatting which captures to Sentry when initialized', () => {
      (instance as any).isSentryInitialized = true;
      const pinoErrorSpy = vi.spyOn((instance as any).logger, 'error').mockImplementation(() => {});

      Logger.log({ level: 'error', message: 'Critical error occurred' });

      expect(pinoErrorSpy).toHaveBeenCalledWith(expect.any(Object), 'Critical error occurred');
      pinoErrorSpy.mockRestore();
    });

    it('should work with error objects', () => {
      (instance as any).isSentryInitialized = true;
      const pinoErrorSpy = vi.spyOn((instance as any).logger, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      Logger.log({ level: 'error', message: error });

      expect(pinoErrorSpy).toHaveBeenCalled();
      pinoErrorSpy.mockRestore();
    });

    it('should not interfere when Sentry not initialized', () => {
      (instance as any).isSentryInitialized = false;
      const pinoErrorSpy = vi.spyOn((instance as any).logger, 'error').mockImplementation(() => {});

      Logger.log({ level: 'error', message: 'Error message' });

      expect(pinoErrorSpy).toHaveBeenCalledWith(expect.any(Object), 'Error message');
      pinoErrorSpy.mockRestore();
    });

    it('should not affect non-error level logs', () => {
      (instance as any).isSentryInitialized = true;
      const pinoWarnSpy = vi.spyOn((instance as any).logger, 'warn').mockImplementation(() => {});

      Logger.log({ level: 'warn', message: 'Warning message' });

      expect(pinoWarnSpy).toHaveBeenCalledWith(expect.any(Object), 'Warning message');
      pinoWarnSpy.mockRestore();
    });
  });
});
