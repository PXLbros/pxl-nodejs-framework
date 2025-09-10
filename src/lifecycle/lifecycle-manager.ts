import { type Disposable, type LifecycleConfig, type LifecycleHook, LifecyclePhase } from './types.js';

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

  constructor(config: Partial<LifecycleConfig> = {}) {
    this.config = {
      gracefulShutdown: {
        timeoutMs: config.gracefulShutdown?.timeoutMs ?? 10000,
      },
    };
  }

  get phase(): LifecyclePhase {
    return this._phase;
  }

  get isShuttingDown(): boolean {
    return this._phase === LifecyclePhase.STOPPING || this._phase === LifecyclePhase.STOPPED;
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

  trackDisposable(disposable: Disposable | { dispose: Function }): Disposable {
    const d: Disposable = 'dispose' in disposable ? { dispose: () => (disposable as any).dispose() } : disposable;
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
}
