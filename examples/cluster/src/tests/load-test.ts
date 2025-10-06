/**
 * Cluster Load Test Script
 *
 * Sends concurrent requests to test cluster performance and distribution
 */

import pc from 'picocolors';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
const CONCURRENT_REQUESTS = 100;
const BATCH_SIZE = 10;

interface RequestResult {
  workerId: number | null;
  duration: number;
  status: number;
}

async function makeRequest(): Promise<RequestResult> {
  const start = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/cluster/info`);
    const data = await response.json();

    return {
      workerId: data.worker.id,
      duration: Date.now() - start,
      status: response.status,
    };
  } catch (error) {
    return {
      workerId: null,
      duration: Date.now() - start,
      status: 500,
    };
  }
}

async function runLoadTest() {
  console.log(pc.bold(pc.cyan('\n╔═══════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║  Cluster Load Test                    ║')));
  console.log(pc.bold(pc.cyan('╚═══════════════════════════════════════╝\n')));

  console.log(pc.blue(`📊 Configuration:`));
  console.log(pc.dim(`  Total requests: ${CONCURRENT_REQUESTS}`));
  console.log(pc.dim(`  Batch size: ${BATCH_SIZE}`));
  console.log(pc.dim(`  Target: ${BASE_URL}\n`));

  const results: RequestResult[] = [];
  const workerHits = new Map<number | null, number>();
  const startTime = Date.now();

  console.log(pc.blue('🚀 Sending requests...\n'));

  // Send requests in batches
  for (let i = 0; i < CONCURRENT_REQUESTS; i += BATCH_SIZE) {
    const batch = Math.min(BATCH_SIZE, CONCURRENT_REQUESTS - i);
    const promises = Array(batch)
      .fill(0)
      .map(() => makeRequest());

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Update worker hit counts
    batchResults.forEach(result => {
      workerHits.set(result.workerId, (workerHits.get(result.workerId) || 0) + 1);
    });

    // Progress indicator
    const progress = Math.floor((results.length / CONCURRENT_REQUESTS) * 100);
    process.stdout.write(`\r  Progress: ${progress}% (${results.length}/${CONCURRENT_REQUESTS})`);
  }

  const totalDuration = Date.now() - startTime;

  console.log(pc.green('\n\n✓ Load test complete!\n'));

  // Calculate statistics
  const successful = results.filter(r => r.status === 200).length;
  const failed = results.filter(r => r.status !== 200).length;
  const durations = results.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  // Sort for percentiles
  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  const requestsPerSecond = (CONCURRENT_REQUESTS / (totalDuration / 1000)).toFixed(2);

  console.log(pc.cyan('📈 Results:'));
  console.log(pc.dim(`  Total time: ${totalDuration}ms`));
  console.log(pc.dim(`  Successful: ${successful}`));
  console.log(pc.dim(`  Failed: ${failed}`));
  console.log(pc.dim(`  Requests/sec: ${requestsPerSecond}\n`));

  console.log(pc.cyan('⏱️  Response Times:'));
  console.log(pc.dim(`  Average: ${avgDuration.toFixed(2)}ms`));
  console.log(pc.dim(`  Min: ${minDuration}ms`));
  console.log(pc.dim(`  Max: ${maxDuration}ms`));
  console.log(pc.dim(`  P50: ${p50}ms`));
  console.log(pc.dim(`  P95: ${p95}ms`));
  console.log(pc.dim(`  P99: ${p99}ms\n`));

  console.log(pc.cyan('👷 Worker Distribution:'));
  const sortedWorkers = Array.from(workerHits.entries()).sort((a, b) => a[0]! - b[0]!);

  sortedWorkers.forEach(([workerId, count]) => {
    const percentage = ((count / CONCURRENT_REQUESTS) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(pc.dim(`  Worker ${workerId}: ${count.toString().padStart(3)} (${percentage.padStart(5)}%) ${bar}`));
  });

  // Distribution analysis
  if (workerHits.size > 1) {
    const values = Array.from(workerHits.values());
    const maxHits = Math.max(...values);
    const minHits = Math.min(...values);
    const variance = ((maxHits - minHits) / maxHits) * 100;

    console.log();
    if (variance < 20) {
      console.log(pc.green(`✓ Good distribution: ${variance.toFixed(1)}% variance`));
    } else {
      console.log(pc.yellow(`⚠️  Uneven distribution: ${variance.toFixed(1)}% variance`));
    }
  }

  console.log();
  console.log(pc.bold(pc.green('╔═══════════════════════════════════════╗')));
  console.log(pc.bold(pc.green('║  Load Test Complete ✓                 ║')));
  console.log(pc.bold(pc.green('╚═══════════════════════════════════════╝\n')));

  if (workerHits.size === 1) {
    console.log(pc.yellow('💡 Running with single worker'));
    console.log(pc.dim('   Try: npm run cluster:auto (for multi-worker)\n'));
  } else {
    console.log(pc.green(`✓ Cluster working: ${workerHits.size} workers active`));
    console.log(pc.dim(`  Load balanced across ${workerHits.size} processes\n`));
  }
}

runLoadTest().catch(error => {
  console.error(pc.red('\n❌ Load test failed:'), error);
  console.log(pc.yellow('\n💡 Make sure the server is running:'));
  console.log(pc.dim('   npm run cluster:auto\n'));
  process.exit(1);
});
