import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import cluster from 'cluster';
import winston from 'winston';
export class Logger {
    static instance;
    logger;
    environment;
    isSentryInitialized = false;
    constructor() {
        this.environment = process.env.NODE_ENV;
        const customFormat = this.getCustomFormat();
        const customLevels = {
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
        const customColors = {
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
            format: winston.format.combine(winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss',
            }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json()),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), customFormat),
                }),
            ],
        });
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    getCustomFormat() {
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
    initSentry({ sentryDsn, environment }) {
        if (!sentryDsn) {
            this.logger.warn('Missing Sentry DSN when initializing Sentry');
            return;
        }
        Sentry.init({
            dsn: sentryDsn,
            integrations: [
                nodeProfilingIntegration(),
            ],
            tracesSampleRate: 1.0,
            environment,
        });
        this.isSentryInitialized = true;
    }
    log(level, message, meta, options) {
        // if (options?.muteWorker) {
        // }
        if (message instanceof Error) {
            const errorMessage = message.stack || message.toString();
            this.logger.log(level, errorMessage, meta);
        }
        else if (typeof message === 'string') {
            this.logger.log(level, message, meta);
        }
        else {
            this.logger.log(level, JSON.stringify(message), meta);
        }
    }
    debug(message, meta, options) {
        this.log('debug', message, meta, options);
    }
    info(message, meta, options) {
        this.log('info', message, meta, options);
    }
    warn(message, meta, options) {
        this.log('warn', message, meta, options);
    }
    error(error, options) {
        this.log('error', error, undefined, options);
    }
    custom(level, message, meta, options) {
        this.log(level, message, meta, options);
    }
}
export default Logger.getInstance();
//# sourceMappingURL=logger.js.map