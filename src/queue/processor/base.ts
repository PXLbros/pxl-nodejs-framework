import type { Job } from 'bullmq';
import type { EntityManager } from '@mikro-orm/core';
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
   * Called before process() - override for setup logic
   * Perfect place to fork EntityManager, open connections, etc.
   *
   * @example
   * async beforeProcess({ job }) {
   *   this.jobEntityManager = this.databaseInstance.getEntityManager();
   * }
   */
  public async beforeProcess({ job }: { job: Job<TJobData, TResult> }): Promise<void> {
    // Default: no-op
  }

  /**
   * Called after process() completes - override for cleanup
   * Perfect place to clear EntityManager, close connections, etc.
   * ALWAYS called even if process() throws an error
   *
   * @example
   * async afterProcess({ job }) {
   *   if (this.jobEntityManager) {
   *     this.jobEntityManager.clear();
   *     delete this.jobEntityManager;
   *   }
   * }
   */
  public async afterProcess({
    job,
    result,
    error,
  }: {
    job: Job<TJobData, TResult>;
    result?: TResult;
    error?: Error;
  }): Promise<void> {
    // Default: no-op
  }

  /**
   * Convenience method: Execute callback with automatic EntityManager lifecycle
   * Creates fork before, cleans up after (even on error)
   *
   * @example
   * class MyProcessor extends BaseProcessor {
   *   async process({ job }) {
   *     return this.withEntityManager(async (em) => {
   *       const user = await em.findOne('User', { id: job.data.userId });
   *       return user;
   *     });
   *   }
   * }
   */
  protected async withEntityManager<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    if (!this.databaseInstance) {
      throw new Error('Database not available');
    }
    return this.databaseInstance.withEntityManager(callback);
  }

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
