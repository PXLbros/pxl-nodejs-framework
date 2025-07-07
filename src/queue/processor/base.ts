import { Job } from 'bullmq';
import { QueueManager } from '../../queue/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import { Logger } from '../../logger/index.js';
import { RedisInstance } from '../../redis/index.js';
import EventManager from '../../event/manager.js';
import { ProcessorConstructorParams } from './processor.interface.js';

export default abstract class BaseProcessor {
  private logger: typeof Logger = Logger;

  constructor(
    protected queueManager: QueueManager,
    protected applicationConfig: ApplicationConfig,
    protected redisInstance: RedisInstance,
    protected databaseInstance: DatabaseInstance | null,
    protected eventManager?: EventManager,
  ) {}

  public abstract process({ job }: { job: Job }): Promise<any>;

  /**
   * Enhanced logger with structured methods
   */
  public log = {
    error: (
      error: Error | unknown,
      message?: string,
      meta?: Record<string, unknown>,
    ): void => {
      if (message) {
        const errorMeta = {
          ...(meta || {}),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
        this.logger.custom('queueJob', message, errorMeta);
      } else {
        this.logger.custom('queueJob', error);
      }
    },

    info: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('queueJob', message, meta);
    },

    warn: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('queueJob', message, meta);
    },

    debug: (message: string, meta?: Record<string, unknown>): void => {
      this.logger.custom('queueJob', message, meta);
    },
  };
}
