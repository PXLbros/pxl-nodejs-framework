import Redis, { RedisOptions } from 'ioredis';
import { RedisInstance, logger } from '~/lib';

interface RedisManagerConfig {
  host: string;
  port: number;
  password?: string;
}

export default class RedisManager {
  private config: RedisManagerConfig;

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

        logger.debug('Connected to Redis', {
          Host: this.config.host,
          Port: this.config.port,
        });

        resolve(redisInstance);
      };

      const handleError = (error: Error): void => {
        logger.error(error);

        reject(error);
      };

      client.on('connect', handleConnect);
      client.on('error', handleError);
    });
  }
}
