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

  it('reuses redis instance once acquired', async () => {
    mockRedisManager.instances = [];
    const manager = new CacheManager({ redisManager: mockRedisManager });

    // First call triggers connection
    await manager.setItem({ key: 'first', value: 1 });
    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);

    // Second call reuses instance
    await manager.setItem({ key: 'second', value: 2 });
    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1); // Still 1
  });

  it('throws error when cached value is not a string', async () => {
    mockRedisInstance.getCache.mockResolvedValue(123); // Number instead of string
    const manager = new CacheManager({ redisManager: mockRedisManager });

    await expect(manager.getItem({ key: 'invalid' })).rejects.toThrow(
      'Cache value for key "invalid" must be a string, got number',
    );
  });

  it('handles complex JSON objects', async () => {
    const complexObject = {
      nested: { data: { value: 42 } },
      array: [1, 2, 3],
      string: 'test',
    };

    mockRedisInstance.getCache.mockResolvedValue(JSON.stringify(complexObject));
    const manager = new CacheManager({ redisManager: mockRedisManager });

    const result = await manager.getItem({ key: 'complex' });
    expect(result).toEqual(complexObject);
  });

  it('handles arrays as cached values', async () => {
    const array = [1, 2, 3, 'test', { nested: true }];
    mockRedisInstance.getCache.mockResolvedValue(JSON.stringify(array));
    const manager = new CacheManager({ redisManager: mockRedisManager });

    const result = await manager.getItem({ key: 'array' });
    expect(result).toEqual(array);
  });

  it('close method does nothing (no-op)', async () => {
    const manager = new CacheManager({ redisManager: mockRedisManager });
    await expect(manager.close()).resolves.toBeUndefined();
  });

  it('getItem handles non-Error exceptions', async () => {
    mockRedisInstance.getCache.mockResolvedValue('{{invalid json');
    const manager = new CacheManager({ redisManager: mockRedisManager });

    await expect(manager.getItem({ key: 'bad' })).rejects.toThrow(/Failed to parse cached value for key "bad"/);
  });

  it('lazy connects for getItem when no instances exist', async () => {
    mockRedisManager.instances = [];
    mockRedisInstance.getCache.mockResolvedValue(null);

    const manager = new CacheManager({ redisManager: mockRedisManager });
    await manager.getItem({ key: 'test' });

    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);
  });

  it('lazy connects for clearItem when no instances exist', async () => {
    mockRedisManager.instances = [];
    const manager = new CacheManager({ redisManager: mockRedisManager });

    await manager.clearItem({ key: 'test' });
    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);
  });

  it('reuses in-flight connection for concurrent callers', async () => {
    mockRedisManager.instances = [];

    let resolveConnect: ((value: any) => void) | undefined;
    mockRedisManager.connect.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveConnect = resolve;
        }),
    );

    mockRedisInstance.setCache.mockResolvedValue(undefined);

    const manager = new CacheManager({ redisManager: mockRedisManager });

    const firstCall = manager.setItem({ key: 'one', value: 1 });
    const secondCall = manager.setItem({ key: 'two', value: 2 });

    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);
    resolveConnect?.(mockRedisInstance);

    await Promise.all([firstCall, secondCall]);
    expect(mockRedisManager.connect).toHaveBeenCalledTimes(1);
  });
});
