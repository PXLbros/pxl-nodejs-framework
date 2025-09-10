import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager } from '../../../src/lifecycle/lifecycle-manager.js';
import { ShutdownController } from '../../../src/lifecycle/shutdown-controller.js';

describe('ShutdownController', () => {
  let lifecycle: LifecycleManager;
  let controller: ShutdownController;

  beforeEach(() => {
    lifecycle = new LifecycleManager();
    controller = new ShutdownController(lifecycle);
  });

  describe('Shutdown State', () => {
    it('should not be shutting down initially', () => {
      expect(controller.isShuttingDown).toBe(false);
    });

    it('should track shutdown state during lifecycle shutdown', async () => {
      expect(controller.isShuttingDown).toBe(false);

      const shutdownPromise = lifecycle.shutdown();
      expect(controller.isShuttingDown).toBe(true);

      await shutdownPromise;
      expect(controller.isShuttingDown).toBe(true);
    });

    it('should track shutdown state during controller initiate', async () => {
      expect(controller.isShuttingDown).toBe(false);

      const initiatePromise = controller.initiate('test-shutdown');
      expect(controller.isShuttingDown).toBe(true);

      await initiatePromise;
      expect(controller.isShuttingDown).toBe(false);
    });
  });

  describe('Hook Registration', () => {
    it('should register shutdown hooks via register method', async () => {
      const hook = vi.fn();
      controller.register(hook);

      await controller.initiate('test');
      expect(hook).toHaveBeenCalled();
    });

    it('should return removal function from register', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      controller.register(hook1);
      const remove = controller.register(hook2);
      remove();

      await controller.initiate('test');
      expect(hook1).toHaveBeenCalled();
      expect(hook2).not.toHaveBeenCalled();
    });
  });

  describe('Shutdown Initiation', () => {
    it('should initiate shutdown with reason', async () => {
      const shutdownSpy = vi.spyOn(lifecycle, 'shutdown');

      await controller.initiate('manual-shutdown');
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should initiate shutdown with reason and signal', async () => {
      const shutdownSpy = vi.spyOn(lifecycle, 'shutdown');

      await controller.initiate('signal-shutdown', 'SIGTERM');
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should return shutdown result', async () => {
      const mockResult = { errors: ['test error'], timedOut: false };
      vi.spyOn(lifecycle, 'shutdown').mockResolvedValue(mockResult);

      const result = await controller.initiate('test');
      expect(result).toEqual(mockResult);
    });

    it('should handle multiple initiate calls gracefully', async () => {
      const shutdownSpy = vi.spyOn(lifecycle, 'shutdown').mockResolvedValue({ errors: [], timedOut: false });

      const promise1 = controller.initiate('first');
      const promise2 = controller.initiate('second');

      await Promise.all([promise1, promise2]);

      // First call should proceed, second should return immediately
      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle lifecycle shutdown errors', async () => {
      const error = new Error('Shutdown failed');
      vi.spyOn(lifecycle, 'shutdown').mockRejectedValue(error);

      await expect(controller.initiate('test')).rejects.toThrow(error);
    });

    it('should reset shutting down state after error', async () => {
      const error = new Error('Shutdown failed');
      vi.spyOn(lifecycle, 'shutdown').mockRejectedValue(error);

      expect(controller.isShuttingDown).toBe(false);

      try {
        await controller.initiate('test');
      } catch {
        // Expected error
      }

      expect(controller.isShuttingDown).toBe(false);
    });
  });
});
