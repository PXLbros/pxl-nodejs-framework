import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueuePerformanceWrapper, MonitorQueueProcessor } from '../../../dist/performance/queue-performance.js';
import { PerformanceMonitor } from '../../../dist/performance/performance-monitor.js';

describe('QueuePerformanceWrapper', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
    QueuePerformanceWrapper.setPerformanceMonitor(performanceMonitor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setPerformanceMonitor', () => {
    it('should set performance monitor', () => {
      const customMonitor = PerformanceMonitor.getInstance();
      QueuePerformanceWrapper.setPerformanceMonitor(customMonitor);
      expect(QueuePerformanceWrapper['performanceMonitor']).toBe(customMonitor);
    });
  });

  describe('monitorJobProcessing', () => {
    it('should monitor job processing successfully', async () => {
      const operation = vi.fn().mockResolvedValue({ processed: true });

      const result = await QueuePerformanceWrapper.monitorJobProcessing('email-queue', 'send-email', operation);

      expect(result).toEqual({ processed: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should include metadata in job processing', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const metadata = {
        jobId: 'job-123',
        priority: 5,
        attempts: 1,
      };

      const result = await QueuePerformanceWrapper.monitorJobProcessing(
        'notification-queue',
        'push-notification',
        operation,
        metadata,
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle job processing errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Job failed'));

      await expect(
        QueuePerformanceWrapper.monitorJobProcessing('error-queue', 'failing-job', operation),
      ).rejects.toThrow('Job failed');
    });

    it('should monitor multiple concurrent jobs', async () => {
      const job1 = vi.fn().mockResolvedValue('job1 done');
      const job2 = vi.fn().mockResolvedValue('job2 done');
      const job3 = vi.fn().mockResolvedValue('job3 done');

      const results = await Promise.all([
        QueuePerformanceWrapper.monitorJobProcessing('queue', 'job1', job1),
        QueuePerformanceWrapper.monitorJobProcessing('queue', 'job2', job2),
        QueuePerformanceWrapper.monitorJobProcessing('queue', 'job3', job3),
      ]);

      expect(results).toEqual(['job1 done', 'job2 done', 'job3 done']);
    });
  });

  describe('monitorJobAddition', () => {
    it('should monitor job addition successfully', async () => {
      const operation = vi.fn().mockResolvedValue({ jobId: 'new-job-456' });

      const result = await QueuePerformanceWrapper.monitorJobAddition('data-queue', 'process-data', operation);

      expect(result).toEqual({ jobId: 'new-job-456' });
      expect(operation).toHaveBeenCalled();
    });

    it('should include priority and delay metadata', async () => {
      const operation = vi.fn().mockResolvedValue({ queued: true });
      const metadata = {
        priority: 10,
        delay: 5000,
        jobId: 'delayed-job',
      };

      const result = await QueuePerformanceWrapper.monitorJobAddition(
        'scheduled-queue',
        'scheduled-task',
        operation,
        metadata,
      );

      expect(result).toEqual({ queued: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should handle job addition errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Queue full'));

      await expect(QueuePerformanceWrapper.monitorJobAddition('full-queue', 'new-job', operation)).rejects.toThrow(
        'Queue full',
      );
    });
  });

  describe('monitorQueueOperation', () => {
    it('should monitor queue pause operation', async () => {
      const operation = vi.fn().mockResolvedValue({ paused: true });

      const result = await QueuePerformanceWrapper.monitorQueueOperation('main-queue', 'pause', operation);

      expect(result).toEqual({ paused: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should monitor queue resume operation', async () => {
      const operation = vi.fn().mockResolvedValue({ resumed: true });

      const result = await QueuePerformanceWrapper.monitorQueueOperation('main-queue', 'resume', operation);

      expect(result).toEqual({ resumed: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should monitor queue clean operation', async () => {
      const operation = vi.fn().mockResolvedValue({ cleaned: 50 });

      const result = await QueuePerformanceWrapper.monitorQueueOperation('old-queue', 'clean', operation);

      expect(result).toEqual({ cleaned: 50 });
      expect(operation).toHaveBeenCalled();
    });

    it('should include custom metadata', async () => {
      const operation = vi.fn().mockResolvedValue(true);
      const metadata = { jobId: 'special-job', queueName: 'priority-queue' };

      const result = await QueuePerformanceWrapper.monitorQueueOperation(
        'test-queue',
        'custom-op',
        operation,
        metadata,
      );

      expect(result).toBe(true);
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('monitorProcessor', () => {
    it('should monitor processor execution', async () => {
      const operation = vi.fn().mockResolvedValue({ completed: true });

      const result = await QueuePerformanceWrapper.monitorProcessor('EmailProcessor', operation);

      expect(result).toEqual({ completed: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should include metadata in processor monitoring', async () => {
      const operation = vi.fn().mockResolvedValue('processed');
      const metadata = {
        attempts: 3,
        error: 'Previous error',
      };

      const result = await QueuePerformanceWrapper.monitorProcessor('DataProcessor', operation, metadata);

      expect(result).toBe('processed');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle processor errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Processor crashed'));

      await expect(QueuePerformanceWrapper.monitorProcessor('FailingProcessor', operation)).rejects.toThrow(
        'Processor crashed',
      );
    });
  });

  describe('monitorWorker', () => {
    it('should monitor worker execution', async () => {
      const operation = vi.fn().mockResolvedValue({ worked: true });

      const result = await QueuePerformanceWrapper.monitorWorker('worker-1', operation);

      expect(result).toEqual({ worked: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should include worker metadata', async () => {
      const operation = vi.fn().mockResolvedValue('completed');
      const metadata = { queueName: 'worker-queue', jobName: 'worker-job' };

      const result = await QueuePerformanceWrapper.monitorWorker('worker-2', operation, metadata);

      expect(result).toBe('completed');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle worker errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Worker died'));

      await expect(QueuePerformanceWrapper.monitorWorker('worker-error', operation)).rejects.toThrow('Worker died');
    });

    it('should monitor multiple workers', async () => {
      const worker1 = vi.fn().mockResolvedValue('w1');
      const worker2 = vi.fn().mockResolvedValue('w2');
      const worker3 = vi.fn().mockResolvedValue('w3');

      const results = await Promise.all([
        QueuePerformanceWrapper.monitorWorker('worker-1', worker1),
        QueuePerformanceWrapper.monitorWorker('worker-2', worker2),
        QueuePerformanceWrapper.monitorWorker('worker-3', worker3),
      ]);

      expect(results).toEqual(['w1', 'w2', 'w3']);
    });
  });

  describe('monitorJobRetry', () => {
    it('should monitor first retry attempt', async () => {
      const operation = vi.fn().mockResolvedValue({ retried: true });

      const result = await QueuePerformanceWrapper.monitorJobRetry('retry-queue', 'failing-job', 1, operation);

      expect(result).toEqual({ retried: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should monitor multiple retry attempts', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await QueuePerformanceWrapper.monitorJobRetry('persistent-queue', 'retry-job', 5, operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should include retry metadata', async () => {
      const operation = vi.fn().mockResolvedValue({ final: true });
      const metadata = {
        error: 'Timeout on previous attempt',
        delay: 10000,
      };

      const result = await QueuePerformanceWrapper.monitorJobRetry(
        'timeout-queue',
        'timeout-job',
        3,
        operation,
        metadata,
      );

      expect(result).toEqual({ final: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should handle retry failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Max retries exceeded'));

      await expect(QueuePerformanceWrapper.monitorJobRetry('dead-queue', 'dead-job', 10, operation)).rejects.toThrow(
        'Max retries exceeded',
      );
    });
  });

  describe('MonitorQueueProcessor Decorator', () => {
    it('should decorate processor method', async () => {
      class EmailProcessor {
        @MonitorQueueProcessor()
        async processEmail(emailData: any) {
          return { sent: true, emailId: emailData.id };
        }
      }

      const processor = new EmailProcessor();
      const result = await processor.processEmail({ id: 'email-123' });

      expect(result).toEqual({ sent: true, emailId: 'email-123' });
    });

    it('should decorate with custom processor name', async () => {
      class DataProcessor {
        @MonitorQueueProcessor('customProcessor')
        async handleData(data: any) {
          return { processed: true, data };
        }
      }

      const processor = new DataProcessor();
      const result = await processor.handleData({ value: 42 });

      expect(result).toEqual({ processed: true, data: { value: 42 } });
    });

    it('should preserve method context', async () => {
      class JobProcessor {
        private counter = 0;

        @MonitorQueueProcessor()
        async incrementCounter() {
          this.counter++;
          return this.counter;
        }
      }

      const processor = new JobProcessor();
      const result1 = await processor.incrementCounter();
      const result2 = await processor.incrementCounter();

      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });

    it('should handle method errors', async () => {
      class ErrorProcessor {
        @MonitorQueueProcessor()
        async failingMethod() {
          throw new Error('Processing failed');
        }
      }

      const processor = new ErrorProcessor();

      await expect(processor.failingMethod()).rejects.toThrow('Processing failed');
    });

    it('should pass multiple arguments correctly', async () => {
      class MultiArgProcessor {
        @MonitorQueueProcessor()
        async process(arg1: string, arg2: number, arg3: boolean) {
          return { arg1, arg2, arg3 };
        }
      }

      const processor = new MultiArgProcessor();
      const result = await processor.process('test', 123, true);

      expect(result).toEqual({ arg1: 'test', arg2: 123, arg3: true });
    });

    it('should handle async operations', async () => {
      class AsyncProcessor {
        @MonitorQueueProcessor()
        async delayedProcess(delay: number) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return 'completed';
        }
      }

      const processor = new AsyncProcessor();
      const result = await processor.delayedProcess(10);

      expect(result).toBe('completed');
    });
  });
});
