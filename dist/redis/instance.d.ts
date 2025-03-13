import { Redis } from 'ioredis';
import { RedisInstanceProps } from './instance.interface.js';
export default class RedisInstance {
    private redisManager;
    client: Redis;
    publisherClient: Redis;
    subscriberClient: Redis;
    constructor({ redisManager, client, publisherClient, subscriberClient }: RedisInstanceProps);
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;
    /**
     * Sets a value in the cache with an optional expiration time.
     *
     * @param key - The key to set in the cache.
     * @param value - The value to set in the cache.
     * @param expiration - The expiration time in seconds (optional).
     * @throws Error if the value type is not supported.
     * @returns A Promise that resolves when the value is set in the cache.
     */
    setCache({ key, value, expiration }: {
        key: string;
        value: unknown;
        expiration?: number;
    }): Promise<void>;
    getCache({ key }: {
        key: string;
    }): Promise<string | null>;
    deleteCache({ key }: {
        key: string;
    }): Promise<void>;
}
//# sourceMappingURL=instance.d.ts.map