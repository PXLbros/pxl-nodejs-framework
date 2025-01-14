import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import EventManager from '../event/manager.js';
import { RedisInstance } from '../redis/index.js';
import { QueueItem } from './index.interface.js';
export interface QueueManagerOptions {
    /** Queue processors directory */
    processorsDirectory: string;
}
export interface QueueManagerConstructorParams {
    applicationConfig: ApplicationConfig;
    options?: QueueManagerOptions;
    queues: QueueItem[];
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance | null;
    eventManager?: EventManager;
}
//# sourceMappingURL=manager.interface.d.ts.map