export type { WebSocketRoute } from './websocket.interface.js';
export { WebSocketRedisSubscriberEvent } from './websocket.interface.js';
export type {
  WebSocketSubscriberDefinition,
  WebSocketSubscriberHandler,
  WebSocketSubscriberHandlerContext,
  WebSocketSubscriberMatcher,
  WebSocketSubscriberHandlersConfig,
} from './websocket.interface.js';
export { default as WebSocketServerBaseController } from './controller/server/base.js';
export { default as WebSocketClientBaseController } from './controller/client/base.js';
export { WebSocketService } from './websocket-service.js';
export type { WebSocketMessage, WebSocketServiceOptions } from './websocket-service.js';
export { WebSocketAuthService } from './websocket-auth.js';
export type { WebSocketAuthResult } from './websocket-auth.js';
export { defineWebSocketSubscriber } from './define-subscriber.js';

// WebSocket subscriber utilities
export {
  matchByProperty,
  matchByPropertyPredicate,
  getNestedProperty,
  withErrorHandler,
  withLogging,
  withRateLimit,
  withRetry,
  composeHandlers,
  withFilter,
  withValidation,
  withMetadata,
  withDebounce,
  withThrottle,
} from './subscriber-utils.js';

// WebSocket subscriber middleware
export { executeWithMiddleware } from './subscriber-middleware.js';
export type { WebSocketSubscriberMiddleware } from './subscriber-middleware.js';
export {
  loggingMiddleware,
  timingMiddleware,
  validationMiddleware,
  rateLimitMiddleware,
  errorRecoveryMiddleware,
} from './subscriber-middleware.js';
