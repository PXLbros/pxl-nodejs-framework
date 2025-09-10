import type RedisManager from '../redis/manager.js';
import type RedisInstance from '../redis/instance.js';

/**
 * CacheManager
 *
 * Thin abstraction over Redis for basic JSON value caching. Unifies all Redis
 * access through the framework RedisManager / RedisInstance (ioredis) so we
 * avoid maintaining a second client implementation (node-redis).
 *
 * Lazy acquisition: the first call to any cache method will either reuse an
 * existing connected RedisInstance (if already established by application
 * startup) or trigger a connection via RedisManager.
 */

export interface CacheManagerProps {
  /** Redis manager (shared across the application) */
  redisManager: RedisManager;
}

export default class CacheManager {
  private redisManager: RedisManager;
  private redisInstance?: RedisInstance;

  constructor({ redisManager }: CacheManagerProps) {
    this.redisManager = redisManager;
  }

  /**
   * Ensure we have a connected RedisInstance. Reuses the first existing
   * instance if already connected by the application bootstrap.
   */
  private async getRedisInstance(): Promise<RedisInstance> {
    if (this.redisInstance) return this.redisInstance;

    if (this.redisManager.instances.length > 0) {
      this.redisInstance = this.redisManager.instances[0];
      return this.redisInstance;
    }

    // Lazily connect if no instances yet (e.g., used before app onBeforeStart)
    this.redisInstance = await this.redisManager.connect();
    return this.redisInstance;
  }

  /**
   * Get a cached JSON value (deserialized) or null if not present.
   */
  public async getItem<T>({ key }: { key: string }): Promise<T | null> {
    const instance = await this.getRedisInstance();
    const raw = await instance.getCache({ key });
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Fallback: return raw string if it wasn't JSON we produced
      return raw as unknown as T;
    }
  }

  /**
   * Set a JSON-serializable value. Optionally specify lifetime (seconds).
   */
  public async setItem<T>({ key, value, lifetime }: { key: string; value: T; lifetime?: number }): Promise<void> {
    const instance = await this.getRedisInstance();
    await instance.setCache({ key, value, expiration: lifetime });
  }

  /**
   * Delete a cached value.
   */
  public async clearItem({ key }: { key: string }): Promise<void> {
    const instance = await this.getRedisInstance();
    await instance.deleteCache({ key });
  }

  /**
   * No-op: lifecycle handles Redis disconnection globally.
   */
  public async close(): Promise<void> {
    // Intentionally empty; RedisManager handles disconnect.
  }
}
