import type { FastifyReply, FastifyRequest } from 'fastify';
import { PerformanceMonitor } from './performance-monitor.js';

export interface WebServerPerformanceOptions {
  logSlowRequests?: boolean;
  slowRequestThreshold?: number;
  includeHeaders?: boolean;
  includeUserAgent?: boolean;
  skipRoutes?: string[];
  skipMethods?: string[];
}

export interface HttpRequestMetadata {
  method: string;
  url: string;
  ip?: string;
  userAgent?: string;
  headers?: Record<string, string | string[] | undefined>;
  statusCode?: number;
  contentLength?: number;
  error?: string;
  errorName?: string;
  argumentCount?: number;
}

export class WebServerPerformanceWrapper {
  private static performanceMonitor: PerformanceMonitor;

  public static setPerformanceMonitor(monitor: PerformanceMonitor): void {
    WebServerPerformanceWrapper.performanceMonitor = monitor;
  }

  private static getPerformanceMonitor(): PerformanceMonitor {
    if (!WebServerPerformanceWrapper.performanceMonitor) {
      WebServerPerformanceWrapper.performanceMonitor = PerformanceMonitor.getInstance();
    }
    return WebServerPerformanceWrapper.performanceMonitor;
  }

  /**
   * Create performance middleware for Fastify
   */
  public static createPerformanceMiddleware(options: WebServerPerformanceOptions = {}) {
    const defaultOptions: WebServerPerformanceOptions = {
      logSlowRequests: true,
      slowRequestThreshold: 1000, // 1 second
      includeHeaders: false,
      includeUserAgent: true,
      skipRoutes: ['/health', '/metrics'],
      skipMethods: [],
    };

    const config = { ...defaultOptions, ...options };
    const monitor = WebServerPerformanceWrapper.getPerformanceMonitor();

    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const { method, url, headers, ip } = request;
      const routeKey = `${method} ${url}`;

      // Skip monitoring for specified routes or methods
      if (config.skipRoutes?.includes(url) || config.skipMethods?.includes(method)) {
        return;
      }

      const startMark = monitor.startMeasure(routeKey, 'http');

      // Add request metadata
      const metadata: HttpRequestMetadata = {
        method,
        url,
        ip,
        userAgent: config.includeUserAgent ? (headers['user-agent'] as string) : undefined,
        headers: config.includeHeaders ? headers : undefined,
      };

      // Store metadata on request for later use
      (request as any).performanceMetadata = metadata;
      (request as any).performanceStartMark = startMark;
    };
  }

  /**
   * Create Fastify hooks for performance monitoring
   */
  public static createPerformanceHooks(_options: WebServerPerformanceOptions = {}) {
    const monitor = WebServerPerformanceWrapper.getPerformanceMonitor();

    return {
      onSend: async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
        const startMark = (request as any).performanceStartMark;
        const metadata = (request as any).performanceMetadata;

        if (startMark && metadata) {
          const responseMetadata: HttpRequestMetadata = {
            ...metadata,
            statusCode: reply.statusCode,
            contentLength: payload ? String(payload).length : 0,
          };

          monitor.endMeasure(startMark, responseMetadata);
        }

        return payload;
      },
      onError: async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
        const startMark = (request as any).performanceStartMark;
        const metadata = (request as any).performanceMetadata;

        if (startMark && metadata) {
          const errorMetadata: HttpRequestMetadata = {
            ...metadata,
            statusCode: reply.statusCode,
            error: error.message,
            errorName: error.name,
          };

          monitor.endMeasure(startMark, errorMetadata);
        }
      },
    };
  }

  /**
   * Monitor controller method execution
   */
  public static async monitorControllerMethod<T>({
    controllerName,
    methodName,
    operation,
    metadata,
  }: {
    controllerName: string;
    methodName: string;
    operation: () => Promise<T>;
    metadata?: Record<string, any>;
  }): Promise<T> {
    const monitor = WebServerPerformanceWrapper.getPerformanceMonitor();

    return monitor.measureAsync({
      name: `${controllerName}.${methodName}`,
      type: 'http',
      fn: operation,
      metadata: {
        controller: controllerName,
        method: methodName,
        ...metadata,
      },
    });
  }

  /**
   * Monitor route handler execution
   */
  public static async monitorRouteHandler<T>({
    route,
    method,
    operation,
    metadata,
  }: {
    route: string;
    method: string;
    operation: () => Promise<T>;
    metadata?: Record<string, any>;
  }): Promise<T> {
    const monitor = WebServerPerformanceWrapper.getPerformanceMonitor();

    return monitor.measureAsync({
      name: `${method} ${route}`,
      type: 'http',
      fn: operation,
      metadata: { route, method, ...metadata },
    });
  }

  /**
   * Monitor middleware execution
   */
  public static async monitorMiddleware<T>({
    middlewareName,
    operation,
    metadata,
  }: {
    middlewareName: string;
    operation: () => Promise<T>;
    metadata?: Record<string, any>;
  }): Promise<T> {
    const monitor = WebServerPerformanceWrapper.getPerformanceMonitor();

    return monitor.measureAsync({
      name: `middleware.${middlewareName}`,
      type: 'http',
      fn: operation,
      metadata: {
        middleware: middlewareName,
        ...metadata,
      },
    });
  }
}

/**
 * Decorator for monitoring controller methods
 */
export function MonitorControllerMethod(methodName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const controllerName = target.constructor.name;
    const operation = methodName ?? propertyKey;

    descriptor.value = async function (...args: any[]) {
      return WebServerPerformanceWrapper.monitorControllerMethod({
        controllerName,
        methodName: operation,
        operation: () => originalMethod.apply(this, args),
        metadata: { argumentCount: args.length },
      });
    };

    return descriptor;
  };
}
