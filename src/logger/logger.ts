import * as Sentry from '@sentry/node';
import cluster from 'cluster';
import winston from 'winston';

class Logger {
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
      debug: 4,
    };

    const customColors: winston.config.AbstractConfigSetColors = {
      error: 'red',
      warn: 'yellow',
      info: 'green',
      command: 'cyan',
      debug: 'blue',
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
        meta['Worker'] = cluster.worker.process.pid;
      }

      const metaString = Object.entries(meta)
        .map(([key, value]) => {
          return `${key}: ${value}`;
        })
        .join(' | ');

      if (level === 'error') {
        if (this.isSentryInitialized) {
          Sentry.captureException(new Error(message));
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
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
      ],
      tracesSampleRate: 1.0,
      environment,
    });

    this.isSentryInitialized = true;
  }

  public log(level: 'debug' | 'info' | 'warn' | 'error' | 'command', message: unknown, meta?: Record<string, unknown>): void {
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

  public command(message: unknown, meta?: Record<string, unknown>): void {
    this.log('command', message, meta);
  }
}

export default Logger.getInstance();
