import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import type { RequestContext, RunWithContextOptions } from './request-context.interface.js';

/**
 * AsyncLocalStorage instance for request context
 *
 * This provides request-scoped storage that automatically propagates through
 * async operations, enabling correlation IDs and request metadata to be
 * accessible throughout the request lifecycle without explicit passing.
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 *
 * @returns The current request context, or undefined if not in a request context
 *
 * @example
 * const context = getRequestContext();
 * if (context) {
 *   console.log('Request ID:', context.requestId);
 * }
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get the current request ID
 *
 * @returns The current request ID, or undefined if not in a request context
 *
 * @example
 * const requestId = getRequestId();
 * logger.info({ message: 'Processing request', requestId });
 */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

/**
 * Set metadata in the current request context
 *
 * @param key - Metadata key
 * @param value - Metadata value
 *
 * @example
 * setContextMetadata('operation', 'userLookup');
 * setContextMetadata('cacheHit', true);
 */
export function setContextMetadata(key: string, value: unknown): void {
  const context = requestContextStorage.getStore();
  if (context) {
    context.metadata ??= {};
    // eslint-disable-next-line security/detect-object-injection
    context.metadata[key] = value;
  }
}

/**
 * Get metadata from the current request context
 *
 * @param key - Metadata key
 * @returns Metadata value, or undefined if not found
 */
export function getContextMetadata(key: string): unknown {
  // eslint-disable-next-line security/detect-object-injection
  return requestContextStorage.getStore()?.metadata?.[key];
}

/**
 * Run a function within a new request context
 *
 * @param options - Context options (requestId will be generated if not provided)
 * @param fn - Function to run within the context
 * @returns The result of the function
 *
 * @example
 * await runWithContext({ requestId: 'custom-id' }, async () => {
 *   await processRequest();
 * });
 */
export function runWithContext<T>(options: RunWithContextOptions | undefined, fn: () => T): T {
  const context: RequestContext = {
    requestId: options?.requestId ?? crypto.randomUUID(),
    startTime: options?.startTime,
    userId: options?.userId,
    metadata: options?.metadata,
  };

  return requestContextStorage.run(context, fn);
}

/**
 * Run a function within a new request context (async version)
 *
 * @param options - Context options (requestId will be generated if not provided)
 * @param fn - Async function to run within the context
 * @returns Promise resolving to the result of the function
 *
 * @example
 * await runWithContextAsync({ requestId: 'custom-id' }, async () => {
 *   await processRequest();
 * });
 */
export async function runWithContextAsync<T>(
  options: RunWithContextOptions | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const context: RequestContext = {
    requestId: options?.requestId ?? crypto.randomUUID(),
    startTime: options?.startTime,
    userId: options?.userId,
    metadata: options?.metadata,
  };

  return requestContextStorage.run(context, fn);
}

/**
 * Update the user ID in the current request context
 *
 * @param userId - User ID to set
 *
 * @example
 * // After authentication
 * setUserId(authenticatedUser.id);
 */
export function setUserId(userId: string): void {
  const context = requestContextStorage.getStore();
  if (context) {
    context.userId = userId;
  }
}

/**
 * Get the user ID from the current request context
 *
 * @returns The current user ID, or undefined if not set
 */
export function getUserId(): string | undefined {
  return requestContextStorage.getStore()?.userId;
}

/**
 * Enter a new request context (advanced usage for middleware)
 *
 * This sets the context for the current async execution context without
 * wrapping in a callback. Use with caution - prefer runWithContext when possible.
 *
 * @param options - Context options
 *
 * @example
 * // In Fastify middleware
 * const requestId = req.headers['x-request-id'] || crypto.randomUUID();
 * enterRequestContext({ requestId });
 */
export function enterRequestContext(options: RunWithContextOptions): void {
  const context: RequestContext = {
    requestId: options?.requestId ?? crypto.randomUUID(),
    startTime: options?.startTime,
    userId: options?.userId,
    metadata: options?.metadata,
  };

  requestContextStorage.enterWith(context);
}

// Export the storage instance for advanced usage (e.g., middleware)
export { requestContextStorage };
