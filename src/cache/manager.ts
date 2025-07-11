import { type RedisClientType, createClient } from 'redis';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type RedisManager from '../redis/manager.js';

export interface CacheManagerProps {
  applicationConfig: ApplicationConfig;
  redisManager: RedisManager;
}

export default class CacheManager {
  private client?: RedisClientType;

  private applicationConfig: ApplicationConfig;
  private redisManager: RedisManager;

  constructor({ applicationConfig, redisManager }: CacheManagerProps) {
    this.applicationConfig = applicationConfig;
    this.redisManager = redisManager;
  }

  private async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = createClient({
        socket: {
          host: this.applicationConfig.redis.host,
          port: this.applicationConfig.redis.port,
        },
      });

      await this.client.connect();
    }
    return this.client;
  }

  public async getItem<T>({ key }: { key: string }): Promise<T | null> {
    const client = await this.getClient();
    const value = await client.get(key);

    return value ? JSON.parse(value) : null;
  }

  public async setItem<T>({ key, value, lifetime }: { key: string; value: T; lifetime?: number }): Promise<void> {
    const client = await this.getClient();
    const stringValue = JSON.stringify(value);

    if (lifetime) {
      await client.setEx(key, lifetime, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  }

  public async clearItem({ key }: { key: string }): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}
