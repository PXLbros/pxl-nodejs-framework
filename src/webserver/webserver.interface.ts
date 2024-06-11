import { HTTPMethods } from 'fastify';
import { DatabaseInstance } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import { WebServerBaseControllerType } from './controller/base.interface.js';
import { ApplicationConfig } from '../application/application.interface.js';

export interface WebServerConstructorParams {
  /** Application configuration */
  applicationConfig: ApplicationConfig;

  /** Web server options */
  options: WebServerOptions;

  /** Web server routes */
  routes: WebServerRoute[];

  /** Redis instance */
  redisInstance: RedisInstance;

  /** Queue manager */
  queueManager: QueueManager;

  /** Database instance */
  databaseInstance: DatabaseInstance;
}

export interface WebServerRoute {
  /** Route path */
  path: string;

  /** Route method */
  method: HTTPMethods | HTTPMethods[];

  /** Route controller name */
  controllerName?: string;

  /** Route controller */
  controller?: WebServerBaseControllerType;

  /** Route action */
  action: string;

  /** Route validation */
  validation?: {
    /** Validation type */
    type: 'body' | 'query' | 'params';

    /** Validation schema */
    schema: { [key: string]: any };
  };
}

export interface WebServerDebugOptions {
  printRoutes: boolean;
}

export interface WebServerOptions {
  /** Web server host */
  host: string;

  /** Web server port */
  port: number;

  /** Web server CORS URLs */
  corsUrls?: string[];

  /** Web server controllers directory */
  controllersDirectory: string;

  /** Web server debug options */
  debug: WebServerDebugOptions;
}

// export interface WebServerLogParams {
//   /** Method */
//   Method: string;

//   /** Path */
//   Path: string;

//   /** Status code */
//   Status: number;

//   /** IP address */
//   IP?: string;

//   /** Execution time */
//   Time?: string;

//   [key: string]: unknown;
// }
