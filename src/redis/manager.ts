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

  public connect(): Promise<RedisInstance> {
    return new Promise((resolve, reject) => {
      const redisOptions: RedisOptions = {
        host: this.options.host,
        port: this.options.port,
        password: this.options.password,
        maxRetriesPerRequest: null, // Needed for bullmq
      };

      const client = new Redis(redisOptions);
      const publisherClient = new Redis(redisOptions);
      const subscriberClient = new Redis(redisOptions);

      const handleConnect = (): void => {
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

        resolve(redisInstance);
      };

      const handleError = (error: Error): void => {
        Logger.error({ error });

        reject(error);
      };

      client.on('connect', handleConnect);
      client.on('error', handleError);
    });
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
