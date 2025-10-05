import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

describe('WebSocket Server Controllers', () => {
  describe('WebSocketServerBaseController', () => {
    it('should create base server controller', async () => {
      const WebSocketServerBaseController = (await import('../../../dist/websocket/controller/server/base.js')).default;

      expect(typeof WebSocketServerBaseController).toBe('function');
      expect(WebSocketServerBaseController.name).toBe('WebSocketServerBaseController');
    });

    it('should construct with required dependencies', async () => {
      const WebSocketServerBaseController = (await import('../../../dist/websocket/controller/server/base.js')).default;

      const mockWebSocketServer = {
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        sendToRoom: vi.fn(),
        broadcast: vi.fn(),
      };

      const mockRedis = {
        client: { get: vi.fn(), set: vi.fn() },
      };

      const mockDatabase = {
        getEntityManager: vi.fn(),
      };

      const mockQueue = {
        addJob: vi.fn(),
      };

      const controller = new WebSocketServerBaseController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: mockRedis as any,
        databaseInstance: mockDatabase as any,
        queueManager: mockQueue as any,
      });

      expect(controller).toBeDefined();
      expect(controller.webSocketServer).toBe(mockWebSocketServer);
      expect(controller.redisInstance).toBe(mockRedis);
      expect(controller.databaseInstance).toBe(mockDatabase);
      expect(controller.queueManager).toBe(mockQueue);
    });

    it('should have access to dependencies', async () => {
      const WebSocketServerBaseController = (await import('../../../dist/websocket/controller/server/base.js')).default;

      const mockDeps = {
        webSocketServer: { broadcast: vi.fn() },
        redisInstance: { client: {} },
        databaseInstance: { getEntityManager: vi.fn() },
        queueManager: { addJob: vi.fn() },
      };

      const controller = new WebSocketServerBaseController(mockDeps as any);

      expect(controller.webSocketServer).toBeDefined();
      expect(controller.redisInstance).toBeDefined();
      expect(controller.databaseInstance).toBeDefined();
      expect(controller.queueManager).toBeDefined();
    });
  });

  describe('SystemController (Server)', () => {
    let mockWebSocket: any;
    let mockWebSocketServer: any;

    beforeEach(() => {
      mockWebSocket = new EventEmitter();
      mockWebSocket.send = vi.fn();
      mockWebSocket.close = vi.fn();

      mockWebSocketServer = {
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        sendToRoom: vi.fn(),
        broadcast: vi.fn(),
        clientManager: {
          getClient: vi.fn(),
          getClients: vi.fn(),
        },
      };
    });

    it('should create system controller', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      expect(typeof SystemController).toBe('function');
      expect(SystemController.name).toBe('SystemController');
    });

    it('should handle joinRoom action successfully', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.joinRoom(mockWebSocket, 'client-123', {
        userId: 'user-456',
        userType: 'admin',
        username: 'testuser',
        roomName: 'test-room',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('test-room');
      expect(result.data.roomName).toBe('test-room');
      expect(result.data.userId).toBe('user-456');
      expect(result.data.userType).toBe('admin');
      expect(result.data.username).toBe('testuser');
      expect(result.data.joinedAt).toBeDefined();
      expect(mockWebSocketServer.joinRoom).toHaveBeenCalledWith({
        ws: mockWebSocket,
        userId: 'user-456',
        userType: 'admin',
        username: 'testuser',
        roomName: 'test-room',
      });
    });

    it('should handle joinRoom with default values', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.joinRoom(mockWebSocket, 'client-abc123', {
        roomName: 'default-room',
      });

      expect(result.success).toBe(true);
      expect(result.data.userId).toBe('client-abc123');
      expect(result.data.userType).toBe('user');
      expect(result.data.username).toContain('user_client-a'); // First 8 chars of client ID
      expect(mockWebSocketServer.joinRoom).toHaveBeenCalled();
    });

    it('should return error when roomName is missing in joinRoom', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.joinRoom(mockWebSocket, 'client-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room name is required');
      expect(result.clientId).toBe('client-123');
      expect(mockWebSocketServer.joinRoom).not.toHaveBeenCalled();
    });

    it('should handle joinRoom error gracefully', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      mockWebSocketServer.joinRoom = vi.fn().mockImplementation(() => {
        throw new Error('Failed to join room');
      });

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.joinRoom(mockWebSocket, 'client-123', {
        roomName: 'error-room',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to join room');
      expect(result.message).toContain('Failed to join room');
    });

    it('should handle leaveRoom action successfully', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.leaveRoom(mockWebSocket, 'client-123', {
        roomName: 'test-room',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('test-room');
      expect(result.data.roomName).toBe('test-room');
      expect(result.data.leftAt).toBeDefined();
      expect(mockWebSocketServer.leaveRoom).toHaveBeenCalledWith({
        ws: mockWebSocket,
        roomName: 'test-room',
      });
    });

    it('should return error when roomName is missing in leaveRoom', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.leaveRoom(mockWebSocket, 'client-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room name is required');
      expect(result.clientId).toBe('client-123');
      expect(mockWebSocketServer.leaveRoom).not.toHaveBeenCalled();
    });

    it('should handle leaveRoom error gracefully', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      mockWebSocketServer.leaveRoom = vi.fn().mockImplementation(() => {
        throw new Error('Failed to leave room');
      });

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.leaveRoom(mockWebSocket, 'client-123', {
        roomName: 'error-room',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to leave room');
      expect(result.message).toContain('Failed to leave room');
    });

    it('should include clientId in leaveRoom response', async () => {
      const SystemController = (await import('../../../dist/websocket/controllers/server/system.js')).default;

      const controller = new SystemController({
        webSocketServer: mockWebSocketServer as any,
        redisInstance: {} as any,
        databaseInstance: {} as any,
        queueManager: {} as any,
      });

      const result = controller.leaveRoom(mockWebSocket, 'client-xyz', {
        roomName: 'test-room',
      });

      expect(result.success).toBe(true);
      expect(result.clientId).toBe('client-xyz');
    });
  });
});
