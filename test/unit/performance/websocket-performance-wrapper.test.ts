import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WebSocketPerformanceWrapper,
  MonitorWebSocketOperation,
} from '../../../src/performance/websocket-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

describe('WebSocketPerformanceWrapper', () => {
  let mockMonitor: PerformanceMonitor;

  beforeEach(() => {
    mockMonitor = {
      measureAsync: vi.fn().mockImplementation(async ({ fn }) => fn()),
    } as any;

    WebSocketPerformanceWrapper.setPerformanceMonitor(mockMonitor);
  });

  describe('setPerformanceMonitor', () => {
    it('should set the performance monitor', () => {
      const newMonitor = {} as PerformanceMonitor;
      WebSocketPerformanceWrapper.setPerformanceMonitor(newMonitor);
      expect(WebSocketPerformanceWrapper['performanceMonitor']).toBe(newMonitor);
    });
  });

  describe('monitorMessageHandling', () => {
    it('should monitor message handling with metadata', async () => {
      const operation = vi.fn().mockResolvedValue({ processed: true });

      await WebSocketPerformanceWrapper.monitorMessageHandling('chatMessage', operation, {
        clientId: 'client123',
        messageSize: 1024,
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'message.chatMessage',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'message_handling',
            messageType: 'chatMessage',
            clientId: 'client123',
            messageSize: 1024,
          }),
        }),
      );
    });
  });

  describe('monitorConnection', () => {
    it('should monitor connection operations', async () => {
      const operation = vi.fn().mockResolvedValue({ connected: true });

      await WebSocketPerformanceWrapper.monitorConnection('connect', operation, {
        clientId: 'client456',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'connection.connect',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'connect',
            clientId: 'client456',
          }),
        }),
      );
    });

    it('should monitor disconnect operations', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await WebSocketPerformanceWrapper.monitorConnection('disconnect', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'connection.disconnect',
          type: 'websocket',
        }),
      );
    });
  });

  describe('monitorRoomOperation', () => {
    it('should monitor room join operation', async () => {
      const operation = vi.fn().mockResolvedValue({ joined: true });

      await WebSocketPerformanceWrapper.monitorRoomOperation('join', 'room-123', operation, {
        clientId: 'client789',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'room.join',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'join',
            room: 'room-123',
            clientId: 'client789',
          }),
        }),
      );
    });

    it('should monitor room leave operation', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await WebSocketPerformanceWrapper.monitorRoomOperation('leave', 'room-456', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'room.leave',
          type: 'websocket',
          metadata: expect.objectContaining({
            room: 'room-456',
          }),
        }),
      );
    });
  });

  describe('monitorBroadcast', () => {
    it('should monitor broadcast operations', async () => {
      const operation = vi.fn().mockResolvedValue({ sent: 100 });

      await WebSocketPerformanceWrapper.monitorBroadcast('announcement', operation, {
        room: 'global',
        messageSize: 512,
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'broadcast.announcement',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'broadcast',
            messageType: 'announcement',
            room: 'global',
            messageSize: 512,
          }),
        }),
      );
    });
  });

  describe('monitorAuthentication', () => {
    it('should monitor authentication operations', async () => {
      const operation = vi.fn().mockResolvedValue({ authenticated: true, userId: 123 });

      await WebSocketPerformanceWrapper.monitorAuthentication(operation, {
        clientId: 'client999',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'authentication',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'authentication',
            clientId: 'client999',
          }),
        }),
      );
    });
  });

  describe('monitorControllerMethod', () => {
    it('should monitor controller method execution', async () => {
      const operation = vi.fn().mockResolvedValue({ result: 'success' });

      await WebSocketPerformanceWrapper.monitorControllerMethod('ChatController', 'sendMessage', operation, {
        argumentCount: 2,
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ChatController.sendMessage',
          type: 'websocket',
          metadata: expect.objectContaining({
            operation: 'controller_method',
            argumentCount: 2,
          }),
        }),
      );
    });
  });

  describe('MonitorWebSocketOperation decorator', () => {
    it('should monitor decorated controller method', async () => {
      class ChatController {
        @MonitorWebSocketOperation('handleMessage')
        async onMessage(data: any, clientId: string) {
          return { processed: true, data, clientId };
        }
      }

      const controller = new ChatController();
      const result = await controller.onMessage({ text: 'hello' }, 'client123');

      expect(result).toEqual({
        processed: true,
        data: { text: 'hello' },
        clientId: 'client123',
      });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ChatController.handleMessage',
          metadata: expect.objectContaining({
            operation: 'controller_method',
            argumentCount: 2,
          }),
        }),
      );
    });

    it('should use method name when operation name not specified', async () => {
      class NotificationController {
        @MonitorWebSocketOperation()
        async broadcastAlert(message: string) {
          return { sent: true };
        }
      }

      const controller = new NotificationController();
      await controller.broadcastAlert('test alert');

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NotificationController.broadcastAlert',
        }),
      );
    });
  });
});
