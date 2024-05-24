import { Queue, Worker, WorkerOptions, Job, Processor, QueueOptions } from 'bullmq';
import path from 'path';
import { QueueManagerConstructorParams, QueueManagerOptions } from './manager.interface.js';
import { RedisInstance } from '../redis/index.js';
import { DatabaseInstance } from '../database/index.js';
import { Logger } from '../logger/index.js';
import QueueWorker from './worker.js';
import BaseProcessor from './processor/base.js';
import { Helper, Loader } from '../util/index.js';
import { QueueJob } from './job.interface.js';
import { QueueItem } from './index.interface.js';

export default class QueueManager {
  private options: QueueManagerOptions;

  private redisInstance: RedisInstance;
  private databaseInstance: DatabaseInstance;

  private queues: Map<string, Queue> = new Map();

  private jobProcessors: Map<string, BaseProcessor> = new Map();

  constructor({ options, queues, redisInstance, databaseInstance }: QueueManagerConstructorParams) {
    // Define default options
    const defaultOptions: Partial<QueueManagerOptions> = {};

    // Merge options
    this.options = Helper.defaultsDeep(options, defaultOptions);

    this.redisInstance = redisInstance;
    this.databaseInstance = databaseInstance;

    // Register jobs
    this.registerQueues({ queues });
  }

  private async registerQueues({ queues }: { queues: QueueItem[] }): Promise<void> {
    if (!queues) {
      return;
    }

    const jobProcessorClasses = await Loader.loadModulesInDirectory({
      directory: this.options.processorsDirectory,
      extensions: ['.ts'],
    });

    for (const queue of queues) {
      this.registerQueue({ queue, jobProcessorClasses });
    }

    Logger.debug('Queues registered', {
      Count: queues.length,
    });
  }

  private registerQueue({ queue, jobProcessorClasses }: { queue: QueueItem; jobProcessorClasses: any }): void {
    if (!queue.jobs) {
      return;
    }

    // Create queue
    this.createQueue({ name: queue.name });

    for (const job of queue.jobs) {
      const ProcessorClass = jobProcessorClasses[job.id];

      if (!ProcessorClass) {
        throw new Error(`Processor class "${job.id}" not found`);
      }

      const processorInstance = new ProcessorClass(this, this.databaseInstance);

      this.jobProcessors.set(job.id, processorInstance);

      Logger.debug('Queue job registered', { ID: job.id });
    }
  }

  public createQueue = ({ name }: { name: string }): void => {
    const queueOptions: QueueOptions = {
      connection: this.redisInstance.client,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    };

    const queue = new Queue(name, queueOptions);

    queue.on('error', this.onQueueError);
    queue.on('waiting', this.onQueueWaiting);
    queue.on('progress', this.onQueueProgress);
    queue.on('removed', this.onQueueRemoved);

    const workerOptions: WorkerOptions = {
      connection: this.redisInstance.client,
      autorun: true,
    };

    const queueWorker = new QueueWorker({
      name: queue.name,
      processor: this.workerProcessor,
      options: workerOptions,
      redisInstance: this.redisInstance,
    });

    this.queues.set(name, queue);

    Logger.debug('Queue created', { Name: name });
  };

  private onQueueError = (error: Error): void => {
    Logger.error(error);
  };

  private onQueueWaiting = (job: Job): void => {
    Logger.info('Queue waiting', { Queue: job.queueName, Job: job.id });
  };

  private onQueueProgress = (job: Job<any, any, string>, progress: number | object): void => {
    Logger.info('Queue progress', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
      Progress: progress,
    });
  };

  private onQueueRemoved = (job: Job): void => {
    Logger.debug('Queue removed', { Queue: job.queueName, Job: job.id });
  };

  public addJobToQueue = async ({ queueId, jobId, data }: { queueId: string; jobId: string; data: any }) => {
    const queue = this.queues.get(queueId);

    if (!queue) {
      Logger.warn('Queue not found', { 'Queue ID': queueId });
      return;
    }

    const job = await queue.add(jobId, data);

    const dataStr = JSON.stringify(data);

    const maxLogDataStrLength = 50;
    const truncatedLogDataStr =
      dataStr.length > maxLogDataStrLength ? `${dataStr.substring(0, maxLogDataStrLength)}...` : dataStr;

    Logger.info('Job added', { Queue: queueId, 'Job ID': jobId, Data: truncatedLogDataStr });

    return job;
  };

  private workerProcessor = async (job: Job): Promise<Processor<any, any, string> | undefined> => {
    const startTime = process.hrtime();

    // Add start time to job data
    job.updateData({ ...job.data, startTime });

    Logger.info('Queue worker processing', {
      Queue: job.queueName,
      'Job Name': job.name,
      'Job ID': job.id,
    });

    const processor = this.jobProcessors.get(job.name);

    if (!processor) {
      throw new Error(`No processor registered for job (Name: ${job.name})`);
    }

    try {
      const jobResult = await processor.process({ job });

      return jobResult;
    } catch (error) {
      Logger.warn('Queue worker processing error', {
        Queue: job.queueName,
        'Job Name': job.name,
        'Job ID': job.id,
        Error: (error as Error).message,
      });

      Logger.error(error);
    }
  };

  public async listAllJobsWithStatus(): Promise<any[]> {
    const jobsSummary: any[] = [];

    for (const [queueName, queue] of this.queues) {
      const jobStates = ['active', 'waiting', 'completed', 'failed', 'delayed', 'paused'];

      const jobsDetailsPromises = jobStates.map(async (state: any) => {
        const jobs = await queue.getJobs([state]);
        return jobs.map((job) => ({
          id: job.id,
          name: job.name,
          queueName: queueName,
          state: state,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
        }));
      });

      const results = await Promise.all(jobsDetailsPromises);
      const flattenedResults = results.flat();

      jobsSummary.push(...flattenedResults);
    }

    return jobsSummary;
  }
}
