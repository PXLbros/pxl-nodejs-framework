import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import { QueueManager } from '../queue/index.js';
import RedisInstance from '../redis/instance.js';
import { CommandConstructorParams } from './command.interface.js';
import { Logger } from '../logger/index.js';

export default abstract class Command {
  /** Command name */
  public abstract name: string;

  /** Command description */
  public abstract description: string;

  protected applicationConfig: ApplicationConfig;

  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  protected logger: typeof Logger;

  constructor({ applicationConfig, redisInstance, queueManager, databaseInstance }: CommandConstructorParams) {
    this.applicationConfig = applicationConfig;

    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;

    this.logger = Logger;
  }

  /**
   * Run command
   */
  public abstract run(): Promise<void>;

  /**
   * Log command message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.command(message, {
      Command: this.name,
      ...meta
    });
  }
}
