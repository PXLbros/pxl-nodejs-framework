import { PerformanceMonitor } from './performance-monitor.js';

export interface CacheOperationMetadata {
  operation: string;
  key?: string;
  keyPattern?: string;
  hit?: boolean;
  miss?: boolean;
  size?: number;
  ttl?: number;
  error?: string;
  argumentCount?: number;
}

export class CachePerformanceWrapper {
  private static performanceMonitor: PerformanceMonitor;

  public static setPerformanceMonitor(monitor: PerformanceMonitor): void {
    CachePerformanceWrapper.performanceMonitor = monitor;
  }

  public static getPerformanceMonitor(): PerformanceMonitor {
    if (!CachePerformanceWrapper.performanceMonitor) {
      CachePerformanceWrapper.performanceMonitor = PerformanceMonitor.getInstance();
    }
    return CachePerformanceWrapper.performanceMonitor;
  }

  /**
   * Monitor cache get operations
   */
  public static async monitorGet<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'get',
      key,
      ...metadata,
    };

    return monitor.measureAsync(
      `get.${key}`,
      'cache',
      async () => {
        const result = await operation();

        // Determine cache hit/miss
        operationMetadata.hit = result !== null && result !== undefined;
        operationMetadata.miss = !operationMetadata.hit;

        return result;
      },
      operationMetadata,
    );
  }

  /**
   * Monitor cache set operations
   */
  public static async monitorSet<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'set',
      key,
      ...metadata,
    };

    return monitor.measureAsync(`set.${key}`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache delete operations
   */
  public static async monitorDelete<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'delete',
      key,
      ...metadata,
    };

    return monitor.measureAsync(`delete.${key}`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache clear operations
   */
  public static async monitorClear<T>(
    pattern: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'clear',
      keyPattern: pattern,
      ...metadata,
    };

    return monitor.measureAsync(`clear.${pattern}`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache exists operations
   */
  public static async monitorExists<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'exists',
      key,
      ...metadata,
    };

    return monitor.measureAsync(`exists.${key}`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache multi-get operations
   */
  public static async monitorMultiGet<T>(
    keys: string[],
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'multi_get',
      keyPattern: `[${keys.join(', ')}]`,
      ...metadata,
    };

    return monitor.measureAsync(`multi_get.${keys.length}_keys`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache multi-set operations
   */
  public static async monitorMultiSet<T>(
    keys: string[],
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'multi_set',
      keyPattern: `[${keys.join(', ')}]`,
      ...metadata,
    };

    return monitor.measureAsync(`multi_set.${keys.length}_keys`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache increment operations
   */
  public static async monitorIncrement<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'increment',
      key,
      ...metadata,
    };

    return monitor.measureAsync(`increment.${key}`, 'cache', operation, operationMetadata);
  }

  /**
   * Monitor cache decrement operations
   */
  public static async monitorDecrement<T>(
    key: string,
    operation: () => Promise<T>,
    metadata?: Partial<CacheOperationMetadata>,
  ): Promise<T> {
    const monitor = CachePerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: CacheOperationMetadata = {
      operation: 'decrement',
      key,
      ...metadata,
    };

    return monitor.measureAsync(`decrement.${key}`, 'cache', operation, operationMetadata);
  }
}

/**
 * Decorator for monitoring cache operations
 */
export function MonitorCacheOperation(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const operation = operationName ?? propertyKey;

    descriptor.value = async function (...args: any[]) {
      const monitor = CachePerformanceWrapper.getPerformanceMonitor();

      return monitor.measureAsync(`${className}.${operation}`, 'cache', () => originalMethod.apply(this, args), {
        argumentCount: args.length,
      });
    };

    return descriptor;
  };
}
