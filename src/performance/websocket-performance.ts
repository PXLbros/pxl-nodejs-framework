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

    return monitor.measureAsync(`message.${messageType}`, 'websocket', operation, operationMetadata);
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

    return monitor.measureAsync(`connection.${connectionOperation}`, 'websocket', operation, operationMetadata);
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

    return monitor.measureAsync(`room.${roomOperation}`, 'websocket', operation, operationMetadata);
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

    return monitor.measureAsync(`broadcast.${broadcastType}`, 'websocket', operation, operationMetadata);
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

    return monitor.measureAsync('authentication', 'websocket', operation, operationMetadata);
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

    return monitor.measureAsync(`${controllerName}.${methodName}`, 'websocket', operation, operationMetadata);
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
