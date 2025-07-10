import { vi } from 'vitest';

/**
 * Mock for Redis client
 */
export const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  keys: vi.fn(),
  flushall: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  ping: vi.fn(() => 'PONG'),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

/**
 * Mock for RedisInstance
 */
export const mockRedisInstance = {
  getClient: vi.fn(() => mockRedisClient),
  isConnected: vi.fn(() => true),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getName: vi.fn(() => 'test_redis'),
};

/**
 * Mock for RedisManager
 */
export const mockRedisManager = {
  initialize: vi.fn(),
  getInstance: vi.fn(() => mockRedisInstance),
  getAllInstances: vi.fn(() => [mockRedisInstance]),
  closeAll: vi.fn(),
  isInitialized: vi.fn(() => true),
};
