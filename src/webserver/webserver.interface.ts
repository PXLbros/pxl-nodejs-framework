import { HTTPMethods } from 'fastify';
import { DatabaseInstance } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import { BaseControllerType } from './controller/base.interface.js';

export interface WebServerConstructorParams {
  options: WebServerOptions;
  routes: WebServerRoute[];

  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export interface WebServerRoute {
  path: string;
  method: HTTPMethods | HTTPMethods[];
  controllerName?: string;
  controller?: BaseControllerType;
  action: string;
  validation?: {
    type: 'body' | 'query' | 'params';
    schema: { [key: string]: any };
  };
}

export interface WebServerOptions {
  port: number;
  corsUrls?: string[];
  controllersDirectory: string;
}
