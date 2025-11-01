import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueueWorker from '../../../src/queue/worker.js';
import type QueueManager from '../../../src/queue/manager.js';
import { WebSocketRedisSubscriberEvent } from '../../../src/websocket/websocket.interface.js';
import type { Job } from 'bullmq';

// Mock dependencies
vi.mock('bullmq', () => ({
  Worker: vi.fn(function (this: any, name: string, processor: any, options: any) {
    this.on = vi.fn((event: string, handler: Function) => this);
    return this;
  }),
}));

vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

vi.mock('../../../src/util/index.js', () => ({
  Time: {
    calculateElapsedTimeMs: vi.fn().mockReturnValue(123.45),
  },
}));

describe('QueueWorker', () => {
  let worker: QueueWorker;
  let mockQueueManager: QueueManager;
  let mockRedisInstance: any;
  let mockPublisherClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPublisherClient = {
      publish: vi.fn(),
    };

    mockRedisInstance = {
      publisherClient: mockPublisherClient,
    };

    mockQueueManager = {
      log: vi.fn(),
    } as any;

    const processor = vi.fn();

    worker = new QueueWorker({
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test',
        queue: {
          log: {
            jobCompleted: true,
          },
        },
      },
      queueManager: mockQueueManager,
      name: 'test-queue',
      processor,
      options: {},
      redisInstance: mockRedisInstance,
    });
  });

  describe('constructor', () => {
    it('should initialize worker and register event listeners', () => {
      expect(worker).toBeDefined();
      expect(worker.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('onWorkerActive', () => {
    it('should log when worker becomes active', () => {
      const mockJob: Partial<Job> = {
        queueName: 'test-queue',
        name: 'test-job',
        id: '123',
      };

      // Access private method through event emission
      const activeHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'active')?.[1];
      activeHandler?.(mockJob as Job);

      expect(mockQueueManager.log).toHaveBeenCalledWith('Worker active', {
        Queue: 'test-queue',
        'Job Name': 'test-job',
        'Job ID': '123',
      });
    });
  });

  describe('onWorkerError', () => {
    it('should log error when worker encounters error', async () => {
      const error = new Error('Worker error');
      const { Logger } = await import('../../../src/logger/index.js');

      const errorHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(error);

      expect(Logger.error).toHaveBeenCalledWith({ error });
    });
  });

  describe('onWorkerFailed', () => {
    it('should log error when job fails', async () => {
      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        data: {},
      };
      const error = new Error('Job failed');
      const { Logger } = await import('../../../src/logger/index.js');

      const failedHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'failed')?.[1];
      failedHandler?.(mockJob as Job, error);

      expect(Logger.error).toHaveBeenCalledWith({ error });
    });

    it('should handle failed job without job object', async () => {
      const error = new Error('Job failed');
      const { Logger } = await import('../../../src/logger/index.js');

      const failedHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'failed')?.[1];
      failedHandler?.(undefined, error);

      expect(Logger.error).toHaveBeenCalledWith({ error });
    });
  });

  describe('onWorkerStalled', () => {
    it('should log when worker stalls', () => {
      const stalledHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'stalled')?.[1];
      stalledHandler?.('123');

      expect(mockQueueManager.log).toHaveBeenCalledWith('Worker stalled', {
        Job: '123',
      });
    });
  });

  describe('onWorkerCompleted', () => {
    it('should log job completion with execution time', () => {
      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        queueName: 'test-queue',
        data: {
          startTime: Date.now() - 1000,
        },
        returnvalue: {},
      };

      const completedHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'completed')?.[1];
      completedHandler?.(mockJob as Job);

      expect(mockQueueManager.log).toHaveBeenCalledWith('Job completed', {
        Queue: 'test-queue',
        'Job Name': 'test-job',
        'Job ID': '123',
        Time: '123.45ms',
      });
    });

    it('should publish WebSocket message when job has webSocketClientId', () => {
      const returnValue = {
        webSocketClientId: 'client-123',
        result: 'success',
      };

      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        queueName: 'test-queue',
        data: {
          startTime: Date.now() - 1000,
        },
        returnvalue: returnValue,
      };

      const completedHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'completed')?.[1];
      completedHandler?.(mockJob as Job);

      expect(mockPublisherClient.publish).toHaveBeenCalledWith(
        WebSocketRedisSubscriberEvent.QueueJobCompleted,
        JSON.stringify(returnValue),
      );
    });

    it('should not publish WebSocket message when no webSocketClientId', () => {
      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        queueName: 'test-queue',
        data: {
          startTime: Date.now() - 1000,
        },
        returnvalue: { result: 'success' },
      };

      const completedHandler = vi.mocked(worker.on).mock.calls.find(call => call[0] === 'completed')?.[1];
      completedHandler?.(mockJob as Job);

      expect(mockPublisherClient.publish).not.toHaveBeenCalled();
    });

    it('should not log job completion when logging disabled', () => {
      const workerWithoutLogging = new QueueWorker({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
          queue: {
            log: {
              jobCompleted: false,
            },
          },
        },
        queueManager: mockQueueManager,
        name: 'test-queue',
        processor: vi.fn(),
        options: {},
        redisInstance: mockRedisInstance,
      });

      const mockJob: Partial<Job> = {
        id: '123',
        name: 'test-job',
        queueName: 'test-queue',
        data: {
          startTime: Date.now() - 1000,
        },
        returnvalue: {},
      };

      // Reset mock to clear calls from constructor
      vi.mocked(mockQueueManager.log).mockClear();

      const completedHandler = vi.mocked(workerWithoutLogging.on).mock.calls.find(call => call[0] === 'completed')?.[1];
      completedHandler?.(mockJob as Job);

      expect(mockQueueManager.log).not.toHaveBeenCalled();
    });
  });
});
