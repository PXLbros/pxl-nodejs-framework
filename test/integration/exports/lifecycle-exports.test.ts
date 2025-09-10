import { describe, it, expect } from 'vitest';

describe('Lifecycle Exports', () => {
  it('should export all lifecycle components from main index', async () => {
    // Test importing from main package index
    const mainExports = await import('../../../src/index.js');

    // Verify all lifecycle exports are available
    expect(mainExports.LifecycleManager).toBeDefined();
    expect(mainExports.ShutdownController).toBeDefined();
    expect(mainExports.requestExit).toBeDefined();
    expect(mainExports.setExitHandler).toBeDefined();
    expect(mainExports.LifecyclePhase).toBeDefined();

    // Test that they are the correct types
    expect(typeof mainExports.LifecycleManager).toBe('function');
    expect(typeof mainExports.ShutdownController).toBe('function');
    expect(typeof mainExports.requestExit).toBe('function');
    expect(typeof mainExports.setExitHandler).toBe('function');
    expect(typeof mainExports.LifecyclePhase).toBe('object');
  });

  it('should export all lifecycle components from lifecycle module', async () => {
    // Test importing directly from lifecycle module
    const lifecycleExports = await import('../../../src/lifecycle/index.js');

    // Verify all exports are available
    expect(lifecycleExports.LifecycleManager).toBeDefined();
    expect(lifecycleExports.ShutdownController).toBeDefined();
    expect(lifecycleExports.requestExit).toBeDefined();
    expect(lifecycleExports.setExitHandler).toBeDefined();
    expect(lifecycleExports.LifecyclePhase).toBeDefined();

    // Test that they are the correct types
    expect(typeof lifecycleExports.LifecycleManager).toBe('function');
    expect(typeof lifecycleExports.ShutdownController).toBe('function');
    expect(typeof lifecycleExports.requestExit).toBe('function');
    expect(typeof lifecycleExports.setExitHandler).toBe('function');
    expect(typeof lifecycleExports.LifecyclePhase).toBe('object');
  });

  it('should create functional lifecycle instances', async () => {
    const { LifecycleManager, ShutdownController, LifecyclePhase } = await import('../../../src/lifecycle/index.js');

    // Test creating instances
    const lifecycle = new LifecycleManager();
    const controller = new ShutdownController(lifecycle);

    expect(lifecycle.phase).toBe(LifecyclePhase.CREATED);
    expect(controller.isShuttingDown).toBe(false);

    // Test that hooks can be registered
    let hookCalled = false;
    const removeHook = lifecycle.onInit(() => {
      hookCalled = true;
    });

    expect(typeof removeHook).toBe('function');
    expect(hookCalled).toBe(false);
  });

  it('should have all expected lifecycle phases', async () => {
    const { LifecyclePhase } = await import('../../../src/lifecycle/index.js');

    expect(LifecyclePhase.CREATED).toBe('created');
    expect(LifecyclePhase.INITIALIZING).toBe('initializing');
    expect(LifecyclePhase.STARTING).toBe('starting');
    expect(LifecyclePhase.RUNNING).toBe('running');
    expect(LifecyclePhase.STOPPING).toBe('stopping');
    expect(LifecyclePhase.STOPPED).toBe('stopped');
  });

  it('should support TypeScript type imports', async () => {
    // This tests that the type exports work correctly
    const types = await import('../../../src/lifecycle/types.js');

    expect(types.LifecyclePhase).toBeDefined();
    expect(typeof types.LifecyclePhase).toBe('object');
  });
});
