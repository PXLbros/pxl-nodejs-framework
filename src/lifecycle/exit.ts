export type ExitCode = 0 | 1 | 2 | 130 | 137 | 143;

export interface ExitOutcome {
  code: ExitCode;
  reason: string;
  error?: unknown;
}

type ExitHandler = (outcome: ExitOutcome) => void;

let handler: ExitHandler = outcome => {
  process.exit(outcome.code);
};

export function setExitHandler(next: ExitHandler) {
  handler = next;
}

export function requestExit(outcome: ExitOutcome) {
  const nodeEnv = process.env.NODE_ENV ?? '';
  const isTestEnv =
    nodeEnv.toLowerCase() === 'test' ||
    'VITEST' in process.env ||
    'VITEST_WORKER_ID' in process.env ||
    process.argv.some(a => a.includes('vitest')) ||
    typeof (globalThis as any).afterAll === 'function';

  if (isTestEnv) {
    // Suppress real process exit during tests; vitest intercepts and would throw otherwise.
    console.info(`[exit] (test env) code=${outcome.code} reason=${outcome.reason}`);
    return;
  }

  try {
    handler(outcome);
  } catch (err) {
    console.error('Exit handler failure', err);
    process.exit(outcome.code);
  }
}
