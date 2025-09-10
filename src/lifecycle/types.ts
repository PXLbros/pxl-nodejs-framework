export interface Disposable {
  dispose(): Promise<void> | void;
}

export enum LifecyclePhase {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
}

export type LifecycleHook = () => Promise<void> | void;

export type ReadinessCheck = () => Promise<boolean> | boolean;

export interface ReadinessCheckResult {
  name: string;
  ready: boolean;
  error?: Error;
}

export interface LifecycleConfig {
  gracefulShutdown: {
    timeoutMs: number;
  };
  readiness?: {
    timeoutMs?: number;
    checkIntervalMs?: number;
  };
}
