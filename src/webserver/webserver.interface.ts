import type { FastifyReply, FastifyRequest, HTTPMethods, RouteGenericInterface } from 'fastify';
import type { DatabaseInstance } from '../database/index.js';
import type { QueueManager } from '../queue/index.js';
import type { RedisInstance } from '../redis/index.js';
import type { ControllerAction, WebServerBaseControllerType } from './controller/base.interface.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type EventManager from '../event/manager.js';
import type { LifecycleManager } from '../lifecycle/lifecycle-manager.js';
import type { z } from 'zod';

export interface RouteSchemaDefinition<
  TParams extends z.ZodTypeAny | undefined = undefined,
  TQuery extends z.ZodTypeAny | undefined = undefined,
  TBody extends z.ZodTypeAny | undefined = undefined,
  TReply extends Record<number | `${number}`, z.ZodTypeAny> | undefined = undefined,
  THeaders extends z.ZodTypeAny | undefined = undefined,
> {
  params?: TParams;
  querystring?: TQuery;
  body?: TBody;
  response?: TReply;
  headers?: THeaders;
}

type InferOrDefault<TZod extends z.ZodTypeAny | undefined, TFallback> = TZod extends z.ZodTypeAny
  ? z.input<TZod>
  : TFallback;

type InferResponse<TResponse> =
  TResponse extends Record<number | `${number}`, z.ZodTypeAny>
    ? z.output<TResponse[keyof TResponse]>
    : RouteGenericInterface['Reply'];

export interface RouteHandlerContext<Schema extends RouteSchemaDefinition | undefined = undefined>
  extends RouteGenericInterface {
  Params?: Schema extends RouteSchemaDefinition<infer TParams, any, any, any, any>
    ? InferOrDefault<TParams, RouteGenericInterface['Params']>
    : RouteGenericInterface['Params'];
  Querystring?: Schema extends RouteSchemaDefinition<any, infer TQuery, any, any, any>
    ? InferOrDefault<TQuery, RouteGenericInterface['Querystring']>
    : RouteGenericInterface['Querystring'];
  Body?: Schema extends RouteSchemaDefinition<any, any, infer TBody, any, any>
    ? InferOrDefault<TBody, RouteGenericInterface['Body']>
    : RouteGenericInterface['Body'];
  Headers?: Schema extends RouteSchemaDefinition<any, any, any, any, infer THeaders>
    ? InferOrDefault<THeaders, RouteGenericInterface['Headers']>
    : RouteGenericInterface['Headers'];
  Reply?: Schema extends RouteSchemaDefinition<any, any, any, infer TReply, any>
    ? InferResponse<TReply>
    : RouteGenericInterface['Reply'];
}

export type AnyRouteSchemaDefinition = RouteSchemaDefinition<
  z.ZodTypeAny | undefined,
  z.ZodTypeAny | undefined,
  z.ZodTypeAny | undefined,
  Record<number | `${number}`, z.ZodTypeAny> | undefined,
  z.ZodTypeAny | undefined
>;

export type RouteHandler<Schema extends RouteSchemaDefinition | undefined = undefined> = (
  request: FastifyRequest<RouteHandlerContext<Schema>>,
  reply: FastifyReply,
) => Promise<RouteHandlerContext<Schema>['Reply'] | void> | RouteHandlerContext<Schema>['Reply'] | void;

export interface WebServerConstructorParams {
  /** Application configuration */
  applicationConfig: ApplicationConfig;

  /** Web server options */
  options: WebServerOptions;

  /** Web server routes */
  routes?: WebServerRoute[];

  /** Redis instance */
  redisInstance: RedisInstance;

  /** Queue manager */
  queueManager: QueueManager;

  /** Event manager */
  eventManager: EventManager;

  /** Database instance */
  databaseInstance: DatabaseInstance;

  /** Lifecycle manager */
  lifecycleManager: LifecycleManager;
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

  /** Typed route handler */
  handler?: ControllerAction<any>;

  /** Zod-based schema definition */
  schema?: AnyRouteSchemaDefinition;
}

export interface DefaultWebServerRoute extends BaseWebServerRoute {
  type: WebServerRouteType.Default;

  /** Route method */
  method: HTTPMethods | HTTPMethods[];

  /** Route action */
  action?: string;
}

export interface EntityWebServerRoute extends BaseWebServerRoute {
  type: WebServerRouteType.Entity;

  /** Entity name */
  entityName: string;
}

export type WebServerRoute = DefaultWebServerRoute | EntityWebServerRoute;

export interface EntityRouteDefinition {
  path: string;
  method: HTTPMethods | HTTPMethods[];
  action: string;
}

export interface WebServerLogConfig {
  startUp?: boolean;
  /** Paths to exclude from request logging (e.g., ['/health', '/health/live', '/health/ready']) */
  excludePaths?: string[];
}

export interface WebServerDebugOptions {
  printRoutes?: boolean;
  simulateSlowConnection?: {
    enabled?: boolean;
    delay?: number;
  };
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

export interface WebServerErrorsOptions {
  verbose: boolean;
}

export interface WebServerSecurityHelmetOptions {
  enabled?: boolean;
  contentSecurityPolicy?: boolean;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: boolean;
  hidePoweredBy?: boolean;
  hsts?: boolean;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean;
  xssFilter?: boolean;
}

export interface WebServerSecurityRateLimitOptions {
  enabled?: boolean;
  max?: number;
  timeWindow?: string;
  ban?: number;
  cache?: number;
}

export interface WebServerSecurityOptions {
  helmet?: WebServerSecurityHelmetOptions;
  rateLimit?: WebServerSecurityRateLimitOptions;
}

export interface WebServerOptions {
  /** Web server host */
  host: string;

  /** Web server port */
  port: number;

  /** Maximum request body size in bytes (default: 25MB) */
  bodyLimit?: number;

  /** Connection timeout in milliseconds (default: 10s) */
  connectionTimeout?: number;

  /** Web server CORS options */
  cors?: WebServerCorsOptions;

  /** Web server error options */
  errors?: WebServerErrorsOptions;

  /** Web server controllers directory */
  controllersDirectory: string;

  /** Optional directory containing route definition files */
  routesDirectory?: string;

  log?: WebServerLogConfig;

  /** Web server security options (helmet, rate limiting) */
  security?: WebServerSecurityOptions;

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
