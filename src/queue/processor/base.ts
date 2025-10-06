import type { Job } from 'bullmq';
import type { QueueManager } from '../../queue/index.js';
import type { DatabaseInstance } from '../../database/index.js';
import type { ApplicationConfig } from '../../application/base-application.interface.js';
import { Logger } from '../../logger/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type EventManager from '../../event/manager.js';
import type { QueueJobData } from '../job.interface.js';
import { safeSerializeError } from '../../error/error-reporter.js';

export default abstract class BaseProcessor<
  TQueueManager extends QueueManager = QueueManager,
  TJobData extends QueueJobData = QueueJobData,
  TResult = unknown,
> {
  private logger: typeof Logger = Logger;

  constructor(
    protected queueManager: TQueueManager,
    protected applicationConfig: ApplicationConfig,
    protected redisInstance: RedisInstance,
    protected databaseInstance: DatabaseInstance | null,
    protected eventManager?: EventManager,
  ) {}

  public abstract process({ job }: { job: Job<TJobData, TResult> }): Promise<TResult>;

  /**
   * Enhanced logger with structured methods
   */
  public log = {
    error: (error: Error | unknown, message?: string, meta?: Record<string, unknown>): void => {
      if (message) {
        const errorMeta = {
          ...(meta ?? {}),
          error: error instanceof Error ? error.message : safeSerializeError(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
        this.logger.custom({ level: 'queueJob', message, meta: errorMeta });
      } else {
        this.logger.custom({ level: 'queueJob', message: error });
      }
    },

    info: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'queueJob', message, meta });
    },

    warn: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'queueJob', message, meta });
    },

    debug: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom({ level: 'queueJob', message, meta });
    },
  };
}
