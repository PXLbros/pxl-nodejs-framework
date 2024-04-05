import { Redis, RedisOptions } from 'ioredis';
import { RedisManagerConfig } from './manager.interface.js';
import RedisInstance from './instance.js';
import { Logger } from '../logger/index.js';

export default class RedisManager {
  private config: RedisManagerConfig;

  public instances: RedisInstance[] = [];

  constructor(config: RedisManagerConfig) {
    this.config = config;
  }

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

      const handleConnect = (): void => {
        const redisInstance = new RedisInstance({
          client,
          publisherClient,
          subscriberClient,
        });

        this.instances.push(redisInstance);

        Logger.debug('Connected to Redis', {
          Host: this.config.host,
          Port: this.config.port,
        });

        resolve(redisInstance);
      };

      const handleError = (error: Error): void => {
        Logger.error(error);

        reject(error);
      };

      client.on('connect', handleConnect);
      client.on('error', handleError);
    });
  }

  public async disconnect(): Promise<void> {
    await Promise.all(this.instances.map((instance) => instance.disconnect()));
  }
}
