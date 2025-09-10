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
  try {
    handler(outcome);
  } catch (err) {
    console.error('Exit handler failure', err);
    process.exit(outcome.code);
  }
}
