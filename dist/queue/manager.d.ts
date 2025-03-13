import { Job } from 'bullmq';
import { QueueManagerConstructorParams } from './manager.interface.js';
import { QueueItem } from './index.interface.js';
export default class QueueManager {
    private logger;
    private applicationConfig;
    private options;
    private redisInstance;
    private databaseInstance;
    private eventManager?;
    private queues;
    private jobProcessors;
    constructor({ applicationConfig, options, queues, redisInstance, databaseInstance, eventManager }: QueueManagerConstructorParams);
    registerQueues({ queues }: {
        queues: QueueItem[];
    }): Promise<void>;
    private registerQueue;
    private registerJobProcessors;
    private onQueueError;
    private onQueueWaiting;
    private onQueueProgress;
    private onQueueRemoved;
    addJobToQueue: ({ queueId, jobId, data }: {
        queueId: string;
        jobId: string;
        data: any;
    }) => Promise<Job<any, any, string> | undefined>;
    private workerProcessor;
    listAllJobsWithStatus(): Promise<any[]>;
    /**
     * Log queue message
     */
    log(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=manager.d.ts.map