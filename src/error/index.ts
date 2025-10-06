export type { ErrorEnvelope, ErrorReportOptions } from './error.interface.js';
export { ErrorCode, ErrorSeverity } from './error.interface.js';
export { ErrorReporter, safeSerializeError } from './error-reporter.js';
export {
  FrameworkError,
  ConfigurationError,
  ValidationError,
  DatabaseError,
  RedisError,
  QueueError,
  WebServerError,
  WebSocketError,
  LifecycleError,
  ResourceNotFoundError,
  NotImplementedError,
} from './framework-errors.js';

// Export default instance for convenience
export { default as errorReporter } from './error-reporter.js';
