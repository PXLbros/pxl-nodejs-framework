import { Processor, WorkerOptions } from 'bullmq';
import { RedisInstance } from '../redis/index.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import QueueManager from './manager.js';
export interface QueueWorkerConstructorParams {
    applicationConfig: ApplicationConfig;
    queueManager: QueueManager;
    name: string;
    processor: string | URL | Processor<any, any, string> | null | undefined;
    options?: WorkerOptions;
    redisInstance: RedisInstance;
}
//# sourceMappingURL=worker.interface.d.ts.map