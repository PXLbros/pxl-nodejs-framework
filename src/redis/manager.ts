import { Redis, type RedisOptions } from 'ioredis';
import type { RedisManagerConfig as RedisManagerOptions } from './manager.interface.js';
import RedisInstance from './instance.js';
import { Logger } from '../logger/index.js';
import { CachePerformanceWrapper } from '../performance/index.js';

export default class RedisManager {
  private logger: typeof Logger = Logger;

  private options: RedisManagerOptions;

  public instances: RedisInstance[] = [];

  constructor(config: RedisManagerOptions) {
    this.options = config;
  }

  public async connect(): Promise<RedisInstance> {
    return CachePerformanceWrapper.monitorConnection(
      'connect',
      async () => {
        const startTime = performance.now();

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

          const duration = performance.now() - startTime;
          const meta = {
            Host: this.options.host,
            Port: this.options.port,
            Duration: `${duration.toFixed(2)}ms`,
          };

          if (this.options.applicationConfig.log?.startUp) {
            this.log('Connected', meta);
          } else {
            this.logger.debug({ message: 'Redis connected', meta });
          }

          return redisInstance;
        } catch (error) {
          const duration = performance.now() - startTime;

          // Clean up clients on error
          await Promise.allSettled([client.quit(), publisherClient.quit(), subscriberClient.quit()]);

          this.logger.error({
            error: error instanceof Error ? error : new Error(String(error)),
            message: 'Redis connection failed',
            meta: {
              Host: this.options.host,
              Port: this.options.port,
              Duration: `${duration.toFixed(2)}ms`,
            },
          });

          throw error;
        }
      },
      { host: this.options.host, port: this.options.port },
    );
  }

  public async disconnect(): Promise<void> {
    await CachePerformanceWrapper.monitorConnection(
      'disconnect',
      async () => {
        const startTime = performance.now();
        const instanceCount = this.instances.length;

        try {
          await Promise.all(this.instances.map(instance => instance.disconnect()));

          const duration = performance.now() - startTime;

          if (instanceCount > 0) {
            const meta = {
              Instances: instanceCount,
              Host: this.options.host,
              Port: this.options.port,
              Duration: `${duration.toFixed(2)}ms`,
            };

            if (this.options.applicationConfig.log?.startUp) {
              this.log('Disconnected all Redis instances', meta);
            } else {
              this.logger.debug({ message: 'Redis instances disconnected', meta });
            }
          }

          this.instances = [];
        } catch (error) {
          const duration = performance.now() - startTime;

          this.logger.error({
            error: error instanceof Error ? error : new Error(String(error)),
            message: 'Redis disconnection failed',
            meta: {
              Host: this.options.host,
              Port: this.options.port,
              Instances: instanceCount,
              Duration: `${duration.toFixed(2)}ms`,
            },
          });

          throw error;
        }
      },
      { host: this.options.host, port: this.options.port },
    );
  }

  /**
   * Log Redis message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'redis', message, meta });
  }
}
