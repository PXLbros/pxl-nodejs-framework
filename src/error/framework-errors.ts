import { ErrorCode, ErrorSeverity } from './error.interface.js';

/**
 * Base framework error class
 *
 * All framework-specific errors extend this class for consistent error handling
 */
export class FrameworkError extends Error {
  public readonly code: ErrorCode | string;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    options?: {
      code?: ErrorCode | string;
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'FrameworkError';
    this.code = options?.code ?? ErrorCode.INTERNAL;
    this.severity = options?.severity ?? ErrorSeverity.ERROR;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Attach cause if provided (ES2022 error cause)
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends FrameworkError {
  constructor(message: string, options?: { context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: ErrorCode.INVALID_CONFIG,
      severity: ErrorSeverity.FATAL,
      ...options,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends FrameworkError {
  constructor(message: string, options?: { context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: ErrorCode.VALIDATION_FAILED,
      severity: ErrorSeverity.ERROR,
      ...options,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Database error
 */
export class DatabaseError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.DATABASE_QUERY_FAILED,
      severity: ErrorSeverity.ERROR,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * Redis error
 */
export class RedisError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.REDIS_COMMAND_FAILED,
      severity: ErrorSeverity.ERROR,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'RedisError';
  }
}

/**
 * Queue error
 */
export class QueueError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.QUEUE_JOB_FAILED,
      severity: ErrorSeverity.ERROR,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'QueueError';
  }
}

/**
 * Web server error
 */
export class WebServerError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.WEB_SERVER_REQUEST_FAILED,
      severity: ErrorSeverity.ERROR,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'WebServerError';
  }
}

/**
 * WebSocket error
 */
export class WebSocketError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.WEBSOCKET_MESSAGE_FAILED,
      severity: ErrorSeverity.ERROR,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'WebSocketError';
  }
}

/**
 * Lifecycle error
 */
export class LifecycleError extends FrameworkError {
  constructor(message: string, options?: { code?: ErrorCode; context?: Record<string, unknown>; cause?: unknown }) {
    super(message, {
      code: options?.code ?? ErrorCode.LIFECYCLE_INIT_FAILED,
      severity: ErrorSeverity.CRITICAL,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = 'LifecycleError';
  }
}

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends FrameworkError {
  constructor(message: string, options?: { context?: Record<string, unknown> }) {
    super(message, {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      severity: ErrorSeverity.WARNING,
      ...options,
    });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Not implemented error
 */
export class NotImplementedError extends FrameworkError {
  constructor(message: string, options?: { context?: Record<string, unknown> }) {
    super(message, {
      code: ErrorCode.NOT_IMPLEMENTED,
      severity: ErrorSeverity.ERROR,
      ...options,
    });
    this.name = 'NotImplementedError';
  }
}
