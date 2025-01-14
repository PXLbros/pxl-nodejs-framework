import { LogOptions } from '../websocket/utils.js';
export type LoggerLevels = 'error' | 'warn' | 'info' | 'command' | 'database' | 'redis' | 'webServer' | 'webSocket' | 'queue' | 'queueJob' | 'event' | 'debug';
export declare class Logger {
    private static instance;
    private logger;
    private environment;
    isSentryInitialized: boolean;
    private constructor();
    static getInstance(): Logger;
    private getCustomFormat;
    initSentry({ sentryDsn, environment }: {
        sentryDsn: string;
        environment: string;
    }): void;
    log(level: LoggerLevels, message: unknown, meta?: Record<string, unknown>, options?: LogOptions): void;
    debug(message: unknown, meta?: Record<string, unknown>, options?: LogOptions): void;
    info(message: unknown, meta?: Record<string, unknown>, options?: LogOptions): void;
    warn(message: unknown, meta?: Record<string, unknown>, options?: LogOptions): void;
    error(error: Error | unknown, options?: LogOptions): void;
    custom(level: LoggerLevels, message: unknown, meta?: Record<string, unknown>, options?: LogOptions): void;
}
declare const _default: Logger;
export default _default;
//# sourceMappingURL=logger.d.ts.map