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

export default class QueueManager {
  private options: QueueManagerOptions;

  private redisInstance: RedisInstance;
  private databaseInstance: DatabaseInstance;

  private queues: Map<string, Queue> = new Map();

  private jobProcessors: Map<string, BaseProcessor> = new Map();

  constructor({ options, jobs, redisInstance, databaseInstance }: QueueManagerConstructorParams) {
    // Define default options
    const defaultOptions: Partial<QueueManagerOptions> = {};

    // Merge options
    this.options = Helper.defaultsDeep(options, defaultOptions);

    this.redisInstance = redisInstance;
    this.databaseInstance = databaseInstance;

    // Register jobs
    this.registerJobs(jobs);
  }

  private async registerJobs(jobProcessors: Array<QueueJob>): Promise<void> {
    const jobProcessorClasses = await Loader.loadModulesInDirectory({
      directory: path.join(__dirname, '../../queue/processors'),
      extensions: ['.ts'],
    });

    for (const { name } of jobProcessors) {
      const ProcessorClass = jobProcessorClasses[name];

      if (!ProcessorClass) {
        throw new Error(`Processor class "${name}" not found`);
      }

      const processorInstance = new ProcessorClass(this, this.databaseInstance);

      this.jobProcessors.set(name, processorInstance);
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

  public addJobToQueue = async ({ queueName, jobName, data }: { queueName: string; jobName: string; data: any }) => {
    const queue = this.queues.get(queueName);

    if (!queue) {
      Logger.warn('Queue not found', { Queue: queueName });
      return;
    }

    const job = await queue.add(jobName, data);

    const dataStr = JSON.stringify(data);

    const maxLogDataStrLength = 50;
    const truncatedLogDataStr =
      dataStr.length > maxLogDataStrLength ? `${dataStr.substring(0, maxLogDataStrLength)}...` : dataStr;

    Logger.info('Job added', { Queue: queueName, Job: jobName, Data: truncatedLogDataStr });

    return job;
  };

  private workerProcessor = async (job: Job): Promise<Processor<any, any, string>> => {
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

    const jobResult = await processor.process({ job });

    return jobResult;
  };
}
