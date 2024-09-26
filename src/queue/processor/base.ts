import { Job } from 'bullmq';
import { QueueManager } from '../../queue/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import { Logger } from '../../logger/index.js';
import { RedisInstance } from '../../redis/index.js';
import { EventManager } from '../../event/manager.js';

export default abstract class BaseProcessor {
  private logger: typeof Logger = Logger;

  constructor(
    protected queueManager: QueueManager,
    protected applicationConfig: ApplicationConfig,
    protected redisInstance: RedisInstance,
    protected databaseInstance: DatabaseInstance,
    protected eventManager: EventManager,
  ) {}

  public abstract process({ job }: { job: Job }): Promise<any>;

  /**
   * Log queue job message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom('queueJob', message, meta);
  }
}
