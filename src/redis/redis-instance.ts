import Redis from 'ioredis';
import logger from '../logger/logger';
import { RedisInstanceProps } from './redis-instance.interface';

export default class RedisInstance {
  public client: Redis;
  public publisherClient: Redis;
  public subscriberClient: Redis;

  constructor({ client, publisherClient, subscriberClient }: RedisInstanceProps) {
    this.client = client;

    this.publisherClient = publisherClient;
    this.subscriberClient = subscriberClient;
  }

  public async disconnect(): Promise<void> {
    const disconnectPromises = [
      this.subscriberClient.quit().catch(() => logger.warn('Could not disconnect Redis subscriber client')),
      this.publisherClient.quit().catch(() => logger.warn('Could not disconnect Redis publisher client')),
      this.client.quit().catch(() => logger.error('Could not disconnect Redis client')),
    ];

    await Promise.all(disconnectPromises);

    logger.debug('Disconnected from Redis');
  }

  public isConnected(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.client) {
        this.client.ping((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      } else {
        resolve(false);
      }
    });
  }
}
