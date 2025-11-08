import type {
  WebSocketSubscriberHandler,
  WebSocketSubscriberHandlerContext,
  WebSocketSubscriberMatcher,
} from './websocket.interface.js';
import { Logger } from '../logger/index.js';

/**
 * Utility functions for building and composing WebSocket subscriber handlers
 */

/**
 * Create a predicate matcher for message properties
 * @param key - The property key to check
 * @param value - The expected value
 */
export function matchByProperty(key: string, value: unknown): WebSocketSubscriberMatcher {
  return (context: WebSocketSubscriberHandlerContext) => {
    try {
      const messageValue = getNestedProperty(context.message, key);
      return messageValue === value;
    } catch {
      return false;
    }
  };
}

/**
 * Create a predicate matcher for message property patterns
 * @param key - The property key to check
 * @param predicate - Function to test the value
 */
export function matchByPropertyPredicate<_T = unknown>(
  key: string,
  predicate: (value: unknown) => boolean,
): WebSocketSubscriberMatcher {
  return (context: WebSocketSubscriberHandlerContext) => {
    try {
      const messageValue = getNestedProperty(context.message, key);
      return predicate(messageValue);
    } catch {
      return false;
    }
  };
}

/**
 * Safely get nested property from an object
 * @param obj - The object to search
 * @param path - Dot-notation path (e.g., 'user.id' or 'data.items.0.name')
 */
export function getNestedProperty(obj: any, path: string): unknown {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current == null) {
      return undefined;
    }
    // eslint-disable-next-line security/detect-object-injection
    current = current[key];
  }

  return current;
}

/**
 * Wrap a handler with error handling
 * @param handler - The handler to wrap
 * @param onError - Error handler callback
 * @param throwError - Whether to rethrow the error after handling
 */
export function withErrorHandler<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  onError?: (error: Error, context: WebSocketSubscriberHandlerContext<TMessage>) => void | Promise<void>,
  _throwError = false,
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    try {
      return await handler(context);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (onError) {
        try {
          await onError(err, context);
        } catch (callbackError) {
          Logger.error({
            message: 'Error handler callback failed',
            meta: { originalError: err.message, callbackError },
          });
        }
      }

      if (_throwError) {
        throw err;
      }
    }
  };
}

/**
 * Wrap a handler with logging
 * @param handler - The handler to wrap
 * @param handlerName - Name for logging purposes
 */
export function withLogging<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  handlerName = 'subscriber-handler',
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const startTime = Date.now();
    Logger.info({
      message: `${handlerName}: Starting handler execution`,
      meta: {
        channel: context.channel,
        messageKeys: Object.keys(context.message).slice(0, 5),
      },
    });

    try {
      const result = await handler(context);
      const duration = Date.now() - startTime;
      Logger.info({
        message: `${handlerName}: Handler completed successfully`,
        meta: { channel: context.channel, durationMs: duration },
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error({
        message: `${handlerName}: Handler failed`,
        meta: {
          channel: context.channel,
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
        },
      });
      throw error;
    }
  };
}

/**
 * Wrap a handler with rate limiting
 * @param handler - The handler to wrap
 * @param maxExecutions - Max executions allowed
 * @param windowMs - Time window in milliseconds
 * @param onRateLimited - Optional callback when rate limited
 */
export function withRateLimit<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  maxExecutions: number,
  windowMs: number,
  onRateLimited?: (context: WebSocketSubscriberHandlerContext<TMessage>) => void | Promise<void>,
): WebSocketSubscriberHandler<TMessage> {
  const executionTimes: number[] = [];

  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const now = Date.now();

    // Remove old entries outside the window
    while (executionTimes.length > 0 && executionTimes[0] < now - windowMs) {
      executionTimes.shift();
    }

    if (executionTimes.length >= maxExecutions) {
      if (onRateLimited) {
        await onRateLimited(context);
      }
      return;
    }

    executionTimes.push(now);
    return await handler(context);
  };
}

/**
 * Wrap a handler with retry logic
 * @param handler - The handler to wrap
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Delay between retries in milliseconds
 * @param backoffMultiplier - Multiplier for exponential backoff (default: 1, no backoff)
 */
export function withRetry<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  maxRetries: number,
  delayMs: number,
  backoffMultiplier = 1,
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    let lastError: Error | null = null;
    let currentDelay = delayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.floor(currentDelay * backoffMultiplier);
        }
      }
    }

    throw lastError;
  };
}

/**
 * Compose multiple handlers into a single handler
 * Executes handlers sequentially, passing context through each one
 * @param handlers - Array of handlers to compose
 */
export function composeHandlers<TMessage = any>(
  handlers: WebSocketSubscriberHandler<TMessage>[],
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    for (const handler of handlers) {
      await handler(context);
    }
  };
}

/**
 * Create a filter handler that conditionally executes based on a predicate
 * @param predicate - Function that returns true if handler should execute
 * @param handler - The handler to execute conditionally
 */
export function withFilter<TMessage = any>(
  predicate: (context: WebSocketSubscriberHandlerContext<TMessage>) => boolean | Promise<boolean>,
  handler: WebSocketSubscriberHandler<TMessage>,
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const shouldExecute = await predicate(context);
    if (shouldExecute) {
      return await handler(context);
    }
  };
}

/**
 * Validate message structure before execution
 * @param validator - Function that validates the message and throws if invalid
 * @param handler - The handler to wrap
 */
export function withValidation<TMessage = any>(
  validator: (message: TMessage) => void | Promise<void>,
  handler: WebSocketSubscriberHandler<TMessage>,
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    try {
      await validator(context.message);
      return await handler(context);
    } catch (error) {
      Logger.warn({
        message: 'Message validation failed',
        meta: {
          channel: context.channel,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  };
}

/**
 * Add metadata/context to a handler execution
 * @param metadata - Metadata to add to context
 * @param handler - The handler to wrap
 */
export function withMetadata<TMessage = any>(
  metadata: Record<string, unknown>,
  handler: WebSocketSubscriberHandler<TMessage>,
): WebSocketSubscriberHandler<TMessage> {
  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const enrichedContext = {
      ...context,
      metadata,
    } as any;

    return await handler(enrichedContext);
  };
}

/**
 * Debounce handler execution by channel
 * @param handler - The handler to wrap
 * @param delayMs - Debounce delay in milliseconds
 */
export function withDebounce<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  delayMs: number,
): WebSocketSubscriberHandler<TMessage> {
  const timers = new Map<string, NodeJS.Timeout>();

  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const channel = context.channel;

    // Cancel previous timer for this channel
    const existingTimer = timers.get(channel);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    return new Promise<void>(resolve => {
      const timer = setTimeout(async () => {
        try {
          await handler(context);
        } finally {
          timers.delete(channel);
          resolve();
        }
      }, delayMs);

      timers.set(channel, timer);
    });
  };
}

/**
 * Throttle handler execution by channel
 * @param handler - The handler to wrap
 * @param intervalMs - Throttle interval in milliseconds
 */
export function withThrottle<TMessage = any>(
  handler: WebSocketSubscriberHandler<TMessage>,
  intervalMs: number,
): WebSocketSubscriberHandler<TMessage> {
  const lastExecutionTime = new Map<string, number>();

  return async (context: WebSocketSubscriberHandlerContext<TMessage>) => {
    const channel = context.channel;
    const now = Date.now();
    const lastTime = lastExecutionTime.get(channel) ?? 0;

    if (now - lastTime >= intervalMs) {
      lastExecutionTime.set(channel, now);
      return await handler(context);
    }
  };
}
