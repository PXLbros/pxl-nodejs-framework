import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import cluster from 'node:cluster';
import winston from 'winston';
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

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private environment: string | undefined;

  public isSentryInitialized = false;

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
      if (cluster.isWorker && cluster.worker) {
        meta['Worker'] = cluster.worker.id; // .process.pid;
      }

      const metaString = Object.entries(meta)
        .map(([key, value]) => {
          return `${key}: ${value}`;
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
    options,
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
  }): void {
    this.log({ level: 'debug', message, meta, options });
  }

  public info({
    message,
    meta,
    options,
  }: {
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void {
    this.log({ level: 'info', message, meta, options });
  }

  public warn({
    message,
    meta,
    options,
  }: {
    message: unknown;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void {
    this.log({ level: 'warn', message, meta, options });
  }

  public error({
    error,
    message,
    meta,
    options,
  }: {
    error: Error | unknown;
    message?: string;
    meta?: Record<string, unknown>;
    options?: LogOptions;
  }): void {
    if (message) {
      // If a message is provided, combine it with the error for better context
      const errorMessage = error instanceof Error ? error.message : String(error);
      const combinedMessage = `${message}: ${errorMessage}`;
      this.log({ level: 'error', message: combinedMessage, meta, options });

      // Also capture the original error for Sentry if it's an Error object
      if (error instanceof Error && this.isSentryInitialized) {
        Sentry.captureException(error);
      }
    } else {
      // Original behavior when no message is provided
      this.log({ level: 'error', message: error, meta, options });
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
