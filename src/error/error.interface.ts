/**
 * Error severity levels for classification and handling
 */
export enum ErrorSeverity {
  /**
   * Fatal errors that require immediate attention and may cause application failure
   */
  FATAL = 'fatal',

  /**
   * Critical errors that significantly impact functionality
   */
  CRITICAL = 'critical',

  /**
   * Major errors that affect features but don't crash the application
   */
  ERROR = 'error',

  /**
   * Warnings about potential issues
   */
  WARNING = 'warning',

  /**
   * Informational messages about error conditions
   */
  INFO = 'info',
}

/**
 * Standard error codes for framework errors
 */
export enum ErrorCode {
  // Configuration errors (1xxx)
  INVALID_CONFIG = 'ERR_INVALID_CONFIG',
  MISSING_CONFIG = 'ERR_MISSING_CONFIG',
  CONFIG_VALIDATION_FAILED = 'ERR_CONFIG_VALIDATION_FAILED',

  // Lifecycle errors (2xxx)
  LIFECYCLE_INIT_FAILED = 'ERR_LIFECYCLE_INIT_FAILED',
  LIFECYCLE_START_FAILED = 'ERR_LIFECYCLE_START_FAILED',
  LIFECYCLE_SHUTDOWN_FAILED = 'ERR_LIFECYCLE_SHUTDOWN_FAILED',
  LIFECYCLE_TIMEOUT = 'ERR_LIFECYCLE_TIMEOUT',

  // Database errors (3xxx)
  DATABASE_CONNECTION_FAILED = 'ERR_DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'ERR_DATABASE_QUERY_FAILED',
  DATABASE_MIGRATION_FAILED = 'ERR_DATABASE_MIGRATION_FAILED',

  // Redis errors (4xxx)
  REDIS_CONNECTION_FAILED = 'ERR_REDIS_CONNECTION_FAILED',
  REDIS_COMMAND_FAILED = 'ERR_REDIS_COMMAND_FAILED',

  // Queue errors (5xxx)
  QUEUE_JOB_FAILED = 'ERR_QUEUE_JOB_FAILED',
  QUEUE_CONNECTION_FAILED = 'ERR_QUEUE_CONNECTION_FAILED',
  QUEUE_PROCESSOR_NOT_FOUND = 'ERR_QUEUE_PROCESSOR_NOT_FOUND',

  // Web server errors (6xxx)
  WEB_SERVER_START_FAILED = 'ERR_WEB_SERVER_START_FAILED',
  WEB_SERVER_REQUEST_FAILED = 'ERR_WEB_SERVER_REQUEST_FAILED',
  WEB_CONTROLLER_NOT_FOUND = 'ERR_WEB_CONTROLLER_NOT_FOUND',
  WEB_ACTION_NOT_FOUND = 'ERR_WEB_ACTION_NOT_FOUND',

  // WebSocket errors (7xxx)
  WEBSOCKET_CONNECTION_FAILED = 'ERR_WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_MESSAGE_FAILED = 'ERR_WEBSOCKET_MESSAGE_FAILED',

  // Validation errors (8xxx)
  VALIDATION_FAILED = 'ERR_VALIDATION_FAILED',
  INVALID_INPUT = 'ERR_INVALID_INPUT',

  // Resource errors (9xxx)
  RESOURCE_NOT_FOUND = 'ERR_RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'ERR_RESOURCE_ALREADY_EXISTS',
  RESOURCE_LOCKED = 'ERR_RESOURCE_LOCKED',

  // Generic errors
  UNKNOWN = 'ERR_UNKNOWN',
  INTERNAL = 'ERR_INTERNAL',
  NOT_IMPLEMENTED = 'ERR_NOT_IMPLEMENTED',
}

/**
 * Normalized error envelope for consistent error handling
 */
export interface ErrorEnvelope {
  /**
   * Error message (human-readable)
   */
  message: string;

  /**
   * Error code (machine-readable)
   */
  code: ErrorCode | string;

  /**
   * Error severity level
   */
  severity: ErrorSeverity;

  /**
   * Original error stack trace
   */
  stack?: string;

  /**
   * Request ID for correlation (if available)
   */
  requestId?: string;

  /**
   * Additional context about the error
   */
  context?: Record<string, unknown>;

  /**
   * Underlying cause (if error was wrapped)
   */
  cause?: unknown;

  /**
   * Timestamp when error occurred
   */
  timestamp: Date;

  /**
   * Error name/type
   */
  name?: string;
}

/**
 * Options for error reporting
 */
export interface ErrorReportOptions {
  /**
   * Additional context to include with the error
   */
  context?: Record<string, unknown>;

  /**
   * Override error severity
   */
  severity?: ErrorSeverity;

  /**
   * Override error code
   */
  code?: ErrorCode | string;

  /**
   * Whether to capture this error in Sentry
   */
  captureInSentry?: boolean;

  /**
   * Whether to log this error
   */
  log?: boolean;
}
