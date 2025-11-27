import type { Job } from 'bullmq';
import { BaseProcessor } from '../../../../src/queue/index.js';

/**
 * Example job processor
 *
 * This processor demonstrates a simple queue job that:
 * - Receives a message from the job payload
 * - Simulates some async work
 * - Returns a result
 *
 * The processor name (without extension) must match the job.id in the queue config.
 * E.g., this file is "example-processor.ts" and matches `jobs: [{ id: 'example-processor' }]`
 */
export default class ExampleProcessor extends BaseProcessor {
  /**
   * Process the job
   *
   * @param job - The BullMQ job instance with data and metadata
   * @returns Result of the job processing
   */
  async process({ job }: { job: Job }): Promise<unknown> {
    const { message, delay } = job.data.payload || { message: 'No message', delay: 1000 };

    this.log.info(`Processing job ${job.id}`, {
      message,
      delay,
      attempt: job.attemptsMade + 1,
    });

    // Simulate some async work (e.g., API call, file processing, etc.)
    await new Promise(resolve => setTimeout(resolve, delay || 1000));

    const result = {
      success: true,
      processedAt: new Date().toISOString(),
      message: `Processed: ${message}`,
    };

    this.log.info(`Job ${job.id} completed`, result);

    return result;
  }

  /**
   * Called before process() - optional setup
   */
  async beforeProcess({ job }: { job: Job }): Promise<void> {
    this.log.debug(`Starting job ${job.id}`);
  }

  /**
   * Called after process() - optional cleanup (always called, even on error)
   */
  async afterProcess({ job, result, error }: { job: Job; result?: unknown; error?: Error }): Promise<void> {
    if (error) {
      this.log.error(error, `Job ${job.id} failed`, { jobName: job.name });
    } else {
      this.log.debug(`Job ${job.id} cleanup complete`);
    }
  }
}
