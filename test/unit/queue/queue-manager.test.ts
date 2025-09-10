import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Queue, type Job } from 'bullmq';
import { existsSync } from 'fs';
import QueueManager from '../../../src/queue/manager.js';
import QueueWorker from '../../../src/queue/worker.js';
import { Logger } from '../../../src/logger/index.js';
import { Helper, Loader } from '../../../src/util/index.js';
import type { QueueManagerConstructorParams } from '../../../src/queue/manager.interface.js';
import type { QueueItem } from '../../../src/queue/index.interface.js';

// Mock dependencies
vi.mock('bullmq');
vi.mock('fs');
vi.mock('../../../src/queue/worker.js');
vi.mock('../../../src/logger/index.js');
vi.mock('../../../src/util/index.js');

const mockQueue = vi.mocked(Queue);
const mockExistsSync = vi.mocked(existsSync);
const mockQueueWorker = vi.mocked(QueueWorker);
const mockLogger = vi.mocked(Logger);
const mockHelper = vi.mocked(Helper);
const mockLoader = vi.mocked(Loader);

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockParams: QueueManagerConstructorParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockParams = {
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test/root',
        redis: {
          host: 'localhost',
          port: 6379,
          password: ''
        },
        queue: {
          queues: [],
          processorsDirectory: '/test/processors',
          log: {
            queuesRegistered: true,
            queueRegistered: true,
            jobRegistered: true,
            queueWaiting: true,
            jobAdded: true
          }
        }
      },
      options: {
        processorsDirectory: '/test/processors'
      },
      queues: [],
      redisInstance: {
        client: { mock: 'redis-client' },
        disconnect: vi.fn()
      } as any,
      databaseInstance: null,
      eventManager: undefined
    };

    mockHelper.defaultsDeep.mockImplementation((target, ...sources) => ({ ...target, ...sources[0] }));

    queueManager = new QueueManager(mockParams);
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(queueManager).toBeInstanceOf(QueueManager);
      expect(mockHelper.defaultsDeep).toHaveBeenCalledWith(
        mockParams.options,
        {}
      );
    });
  });

  describe('registerQueues', () => {
    it('should return early if no queues provided', async () => {
      await queueManager.registerQueues({ queues: [] });
      // Should return early without checking directory
    });

    it('should warn and return if processors directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false
        }
      ];

      await queueManager.registerQueues({ queues });

      expect(mockExistsSync).toHaveBeenCalledWith('/test/processors');
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Processors directory not found',
        meta: {
          Directory: '/test/processors'
        }
      });
    });

    it('should register queues successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoader.loadModulesInDirectory.mockResolvedValue({
        'test-job': class MockProcessor {}
      });

      const mockQueueInstance = {
        on: vi.fn(),
        add: vi.fn(),
        getJobs: vi.fn()
      };
      mockQueue.mockImplementation(() => mockQueueInstance as any);

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false
        }
      ];

      await queueManager.registerQueues({ queues });

      expect(mockLoader.loadModulesInDirectory).toHaveBeenCalledWith({
        directory: '/test/processors',
        extensions: ['.ts', '.js']
      });
      expect(mockQueue).toHaveBeenCalledWith('test-queue', {
        connection: mockParams.redisInstance.client,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true
        }
      });
    });

    it('should handle loader errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoader.loadModulesInDirectory.mockRejectedValue(new Error('Load error'));

      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false
        }
      ];

      await queueManager.registerQueues({ queues });

      expect(mockLogger.error).toHaveBeenCalledWith({ 
        error: expect.any(Error) 
      });
    });
  });

  describe('addJobToQueue', () => {
    beforeEach(() => {
      // Setup a mock queue
      const mockQueueInstance = {
        add: vi.fn().mockResolvedValue({ id: 'job-123' })
      };
      
      // @ts-ignore - accessing private property for testing
      queueManager['queues'].set('test-queue', mockQueueInstance as any);
    });

    it('should add job to queue successfully', async () => {
      const jobData = { userId: 123, action: 'process' };
      
      const result = await queueManager.addJobToQueue({
        queueId: 'test-queue',
        jobId: 'test-job',
        data: jobData
      });

      expect(result).toEqual({ id: 'job-123' });
    });

    it('should handle queue not found', async () => {
      const jobData = { userId: 123 };

      const result = await queueManager.addJobToQueue({
        queueId: 'non-existent-queue',
        jobId: 'test-job',
        data: jobData
      });

      expect(result).toBeUndefined();
    });

    it('should truncate long data in logs', async () => {
      const longData = { data: 'a'.repeat(100) };
      
      const result = await queueManager.addJobToQueue({
        queueId: 'test-queue',
        jobId: 'test-job',
        data: longData
      });

      // The function should handle long data internally
      expect(result).toBeDefined();
    });
  });

  describe('listAllJobsWithStatus', () => {
    it('should list jobs from all queues', async () => {
      const mockQueue1 = {
        getJobs: vi.fn().mockImplementation((states) => {
          if (states.includes('active')) {
            return Promise.resolve([
              {
                id: 'job-1',
                name: 'test-job',
                attemptsMade: 1,
                failedReason: null
              }
            ]);
          }
          return Promise.resolve([]);
        })
      };

      const mockQueue2 = {
        getJobs: vi.fn().mockResolvedValue([])
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
        failedReason: null
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
        meta: { queueName: 'test-queue' }
      });
    });

    it('should log without meta', () => {
      queueManager.log('Simple message');

      expect(mockLogger.custom).toHaveBeenCalledWith({
        level: 'queue',
        message: 'Simple message',
        meta: undefined
      });
    });
  });

  describe('queue event handlers', () => {
    let mockQueueInstance: any;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoader.loadModulesInDirectory.mockResolvedValue({
        'test-job': class MockProcessor {}
      });

      mockQueueInstance = {
        on: vi.fn(),
        add: vi.fn(),
        getJobs: vi.fn()
      };
      mockQueue.mockImplementation(() => mockQueueInstance);

      // Mock the log method
      vi.spyOn(queueManager, 'log').mockImplementation(() => {});
    });

    it('should handle queue error events', async () => {
      const queues: QueueItem[] = [
        {
          name: 'test-queue',
          jobs: [{ id: 'test-job' }],
          isExternal: false
        }
      ];

      await queueManager.registerQueues({ queues });

      // Get the error handler
      const errorHandler = mockQueueInstance.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

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
          isExternal: false
        }
      ];

      await queueManager.registerQueues({ queues });

      // Get the waiting handler
      const waitingHandler = mockQueueInstance.on.mock.calls.find(
        (call: any) => call[0] === 'waiting'
      )?.[1];

      expect(waitingHandler).toBeDefined();
      
      // Simulate waiting job
      const mockJob = { queueName: 'test-queue', id: 'job-123' };
      waitingHandler(mockJob);

      expect(queueManager.log).toHaveBeenCalledWith('Waiting...', {
        Queue: 'test-queue',
        Job: 'job-123'
      });
    });
  });
});