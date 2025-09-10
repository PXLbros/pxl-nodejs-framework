import { describe, it, expect, beforeEach, vi } from 'vitest';
import BaseApplication from '../../../src/application/base-application.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import { setExitHandler } from '../../../src/lifecycle/index.js';
import Logger from '../../../src/logger/logger.js';

// Create a concrete implementation for testing
class TestApplication extends BaseApplication {
  public startHandlerCalled = false;
  public stopCallbackCalled = false;

  protected async startHandler() {
    this.startHandlerCalled = true;
  }

  protected stopCallback() {
    this.stopCallbackCalled = true;
  }
}

describe('BaseApplication Lifecycle Integration', () => {
  let app: TestApplication;
  let mockConfig: ApplicationConfig;

  beforeEach(() => {
    // Mock the exit handler to prevent actual exit during tests
    setExitHandler(() => {
      // Do nothing - just prevent actual exit
    });

    mockConfig = {
      name: 'test-app',
      instanceId: 'test-instance',
      redis: {
        host: 'localhost',
        port: 6379,
        password: '',
      },
      performanceMonitoring: {
        enabled: false,
      },
    } as ApplicationConfig;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize BaseApplication with lifecycle management', () => {
    app = new TestApplication(mockConfig);

    // Verify lifecycle components are initialized
    expect(app.lifecycle).toBeDefined();
    expect(app.shutdownController).toBeDefined();
    expect(app.lifecycle.phase).toBe('created');
  });

  it('should handle shutdown hooks registration', () => {
    app = new TestApplication(mockConfig);

    let hookCalled = false;
    const removeHook = app.lifecycle.onShutdown(() => {
      hookCalled = true;
    });

    expect(typeof removeHook).toBe('function');

    // Verify hook can be removed
    removeHook();
  });

  it('should track performance monitoring interval if enabled', () => {
    const configWithPerf = {
      ...mockConfig,
      performanceMonitoring: {
        enabled: true,
        reportInterval: 100,
      },
    };

    app = new TestApplication(configWithPerf);

    // Verify that performance monitoring is set up
    expect(app.performanceMonitor).toBeDefined();
  });

  it('should use shutdown controller for graceful shutdown', async () => {
    app = new TestApplication(mockConfig);

    // Mock the shutdown controller to avoid actual shutdown
    const mockShutdownResult = { errors: [], timedOut: false };
    vi.spyOn(app.shutdownController, 'initiate').mockResolvedValue(mockShutdownResult);

    // This should call shutdown controller and exit gracefully
    await app.stop();

    expect(app.shutdownController.initiate).toHaveBeenCalledWith('manual-stop');
  });

  it('should handle deprecated handleShutdown method', () => {
    app = new TestApplication(mockConfig);

    // Spy on Logger warn method
    const loggerSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

    app.handleShutdown({
      onStopped: ({ runtime }) => {
        expect(runtime).toBeGreaterThan(0);
      },
    });

    // Should log deprecation warning
    expect(loggerSpy).toHaveBeenCalledWith({
      message: 'handleShutdown() is deprecated. Signal handling should be done in the application launcher.',
    });

    loggerSpy.mockRestore();
  });

  it('should expose lifecycle manager properties', () => {
    app = new TestApplication(mockConfig);

    expect(app.lifecycle.phase).toBe('created');
    expect(app.shutdownController.isShuttingDown).toBe(false);

    // Test that we can register hooks
    let initCalled = false;
    app.lifecycle.onInit(() => {
      initCalled = true;
    });

    expect(initCalled).toBe(false); // Not called until initialize()
  });

  it('should handle graceful shutdown timeout configuration', () => {
    app = new TestApplication(mockConfig);

    // Verify that shutdown timeout from config is used
    expect(app.shutdownTimeout).toBe(30000); // Default 30 seconds

    // The lifecycle manager should be configured with this timeout
    // We can't directly access the config, but we can test that it was configured properly
    // by testing the behavior (timeout functionality is tested in unit tests)
  });
});
