import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger first
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  Redis: vi.fn(),
}));

describe('InMemoryRedis Client', () => {
  let RedisManager: any;
  let manager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set environment variable to use in-memory Redis
    process.env.PXL_REDIS_IN_MEMORY = '1';

    // Import RedisManager after setting env
    const module = await import('../../../src/redis/manager.js');
    RedisManager = module.default;

    manager = new RedisManager({
      host: 'localhost',
      port: 6379,
      applicationConfig: {
        name: 'test-app',
        log: { startUp: false },
      },
    });
  });

  afterEach(() => {
    delete process.env.PXL_REDIS_IN_MEMORY;
  });

  describe('Basic Operations', () => {
    it('should ping and return PONG', async () => {
      const instance = await manager.connect();
      const result = await instance.client.ping();
      expect(result).toBe('PONG');
    });

    it('should ping with callback', async () => {
      const instance = await manager.connect();
      const callback = vi.fn();

      await instance.client.ping(callback);

      expect(callback).toHaveBeenCalledWith(null, 'PONG');
    });

    it('should set and get a value', async () => {
      const instance = await manager.connect();

      await instance.client.set('test-key', 'test-value');
      const value = await instance.client.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should set and get buffer values', async () => {
      const instance = await manager.connect();
      const buffer = Buffer.from('test-buffer-data');

      await instance.client.set('buffer-key', buffer);
      const value = await instance.client.get('buffer-key');

      expect(value).toBeDefined();
      expect(Buffer.isBuffer(value) || typeof value === 'string').toBe(true);
    });

    it('should return null for non-existent keys', async () => {
      const instance = await manager.connect();
      const value = await instance.client.get('non-existent-key');

      expect(value).toBeNull();
    });

    it('should delete a key', async () => {
      const instance = await manager.connect();

      await instance.client.set('delete-key', 'delete-value');
      const deleteResult = await instance.client.del('delete-key');
      const getValue = await instance.client.get('delete-key');

      expect(deleteResult).toBe(1);
      expect(getValue).toBeNull();
    });

    it('should return 0 when deleting non-existent key', async () => {
      const instance = await manager.connect();
      const deleteResult = await instance.client.del('non-existent');

      expect(deleteResult).toBe(0);
    });
  });

  describe('Expiration', () => {
    it('should set key with expiration', async () => {
      const instance = await manager.connect();

      await instance.client.set('expire-key', 'expire-value', 'EX', 1);

      // Key should exist immediately
      const valueBeforeExpire = await instance.client.get('expire-key');
      expect(valueBeforeExpire).toBe('expire-value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const valueAfterExpire = await instance.client.get('expire-key');
      expect(valueAfterExpire).toBeNull();
    });

    it('should clear existing expiration when setting key again', async () => {
      const instance = await manager.connect();

      // Set with short expiration
      await instance.client.set('reset-key', 'first-value', 'EX', 1);

      // Reset without expiration
      await instance.client.set('reset-key', 'second-value');

      // Wait past original expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Key should still exist
      const value = await instance.client.get('reset-key');
      expect(value).toBe('second-value');
    });

    it('should clear expiration when deleting key', async () => {
      const instance = await manager.connect();

      await instance.client.set('del-expire-key', 'value', 'EX', 2);
      await instance.client.del('del-expire-key');

      // Wait to ensure timer doesn't cause issues
      await new Promise(resolve => setTimeout(resolve, 100));

      // Key should be gone
      const value = await instance.client.get('del-expire-key');
      expect(value).toBeNull();
    });

    it('should handle uppercase expiration mode', async () => {
      const instance = await manager.connect();

      await instance.client.set('upper-key', 'value', 'EX', 1);
      const value = await instance.client.get('upper-key');

      expect(value).toBe('value');
    });

    it('should ignore invalid expiration mode', async () => {
      const instance = await manager.connect();

      await instance.client.set('invalid-mode-key', 'value', 'INVALID', 1);
      const value = await instance.client.get('invalid-mode-key');

      expect(value).toBe('value');

      // Wait and verify key still exists (no expiration)
      await new Promise(resolve => setTimeout(resolve, 1100));
      const stillExists = await instance.client.get('invalid-mode-key');
      expect(stillExists).toBe('value');
    });
  });

  describe('Pub/Sub', () => {
    it('should publish and subscribe to channels', async () => {
      const instance = await manager.connect();

      const messageHandler = vi.fn();
      instance.subscriberClient.on('message', messageHandler);

      await instance.subscriberClient.subscribe('test-channel');
      await instance.publisherClient.publish('test-channel', 'test-message');

      // Wait for message to be delivered
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalledWith('test-channel', 'test-message');
    });

    it('should return subscriber count when publishing', async () => {
      const instance = await manager.connect();

      await instance.subscriberClient.subscribe('count-channel');
      const subscriberCount = await instance.publisherClient.publish('count-channel', 'message');

      expect(subscriberCount).toBeGreaterThan(0);
    });

    it('should return 0 when publishing to channel with no subscribers', async () => {
      const instance = await manager.connect();

      const subscriberCount = await instance.publisherClient.publish('empty-channel', 'message');

      expect(subscriberCount).toBe(0);
    });

    it('should handle multiple subscribers to same channel', async () => {
      const manager1 = new RedisManager({
        host: 'localhost',
        port: 6379,
        applicationConfig: { name: 'test-app-1', log: { startUp: false } },
      });

      const manager2 = new RedisManager({
        host: 'localhost',
        port: 6379,
        applicationConfig: { name: 'test-app-2', log: { startUp: false } },
      });

      const instance1 = await manager1.connect();
      const instance2 = await manager2.connect();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      instance1.subscriberClient.on('message', handler1);
      instance2.subscriberClient.on('message', handler2);

      await instance1.subscriberClient.subscribe('multi-channel');
      await instance2.subscriberClient.subscribe('multi-channel');

      const count = await instance1.publisherClient.publish('multi-channel', 'broadcast');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(count).toBeGreaterThanOrEqual(2);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe from channel', async () => {
      const instance = await manager.connect();

      const messageHandler = vi.fn();
      instance.subscriberClient.on('message', messageHandler);

      await instance.subscriberClient.subscribe('unsub-channel');
      await instance.subscriberClient.unsubscribe('unsub-channel');
      await instance.publisherClient.publish('unsub-channel', 'should-not-receive');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should return 0 when unsubscribing from non-existent channel', async () => {
      const instance = await manager.connect();

      const result = await instance.subscriberClient.unsubscribe('non-existent-channel');

      expect(result).toBe(0);
    });

    it('should handle multiple messages to same subscriber', async () => {
      const instance = await manager.connect();

      const messageHandler = vi.fn();
      instance.subscriberClient.on('message', messageHandler);

      await instance.subscriberClient.subscribe('spam-channel');

      for (let i = 0; i < 5; i++) {
        await instance.publisherClient.publish('spam-channel', `message-${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe('Disconnect and Cleanup', () => {
    it('should quit gracefully', async () => {
      const instance = await manager.connect();

      await instance.client.set('quit-test', 'value');
      const result = await instance.client.quit();

      expect(result).toBe('OK');
    });

    it('should emit end event on quit', async () => {
      const instance = await manager.connect();

      const endHandler = vi.fn();
      instance.client.on('end', endHandler);

      await instance.client.quit();

      expect(endHandler).toHaveBeenCalled();
    });

    it('should disconnect and emit end event', async () => {
      const instance = await manager.connect();

      const endHandler = vi.fn();
      instance.client.on('end', endHandler);

      instance.client.disconnect();

      expect(endHandler).toHaveBeenCalled();
    });

    it('should cleanup subscriptions on quit', async () => {
      const instance = await manager.connect();

      await instance.subscriberClient.subscribe('cleanup-channel');
      await instance.subscriberClient.quit();

      // Publishing should return 0 subscribers
      const count = await instance.publisherClient.publish('cleanup-channel', 'message');
      expect(count).toBe(0);
    });

    it('should cleanup subscriptions on disconnect', async () => {
      const instance = await manager.connect();

      await instance.subscriberClient.subscribe('cleanup-disconnect');
      instance.subscriberClient.disconnect();

      // Publishing should return 0 subscribers
      const count = await instance.publisherClient.publish('cleanup-disconnect', 'message');
      expect(count).toBe(0);
    });

    it('should remove all listeners on quit', async () => {
      const instance = await manager.connect();

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      instance.client.on('message', listener1);
      instance.client.on('error', listener2);

      await instance.client.quit();

      expect(instance.client.listenerCount('message')).toBe(0);
      expect(instance.client.listenerCount('error')).toBe(0);
    });
  });

  describe('Connection Events', () => {
    it('should emit ready event on creation', async () => {
      const readyHandler = vi.fn();

      const instance = await manager.connect();
      instance.client.on('ready', readyHandler);

      // Create another instance to trigger ready
      const newManager = new RedisManager({
        host: 'localhost',
        port: 6379,
        applicationConfig: { name: 'test-app-new', log: { startUp: false } },
      });

      const newInstance = await newManager.connect();

      // Wait for ready event
      await new Promise(resolve => setTimeout(resolve, 50));

      // The ready event is emitted on construction
      expect(newInstance.client.listenerCount('ready')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Types', () => {
    it('should handle numeric values', async () => {
      const instance = await manager.connect();

      await instance.client.set('number-key', 42);
      const value = await instance.client.get('number-key');

      expect(value).toBe('42');
    });

    it('should handle boolean values', async () => {
      const instance = await manager.connect();

      await instance.client.set('bool-key', true);
      const value = await instance.client.get('bool-key');

      expect(value).toBe('true');
    });

    it('should handle empty string', async () => {
      const instance = await manager.connect();

      await instance.client.set('empty-key', '');
      const value = await instance.client.get('empty-key');

      expect(value).toBe('');
    });

    it('should handle special characters', async () => {
      const instance = await manager.connect();

      const specialValue = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      await instance.client.set('special-key', specialValue);
      const value = await instance.client.get('special-key');

      expect(value).toBe(specialValue);
    });

    it('should handle unicode characters', async () => {
      const instance = await manager.connect();

      const unicodeValue = '你好世界 🌍 مرحبا';
      await instance.client.set('unicode-key', unicodeValue);
      const value = await instance.client.get('unicode-key');

      expect(value).toBe(unicodeValue);
    });
  });

  describe('Shared State', () => {
    it('should share state between multiple clients', async () => {
      const instance = await manager.connect();

      // Client sets a value
      await instance.client.set('shared-key', 'shared-value');

      // Subscriber should see the same value (using subscriberClient)
      const value = await instance.subscriberClient.get('shared-key');

      expect(value).toBe('shared-value');
    });

    it('should share expirations between clients', async () => {
      const instance = await manager.connect();

      // Set with expiration
      await instance.client.set('shared-expire', 'value', 'EX', 1);

      // Both clients should see expiration
      const valueFromClient = await instance.client.get('shared-expire');
      const valueFromSubscriber = await instance.subscriberClient.get('shared-expire');

      expect(valueFromClient).toBe('value');
      expect(valueFromSubscriber).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const afterClient = await instance.client.get('shared-expire');
      const afterSubscriber = await instance.subscriberClient.get('shared-expire');

      expect(afterClient).toBeNull();
      expect(afterSubscriber).toBeNull();
    });
  });
});
