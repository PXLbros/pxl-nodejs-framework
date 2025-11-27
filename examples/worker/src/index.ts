/**
 * PXL Framework - Worker Application Example
 *
 * This example demonstrates how to build a long-running queue worker
 * using the PXL Framework's WorkerApplication class.
 *
 * Features demonstrated:
 * - WorkerApplication setup and configuration
 * - Queue processor implementation
 * - Graceful shutdown handling
 * - Multiple queue support
 *
 * Unlike CommandApplication which exits after running a command,
 * WorkerApplication runs indefinitely, continuously processing jobs
 * from configured queues.
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WorkerApplication } from '../../../src/application/index.js';
import type { WorkerApplicationConfig } from '../../../src/application/worker-application.interface.js';
import pc from 'picocolors';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main application entry point
 */
async function main() {
  console.log(pc.bold(pc.cyan('\n╔═════════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║  PXL Framework - Worker Application     ║')));
  console.log(pc.bold(pc.cyan('╚═════════════════════════════════════════╝\n')));

  // Create application configuration
  const config: WorkerApplicationConfig = {
    // Basic application info
    name: 'pxl-worker-example',
    instanceId: `worker-${process.pid}`,
    rootDirectory: join(__dirname, '..'),

    // Redis configuration (required)
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    // Queue configuration
    queue: {
      processorsDirectory: join(__dirname, 'processors'),
      queues: [
        {
          name: 'default',
          jobs: [{ id: 'example-processor' }],
          settings: {
            concurrency: 5,
          },
        },
      ],
      log: {
        jobRegistered: true,
        jobAdded: true,
        jobCompleted: true,
        queueRegistered: true,
        queuesRegistered: true,
      },
    },

    // Auth configuration (required by framework validation)
    auth: {
      jwtSecretKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    },

    // Database configuration (optional - uncomment if you need DB access in processors)
    /*
    database: {
      enabled: true,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      databaseName: process.env.DB_NAME || 'pxl_worker_dev',
      entitiesDirectory: join(__dirname, 'database', 'entities'),
    },
    */

    // Lifecycle configuration
    log: {
      startUp: true,
      shutdown: true,
    },

    // Event callbacks
    events: {
      onStarted: ({ app, startupTime }) => {
        console.log(pc.green(`\n✓ Worker ready! Processing jobs from ${app.config.queue.queues.length} queue(s)`));
        console.log(pc.dim('  Press Ctrl+C to stop\n'));
      },
      onStopped: ({ runtime }) => {
        console.log(pc.dim(`\n  Total runtime: ${(runtime / 1000).toFixed(2)}s`));
      },
    },
  };

  try {
    // Create the worker application
    const app = new WorkerApplication(config);

    // Setup graceful shutdown handlers
    let shutdownInProgress = false;

    const shutdown = async (signal: string) => {
      if (shutdownInProgress) {
        console.log(pc.yellow(`\n${signal} received again, forcing exit...`));
        process.exit(130);
        return;
      }

      shutdownInProgress = true;
      console.log(pc.yellow(`\n${signal} received, shutting down gracefully...`));

      try {
        await app.stop();
        console.log(pc.green('Worker shutdown complete'));
        process.exit(0);
      } catch (error) {
        console.error(pc.red('Error during shutdown:'), error);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Start the worker (runs indefinitely)
    await app.start();
  } catch (error) {
    console.error(pc.red('\n✗ Worker failed:'), error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error(pc.red('Unhandled error:'), error);
  process.exit(1);
});
