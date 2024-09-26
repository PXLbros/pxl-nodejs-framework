import { HTTPMethods } from 'fastify';
import { DatabaseInstance, DynamicEntity } from '../database/index.js';
import { QueueManager } from '../queue/index.js';
import { RedisInstance } from '../redis/index.js';
import { WebServerBaseControllerType } from './controller/base.interface.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import EventManager from '../event/manager.js';

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

  /** Event manager */
  eventManager: EventManager;

  /** Database instance */
  databaseInstance: DatabaseInstance;
}

export enum WebServerRouteType {
  Default = 'default',
  Entity = 'entity',
}

export interface BaseWebServerRoute {
  /** Route type */
  type?: WebServerRouteType;

  /** Route path */
  path: string;

  /** Route controller name */
  controllerName?: string;

  /** Route controller */
  controller?: WebServerBaseControllerType;

  /** Route validation */
  validation?: {
    /** Validation type */
    type: 'body' | 'query' | 'params';

    /** Validation schema */
    schema: { [key: string]: any };
  };
}

export interface DefaultWebServerRoute extends BaseWebServerRoute {
  type: WebServerRouteType.Default;

  /** Route method */
  method: HTTPMethods | HTTPMethods[];

  /** Route action */
  action: string;
}

export interface EntityWebServerRoute extends BaseWebServerRoute {
  type: WebServerRouteType.Entity;

  /** Entity name */
  entityName: string;
}

export type WebServerRoute = DefaultWebServerRoute | EntityWebServerRoute;

export interface RouteValidationSchema {
  type: 'body' | 'query' | 'params';
  schema: {
    type: 'object';
    properties: { [key: string]: any };
    required: string[];
  };
}

export interface EntityRouteDefinition {
  path: string;
  method: HTTPMethods | HTTPMethods[];
  action: string;
  validationSchema?: RouteValidationSchema;
}

export interface WebServerLogConfig {
  startUp?: boolean;
}

export interface WebServerDebugOptions {
  printRoutes?: boolean;
}

export interface WebServerCorsBaseOptions {
  /** Whether CORS is enabled */
  enabled: boolean;
}

export interface WebServerCorsDisabledOptionsBase {
  enabled: false;
}

export interface WebServerCorsEnabledOptionsBase {
  enabled: true;
}

export interface WebServerCorsEnabledOptions extends WebServerCorsEnabledOptionsBase {
  urls: string[];
}

export type WebServerCorsOptions = WebServerCorsDisabledOptionsBase | WebServerCorsEnabledOptions;

export interface WebServerOptions {
  /** Web server host */
  host: string;

  /** Web server port */
  port: number;

  /** Web server CORS options */
  cors?: WebServerCorsOptions;

  /** Web server controllers directory */
  controllersDirectory: string;

  log?: WebServerLogConfig;

  /** Web server debug options */
  debug?: WebServerDebugOptions;
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
