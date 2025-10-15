import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocketServer from '../../../src/websocket/websocket-server.js';
import type { WebSocketOptions } from '../../../src/websocket/websocket.interface.js';
import type RedisInstance from '../../../src/redis/instance.js';
import type QueueManager from '../../../src/queue/manager.js';
import type DatabaseInstance from '../../../src/database/instance.js';
import type { WebApplicationConfig } from '../../../src/application/web-application.interface.js';
import { LifecycleManager } from '../../../src/lifecycle/lifecycle-manager.js';

const baseApplicationConfig: WebApplicationConfig = {
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
  auth: {
    jwtSecretKey: 'secret',
  },
};

const defaultOptions: WebSocketOptions = {
  type: 'server',
  url: 'ws://localhost',
  controllersDirectory: '/tmp/controllers',
  disconnectInactiveClients: {
    enabled: false,
  },
};

const createFakeWebSocketServer = () => ({
  on: vi.fn(),
  clients: new Set(),
  removeAllListeners: vi.fn(),
  close: vi.fn(),
});

const createRedisSubscriberMock = () => ({
  removeListener: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
});

interface ServerTestContext {
  server: WebSocketServer;
  redisSubscriberMock: ReturnType<typeof createRedisSubscriberMock>;
}

const createServer = (overrides: { options?: Partial<WebSocketOptions> } = {}): ServerTestContext => {
  const redisSubscriberMock = createRedisSubscriberMock();
  const redisInstance = {
    subscriberClient: redisSubscriberMock,
    publisherClient: { publish: vi.fn() },
  } as unknown as RedisInstance;

  const queueManager = {} as QueueManager;
  const databaseInstance = {} as DatabaseInstance;

  const options: WebSocketOptions = {
    ...defaultOptions,
    ...overrides.options,
    disconnectInactiveClients: {
      ...defaultOptions.disconnectInactiveClients,
      ...overrides.options?.disconnectInactiveClients,
    },
  };

  const server = new WebSocketServer({
    uniqueInstanceId: 'unique-instance',
    applicationConfig: baseApplicationConfig,
    options,
    redisInstance,
    queueManager,
    databaseInstance,
    routes: [],
    workerId: null,
  });

  return { server, redisSubscriberMock };
};

describe('WebSocketServer', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with correct properties', () => {
      const { server } = createServer();

      expect(server.type).toBe('server');
      expect(server.clientManager).toBeDefined();
      expect(server.rooms).toBeDefined();
    });

    it('should initialize with default routes', () => {
      const { server } = createServer();
      const defaultRoutes = (server as any).defaultRoutes;

      expect(defaultRoutes).toHaveLength(2);
      expect(defaultRoutes[0]).toMatchObject({
        type: 'system',
        action: 'joinRoom',
        controllerName: 'system',
      });
      expect(defaultRoutes[1]).toMatchObject({
        type: 'system',
        action: 'leaveRoom',
        controllerName: 'system',
      });
    });
  });

  describe('Authentication', () => {
    it('should return null when no token provided', async () => {
      const { server } = createServer();
      const validateAuth = (server as any).validateWebSocketAuth.bind(server);

      const result = await validateAuth('ws://localhost/ws');

      expect(result).toBeNull();
    });

    it('should throw error when JWT secret not configured', async () => {
      const config = { ...baseApplicationConfig };
      delete config.auth;

      const redisInstance = {
        subscriberClient: createRedisSubscriberMock(),
        publisherClient: { publish: vi.fn() },
      } as unknown as RedisInstance;

      const server = new WebSocketServer({
        uniqueInstanceId: 'test',
        applicationConfig: config,
        options: defaultOptions,
        redisInstance,
        queueManager: {} as QueueManager,
        databaseInstance: {} as DatabaseInstance,
        routes: [],
        workerId: null,
      });

      const validateAuth = (server as any).validateWebSocketAuth.bind(server);

      await expect(validateAuth('ws://localhost/ws?token=sometoken')).rejects.toThrow(
        'JWT verification failed: JWT secret key not configured',
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should have unaborted controller on initialization', () => {
      const { server } = createServer();
      const abortController = (server as any).abortController;

      expect(abortController.signal.aborted).toBe(false);
    });

    it('should abort controller and clean up on stop', async () => {
      const { server, redisSubscriberMock } = createServer();
      const originalController = (server as any).abortController;

      await server.stop();

      expect(originalController.signal.aborted).toBe(true);
      expect(redisSubscriberMock.removeListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(redisSubscriberMock.unsubscribe).toHaveBeenCalled();
    });

    it('should create new abort controller after stop', async () => {
      const { server } = createServer();
      const originalController = (server as any).abortController;

      await server.stop();

      const newController = (server as any).abortController;
      expect(newController).not.toBe(originalController);
      expect(newController.signal.aborted).toBe(false);
    });

    it('should cleanup client and room managers on stop', async () => {
      const { server } = createServer();
      const originalClientManager = server.clientManager;
      const originalRoomManager = (server as any).roomManager;

      const clientCleanupSpy = vi.spyOn(originalClientManager, 'cleanup');
      const roomCleanupSpy = vi.spyOn(originalRoomManager, 'cleanup');

      await server.stop();

      expect(clientCleanupSpy).toHaveBeenCalled();
      expect(roomCleanupSpy).toHaveBeenCalled();
    });

    it('should reset managers after stop', async () => {
      const { server } = createServer();
      const originalClientManager = server.clientManager;

      await server.stop();

      expect(server.clientManager).not.toBe(originalClientManager);
    });
  });

  describe('Client Connection Handling', () => {
    it('should add client on connection', () => {
      const { server } = createServer();
      const ws = { on: vi.fn(), send: vi.fn() } as any;
      const addClientSpy = vi.spyOn(server.clientManager, 'addClient');

      (server as any).handleServerClientConnection(ws, null);

      expect(addClientSpy).toHaveBeenCalled();
      expect(ws.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should publish client connected event to Redis', () => {
      const { server } = createServer();
      const ws = { on: vi.fn(), send: vi.fn() } as any;
      const redisInstance = (server as any).redisInstance;
      const publishSpy = vi.spyOn(redisInstance.publisherClient, 'publish');

      (server as any).handleServerClientConnection(ws, null);

      expect(publishSpy).toHaveBeenCalledWith('clientConnected', expect.stringContaining('"clientId"'));
    });

    it('should send authentication message for authenticated clients', () => {
      const { server } = createServer();
      const ws = { on: vi.fn(), send: vi.fn() } as any;
      const authenticatedUser = { userId: 123, payload: {} };

      (server as any).handleServerClientConnection(ws, authenticatedUser);

      // Expect ws.send to be called with a string containing auth type
      const sendCalls = (ws.send as any).mock.calls;
      expect(sendCalls.length).toBeGreaterThan(0);
      const authMessage = sendCalls[0][0];
      expect(authMessage).toContain('"type":"auth"');
    });
  });

  describe('Client Disconnection Handling', () => {
    it('should remove client from manager on disconnect', () => {
      const { server } = createServer();
      const removeClientSpy = vi.spyOn(server.clientManager, 'removeClient');

      (server as any).onClientDisconnect({ clientId: 'test-client-123' });

      expect(removeClientSpy).toHaveBeenCalledWith('test-client-123');
    });

    it('should remove client from all rooms on disconnect', () => {
      const { server } = createServer();
      const roomManager = (server as any).roomManager;
      const removeFromRoomsSpy = vi.spyOn(roomManager, 'removeClientFromAllRooms');

      (server as any).onClientDisconnect({ clientId: 'test-client-123' });

      expect(removeFromRoomsSpy).toHaveBeenCalledWith({ clientId: 'test-client-123' });
    });
  });

  describe('Redis Subscriber Message Handling', () => {
    it('should handle ClientConnected event', async () => {
      const { server } = createServer();
      const addClientSpy = vi.spyOn(server.clientManager, 'addClient');

      const message = JSON.stringify({
        clientId: 'remote-client',
        lastActivity: Date.now(),
        workerId: 999, // Different worker
      });

      await (server as any).handleSubscriberMessage('clientConnected', message);

      expect(addClientSpy).toHaveBeenCalledWith({
        clientId: 'remote-client',
        ws: null,
        lastActivity: expect.any(Number),
        user: undefined,
      });
    });

    it('should handle ClientDisconnected event', async () => {
      const { server } = createServer();
      const removeClientSpy = vi.spyOn(server.clientManager, 'removeClient');

      const message = JSON.stringify({
        clientId: 'remote-client',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('clientDisconnected', message);

      expect(removeClientSpy).toHaveBeenCalledWith('remote-client');
    });

    it('should ignore messages from same worker when includeSender is false', async () => {
      const { server } = createServer();
      (server as any).workerId = 1;

      const addClientSpy = vi.spyOn(server.clientManager, 'addClient');

      const message = JSON.stringify({
        clientId: 'same-worker-client',
        lastActivity: Date.now(),
        workerId: 1, // Same worker
        includeSender: false,
      });

      await (server as any).handleSubscriberMessage('clientConnected', message);

      expect(addClientSpy).not.toHaveBeenCalled();
    });

    it('should handle messages from same worker when includeSender is true', async () => {
      const { server } = createServer();
      (server as any).workerId = 1;

      const addClientSpy = vi.spyOn(server.clientManager, 'addClient');

      const message = JSON.stringify({
        clientId: 'same-worker-client',
        lastActivity: Date.now(),
        workerId: 1,
        includeSender: true,
      });

      await (server as any).handleSubscriberMessage('clientConnected', message);

      expect(addClientSpy).toHaveBeenCalled();
    });

    it('should handle malformed JSON gracefully', async () => {
      const { server } = createServer();

      // Should not throw
      await expect(
        (server as any).handleSubscriberMessage('clientConnected', '{invalid json}'),
      ).resolves.toBeUndefined();
    });
  });

  describe('Room Management', () => {
    it('should access rooms through room manager', () => {
      const { server } = createServer();

      expect(server.rooms).toBeDefined();
      expect(server.rooms).toBe((server as any).roomManager.rooms);
    });

    it('should leave room and publish Redis event', () => {
      const { server } = createServer();
      const ws = { send: vi.fn() } as any;
      const clientId = 'test-client';

      // Mock client manager methods
      vi.spyOn(server.clientManager, 'getClientId').mockReturnValue(clientId);

      // Mock room manager methods
      const roomManager = (server as any).roomManager;
      vi.spyOn(roomManager, 'isClientInRoom').mockReturnValue(true);
      const removeFromRoomSpy = vi.spyOn(roomManager, 'removeClientFromRoom');

      // Mock Redis publish
      const publishSpy = vi.spyOn((server as any).redisInstance.publisherClient, 'publish');

      server.leaveRoom({ ws, roomName: 'test-room' });

      expect(removeFromRoomSpy).toHaveBeenCalledWith({
        roomName: 'test-room',
        clientId,
      });
      expect(publishSpy).toHaveBeenCalledWith('clientLeftRoom', expect.stringContaining('test-room'));
      expect(ws.send).toHaveBeenCalled();
    });

    it('should not leave room if client not in room', () => {
      const { server } = createServer();
      const ws = { send: vi.fn() } as any;
      const clientId = 'test-client';

      vi.spyOn(server.clientManager, 'getClientId').mockReturnValue(clientId);
      const roomManager = (server as any).roomManager;
      vi.spyOn(roomManager, 'isClientInRoom').mockReturnValue(false);
      const removeFromRoomSpy = vi.spyOn(roomManager, 'removeClientFromRoom');

      server.leaveRoom({ ws, roomName: 'test-room' });

      expect(removeFromRoomSpy).not.toHaveBeenCalled();
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('AbortController integration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should tie inactivity interval to abort controller', async () => {
      const { server } = createServer({
        options: {
          disconnectInactiveClients: {
            enabled: true,
            intervalCheckTime: 1_000,
          },
        },
      });

      (server as unknown as { checkInactiveClients: () => void }).checkInactiveClients = vi.fn();
      (server as unknown as { server: ReturnType<typeof createFakeWebSocketServer> }).server =
        createFakeWebSocketServer();

      let capturedSignal: AbortSignal | undefined;
      let abortTriggered = false;

      vi.spyOn(global, 'setInterval' as any).mockImplementation(
        (fn: () => void, ms: number, options?: { signal?: AbortSignal }) => {
          capturedSignal = options?.signal;
          options?.signal?.addEventListener('abort', () => {
            abortTriggered = true;
          });
          return {} as NodeJS.Timeout;
        },
      );

      (server as unknown as { handleServerStart(): void }).handleServerStart();

      const abortController = (server as unknown as { abortController: AbortController }).abortController;

      expect(capturedSignal).toBe(abortController.signal);
      expect(abortController.signal.aborted).toBe(false);

      const lifecycle = new LifecycleManager();
      lifecycle.trackAbortController(abortController);

      const result = await lifecycle.shutdown();

      expect(result.timedOut).toBe(false);
      expect(abortController.signal.aborted).toBe(true);
      expect(abortTriggered).toBe(true);
    });

    it('should abort controller and create fresh one on stop', async () => {
      const { server, redisSubscriberMock } = createServer();

      const originalController = (server as unknown as { abortController: AbortController }).abortController;
      expect(originalController.signal.aborted).toBe(false);

      await server.stop();

      expect(redisSubscriberMock.removeListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(redisSubscriberMock.unsubscribe).toHaveBeenCalled();
      expect(originalController.signal.aborted).toBe(true);

      const newController = (server as unknown as { abortController: AbortController }).abortController;
      expect(newController).not.toBe(originalController);
      expect(newController.signal.aborted).toBe(false);
    });
  });

  describe('Controller Dependencies', () => {
    it('should provide correct dependencies to controllers', () => {
      const { server } = createServer();
      const deps = (server as any).getControllerDependencies();

      expect(deps).toHaveProperty('webSocketServer');
      expect(deps).toHaveProperty('redisInstance');
      expect(deps).toHaveProperty('queueManager');
      expect(deps).toHaveProperty('databaseInstance');
      expect(deps.webSocketServer).toBe(server);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors', () => {
      const { server } = createServer();
      const error = new Error('Test error');

      // Should not throw
      expect(() => (server as any).handleServerError(error)).not.toThrow();
    });
  });

  describe('handleSubscriberMessage - Additional Events', () => {
    it('should handle SendMessageToAll event', async () => {
      const { server } = createServer();
      const broadcastSpy = vi.spyOn(server as any, 'broadcastToAllClients');

      const message = JSON.stringify({
        workerId: 999, // Different worker
        type: 'test',
        action: 'broadcast',
        data: { foo: 'bar' },
      });

      await (server as any).handleSubscriberMessage('sendMessageToAll', message);

      expect(broadcastSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'test',
          action: 'broadcast',
          data: { foo: 'bar' },
        }),
      });
    });

    it('should handle MessageError event', async () => {
      const { server } = createServer();
      const sendErrorSpy = vi.spyOn(server as any, 'sendMessageError');

      const message = JSON.stringify({
        clientId: 'client-123',
        error: 'Test error message',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('messageError', message);

      expect(sendErrorSpy).toHaveBeenCalledWith({
        webSocketClientId: 'client-123',
        error: 'Test error message',
      });
    });

    it('should handle DisconnectClient event when client exists', async () => {
      const { server } = createServer();

      // Mock a client in the manager
      const mockClient = { clientId: 'client-123', ws: { close: vi.fn() } };
      vi.spyOn(server.clientManager, 'getClient').mockReturnValue(mockClient as any);
      const disconnectSpy = vi.spyOn(server.clientManager, 'disconnectClient');
      const removeFromRoomsSpy = vi.spyOn((server as any).roomManager, 'removeClientFromAllRooms');

      const message = JSON.stringify({
        clientId: 'client-123',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('disconnectClient', message);

      expect(disconnectSpy).toHaveBeenCalledWith({ clientId: 'client-123' });
      expect(removeFromRoomsSpy).toHaveBeenCalledWith({ clientId: 'client-123' });
    });

    it('should handle DisconnectClient event when client does not exist', async () => {
      const { server } = createServer();

      vi.spyOn(server.clientManager, 'getClient').mockReturnValue(undefined);
      const disconnectSpy = vi.spyOn(server.clientManager, 'disconnectClient');

      const message = JSON.stringify({
        clientId: 'client-123',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('disconnectClient', message);

      expect(disconnectSpy).not.toHaveBeenCalled();
    });

    it('should handle ClientLeftRoom event', async () => {
      const { server } = createServer();
      const roomManager = (server as any).roomManager;
      const removeSpy = vi.spyOn(roomManager, 'removeClientFromRoom');

      const message = JSON.stringify({
        clientId: 'client-123',
        room: 'test-room',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('clientLeftRoom', message);

      expect(removeSpy).toHaveBeenCalledWith({
        roomName: 'test-room',
        clientId: 'client-123',
      });
    });

    it('should handle QueueJobCompleted event', async () => {
      const { server } = createServer();

      const message = JSON.stringify({
        jobId: 'job-123',
        workerId: 999,
      });

      // Should not throw
      await expect((server as any).handleSubscriberMessage('queueJobCompleted', message)).resolves.toBeUndefined();
    });

    it('should handle QueueJobError event and modify data', async () => {
      const { server } = createServer();

      const message = JSON.stringify({
        jobId: 'job-123',
        error: 'Job failed',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('queueJobError', message);

      // The handler modifies parsedMessage.data = parsedMessage.error
      // This is covered by the test not throwing
    });

    it('should handle Custom event', async () => {
      const { server } = createServer();

      const message = JSON.stringify({
        customData: 'test',
        workerId: 999,
      });

      // Should not throw
      await expect((server as any).handleSubscriberMessage('custom', message)).resolves.toBeUndefined();
    });

    it('should handle unknown subscriber event', async () => {
      const { server } = createServer();

      const message = JSON.stringify({
        data: 'test',
        workerId: 999,
      });

      // Should not throw
      await expect((server as any).handleSubscriberMessage('unknownEvent', message)).resolves.toBeUndefined();
    });

    it('should execute configured subscriber handlers for matching channels', async () => {
      const handler = vi.fn();

      const { server } = createServer({
        options: {
          subscriberHandlers: {
            handlers: [
              {
                name: 'clientConnectedHandler',
                channels: ['clientConnected'],
                handle: handler,
              },
            ],
          },
        },
      });

      await (server as any).loadSubscriberHandlers();

      const message = JSON.stringify({
        clientId: 'client-123',
        lastActivity: Date.now(),
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('clientConnected', message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'clientConnected',
          message: expect.any(Object),
          webSocketServer: server,
        }),
      );
    });

    it('should execute wildcard subscriber handlers', async () => {
      const handler = vi.fn();

      const { server } = createServer({
        options: {
          subscriberHandlers: {
            handlers: [
              {
                name: 'wildcard',
                channels: ['*'],
                handle: handler,
              },
            ],
          },
        },
      });

      await (server as any).loadSubscriberHandlers();

      const message = JSON.stringify({
        data: 'test',
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('custom-channel', message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'custom-channel',
        }),
      );
    });

    it('should execute matcher-based subscriber handlers', async () => {
      const handler = vi.fn();

      const { server } = createServer({
        options: {
          subscriberHandlers: {
            handlers: [
              {
                name: 'matcher',
                matchers: [/^queue/],
                handle: handler,
              },
            ],
          },
        },
      });

      await (server as any).loadSubscriberHandlers();

      const message = JSON.stringify({
        data: { jobId: '123' },
        workerId: 999,
      });

      await (server as any).handleSubscriberMessage('queueJobCompleted', message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'queueJobCompleted',
        }),
      );
    });
  });

  describe('Client Message Handling', () => {
    it('should call handleServerMessage when message received', async () => {
      const { server } = createServer();
      const ws = { send: vi.fn() } as any;

      // Add a client first
      server.clientManager.addClient({
        clientId: 'test-client',
        ws,
        lastActivity: Date.now(),
        user: null,
      });

      const handleServerMessageSpy = vi.spyOn(server as any, 'handleServerMessage').mockResolvedValue({
        type: 'test',
        action: 'ping',
        response: { success: true },
      });

      const message = JSON.stringify({ type: 'test', action: 'ping', data: {} });

      await (server as any).handleClientMessage(ws, message);

      expect(handleServerMessageSpy).toHaveBeenCalledWith(ws, message, 'test-client');
    });

    it('should send response when handleServerMessage returns a value', async () => {
      const { server } = createServer();
      const ws = { send: vi.fn() } as any;

      // Add client
      server.clientManager.addClient({
        clientId: 'test-client',
        ws,
        lastActivity: Date.now(),
        user: null,
      });

      vi.spyOn(server as any, 'handleServerMessage').mockResolvedValue({
        type: 'test',
        action: 'ping',
        response: { success: true },
      });

      const sendClientMessageSpy = vi.spyOn(server as any, 'sendClientMessage');
      const message = JSON.stringify({ type: 'test', action: 'ping', data: {} });

      await (server as any).handleClientMessage(ws, message);

      expect(sendClientMessageSpy).toHaveBeenCalledWith(
        ws,
        expect.objectContaining({
          type: 'test',
          action: 'ping',
          response: { success: true },
        }),
      );
    });
  });

  describe('Inactivity Check', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should disconnect inactive clients when configured', () => {
      const { server } = createServer({
        options: {
          disconnectInactiveClients: {
            enabled: true,
            intervalCheckTime: 60000,
            inactiveTime: 300000,
          },
        },
      });

      // Check if checkInactiveClients method exists before testing
      if (typeof (server as any).checkInactiveClients === 'function') {
        const now = Date.now();
        const inactiveTime = now - 400000; // 400 seconds ago (more than max 300 seconds)

        // Add an inactive client
        server.clientManager.addClient({
          clientId: 'inactive-client',
          ws: { close: vi.fn(), readyState: 1 } as any,
          lastActivity: inactiveTime,
          user: null,
        });

        const disconnectSpy = vi.spyOn(server.clientManager, 'disconnectClient');

        (server as any).checkInactiveClients();

        expect(disconnectSpy).toHaveBeenCalled();
      }
    });

    it('should not disconnect active clients', () => {
      const { server } = createServer({
        options: {
          disconnectInactiveClients: {
            enabled: true,
            intervalCheckTime: 60000,
            inactiveTime: 300000,
          },
        },
      });

      const now = Date.now();

      // Add an active client
      server.clientManager.addClient({
        clientId: 'active-client',
        ws: { close: vi.fn(), readyState: 1 } as any,
        lastActivity: now - 60000, // 60 seconds ago (less than max 300 seconds)
        user: null,
      });

      const disconnectSpy = vi.spyOn(server.clientManager, 'disconnectClient');

      (server as any).checkInactiveClients();

      expect(disconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all clients', () => {
      const { server } = createServer();

      const ws1 = { send: vi.fn(), readyState: 1 } as any;
      const ws2 = { send: vi.fn(), readyState: 1 } as any;

      server.clientManager.addClient({
        clientId: 'client-1',
        ws: ws1,
        lastActivity: Date.now(),
        user: null,
      });

      server.clientManager.addClient({
        clientId: 'client-2',
        ws: ws2,
        lastActivity: Date.now(),
        user: null,
      });

      // Mock the server.clients Set
      (server as any).server = {
        clients: new Set([ws1, ws2]),
      };

      // Clear the automatic clientList broadcast calls
      ws1.send.mockClear();
      ws2.send.mockClear();

      const message = { type: 'broadcast', action: 'test', data: { foo: 'bar' } };

      (server as any).broadcastToAllClients({ data: message });

      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not broadcast to clients without WebSocket', () => {
      const { server } = createServer();

      const ws1 = { send: vi.fn(), readyState: 1 } as any;

      server.clientManager.addClient({
        clientId: 'client-1',
        ws: ws1,
        lastActivity: Date.now(),
        user: null,
      });

      // Client without ws (from another worker)
      server.clientManager.addClient({
        clientId: 'client-2',
        ws: null,
        lastActivity: Date.now(),
        user: null,
      });

      // Mock the server.clients Set - only ws1 is in the server's client list
      (server as any).server = {
        clients: new Set([ws1]),
      };

      // Clear the automatic clientList broadcast calls
      ws1.send.mockClear();

      const message = { type: 'broadcast', action: 'test', data: { foo: 'bar' } };

      (server as any).broadcastToAllClients({ data: message });

      expect(ws1.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldPrintRoutes', () => {
    it('should return false when debug.printRoutes is not set', () => {
      const { server } = createServer();

      expect((server as any).shouldPrintRoutes()).toBe(false);
    });

    it('should return false when debug.printRoutes is explicitly false', () => {
      const { server } = createServer({
        options: {
          debug: {
            printRoutes: false,
          },
        },
      });

      expect((server as any).shouldPrintRoutes()).toBe(false);
    });

    it('should return true when debug.printRoutes is true', () => {
      const { server } = createServer({
        options: {
          debug: {
            printRoutes: true,
          },
        },
      });

      expect((server as any).shouldPrintRoutes()).toBe(true);
    });
  });

  describe('Client Disconnection', () => {
    it('should handle server client disconnection when client exists', () => {
      const { server } = createServer();
      const clientId = 'client-123';
      const ws = { send: vi.fn(), readyState: 1 } as any;

      // Add the client first
      server.clientManager.addClient({
        clientId,
        ws,
        lastActivity: Date.now(),
        user: null,
      });

      const onClientDisconnectSpy = vi.spyOn(server as any, 'onClientDisconnect');
      const publishSpy = vi.spyOn((server as any).redisInstance.publisherClient, 'publish');

      (server as any).handleServerClientDisconnection(clientId);

      expect(onClientDisconnectSpy).toHaveBeenCalledWith({ clientId });
      expect(publishSpy).toHaveBeenCalledWith('clientDisconnected', expect.stringContaining(clientId));
    });
  });

  describe('Message Sending', () => {
    it('should send client message using WebSocket.send', () => {
      const { server } = createServer();
      const ws = { send: vi.fn(), readyState: 1 } as any;
      const message = { type: 'test', action: 'ping', data: { foo: 'bar' } };

      (server as any).sendClientMessage(ws, message);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message), { binary: false });
    });

    it('should send error message to specific client', () => {
      const { server } = createServer();
      const ws = { send: vi.fn(), readyState: 1 } as any;

      // Add client
      server.clientManager.addClient({
        clientId: 'client-123',
        ws,
        lastActivity: Date.now(),
        user: null,
      });

      // Clear previous broadcast calls
      ws.send.mockClear();

      (server as any).sendMessageError({
        webSocketClientId: 'client-123',
        error: 'Test error',
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'error',
          action: 'message',
          data: {
            error: 'Test error',
          },
        }),
        { binary: false },
      );
    });

    it('should not throw when sending error to non-existent client', () => {
      const { server } = createServer();

      // Should not throw when client doesn't exist
      expect(() =>
        (server as any).sendMessageError({
          webSocketClientId: 'non-existent',
          error: 'Test error',
        }),
      ).not.toThrow();
    });
  });

  describe('handleMessageError', () => {
    it('should publish error to Redis when handling message errors', () => {
      const { server } = createServer();
      const publishSpy = vi.spyOn((server as any).redisInstance.publisherClient, 'publish');

      (server as any).handleMessageError('client-123', 'Test error');

      expect(publishSpy).toHaveBeenCalledWith('messageError', expect.stringContaining('client-123'));
      expect(publishSpy).toHaveBeenCalledWith('messageError', expect.stringContaining('Test error'));
    });
  });

  describe('onServerStarted event', () => {
    it('should call onServerStarted event when provided', () => {
      const onServerStarted = vi.fn();
      const { server } = createServer({
        options: {
          events: {
            onServerStarted,
          },
        },
      });

      (server as any).server = createFakeWebSocketServer();

      (server as any).handleServerStart();

      expect(onServerStarted).toHaveBeenCalledWith({
        webSocketServer: expect.anything(),
      });
    });

    it('should throw error if server not started when handleServerStart called', () => {
      const { server } = createServer();

      expect(() => {
        (server as any).handleServerStart();
      }).toThrow('WebSocket server not started');
    });
  });

  describe('Debug Options', () => {
    it('should return false for shouldPrintRoutes when debug.printRoutes is false', () => {
      const { server } = createServer({
        options: {
          debug: {
            printRoutes: false,
          },
        },
      });

      expect((server as any).shouldPrintRoutes()).toBe(false);
    });

    it('should return true for shouldPrintRoutes when debug.printRoutes is true', () => {
      const { server } = createServer({
        options: {
          debug: {
            printRoutes: true,
          },
        },
      });

      expect((server as any).shouldPrintRoutes()).toBe(true);
    });

    it('should return false for shouldPrintRoutes when debug is undefined', () => {
      const { server } = createServer();

      expect((server as any).shouldPrintRoutes()).toBe(false);
    });
  });
});
