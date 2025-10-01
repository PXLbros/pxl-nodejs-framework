/**
 * Request context interface
 *
 * This interface defines the shape of the context stored in AsyncLocalStorage
 * for each HTTP request, providing correlation IDs and request metadata.
 */
export interface RequestContext {
  /**
   * Unique request ID (UUID v4/v7) for tracing/correlation
   */
  requestId: string;

  /**
   * Request start time (performance.now() timestamp)
   */
  startTime?: number;

  /**
   * Authenticated user ID (if available)
   */
  userId?: string;

  /**
   * Additional custom metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Options for running code within a request context
 */
export interface RunWithContextOptions {
  /**
   * Request ID to use (generated if not provided)
   */
  requestId?: string;

  /**
   * Request start time
   */
  startTime?: number;

  /**
   * User ID
   */
  userId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
