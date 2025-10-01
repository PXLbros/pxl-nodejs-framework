import { describe, it, expect, vi, beforeEach } from 'vitest';

// Dynamically import built code (tests run against dist output as in existing pattern)

const buildRedisInstanceMock = () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  deleteCache: vi.fn(),
});

describe('CacheManager (ioredis unified)', () => {
  let CacheManager: any;
  let mockRedisManager: any;
  let mockRedisInstance: any;

  beforeEach(async () => {
    vi.resetModules();
    CacheManager = (await import('../../../dist/cache/manager.js')).default;
    mockRedisInstance = buildRedisInstanceMock();
    mockRedisManager = {
      instances: [mockRedisInstance],
      connect: vi.fn().mockImplementation(async () => mockRedisInstance),
    };
  });

  it('creates instance', () => {
    const manager = new CacheManager({ redisManager: mockRedisManager });
    expect(manager).toBeDefined();
  });

  it('reuses existing redis instance for getItem', async () => {
    mockRedisInstance.getCache.mockResolvedValue(JSON.stringify('value'));
    const manager = new CacheManager({ redisManager: mockRedisManager });
    const val = await manager.getItem({ key: 'k1' });
    expect(mockRedisInstance.getCache).toHaveBeenCalledWith({ key: 'k1' });
    expect(val).toBe('value');
    expect(mockRedisManager.connect).not.toHaveBeenCalled();
  });

  it('throws error if JSON parse fails', async () => {
    mockRedisInstance.getCache.mockResolvedValue('plain-string');
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await expect(manager.getItem({ key: 'plain' })).rejects.toThrow('Failed to parse cached value for key "plain"');
  });

  it('returns null when key missing', async () => {
    mockRedisInstance.getCache.mockResolvedValue(null);
    const manager = new CacheManager({ redisManager: mockRedisManager });
    const val = await manager.getItem({ key: 'missing' });
    expect(val).toBeNull();
  });

  it('sets value with lifetime', async () => {
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await manager.setItem({ key: 'a', value: { x: 1 }, lifetime: 30 });
    expect(mockRedisInstance.setCache).toHaveBeenCalledWith({
      key: 'a',
      value: { x: 1 },
      expiration: 30,
    });
  });

  it('sets value without lifetime', async () => {
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await manager.setItem({ key: 'b', value: 'hi' });
    expect(mockRedisInstance.setCache).toHaveBeenCalledWith({
      key: 'b',
      value: 'hi',
      expiration: undefined,
    });
  });

  it('clears value', async () => {
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await manager.clearItem({ key: 'c' });
    expect(mockRedisInstance.deleteCache).toHaveBeenCalledWith({ key: 'c' });
  });

  it('lazy connects when no instances exist', async () => {
    mockRedisManager.instances = []; // no pre-existing
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await manager.setItem({ key: 'z', value: 1 });
    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);
  });
});
