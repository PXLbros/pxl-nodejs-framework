export type { ErrorEnvelope, ErrorReportOptions } from './error.interface.js';
export { ErrorCode, ErrorSeverity } from './error.interface.js';
// Export default instance for convenience
export { default as errorReporter, ErrorReporter, safeSerializeError } from './error-reporter.js';
export {
  ConfigurationError,
  DatabaseError,
  FrameworkError,
  LifecycleError,
  NotImplementedError,
  QueueError,
  RedisError,
  ResourceNotFoundError,
  ValidationError,
  WebServerError,
  WebSocketError,
} from './framework-errors.js';
