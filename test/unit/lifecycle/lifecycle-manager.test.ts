import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager } from '../../../src/lifecycle/lifecycle-manager.js';
import { LifecyclePhase } from '../../../src/lifecycle/types.js';

describe('LifecycleManager', () => {
  let lifecycle: LifecycleManager;

  beforeEach(() => {
    lifecycle = new LifecycleManager();
  });

  describe('Phase Management', () => {
    it('should start in CREATED phase', () => {
      expect(lifecycle.phase).toBe(LifecyclePhase.CREATED);
      expect(lifecycle.isShuttingDown).toBe(false);
    });

    it('should transition through phases correctly', async () => {
      expect(lifecycle.phase).toBe(LifecyclePhase.CREATED);

      await lifecycle.initialize();
      expect(lifecycle.phase).toBe(LifecyclePhase.INITIALIZING);

      await lifecycle.start();
      expect(lifecycle.phase).toBe(LifecyclePhase.STARTING);

      await lifecycle.ready();
      expect(lifecycle.phase).toBe(LifecyclePhase.RUNNING);

      await lifecycle.shutdown();
      expect(lifecycle.phase).toBe(LifecyclePhase.STOPPED);
    });

    it('should detect shutdown phases', async () => {
      await lifecycle.initialize();
      await lifecycle.start();
      await lifecycle.ready();

      expect(lifecycle.isShuttingDown).toBe(false);

      const shutdownPromise = lifecycle.shutdown();
      expect(lifecycle.isShuttingDown).toBe(true);

      await shutdownPromise;
      expect(lifecycle.isShuttingDown).toBe(true);
    });

    it('should prevent invalid phase transitions', async () => {
      // Can't start without initializing
      const startResult = await lifecycle.start();
      expect(startResult.errors).toEqual([]);
      expect(lifecycle.phase).toBe(LifecyclePhase.CREATED);

      // Can't ready without starting
      await lifecycle.initialize();
      const readyResult = await lifecycle.ready();
      expect(readyResult.errors).toEqual([]);
      expect(lifecycle.phase).toBe(LifecyclePhase.INITIALIZING);
    });
  });

  describe('Hook Registration and Execution', () => {
    it('should execute init hooks in registration order', async () => {
      const calls: number[] = [];
      lifecycle.onInit(() => calls.push(1));
      lifecycle.onInit(() => calls.push(2));
      lifecycle.onInit(() => calls.push(3));

      await lifecycle.initialize();
      expect(calls).toEqual([1, 2, 3]);
    });

    it('should execute start hooks in registration order', async () => {
      const calls: number[] = [];
      lifecycle.onStart(() => calls.push(1));
      lifecycle.onStart(() => calls.push(2));

      await lifecycle.initialize();
      await lifecycle.start();
      expect(calls).toEqual([1, 2]);
    });

    it('should execute ready hooks in registration order', async () => {
      const calls: number[] = [];
      lifecycle.onReady(() => calls.push(1));
      lifecycle.onReady(() => calls.push(2));

      await lifecycle.initialize();
      await lifecycle.start();
      await lifecycle.ready();
      expect(calls).toEqual([1, 2]);
    });

    it('should execute before-shutdown hooks in registration order (FIFO)', async () => {
      const calls: number[] = [];
      lifecycle.onBeforeShutdown(() => calls.push(1));
      lifecycle.onBeforeShutdown(() => calls.push(2));
      lifecycle.onBeforeShutdown(() => calls.push(3));

      await lifecycle.shutdown();
      expect(calls).toEqual([1, 2, 3]);
    });

    it('should execute shutdown hooks in reverse registration order (LIFO)', async () => {
      const calls: number[] = [];
      lifecycle.onShutdown(() => calls.push(1));
      lifecycle.onShutdown(() => calls.push(2));
      lifecycle.onShutdown(() => calls.push(3));

      await lifecycle.shutdown();
      expect(calls).toEqual([3, 2, 1]);
    });

    it('should allow hook removal via returned function', async () => {
      const calls: number[] = [];
      lifecycle.onInit(() => calls.push(1));
      const remove = lifecycle.onInit(() => calls.push(2));
      lifecycle.onInit(() => calls.push(3));

      remove();
      await lifecycle.initialize();
      expect(calls).toEqual([1, 3]);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors from hooks and continue execution', async () => {
      const error1 = new Error('Hook 1 failed');
      const error2 = new Error('Hook 3 failed');
      const calls: number[] = [];

      lifecycle.onInit(() => {
        calls.push(1);
        throw error1;
      });
      lifecycle.onInit(() => calls.push(2));
      lifecycle.onInit(() => {
        calls.push(3);
        throw error2;
      });
      lifecycle.onInit(() => calls.push(4));

      const result = await lifecycle.initialize();
      expect(calls).toEqual([1, 2, 3, 4]);
      expect(result.errors).toEqual([error1, error2]);
    });

    it('should handle async hook errors', async () => {
      const error = new Error('Async hook failed');
      lifecycle.onInit(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      });

      const result = await lifecycle.initialize();
      expect(result.errors).toEqual([error]);
    });
  });

  describe('Resource Tracking', () => {
    it('should track and clear intervals', async () => {
      const intervalId = setInterval(() => {}, 1000);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      lifecycle.trackInterval(intervalId);
      await lifecycle.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      clearIntervalSpy.mockRestore();
    });

    it('should track and clear timeouts', async () => {
      const timeoutId = setTimeout(() => {}, 1000);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      lifecycle.trackTimeout(timeoutId);
      await lifecycle.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
      clearTimeoutSpy.mockRestore();
    });

    it('should track and abort controllers', async () => {
      const controller = new AbortController();
      const abortSpy = vi.spyOn(controller, 'abort');

      lifecycle.trackAbortController(controller);
      expect(controller.signal.aborted).toBe(false);

      await lifecycle.shutdown();

      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(controller.signal.aborted).toBe(true);
      abortSpy.mockRestore();
    });

    it('should create tracked abort controllers', async () => {
      const controller = lifecycle.createAbortController();
      const abortSpy = vi.spyOn(controller, 'abort');

      await lifecycle.shutdown();

      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(controller.signal.aborted).toBe(true);
      abortSpy.mockRestore();
    });

    it('should track and dispose of disposables', async () => {
      const dispose = vi.fn();
      const disposable = { dispose };

      lifecycle.trackDisposable(disposable);
      await lifecycle.shutdown();

      expect(dispose).toHaveBeenCalled();
    });

    it('should handle disposable errors and continue', async () => {
      const error = new Error('Dispose failed');
      const dispose1 = vi.fn().mockRejectedValue(error);
      const dispose2 = vi.fn();

      lifecycle.trackDisposable({ dispose: dispose1 });
      lifecycle.trackDisposable({ dispose: dispose2 });

      const result = await lifecycle.shutdown();
      expect(dispose1).toHaveBeenCalled();
      expect(dispose2).toHaveBeenCalled();
      expect(result.errors).toContain(error);
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple shutdown calls gracefully', async () => {
      const shutdownHook = vi.fn();
      lifecycle.onShutdown(shutdownHook);

      const result1 = await lifecycle.shutdown();
      const result2 = await lifecycle.shutdown();

      expect(shutdownHook).toHaveBeenCalledTimes(1);
      expect(result1.errors).toEqual([]);
      expect(result2.errors).toEqual([]);
    });

    it('should handle multiple initialize calls gracefully', async () => {
      const initHook = vi.fn();
      lifecycle.onInit(initHook);

      await lifecycle.initialize();
      await lifecycle.initialize();

      expect(initHook).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout shutdown if configured', async () => {
      const slowLifecycle = new LifecycleManager({
        gracefulShutdown: { timeoutMs: 100 },
      });

      slowLifecycle.onShutdown(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      const start = Date.now();
      const result = await slowLifecycle.shutdown();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(150);
      expect(result.timedOut).toBe(true);
      expect(result.errors).toContain('Shutdown timeout exceeded');
    });

    it('should not timeout if shutdown completes in time', async () => {
      const fastLifecycle = new LifecycleManager({
        gracefulShutdown: { timeoutMs: 100 },
      });

      fastLifecycle.onShutdown(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const result = await fastLifecycle.shutdown();
      expect(result.timedOut).toBe(false);
    });

    it('should disable timeout when set to 0', async () => {
      const noTimeoutLifecycle = new LifecycleManager({
        gracefulShutdown: { timeoutMs: 0 },
      });

      noTimeoutLifecycle.onShutdown(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const result = await noTimeoutLifecycle.shutdown();
      expect(result.timedOut).toBe(false);
    });
  });
});
