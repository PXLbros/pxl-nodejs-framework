import { Worker } from 'bullmq';
import { QueueWorkerConstructorParams } from './worker.interface.js';
export default class QueueWorker extends Worker {
    private applicationConfig;
    private queueManager;
    private redisInstance;
    constructor({ applicationConfig, queueManager, name, processor, options, redisInstance }: QueueWorkerConstructorParams);
    private onWorkerActive;
    private onWorkerError;
    private onWorkerFailed;
    private onWorkerStalled;
    private onWorkerCompleted;
}
//# sourceMappingURL=worker.d.ts.map