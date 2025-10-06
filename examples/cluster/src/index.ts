/**
 * PXL Framework - Cluster Mode Example
 *
 * This example demonstrates Node.js cluster functionality for scaling
 * across multiple CPU cores on a single machine.
 *
 * Features demonstrated:
 * - Auto and manual worker modes
 * - Worker identification and distribution
 * - Shared state via Redis
 * - CPU-intensive task distribution
 * - Worker crash recovery
 * - Graceful shutdown
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cpus } from 'os';
import cluster from 'cluster';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { WebApplication } from '../../../src/application/index.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import pc from 'picocolors';

// Routes
import { createClusterTestRoutes } from './controllers/cluster-test-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('cluster', {
    type: 'string',
    description: 'Enable cluster mode (auto|manual)',
    default: process.env.CLUSTER_ENABLED === 'true' ? process.env.CLUSTER_MODE || 'auto' : undefined,
  })
  .option('workers', {
    type: 'number',
    description: 'Number of workers (manual mode only)',
    default: parseInt(process.env.CLUSTER_WORKER_COUNT || '4'),
  })
  .help()
  .parseSync();

async function main() {
  const port = parseInt(process.env.PORT || '3100');
  const numCPUs = cpus().length;

  // Determine cluster configuration
  let clusterConfig: ApplicationConfig['cluster'];

  if (argv.cluster) {
    const mode = argv.cluster === 'true' ? 'auto' : argv.cluster;

    if (mode === 'auto') {
      clusterConfig = {
        enabled: true,
        workerMode: 'auto',
      };
    } else if (mode === 'manual') {
      clusterConfig = {
        enabled: true,
        workerMode: 'manual',
        workerCount: argv.workers,
      };
    }
  }

  // Display startup info
  if (cluster.isPrimary && clusterConfig?.enabled) {
    console.log(pc.bold(pc.cyan('\n╔═══════════════════════════════════════════╗')));
    console.log(pc.bold(pc.cyan('║  PXL Framework - Cluster Mode Example    ║')));
    console.log(pc.bold(pc.cyan('╚═══════════════════════════════════════════╝\n')));

    const workerCount = clusterConfig.workerMode === 'auto' ? numCPUs : clusterConfig.workerCount;
    console.log(pc.blue(`📊 System Info:`));
    console.log(pc.blue(`   CPUs: ${numCPUs}`));
    console.log(pc.blue(`   Mode: ${clusterConfig.workerMode}`));
    console.log(pc.blue(`   Workers: ${workerCount}`));
    console.log(pc.blue(`   Port: ${port}\n`));
  }

  // Create config with a placeholder for routes
  const config: ApplicationConfig = {
    name: 'cluster-example',
    instanceId: 'cluster-test',
    rootDirectory: __dirname,

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },

    queue: {
      queues: [],
      processorsDirectory: join(__dirname, 'processors'),
    },

    webServer: {
      enabled: true,
      port,
      host: '0.0.0.0',
      cors: {
        origin: '*',
        credentials: true,
      },
      routes: [], // Will be set below
    },

    cluster: clusterConfig,
  };

  const app = new WebApplication(config);

  // Create routes with app reference and add to config before starting
  config.webServer!.routes = createClusterTestRoutes(app);

  // Start application
  await app.start();

  // Display worker info after startup
  if (cluster.isWorker) {
    setTimeout(() => {
      console.log(pc.green(`\n✓ Worker ${cluster.worker?.id} (PID: ${process.pid}) ready at http://localhost:${port}`));
      console.log(pc.dim(`  Try: curl http://localhost:${port}/cluster/info\n`));
    }, 100);
  } else if (!clusterConfig?.enabled) {
    console.log(pc.bold(pc.cyan('\n╔═══════════════════════════════════════════╗')));
    console.log(pc.bold(pc.cyan('║  PXL Framework - Cluster Mode Example    ║')));
    console.log(pc.bold(pc.cyan('╚═══════════════════════════════════════════╝\n')));
    console.log(pc.green(`✓ Single-process mode`));
    console.log(pc.green(`✓ Server running at http://localhost:${port}\n`));
    console.log(pc.dim(`  To enable cluster mode:`));
    console.log(pc.dim(`  npm run cluster:auto    # Use all CPUs`));
    console.log(pc.dim(`  npm run cluster:manual  # Use 4 workers\n`));
  }
}

main().catch(error => {
  console.error(pc.red('Failed to start application:'), error);
  process.exit(1);
});
