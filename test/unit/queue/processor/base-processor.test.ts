import { describe, it, expect, vi, beforeEach } from 'vitest';
import BaseProcessor from '../../../../src/queue/processor/base.js';
import type { Job } from 'bullmq';
import type QueueManager from '../../../../src/queue/manager.js';
import { mockRedisInstance } from '../../../utils/mocks/redis-mocks.js';
import { mockDatabaseInstance } from '../../../utils/mocks/database-mocks.js';

// Mock Logger
vi.mock('../../../../src/logger/index.js', () => ({
  Logger: {
    custom: vi.fn(),
  },
}));

// Concrete implementation for testing
class TestProcessor extends BaseProcessor {
  public async process({ job }: { job: Job }) {
    return { result: 'processed', jobId: job.id };
  }

  public getLogger() {
    return this.log;
  }
}

describe('BaseProcessor', () => {
  let processor: TestProcessor;
  let mockQueueManager: QueueManager;
  let mockEventManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueueManager = {
      log: vi.fn(),
    } as any;

    mockEventManager = {
      emit: vi.fn(),
      on: vi.fn(),
    };

    processor = new TestProcessor(
      mockQueueManager,
      {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test',
      },
      mockRedisInstance as any,
      mockDatabaseInstance as any,
      mockEventManager,
    );
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(processor).toBeDefined();
    });

    it('should initialize without event manager', () => {
      const processorWithoutEvents = new TestProcessor(
        mockQueueManager,
        {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
        },
        mockRedisInstance as any,
        mockDatabaseInstance as any,
      );

      expect(processorWithoutEvents).toBeDefined();
    });

    it('should initialize with null database instance', () => {
      const processorWithoutDb = new TestProcessor(
        mockQueueManager,
        {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
        },
        mockRedisInstance as any,
        null,
        mockEventManager,
      );

      expect(processorWithoutDb).toBeDefined();
    });
  });

  describe('process', () => {
    it('should process job', async () => {
      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        data: { test: 'data' },
      };

      const result = await processor.process({ job: mockJob as Job });

      expect(result).toEqual({
        result: 'processed',
        jobId: '123',
      });
    });
  });

  describe('log.error', () => {
    it('should log error with message and meta', async () => {
      const error = new Error('Test error');
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.error(error, 'Error occurred', { context: 'test' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Error occurred',
        meta: {
          context: 'test',
          error: 'Test error',
          stack: expect.any(String),
        },
      });
    });

    it('should log error without message', async () => {
      const error = new Error('Test error');
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.error(error);

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: error,
      });
    });

    it('should handle non-Error objects', async () => {
      const error = 'String error';
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.error(error, 'Error message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Error message',
        meta: {
          error: 'String error',
          stack: undefined,
        },
      });
    });

    it('should log error with meta but no stack for non-Error', async () => {
      const error = { weird: 'object' };
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.error(error, 'Object error', { additional: 'meta' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Object error',
        meta: {
          additional: 'meta',
          error: '{"weird":"object"}',
          stack: undefined,
        },
      });
    });
  });

  describe('log.info', () => {
    it('should log info message', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.info('Info message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Info message',
        meta: undefined,
      });
    });

    it('should log info message with meta', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.info('Info message', { key: 'value' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Info message',
        meta: { key: 'value' },
      });
    });
  });

  describe('log.warn', () => {
    it('should log warning message', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.warn('Warning message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Warning message',
        meta: undefined,
      });
    });

    it('should log warning message with meta', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.warn('Warning message', { severity: 'high' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Warning message',
        meta: { severity: 'high' },
      });
    });
  });

  describe('log.debug', () => {
    it('should log debug message', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.debug('Debug message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Debug message',
        meta: undefined,
      });
    });

    it('should log debug message with meta', async () => {
      const { Logger } = await import('../../../../src/logger/index.js');

      processor.log.debug('Debug message', { detail: 'extra' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'queueJob',
        message: 'Debug message',
        meta: { detail: 'extra' },
      });
    });
  });
});
