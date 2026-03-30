import cluster from 'node:cluster';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import pino from 'pino';
import { safeSerializeError } from '../error/error-reporter.js';
import { getRequestId } from '../request-context/index.js';
import type { LogOptions } from '../websocket/utils.js';

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

// Map custom levels to numeric values (lower = more severe, matching Pino convention)
const customLevels = {
  error: 10,
  warn: 20,
  info: 30,
  command: 35,
  database: 40,
  redis: 45,
  webServer: 50,
  webSocket: 55,
  queue: 60,
  queueJob: 65,
  event: 70,
  debug: 80,
} as const;

type CustomLogger = pino.Logger<keyof typeof customLevels>;

export class Logger {
  private static instance: Logger;
  private logger: CustomLogger;

  private environment: string | undefined;

  public isSentryInitialized = false;

  private showRequestIdInConsole = true;

  private constructor() {
    this.environment = process.env.NODE_ENV;

    this.logger = pino({
      customLevels,
      useOnlyCustomLevels: true,
      level: this.environment === 'production' ? 'info' : 'debug',
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
          customLevels: Object.entries(customLevels)
            .map(([name, num]) => `${name}:${num}`)
            .join(','),
          customColors:
            'error:red,warn:yellow,info:blue,command:cyan,database:greenBright,redis:yellowBright,webServer:blueBright,webSocket:magentaBright,queue:gray,queueJob:blue,event:greenBright,debug:cyanBright',
          useOnlyCustomProps: false,
        },
      },
    });
  }

  /** Get the underlying Pino logger instance (useful for Fastify integration) */
  public get pinoInstance(): CustomLogger {
    return this.logger;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }

    return Logger.instance;
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

  private buildMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    const enriched: Record<string, unknown> = { ...meta };

    // Auto-inject request ID from AsyncLocalStorage context if available
    const requestId = getRequestId();
    if (requestId && !enriched.requestId && this.showRequestIdInConsole) {
      enriched.requestId = requestId;
    }

    if (cluster.isWorker && cluster.worker) {
      enriched.Worker = cluster.worker.id;
    }

    return enriched;
  }

  private formatMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.stack ?? message.toString();
    }
    if (typeof message === 'string') {
      return message;
    }
    return JSON.stringify(message);
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
    const enrichedMeta = this.buildMeta(meta);
    const msg = this.formatMessage(message);

    this.logger[level](enrichedMeta, msg);

    if (level === 'error' && this.isSentryInitialized) {
      const errorMessage = typeof message === 'string' ? message : JSON.stringify(message);
      Sentry.captureException(new Error(errorMessage));
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
