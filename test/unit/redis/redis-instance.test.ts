import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisInstance from '../../../src/redis/instance.js';
import type RedisManager from '../../../src/redis/manager.js';

// Mock Logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('RedisInstance', () => {
  let redisInstance: RedisInstance;
  let mockClient: any;
  let mockPublisherClient: any;
  let mockSubscriberClient: any;
  let mockRedisManager: RedisManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Redis clients
    mockClient = {
      ping: vi.fn(callback => callback(null, 'PONG')),
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
    };

    mockPublisherClient = {
      disconnect: vi.fn(),
    };

    mockSubscriberClient = {
      disconnect: vi.fn(),
    };

    mockRedisManager = {
      log: vi.fn(),
    } as any;

    redisInstance = new RedisInstance({
      redisManager: mockRedisManager,
      client: mockClient as any,
      publisherClient: mockPublisherClient as any,
      subscriberClient: mockSubscriberClient as any,
    });
  });

  describe('constructor', () => {
    it('should initialize with clients', () => {
      expect(redisInstance.client).toBe(mockClient);
      expect(redisInstance.publisherClient).toBe(mockPublisherClient);
      expect(redisInstance.subscriberClient).toBe(mockSubscriberClient);
    });
  });

  describe('disconnect', () => {
    it('should disconnect all Redis clients', async () => {
      await redisInstance.disconnect();

      expect(mockSubscriberClient.disconnect).toHaveBeenCalled();
      expect(mockPublisherClient.disconnect).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockRedisManager.log).toHaveBeenCalledWith('Disconnected');
    });

    it('should handle subscriber disconnect error', async () => {
      const error = new Error('Subscriber disconnect failed');
      mockSubscriberClient.disconnect.mockImplementation(() => {
        throw error;
      });

      const { Logger } = await import('../../../src/logger/index.js');

      await redisInstance.disconnect();

      expect(Logger.error).toHaveBeenCalledWith({
        error,
        message: 'Could not disconnect Redis subscriber client',
      });
      expect(mockPublisherClient.disconnect).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle publisher disconnect error', async () => {
      const error = new Error('Publisher disconnect failed');
      mockPublisherClient.disconnect.mockImplementation(() => {
        throw error;
      });

      const { Logger } = await import('../../../src/logger/index.js');

      await redisInstance.disconnect();

      expect(Logger.error).toHaveBeenCalledWith({
        error,
        message: 'Could not disconnect Redis publisherClient',
      });
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle client disconnect error', async () => {
      const error = new Error('Client disconnect failed');
      mockClient.disconnect.mockImplementation(() => {
        throw error;
      });

      const { Logger } = await import('../../../src/logger/index.js');

      await redisInstance.disconnect();

      expect(Logger.error).toHaveBeenCalledWith({
        error,
        message: 'Could not disconnect Redis client',
      });
    });
  });

  describe('isConnected', () => {
    it('should return true when ping succeeds', async () => {
      const result = await redisInstance.isConnected();

      expect(result).toBe(true);
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should reject when ping fails', async () => {
      const error = new Error('Connection failed');
      mockClient.ping = vi.fn(callback => callback(error));

      await expect(redisInstance.isConnected()).rejects.toThrow('Connection failed');
    });

    it('should return false when client is null', async () => {
      const instanceWithoutClient = new RedisInstance({
        redisManager: mockRedisManager,
        client: null as any,
        publisherClient: mockPublisherClient as any,
        subscriberClient: mockSubscriberClient as any,
      });

      const result = await instanceWithoutClient.isConnected();

      expect(result).toBe(false);
    });
  });

  describe('setCache', () => {
    it('should set string value without expiration', async () => {
      await redisInstance.setCache({
        key: 'test-key',
        value: 'test-value',
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set string value with expiration', async () => {
      await redisInstance.setCache({
        key: 'test-key',
        value: 'test-value',
        expiration: 3600,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 3600);
    });

    it('should set number value without expiration', async () => {
      await redisInstance.setCache({
        key: 'test-key',
        value: 42,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', 42);
    });

    it('should set number value with expiration', async () => {
      await redisInstance.setCache({
        key: 'test-key',
        value: 42,
        expiration: 1800,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', 42, 'EX', 1800);
    });

    it('should set object value as JSON string', async () => {
      const objValue = { name: 'test', count: 5 };

      await redisInstance.setCache({
        key: 'test-key',
        value: objValue,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(objValue));
    });

    it('should set object value as JSON string with expiration', async () => {
      const objValue = { name: 'test', count: 5 };

      await redisInstance.setCache({
        key: 'test-key',
        value: objValue,
        expiration: 600,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(objValue), 'EX', 600);
    });

    it('should throw error for unsupported value type', async () => {
      await expect(
        redisInstance.setCache({
          key: 'test-key',
          value: true as any, // boolean is unsupported
        }),
      ).rejects.toThrow('Unsupported value type');
    });

    it('should set array value as JSON string', async () => {
      const arrayValue = [1, 2, 3];

      await redisInstance.setCache({
        key: 'test-key',
        value: arrayValue,
      });

      expect(mockClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(arrayValue));
    });
  });

  describe('getCache', () => {
    it('should get value from cache', async () => {
      mockClient.get.mockResolvedValue('cached-value');

      const result = await redisInstance.getCache({ key: 'test-key' });

      expect(result).toBe('cached-value');
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await redisInstance.getCache({ key: 'missing-key' });

      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('missing-key');
    });

    it('should get JSON string from cache', async () => {
      const jsonValue = JSON.stringify({ name: 'test' });
      mockClient.get.mockResolvedValue(jsonValue);

      const result = await redisInstance.getCache({ key: 'test-key' });

      expect(result).toBe(jsonValue);
    });
  });

  describe('deleteCache', () => {
    it('should delete key from cache', async () => {
      await redisInstance.deleteCache({ key: 'test-key' });

      expect(mockClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle deletion of non-existent key', async () => {
      mockClient.del.mockResolvedValue(0);

      await redisInstance.deleteCache({ key: 'missing-key' });

      expect(mockClient.del).toHaveBeenCalledWith('missing-key');
    });
  });
});
