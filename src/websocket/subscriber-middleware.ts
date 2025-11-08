import type { WebSocketSubscriberHandler, WebSocketSubscriberHandlerContext } from './websocket.interface.js';
import { Logger } from '../logger/index.js';

/**
 * Middleware that can intercept and modify subscriber handler execution
 */
export interface WebSocketSubscriberMiddleware {
  /**
   * Unique identifier for the middleware
   */
  name: string;

  /**
   * Runs before the handler
   * Return false to skip handler execution
   */
  onBefore?: (context: WebSocketSubscriberHandlerContext) => boolean | Promise<boolean>;

  /**
   * Runs after successful handler execution
   */
  onAfter?: (context: WebSocketSubscriberHandlerContext, result: unknown) => void | Promise<void>;

  /**
   * Runs on handler error
   * Return true to suppress the error, false to rethrow
   */
  onError?: (context: WebSocketSubscriberHandlerContext, error: Error) => boolean | Promise<boolean>;
}

/**
 * Execute middleware pipeline and handler
 * @param handler - The handler to execute
 * @param middleware - Array of middleware to apply
 * @param context - Handler context
 */
export async function executeWithMiddleware(
  handler: WebSocketSubscriberHandler,
  middleware: WebSocketSubscriberMiddleware[],
  context: WebSocketSubscriberHandlerContext,
): Promise<void> {
  // Execute "before" middleware
  for (const mw of middleware) {
    try {
      const shouldContinue = mw.onBefore ? await mw.onBefore(context) : true;
      if (!shouldContinue) {
        Logger.info({
          message: 'Middleware skipped handler execution',
          meta: {
            middleware: mw.name,
            channel: context.channel,
          },
        });
        return;
      }
    } catch (error) {
      Logger.error({
        message: 'Middleware onBefore failed',
        meta: {
          middleware: mw.name,
          channel: context.channel,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // Execute handler
  let result: unknown;
  try {
    result = await handler(context);
  } catch (error) {
    // Execute "error" middleware
    for (const mw of middleware) {
      if (!mw.onError) {
        continue;
      }

      try {
        const shouldSuppress = await mw.onError(context, error instanceof Error ? error : new Error(String(error)));
        if (shouldSuppress) {
          return;
        }
      } catch (mwError) {
        Logger.error({
          message: 'Middleware onError failed',
          meta: {
            middleware: mw.name,
            channel: context.channel,
            error: mwError instanceof Error ? mwError.message : String(mwError),
          },
        });
      }
    }

    throw error;
  }

  // Execute "after" middleware
  for (const mw of middleware) {
    if (!mw.onAfter) {
      continue;
    }

    try {
      await mw.onAfter(context, result);
    } catch (error) {
      Logger.error({
        message: 'Middleware onAfter failed',
        meta: {
          middleware: mw.name,
          channel: context.channel,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

/**
 * Built-in middleware for logging handler execution
 */
export const loggingMiddleware = (handlerName: string): WebSocketSubscriberMiddleware => ({
  name: 'logging',
  onBefore: context => {
    Logger.info({
      message: `${handlerName}: Starting execution`,
      meta: {
        channel: context.channel,
      },
    });
    return true;
  },
  onAfter: (context, result) => {
    Logger.info({
      message: `${handlerName}: Completed successfully`,
      meta: {
        channel: context.channel,
        resultType: typeof result,
      },
    });
  },
  onError: (context, error) => {
    Logger.error({
      message: `${handlerName}: Failed`,
      meta: {
        channel: context.channel,
        error: error.message,
      },
    });
    return false; // Don't suppress the error
  },
});

/**
 * Built-in middleware for timing handler execution
 */
export const timingMiddleware = (): WebSocketSubscriberMiddleware => {
  const startTimes = new Map<string, number>();

  return {
    name: 'timing',
    onBefore: context => {
      startTimes.set(context.channel, Date.now());
      return true;
    },
    onAfter: context => {
      const startTime = startTimes.get(context.channel);
      if (startTime) {
        const duration = Date.now() - startTime;
        startTimes.delete(context.channel);
        Logger.info({
          message: 'Handler execution timing',
          meta: {
            channel: context.channel,
            durationMs: duration,
          },
        });
      }
    },
    onError: context => {
      startTimes.delete(context.channel);
      return false;
    },
  };
};

/**
 * Built-in middleware for validating message structure
 */
export const validationMiddleware = (
  validator: (message: unknown) => void | Promise<void>,
): WebSocketSubscriberMiddleware => ({
  name: 'validation',
  onBefore: async context => {
    try {
      await validator(context.message);
      return true;
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
  },
});

/**
 * Built-in middleware for rate limiting
 */
export const rateLimitMiddleware = (maxExecutions: number, windowMs: number): WebSocketSubscriberMiddleware => {
  const executionTimes = new Map<string, number[]>();

  return {
    name: 'rate-limit',
    onBefore: context => {
      const channel = context.channel;
      const now = Date.now();
      const times = executionTimes.get(channel) ?? [];

      // Remove old entries
      const recentTimes = times.filter(t => now - t < windowMs);

      if (recentTimes.length >= maxExecutions) {
        Logger.warn({
          message: 'Rate limit exceeded',
          meta: {
            channel,
            maxExecutions,
            windowMs,
          },
        });
        return false;
      }

      recentTimes.push(now);
      executionTimes.set(channel, recentTimes);
      return true;
    },
  };
};

/**
 * Built-in middleware for error handling and recovery
 */
export const errorRecoveryMiddleware = (maxRetries = 3, _delayMs = 1000): WebSocketSubscriberMiddleware => ({
  name: 'error-recovery',
  onError: async (context, error) => {
    Logger.warn({
      message: 'Handler error, could implement retry logic',
      meta: {
        channel: context.channel,
        error: error.message,
        suggestedRetries: maxRetries,
      },
    });
    return false; // Don't suppress - let error bubble up
  },
});
