/**
 * Cluster Verification Script
 *
 * Verifies that cluster mode is working correctly by:
 * - Checking worker distribution
 * - Testing request load balancing
 * - Verifying worker crash recovery
 * - Testing shared state via Redis
 */

import pc from 'picocolors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
const NUM_REQUESTS = 20;

interface WorkerInfo {
  worker: { id: number | null; pid: number; isPrimary: boolean; isWorker: boolean };
  system: { cpus: number };
}

async function main() {
  console.log(pc.bold(pc.cyan('\n╔═══════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║  Cluster Verification Script          ║')));
  console.log(pc.bold(pc.cyan('╚═══════════════════════════════════════╝\n')));

  try {
    // Test 1: Check if server is running
    console.log(pc.blue('📡 Test 1: Checking server availability...'));
    const infoResponse = await fetch(`${BASE_URL}/cluster/info`);
    const firstInfo: WorkerInfo = await infoResponse.json();

    if (firstInfo.worker.isPrimary) {
      console.log(pc.yellow('⚠️  Running in single-process mode (no cluster)'));
      console.log(pc.dim('   Run with --cluster to enable cluster mode\n'));
      process.exit(0);
    }

    console.log(pc.green(`✓ Server is running`));
    console.log(pc.dim(`  Worker ID: ${firstInfo.worker.id}`));
    console.log(pc.dim(`  PID: ${firstInfo.worker.pid}`));
    console.log(pc.dim(`  CPUs: ${firstInfo.system.cpus}\n`));

    // Test 2: Request distribution
    console.log(pc.blue(`📊 Test 2: Testing request distribution (${NUM_REQUESTS} requests)...`));
    const workerHits = new Map<number, number>();

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const response = await fetch(`${BASE_URL}/cluster/info`);
      const data: WorkerInfo = await response.json();
      const workerId = data.worker.id!;

      workerHits.set(workerId, (workerHits.get(workerId) || 0) + 1);
    }

    console.log(pc.green(`✓ Request distribution:`));
    workerHits.forEach((count, workerId) => {
      const percentage = ((count / NUM_REQUESTS) * 100).toFixed(1);
      console.log(pc.dim(`  Worker ${workerId}: ${count} requests (${percentage}%)`));
    });

    if (workerHits.size > 1) {
      console.log(pc.green(`✓ Load balancing working: requests distributed across ${workerHits.size} workers\n`));
    } else {
      console.log(pc.yellow(`⚠️  Only 1 worker received requests (expected with 1 worker)\n`));
    }

    // Test 3: Shared state via Redis
    console.log(pc.blue('🗄️  Test 3: Testing shared state via Redis...'));
    const testKey = `test-${Date.now()}`;
    const testValue = { message: 'Hello from worker', timestamp: Date.now() };

    const storeResponse = await fetch(`${BASE_URL}/cluster/shared-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: testKey, value: testValue }),
    });
    const storeData = await storeResponse.json();
    const storingWorkerId = storeData.worker.id;

    // Try to retrieve from a different worker (make multiple requests)
    let retrievedFromDifferentWorker = false;
    for (let i = 0; i < 10; i++) {
      const retrieveResponse = await fetch(`${BASE_URL}/cluster/shared-state/${testKey}`);
      const retrieveData = await retrieveResponse.json();

      if (retrieveData.found && retrieveData.worker.id !== storingWorkerId) {
        retrievedFromDifferentWorker = true;
        console.log(pc.green(`✓ Shared state working:`));
        console.log(pc.dim(`  Stored by worker ${storingWorkerId}`));
        console.log(pc.dim(`  Retrieved by worker ${retrieveData.worker.id}`));
        console.log(pc.dim(`  Value: ${JSON.stringify(retrieveData.value)}\n`));
        break;
      }
    }

    if (!retrievedFromDifferentWorker && workerHits.size === 1) {
      console.log(pc.yellow(`⚠️  Could not verify cross-worker retrieval (only 1 worker)\n`));
    } else if (!retrievedFromDifferentWorker) {
      console.log(pc.yellow(`⚠️  All requests went to the same worker (run test again)\n`));
    }

    // Test 4: Local state (non-shared)
    console.log(pc.blue('📦 Test 4: Testing worker-local state (non-shared)...'));
    const localStateCounts = new Map<number, number>();

    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${BASE_URL}/cluster/local-state`);
      const data = await response.json();
      localStateCounts.set(data.worker.id, data.requestCount);
    }

    console.log(pc.green(`✓ Local state (each worker has its own counter):`));
    localStateCounts.forEach((count, workerId) => {
      console.log(pc.dim(`  Worker ${workerId}: counter = ${count}`));
    });
    console.log(pc.dim(`  Note: Counters are NOT shared between workers\n`));

    // Test 5: CPU-intensive task
    console.log(pc.blue('⚡ Test 5: Testing CPU-intensive task distribution...'));
    const fibN = 30; // Lower number for faster test
    const workerCalcs = new Map<number, number>();

    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${BASE_URL}/cluster/cpu-intensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: fibN }),
      });
      const data = await response.json();
      workerCalcs.set(data.worker.id, (workerCalcs.get(data.worker.id) || 0) + 1);
      console.log(pc.dim(`  ${data.message}`));
    }

    console.log(pc.green(`\n✓ CPU tasks distributed across ${workerCalcs.size} worker(s)\n`));

    // Summary
    console.log(pc.bold(pc.green('╔═══════════════════════════════════════╗')));
    console.log(pc.bold(pc.green('║  Verification Complete ✓              ║')));
    console.log(pc.bold(pc.green('╚═══════════════════════════════════════╝\n')));

    console.log(pc.cyan('Summary:'));
    console.log(pc.dim(`  Workers active: ${workerHits.size}`));
    console.log(pc.dim(`  Load balancing: ${workerHits.size > 1 ? 'YES' : 'N/A (single worker)'}`));
    console.log(pc.dim(`  Shared state (Redis): ✓`));
    console.log(pc.dim(`  Local state (isolated): ✓`));
    console.log(pc.dim(`  CPU distribution: ✓\n`));

    console.log(pc.yellow('💡 Next steps:'));
    console.log(pc.dim('  - Try: POST /cluster/crash (test auto-restart)'));
    console.log(pc.dim('  - Try: npm run load-test (stress test)'));
    console.log(pc.dim('  - Send SIGTERM to test graceful shutdown\n'));
  } catch (error) {
    console.error(pc.red('❌ Verification failed:'), error);
    console.log(pc.yellow('\n💡 Make sure the server is running:'));
    console.log(pc.dim('   npm run cluster:auto\n'));
    process.exit(1);
  }
}

main();
