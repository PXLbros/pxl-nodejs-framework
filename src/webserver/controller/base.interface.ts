import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type { DatabaseInstance } from '../../database/index.js';
import type EventManager from '../../event/manager.js';
import type { QueueManager } from '../../queue/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type { WebServerOptions } from '../webserver.interface.js';
import type WebServerBaseController from './base.js';
import type { LifecycleManager } from '../../lifecycle/lifecycle-manager.js';

export interface WebServerBaseControllerConstructorParams {
  applicationConfig: ApplicationConfig;
  webServerOptions: WebServerOptions;

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  eventManager: EventManager;
  databaseInstance: DatabaseInstance;
  lifecycleManager: LifecycleManager;
}

export type WebServerBaseControllerType = new (
  params: WebServerBaseControllerConstructorParams,
) => WebServerBaseController;

export interface ApiResponse<T = any> {
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
  details?: any;
  timestamp: string;
  requestId: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
