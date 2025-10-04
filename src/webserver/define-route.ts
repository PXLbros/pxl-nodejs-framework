import type { HTTPMethods } from 'fastify';
import {
  type AnyRouteSchemaDefinition,
  type RouteSchemaDefinition,
  type WebServerRoute,
  WebServerRouteType,
} from './webserver.interface.js';
import type { ControllerAction } from './controller/base.interface.js';

export interface DefineRouteConfig<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined,
  Handler extends ControllerAction<Schema>,
> {
  method: HTTPMethods | HTTPMethods[];
  path: string;
  schema?: Schema;
  handler: Handler;
}

export function defineRoute<
  Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined,
  Handler extends ControllerAction<Schema>,
>({ method, path, schema, handler }: DefineRouteConfig<Schema, Handler>): WebServerRoute {
  const route: WebServerRoute = {
    type: WebServerRouteType.Default,
    method,
    path,
    handler: handler as ControllerAction<any>,
  };

  if (schema) {
    route.schema = schema as AnyRouteSchemaDefinition;
  }

  return route;
}

export type DefineRoute = typeof defineRoute;
