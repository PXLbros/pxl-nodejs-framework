import Redis, { RedisOptions } from 'ioredis';
import { RedisManagerConfig } from './redis-manager.interface';
import RedisInstance from './redis-instance';
import logger from '../logger/logger';

export default class RedisManager {
  private readonly config: RedisManagerConfig;

  private instances: RedisInstance[] = [];

  constructor(config: RedisManagerConfig) {
    this.config = config;
  }

  /**
   * Connect to Redis
   */
  public connect(): Promise<RedisInstance> {
    return new Promise((resolve, reject) => {
      const redisOptions: RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        maxRetriesPerRequest: null, // Needed for bullmq
      };

      const client = new Redis(redisOptions);

      const publisherClient = new Redis(redisOptions);
      const subscriberClient = new Redis(redisOptions);

      client.on('connect', () => this.handleConnect(client, publisherClient, subscriberClient, resolve));
      client.on('error', (error) => this.handleError(error, reject));
    });
  }

  private handleConnect(
    client: Redis,
    publisherClient: Redis,
    subscriberClient: Redis,
    resolve: (value: RedisInstance | PromiseLike<RedisInstance>) => void,
  ): void {
    const redisInstance = new RedisInstance({
      client,
      publisherClient,
      subscriberClient,
    });

    this.instances.push(redisInstance);

    logger.debug('Connected to Redis', {
      host: this.config.host,
      port: this.config.port,
    });

    resolve(redisInstance);
  }

  private handleError(error: Error, reject: (reason?: any) => void): void {
    logger.error(error);

    reject(error);
  }
}
