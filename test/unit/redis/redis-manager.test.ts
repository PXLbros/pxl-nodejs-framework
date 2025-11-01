import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock ioredis
vi.mock('ioredis', () => {
  const MockRedis = vi.fn(function MockRedisConstructor() {
    const emitter = new EventEmitter();
    Object.assign(emitter, {
      status: 'ready',
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(0),
      disconnect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
    });

    // Emit connect event
    process.nextTick(() => {
      emitter.emit('connect');
      emitter.emit('ready');
    });

    return emitter;
  });

  return {
    Redis: MockRedis,
    default: MockRedis,
  };
});

describe('RedisManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create RedisManager instance', async () => {
    const RedisManager = (await import('../../../dist/redis/manager.js')).default;

    const config = {
      host: 'localhost',
      port: 6379,
      applicationConfig: {
        name: 'test-app',
        log: { startUp: false },
      },
    };

    const manager = new RedisManager(config);
    expect(manager).toBeDefined();
    expect(manager.instances).toEqual([]);
  });

  it('should connect to Redis and create instance', async () => {
    const RedisManager = (await import('../../../dist/redis/manager.js')).default;

    const config = {
      host: 'localhost',
      port: 6379,
      applicationConfig: {
        name: 'test-app',
        log: { startUp: false },
      },
    };

    const manager = new RedisManager(config);

    // Test the connect method (it should resolve when mocked Redis emits connect)
    const connectPromise = manager.connect();

    // The mock should resolve quickly
    const instance = await Promise.race([
      connectPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
    ]);

    expect(instance).toBeDefined();
    expect(manager.instances).toHaveLength(1);
    expect(manager.instances[0]).toBe(instance);
  });

  it('should handle Redis disconnect', async () => {
    const RedisManager = (await import('../../../dist/redis/manager.js')).default;

    const config = {
      host: 'localhost',
      port: 6379,
      applicationConfig: {
        name: 'test-app',
        log: { startUp: false },
      },
    };

    const manager = new RedisManager(config);

    // Test disconnect without connecting first (should not throw)
    await expect(manager.disconnect()).resolves.not.toThrow();
  });
});
