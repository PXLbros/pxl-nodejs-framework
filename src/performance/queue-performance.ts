import { PerformanceMonitor } from './performance-monitor.js';

export interface QueueOperationMetadata {
  operation: string;
  queueName?: string;
  jobName?: string;
  jobId?: string;
  priority?: number;
  delay?: number;
  attempts?: number;
  error?: string;
  argumentCount?: number;
}

export class QueuePerformanceWrapper {
  private static performanceMonitor: PerformanceMonitor;

  public static setPerformanceMonitor(monitor: PerformanceMonitor): void {
    QueuePerformanceWrapper.performanceMonitor = monitor;
  }

  private static getPerformanceMonitor(): PerformanceMonitor {
    if (!QueuePerformanceWrapper.performanceMonitor) {
      QueuePerformanceWrapper.performanceMonitor = PerformanceMonitor.getInstance();
    }
    return QueuePerformanceWrapper.performanceMonitor;
  }

  /**
   * Monitor job processing
   */
  public static async monitorJobProcessing<T>(
    queueName: string,
    jobName: string,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: 'job_processing',
      queueName,
      jobName,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `${queueName}.${jobName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor job addition to queue
   */
  public static async monitorJobAddition<T>(
    queueName: string,
    jobName: string,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: 'job_addition',
      queueName,
      jobName,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `add.${queueName}.${jobName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor queue operations
   */
  public static async monitorQueueOperation<T>(
    queueName: string,
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: operationName,
      queueName,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `queue.${queueName}.${operationName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor processor execution
   */
  public static async monitorProcessor<T>(
    processorName: string,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: 'processor_execution',
      jobName: processorName,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `processor.${processorName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor queue worker operations
   */
  public static async monitorWorker<T>(
    workerName: string,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: 'worker_execution',
      ...metadata,
    };

    return monitor.measureAsync({
      name: `worker.${workerName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor job retry operations
   */
  public static async monitorJobRetry<T>(
    queueName: string,
    jobName: string,
    attempt: number,
    operation: () => Promise<T>,
    metadata?: Partial<QueueOperationMetadata>,
  ): Promise<T> {
    const monitor = QueuePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: QueueOperationMetadata = {
      operation: 'job_retry',
      queueName,
      jobName,
      attempts: attempt,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `retry.${queueName}.${jobName}`,
      type: 'queue',
      fn: operation,
      metadata: operationMetadata,
    });
  }
}

/**
 * Decorator for monitoring queue processor methods
 */
export function MonitorQueueProcessor(processorName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const operation = processorName ?? propertyKey;

    descriptor.value = async function (...args: any[]) {
      return QueuePerformanceWrapper.monitorProcessor(
        `${className}.${operation}`,
        () => originalMethod.apply(this, args),
        { argumentCount: args.length },
      );
    };

    return descriptor;
  };
}
