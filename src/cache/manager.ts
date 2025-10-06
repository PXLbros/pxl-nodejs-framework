import type RedisManager from '../redis/manager.js';
import type RedisInstance from '../redis/instance.js';
import { safeSerializeError } from '../error/error-reporter.js';

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
 *
 * **Important:** All values are stored as JSON strings. Only JSON-serializable
 * values are supported. Complex types like Date, Map, Set, RegExp, etc. will
 * lose their type information during serialization:
 * - `Date` objects → ISO strings
 * - `Map` / `Set` → empty objects `{}`
 * - `undefined` → omitted from objects, `null` in arrays
 * - Functions → omitted
 *
 * @example
 * ```typescript
 * // Supported types
 * await cache.setItem({ key: 'user', value: { id: 1, name: 'John' } }); // ✓
 * await cache.setItem({ key: 'count', value: 42 }); // ✓
 * await cache.setItem({ key: 'tags', value: ['a', 'b', 'c'] }); // ✓
 *
 * // Unsupported types (will lose type information)
 * await cache.setItem({ key: 'date', value: new Date() }); // → ISO string
 * await cache.setItem({ key: 'map', value: new Map() }); // → {}
 * ```
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
   *
   * @param key - Cache key
   * @returns Deserialized value or null if not found
   * @throws {Error} If the cached value is not valid JSON
   *
   * @example
   * ```typescript
   * const user = await cache.getItem<{ id: number; name: string }>({ key: 'user:123' });
   * if (user) {
   *   console.log(user.name);
   * }
   * ```
   */
  public async getItem<T>({ key }: { key: string }): Promise<T | null> {
    const instance = await this.getRedisInstance();
    const raw = await instance.getCache({ key });
    if (raw === null) return null;

    // Validate that we received a string (Redis should always return string or null)
    if (typeof raw !== 'string') {
      throw new Error(`Cache value for key "${key}" must be a string, got ${typeof raw}`);
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : safeSerializeError(error);
      throw new Error(`Failed to parse cached value for key "${key}": ${errorMessage}`);
    }
  }

  /**
   * Set a JSON-serializable value. Optionally specify lifetime (seconds).
   *
   * @param key - Cache key
   * @param value - Value to cache (must be JSON-serializable)
   * @param lifetime - Optional expiration in seconds
   *
   * @example
   * ```typescript
   * // Cache with no expiration
   * await cache.setItem({ key: 'config', value: { theme: 'dark' } });
   *
   * // Cache with 1 hour expiration
   * await cache.setItem({
   *   key: 'session:abc',
   *   value: { userId: 123 },
   *   lifetime: 3600
   * });
   * ```
   */
  public async setItem<T>({ key, value, lifetime }: { key: string; value: T; lifetime?: number }): Promise<void> {
    const instance = await this.getRedisInstance();
    await instance.setCache({ key, value, expiration: lifetime });
  }

  /**
   * Delete a cached value.
   *
   * @param key - Cache key to delete
   *
   * @example
   * ```typescript
   * await cache.clearItem({ key: 'session:abc' });
   * ```
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
