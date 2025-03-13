import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import { QueueManager } from '../queue/index.js';
import RedisInstance from '../redis/instance.js';
export interface CommandConstructorParams {
    applicationConfig: ApplicationConfig;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
}
//# sourceMappingURL=command.interface.d.ts.map