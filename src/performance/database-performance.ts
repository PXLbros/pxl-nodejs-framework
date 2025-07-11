import { PerformanceMonitor } from './performance-monitor.js';

export interface DatabaseOperationMetadata {
  operation: string;
  entity?: string;
  query?: string;
  parameters?: any[];
  resultCount?: number;
  cacheHit?: boolean;
  argumentCount?: number;
}

export class DatabasePerformanceWrapper {
  private static performanceMonitor: PerformanceMonitor;

  public static setPerformanceMonitor(monitor: PerformanceMonitor): void {
    DatabasePerformanceWrapper.performanceMonitor = monitor;
  }

  private static getPerformanceMonitor(): PerformanceMonitor {
    if (!DatabasePerformanceWrapper.performanceMonitor) {
      DatabasePerformanceWrapper.performanceMonitor = PerformanceMonitor.getInstance();
    }
    return DatabasePerformanceWrapper.performanceMonitor;
  }

  /**
   * Monitor database repository operations
   */
  public static async monitorRepositoryOperation<T>(
    operationName: string,
    entity: string,
    operation: () => Promise<T>,
    additionalMetadata?: Record<string, any>,
  ): Promise<T> {
    const monitor = DatabasePerformanceWrapper.getPerformanceMonitor();

    const metadata: DatabaseOperationMetadata = {
      operation: operationName,
      entity,
      ...additionalMetadata,
    };

    return monitor.measureAsync({
      name: `${entity}.${operationName}`,
      type: 'database',
      fn: async () => {
        const result = await operation();

        // Add result metadata
        if (Array.isArray(result)) {
          metadata.resultCount = result.length;
        } else if (result && typeof result === 'object') {
          metadata.resultCount = 1;
        } else {
          metadata.resultCount = 0;
        }

        return result;
      },
      metadata,
    });
  }

  /**
   * Monitor raw database queries
   */
  public static async monitorQuery<T>(query: string, parameters: any[] = [], operation: () => Promise<T>): Promise<T> {
    const monitor = DatabasePerformanceWrapper.getPerformanceMonitor();

    const metadata: DatabaseOperationMetadata = {
      operation: 'raw_query',
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''), // Truncate long queries
      parameters: parameters.slice(0, 10), // Limit parameters for logging
    };

    return monitor.measureAsync({
      name: 'raw_query',
      type: 'database',
      fn: async () => {
        const result = await operation();

        // Add result metadata
        if (Array.isArray(result)) {
          metadata.resultCount = result.length;
        } else if (result && typeof result === 'object') {
          metadata.resultCount = 1;
        }

        return result;
      },
      metadata,
    });
  }

  /**
   * Monitor database transactions
   */
  public static async monitorTransaction<T>(
    transactionName: string,
    operation: () => Promise<T>,
    additionalMetadata?: Record<string, any>,
  ): Promise<T> {
    const monitor = DatabasePerformanceWrapper.getPerformanceMonitor();

    const metadata: DatabaseOperationMetadata = {
      operation: 'transaction',
      entity: transactionName,
      ...additionalMetadata,
    };

    return monitor.measureAsync({ name: `transaction.${transactionName}`, type: 'database', fn: operation, metadata });
  }

  /**
   * Monitor database connection operations
   */
  public static async monitorConnection<T>(connectionOperation: string, operation: () => Promise<T>): Promise<T> {
    const monitor = DatabasePerformanceWrapper.getPerformanceMonitor();

    const metadata: DatabaseOperationMetadata = {
      operation: connectionOperation,
    };

    return monitor.measureAsync({
      name: `connection.${connectionOperation}`,
      type: 'database',
      fn: operation,
      metadata,
    });
  }

  /**
   * Monitor database migrations
   */
  public static async monitorMigration<T>(migrationName: string, operation: () => Promise<T>): Promise<T> {
    const monitor = DatabasePerformanceWrapper.getPerformanceMonitor();

    const metadata: DatabaseOperationMetadata = {
      operation: 'migration',
      entity: migrationName,
    };

    return monitor.measureAsync({ name: `migration.${migrationName}`, type: 'database', fn: operation, metadata });
  }
}

/**
 * Decorator for monitoring repository methods
 */
export function MonitorDatabaseOperation(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const entityName = target.constructor.name.replace('Repository', '');
    const operation = operationName ?? propertyKey;

    descriptor.value = async function (...args: any[]) {
      return DatabasePerformanceWrapper.monitorRepositoryOperation(
        operation,
        entityName,
        () => originalMethod.apply(this, args),
        { argumentCount: args.length },
      );
    };

    return descriptor;
  };
}
