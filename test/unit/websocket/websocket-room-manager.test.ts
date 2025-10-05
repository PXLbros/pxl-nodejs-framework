import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocketRoomManager from '../../../src/websocket/websocket-room-manager.js';
import WebSocketClientManager from '../../../src/websocket/websocket-client-manager.js';
import * as websocketUtils from '../../../src/websocket/utils.js';

describe('WebSocketRoomManager', () => {
  let roomManager: WebSocketRoomManager;
  let clientManager: WebSocketClientManager;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    roomManager = new WebSocketRoomManager({ clientManager });
    logSpy = vi.spyOn(websocketUtils, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should initialize with empty rooms', () => {
      expect(roomManager.rooms).toBeInstanceOf(Map);
      expect(roomManager.rooms.size).toBe(0);
    });

    it('should store client manager reference', () => {
      expect((roomManager as any).clientManager).toBe(clientManager);
    });
  });

  describe('addClientToRoom', () => {
    it('should create room and add client when room does not exist', () => {
      const updateClientSpy = vi.spyOn(clientManager, 'updateClient');
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);
      const printRoomsSpy = vi.spyOn(roomManager, 'printRooms').mockImplementation(() => undefined);

      const user = { userId: '123', username: 'testuser', email: 'test@example.com' };

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user,
        roomName: 'test-room',
      });

      expect(roomManager.rooms.has('test-room')).toBe(true);
      expect(roomManager.rooms.get('test-room')?.has('client-1')).toBe(true);
      expect(updateClientSpy).toHaveBeenCalledWith({
        clientId: 'client-1',
        key: 'roomName',
        data: 'test-room',
      });
      expect(broadcastSpy).toHaveBeenCalledWith('clientAddedToRoom');
      expect(printRoomsSpy).toHaveBeenCalled();
    });

    it('should add client to existing room', () => {
      const user1 = { userId: '123', username: 'user1' };
      const user2 = { userId: '456', username: 'user2' };

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: user1,
        roomName: 'test-room',
      });

      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: user2,
        roomName: 'test-room',
      });

      const room = roomManager.rooms.get('test-room');
      expect(room?.size).toBe(2);
      expect(room?.has('client-1')).toBe(true);
      expect(room?.has('client-2')).toBe(true);
    });

    it('should not broadcast when broadcast is false', () => {
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('should handle user without userType', () => {
      const user = { username: 'testuser', email: 'test@example.com' };

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user,
        roomName: 'test-room',
      });

      expect(roomManager.rooms.get('test-room')?.has('client-1')).toBe(true);
    });

    it('should handle user without email', () => {
      const user = { username: 'testuser', userType: 'admin' };

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user,
        roomName: 'test-room',
      });

      expect(roomManager.rooms.get('test-room')?.has('client-1')).toBe(true);
    });
  });

  describe('removeClientFromRoom', () => {
    beforeEach(() => {
      // Setup a room with a client
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });
    });

    it('should remove client from room', () => {
      const updateClientSpy = vi.spyOn(clientManager, 'updateClient');
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);
      const printRoomsSpy = vi.spyOn(roomManager, 'printRooms').mockImplementation(() => undefined);

      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-1',
      });

      expect(roomManager.rooms.has('test-room')).toBe(false);
      expect(updateClientSpy).toHaveBeenCalledWith({
        clientId: 'client-1',
        key: 'roomName',
        data: null,
      });
      expect(broadcastSpy).toHaveBeenCalledWith('clientRemovedFromRoom');
      expect(printRoomsSpy).toHaveBeenCalled();
    });

    it('should delete room when last client is removed', () => {
      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-1',
      });

      expect(roomManager.rooms.has('test-room')).toBe(false);
    });

    it('should keep room when other clients remain', () => {
      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: { username: 'test2' },
        roomName: 'test-room',
        broadcast: false,
      });

      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-1',
        broadcast: false,
      });

      expect(roomManager.rooms.has('test-room')).toBe(true);
      expect(roomManager.rooms.get('test-room')?.size).toBe(1);
      expect(roomManager.rooms.get('test-room')?.has('client-2')).toBe(true);
    });

    it('should handle removing client from non-existent room', () => {
      roomManager.removeClientFromRoom({
        roomName: 'non-existent-room',
        clientId: 'client-1',
      });

      // Should not throw
      expect(roomManager.rooms.has('non-existent-room')).toBe(false);
    });

    it('should not broadcast when broadcast is false', () => {
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);

      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-1',
        broadcast: false,
      });

      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });

  describe('removeClientFromAllRooms', () => {
    beforeEach(() => {
      // Setup multiple rooms with same client
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'room-1',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'room-2',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: { username: 'test2' },
        roomName: 'room-1',
        broadcast: false,
      });
    });

    it('should remove client from all rooms they are in', () => {
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);

      roomManager.removeClientFromAllRooms({ clientId: 'client-1' });

      // client-1 should be removed from both rooms
      expect(roomManager.rooms.get('room-1')?.has('client-1')).toBe(false);
      expect(roomManager.rooms.has('room-2')).toBe(false); // room-2 deleted (was empty)

      // client-2 should still be in room-1
      expect(roomManager.rooms.get('room-1')?.has('client-2')).toBe(true);

      expect(broadcastSpy).toHaveBeenCalledWith('clientRemovedFromAllRooms');
    });

    it('should handle client not in any room', () => {
      const broadcastSpy = vi.spyOn(clientManager, 'broadcastClientList').mockImplementation(() => undefined);

      roomManager.removeClientFromAllRooms({ clientId: 'non-existent-client' });

      // Should not throw
      expect(broadcastSpy).toHaveBeenCalledWith('clientRemovedFromAllRooms');
    });

    it('should print rooms after removal', () => {
      const printRoomsSpy = vi.spyOn(roomManager, 'printRooms').mockImplementation(() => undefined);

      roomManager.removeClientFromAllRooms({ clientId: 'client-1' });

      expect(printRoomsSpy).toHaveBeenCalled();
    });
  });

  describe('isClientInRoom', () => {
    beforeEach(() => {
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });
    });

    it('should return true when client is in room', () => {
      expect(roomManager.isClientInRoom({ clientId: 'client-1', roomName: 'test-room' })).toBe(true);
    });

    it('should return false when client is not in room', () => {
      expect(roomManager.isClientInRoom({ clientId: 'client-2', roomName: 'test-room' })).toBe(false);
    });

    it('should return false when room does not exist', () => {
      expect(roomManager.isClientInRoom({ clientId: 'client-1', roomName: 'non-existent-room' })).toBe(false);
    });
  });

  describe('getRoomClients', () => {
    beforeEach(() => {
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test1' },
        roomName: 'test-room',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: { username: 'test2' },
        roomName: 'test-room',
        broadcast: false,
      });
    });

    it('should return array of client IDs in room', () => {
      const clients = roomManager.getRoomClients({ roomName: 'test-room' });

      expect(Array.isArray(clients)).toBe(true);
      expect(clients).toHaveLength(2);
      expect(clients).toContain('client-1');
      expect(clients).toContain('client-2');
    });

    it('should return empty array for non-existent room', () => {
      const clients = roomManager.getRoomClients({ roomName: 'non-existent-room' });

      expect(Array.isArray(clients)).toBe(true);
      expect(clients).toHaveLength(0);
    });

    it('should return empty array after all clients leave', () => {
      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-1',
        broadcast: false,
      });

      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-2',
        broadcast: false,
      });

      const clients = roomManager.getRoomClients({ roomName: 'test-room' });

      expect(clients).toHaveLength(0);
    });
  });

  describe('printRooms', () => {
    it('should handle printing empty rooms', () => {
      expect(() => roomManager.printRooms()).not.toThrow();
      expect(logSpy).toHaveBeenCalled();
    });

    it('should print single room with single client', () => {
      const getClientSpy = vi.spyOn(clientManager, 'getClient').mockReturnValue({
        clientId: 'client-1',
        user: {
          username: 'testuser',
          userType: 'admin',
          email: 'test@example.com',
        },
      } as any);

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'testuser', userType: 'admin', email: 'test@example.com' },
        roomName: 'test-room',
        broadcast: false,
      });

      logSpy.mockClear();
      roomManager.printRooms();

      expect(logSpy).toHaveBeenCalled();
      const logOutput = logSpy.mock.calls[0][0];
      expect(logOutput).toContain('test-room');
      expect(logOutput).toContain('client-1');

      getClientSpy.mockRestore();
    });

    it('should print multiple rooms with multiple clients', () => {
      const getClientSpy = vi.spyOn(clientManager, 'getClient').mockImplementation(({ clientId }) => {
        return {
          clientId,
          user: {
            username: `user-${clientId}`,
            userType: 'member',
            email: `${clientId}@example.com`,
          },
        } as any;
      });

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'user1' },
        roomName: 'room-1',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: { username: 'user2' },
        roomName: 'room-1',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-3',
        user: { username: 'user3' },
        roomName: 'room-2',
        broadcast: false,
      });

      logSpy.mockClear();
      roomManager.printRooms();

      expect(logSpy).toHaveBeenCalled();
      const logOutput = logSpy.mock.calls[0][0];
      expect(logOutput).toContain('room-1');
      expect(logOutput).toContain('room-2');

      getClientSpy.mockRestore();
    });

    it('should handle clients without user data', () => {
      const getClientSpy = vi.spyOn(clientManager, 'getClient').mockReturnValue({
        clientId: 'client-1',
        user: undefined,
      } as any);

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      expect(() => roomManager.printRooms()).not.toThrow();

      getClientSpy.mockRestore();
    });

    it('should handle clients with partial user data', () => {
      const getClientSpy = vi.spyOn(clientManager, 'getClient').mockReturnValue({
        clientId: 'client-1',
        user: {
          username: 'testuser',
          // Missing userType and email
        },
      } as any);

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'testuser' },
        roomName: 'test-room',
        broadcast: false,
      });

      expect(() => roomManager.printRooms()).not.toThrow();
      expect(logSpy).toHaveBeenCalled();

      getClientSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      // Setup some rooms
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test1' },
        roomName: 'room-1',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-2',
        user: { username: 'test2' },
        roomName: 'room-2',
        broadcast: false,
      });
    });

    it('should clear all rooms', () => {
      expect(roomManager.rooms.size).toBeGreaterThan(0);

      roomManager.cleanup();

      expect(roomManager.rooms.size).toBe(0);
    });

    it('should log cleanup message', () => {
      logSpy.mockClear();

      roomManager.cleanup();

      expect(logSpy).toHaveBeenCalledWith('WebSocket room manager cleaned up');
    });
  });

  describe('Edge Cases', () => {
    it('should handle same client joining same room multiple times', () => {
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      const room = roomManager.rooms.get('test-room');
      // Sets don't allow duplicates
      expect(room?.size).toBe(1);
    });

    it('should handle removing client not in room', () => {
      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      // Try to remove a different client
      roomManager.removeClientFromRoom({
        roomName: 'test-room',
        clientId: 'client-2',
        broadcast: false,
      });

      // Room should still exist with client-1
      expect(roomManager.rooms.get('test-room')?.has('client-1')).toBe(true);
    });

    it('should handle room names with special characters', () => {
      const specialRoomName = 'room:with:special-chars_123';

      roomManager.addClientToRoom({
        clientId: 'client-1',
        user: { username: 'test' },
        roomName: specialRoomName,
        broadcast: false,
      });

      expect(roomManager.rooms.has(specialRoomName)).toBe(true);
      expect(roomManager.isClientInRoom({ clientId: 'client-1', roomName: specialRoomName })).toBe(true);
    });

    it('should handle client IDs with special characters', () => {
      const specialClientId = 'client:abc-123_xyz';

      roomManager.addClientToRoom({
        clientId: specialClientId,
        user: { username: 'test' },
        roomName: 'test-room',
        broadcast: false,
      });

      expect(roomManager.isClientInRoom({ clientId: specialClientId, roomName: 'test-room' })).toBe(true);
    });
  });
});
