import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type CliOptions = {
  url: string;
  requests: number;
  concurrency: number;
  method: string;
  body?: string;
  header?: string[];
  duration?: number;
};

type LatencyStats = {
  min: number;
  max: number;
  average: number;
  p50: number;
  p95: number;
};

const argv = yargs(hideBin(process.argv))
  .scriptName('simple-load-test')
  .usage('$0 --url http://localhost:3000/health [options]')
  .option('url', {
    describe: 'Target URL to hit',
    type: 'string',
    demandOption: true,
  })
  .option('requests', {
    describe: 'Total number of requests to send',
    type: 'number',
    default: 50,
  })
  .option('duration', {
    describe: 'Duration to run the test (in seconds). Overrides requests when provided.',
    type: 'number',
  })
  .option('concurrency', {
    describe: 'Number of concurrent workers',
    type: 'number',
    default: 5,
  })
  .option('method', {
    describe: 'HTTP method to use',
    type: 'string',
    default: 'GET',
  })
  .option('body', {
    describe: 'Optional request body (for POST/PUT/PATCH)',
    type: 'string',
  })
  .option('header', {
    describe: 'Additional request header, repeatable (e.g. --header "Authorization: Bearer token")',
    type: 'string',
    array: true,
  })
  .check(({ requests, concurrency, duration }) => {
    if (concurrency <= 0) {
      throw new Error('concurrency must be greater than 0');
    }

    if ((duration === undefined || Number.isNaN(duration)) && requests <= 0) {
      throw new Error('requests must be greater than 0');
    }

    if (duration !== undefined) {
      if (Number.isNaN(duration)) {
        throw new Error('duration must be a number');
      }

      if (duration <= 0) {
        throw new Error('duration must be greater than 0');
      }
    }

    return true;
  })
  .help()
  .strict()
  .parseSync() as CliOptions;

const headers = buildHeaders(argv.header);
const useDuration = typeof argv.duration === 'number';
const durationMs = useDuration ? argv.duration! * 1000 : null;
const totalRequests = useDuration ? Number.POSITIVE_INFINITY : argv.requests;
const concurrency = useDuration ? argv.concurrency : Math.min(argv.concurrency, totalRequests);

let sent = 0;
let successCount = 0;
let failureCount = 0;
const latencies: number[] = [];
const statusCounts = new Map<number, number>();
const failures: string[] = [];
let deadline: number | null = null;

async function main() {
  const testStart = performance.now();
  if (useDuration && durationMs !== null) {
    deadline = testStart + durationMs;
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const totalDurationMs = performance.now() - testStart;

  if (latencies.length === 0) {
    console.log('No responses received. Check connectivity and try again.');
    return;
  }

  const stats = computeLatencyStats(latencies);

  console.log('\nSimple load test summary');
  console.log('------------------------');
  console.log(`Target URL        : ${argv.url}`);
  if (useDuration && argv.duration !== undefined) {
    console.log(`Run target        : ${argv.duration} seconds`);
  } else {
    console.log(`Request target    : ${argv.requests}`);
  }
  console.log(`Requests sent     : ${sent}`);
  console.log(`Concurrency level : ${concurrency}`);
  console.log(`Total time        : ${totalDurationMs.toFixed(0)} ms`);
  console.log(`Success responses : ${successCount}`);
  console.log(`Failed responses  : ${failureCount}`);
  console.log('\nLatency (ms)');
  console.log(`  min : ${stats.min.toFixed(2)}`);
  console.log(`  avg : ${stats.average.toFixed(2)}`);
  console.log(`  p50 : ${stats.p50.toFixed(2)}`);
  console.log(`  p95 : ${stats.p95.toFixed(2)}`);
  console.log(`  max : ${stats.max.toFixed(2)}`);

  console.log('\nStatus counts');
  for (const [status, count] of statusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }

  if (failures.length > 0) {
    console.log('\nSample failures');
    failures.slice(0, 5).forEach((message, index) => {
      console.log(`  ${index + 1}. ${message}`);
    });

    if (failures.length > 5) {
      console.log(`  ... and ${failures.length - 5} more`);
    }
  }
}

async function worker(): Promise<void> {
  while (true) {
    if (useDuration && deadline !== null && performance.now() >= deadline) {
      return;
    }

    const requestIndex = getNextRequestIndex();
    if (requestIndex === null) {
      return;
    }

    try {
      const startedAt = performance.now();
      const response = await fetch(argv.url, {
        method: argv.method.toUpperCase(),
        headers,
        body: argv.body,
      });
      const latency = performance.now() - startedAt;
      latencies.push(latency);

      incrementStatus(response.status);

      if (response.ok) {
        successCount += 1;
      } else {
        failureCount += 1;
        failures.push(`${response.status} ${response.statusText}`);
      }
    } catch (error) {
      failureCount += 1;
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

function getNextRequestIndex(): number | null {
  if (useDuration && deadline !== null && performance.now() >= deadline) {
    return null;
  }

  if (sent >= totalRequests) {
    return null;
  }

  const current = sent;
  sent += 1;
  return current;
}

function buildHeaders(rawHeaders: string[] | undefined): Headers {
  const headers = new Headers();
  if (!rawHeaders) {
    return headers;
  }

  for (const rawHeader of rawHeaders) {
    const separatorIndex = rawHeader.indexOf(':');
    if (separatorIndex === -1) {
      console.warn(`Skipping invalid header format: "${rawHeader}"`);
      continue;
    }

    const key = rawHeader.slice(0, separatorIndex).trim();
    const value = rawHeader.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      console.warn(`Skipping invalid header format: "${rawHeader}"`);
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function incrementStatus(status: number): void {
  statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
}

function computeLatencyStats(values: number[]): LatencyStats {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: total / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.ceil((percentileRank / 100) * values.length) - 1);

  return values[index];
}

main().catch(error => {
  console.error('Simple load test failed:', error);
  process.exitCode = 1;
});
