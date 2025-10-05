import type { HTTPMethods } from 'fastify';
import type { EntityRouteDefinition, RouteValidationSchema } from './webserver.interface.js';

function getEntityRouteDefinitions({
  basePath,
  entityValidationSchema,
}: {
  basePath: string;
  entityValidationSchema: any;
}): EntityRouteDefinition[] {
  const routeDefinitions: EntityRouteDefinition[] = [];

  const idValidationSchema: RouteValidationSchema = {
    type: 'params',
    schema: {
      properties: {
        id: { type: 'integer' },
      },
      required: ['id'],
      type: 'object',
    },
  };

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
    validationSchema: idValidationSchema,
  });

  // Create one
  routeDefinitions.push({
    path: `${basePath}`,
    method: 'POST' as HTTPMethods,
    action: 'createOne',
    validationSchema: entityValidationSchema,
  });

  // Update one - merge params and body validation
  const updateOneValidationSchemas: RouteValidationSchema[] = [idValidationSchema];
  if (entityValidationSchema) {
    updateOneValidationSchemas.push(entityValidationSchema);
  }

  routeDefinitions.push({
    path: `${basePath}/:id`,
    method: 'PUT' as HTTPMethods,
    action: 'updateOne',
    validationSchema: updateOneValidationSchemas,
  });

  // Delete one
  routeDefinitions.push({
    path: `${basePath}/:id`,
    method: 'DELETE' as HTTPMethods,
    action: 'deleteOne',
    validationSchema: idValidationSchema,
  });

  return routeDefinitions;
}

export default {
  // getEntityRoutes,
  getEntityRouteDefinitions,
};
