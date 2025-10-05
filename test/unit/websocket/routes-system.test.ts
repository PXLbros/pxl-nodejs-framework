import { describe, it, expect } from 'vitest';
import { webSocketSystemClientRoutes as clientRoutes } from '../../../src/websocket/routes/client/system.js';
import { webSocketSystemClientRoutes as serverRoutes } from '../../../src/websocket/routes/server/system.js';

describe('WebSocket System Routes', () => {
  describe('Client Routes', () => {
    it('should export client system routes array', () => {
      expect(Array.isArray(clientRoutes)).toBe(true);
    });

    it('should include clientList route', () => {
      const clientListRoute = clientRoutes.find(r => r.action === 'clientList');
      expect(clientListRoute).toBeDefined();
      expect(clientListRoute?.type).toBe('system');
      expect(clientListRoute?.controllerName).toBe('system');
    });

    it('should have exactly 1 route', () => {
      expect(clientRoutes).toHaveLength(1);
    });
  });

  describe('Server Routes', () => {
    it('should export server system routes array', () => {
      expect(Array.isArray(serverRoutes)).toBe(true);
    });

    it('should include joinRoom route', () => {
      const joinRoomRoute = serverRoutes.find(r => r.action === 'joinRoom');
      expect(joinRoomRoute).toBeDefined();
      expect(joinRoomRoute?.type).toBe('system');
      expect(joinRoomRoute?.controllerName).toBe('system');
    });

    it('should include leaveRoom route', () => {
      const leaveRoomRoute = serverRoutes.find(r => r.action === 'leaveRoom');
      expect(leaveRoomRoute).toBeDefined();
      expect(leaveRoomRoute?.type).toBe('system');
      expect(leaveRoomRoute?.controllerName).toBe('system');
    });

    it('should have exactly 2 routes', () => {
      expect(serverRoutes).toHaveLength(2);
    });

    it('should have all routes with correct structure', () => {
      serverRoutes.forEach(route => {
        expect(route).toHaveProperty('type');
        expect(route).toHaveProperty('action');
        expect(route).toHaveProperty('controllerName');
      });
    });
  });
});
