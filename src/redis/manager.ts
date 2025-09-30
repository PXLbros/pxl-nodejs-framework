import { Redis, type RedisOptions } from 'ioredis';
import type { RedisManagerConfig as RedisManagerOptions } from './manager.interface.js';
import RedisInstance from './instance.js';
import { Logger } from '../logger/index.js';

export default class RedisManager {
  private logger: typeof Logger = Logger;

  private options: RedisManagerOptions;

  public instances: RedisInstance[] = [];

  constructor(config: RedisManagerOptions) {
    this.options = config;
  }

  public async connect(): Promise<RedisInstance> {
    const redisOptions: RedisOptions = {
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      maxRetriesPerRequest: null, // Needed for bullmq
    };

    const client = new Redis(redisOptions);
    const publisherClient = new Redis(redisOptions);
    const subscriberClient = new Redis(redisOptions);

    try {
      // Wait for all three clients to be ready
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          client.once('ready', () => resolve());
          client.once('error', (error: Error) => reject(error));
        }),
        new Promise<void>((resolve, reject) => {
          publisherClient.once('ready', () => resolve());
          publisherClient.once('error', (error: Error) => reject(error));
        }),
        new Promise<void>((resolve, reject) => {
          subscriberClient.once('ready', () => resolve());
          subscriberClient.once('error', (error: Error) => reject(error));
        }),
      ]);

      const redisInstance = new RedisInstance({
        redisManager: this,
        client,
        publisherClient,
        subscriberClient,
      });

      this.instances.push(redisInstance);

      if (this.options.applicationConfig.log?.startUp) {
        this.log('Connected', {
          Host: this.options.host,
          Port: this.options.port,
        });
      }

      return redisInstance;
    } catch (error) {
      // Clean up clients on error
      await Promise.allSettled([client.quit(), publisherClient.quit(), subscriberClient.quit()]);

      Logger.error({ error: error as Error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await Promise.all(this.instances.map(instance => instance.disconnect()));
  }

  /**
   * Log Redis message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'redis', message, meta });
  }
}
