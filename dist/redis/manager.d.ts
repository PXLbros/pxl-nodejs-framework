import { RedisManagerConfig as RedisManagerOptions } from './manager.interface.js';
import RedisInstance from './instance.js';
export default class RedisManager {
    private logger;
    private options;
    instances: RedisInstance[];
    constructor(config: RedisManagerOptions);
    connect(): Promise<RedisInstance>;
    disconnect(): Promise<void>;
    /**
     * Log Redis message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=manager.d.ts.map