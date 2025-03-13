import { Job } from 'bullmq';
import { QueueManager } from '../../queue/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import { RedisInstance } from '../../redis/index.js';
import EventManager from '../../event/manager.js';
export default abstract class BaseProcessor {
    protected queueManager: QueueManager;
    protected applicationConfig: ApplicationConfig;
    protected redisInstance: RedisInstance;
    protected databaseInstance: DatabaseInstance;
    protected eventManager: EventManager;
    private logger;
    constructor(queueManager: QueueManager, applicationConfig: ApplicationConfig, redisInstance: RedisInstance, databaseInstance: DatabaseInstance, eventManager: EventManager);
    abstract process({ job }: {
        job: Job;
    }): Promise<any>;
    /**
     * Log queue job message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=base.d.ts.map