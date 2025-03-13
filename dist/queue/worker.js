import { Worker } from 'bullmq';
import { Logger } from '../logger/index.js';
import { WebSocketRedisSubscriberEvent } from '../websocket/websocket.interface.js';
export default class QueueWorker extends Worker {
    applicationConfig;
    queueManager;
    redisInstance;
    constructor({ applicationConfig, queueManager, name, processor, options, redisInstance }) {
        super(name, processor, options);
        this.applicationConfig = applicationConfig;
        this.queueManager = queueManager;
        this.redisInstance = redisInstance;
        this.on('active', this.onWorkerActive);
        this.on('error', this.onWorkerError);
        this.on('failed', this.onWorkerFailed);
        this.on('stalled', this.onWorkerStalled);
        this.on('completed', this.onWorkerCompleted);
    }
    onWorkerActive = (job) => {
        this.queueManager.log('Worker active', {
            Queue: job.queueName,
            'Job Name': job.name,
            'Job ID': job.id,
        });
    };
    onWorkerError = (error) => {
        Logger.error(error);
    };
    onWorkerFailed = (job, error) => {
        // // Send job failed message to client
        // if (job && job.data.webSocketClientId) {
        //   const errorMessage = {
        //     webSocketClientId: job.data.webSocketClientId,
        //     action: job.name,
        //     error: error.message,
        //   };
        //   // Send error message to client
        //   this.redisInstance.publisherClient.publish('queueJobError', JSON.stringify(errorMessage));
        // }
        Logger.error(error);
    };
    onWorkerStalled = (jobId) => {
        this.queueManager.log('Worker stalled', { Job: jobId });
    };
    onWorkerCompleted = (job) => {
        const jobData = job.data;
        if (job.returnvalue && job.returnvalue.webSocketClientId) {
            // Send job completed message to client
            this.redisInstance.publisherClient.publish(WebSocketRedisSubscriberEvent.QueueJobCompleted, JSON.stringify(job.returnvalue));
        }
        const startTime = jobData.startTime;
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const executionTimeMs = seconds * 1000 + nanoseconds / 1e6;
        const formattedExecutionTime = executionTimeMs.toFixed(2);
        if (this.applicationConfig.queue.log?.jobCompleted) {
            this.queueManager.log('Job completed', {
                Queue: job.queueName,
                'Job Name': job.name,
                'Job ID': job.id,
                Time: `${formattedExecutionTime}ms`,
            });
        }
    };
}
//# sourceMappingURL=worker.js.map