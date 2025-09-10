import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager, ShutdownController, setExitHandler, requestExit } from '../../../src/lifecycle/index.js';

describe('Lifecycle Integration Tests', () => {
  beforeEach(() => {
    // Mock process.exit to prevent actual exit during tests
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should demonstrate complete lifecycle flow', async () => {
    const lifecycle = new LifecycleManager({
      gracefulShutdown: { timeoutMs: 1000 },
    });

    const events: string[] = [];

    // Register hooks for different phases
    lifecycle.onInit(() => {
      events.push('init-1');
    });

    lifecycle.onInit(() => {
      events.push('init-2');
    });

    lifecycle.onStart(() => {
      events.push('start-1');
    });

    lifecycle.onReady(() => {
      events.push('ready-1');
    });

    lifecycle.onBeforeShutdown(() => {
      events.push('before-shutdown-1');
    });

    lifecycle.onShutdown(() => {
      events.push('shutdown-1');
    });

    lifecycle.onShutdown(() => {
      events.push('shutdown-2');
    });

    // Track some resources
    const interval = setInterval(() => {}, 100);
    const timeout = setTimeout(() => {}, 100);
    lifecycle.trackInterval(interval);
    lifecycle.trackTimeout(timeout);

    const mockDisposable = {
      disposed: false,
      dispose: vi.fn().mockImplementation(function () {
        this.disposed = true;
      }),
    };
    lifecycle.trackDisposable(mockDisposable);

    // Execute lifecycle phases
    expect(lifecycle.phase).toBe('created');

    await lifecycle.initialize();
    expect(lifecycle.phase).toBe('initializing');

    await lifecycle.start();
    expect(lifecycle.phase).toBe('starting');

    await lifecycle.ready();
    expect(lifecycle.phase).toBe('running');

    expect(events).toEqual(['init-1', 'init-2', 'start-1', 'ready-1']);

    // Now shutdown
    const shutdownResult = await lifecycle.shutdown();
    expect(lifecycle.phase).toBe('stopped');
    expect(shutdownResult.errors).toEqual([]);
    expect(shutdownResult.timedOut).toBe(false);

    // Verify shutdown hooks ran in reverse order and disposable was called
    expect(events).toEqual([
      'init-1',
      'init-2',
      'start-1',
      'ready-1',
      'before-shutdown-1',
      'shutdown-2', // LIFO order
      'shutdown-1',
    ]);

    expect(mockDisposable.dispose).toHaveBeenCalled();
    expect(mockDisposable.disposed).toBe(true);
  });

  it('should demonstrate ShutdownController usage', async () => {
    const lifecycle = new LifecycleManager();
    const controller = new ShutdownController(lifecycle);

    const shutdownEvents: string[] = [];

    controller.register(() => {
      shutdownEvents.push('controller-shutdown-1');
    });

    controller.register(() => {
      shutdownEvents.push('controller-shutdown-2');
    });

    expect(controller.isShuttingDown).toBe(false);

    const result = await controller.initiate('test-shutdown');

    expect(result.errors).toEqual([]);
    expect(result.timedOut).toBe(false);
    expect(controller.isShuttingDown).toBe(false); // Should reset after completion

    // Hooks should have run in LIFO order
    expect(shutdownEvents).toEqual(['controller-shutdown-2', 'controller-shutdown-1']);
  });

  it('should handle exit scenarios correctly', () => {
    const exitHandler = vi.fn();
    setExitHandler(exitHandler);

    // Test normal exit
    requestExit({ code: 0, reason: 'test-complete' });
    expect(exitHandler).toHaveBeenCalledWith({
      code: 0,
      reason: 'test-complete',
    });

    exitHandler.mockClear();

    // Test error exit
    const error = new Error('Test error');
    requestExit({ code: 1, reason: 'test-error', error });
    expect(exitHandler).toHaveBeenCalledWith({
      code: 1,
      reason: 'test-error',
      error,
    });
  });

  it('should handle timeout scenarios gracefully', async () => {
    const lifecycle = new LifecycleManager({
      gracefulShutdown: { timeoutMs: 50 },
    });

    // Add a slow shutdown hook
    lifecycle.onShutdown(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const start = Date.now();
    const result = await lifecycle.shutdown();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(80); // Should timeout before 100ms
    expect(result.timedOut).toBe(true);
    expect(result.errors).toContain('Shutdown timeout exceeded');
  });

  it('should handle errors during shutdown gracefully', async () => {
    const lifecycle = new LifecycleManager();

    const error1 = new Error('Shutdown hook 1 failed');
    const error2 = new Error('Shutdown hook 2 failed');

    lifecycle.onShutdown(() => {
      throw error1;
    });

    lifecycle.onShutdown(() => {
      throw error2;
    });

    lifecycle.onShutdown(() => {
      // This should still run despite previous errors
    });

    const result = await lifecycle.shutdown();

    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain(error1);
    expect(result.errors).toContain(error2);
    expect(result.timedOut).toBe(false);
  });
});
