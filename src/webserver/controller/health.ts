import type { FastifyReply, FastifyRequest } from 'fastify';
import BaseController from './base.js';

export default class HealthController extends BaseController {
  public health = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const healthCheckPromises = [this.checkDatabaseConnection(), this.checkRedisConnection()];

      const results = await Promise.all(
        healthCheckPromises.map(healthCheckPromise => healthCheckPromise.catch(error => error)),
      );

      const isDatabaseHealthy = results[0] === true;
      const isRedisHealthy = results[1] === true;
      // const activeQueueItems = await this.queueManager.listAllJobsWithStatus();

      const isAllHealthy = results.every(result => result === true);

      reply.send({
        healthy: isAllHealthy,
        services: {
          database: { healthy: isDatabaseHealthy },
          redis: { healthy: isRedisHealthy },
          // queue: { activeItems: activeQueueItems },
        },
      });
    } catch (error: unknown) {
      reply.status(500).send({
        healthy: false,
        error: (error as Error).message,
      });
    }
  };

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      return await this.databaseInstance.isConnected();
    } catch {
      return false;
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      return await this.redisInstance.isConnected();
    } catch {
      return false;
    }
  }
}
