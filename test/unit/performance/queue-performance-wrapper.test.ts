import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueuePerformanceWrapper, MonitorQueueProcessor } from '../../../src/performance/queue-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

describe('QueuePerformanceWrapper', () => {
  let mockMonitor: PerformanceMonitor;

  beforeEach(() => {
    mockMonitor = {
      measureAsync: vi.fn().mockImplementation(async ({ fn }) => fn()),
    } as any;

    QueuePerformanceWrapper.setPerformanceMonitor(mockMonitor);
  });

  describe('setPerformanceMonitor', () => {
    it('should set the performance monitor', () => {
      const newMonitor = {} as PerformanceMonitor;
      QueuePerformanceWrapper.setPerformanceMonitor(newMonitor);
      expect(QueuePerformanceWrapper['performanceMonitor']).toBe(newMonitor);
    });
  });

  describe('monitorJobProcessing', () => {
    it('should monitor job processing', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });

      await QueuePerformanceWrapper.monitorJobProcessing('email', 'sendWelcome', operation, {
        jobId: 'job123',
        attempts: 1,
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'email.sendWelcome',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'job_processing',
            queueName: 'email',
            jobName: 'sendWelcome',
            jobId: 'job123',
            attempts: 1,
          }),
        }),
      );
    });
  });

  describe('monitorJobAddition', () => {
    it('should monitor job addition with metadata', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 'job456' });

      await QueuePerformanceWrapper.monitorJobAddition('notifications', 'sendPush', operation, {
        priority: 10,
        delay: 5000,
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'add.notifications.sendPush',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'job_addition',
            queueName: 'notifications',
            jobName: 'sendPush',
            priority: 10,
            delay: 5000,
          }),
        }),
      );
    });
  });

  describe('monitorQueueOperation', () => {
    it('should monitor queue operations', async () => {
      const operation = vi.fn().mockResolvedValue({ count: 42 });

      await QueuePerformanceWrapper.monitorQueueOperation('email', 'getJobCount', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'queue.email.getJobCount',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'getJobCount',
            queueName: 'email',
          }),
        }),
      );
    });
  });

  describe('monitorProcessor', () => {
    it('should monitor processor execution', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await QueuePerformanceWrapper.monitorProcessor('EmailProcessor', operation, {
        jobName: 'sendWelcome',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'processor.EmailProcessor',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'processor_execution',
            jobName: 'sendWelcome', // Uses the metadata parameter
          }),
        }),
      );
    });
  });

  describe('monitorWorker', () => {
    it('should monitor worker operations', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await QueuePerformanceWrapper.monitorWorker('worker-1', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'worker.worker-1',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'worker_execution',
          }),
        }),
      );
    });
  });

  describe('monitorJobRetry', () => {
    it('should monitor job retry with attempt number', async () => {
      const operation = vi.fn().mockResolvedValue({ retried: true });

      await QueuePerformanceWrapper.monitorJobRetry('email', 'sendWelcome', 3, operation, {
        error: 'Connection timeout',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'retry.email.sendWelcome',
          type: 'queue',
          metadata: expect.objectContaining({
            operation: 'job_retry',
            queueName: 'email',
            jobName: 'sendWelcome',
            attempts: 3,
            error: 'Connection timeout',
          }),
        }),
      );
    });
  });

  describe('MonitorQueueProcessor decorator', () => {
    it('should monitor decorated processor method', async () => {
      class EmailProcessor {
        @MonitorQueueProcessor('sendEmail')
        async process(data: any) {
          return { sent: true, to: data.to };
        }
      }

      const processor = new EmailProcessor();
      const result = await processor.process({ to: 'test@example.com' });

      expect(result).toEqual({ sent: true, to: 'test@example.com' });
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            operation: 'processor_execution',
            jobName: 'EmailProcessor.sendEmail',
            argumentCount: 1,
          }),
        }),
      );
    });

    it('should use method name when processor name not specified', async () => {
      class NotificationProcessor {
        @MonitorQueueProcessor()
        async handleNotification(message: string) {
          return { handled: true };
        }
      }

      const processor = new NotificationProcessor();
      await processor.handleNotification('test');

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining('handleNotification'),
        }),
      );
    });
  });
});
