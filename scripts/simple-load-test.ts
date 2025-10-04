import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type CliOptions = {
  url?: string;
  requests: number;
  concurrency: number;
  method: string;
  body?: string;
  header?: string[];
  duration?: number;
  helloWorld: boolean;
  enableRateLimit: boolean;
  helloWorldPort: number;
  serverReadyTimeout: number;
};

type LoadTestOptions = {
  url: string;
  requests: number;
  concurrency: number;
  method: string;
  body?: string;
  header?: string[];
  duration?: number;
  helloWorld: boolean;
  enableRateLimit: boolean;
  helloWorldPort: number;
  serverReadyTimeout: number;
  readinessUrl?: string;
};

type LatencyStats = {
  min: number;
  max: number;
  average: number;
  p50: number;
  p95: number;
};

type LoadTestState = {
  options: LoadTestOptions;
  headers: Headers;
  useDuration: boolean;
  durationMs: number | null;
  totalRequests: number;
  concurrency: number;
  sent: number;
  successCount: number;
  failureCount: number;
  latencies: number[];
  statusCounts: Map<number, number>;
  failures: string[];
  deadline: number | null;
};

const rawOptions = yargs(hideBin(process.argv))
  .scriptName('simple-load-test')
  .usage('$0 [options]')
  .option('url', {
    describe: 'Target URL to hit',
    type: 'string',
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
  .option('helloWorld', {
    describe: 'Start and target the hello world example automatically',
    type: 'boolean',
    default: false,
  })
  .option('enableRateLimit', {
    describe: 'Enable rate limiting when running the hello world example server',
    type: 'boolean',
    default: false,
  })
  .option('helloWorldPort', {
    describe: 'Port to run the hello world example server on when auto-started',
    type: 'number',
    default: 4000,
  })
  .option('serverReadyTimeout', {
    describe: 'Maximum time in milliseconds to wait for the example server to boot',
    type: 'number',
    default: 20000,
  })
  .check(args => {
    if (!args.helloWorld && !args.url) {
      throw new Error('Either provide --url or enable --hello-world to run against the bundled example.');
    }

    if (args.concurrency <= 0) {
      throw new Error('concurrency must be greater than 0');
    }

    if ((args.duration === undefined || Number.isNaN(args.duration)) && args.requests <= 0) {
      throw new Error('requests must be greater than 0');
    }

    if (args.duration !== undefined) {
      if (Number.isNaN(args.duration)) {
        throw new Error('duration must be a number');
      }

      if (args.duration <= 0) {
        throw new Error('duration must be greater than 0');
      }
    }

    if (Number.isNaN(args.helloWorldPort) || args.helloWorldPort <= 0) {
      throw new Error('helloWorldPort must be greater than 0');
    }

    if (Number.isNaN(args.serverReadyTimeout) || args.serverReadyTimeout <= 0) {
      throw new Error('serverReadyTimeout must be greater than 0');
    }

    return true;
  })
  .help()
  .strict()
  .parseSync() as CliOptions;

const durationDefaulted = rawOptions.duration === undefined && rawOptions.helloWorld;
const options = normalizeCliOptions(rawOptions);
const state = createLoadTestState(options);
let helloWorldProcess: ChildProcess | null = null;
let helloWorldBundleCleanup: (() => Promise<void>) | null = null;
let cleanupPromise: Promise<void> | null = null;

process.on('exit', () => {
  if (helloWorldProcess && helloWorldProcess.exitCode === null) {
    helloWorldProcess.kill('SIGTERM');
  }
  if (helloWorldBundleCleanup) {
    void helloWorldBundleCleanup();
  }
});

process.once('SIGINT', () => handleSignal('SIGINT'));
process.once('SIGTERM', () => handleSignal('SIGTERM'));

function handleSignal(signal: NodeJS.Signals) {
  void (async () => {
    console.log(`\n${signal} received, cleaning up...`);
    await cleanup();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  })();
}

async function main() {
  try {
    if (options.helloWorld) {
      console.log(
        `Starting hello world example server on port ${options.helloWorldPort} (rate limiting ${options.enableRateLimit ? 'enabled' : 'disabled'})`,
      );
      const started = await startHelloWorldServer(options);
      helloWorldProcess = started.process;
      helloWorldBundleCleanup = started.cleanup;
      await waitForServerReady(options, started.process);
      console.log('Hello world example server is ready.');

      if (durationDefaulted) {
        console.log('No duration provided; defaulting to a 30 second run when --hello-world is enabled.');
      }
    }

    await runLoadTest(state);
  } finally {
    await cleanup();
  }
}

function normalizeCliOptions(cli: CliOptions): LoadTestOptions {
  const defaultHelloWorldUrl = `http://localhost:${cli.helloWorldPort}/api/ping`;
  const url = cli.url ?? (cli.helloWorld ? defaultHelloWorldUrl : undefined);

  if (!url) {
    throw new Error('Target URL is required. Provide --url or enable --hello-world.');
  }

  const normalizedDuration = cli.duration ?? (cli.helloWorld ? 30 : undefined);

  return {
    ...cli,
    url,
    method: cli.method.toUpperCase(),
    duration: normalizedDuration,
    readinessUrl: cli.helloWorld ? defaultHelloWorldUrl : undefined,
  };
}

function createLoadTestState(loadTestOptions: LoadTestOptions): LoadTestState {
  const useDuration = typeof loadTestOptions.duration === 'number';
  const durationMs = useDuration ? loadTestOptions.duration! * 1000 : null;
  const totalRequests = useDuration ? Number.POSITIVE_INFINITY : loadTestOptions.requests;
  const concurrency = useDuration ? loadTestOptions.concurrency : Math.min(loadTestOptions.concurrency, totalRequests);

  return {
    options: loadTestOptions,
    headers: buildHeaders(loadTestOptions.header),
    useDuration,
    durationMs,
    totalRequests,
    concurrency,
    sent: 0,
    successCount: 0,
    failureCount: 0,
    latencies: [],
    statusCounts: new Map<number, number>(),
    failures: [],
    deadline: null,
  };
}

async function bundleHelloWorldExample(): Promise<{
  entryFile: string;
  exampleDir: string;
  cleanup: () => Promise<void>;
}> {
  const exampleDir = path.resolve('examples/hello-world/backend');
  const entryFile = path.join(exampleDir, 'src/index.ts');

  // No bundling needed - run source directly with tsx via node loader
  return {
    entryFile,
    exampleDir,
    cleanup: async () => {
      // No cleanup needed when running source directly
    },
  };
}

async function startHelloWorldServer(loadTestOptions: LoadTestOptions): Promise<{
  process: ChildProcess;
  cleanup: () => Promise<void>;
}> {
  const { entryFile, exampleDir, cleanup } = await bundleHelloWorldExample();

  try {
    const childEnv = {
      ...process.env,
      HOST: '127.0.0.1',
      WS_HOST: '127.0.0.1',
      PORT: String(loadTestOptions.helloWorldPort),
      WS_PORT: String(loadTestOptions.helloWorldPort),
      WS_URL: `ws://localhost:${loadTestOptions.helloWorldPort}/ws`,
      RATE_LIMIT_ENABLED: loadTestOptions.enableRateLimit ? 'true' : 'false',
    };

    // Use tsx to run TypeScript directly (via npx to use local tsx installation)
    const child = spawn('npx', ['tsx', entryFile], {
      cwd: exampleDir,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      process.stdout.write(`[hello-world] ${chunk}`);
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', chunk => {
      process.stderr.write(`[hello-world] ${chunk}`);
    });

    return { process: child, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function waitForServerReady(loadTestOptions: LoadTestOptions, child: ChildProcess): Promise<void> {
  const readinessUrl = loadTestOptions.readinessUrl ?? loadTestOptions.url;
  const timeoutMs = loadTestOptions.serverReadyTimeout;
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Hello world server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(readinessUrl, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Ignore errors while waiting for the server to boot
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for hello world server to become ready at ${readinessUrl}`);
}

async function stopHelloWorldServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGINT');

  await Promise.race([
    once(child, 'exit'),
    delay(5000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
      }
    }),
  ]);

  if (child.exitCode === null && child.signalCode === null) {
    await once(child, 'exit');
  }
}

function cleanup(): Promise<void> {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    if (helloWorldProcess) {
      await stopHelloWorldServer(helloWorldProcess);
      helloWorldProcess = null;
      console.log('Hello world example server stopped.');
    }

    if (helloWorldBundleCleanup) {
      await helloWorldBundleCleanup();
      helloWorldBundleCleanup = null;
    }
  })();

  return cleanupPromise;
}

async function runLoadTest(loadTestState: LoadTestState): Promise<void> {
  const testStart = performance.now();
  if (loadTestState.useDuration && loadTestState.durationMs !== null) {
    loadTestState.deadline = testStart + loadTestState.durationMs;
  }

  const workers = Array.from({ length: loadTestState.concurrency }, () => worker(loadTestState));
  await Promise.all(workers);
  const totalDurationMs = performance.now() - testStart;

  if (loadTestState.latencies.length === 0) {
    console.log('No responses received. Check connectivity and try again.');
    return;
  }

  const stats = computeLatencyStats(loadTestState.latencies);

  console.log('\nSimple load test summary');
  console.log('------------------------');
  console.log(`Target URL        : ${loadTestState.options.url}`);
  if (loadTestState.useDuration && loadTestState.options.duration !== undefined) {
    console.log(`Run target        : ${loadTestState.options.duration} seconds`);
  } else {
    console.log(`Request target    : ${loadTestState.options.requests}`);
  }
  console.log(`Requests sent     : ${loadTestState.sent}`);
  console.log(`Concurrency level : ${loadTestState.concurrency}`);
  console.log(`Total time        : ${totalDurationMs.toFixed(0)} ms`);
  console.log(`Success responses : ${loadTestState.successCount}`);
  console.log(`Failed responses  : ${loadTestState.failureCount}`);
  console.log('\nLatency (ms)');
  console.log(`  min : ${stats.min.toFixed(2)}`);
  console.log(`  avg : ${stats.average.toFixed(2)}`);
  console.log(`  p50 : ${stats.p50.toFixed(2)}`);
  console.log(`  p95 : ${stats.p95.toFixed(2)}`);
  console.log(`  max : ${stats.max.toFixed(2)}`);

  console.log('\nStatus counts');
  for (const [status, count] of loadTestState.statusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }

  if (loadTestState.failures.length > 0) {
    console.log('\nSample failures');
    loadTestState.failures.slice(0, 5).forEach((message, index) => {
      console.log(`  ${index + 1}. ${message}`);
    });

    if (loadTestState.failures.length > 5) {
      console.log(`  ... and ${loadTestState.failures.length - 5} more`);
    }
  }
}

async function worker(loadTestState: LoadTestState): Promise<void> {
  while (true) {
    if (loadTestState.useDuration && loadTestState.deadline !== null && performance.now() >= loadTestState.deadline) {
      return;
    }

    const requestIndex = getNextRequestIndex(loadTestState);
    if (requestIndex === null) {
      return;
    }

    try {
      const startedAt = performance.now();
      const response = await fetch(loadTestState.options.url, {
        method: loadTestState.options.method,
        headers: loadTestState.headers,
        body: loadTestState.options.body,
      });
      const latency = performance.now() - startedAt;
      loadTestState.latencies.push(latency);

      incrementStatus(loadTestState, response.status);

      if (response.ok) {
        loadTestState.successCount += 1;
      } else {
        loadTestState.failureCount += 1;
        loadTestState.failures.push(`${response.status} ${response.statusText}`);
      }
    } catch (error) {
      loadTestState.failureCount += 1;
      loadTestState.failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

function getNextRequestIndex(loadTestState: LoadTestState): number | null {
  if (loadTestState.useDuration && loadTestState.deadline !== null && performance.now() >= loadTestState.deadline) {
    return null;
  }

  if (loadTestState.sent >= loadTestState.totalRequests) {
    return null;
  }

  const current = loadTestState.sent;
  loadTestState.sent += 1;
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

function incrementStatus(loadTestState: LoadTestState, status: number): void {
  loadTestState.statusCounts.set(status, (loadTestState.statusCounts.get(status) ?? 0) + 1);
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
