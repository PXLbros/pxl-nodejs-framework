import type { ApplicationConfig } from './base-application.interface.js';
import type WorkerApplication from './worker-application.js';

export interface WorkerApplicationEventsConfig {
  onStarted?: ({ app, startupTime }: { app: WorkerApplication; startupTime: number }) => void;
  onStopped?: ({ app, runtime }: { app: WorkerApplication; runtime: number }) => void;
}

export interface WorkerApplicationConfig extends ApplicationConfig {
  /** Worker application events */
  events?: WorkerApplicationEventsConfig;
}
