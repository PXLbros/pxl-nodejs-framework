import type { FastifyReply, FastifyRequest } from 'fastify';
import BaseController from './base.js';
import { LifecyclePhase } from '../../lifecycle/types.js';

export default class HealthController extends BaseController {
  /**
   * Legacy combined health endpoint (will be deprecated).
   * Mirrors previous behavior but now built on readiness probes.
   */
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
        },
        deprecated: true,
        message: 'Use /health/live or /health/ready instead',
      });
    } catch (error: unknown) {
      reply.status(500).send({
        healthy: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Liveness probe: process is up and not in stopping phase.
   */
  public live = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const phase = this.lifecycleManager.phase;
    const shuttingDown = phase === LifecyclePhase.STOPPING || phase === LifecyclePhase.STOPPED;
    if (shuttingDown) {
      reply.code(503).send({ live: false, phase });
      return;
    }
    reply.send({ live: true, phase });
  };

  /**
   * Readiness probe: service dependencies are available & lifecycle is RUNNING.
   */
  public ready = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const phase = this.lifecycleManager.phase;
    const isRunning = phase === LifecyclePhase.RUNNING;

    const probeResults = await Promise.all([this.checkDatabaseConnection(), this.checkRedisConnection()]);

    const [dbOk, redisOk] = probeResults;
    const probes: Record<string, { healthy: boolean; required: boolean }> = {
      database: { healthy: dbOk, required: true },
      redis: { healthy: redisOk, required: true },
    };

    const requiredFailures = Object.entries(probes)
      .filter(([, v]) => v.required && !v.healthy)
      .map(([k]) => k);

    const ready = isRunning && requiredFailures.length === 0;

    if (!ready) {
      reply.code(503).send({
        ready: false,
        phase,
        probes,
        notReady: !isRunning ? 'lifecycle-phase' : undefined,
        failed: requiredFailures,
      });
      return;
    }

    reply.send({ ready: true, phase, probes });
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
