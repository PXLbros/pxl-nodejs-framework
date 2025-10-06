/**
 * Cluster Test Controller
 *
 * Endpoints for testing and demonstrating cluster functionality
 */

import cluster from 'cluster';
import { cpus } from 'os';
import type { RouteDefinition } from '../../../../src/webserver/webserver.interface.js';
import type { WebApplication } from '../../../../src/application/index.js';

// Counter to demonstrate non-shared state
let requestCount = 0;

export function createClusterTestRoutes(app: WebApplication): RouteDefinition[] {
  return [
    /**
     * GET /cluster/info
     * Returns information about the current worker
     */
    {
      method: 'GET',
      path: '/cluster/info',
      handler: async (request, reply) => {
        const memoryUsage = process.memoryUsage();

        reply.send({
          worker: {
            id: cluster.worker?.id || null,
            pid: process.pid,
            isPrimary: cluster.isPrimary,
            isWorker: cluster.isWorker,
          },
          system: {
            cpus: cpus().length,
            platform: process.platform,
            nodeVersion: process.version,
          },
          memory: {
            rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          },
          stats: {
            requestCount: ++requestCount, // This counter is NOT shared between workers
            uptime: `${process.uptime().toFixed(2)}s`,
          },
        });
      },
    },

    /**
     * GET /cluster/workers
     * Returns list of all workers (only works from primary process)
     */
    {
      method: 'GET',
      path: '/cluster/workers',
      handler: async (request, reply) => {
        if (!cluster.isPrimary) {
          return reply.code(400).send({
            error: 'This endpoint only works on the primary process',
            tip: 'Call /cluster/info to see current worker info',
          });
        }

        const workers = Object.values(cluster.workers ?? {})
          .filter(Boolean)
          .map(worker => ({
            id: worker!.id,
            pid: worker!.process.pid,
            state: worker!.state,
          }));

        reply.send({
          primary: {
            pid: process.pid,
          },
          workers,
          count: workers.length,
        });
      },
    },

    /**
     * POST /cluster/cpu-intensive
     * Simulates CPU-intensive work (Fibonacci calculation)
     */
    {
      method: 'POST',
      path: '/cluster/cpu-intensive',
      handler: async (request, reply) => {
        const { n = 35 } = request.body as any;

        function fibonacci(num: number): number {
          if (num <= 1) return num;
          return fibonacci(num - 1) + fibonacci(num - 2);
        }

        const startTime = Date.now();
        const result = fibonacci(n);
        const duration = Date.now() - startTime;

        reply.send({
          worker: {
            id: cluster.worker?.id,
            pid: process.pid,
          },
          calculation: {
            input: n,
            result,
            duration: `${duration}ms`,
          },
          message: `Fibonacci(${n}) = ${result} calculated in ${duration}ms by worker ${cluster.worker?.id || 'standalone'}`,
        });
      },
    },

    /**
     * POST /cluster/crash
     * Deliberately crashes the worker (tests auto-restart)
     */
    {
      method: 'POST',
      path: '/cluster/crash',
      handler: async (request, reply) => {
        const workerId = cluster.worker?.id;
        const pid = process.pid;

        reply.send({
          message: `Worker ${workerId} (PID: ${pid}) is crashing... it should restart automatically`,
          workerId,
          pid,
        });

        // Crash after sending response
        setTimeout(() => {
          console.log(`💥 Worker ${workerId} (PID: ${pid}) deliberately crashing...`);
          process.exit(1);
        }, 100);
      },
    },

    /**
     * GET /cluster/memory
     * Returns detailed memory usage
     */
    {
      method: 'GET',
      path: '/cluster/memory',
      handler: async (request, reply) => {
        const usage = process.memoryUsage();

        reply.send({
          worker: {
            id: cluster.worker?.id,
            pid: process.pid,
          },
          memory: {
            rss: {
              bytes: usage.rss,
              mb: (usage.rss / 1024 / 1024).toFixed(2),
              description: 'Resident Set Size - total memory allocated',
            },
            heapTotal: {
              bytes: usage.heapTotal,
              mb: (usage.heapTotal / 1024 / 1024).toFixed(2),
              description: 'Total heap allocated',
            },
            heapUsed: {
              bytes: usage.heapUsed,
              mb: (usage.heapUsed / 1024 / 1024).toFixed(2),
              description: 'Heap actually used',
            },
            external: {
              bytes: usage.external,
              mb: (usage.external / 1024 / 1024).toFixed(2),
              description: 'C++ objects bound to JavaScript',
            },
          },
        });
      },
    },

    /**
     * POST /cluster/shared-state
     * Demonstrates shared state via Redis
     */
    {
      method: 'POST',
      path: '/cluster/shared-state',
      handler: async (request, reply) => {
        const { key, value } = request.body as any;

        const redisClient = app.redisManager?.instances[0]?.client;
        if (!redisClient) {
          return reply.code(500).send({
            error: 'Redis not configured',
          });
        }

        // Store in Redis (shared across all workers)
        await redisClient.set(`cluster:${key}`, JSON.stringify(value));

        // Retrieve to verify
        const stored = await redisClient.get(`cluster:${key}`);

        reply.send({
          worker: {
            id: cluster.worker?.id,
            pid: process.pid,
          },
          action: 'stored_in_redis',
          key: `cluster:${key}`,
          value: stored ? JSON.parse(stored) : null,
          message: 'This value is now shared across all workers via Redis',
        });
      },
    },

    /**
     * GET /cluster/shared-state/:key
     * Retrieves shared state from Redis
     */
    {
      method: 'GET',
      path: '/cluster/shared-state/:key',
      handler: async (request, reply) => {
        const { key } = request.params as any;

        const redisClient = app.redisManager?.instances[0]?.client;
        if (!redisClient) {
          return reply.code(500).send({
            error: 'Redis not configured',
          });
        }

        const stored = await redisClient.get(`cluster:${key}`);

        reply.send({
          worker: {
            id: cluster.worker?.id,
            pid: process.pid,
          },
          key: `cluster:${key}`,
          value: stored ? JSON.parse(stored) : null,
          found: stored !== null,
          message: stored
            ? `Retrieved from Redis by worker ${cluster.worker?.id || 'standalone'}`
            : 'Key not found in Redis',
        });
      },
    },

    /**
     * GET /cluster/local-state
     * Demonstrates worker-local (non-shared) state
     */
    {
      method: 'GET',
      path: '/cluster/local-state',
      handler: async (request, reply) => {
        reply.send({
          worker: {
            id: cluster.worker?.id,
            pid: process.pid,
          },
          requestCount,
          message: `This counter is LOCAL to worker ${cluster.worker?.id || 'standalone'} and NOT shared between workers`,
          explanation: 'Each worker has its own memory space. Use Redis for shared state.',
        });
      },
    },
  ];
}
