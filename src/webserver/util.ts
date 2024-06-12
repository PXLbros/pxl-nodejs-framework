import { HTTPMethods } from 'fastify';
import { EntityRouteDefinition } from './webserver.interface.js';

function getEntityRouteDefinitions({
  basePath,
  entityValidationSchema,
}: {
  basePath: string;
  entityValidationSchema: any;
}): EntityRouteDefinition[] {
  const routeDefinitions: EntityRouteDefinition[] = [];

  // Options
  routeDefinitions.push({
    path: `${basePath}/options`,
    method: 'GET' as HTTPMethods,
    action: 'options',
  });

  // Get many
  routeDefinitions.push({
    path: `${basePath}`,
    method: 'GET' as HTTPMethods,
    action: 'getMany',
  });

  // Get one
  routeDefinitions.push({
    path: `${basePath}/:id`,
    method: 'GET' as HTTPMethods,
    action: 'getOne',
  });

  // Create one
  routeDefinitions.push({
    path: `${basePath}`,
    method: 'POST' as HTTPMethods,
    action: 'createOne',
    validationSchema: entityValidationSchema,
  });

  // Update one
  routeDefinitions.push({
    path: `${basePath}/:id`,
    method: 'PUT' as HTTPMethods,
    action: 'updateOne',
    validationSchema: entityValidationSchema,
  });

  // Delete one
  routeDefinitions.push({
    path: `${basePath}/:id`,
    method: 'DELETE' as HTTPMethods,
    action: 'deleteOne',
  });

  return routeDefinitions;
}

export default {
  // getEntityRoutes,
  getEntityRouteDefinitions,
};
