import { describe, it, expect, vi, beforeEach } from 'vitest';
import Logger from '../../../src/logger/logger.js';

// We will spy on the internal log method rather than actual console output
const instance: any = Logger;

describe('Logger.error overloads', () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(instance, 'log').mockImplementation(() => {});
  });

  it('supports object signature', () => {
    const error = new Error('Boom');
    Logger.error({ error, message: 'Action failed', meta: { foo: 'bar' } });

    expect(logSpy).toHaveBeenCalledWith({
      level: 'error',
      message: expect.stringContaining('Action failed: Boom'),
      meta: { foo: 'bar' },
      options: undefined,
    });
  });

  it('supports positional signature with message and meta', () => {
    const error = new Error('Explode');
    Logger.error(error, 'Analytics Service: Failed to get subscriber analytics', {
      'User ID': '123',
      Error: 'Explode',
    });

    expect(logSpy).toHaveBeenCalledWith({
      level: 'error',
      message: expect.stringContaining('Analytics Service: Failed to get subscriber analytics: Explode'),
      meta: { 'User ID': '123', Error: 'Explode' },
      options: undefined,
    });
  });

  it('supports positional signature without message', () => {
    const error = new Error('Plain');
    Logger.error(error);

    expect(logSpy).toHaveBeenCalledWith({
      level: 'error',
      message: error,
      meta: undefined,
      options: undefined,
    });
  });
});
