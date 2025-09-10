import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis module
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
  })),
}));

// Mock application config and redis manager
const mockApplicationConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
  },
};

const mockRedisManager = {
  instances: [],
};

describe('CacheManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create CacheManager instance', async () => {
    const CacheManager = (await import('../../../dist/cache/manager.js')).default;

    const manager = new CacheManager({
      applicationConfig: mockApplicationConfig,
      redisManager: mockRedisManager,
    });

    expect(manager).toBeDefined();
  });

  it('should get item from cache', async () => {
    const { createClient } = await import('redis');
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(JSON.stringify('test-value')),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const CacheManager = (await import('../../../dist/cache/manager.js')).default;

    const manager = new CacheManager({
      applicationConfig: mockApplicationConfig,
      redisManager: mockRedisManager,
    });

    const result = await manager.getItem({ key: 'test-key' });

    expect(mockClient.get).toHaveBeenCalledWith('test-key');
    expect(result).toBe('test-value');
  });

  it('should handle cache miss', async () => {
    const { createClient } = await import('redis');
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const CacheManager = (await import('../../../dist/cache/manager.js')).default;

    const manager = new CacheManager({
      applicationConfig: mockApplicationConfig,
      redisManager: mockRedisManager,
    });

    const result = await manager.getItem({ key: 'nonexistent-key' });

    expect(mockClient.get).toHaveBeenCalledWith('nonexistent-key');
    expect(result).toBeNull();
  });

  it('should set item in cache with TTL', async () => {
    const { createClient } = await import('redis');
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      setEx: vi.fn().mockResolvedValue('OK'),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const CacheManager = (await import('../../../dist/cache/manager.js')).default;

    const manager = new CacheManager({
      applicationConfig: mockApplicationConfig,
      redisManager: mockRedisManager,
    });

    await manager.setItem({ key: 'test-key', value: 'test-value', lifetime: 60 });

    expect(mockClient.setEx).toHaveBeenCalledWith('test-key', 60, JSON.stringify('test-value'));
  });

  it('should set item in cache without TTL', async () => {
    const { createClient } = await import('redis');
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue('OK'),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const CacheManager = (await import('../../../dist/cache/manager.js')).default;

    const manager = new CacheManager({
      applicationConfig: mockApplicationConfig,
      redisManager: mockRedisManager,
    });

    await manager.setItem({ key: 'test-key', value: 'test-value' });

    expect(mockClient.set).toHaveBeenCalledWith('test-key', JSON.stringify('test-value'));
  });
});
