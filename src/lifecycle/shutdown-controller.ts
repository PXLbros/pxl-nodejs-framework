import { LifecycleManager } from './lifecycle-manager.js';
import { LifecycleHook, LifecyclePhase } from './types.js';

export class ShutdownController {
  private _isShuttingDown = false;
  private _hasInitiated = false;

  constructor(private lifecycle: LifecycleManager) {}

  get isShuttingDown(): boolean {
    if (this._hasInitiated) {
      // If we've initiated shutdown, only check our own flag
      return this._isShuttingDown;
    }
    // Otherwise, check both our flag and lifecycle state
    return this._isShuttingDown || this.lifecycle.isShuttingDown;
  }

  register(fn: LifecycleHook): () => void {
    return this.lifecycle.onShutdown(fn);
  }

  async initiate(reason: string, signal?: string): Promise<{ errors: unknown[]; timedOut: boolean }> {
    if (this._isShuttingDown) {
      return { errors: [], timedOut: false };
    }

    this._isShuttingDown = true;
    this._hasInitiated = true;

    try {
      const result = await this.lifecycle.shutdown();
      return result;
    } finally {
      this._isShuttingDown = false;
    }
  }
}
