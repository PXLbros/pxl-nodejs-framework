import type { HTTPMethods } from 'fastify';
import {
  type AnyRouteSchemaDefinition,
  type RouteSchemaDefinition,
  type WebServerRoute,
  WebServerRouteType,
} from './webserver.interface.js';
import type { ControllerAction, WebServerBaseControllerType } from './controller/base.interface.js';

export interface DefineRouteConfig<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined,
  Handler extends ControllerAction<Schema>,
> {
  method: HTTPMethods | HTTPMethods[];
  path: string;
  schema?: Schema;
  handler: Handler;
}

export interface DefineRouteWithControllerConfig<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined = undefined,
> {
  method: HTTPMethods | HTTPMethods[];
  path: string;
  schema?: Schema;
  controller: WebServerBaseControllerType;
  action: string;
}

/**
 * Define a route with an inline handler function.
 * Provides full type inference for request parameters based on the schema.
 *
 * @example
 * const helloSchema = {
 *   body: z.object({ name: z.string() }),
 *   response: { 200: z.object({ message: z.string() }) }
 * } satisfies RouteSchemaDefinition;
 *
 * defineRoute({
 *   method: 'POST',
 *   path: '/hello',
 *   schema: helloSchema,
 *   handler: async (request, reply) => {
 *     // request.body is typed as { name: string }
 *     return reply.send({ message: `Hello ${request.body.name}` });
 *   }
 * });
 */
export function defineRoute<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined,
  Handler extends ControllerAction<Schema>,
>(config: DefineRouteConfig<Schema, Handler>): WebServerRoute;

/**
 * Define a route with a controller and action method.
 * Note: Type inference for controller actions is limited. Consider using inline handlers for full type safety.
 *
 * @example
 * defineRoute({
 *   method: 'POST',
 *   path: '/hello',
 *   controller: HelloController,
 *   action: 'create',
 *   schema: helloSchema
 * });
 */
// eslint-disable-next-line no-redeclare
export function defineRoute<Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined = undefined>(
  config: DefineRouteWithControllerConfig<Schema>,
): WebServerRoute;

// eslint-disable-next-line no-redeclare
export function defineRoute<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined,
  Handler extends ControllerAction<Schema>,
>(config: DefineRouteConfig<Schema, Handler> | DefineRouteWithControllerConfig<Schema>): WebServerRoute {
  const route: WebServerRoute = {
    type: WebServerRouteType.Default,
    method: config.method,
    path: config.path,
  };

  if ('handler' in config) {
    route.handler = config.handler as ControllerAction<any>;
  } else if ('controller' in config && 'action' in config) {
    route.controller = config.controller;
    route.action = config.action;
  }

  if (config.schema) {
    route.schema = config.schema as AnyRouteSchemaDefinition;
  }

  return route;
}

export type DefineRoute = typeof defineRoute;
