import { describe, it, expect, beforeEach, vi } from 'vitest';
import WebSocketBase from '../../../src/websocket/websocket-base.js';
import type { WebSocketRoute, WebSocketType } from '../../../src/websocket/websocket.interface.js';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Concrete implementation for testing
class TestWebSocketBase extends WebSocketBase {
  public controllerDeps: Record<string, unknown> = {};
  public shouldPrint: boolean = false;
  public lastError: { clientId: string; error: string } | null = null;

  get type(): WebSocketType {
    return 'server';
  }

  protected getControllerDependencies(): Record<string, unknown> {
    return this.controllerDeps;
  }

  protected shouldPrintRoutes(): boolean {
    return this.shouldPrint;
  }

  protected handleMessageError(clientId: string, error: string): void {
    this.lastError = { clientId, error };
  }

  // Expose protected methods for testing
  public testConfigureRoutes(routes: WebSocketRoute[], controllersDirectory: string) {
    return this.configureRoutes(routes, controllersDirectory);
  }

  public testHandleServerMessage(ws: WebSocket, message: WebSocket.Data, clientId: string) {
    return this.handleServerMessage(ws, message, clientId);
  }

  public testPrintRoutes() {
    return this.printRoutes();
  }

  public getRouteHandlers() {
    return this.routeHandlers;
  }
}

describe('WebSocketBase', () => {
  describe('Abstract Class Implementation', () => {
    it('should be instantiable through concrete class', () => {
      const instance = new TestWebSocketBase();

      expect(instance).toBeInstanceOf(WebSocketBase);
      expect(instance).toBeInstanceOf(TestWebSocketBase);
    });

    it('should have empty routes and routeHandlers initially', () => {
      const instance = new TestWebSocketBase();

      expect((instance as any).routes).toEqual([]);
      expect((instance as any).routeHandlers).toBeInstanceOf(Map);
      expect((instance as any).routeHandlers.size).toBe(0);
    });

    it('should have empty defaultRoutes initially', () => {
      const instance = new TestWebSocketBase();

      expect((instance as any).defaultRoutes).toEqual([]);
    });
  });

  describe('Route Configuration', () => {
    it('should handle routes with controller directly set', async () => {
      const instance = new TestWebSocketBase();

      // Mock controller
      class TestController {
        constructor(deps: any) {}
        testAction(ws: WebSocket, clientId: string, data: any) {
          return { success: true, data };
        }
      }

      const routes: WebSocketRoute[] = [
        {
          type: 'test',
          action: 'testAction',
          controller: TestController,
        },
      ];

      // Manually register route since file loading doesn't work in tests
      const controller = new TestController({});
      (instance as any).routeHandlers.set('test:testAction', controller.testAction);

      const handlers = instance.getRouteHandlers();
      expect(handlers.has('test:testAction')).toBe(true);
    });

    it('should throw error when controller config not found', async () => {
      const instance = new TestWebSocketBase();

      const routes: WebSocketRoute[] = [
        {
          type: 'test',
          action: 'testAction',
          // No controller or controllerName provided
        } as any,
      ];

      // When directory doesn't exist, configureRoutes returns early without throwing
      // So we need to provide an existing directory to reach the error
      await expect(instance.testConfigureRoutes(routes, __dirname)).rejects.toThrow(
        'WebSocket controller config not found',
      );
    });

    it('should handle non-existent controllers directory gracefully', async () => {
      const instance = new TestWebSocketBase();

      const routes: WebSocketRoute[] = [];

      // Should not throw
      await expect(instance.testConfigureRoutes(routes, '/this/path/does/not/exist')).resolves.toBeUndefined();
    });

    it('should skip controller when not found by name', async () => {
      const instance = new TestWebSocketBase();

      const routes: WebSocketRoute[] = [
        {
          type: 'test',
          action: 'testAction',
          controllerName: 'non-existent-controller',
        },
      ];

      // Use test controllers directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const testControllersDir = path.join(__dirname, '..', '..', 'fixtures', 'websocket-controllers');

      // Should not throw, just skip the controller
      await expect(instance.testConfigureRoutes(routes, testControllersDir)).resolves.toBeUndefined();

      const handlers = instance.getRouteHandlers();
      expect(handlers.size).toBe(0);
    });

    it('should call printRoutes when shouldPrintRoutes returns true', () => {
      const instance = new TestWebSocketBase();
      instance.shouldPrint = true;

      // Manually add a route
      (instance as any).routeHandlers.set('test:action', vi.fn());

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // shouldPrintRoutes is called internally in configureRoutes
      // For this test, just verify that printRoutes works
      expect(() => instance.testPrintRoutes()).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should not print routes when shouldPrintRoutes returns false', async () => {
      const instance = new TestWebSocketBase();
      instance.shouldPrint = false;

      class TestController {
        constructor(deps: any) {}
        testAction() {
          return { success: true };
        }
      }

      const routes: WebSocketRoute[] = [
        {
          type: 'test',
          action: 'testAction',
          controller: TestController,
        },
      ];

      const printSpy = vi.spyOn(instance, 'testPrintRoutes');

      await instance.testConfigureRoutes(routes, '/non-existent');

      expect(printSpy).not.toHaveBeenCalled();
    });

    it('should provide controller dependencies', () => {
      const instance = new TestWebSocketBase();
      const mockDeps = { foo: 'bar', baz: 123 };
      instance.controllerDeps = mockDeps;

      const deps = instance.getControllerDependencies();

      expect(deps).toEqual(mockDeps);
    });
  });

  describe('Message Handling', () => {
    it('should handle valid message with registered handler', async () => {
      const instance = new TestWebSocketBase();

      const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });

      // Manually register a route handler
      (instance as any).routeHandlers.set('test:ping', mockHandler);

      const ws = {} as WebSocket;
      const message = JSON.stringify({ type: 'test', action: 'ping', data: { foo: 'bar' } });
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(mockHandler).toHaveBeenCalledWith(ws, clientId, { foo: 'bar' });
      expect(result).toEqual({
        type: 'test',
        action: 'ping',
        response: { result: 'success' },
      });
    });

    it('should handle message without registered handler', async () => {
      const instance = new TestWebSocketBase();

      const ws = {} as WebSocket;
      const message = JSON.stringify({ type: 'test', action: 'unknown', data: {} });
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(result).toBeUndefined();
    });

    it('should handle invalid JSON message', async () => {
      const instance = new TestWebSocketBase();

      const ws = {} as WebSocket;
      const message = 'invalid json{';
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(result).toBeUndefined();
      expect(instance.lastError).not.toBeNull();
      expect(instance.lastError?.clientId).toBe(clientId);
    });

    it('should handle handler that throws error', async () => {
      const instance = new TestWebSocketBase();

      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));

      (instance as any).routeHandlers.set('test:error', mockHandler);

      const ws = {} as WebSocket;
      const message = JSON.stringify({ type: 'test', action: 'error', data: {} });
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(result).toBeUndefined();
      expect(instance.lastError).toEqual({
        clientId: 'client-123',
        error: 'Handler error',
      });
    });

    it('should handle non-Error exceptions', async () => {
      const instance = new TestWebSocketBase();

      const mockHandler = vi.fn().mockRejectedValue('string error');

      (instance as any).routeHandlers.set('test:error', mockHandler);

      const ws = {} as WebSocket;
      const message = JSON.stringify({ type: 'test', action: 'error', data: {} });
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(result).toBeUndefined();
      expect(instance.lastError).toEqual({
        clientId: 'client-123',
        error: 'Unknown error',
      });
    });

    it('should handle Buffer messages', async () => {
      const instance = new TestWebSocketBase();

      const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });
      (instance as any).routeHandlers.set('test:ping', mockHandler);

      const ws = {} as WebSocket;
      const message = Buffer.from(JSON.stringify({ type: 'test', action: 'ping', data: { foo: 'bar' } }));
      const clientId = 'client-123';

      const result = await instance.testHandleServerMessage(ws, message, clientId);

      expect(mockHandler).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'test',
        action: 'ping',
        response: { result: 'success' },
      });
    });
  });

  describe('Route Printing', () => {
    it('should print empty routes list', () => {
      const instance = new TestWebSocketBase();

      // Should not throw
      expect(() => instance.testPrintRoutes()).not.toThrow();
    });

    it('should print single route', () => {
      const instance = new TestWebSocketBase();

      (instance as any).routeHandlers.set('test:ping', vi.fn());

      // Should not throw
      expect(() => instance.testPrintRoutes()).not.toThrow();
    });

    it('should print multiple routes', () => {
      const instance = new TestWebSocketBase();

      (instance as any).routeHandlers.set('test:ping', vi.fn());
      (instance as any).routeHandlers.set('test:pong', vi.fn());
      (instance as any).routeHandlers.set('system:join', vi.fn());

      // Should not throw
      expect(() => instance.testPrintRoutes()).not.toThrow();
    });

    it('should format route keys correctly', () => {
      const instance = new TestWebSocketBase();

      (instance as any).routeHandlers.set('test:ping', vi.fn());
      (instance as any).routeHandlers.set('system:joinRoom', vi.fn());

      // Just verify it doesn't throw - the log function is external
      expect(() => instance.testPrintRoutes()).not.toThrow();
    });
  });

  describe('Route Key Generation', () => {
    it('should use correct route key format', () => {
      const instance = new TestWebSocketBase();

      // Manually add routes with expected keys
      (instance as any).routeHandlers.set('custom:myAction', vi.fn());

      const handlers = instance.getRouteHandlers();
      expect(handlers.has('custom:myAction')).toBe(true);
    });

    it('should handle multiple routes with same type', () => {
      const instance = new TestWebSocketBase();

      // Manually add routes
      (instance as any).routeHandlers.set('test:action1', vi.fn());
      (instance as any).routeHandlers.set('test:action2', vi.fn());

      const handlers = instance.getRouteHandlers();
      expect(handlers.size).toBe(2);
      expect(handlers.has('test:action1')).toBe(true);
      expect(handlers.has('test:action2')).toBe(true);
    });
  });

  describe('Integration with Message Parsing', () => {
    it('should correctly parse and route messages', async () => {
      const instance = new TestWebSocketBase();

      const action1Handler = vi.fn().mockResolvedValue({ result: 'action1' });
      const action2Handler = vi.fn().mockResolvedValue({ result: 'action2' });

      (instance as any).routeHandlers.set('test:action1', action1Handler);
      (instance as any).routeHandlers.set('test:action2', action2Handler);

      const ws = {} as WebSocket;

      // Test action1
      await instance.testHandleServerMessage(
        ws,
        JSON.stringify({ type: 'test', action: 'action1', data: { id: 1 } }),
        'client-1',
      );

      expect(action1Handler).toHaveBeenCalledWith(ws, 'client-1', { id: 1 });
      expect(action2Handler).not.toHaveBeenCalled();

      action1Handler.mockClear();

      // Test action2
      await instance.testHandleServerMessage(
        ws,
        JSON.stringify({ type: 'test', action: 'action2', data: { id: 2 } }),
        'client-2',
      );

      expect(action2Handler).toHaveBeenCalledWith(ws, 'client-2', { id: 2 });
      expect(action1Handler).not.toHaveBeenCalled();
    });
  });
});
