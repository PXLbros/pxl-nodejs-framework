import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WebSocketPerformanceWrapper,
  MonitorWebSocketOperation,
} from '../../../src/performance/websocket-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

describe('WebSocketPerformanceWrapper', () => {
  let mockPerformanceMonitor: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPerformanceMonitor = {
      measureAsync: vi.fn(async ({ fn }) => await fn()),
    };

    WebSocketPerformanceWrapper.setPerformanceMonitor(mockPerformanceMonitor);
  });

  describe('setPerformanceMonitor', () => {
    it('should set custom performance monitor', async () => {
      const customMonitor = {
        measureAsync: vi.fn(async ({ fn }) => await fn()),
      } as any;

      WebSocketPerformanceWrapper.setPerformanceMonitor(customMonitor);

      await WebSocketPerformanceWrapper.monitorMessageHandling('test', async () => 'result');

      expect(customMonitor.measureAsync).toHaveBeenCalled();
    });
  });

  describe('monitorMessageHandling', () => {
    it('should monitor message handling with basic metadata', async () => {
      const operation = vi.fn(async () => 'message-handled');
      const result = await WebSocketPerformanceWrapper.monitorMessageHandling('chat', operation);

      expect(result).toBe('message-handled');
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'message.chat',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'message_handling',
          messageType: 'chat',
        },
      });
    });

    it('should include additional metadata', async () => {
      const operation = vi.fn(async () => 'handled');
      await WebSocketPerformanceWrapper.monitorMessageHandling('notification', operation, {
        messageSize: 1024,
        clientId: 'client-123',
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            messageSize: 1024,
            clientId: 'client-123',
          }),
        }),
      );
    });
  });

  describe('monitorConnection', () => {
    it('should monitor connection operations', async () => {
      const operation = vi.fn(async () => 'connected');
      const result = await WebSocketPerformanceWrapper.monitorConnection('connect', operation);

      expect(result).toBe('connected');
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'connection.connect',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'connect',
        },
      });
    });

    it('should monitor disconnect with client metadata', async () => {
      const operation = vi.fn(async () => undefined);
      await WebSocketPerformanceWrapper.monitorConnection('disconnect', operation, {
        clientId: 'client-456',
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'connection.disconnect',
          metadata: expect.objectContaining({
            clientId: 'client-456',
          }),
        }),
      );
    });
  });

  describe('monitorRoomOperation', () => {
    it('should monitor room join operations', async () => {
      const operation = vi.fn(async () => true);
      const result = await WebSocketPerformanceWrapper.monitorRoomOperation('join', 'lobby', operation);

      expect(result).toBe(true);
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'room.join',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'join',
          room: 'lobby',
        },
      });
    });

    it('should monitor room leave with additional metadata', async () => {
      const operation = vi.fn(async () => false);
      await WebSocketPerformanceWrapper.monitorRoomOperation('leave', 'game-room', operation, {
        clientId: 'player-1',
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            room: 'game-room',
            clientId: 'player-1',
          }),
        }),
      );
    });
  });

  describe('monitorBroadcast', () => {
    it('should monitor broadcast operations', async () => {
      const operation = vi.fn(async () => ({ sent: 10 }));
      const result = await WebSocketPerformanceWrapper.monitorBroadcast('announcement', operation);

      expect(result).toEqual({ sent: 10 });
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'broadcast.announcement',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'broadcast',
          messageType: 'announcement',
        },
      });
    });

    it('should include message size in broadcast metadata', async () => {
      const operation = vi.fn(async () => null);
      await WebSocketPerformanceWrapper.monitorBroadcast('update', operation, {
        messageSize: 2048,
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            messageSize: 2048,
          }),
        }),
      );
    });
  });

  describe('monitorAuthentication', () => {
    it('should monitor authentication operations', async () => {
      const operation = vi.fn(async () => ({ authenticated: true }));
      const result = await WebSocketPerformanceWrapper.monitorAuthentication(operation);

      expect(result).toEqual({ authenticated: true });
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'authentication',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'authentication',
        },
      });
    });

    it('should monitor failed authentication with error', async () => {
      const operation = vi.fn(async () => ({ authenticated: false }));
      await WebSocketPerformanceWrapper.monitorAuthentication(operation, {
        error: 'Invalid token',
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            error: 'Invalid token',
          }),
        }),
      );
    });
  });

  describe('monitorControllerMethod', () => {
    it('should monitor controller method execution', async () => {
      const operation = vi.fn(async () => 'method-result');
      const result = await WebSocketPerformanceWrapper.monitorControllerMethod(
        'ChatController',
        'sendMessage',
        operation,
      );

      expect(result).toBe('method-result');
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith({
        name: 'ChatController.sendMessage',
        type: 'websocket',
        fn: operation,
        metadata: {
          operation: 'controller_method',
        },
      });
    });

    it('should monitor with full metadata', async () => {
      const operation = vi.fn(async () => null);
      await WebSocketPerformanceWrapper.monitorControllerMethod('GameController', 'makeMove', operation, {
        room: 'game-123',
        clientId: 'player-1',
      });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            room: 'game-123',
            clientId: 'player-1',
          }),
        }),
      );
    });
  });

  describe('MonitorWebSocketOperation decorator', () => {
    it('should decorate method with default operation name', async () => {
      class TestController {
        @MonitorWebSocketOperation()
        async testMethod(arg1: string): Promise<string> {
          return `processed-${arg1}`;
        }
      }

      const controller = new TestController();
      const result = await controller.testMethod('data');

      expect(result).toBe('processed-data');
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestController.testMethod',
          type: 'websocket',
          metadata: expect.objectContaining({
            argumentCount: 1,
          }),
        }),
      );
    });

    it('should decorate method with custom operation name', async () => {
      class CustomController {
        @MonitorWebSocketOperation('customOp')
        async handleEvent(data: any): Promise<void> {
          // Handle event
        }
      }

      const controller = new CustomController();
      await controller.handleEvent({ test: true });

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CustomController.customOp',
        }),
      );
    });

    it('should preserve method context and arguments', async () => {
      class ContextController {
        private prefix = 'prefix';

        @MonitorWebSocketOperation()
        async process(value: string): Promise<string> {
          return `${this.prefix}-${value}`;
        }
      }

      const controller = new ContextController();
      const result = await controller.process('test');

      expect(result).toBe('prefix-test');
    });

    it('should handle multiple arguments', async () => {
      class MultiArgController {
        @MonitorWebSocketOperation()
        async combine(a: string, b: number, c: boolean): Promise<string> {
          return `${a}-${b}-${c}`;
        }
      }

      const controller = new MultiArgController();
      await controller.combine('test', 42, true);

      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            argumentCount: 3,
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate errors from monitored operations', async () => {
      const error = new Error('Operation failed');
      const operation = vi.fn(async () => {
        throw error;
      });

      mockPerformanceMonitor.measureAsync = vi.fn(async ({ fn }) => await fn());

      await expect(WebSocketPerformanceWrapper.monitorMessageHandling('test', operation)).rejects.toThrow(
        'Operation failed',
      );
    });
  });

  describe('default performance monitor', () => {
    it('should use singleton instance when no monitor is set', async () => {
      // Create a new wrapper without setting a monitor
      const getSpy = vi.spyOn(PerformanceMonitor, 'getInstance');

      // Reset to default state
      (WebSocketPerformanceWrapper as any).performanceMonitor = undefined;

      const operation = vi.fn(async () => 'result');
      await WebSocketPerformanceWrapper.monitorMessageHandling('test', operation);

      expect(getSpy).toHaveBeenCalled();
    });
  });
});
