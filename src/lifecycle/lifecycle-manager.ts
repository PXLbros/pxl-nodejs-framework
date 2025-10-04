import {
  type Disposable,
  type LifecycleConfig,
  type LifecycleHook,
  LifecyclePhase,
  type ReadinessCheck,
  type ReadinessCheckResult,
} from './types.js';

export class LifecycleManager {
  private _phase: LifecyclePhase = LifecyclePhase.CREATED;
  private config: LifecycleConfig;

  private initHooks: LifecycleHook[] = [];
  private startHooks: LifecycleHook[] = [];
  private readyHooks: LifecycleHook[] = [];
  private beforeShutdownHooks: LifecycleHook[] = [];
  private shutdownHooks: LifecycleHook[] = [];

  private disposables = new Set<Disposable>();
  private intervals = new Set<NodeJS.Timeout>();
  private timeouts = new Set<NodeJS.Timeout>();
  private abortControllers = new Set<AbortController>();

  private readinessChecks = new Map<string, ReadinessCheck>();
  private _isReady = false;

  constructor(config: Partial<LifecycleConfig> = {}) {
    this.config = {
      gracefulShutdown: {
        timeoutMs: config.gracefulShutdown?.timeoutMs ?? 10000,
      },
      readiness: {
        timeoutMs: config.readiness?.timeoutMs ?? 30000,
        checkIntervalMs: config.readiness?.checkIntervalMs ?? 100,
      },
    };
  }

  get phase(): LifecyclePhase {
    return this._phase;
  }

  get isShuttingDown(): boolean {
    return this._phase === LifecyclePhase.STOPPING || this._phase === LifecyclePhase.STOPPED;
  }

  get isReady(): boolean {
    return this._isReady && this._phase === LifecyclePhase.RUNNING;
  }

  onInit(fn: LifecycleHook): () => void {
    this.initHooks.push(fn);
    return () => {
      const i = this.initHooks.indexOf(fn);
      if (i >= 0) this.initHooks.splice(i, 1);
    };
  }

  onStart(fn: LifecycleHook): () => void {
    this.startHooks.push(fn);
    return () => {
      const i = this.startHooks.indexOf(fn);
      if (i >= 0) this.startHooks.splice(i, 1);
    };
  }

  onReady(fn: LifecycleHook): () => void {
    this.readyHooks.push(fn);
    return () => {
      const i = this.readyHooks.indexOf(fn);
      if (i >= 0) this.readyHooks.splice(i, 1);
    };
  }

  onBeforeShutdown(fn: LifecycleHook): () => void {
    this.beforeShutdownHooks.push(fn);
    return () => {
      const i = this.beforeShutdownHooks.indexOf(fn);
      if (i >= 0) this.beforeShutdownHooks.splice(i, 1);
    };
  }

  onShutdown(fn: LifecycleHook): () => void {
    this.shutdownHooks.push(fn);
    return () => {
      const i = this.shutdownHooks.indexOf(fn);
      if (i >= 0) this.shutdownHooks.splice(i, 1);
    };
  }

  addReadinessCheck(name: string, check: ReadinessCheck): () => void {
    this.readinessChecks.set(name, check);
    return () => {
      this.readinessChecks.delete(name);
    };
  }

  trackDisposable(disposable: Disposable | { dispose: () => void | Promise<void> }): Disposable {
    const d: Disposable =
      'dispose' in disposable ? { dispose: () => (disposable as { dispose: () => void }).dispose() } : disposable;
    this.disposables.add(d);
    return d;
  }

  trackInterval(id: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(id);
    return id;
  }

  trackTimeout(id: NodeJS.Timeout): NodeJS.Timeout {
    this.timeouts.add(id);
    return id;
  }

  /**
   * Track an AbortController for automatic cleanup on shutdown.
   * When the lifecycle manager shuts down, it will call abort() on all tracked controllers.
   * @param controller - The AbortController to track
   * @returns The same AbortController for chaining
   */
  trackAbortController(controller: AbortController): AbortController {
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Create and track a new AbortController.
   * Convenience method that creates a new controller and automatically tracks it.
   * @returns A new tracked AbortController
   */
  createAbortController(): AbortController {
    const controller = new AbortController();
    return this.trackAbortController(controller);
  }

  async initialize(): Promise<{ errors: unknown[] }> {
    if (this._phase !== LifecyclePhase.CREATED) {
      return { errors: [] };
    }
    this._phase = LifecyclePhase.INITIALIZING;

    const errors = await this.executeHooks(this.initHooks, 'init');
    return { errors };
  }

  async start(): Promise<{ errors: unknown[] }> {
    if (this._phase !== LifecyclePhase.INITIALIZING) {
      return { errors: [] };
    }
    this._phase = LifecyclePhase.STARTING;

    const errors = await this.executeHooks(this.startHooks, 'start');
    return { errors };
  }

  async ready(): Promise<{ errors: unknown[] }> {
    if (this._phase !== LifecyclePhase.STARTING) {
      return { errors: [] };
    }
    this._phase = LifecyclePhase.RUNNING;

    const errors = await this.executeHooks(this.readyHooks, 'ready');

    // Wait for readiness checks to pass
    const readinessResult = await this.waitForReadiness();
    if (readinessResult.errors.length > 0) {
      errors.push(...readinessResult.errors);
    }
    this._isReady = readinessResult.ready;

    return { errors };
  }

  async shutdown(): Promise<{ errors: unknown[]; timedOut: boolean }> {
    if (this.isShuttingDown) {
      return { errors: [], timedOut: false };
    }
    this._phase = LifecyclePhase.STOPPING;

    const timeoutMs = this.config.gracefulShutdown.timeoutMs;
    if (timeoutMs > 0) {
      let completed = false;
      let timedOut = false;
      const shutdownPromise = this.performShutdown().then(result => {
        completed = true;
        return result;
      });
      const timeoutPromise = new Promise<{ errors: unknown[] }>(resolve => {
        setTimeout(() => {
          if (!completed) {
            timedOut = true;
            resolve({ errors: ['Shutdown timeout exceeded'] });
          }
        }, timeoutMs);
      });
      const result = await Promise.race([shutdownPromise, timeoutPromise]);
      this._phase = LifecyclePhase.STOPPED;
      return { errors: result.errors, timedOut };
    }

    const result = await this.performShutdown();
    this._phase = LifecyclePhase.STOPPED;
    return { errors: result.errors, timedOut: false };
  }

  private async performShutdown(): Promise<{ errors: unknown[] }> {
    const errors: unknown[] = [];

    // Execute before-shutdown hooks in registration order (FIFO)
    const beforeShutdownErrors = await this.executeHooks(this.beforeShutdownHooks, 'before-shutdown');
    errors.push(...beforeShutdownErrors);

    // Abort all tracked AbortControllers
    for (const controller of this.abortControllers) {
      try {
        controller.abort();
      } catch (e) {
        errors.push(e);
      }
    }
    this.abortControllers.clear();

    // Clear intervals and timeouts
    for (const id of this.intervals) {
      clearInterval(id);
    }
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.intervals.clear();
    this.timeouts.clear();

    // Dispose of tracked disposables
    for (const disposable of this.disposables) {
      try {
        await disposable.dispose();
      } catch (e) {
        errors.push(e);
      }
    }
    this.disposables.clear();

    // Execute shutdown hooks in reverse registration order (LIFO)
    const shutdownErrors = await this.executeHooks([...this.shutdownHooks].reverse(), 'shutdown');
    errors.push(...shutdownErrors);

    return { errors };
  }

  private async executeHooks(hooks: LifecycleHook[], _phase: string): Promise<unknown[]> {
    const errors: unknown[] = [];
    for (const hook of hooks) {
      try {
        await hook();
      } catch (e) {
        errors.push(e);
      }
    }
    return errors;
  }

  private async waitForReadiness(): Promise<{ ready: boolean; errors: unknown[] }> {
    if (this.readinessChecks.size === 0) {
      return { ready: true, errors: [] };
    }

    const timeoutMs = this.config.readiness?.timeoutMs ?? 30000;
    const checkIntervalMs = this.config.readiness?.checkIntervalMs ?? 100;
    const startTime = Date.now();
    const errors: unknown[] = [];

    while (Date.now() - startTime < timeoutMs) {
      const results = await this.executeReadinessChecks();
      const allReady = results.every(r => r.ready);

      if (allReady) {
        return { ready: true, errors };
      }

      // Collect unique errors from failed checks
      for (const result of results) {
        if (!result.ready && result.error) {
          const errorMessage = result.error.message;
          if (!errors.some(e => (e as Error)?.message === errorMessage)) {
            errors.push(result.error);
          }
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }

    return { ready: false, errors: [...errors, new Error('Readiness check timeout exceeded')] };
  }

  private async executeReadinessChecks(): Promise<ReadinessCheckResult[]> {
    const checkEntries = Array.from(this.readinessChecks.entries());

    const settledResults = await Promise.allSettled(
      checkEntries.map(async ([name, check]) => {
        try {
          const result = await check();
          return { name, ready: result };
        } catch (error) {
          return { name, ready: false, error: error as Error };
        }
      }),
    );

    return settledResults.map((settledResult, index) => {
      const checkEntry = checkEntries.at(index);
      if (!checkEntry) {
        throw new Error(`Missing check entry at index ${index}`);
      }
      const [name] = checkEntry;

      if (settledResult.status === 'fulfilled') {
        return settledResult.value;
      }

      return {
        name,
        ready: false,
        error: settledResult.reason as Error,
      };
    });
  }

  async getReadinessStatus(): Promise<{ ready: boolean; checks: ReadinessCheckResult[] }> {
    const checks = await this.executeReadinessChecks();
    const ready = this._isReady && this._phase === LifecyclePhase.RUNNING && checks.every(c => c.ready);
    return { ready, checks };
  }
}
