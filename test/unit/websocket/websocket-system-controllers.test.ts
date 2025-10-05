import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import SystemServerController from '../../../src/websocket/controllers/server/system.js';
import SystemClientController from '../../../src/websocket/controllers/client/system.js';
import { Logger } from '../../../src/logger/index.js';

// Mock Logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('WebSocket System Controllers', () => {
  describe('SystemServerController', () => {
    let controller: SystemServerController;
    let mockWebSocketServer: any;
    let mockClientWebSocket: WebSocket;
    const testClientId = 'test-client-123';

    beforeEach(() => {
      vi.clearAllMocks();

      // Mock WebSocket
      mockClientWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      } as any;

      // Mock WebSocketServer
      mockWebSocketServer = {
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        sendToClient: vi.fn(),
        broadcastToRoom: vi.fn(),
      };

      // Create controller instance with required dependencies
      controller = new SystemServerController({
        webSocketServer: mockWebSocketServer,
        redisInstance: {} as any,
        queueManager: {} as any,
        databaseInstance: {} as any,
      });
    });

    describe('joinRoom', () => {
      it('should successfully join a room with all parameters', () => {
        const data = {
          userId: 'user-456',
          userType: 'admin',
          username: 'testuser',
          roomName: 'test-room',
        };

        const result = controller.joinRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Successfully joined room: test-room');
        expect(result.data.userId).toBe('user-456');
        expect(result.data.userType).toBe('admin');
        expect(result.data.username).toBe('testuser');
        expect(result.data.roomName).toBe('test-room');
        expect(result.data.joinedAt).toBeDefined();

        expect(mockWebSocketServer.joinRoom).toHaveBeenCalledWith({
          ws: mockClientWebSocket,
          userId: 'user-456',
          userType: 'admin',
          username: 'testuser',
          roomName: 'test-room',
        });
      });

      it('should use default values when optional parameters are missing', () => {
        const data = {
          roomName: 'test-room',
        };

        const result = controller.joinRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(true);
        expect(result.data.userId).toBe(testClientId);
        expect(result.data.userType).toBe('user');
        expect(result.data.username).toBe(`user_${testClientId.substring(0, 8)}`);
        expect(result.data.roomName).toBe('test-room');
      });

      it('should return error when roomName is missing', () => {
        const data = {};

        const result = controller.joinRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Room name is required');
        expect(result.clientId).toBe(testClientId);
        expect(mockWebSocketServer.joinRoom).not.toHaveBeenCalled();
      });

      it('should handle errors from joinRoom operation', () => {
        const data = {
          roomName: 'test-room',
        };

        const error = new Error('Room is full');
        mockWebSocketServer.joinRoom.mockImplementation(() => {
          throw error;
        });

        const result = controller.joinRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to join room');
        expect(result.message).toBe('Room is full');
        expect(result.clientId).toBe(testClientId);
        expect(Logger.error).toHaveBeenCalled();
      });

      it('should handle non-Error exceptions', () => {
        const data = {
          roomName: 'test-room',
        };

        mockWebSocketServer.joinRoom.mockImplementation(() => {
          throw 'String error';
        });

        const result = controller.joinRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to join room');
        expect(result.message).toBe('Unknown error');
      });
    });

    describe('leaveRoom', () => {
      it('should successfully leave a room', () => {
        const data = {
          roomName: 'test-room',
        };

        const result = controller.leaveRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Successfully left room: test-room');
        expect(result.data.roomName).toBe('test-room');
        expect(result.data.leftAt).toBeDefined();
        expect(result.clientId).toBe(testClientId);

        expect(mockWebSocketServer.leaveRoom).toHaveBeenCalledWith({
          ws: mockClientWebSocket,
          roomName: 'test-room',
        });
      });

      it('should return error when roomName is missing', () => {
        const data = {};

        const result = controller.leaveRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Room name is required');
        expect(result.clientId).toBe(testClientId);
        expect(mockWebSocketServer.leaveRoom).not.toHaveBeenCalled();
      });

      it('should handle errors from leaveRoom operation', () => {
        const data = {
          roomName: 'test-room',
        };

        const error = new Error('Room not found');
        mockWebSocketServer.leaveRoom.mockImplementation(() => {
          throw error;
        });

        const result = controller.leaveRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to leave room');
        expect(result.message).toBe('Room not found');
        expect(result.clientId).toBe(testClientId);
        expect(Logger.error).toHaveBeenCalled();
      });

      it('should handle non-Error exceptions when leaving room', () => {
        const data = {
          roomName: 'test-room',
        };

        mockWebSocketServer.leaveRoom.mockImplementation(() => {
          throw 'String error';
        });

        const result = controller.leaveRoom(mockClientWebSocket, testClientId, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to leave room');
        expect(result.message).toBe('Unknown error');
      });
    });
  });

  describe('SystemClientController', () => {
    let controller: SystemClientController;
    let mockClientWebSocket: WebSocket;
    const testClientId = 'test-client-123';

    beforeEach(() => {
      mockClientWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      } as any;

      controller = new SystemClientController({
        sendMessage: vi.fn(),
        redisInstance: {} as any,
        queueManager: {} as any,
        databaseInstance: {} as any,
      });
    });

    describe('clientList', () => {
      it('should handle clientList event without errors', () => {
        const data = { clients: ['client1', 'client2'] };

        // Should not throw
        expect(() => {
          controller.clientList(mockClientWebSocket, testClientId, data);
        }).not.toThrow();
      });

      it('should handle clientList with undefined data', () => {
        expect(() => {
          controller.clientList(mockClientWebSocket, testClientId, undefined);
        }).not.toThrow();
      });

      it('should handle clientList with null data', () => {
        expect(() => {
          controller.clientList(mockClientWebSocket, testClientId, null);
        }).not.toThrow();
      });
    });
  });
});
