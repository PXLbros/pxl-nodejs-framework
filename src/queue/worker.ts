import { Job, Worker, Processor } from 'bullmq';
import { QueueWorkerConstructorParams } from './worker.interface.js';
import { RedisInstance } from '../redis/index.js';
import { Logger } from '../logger/index.js';
import { WebSocketRedisSubscriberEvent } from '../websocket/websocket.interface.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import QueueManager from './manager.js';

export default class QueueWorker extends Worker {
  private applicationConfig: ApplicationConfig;

  private queueManager: QueueManager;
  private redisInstance: RedisInstance;

  constructor({
    applicationConfig,
    queueManager,
    name,
    processor,
    options,
    redisInstance,
  }: QueueWorkerConstructorParams) {
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

  private onWorkerActive = (job: Job): void => {
    this.queueManager.log('Worker active', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
    });
  };

  private onWorkerError = (error: Error): void => {
    Logger.error(error);
  };

  private onWorkerFailed = (
    job: Job<any, Processor<any, any, string>, string> | undefined,
    error: Error,
  ): void => {
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

  private onWorkerStalled = (jobId: string): void => {
    this.queueManager.log('Worker stalled', { Job: jobId });
  };

  private onWorkerCompleted = (job: Job): void => {
    const jobData = job.data;

    if (job.returnvalue && job.returnvalue.webSocketClientId) {
      // Send job completed message to client
      this.redisInstance.publisherClient.publish(
        WebSocketRedisSubscriberEvent.QueueJobCompleted,
        JSON.stringify(job.returnvalue),
      );
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
