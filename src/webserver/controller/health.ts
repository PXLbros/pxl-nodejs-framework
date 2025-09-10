import type { FastifyReply, FastifyRequest } from 'fastify';
import BaseController from './base.js';
import { LifecyclePhase } from '../../lifecycle/types.js';

export default class HealthController extends BaseController {
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
   * Readiness probe: service dependencies are available & lifecycle is RUNNING with aggregated readiness.
   */
  public ready = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const phase = this.lifecycleManager.phase;
    const readinessStatus = await this.lifecycleManager.getReadinessStatus();

    // Convert readiness check results to probe format for backward compatibility
    const probes: Record<string, { healthy: boolean; required: boolean }> = {};
    for (const check of readinessStatus.checks) {
      probes[check.name] = { healthy: check.ready, required: true };
    }

    const requiredFailures = Object.entries(probes)
      .filter(([, v]) => v.required && !v.healthy)
      .map(([k]) => k);

    const ready = readinessStatus.ready;

    if (!ready) {
      reply.code(503).send({
        ready: false,
        phase,
        probes,
        notReady: phase !== LifecyclePhase.RUNNING ? 'lifecycle-phase' : 'readiness-checks-failed',
        failed: requiredFailures,
        aggregatedReadiness: true,
      });
      return;
    }

    reply.send({ ready: true, phase, probes, aggregatedReadiness: true });
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
