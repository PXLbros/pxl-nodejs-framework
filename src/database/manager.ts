import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseInstance from './instance.js';
import type { ApplicationDatabaseOptions } from './manager.interface.js';
import { Logger } from '../logger/index.js';
import { DatabasePerformanceWrapper } from '../performance/index.js';

/**
 * Database manager
 */
export default class DatabaseManager {
  private logger: typeof Logger = Logger;

  private readonly options: ApplicationDatabaseOptions;

  private instances: DatabaseInstance[] = [];

  /**
   * Database manager constructor
   */
  constructor(options: ApplicationDatabaseOptions) {
    this.options = options;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<DatabaseInstance> {
    return DatabasePerformanceWrapper.monitorConnection('connect', async () => {
      const startTime = performance.now();

      try {
        const orm = await MikroORM.init();

        const databaseInstance = new DatabaseInstance({
          databaseManager: this,
          applicationConfig: this.options.applicationConfig,
          orm,
        });

        this.instances.push(databaseInstance);

        const duration = performance.now() - startTime;
        const ormConfig = typeof orm.config?.getAll === 'function' ? orm.config.getAll() : undefined;
        const logMeta = {
          Host: ormConfig?.host ?? this.options.host,
          User: ormConfig?.user ?? this.options.username,
          Database: ormConfig?.dbName ?? this.options.databaseName,
          Duration: `${duration.toFixed(2)}ms`,
        };

        if (this.options.applicationConfig.log?.startUp) {
          this.log('Connected', logMeta);
        } else {
          this.logger.debug({ message: 'Database connected', meta: logMeta });
        }

        return databaseInstance;
      } catch (error) {
        const duration = performance.now() - startTime;

        this.logger.error({
          error: error instanceof Error ? error : new Error(String(error)),
          message: 'Database connection failed',
          meta: {
            Host: this.options.host,
            Database: this.options.databaseName,
            Duration: `${duration.toFixed(2)}ms`,
          },
        });

        throw error;
      }
    });
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    await DatabasePerformanceWrapper.monitorConnection('disconnect', async () => {
      const startTime = performance.now();
      const instanceCount = this.instances.length;

      try {
        await Promise.all(this.instances.map(instance => instance.disconnect()));

        const duration = performance.now() - startTime;

        if (instanceCount > 0) {
          const meta = {
            Host: this.options.host,
            Instances: instanceCount,
            Duration: `${duration.toFixed(2)}ms`,
          };

          if (this.options.applicationConfig.log?.startUp) {
            this.log('Disconnected all database instances', meta);
          } else {
            this.logger.debug({ message: 'Database instances disconnected', meta });
          }
        }

        this.instances = [];
      } catch (error) {
        const duration = performance.now() - startTime;

        this.logger.error({
          error: error instanceof Error ? error : new Error(String(error)),
          message: 'Database disconnection failed',
          meta: {
            Host: this.options.host,
            Duration: `${duration.toFixed(2)}ms`,
            Instances: instanceCount,
          },
        });

        throw error;
      }
    });
  }

  /**
   * Log database message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'database', message, meta });
  }
}
