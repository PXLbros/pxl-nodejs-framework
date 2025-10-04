import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type { DatabaseInstance } from '../../database/index.js';
import type EventManager from '../../event/manager.js';
import type { QueueManager } from '../../queue/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type { WebServerOptions } from '../webserver.interface.js';
import type WebServerBaseController from './base.js';
import type { LifecycleManager } from '../../lifecycle/lifecycle-manager.js';

export interface WebServerBaseControllerConstructorParams<
  TQueueManager extends QueueManager = QueueManager,
  TRedisInstance extends RedisInstance = RedisInstance,
  TEventManager extends EventManager = EventManager,
  TDatabaseInstance extends DatabaseInstance = DatabaseInstance,
> {
  applicationConfig: ApplicationConfig;
  webServerOptions: WebServerOptions;

  redisInstance: TRedisInstance;
  queueManager: TQueueManager;
  eventManager: TEventManager;
  databaseInstance: TDatabaseInstance;
  lifecycleManager: LifecycleManager;
}

export type WebServerBaseControllerType<
  TQueueManager extends QueueManager = QueueManager,
  TRedisInstance extends RedisInstance = RedisInstance,
  TEventManager extends EventManager = EventManager,
  TDatabaseInstance extends DatabaseInstance = DatabaseInstance,
> = new (
  params: WebServerBaseControllerConstructorParams<TQueueManager, TRedisInstance, TEventManager, TDatabaseInstance>,
) => WebServerBaseController<TQueueManager, TRedisInstance, TEventManager, TDatabaseInstance>;

export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    requestId: string;
  };
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code?: string;
  type: 'validation' | 'authentication' | 'authorization' | 'not_found' | 'server_error' | 'client_error';
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
