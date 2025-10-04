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
});
