import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import cluster from 'node:cluster';
import winston from 'winston';
import type { LogOptions } from '../websocket/utils.js';
import { getRequestId } from '../request-context/index.js';
import { safeSerializeError } from '../error/error-reporter.js';

export type LoggerLevels =
  | 'error'
  | 'warn'
  | 'info'
  | 'command'
  | 'database'
  | 'redis'
  | 'webServer'
  | 'webSocket'
  | 'queue'
  | 'queueJob'
  | 'event'
  | 'debug';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private environment: string | undefined;

  public isSentryInitialized = false;

  private showRequestIdInConsole = true;

  private constructor() {
    this.environment = process.env.NODE_ENV;

    const customFormat = this.getCustomFormat();

    const customLevels: winston.config.AbstractConfigSetLevels = {
      error: 0,
      warn: 1,
      info: 2,
      command: 3,
      database: 4,
      redis: 5,
      webServer: 6,
      webSocket: 7,
      queue: 8,
      queueJob: 9,
      event: 10,
      debug: 11,
    };

    const customColors: winston.config.AbstractConfigSetColors = {
      error: 'red',
      warn: 'yellow',
      info: 'blue',
      command: 'cyan',
      database: 'brightGreen',
      redis: 'brightYellow',
      webServer: 'brightBlue',
      webSocket: 'brightMagenta',
      queue: 'gray',
      queueJob: 'blue',
      event: 'brightGreen',
      debug: 'brightCyan',
    };

    winston.addColors(customColors);

    this.logger = winston.createLogger({
      levels: customLevels,
      level: this.environment === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), customFormat),
        }),
      ],
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }

    return Logger.instance;
  }

  private getCustomFormat(): winston.Logform.Format {
    return winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // Auto-inject request ID from AsyncLocalStorage context if available
      const requestId = getRequestId();
      if (requestId && !meta['requestId'] && this.showRequestIdInConsole) {
        meta['requestId'] = requestId;
      }

      if (cluster.isWorker && cluster.worker) {
        meta['Worker'] = cluster.worker.id; // .process.pid;
      }

      const metaString = Object.entries(meta)
        .map(([key, value]) => {
          // Safely convert value to string representation
          let stringValue: string;

          if (value === null) {
            stringValue = 'null';
          } else if (value === undefined) {
            stringValue = 'undefined';
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            stringValue = String(value);
          } else if (value instanceof Error) {
            stringValue = value.message;
          } else if (value instanceof Promise) {
            stringValue = '[Promise]';
          } else if (typeof value === 'object') {
            try {
              // Attempt to JSON.stringify, but handle circular references
              stringValue = JSON.stringify(value);
            } catch {
              // Fallback for circular references or other issues
              stringValue = '[Object]';
            }
          } else {
            stringValue = String(value);
          }

          return `${key}: ${stringValue}`;
        })
        .join(' | ');

      if (level === 'error') {
        if (this.isSentryInitialized) {
          const errorMessage = typeof message === 'string' ? message : JSON.stringify(message);

          Sentry.captureException(new Error(errorMessage));
        }
      }

      return `[${timestamp}] ${level}: ${message}${metaString ? ` (${metaString})` : ''}`;
    });
  }

  public configure({ showRequestIdInConsole }: { showRequestIdInConsole?: boolean }): void {
    if (showRequestIdInConsole !== undefined) {
      this.showRequestIdInConsole = showRequestIdInConsole;
    }
  }

  public initSentry({ sentryDsn, environment }: { sentryDsn: string; environment: string }): void {
    if (!sentryDsn) {
      this.logger.warn('Missing Sentry DSN when initializing Sentry');

      return;
    }

    Sentry.init({
      dsn: sentryDsn,
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: 1.0,
      environment,
    });

    this.isSentryInitialized = true;
  }

  public log({
    level,
    message,
    meta,
    options: _options,
  }: {
    level: LoggerLevels;
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void {
    // if (options?.muteWorker) {
    // }

    if (message instanceof Error) {
      const errorMessage = message.stack ?? message.toString();
      this.logger.log(level, errorMessage, meta);
    } else if (typeof message === 'string') {
      this.logger.log(level, message, meta);
    } else {
      this.logger.log(level, JSON.stringify(message), meta);
    }
  }

  public debug({
    message,
    meta,
    options,
  }: {
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void;
  public debug(message: unknown, meta?: Record<string, unknown>): void;
  public debug(
    messageOrOptions: unknown | { message: unknown; meta?: Record<string, unknown>; options?: LogOptions },
    meta?: Record<string, unknown>,
  ): void {
    if (typeof messageOrOptions === 'object' && messageOrOptions !== null && 'message' in messageOrOptions) {
      const {
        message,
        meta: optionsMeta,
        options,
      } = messageOrOptions as { message: unknown; meta?: Record<string, unknown>; options?: LogOptions };
      this.log({ level: 'debug', message, meta: optionsMeta, options });
    } else {
      this.log({ level: 'debug', message: messageOrOptions, meta, options: undefined });
    }
  }

  public info({
    message,
    meta,
    options,
  }: {
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void;
  public info(message: unknown, meta?: Record<string, unknown>): void;
  public info(
    messageOrOptions: unknown | { message: unknown; meta?: Record<string, unknown>; options?: LogOptions },
    meta?: Record<string, unknown>,
  ): void {
    if (typeof messageOrOptions === 'object' && messageOrOptions !== null && 'message' in messageOrOptions) {
      const {
        message,
        meta: optionsMeta,
        options,
      } = messageOrOptions as { message: unknown; meta?: Record<string, unknown>; options?: LogOptions };
      this.log({ level: 'info', message, meta: optionsMeta, options });
    } else {
      this.log({ level: 'info', message: messageOrOptions, meta, options: undefined });
    }
  }

  public warn({
    message,
    meta,
    options,
  }: {
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void;
  public warn(message: unknown, meta?: Record<string, unknown>): void;
  public warn(
    messageOrOptions: unknown | { message: unknown; meta?: Record<string, unknown>; options?: LogOptions },
    meta?: Record<string, unknown>,
  ): void {
    if (typeof messageOrOptions === 'object' && messageOrOptions !== null && 'message' in messageOrOptions) {
      const {
        message,
        meta: optionsMeta,
        options,
      } = messageOrOptions as { message: unknown; meta?: Record<string, unknown>; options?: LogOptions };
      this.log({ level: 'warn', message, meta: optionsMeta, options });
    } else {
      this.log({ level: 'warn', message: messageOrOptions, meta, options: undefined });
    }
  }

  // Overload 1: Object signature (existing usage)
  public error(args: {
    error: Error | unknown;
    message?: string;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void;
  // Overload 2: Positional signature (new usage)
  public error(error: Error | unknown, message?: string, meta?: Record<string, unknown>, options?: LogOptions): void;
  public error(
    arg1:
      | { error: Error | unknown; message?: string; meta?: Record<string, unknown>; options?: LogOptions }
      | (Error | unknown),
    message?: string,
    meta?: Record<string, unknown>,
    options?: LogOptions,
  ): void {
    // Support original object signature: Logger.error({ error, message?, meta?, options? })
    if (
      typeof arg1 === 'object' &&
      arg1 !== null &&
      'error' in arg1 &&
      // If the caller passed a second positional arg, treat it as new signature
      message === undefined
    ) {
      const {
        error,
        message: objMessage,
        meta: objMeta,
        options: objOptions,
      } = arg1 as {
        error: Error | unknown;
        message?: string;
        meta?: Record<string, unknown>;
        options?: LogOptions;
      };

      if (objMessage) {
        const errorMessage = error instanceof Error ? error.message : safeSerializeError(error);
        const combinedMessage = `${objMessage}: ${errorMessage}`;
        // Preserve stack & name when Error instance so callers get actionable traces
        let enhancedMeta = objMeta;
        if (error instanceof Error) {
          enhancedMeta = {
            ...objMeta,
            name: error.name,
            stack: error.stack,
          };
        }
        this.log({ level: 'error', message: combinedMessage, meta: enhancedMeta, options: objOptions });
        if (error instanceof Error && this.isSentryInitialized) {
          Sentry.captureException(error);
        }
      } else {
        // When no custom message, log the raw error. If it's an Error, pass stack & name.
        if (error instanceof Error) {
          const enhancedMeta = {
            ...objMeta,
            name: error.name,
            stack: error.stack,
          };
          // For consistency use the Error object message as primary message
          this.log({ level: 'error', message: error, meta: enhancedMeta, options: objOptions });
        } else {
          this.log({ level: 'error', message: error, meta: objMeta, options: objOptions });
        }
        if (error instanceof Error && this.isSentryInitialized) {
          Sentry.captureException(error);
        }
      }
      return;
    }

    // New positional signature: Logger.error(error, message?, meta?, options?)
    const errorObj = arg1;
    if (message) {
      const errorMessage = errorObj instanceof Error ? errorObj.message : safeSerializeError(errorObj);
      const combinedMessage = `${message}: ${errorMessage}`;
      this.log({ level: 'error', message: combinedMessage, meta, options });
    } else {
      this.log({ level: 'error', message: errorObj, meta, options });
    }
    if (errorObj instanceof Error && this.isSentryInitialized) {
      Sentry.captureException(errorObj);
    }
  }

  public custom({
    level,
    message,
    meta,
    options,
  }: {
    level: LoggerLevels;
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void {
    this.log({ level, message, meta, options });
  }
}

export default Logger.getInstance();
