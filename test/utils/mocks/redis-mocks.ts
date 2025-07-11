import { mock } from 'node:test';

/**
 * Mock for Redis client
 */
export const mockRedisClient = {
  get: mock.fn(),
  set: mock.fn(),
  del: mock.fn(),
  exists: mock.fn(),
  expire: mock.fn(),
  ttl: mock.fn(),
  keys: mock.fn(),
  flushall: mock.fn(),
  connect: mock.fn(),
  disconnect: mock.fn(),
  ping: mock.fn(() => 'PONG'),
  on: mock.fn(),
  off: mock.fn(),
  emit: mock.fn(),
};

/**
 * Mock for RedisInstance
 */
export const mockRedisInstance = {
  getClient: mock.fn(() => mockRedisClient),
  isConnected: mock.fn(() => true),
  connect: mock.fn(),
  disconnect: mock.fn(),
  getName: mock.fn(() => 'test_redis'),
};

/**
 * Mock for RedisManager
 */
export const mockRedisManager = {
  initialize: mock.fn(),
  getInstance: mock.fn(() => mockRedisInstance),
  getAllInstances: mock.fn(() => [mockRedisInstance]),
  closeAll: mock.fn(),
  isInitialized: mock.fn(() => true),
};
