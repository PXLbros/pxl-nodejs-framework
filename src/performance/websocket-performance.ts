import { PerformanceMonitor } from './performance-monitor.js';

export interface WebSocketOperationMetadata {
  operation: string;
  messageType?: string;
  messageSize?: number;
  clientId?: string;
  room?: string;
  error?: string;
  argumentCount?: number;
}

export class WebSocketPerformanceWrapper {
  private static performanceMonitor: PerformanceMonitor;

  public static setPerformanceMonitor(monitor: PerformanceMonitor): void {
    WebSocketPerformanceWrapper.performanceMonitor = monitor;
  }

  private static getPerformanceMonitor(): PerformanceMonitor {
    if (!WebSocketPerformanceWrapper.performanceMonitor) {
      WebSocketPerformanceWrapper.performanceMonitor = PerformanceMonitor.getInstance();
    }
    return WebSocketPerformanceWrapper.performanceMonitor;
  }

  /**
   * Monitor WebSocket message handling
   */
  public static async monitorMessageHandling<T>(
    messageType: string,
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: 'message_handling',
      messageType,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `message.${messageType}`,
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor WebSocket connection operations
   */
  public static async monitorConnection<T>(
    connectionOperation: string,
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: connectionOperation,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `connection.${connectionOperation}`,
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor WebSocket room operations
   */
  public static async monitorRoomOperation<T>(
    roomOperation: string,
    room: string,
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: roomOperation,
      room,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `room.${roomOperation}`,
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor WebSocket broadcast operations
   */
  public static async monitorBroadcast<T>(
    broadcastType: string,
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: 'broadcast',
      messageType: broadcastType,
      ...metadata,
    };

    return monitor.measureAsync({
      name: `broadcast.${broadcastType}`,
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor WebSocket authentication
   */
  public static async monitorAuthentication<T>(
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: 'authentication',
      ...metadata,
    };

    return monitor.measureAsync({
      name: 'authentication',
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }

  /**
   * Monitor controller method execution
   */
  public static async monitorControllerMethod<T>(
    controllerName: string,
    methodName: string,
    operation: () => Promise<T>,
    metadata?: Partial<WebSocketOperationMetadata>,
  ): Promise<T> {
    const monitor = WebSocketPerformanceWrapper.getPerformanceMonitor();

    const operationMetadata: WebSocketOperationMetadata = {
      operation: 'controller_method',
      ...metadata,
    };

    return monitor.measureAsync({
      name: `${controllerName}.${methodName}`,
      type: 'websocket',
      fn: operation,
      metadata: operationMetadata,
    });
  }
}

/**
 * Decorator for monitoring WebSocket controller methods
 */
export function MonitorWebSocketOperation(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const controllerName = target.constructor.name;
    const operation = operationName ?? propertyKey;

    descriptor.value = async function (...args: any[]) {
      return WebSocketPerformanceWrapper.monitorControllerMethod(
        controllerName,
        operation,
        () => originalMethod.apply(this, args),
        { argumentCount: args.length },
      );
    };

    return descriptor;
  };
}
