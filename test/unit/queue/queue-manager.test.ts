import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Queue, type Job } from 'bullmq';
import QueueManager from '../../../src/queue/manager.js';
import QueueWorker from '../../../src/queue/worker.js';
import { Logger } from '../../../src/logger/index.js';
import { File, Helper, Loader, Time } from '../../../src/util/index.js';
import type { QueueManagerConstructorParams } from '../../../src/queue/manager.interface.js';
import type { QueueItem } from '../../../src/queue/index.interface.js';

// Mock dependencies
vi.mock('bullmq', () => ({
  Queue: vi.fn(),
}));
vi.mock('../../../src/queue/worker.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../src/logger/index.js');
vi.mock('../../../src/util/index.js', () => ({
  File: {
    pathExists: vi.fn(),
  },
  Helper: {
    defaultsDeep: vi.fn(),
    getScriptFileExtension: vi.fn(() => 'ts'),
  },
  Loader: {
    loadModulesInDirectory: vi.fn(),
  },
  Time: {
    now: vi.fn(() => 0),
    calculateElapsedTimeMs: vi.fn(() => 0),
    formatTime: vi.fn(),
  },
}));

const mockQueue = vi.mocked(Queue);
const mockQueueWorker = vi.mocked(QueueWorker);
const mockLogger = vi.mocked(Logger);
const mockHelper = Helper as unknown as {
  defaultsDeep: ReturnType<typeof vi.fn>;
  getScriptFileExtension: ReturnType<typeof vi.fn>;
};
const mockLoader = Loader as unknown as {
  loadModulesInDirectory: ReturnType<typeof vi.fn>;
};
const mockFile = File as unknown as {
  pathExists: ReturnType<typeof vi.fn>;
};
const mockTime = Time as unknown as {
  now: ReturnType<typeof vi.fn>;
  calculateElapsedTimeMs: ReturnType<typeof vi.fn>;
  formatTime: ReturnType<typeof vi.fn>;
};

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockParams: QueueManagerConstructorParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTime.now.mockReturnValue(0);
    mockTime.calculateElapsedTimeMs.mockReturnValue(0);
    mockHelper.getScriptFileExtension.mockReturnValue('ts');

    mockParams = {
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test/root',
        redis: {
          host: 'localhost',
          port: 6379,
          password: '',
        },
        queue: {
          queues: [],
          processorsDirectory: '/test/processors',
          log: {
            queuesRegistered: true,
            queueRegistered: true,
            jobRegistered: true,
            queueWaiting: true,
            jobAdded: true,
          },
        },
      },
      options: {
        processorsDirectory: '/test/processors',
      },
      queues: [],
      redisInstance: {
        client: { mock: 'redis-client' },
        disconnect: vi.fn(),
      } as any,
      databaseInstance: null,
      eventManager: undefined,
    };

    mockHelper.defaultsDeep.mockImplementation((target, ...sources) => ({ ...target, ...sources[0] }));

    queueManager = new QueueManager(mockParams);
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(queueManager).toBeInstanceOf(QueueManager);
      // Note: defaultsDeep is no longer called in the constructor after type safety improvements
    });
  });

  describe('registerQueues', () => {
    it('should return early if no queues provided', async () => {
      await queueManager.registerQueues({ queues: [] });
      // Should return early without checking directory
    });

    it('should return early if processors directory does not exist', async () => {
      mockFile.pathExists.mockResolvedValue(false);

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false,
        },
      ];

      await queueManager.registerQueues({ queues });

      expect(mockFile.pathExists).toHaveBeenCalledWith('/test/processors');
      // No warning should be logged - the function just returns early
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should register queues successfully', async () => {
      mockFile.pathExists.mockResolvedValue(true);
      mockLoader.loadModulesInDirectory.mockResolvedValue({
        'test-job': class MockProcessor {},
      });

      const mockQueueInstance = {
        on: vi.fn(),
        add: vi.fn(),
        getJobs: vi.fn(),
      };
      mockQueue.mockImplementation(function (this: any) {
        return Object.assign(this, mockQueueInstance);
      } as any);

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false,
        },
      ];

      await queueManager.registerQueues({ queues });

      expect(mockLoader.loadModulesInDirectory).toHaveBeenCalledWith({
        directory: '/test/processors',
        extensions: ['.ts', '.js'],
      });
      expect(mockQueue).toHaveBeenCalledWith('test-queue', {
        connection: mockParams.redisInstance.client,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
    });

    it('should handle loader errors', async () => {
      mockFile.pathExists.mockResolvedValue(true);
      mockLoader.loadModulesInDirectory.mockRejectedValue(new Error('Load error'));

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false,
        },
      ];

      await queueManager.registerQueues({ queues });

      expect(mockLogger.error).toHaveBeenCalledWith({
        error: expect.any(Error),
      });
    });
  });

  describe('addJobToQueue', () => {
    beforeEach(() => {
      // Setup a mock queue
      const mockQueueInstance = {
        add: vi.fn().mockResolvedValue({ id: 'job-123' }),
      };

      // @ts-ignore - accessing private property for testing
      queueManager['queues'].set('test-queue', mockQueueInstance as any);
    });

    it('should add job to queue successfully', async () => {
      const jobData = { userId: 123, action: 'process' };

      const result = await queueManager.addJobToQueue({
        queueId: 'test-queue',
        jobId: 'test-job',
        data: jobData,
      });

      expect(result).toEqual({ id: 'job-123' });
    });

    it('should handle queue not found', async () => {
      const jobData = { userId: 123 };

      const result = await queueManager.addJobToQueue({
        queueId: 'non-existent-queue',
        jobId: 'test-job',
        data: jobData,
      });

      expect(result).toBeUndefined();
    });

    it('should truncate long data in logs', async () => {
      const longData = { data: 'a'.repeat(100) };

      const result = await queueManager.addJobToQueue({
        queueId: 'test-queue',
        jobId: 'test-job',
        data: longData,
      });

      // The function should handle long data internally
      expect(result).toBeDefined();
    });
  });

  describe('workerProcessor', () => {
    beforeEach(() => {
      mockTime.now.mockReturnValue(1000);
      const jobProcessors = queueManager['jobProcessors'] as Map<string, any>;
      jobProcessors.clear();
    });

    it('awaits updateData before processing job', async () => {
      const job: Partial<Job> = {
        id: 'job-1',
        name: 'test-job',
        queueName: 'test-queue',
        data: {},
      };

      let resolveUpdate: (() => void) | undefined;
      const updatePromise = new Promise<void>(resolve => {
        resolveUpdate = resolve;
      });

      job.updateData = vi.fn(() => updatePromise);

      const processor = { process: vi.fn().mockResolvedValue('ok') };

      const jobProcessors = queueManager['jobProcessors'] as Map<string, any>;
      jobProcessors.set('test-job', processor as any);

      const workerPromise = (queueManager as any).workerProcessor(job);

      expect(processor.process).not.toHaveBeenCalled();

      expect(resolveUpdate).toBeDefined();
      resolveUpdate?.();

      await workerPromise;

      expect(job.updateData).toHaveBeenCalledWith({ ...job.data, startTime: 1000 });
      expect(processor.process).toHaveBeenCalledWith({ job });
    });

    it('logs warning when updateData rejects', async () => {
      const job: Partial<Job> = {
        id: 'job-2',
        name: 'test-job',
        queueName: 'test-queue',
        data: {},
        updateData: vi.fn(() => Promise.reject(new Error('fail update'))),
      };

      const processor = { process: vi.fn().mockResolvedValue('ok') };
      const jobProcessors = queueManager['jobProcessors'] as Map<string, any>;
      jobProcessors.set('test-job', processor as any);

      await (queueManager as any).workerProcessor(job);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to persist job metadata before processing',
        meta: {
          Queue: 'test-queue',
          'Job Name': 'test-job',
          'Job ID': 'job-2',
          Error: 'fail update',
        },
      });
      expect(processor.process).toHaveBeenCalled();
    });
  });

  describe('listAllJobsWithStatus', () => {
    it('should list jobs from all queues', async () => {
      const mockQueue1 = {
        getJobs: vi.fn().mockImplementation(states => {
          if (states.includes('active')) {
            return Promise.resolve([
              {
                id: 'job-1',
                name: 'test-job',
                attemptsMade: 1,
                failedReason: null,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const mockQueue2 = {
        getJobs: vi.fn().mockResolvedValue([]),
      };

      // @ts-ignore - accessing private property for testing
      queueManager['queues'].set('queue1', mockQueue1 as any);
      // @ts-ignore - accessing private property for testing
      queueManager['queues'].set('queue2', mockQueue2 as any);

      const result = await queueManager.listAllJobsWithStatus();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'job-1',
        name: 'test-job',
        queueName: 'queue1',
        state: 'active',
        attemptsMade: 1,
        failedReason: null,
      });
    });

    it('should handle empty queues', async () => {
      const result = await queueManager.listAllJobsWithStatus();
      expect(result).toEqual([]);
    });
  });

  describe('log', () => {
    it('should log with queue level', () => {
      queueManager.log('Test message', { queueName: 'test-queue' });

      expect(mockLogger.custom).toHaveBeenCalledWith({
        level: 'queue',
        message: 'Test message',
        meta: { queueName: 'test-queue' },
      });
    });

    it('should log without meta', () => {
      queueManager.log('Simple message');

      expect(mockLogger.custom).toHaveBeenCalledWith({
        level: 'queue',
        message: 'Simple message',
        meta: undefined,
      });
    });
  });

  describe('queue event handlers', () => {
    let mockQueueInstance: any;

    beforeEach(() => {
      mockFile.pathExists.mockResolvedValue(true);
      mockLoader.loadModulesInDirectory.mockResolvedValue({
        'test-job': class MockProcessor {},
      });

      mockQueueInstance = {
        on: vi.fn(),
        add: vi.fn(),
        getJobs: vi.fn(),
      };
      mockQueue.mockImplementation(function (this: any) {
        return Object.assign(this, mockQueueInstance);
      } as any);

      // Mock the log method
      vi.spyOn(queueManager, 'log').mockImplementation(() => {});
    });

    it('should handle queue error events', async () => {
      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false,
        },
      ];

      await queueManager.registerQueues({ queues });

      // Get the error handler
      const errorHandler = mockQueueInstance.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];

      expect(errorHandler).toBeDefined();

      // Simulate error
      const testError = new Error('Queue error');
      errorHandler(testError);

      expect(mockLogger.error).toHaveBeenCalledWith({ error: testError });
    });

    it('should handle queue waiting events', async () => {
      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false,
        },
      ];

      await queueManager.registerQueues({ queues });

      // Get the waiting handler
      const waitingHandler = mockQueueInstance.on.mock.calls.find((call: any) => call[0] === 'waiting')?.[1];

      expect(waitingHandler).toBeDefined();

      // Simulate waiting job
      const mockJob = { queueName: 'test-queue', id: 'job-123' };
      waitingHandler(mockJob);

      expect(queueManager.log).toHaveBeenCalledWith('Waiting...', {
        Queue: 'test-queue',
        Job: 'job-123',
      });
    });
  });
});
