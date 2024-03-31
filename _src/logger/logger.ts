// import * as Sentry from '@sentry/node';
import cluster from 'cluster';
// import { Router } from 'express';
import winston from 'winston';
import { type LogLevel } from './logger.interface';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  public isSentryInitialized = false;

  private constructor() {
    const customFormat = this.getCustomFormat();

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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
        meta['Worker'] = cluster.worker.process.pid;
      }

      const metaString = Object.entries(meta)
        .map(([key, value]) => {
          return `${key}: ${value}`;
        })
        .join(' | ');

      // if (level === 'error') {
      //   if (this.isSentryInitialized) {
      //     Sentry.captureException(new Error(message));
      //   }
      // }

      return `[${timestamp}] ${level}: ${message}${metaString ? ` (${metaString})` : ''}`;
    });
  }

  // public initSentry({ expressApp }: { expressApp: Router }): void {
  //   if (!env.SENTRY_DSN) {
  //     this.logger.warn('Missing Sentry DSN when initializing Sentry');

  //     return;
  //   }

  //   Sentry.init({
  //     dsn: env.SENTRY_DSN,
  //     integrations: [
  //       new Sentry.Integrations.Http({ tracing: true }),
  //       new Sentry.Integrations.Express({ app: expressApp }),
  //     ],
  //     tracesSampleRate: 1.0,
  //     environment: env.NODE_ENV,
  //   });

  //   this.isSentryInitialized = true;
  // }

  public log(level: LogLevel, message: unknown, meta?: Record<string, unknown>): void {
    if (message instanceof Error) {
      const errorMessage = message.stack || message.toString();
      this.logger.log(level, errorMessage, meta);
    } else if (typeof message === 'string') {
      this.logger.log(level, message, meta);
    } else {
      this.logger.log(level, JSON.stringify(message), meta);
    }
  }

  public debug(message: unknown, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public info(message: unknown, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public warn(message: unknown, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public error(error: Error | unknown): void {
    this.log('error', error);
  }
}

export default Logger.getInstance();
