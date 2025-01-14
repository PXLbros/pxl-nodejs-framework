import { ApplicationConfig } from '../application/base-application.interface.js';
import RedisManager from '../redis/manager.js';
export interface CacheManagerProps {
    applicationConfig: ApplicationConfig;
    redisManager: RedisManager;
}
export default class CacheManager {
    private client?;
    private applicationConfig;
    private redisManager;
    constructor({ applicationConfig, redisManager }: CacheManagerProps);
    private getClient;
    getItem<T>({ key }: {
        key: string;
    }): Promise<T | null>;
    setItem<T>({ key, value, lifetime }: {
        key: string;
        value: T;
        lifetime?: number;
    }): Promise<void>;
    clearItem({ key }: {
        key: string;
    }): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map