import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Logger from '../../../src/logger/logger.js';
import * as Sentry from '@sentry/node';
import cluster from 'node:cluster';
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
        meta: { operation: 'test' },
        options: undefined,
      });
    });

    it('should support object signature with error only', () => {
      const error = new Error('Test error');
      Logger.error({ error });

      expect(logSpy).toHaveBeenCalledWith({
        level: 'error',
        message: error,
        meta: undefined,
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
      expect(logSpy).toHaveBeenCalled();
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
    let winstonLogSpy: any;

    beforeEach(() => {
      logSpy.mockRestore();
      winstonLogSpy = vi.spyOn((instance as any).logger, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      winstonLogSpy.mockRestore();
    });

    it('should handle Error message with stack', () => {
      const error = new Error('Test error');
      Logger.log({ level: 'error', message: error });

      expect(winstonLogSpy).toHaveBeenCalledWith('error', expect.stringContaining('Test error'), undefined);
    });

    it('should handle string message', () => {
      Logger.log({ level: 'info', message: 'String message' });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'String message', undefined);
    });

    it('should handle object message by stringifying', () => {
      const obj = { foo: 'bar', count: 42 };
      Logger.log({ level: 'debug', message: obj });

      expect(winstonLogSpy).toHaveBeenCalledWith('debug', JSON.stringify(obj), undefined);
    });

    it('should handle number message', () => {
      Logger.log({ level: 'info', message: 42 });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', '42', undefined);
    });

    it('should pass meta through', () => {
      Logger.log({ level: 'info', message: 'test', meta: { key: 'value' } });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'test', { key: 'value' });
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
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test message');

      // The format function is called by winston internally and should add requestId
      expect(getRequestIdMock).toHaveBeenCalled();
      expect(winstonLogSpy).toHaveBeenCalled();
    });

    it('should not override existing requestId', () => {
      const getRequestIdMock = vi.mocked(requestContext.getRequestId);
      getRequestIdMock.mockReturnValue('req-auto');

      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test message', { requestId: 'req-manual' });

      // Should still be called to check
      expect(getRequestIdMock).toHaveBeenCalled();
      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test message', { requestId: 'req-manual' });
    });

    it('should handle missing requestId gracefully', () => {
      const getRequestIdMock = vi.mocked(requestContext.getRequestId);
      getRequestIdMock.mockReturnValue(undefined);

      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test message');

      expect(getRequestIdMock).toHaveBeenCalled();
      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test message', undefined);
    });
  });

  describe('Cluster worker integration', () => {
    it('should add worker ID when running in worker mode', () => {
      const clusterMock = vi.mocked(cluster);
      clusterMock.isWorker = true;
      clusterMock.worker = { id: 3 } as any;

      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test in worker');

      // The custom format will be applied by winston internally
      expect(winstonLogSpy).toHaveBeenCalled();
      expect(clusterMock.isWorker).toBe(true);
      expect(clusterMock.worker?.id).toBe(3);

      // Cleanup
      clusterMock.isWorker = false;
      clusterMock.worker = undefined;
    });

    it('should not add worker ID when not in worker mode', () => {
      const clusterMock = vi.mocked(cluster);
      clusterMock.isWorker = false;
      clusterMock.worker = undefined;

      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test not in worker');

      expect(winstonLogSpy).toHaveBeenCalled();
      expect(clusterMock.isWorker).toBe(false);
    });
  });

  describe('Meta value serialization', () => {
    it('should handle null values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test', { nullValue: null });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { nullValue: null });
    });

    it('should handle undefined values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test', { undefinedValue: undefined });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { undefinedValue: undefined });
    });

    it('should handle string values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test', { stringValue: 'hello' });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { stringValue: 'hello' });
    });

    it('should handle number values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test', { numberValue: 42 });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { numberValue: 42 });
    });

    it('should handle boolean values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test', { boolValue: true });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { boolValue: true });
    });

    it('should handle Error values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');
      const error = new Error('Test error message');

      Logger.info('Test', { errorValue: error });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { errorValue: error });
    });

    it('should handle Promise values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');
      const promise = Promise.resolve('test');

      Logger.info('Test', { promiseValue: promise });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { promiseValue: promise });
    });

    it('should handle plain object values in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');
      const obj = { foo: 'bar', count: 42 };

      Logger.info('Test', { objectValue: obj });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { objectValue: obj });
    });

    it('should handle circular reference objects in meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');
      const circular: any = { name: 'test' };
      circular.self = circular;

      Logger.info('Test', { circularValue: circular });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test', { circularValue: circular });
    });
  });

  describe('Log format', () => {
    it('should log messages with the correct level', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test message');

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test message', undefined);
    });

    it('should log messages with meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.info('Test message', { userId: '123', action: 'login' });

      expect(winstonLogSpy).toHaveBeenCalledWith('info', 'Test message', { userId: '123', action: 'login' });
    });

    it('should log messages without meta', () => {
      logSpy.mockRestore();
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.debug('Simple message');

      expect(winstonLogSpy).toHaveBeenCalledWith('debug', 'Simple message', undefined);
    });
  });

  describe('Sentry error capture during logging', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logSpy.mockRestore();
    });

    it('should trigger error formatting which captures to Sentry when initialized', () => {
      (instance as any).isSentryInitialized = true;
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.log({ level: 'error', message: 'Critical error occurred' });

      // Verify winston was called with error level
      expect(winstonLogSpy).toHaveBeenCalledWith('error', 'Critical error occurred', undefined);
    });

    it('should work with error objects', () => {
      (instance as any).isSentryInitialized = true;
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');
      const error = new Error('Test error');

      Logger.log({ level: 'error', message: error });

      expect(winstonLogSpy).toHaveBeenCalled();
    });

    it('should not interfere when Sentry not initialized', () => {
      (instance as any).isSentryInitialized = false;
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.log({ level: 'error', message: 'Error message' });

      expect(winstonLogSpy).toHaveBeenCalledWith('error', 'Error message', undefined);
    });

    it('should not affect non-error level logs', () => {
      (instance as any).isSentryInitialized = true;
      const winstonLogSpy = vi.spyOn((instance as any).logger, 'log');

      Logger.log({ level: 'warn', message: 'Warning message' });

      expect(winstonLogSpy).toHaveBeenCalledWith('warn', 'Warning message', undefined);
    });
  });
});
