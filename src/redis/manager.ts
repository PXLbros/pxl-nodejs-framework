import { Redis, type RedisOptions } from 'ioredis';
import { EventEmitter } from 'node:events';
import type { RedisManagerConfig as RedisManagerOptions } from './manager.interface.js';
import RedisInstance from './instance.js';
import { Logger } from '../logger/index.js';
import { CachePerformanceWrapper } from '../performance/index.js';
import { safeSerializeError } from '../error/error-reporter.js';

const truthyPattern = /^(1|true|yes|on)$/i;
const scheduleMicrotask =
  typeof (globalThis as any).queueMicrotask === 'function'
    ? (globalThis as any).queueMicrotask.bind(globalThis)
    : (callback: () => void) => {
        void Promise.resolve().then(callback);
      };

type RedisCallback = (error: Error | null, result?: string) => void;

interface InMemoryRedisSharedState {
  store: Map<string, string | Buffer>;
  expirations: Map<string, NodeJS.Timeout>;
  subscriptions: Map<string, Set<InMemoryRedisClient>>;
}

// Global singleton shared state for in-memory Redis
let globalInMemoryRedisState: InMemoryRedisSharedState | null = null;

function getGlobalInMemoryRedisState(): InMemoryRedisSharedState {
  globalInMemoryRedisState ??= {
    store: new Map<string, string | Buffer>(),
    expirations: new Map<string, NodeJS.Timeout>(),
    subscriptions: new Map<string, Set<InMemoryRedisClient>>(),
  };
  return globalInMemoryRedisState;
}

class InMemoryRedisClient extends EventEmitter {
  private shared: InMemoryRedisSharedState;

  constructor(shared: InMemoryRedisSharedState) {
    super();
    this.shared = shared;

    scheduleMicrotask(() => {
      this.emit('ready');
    });
  }

  private cleanupSubscriptions(): void {
    for (const subscribers of this.shared.subscriptions.values()) {
      subscribers.delete(this);
    }
  }

  private clearExpirationForKey(key: string): void {
    const timer = this.shared.expirations.get(key);
    if (timer) {
      clearTimeout(timer);
      this.shared.expirations.delete(key);
    }
  }

  public ping(callback?: RedisCallback): Promise<string> {
    if (callback) {
      callback(null, 'PONG');
      return Promise.resolve('PONG');
    }

    return Promise.resolve('PONG');
  }

  public async set(...args: any[]): Promise<'OK'> {
    const [key, value, mode, expiration] = args;
    const serializedValue: string | Buffer = value instanceof Buffer ? value : String(value);

    this.shared.store.set(key, serializedValue);
    this.clearExpirationForKey(key);

    if (typeof mode === 'string' && mode.toUpperCase() === 'EX' && typeof expiration === 'number') {
      const timer = setTimeout(() => {
        this.shared.store.delete(key);
        this.shared.expirations.delete(key);
      }, expiration * 1000);

      if (typeof timer.unref === 'function') {
        timer.unref();
      }

      this.shared.expirations.set(key, timer);
    }

    return 'OK';
  }

  public async get(key: string): Promise<string | null> {
    return (this.shared.store.get(key) as string | undefined) ?? null;
  }

  public async del(key: string): Promise<number> {
    const existed = this.shared.store.delete(key);
    this.clearExpirationForKey(key);
    return existed ? 1 : 0;
  }

  public async publish(channel: string, message: string): Promise<number> {
    const subscribers = this.shared.subscriptions.get(channel);

    if (!subscribers || subscribers.size === 0) {
      return 0;
    }

    for (const subscriber of subscribers) {
      scheduleMicrotask(() => {
        subscriber.emit('message', channel, message);
      });
    }

    return subscribers.size;
  }

  public async subscribe(channel: string): Promise<number> {
    let subscribers = this.shared.subscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Set<InMemoryRedisClient>();
      this.shared.subscriptions.set(channel, subscribers);
    }
    subscribers.add(this);
    return subscribers.size;
  }

  public async unsubscribe(channel: string): Promise<number> {
    const subscribers = this.shared.subscriptions.get(channel);

    if (!subscribers) {
      return 0;
    }

    subscribers.delete(this);
    return subscribers.size;
  }

  public async quit(): Promise<'OK'> {
    this.cleanupSubscriptions();
    this.emit('end');
    this.removeAllListeners();
    return 'OK';
  }

  public disconnect(): void {
    this.cleanupSubscriptions();
    this.emit('end');
    this.removeAllListeners();
  }
}

export default class RedisManager {
  private logger: typeof Logger = Logger;

  private options: RedisManagerOptions;

  public instances: RedisInstance[] = [];

  constructor(config: RedisManagerOptions) {
    this.options = config;
  }

  public async connect(): Promise<RedisInstance> {
    return CachePerformanceWrapper.monitorConnection(
      'connect',
      async () => {
        const startTime = performance.now();

        const redisOptions: RedisOptions = {
          host: this.options.host,
          port: this.options.port,
          password: this.options.password,
          maxRetriesPerRequest: null, // Needed for bullmq
          lazyConnect: true, // Prevent automatic connection to avoid unhandled errors
        };

        const useInMemoryRedis =
          truthyPattern.test(process.env.PXL_REDIS_IN_MEMORY ?? '') ||
          truthyPattern.test(process.env.REDIS_IN_MEMORY ?? '');

        const createClient = (): Redis => {
          if (useInMemoryRedis) {
            return new InMemoryRedisClient(getGlobalInMemoryRedisState()) as unknown as Redis;
          }

          const client = new Redis(redisOptions);
          // Attach a temporary error handler to prevent unhandled errors during connection
          const errorHandler = (error: Error) => {
            // Error will be handled by the promise rejection below
          };
          client.once('error', errorHandler);
          return client;
        };

        const client = createClient();
        const publisherClient = createClient();
        const subscriberClient = createClient();

        try {
          // For non-in-memory clients, explicitly connect since we use lazyConnect
          if (!useInMemoryRedis) {
            await Promise.all([client.connect(), publisherClient.connect(), subscriberClient.connect()]);
          } else {
            // Wait for in-memory clients to be ready
            await Promise.all([
              new Promise<void>((resolve, reject) => {
                client.once('ready', () => resolve());
                client.once('error', (error: Error) => reject(error));
              }),
              new Promise<void>((resolve, reject) => {
                publisherClient.once('ready', () => resolve());
                publisherClient.once('error', (error: Error) => reject(error));
              }),
              new Promise<void>((resolve, reject) => {
                subscriberClient.once('ready', () => resolve());
                subscriberClient.once('error', (error: Error) => reject(error));
              }),
            ]);
          }

          const redisInstance = new RedisInstance({
            redisManager: this,
            client,
            publisherClient,
            subscriberClient,
          });

          this.instances.push(redisInstance);

          const duration = performance.now() - startTime;
          const meta = {
            Host: this.options.host,
            Port: this.options.port,
            Duration: `${duration.toFixed(2)}ms`,
            Mode: useInMemoryRedis ? 'in-memory' : 'network',
          };

          if (this.options.applicationConfig.log?.startUp) {
            this.log('Connected', meta);
          } else {
            this.logger.debug({ message: 'Redis connected', meta });
          }

          if (useInMemoryRedis) {
            this.logger.debug({ message: 'Using in-memory Redis stub' });
          }

          return redisInstance;
        } catch (error) {
          const duration = performance.now() - startTime;

          // Clean up clients on error
          await Promise.allSettled([client.quit(), publisherClient.quit(), subscriberClient.quit()]);

          this.logger.error({
            error: error instanceof Error ? error : new Error(safeSerializeError(error)),
            message: 'Redis connection failed',
            meta: {
              Host: this.options.host,
              Port: this.options.port,
              Duration: `${duration.toFixed(2)}ms`,
              Mode: useInMemoryRedis ? 'in-memory' : 'network',
            },
          });

          throw error;
        }
      },
      { host: this.options.host, port: this.options.port },
    );
  }

  public async disconnect(): Promise<void> {
    await CachePerformanceWrapper.monitorConnection(
      'disconnect',
      async () => {
        const startTime = performance.now();
        const instanceCount = this.instances.length;

        try {
          await Promise.all(this.instances.map(instance => instance.disconnect()));

          const duration = performance.now() - startTime;

          if (instanceCount > 0) {
            const meta = {
              Instances: instanceCount,
              Host: this.options.host,
              Port: this.options.port,
              Duration: `${duration.toFixed(2)}ms`,
            };

            if (this.options.applicationConfig.log?.startUp) {
              this.log('Disconnected all Redis instances', meta);
            } else {
              this.logger.debug({ message: 'Redis instances disconnected', meta });
            }
          }

          this.instances = [];
        } catch (error) {
          const duration = performance.now() - startTime;

          this.logger.error({
            error: error instanceof Error ? error : new Error(safeSerializeError(error)),
            message: 'Redis disconnection failed',
            meta: {
              Host: this.options.host,
              Port: this.options.port,
              Instances: instanceCount,
              Duration: `${duration.toFixed(2)}ms`,
            },
          });

          throw error;
        }
      },
      { host: this.options.host, port: this.options.port },
    );
  }

  /**
   * Log Redis message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'redis', message, meta });
  }
}
