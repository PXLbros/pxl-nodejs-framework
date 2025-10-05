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
      {
        path: '/users/:id',
        method: 'GET',
        action: 'getOne',
        validationSchema: {
          type: 'params',
          schema: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'integer' } },
          },
        },
      },
      {
        path: '/users',
        method: 'POST',
        action: 'createOne',
        validationSchema: entitySchema,
      },
      {
        path: '/users/:id',
        method: 'PUT',
        action: 'updateOne',
        validationSchema: [
          {
            type: 'params',
            schema: {
              type: 'object',
              required: ['id'],
              properties: { id: { type: 'integer' } },
            },
          },
          entitySchema,
        ],
      },
      {
        path: '/users/:id',
        method: 'DELETE',
        action: 'deleteOne',
        validationSchema: {
          type: 'params',
          schema: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'integer' } },
          },
        },
      },
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
