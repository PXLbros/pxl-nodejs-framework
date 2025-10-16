import { describe, it, expect } from 'vitest';
import webserverUtil from '../../../src/webserver/util.js';

const { getEntityRouteDefinitions } = webserverUtil;

describe('webserver util', () => {
  it('creates standard CRUD route definitions for an entity', () => {
    const entitySchema = {
      type: 'body',
      schema: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    };

    const routes = getEntityRouteDefinitions({ basePath: '/users', entityValidationSchema: entitySchema });

    expect(routes).toHaveLength(6);
    expect(routes).toEqual([
      { path: '/users/options', method: 'GET', action: 'options' },
      { path: '/users', method: 'GET', action: 'getMany' },
      { path: '/users/:id', method: 'GET', action: 'getOne' },
      { path: '/users', method: 'POST', action: 'createOne' },
      { path: '/users/:id', method: 'PUT', action: 'updateOne' },
      { path: '/users/:id', method: 'DELETE', action: 'deleteOne' },
    ]);
  });

  it('reuses base path when generating routes', () => {
    const routes = getEntityRouteDefinitions({
      basePath: '/projects',
      entityValidationSchema: { schema: {} },
    });

    const uniquePaths = new Set(routes.map(route => route.path));
    expect(uniquePaths.size).toBe(3); // /projects, /projects/options, /projects/:id
  });
});
