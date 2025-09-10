import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestExit, setExitHandler } from '../../../src/lifecycle/exit.js';

describe('Exit Utilities', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    // Reset to default handler before each test
    setExitHandler(outcome => {
      process.exit(outcome.code);
    });

    // Mock process.exit
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  describe('requestExit', () => {
    it('should call default handler with process.exit', () => {
      requestExit({ code: 0, reason: 'test' });
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should call default handler with different exit codes', () => {
      requestExit({ code: 1, reason: 'error' });
      expect(process.exit).toHaveBeenCalledWith(1);

      requestExit({ code: 130, reason: 'sigint' });
      expect(process.exit).toHaveBeenCalledWith(130);
    });

    it('should pass error information to handler', () => {
      const error = new Error('Test error');
      requestExit({ code: 1, reason: 'test-error', error });
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('setExitHandler', () => {
    it('should allow custom exit handlers', () => {
      const customHandler = vi.fn();
      setExitHandler(customHandler);

      const outcome = { code: 0 as const, reason: 'custom-test' };
      requestExit(outcome);

      expect(customHandler).toHaveBeenCalledWith(outcome);
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should replace previous handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      setExitHandler(handler1);
      setExitHandler(handler2);

      requestExit({ code: 0, reason: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle custom handler errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const faultyHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler failed');
      });

      setExitHandler(faultyHandler);
      requestExit({ code: 0, reason: 'test' });

      expect(faultyHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Exit handler failure', expect.any(Error));
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
    });
  });

  describe('ExitCode type validation', () => {
    it('should accept valid exit codes', () => {
      const validCodes: Array<0 | 1 | 2 | 130 | 137 | 143> = [0, 1, 2, 130, 137, 143];

      validCodes.forEach(code => {
        expect(() => requestExit({ code, reason: 'test' })).not.toThrow();
      });
    });

    it('should work with error information', () => {
      const error = new Error('Test error');
      const outcome = {
        code: 1 as const,
        reason: 'application-error',
        error,
      };

      expect(() => requestExit(outcome)).not.toThrow();
    });
  });
});
