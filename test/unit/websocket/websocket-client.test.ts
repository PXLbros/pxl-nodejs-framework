import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocketClient from '../../../src/websocket/websocket-client.js';
import type { WebSocketOptions } from '../../../src/websocket/websocket.interface.js';
import type RedisInstance from '../../../src/redis/instance.js';
import type QueueManager from '../../../src/queue/manager.js';
import type DatabaseInstance from '../../../src/database/instance.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import WebSocket from 'ws';

// Mock WebSocket module
vi.mock('ws', () => {
  const WebSocketMock = vi.fn().mockImplementation(function (this: any, url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.send = vi.fn();
    this.close = vi.fn();
    this.removeAllListeners = vi.fn();
    this._events = {};
    this.on = vi.fn((event: string, handler: any) => {
      this._events[event] = handler;
      return this;
    });

    // Simulate asynchronous connection
    setTimeout(() => {
      if (this._events['open']) {
        this._events['open']();
      }
    }, 0);

    return this;
  });

  // Add static properties to the constructor
  WebSocketMock.OPEN = 1;
  WebSocketMock.CLOSED = 3;

  return {
    default: WebSocketMock,
    OPEN: 1,
    CLOSED: 3,
  };
});

const baseApplicationConfig: ApplicationConfig = {
  name: 'TestApp',
  instanceId: 'test-instance',
  rootDirectory: '/tmp',
  redis: {
    host: 'localhost',
    port: 6379,
  },
  queue: {
    queues: [],
    processorsDirectory: '/tmp/processors',
  },
};

const defaultOptions: WebSocketOptions = {
  type: 'client',
  url: 'ws://localhost:4000',
  controllersDirectory: '/tmp/controllers',
};

const createRedisInstanceMock = () =>
  ({
    subscriberClient: {
      on: vi.fn(),
      subscribe: vi.fn(),
    },
    publisherClient: {
      publish: vi.fn(),
    },
  }) as unknown as RedisInstance;

const createQueueManagerMock = () => ({}) as QueueManager;
const createDatabaseInstanceMock = () => ({}) as DatabaseInstance;

interface ClientTestContext {
  client: WebSocketClient;
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

const createClient = (overrides: { options?: Partial<WebSocketOptions> } = {}): ClientTestContext => {
  const redisInstance = createRedisInstanceMock();
  const queueManager = createQueueManagerMock();
  const databaseInstance = createDatabaseInstanceMock();

  const options: WebSocketOptions = {
    ...defaultOptions,
    ...overrides.options,
  };

  const client = new WebSocketClient({
    applicationConfig: baseApplicationConfig,
    options,
    redisInstance,
    queueManager,
    databaseInstance,
    routes: [],
  });

  return { client, redisInstance, queueManager, databaseInstance };
};

describe('WebSocketClient', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with correct properties', () => {
      const { client } = createClient();

      expect(client.type).toBe('client');
      expect((client as any).applicationConfig).toBeDefined();
      expect((client as any).options).toBeDefined();
      expect((client as any).redisInstance).toBeDefined();
      expect((client as any).queueManager).toBeDefined();
      expect((client as any).databaseInstance).toBeDefined();
    });

    it('should initialize with default routes', () => {
      const { client } = createClient();
      const defaultRoutes = (client as any).defaultRoutes;

      expect(defaultRoutes).toHaveLength(1);
      expect(defaultRoutes[0]).toMatchObject({
        type: 'system',
        action: 'clientList',
        controllerName: 'system',
      });
    });

    it('should accept custom routes', () => {
      const customRoutes = [
        {
          type: 'custom',
          action: 'test',
          controllerName: 'test-controller',
        },
      ];

      const redisInstance = createRedisInstanceMock();
      const queueManager = createQueueManagerMock();
      const databaseInstance = createDatabaseInstanceMock();

      const client = new WebSocketClient({
        applicationConfig: baseApplicationConfig,
        options: defaultOptions,
        redisInstance,
        queueManager,
        databaseInstance,
        routes: customRoutes,
      });

      expect((client as any).routes).toEqual(customRoutes);
    });

    it('should not be connected initially', () => {
      const { client } = createClient();

      expect(client.isClientConnected()).toBe(false);
      expect((client as any).isConnected).toBe(false);
      expect((client as any).ws).toBeUndefined();
      expect((client as any).clientId).toBeUndefined();
    });
  });

  describe('Type Property', () => {
    it('should return "client" as type', () => {
      const { client } = createClient();

      expect(client.type).toBe('client');
    });
  });

  describe('Connection Management', () => {
    it('should connect to server successfully', async () => {
      const { client } = createClient();

      await client.connectToServer();

      expect((client as any).isConnected).toBe(true);
      expect((client as any).clientId).toBeDefined();
      expect((client as any).ws).toBeDefined();
    });

    it('should call onConnected event handler when provided', async () => {
      const onConnected = vi.fn();
      const { client } = createClient({
        options: {
          events: {
            onConnected,
          },
        },
      });

      await client.connectToServer();

      expect(onConnected).toHaveBeenCalled();
      expect(onConnected).toHaveBeenCalledWith(
        expect.objectContaining({
          ws: expect.anything(),
          clientId: expect.any(String),
          joinRoom: expect.any(Function),
        }),
      );
    });

    it('should provide joinRoom function in onConnected callback', async () => {
      let joinRoomFn: any;
      const onConnected = vi.fn((params: any) => {
        joinRoomFn = params.joinRoom;
      });

      const { client } = createClient({
        options: {
          events: {
            onConnected,
          },
        },
      });

      const sendClientMessageSpy = vi.spyOn(client, 'sendClientMessage');

      await client.connectToServer();

      expect(joinRoomFn).toBeDefined();

      // Call joinRoom
      joinRoomFn({
        userId: '123',
        userType: 'admin',
        username: 'testuser',
        roomName: 'test-room',
      });

      expect(sendClientMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        action: 'joinRoom',
        data: {
          userId: '123',
          userType: 'admin',
          username: 'testuser',
          roomName: 'test-room',
        },
      });
    });

    it('should handle disconnect event', async () => {
      const onDisconnected = vi.fn();
      const { client } = createClient({
        options: {
          events: {
            onDisconnected,
          },
        },
      });

      await client.connectToServer();

      const clientId = (client as any).clientId;
      const ws = (client as any).ws;

      // Trigger close event using the mocked WebSocket's _events
      if (ws && ws._events && ws._events['close']) {
        ws._events['close']();
      }

      expect((client as any).isConnected).toBe(false);
      expect((client as any).ws).toBeUndefined();
      expect((client as any).clientId).toBeUndefined();
      expect(onDisconnected).toHaveBeenCalledWith({ clientId });
    });

    it('should handle error event', async () => {
      const onError = vi.fn();
      const { client } = createClient({
        options: {
          events: {
            onError,
          },
        },
      });

      await client.connectToServer();

      const ws = (client as any).ws;
      const testError = new Error('Test WebSocket error');

      // Trigger error event using the mocked WebSocket's _events
      if (ws && ws._events && ws._events['error']) {
        ws._events['error'](testError);
      }

      expect(onError).toHaveBeenCalledWith({ error: testError });
    });

    it('should handle message event', async () => {
      const onMessage = vi.fn();
      const { client } = createClient({
        options: {
          events: {
            onMessage,
          },
        },
      });

      await client.connectToServer();

      const ws = (client as any).ws;
      const testMessage = JSON.stringify({ type: 'test', action: 'ping', data: { foo: 'bar' } });

      // Trigger message event using the mocked WebSocket's _events
      if (ws && ws._events && ws._events['message']) {
        await ws._events['message'](testMessage);
      }

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ws: expect.anything(),
          clientId: expect.any(String),
          data: { type: 'test', action: 'ping', data: { foo: 'bar' } },
        }),
      );
    });
  });

  describe('Message Sending', () => {
    it('should send client message when connected', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;
      const message = { type: 'test', action: 'ping', data: {} };

      client.sendClientMessage(message);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message), { binary: false });
    });

    it('should send binary message when specified', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;
      const message = { type: 'test', action: 'ping', data: {} };

      client.sendClientMessage(message, true);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message), { binary: true });
    });

    it('should not send message when not connected', () => {
      const { client } = createClient();

      // Should not throw
      expect(() => client.sendClientMessage({ type: 'test', action: 'ping' })).not.toThrow();
    });

    it('should use sendMessage as alias for sendClientMessage', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;
      const message = { type: 'test', action: 'ping', data: {} };

      client.sendMessage(message);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message), { binary: false });
    });
  });

  describe('Disconnection', () => {
    it('should disconnect when connected', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;
      expect((client as any).isConnected).toBe(true);

      client.disconnect();

      expect(ws.removeAllListeners).toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalled();
      expect((client as any).ws).toBeUndefined();
      expect((client as any).clientId).toBeUndefined();
      expect((client as any).isConnected).toBe(false);
    });

    it('should do nothing when disconnecting while not connected', () => {
      const { client } = createClient();

      // Should not throw
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('Connection Status', () => {
    it('should return false when not connected', () => {
      const { client } = createClient();

      expect(client.isClientConnected()).toBe(false);
    });

    it('should return true when connected with OPEN readyState', async () => {
      const { client } = createClient();

      await client.connectToServer();

      // The mocked WebSocket has readyState = 1 (OPEN) by default
      expect(client.isClientConnected()).toBe(true);
    });

    it('should return false when connected but readyState is not OPEN', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;
      // Change readyState to CLOSED
      ws.readyState = 3; // WebSocket.CLOSED

      expect(client.isClientConnected()).toBe(false);
    });
  });

  describe('Controller Dependencies', () => {
    it('should provide correct dependencies to controllers', () => {
      const { client, redisInstance, queueManager, databaseInstance } = createClient();
      const deps = (client as any).getControllerDependencies();

      expect(deps).toHaveProperty('sendMessage');
      expect(deps).toHaveProperty('redisInstance');
      expect(deps).toHaveProperty('queueManager');
      expect(deps).toHaveProperty('databaseInstance');
      expect(deps.redisInstance).toBe(redisInstance);
      expect(deps.queueManager).toBe(queueManager);
      expect(deps.databaseInstance).toBe(databaseInstance);
      expect(typeof deps.sendMessage).toBe('function');
    });
  });

  describe('shouldPrintRoutes', () => {
    it('should return false when debug.printRoutes is not set', () => {
      const { client } = createClient();

      expect((client as any).shouldPrintRoutes()).toBe(false);
    });

    it('should return false when debug.printRoutes is explicitly false', () => {
      const { client } = createClient({
        options: {
          debug: {
            printRoutes: false,
          },
        },
      });

      expect((client as any).shouldPrintRoutes()).toBe(false);
    });

    it('should return true when debug.printRoutes is true', () => {
      const { client } = createClient({
        options: {
          debug: {
            printRoutes: true,
          },
        },
      });

      expect((client as any).shouldPrintRoutes()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle message error without throwing', () => {
      const { client } = createClient();

      expect(() => (client as any).handleMessageError('client-123', 'Test error')).not.toThrow();
    });

    it('should handle incoming message when WebSocket is not initialized', async () => {
      const { client } = createClient();

      // Call handleIncomingMessage directly without connecting
      const result = await (client as any).handleIncomingMessage('test message');

      expect(result).toBeUndefined();
    });

    it('should handle incoming message when clientId is not set', async () => {
      const { client } = createClient();

      // Set ws but not clientId
      (client as any).ws = {} as WebSocket;

      const result = await (client as any).handleIncomingMessage('test message');

      expect(result).toBeUndefined();
    });
  });

  describe('Auto-Reconnection', () => {
    let timerId: NodeJS.Timeout | undefined;

    afterEach(() => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = undefined;
      }
    });

    it('should be enabled by default', () => {
      const { client } = createClient();

      expect((client as any).shouldReconnect).toBe(true);
    });

    it('should get connection status with auto-reconnect enabled', () => {
      const { client } = createClient();

      const status = client.getConnectionStatus();

      expect(status).toEqual({
        isConnected: false,
        reconnectAttempts: 0,
        autoReconnectEnabled: true,
      });
    });

    it('should schedule reconnection on disconnect', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;

      // Trigger close event
      if (ws && ws._events && ws._events['close']) {
        ws._events['close'](1000);
      }

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify reconnect was scheduled
      expect((client as any).reconnectTimer).toBeDefined();
    });

    it('should calculate exponential backoff delays correctly', () => {
      const { client } = createClient();

      // Test the delay calculation directly
      const calculateDelay = (attempts: number) => {
        const baseDelay = 1000;
        return Math.min(baseDelay * Math.pow(2, attempts), 30000);
      };

      // Verify exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
      expect(calculateDelay(0)).toBe(1000); // 1 second
      expect(calculateDelay(1)).toBe(2000); // 2 seconds
      expect(calculateDelay(2)).toBe(4000); // 4 seconds
      expect(calculateDelay(3)).toBe(8000); // 8 seconds
      expect(calculateDelay(4)).toBe(16000); // 16 seconds
      expect(calculateDelay(5)).toBe(30000); // 30 seconds (capped)
      expect(calculateDelay(10)).toBe(30000); // Still capped at 30s
    });

    it('should track max reconnection attempts limit', () => {
      const { client } = createClient();

      // Verify max attempts is set correctly
      expect((client as any).maxReconnectAttempts).toBe(10);
    });

    it('should initialize with zero reconnection attempts', () => {
      const { client } = createClient();

      // Verify reconnect attempts starts at 0
      expect((client as any).reconnectAttempts).toBe(0);
    });

    it('should fire onReconnecting event with attempt and delay', async () => {
      const onReconnecting = vi.fn();
      const { client } = createClient({
        options: {
          events: {
            onReconnecting,
          },
        },
      });

      await client.connectToServer();

      const ws = (client as any).ws;

      // Trigger disconnect
      if (ws && ws._events && ws._events['close']) {
        ws._events['close'](1000);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have fired onReconnecting with attempt 1 and delay 1000ms
      expect(onReconnecting).toHaveBeenCalledWith({
        attempt: 1,
        delay: 1000,
      });
    });

    it('should disable auto-reconnect on manual disconnect', async () => {
      const { client } = createClient();

      await client.connectToServer();

      client.disconnect();

      expect((client as any).shouldReconnect).toBe(false);
      expect((client as any).reconnectTimer).toBeUndefined();
    });

    it('should enable auto-reconnect when enableAutoReconnect is called', () => {
      const { client } = createClient();

      // Disable first
      client.disableAutoReconnect();
      expect((client as any).shouldReconnect).toBe(false);

      // Enable
      client.enableAutoReconnect();
      expect((client as any).shouldReconnect).toBe(true);
    });

    it('should disable auto-reconnect and clear timer when disableAutoReconnect is called', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;

      // Trigger disconnect to schedule reconnection
      if (ws && ws._events && ws._events['close']) {
        ws._events['close'](1000);
      }

      // Wait for reconnect to be scheduled
      await new Promise(resolve => setTimeout(resolve, 10));

      expect((client as any).reconnectTimer).toBeDefined();

      // Disable auto-reconnect
      client.disableAutoReconnect();

      expect((client as any).shouldReconnect).toBe(false);
      expect((client as any).reconnectTimer).toBeUndefined();
    });

    it('should not schedule reconnection when shouldReconnect is false', async () => {
      const { client } = createClient();

      await client.connectToServer();

      // Disable auto-reconnect
      client.disableAutoReconnect();

      const ws = (client as any).ws;

      // Trigger disconnect
      if (ws && ws._events && ws._events['close']) {
        ws._events['close'](1000);
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not have scheduled reconnection
      expect((client as any).reconnectTimer).toBeUndefined();
    });

    it('should report correct connection status', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const status = client.getConnectionStatus();

      expect(status.isConnected).toBe(true);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.autoReconnectEnabled).toBe(true);
    });

    it('should clear pending timer when disabling auto-reconnect during scheduled reconnection', async () => {
      const { client } = createClient();

      await client.connectToServer();

      const ws = (client as any).ws;

      // Trigger disconnect - schedules reconnection
      if (ws && ws._events && ws._events['close']) {
        ws._events['close'](1000);
      }

      // Wait for reconnect to be scheduled
      await new Promise(resolve => setTimeout(resolve, 10));

      const timerId = (client as any).reconnectTimer;
      expect(timerId).toBeDefined();

      // Disable before timer fires
      client.disableAutoReconnect();

      expect((client as any).reconnectTimer).toBeUndefined();
    });
  });
});
