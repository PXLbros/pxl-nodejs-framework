import * as Sentry from '@sentry/node';
import { getRequestId } from '../request-context/index.js';
import Logger from '../logger/logger.js';
import { ErrorCode, type ErrorEnvelope, type ErrorReportOptions, ErrorSeverity } from './error.interface.js';
import { FrameworkError } from './framework-errors.js';

/**
 * Safely serialize any error to a string, handling circular references gracefully
 *
 * This utility handles MikroORM errors and other complex error objects that may
 * contain circular references which would cause String(error) or JSON.stringify
 * to fail.
 *
 * @param error - The error to serialize
 * @returns String representation of the error
 *
 * @example
 * ```typescript
 * // Safe for MikroORM errors with circular entity metadata
 * const message = safeSerializeError(mikroOrmError);
 *
 * // Works with any error type
 * const message = safeSerializeError(unknownError);
 * ```
 */
export function safeSerializeError(error: unknown): string {
  try {
    if (error === null) return 'null';
    if (error === undefined) return 'undefined';

    if (typeof error === 'object') {
      // Try to extract meaningful properties
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('toString' in error && typeof error.toString === 'function') {
        try {
          const str = error.toString();
          if (str !== '[object Object]') {
            return str;
          }
        } catch {
          // toString() itself may throw
        }
      }
      // Fallback to JSON stringification with circular reference handling
      try {
        return JSON.stringify(error);
      } catch {
        // JSON.stringify can fail on circular references
        return '[object Object] (circular reference detected)';
      }
    }

    return String(error);
  } catch {
    return 'Unknown error (serialization failed)';
  }
}

/**
 * Centralized error reporter for the framework
 *
 * Provides a unified interface for error reporting, normalization, logging,
 * and external error tracking (Sentry). Eliminates inconsistent error handling
 * and ensures all errors are properly structured and correlated.
 *
 * @example
 * ```typescript
 * const errorReporter = ErrorReporter.getInstance();
 *
 * // Report an error
 * errorReporter.report(error, {
 *   context: { userId: '123', operation: 'fetchUser' },
 *   severity: ErrorSeverity.CRITICAL
 * });
 *
 * // Report with custom code
 * errorReporter.report(
 *   new Error('Database connection lost'),
 *   {
 *     code: ErrorCode.DATABASE_CONNECTION_FAILED,
 *     captureInSentry: true
 *   }
 * );
 * ```
 */
export class ErrorReporter {
  private static instance: ErrorReporter;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * Report an error through the centralized error pipeline
   *
   * This method:
   * 1. Normalizes the error into a standard envelope
   * 2. Logs the error with appropriate severity
   * 3. Optionally captures the error in Sentry
   * 4. Adds request correlation if available
   *
   * @param error - The error to report (Error, string, or unknown)
   * @param options - Reporting options (context, severity, etc.)
   * @returns Normalized error envelope
   */
  public report(error: Error | unknown, options?: ErrorReportOptions): ErrorEnvelope {
    // Normalize the error into an envelope
    const envelope = this.normalizeError(error, options);

    // Log the error (unless explicitly disabled)
    if (options?.log !== false) {
      this.logError(envelope);
    }

    // Capture in Sentry (if enabled and error is significant enough)
    if (this.shouldCaptureInSentry(envelope, options)) {
      this.captureInSentry(error, envelope);
    }

    return envelope;
  }

  /**
   * Normalize any error into a standardized ErrorEnvelope
   *
   * @param error - The error to normalize
   * @param options - Optional configuration
   * @returns Normalized error envelope
   */
  private normalizeError(error: Error | unknown, options?: ErrorReportOptions): ErrorEnvelope {
    // Extract request ID from context (if available)
    const requestId = getRequestId();

    // Handle FrameworkError instances
    if (error instanceof FrameworkError) {
      return {
        message: error.message,
        code: options?.code ?? error.code,
        severity: options?.severity ?? error.severity,
        stack: error.stack,
        requestId,
        context: { ...error.context, ...options?.context },
        cause: error.cause,
        timestamp: error.timestamp,
        name: error.name,
      };
    }

    // Handle standard Error instances
    if (error instanceof Error) {
      return {
        message: error.message,
        code: options?.code ?? ErrorCode.UNKNOWN,
        severity: options?.severity ?? ErrorSeverity.ERROR,
        stack: error.stack,
        requestId,
        context: options?.context,
        cause: error.cause,
        timestamp: new Date(),
        name: error.name,
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        message: error,
        code: options?.code ?? ErrorCode.UNKNOWN,
        severity: options?.severity ?? ErrorSeverity.ERROR,
        requestId,
        context: options?.context,
        timestamp: new Date(),
      };
    }

    // Handle unknown error types
    return {
      message: safeSerializeError(error),
      code: options?.code ?? ErrorCode.UNKNOWN,
      severity: options?.severity ?? ErrorSeverity.ERROR,
      requestId,
      context: { ...options?.context, originalError: error },
      timestamp: new Date(),
    };
  }

  /**
   * Log the error with appropriate severity
   *
   * @param envelope - Normalized error envelope
   */
  private logError(envelope: ErrorEnvelope): void {
    const meta: Record<string, unknown> = {
      code: envelope.code,
      severity: envelope.severity,
    };

    if (envelope.requestId) {
      meta.requestId = envelope.requestId;
    }

    if (envelope.context) {
      Object.assign(meta, envelope.context);
    }

    // Map severity to logger level
    switch (envelope.severity) {
      case ErrorSeverity.FATAL:
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        Logger.error({ error: envelope.message, meta });
        break;
      case ErrorSeverity.WARNING:
        Logger.warn({ message: envelope.message, meta });
        break;
      case ErrorSeverity.INFO:
        Logger.info({ message: envelope.message, meta });
        break;
    }
  }

  /**
   * Determine if error should be captured in Sentry
   *
   * @param envelope - Normalized error envelope
   * @param options - Reporting options
   * @returns Whether to capture in Sentry
   */
  private shouldCaptureInSentry(envelope: ErrorEnvelope, options?: ErrorReportOptions): boolean {
    // Explicitly disabled
    if (options?.captureInSentry === false) {
      return false;
    }

    // Explicitly enabled
    if (options?.captureInSentry === true) {
      return true;
    }

    // Auto-capture for errors and above (not warnings/info)
    return (
      envelope.severity === ErrorSeverity.FATAL ||
      envelope.severity === ErrorSeverity.CRITICAL ||
      envelope.severity === ErrorSeverity.ERROR
    );
  }

  /**
   * Capture error in Sentry with enriched context
   *
   * @param error - Original error
   * @param envelope - Normalized error envelope
   */
  private captureInSentry(error: Error | unknown, envelope: ErrorEnvelope): void {
    // Only capture if Sentry is initialized
    if (!Logger.isSentryInitialized) {
      return;
    }

    // Prepare Sentry scope with enriched context
    Sentry.withScope(scope => {
      // Add severity
      scope.setLevel(this.mapSeverityToSentryLevel(envelope.severity));

      // Add tags
      scope.setTag('error_code', envelope.code);
      if (envelope.requestId) {
        scope.setTag('request_id', envelope.requestId);
      }

      // Add context
      if (envelope.context) {
        scope.setContext('error_context', envelope.context);
      }

      // Capture the error
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(envelope.message, 'error');
      }
    });
  }

  /**
   * Map framework error severity to Sentry severity level
   *
   * @param severity - Framework error severity
   * @returns Sentry severity level
   */
  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
    switch (severity) {
      case ErrorSeverity.FATAL:
        return 'fatal';
      case ErrorSeverity.CRITICAL:
        return 'error';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'error';
    }
  }
}

// Export singleton instance for convenience
export default ErrorReporter.getInstance();
