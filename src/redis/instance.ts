import { Redis } from 'ioredis';
import { Logger } from '../logger/index.js';
import { RedisInstanceProps } from './instance.interface.js';
import RedisManager from './manager.js';

export default class RedisInstance {
  private redisManager: RedisManager;

  public client: Redis;
  public publisherClient: Redis;
  public subscriberClient: Redis;

  constructor({ redisManager, client, publisherClient, subscriberClient }: RedisInstanceProps) {
    this.redisManager = redisManager;

    this.client = client;
    this.publisherClient = publisherClient;
    this.subscriberClient = subscriberClient;
  }

  public async disconnect(): Promise<void> {
    const disconnectPromises = [
      this.subscriberClient.quit().catch(() => Logger.error('Could not disconnect Redis subscriber client')),
      this.publisherClient.quit().catch(() => Logger.error('Could not disconnect Redis publisherClient')),
      this.client.quit().catch(() => Logger.error('Could not disconnect Redis client')),
    ];

    await Promise.all(disconnectPromises);

    this.redisManager.log('Disconnected');
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
