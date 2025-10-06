import 'reflect-metadata';
import path from 'path';
import type { EntityManager, FilterQuery, Populate } from '@mikro-orm/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import BaseController from './base.js';
import type { DynamicEntity } from '../../database/dynamic-entity.js';
import { generateFormFields } from '../../database/dynamic-entity-form-decorators.js';
import { Helper } from '../../util/index.js';
import type { WebServerBaseControllerConstructorParams } from './base.interface.js';

export default abstract class EntityController extends BaseController {
  protected abstract entityName: string;

  protected entityManager: EntityManager;

  // Cache for entity modules to avoid repeated dynamic imports
  private static entityCache = new Map<string, typeof DynamicEntity>();

  constructor(props: WebServerBaseControllerConstructorParams) {
    super(props);

    const { databaseInstance } = props;

    this.entityManager = databaseInstance.getEntityManager();
  }

  protected getEntity = async (): Promise<typeof DynamicEntity | undefined> => {
    if (!this.applicationConfig.database || this.applicationConfig.database.enabled !== true) {
      throw new Error(`Database not enabled (Entity: ${this.entityName})`);
    }

    // Check cache first
    const cacheKey = `${this.applicationConfig.database.entitiesDirectory}:${this.entityName}`;
    if (EntityController.entityCache.has(cacheKey)) {
      return EntityController.entityCache.get(cacheKey);
    }

    // Define entity module path
    const entityModulePath = path.join(
      this.applicationConfig.database.entitiesDirectory,
      `${this.entityName}.${Helper.getScriptFileExtension()}`,
    );

    // Import entity module
    const entityModule = await import(entityModulePath);

    if (!entityModule?.[this.entityName]) {
      throw new Error(`Entity not found (Entity: ${this.entityName})`);
    }

    // Get entity class
    const EntityClass = entityModule[this.entityName];

    // Cache the entity for future use
    EntityController.entityCache.set(cacheKey, EntityClass);

    return EntityClass;
  };

  private getEntityProperties(entityClass: any): string[] {
    const properties: string[] = [];

    const reservedPropertyKeys = ['constructor', 'toJSON'];

    for (const propertyKey of Object.getOwnPropertyNames(entityClass.prototype)) {
      if (propertyKey.startsWith('__')) {
        continue;
      } else if (reservedPropertyKeys.includes(propertyKey)) {
        continue;
      }

      properties.push(propertyKey);
    }

    return properties;
  }

  public options = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });

        return;
      }

      const formFields = generateFormFields({ model: EntityClass });

      this.sendSuccessResponse({
        reply,
        data: {
          formFields,
        },
      });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  public metadata = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });

        return;
      }

      const formFields = generateFormFields({ model: EntityClass });

      this.sendSuccessResponse({
        reply,
        data: {
          formFields,
        },
      });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  // Pre-getMany hook (can be overridden in the child controller)
  protected async preGetMany(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
  }): Promise<void> {
    // Default implementation: do nothing
  }

  // Post-getMany hook (can be overridden in the child controller)
  // await this.postGetMany({ entityManager: this.entityManager, request, reply, data });
  protected async postGetMany(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
    data: {
      items: any[];
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
  }): Promise<void> {
    // Default implementation: do nothing
  }

  public getMany = async (
    request: FastifyRequest<{
      Querystring: {
        page: string;
        limit: string;
        filters: string;
        sort: string;
        'sort-order': string;
        search: string;
        [key: string]: any;
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      // Call preGetMany hook
      await this.preGetMany({
        entityManager: this.entityManager,
        request,
        reply,
      });

      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });

        return;
      }

      // Pagination parameters
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit);
      const offset = (page - 1) * (limit > 0 ? limit : 0);

      // Filtering and sorting
      const filters = request.query.filters ? JSON.parse(request.query.filters) : {};
      const sortOrder = request.query['sort-order'] || 'ASC';
      const orderBy = request.query.sort ? { [request.query.sort]: sortOrder } : { id: sortOrder };

      const normalizedQuery: { [key: string]: any } = {};

      for (const key in request.query) {
        // Skip prototype pollution attempts
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        // Only process own properties
        if (!Object.prototype.hasOwnProperty.call(request.query, key)) {
          continue;
        }

        if (key.endsWith('[]')) {
          const normalizedKey = key.slice(0, -2);

          // Safe property assignment
          if (normalizedKey !== '__proto__' && normalizedKey !== 'constructor' && normalizedKey !== 'prototype') {
            Reflect.set(normalizedQuery, normalizedKey, Reflect.get(request.query, key));
          }
        } else {
          Reflect.set(normalizedQuery, key, Reflect.get(request.query, key));
        }
      }

      // Build query options
      const options: {
        limit?: number;
        offset?: number;
        filters: FilterQuery<any>;
        orderBy: { [key: string]: string };
      } = {
        filters,
        offset,
        orderBy,
      };

      if (limit > 0) {
        options.limit = limit;
      }

      const entityProperties = this.getEntityProperties(EntityClass);
      const reservedQueryKeys = ['page', 'limit', 'filters', 'sort', 'populate', 'search'];
      const searchQuery = request.query.search || '';

      for (const key in normalizedQuery) {
        // Skip prototype pollution attempts
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        // Only process own properties
        if (!Object.prototype.hasOwnProperty.call(normalizedQuery, key)) {
          continue;
        }

        if (reservedQueryKeys.includes(key)) {
          continue;
        }

        if (!entityProperties.includes(key)) {
          const [relation, subProperty] = key.split('.');

          if (relation && subProperty) {
            // Validate relation and subProperty names
            if (
              relation === '__proto__' ||
              relation === 'constructor' ||
              relation === 'prototype' ||
              subProperty === '__proto__' ||
              subProperty === 'constructor' ||
              subProperty === 'prototype'
            ) {
              continue;
            }

            let queryValue = Reflect.get(normalizedQuery, key);

            if (!queryValue) continue;

            if (typeof queryValue === 'string' && queryValue.includes(',')) {
              queryValue = queryValue.split(',');
            }

            if (Array.isArray(queryValue)) {
              Reflect.set(options.filters, relation, {
                [subProperty]: { $in: queryValue },
              });
            } else {
              Reflect.set(options.filters, relation, {
                [subProperty]: queryValue,
              });
            }
          }

          continue;
        }

        let queryValue = Reflect.get(normalizedQuery, key);

        if (!queryValue) {
          continue;
        }

        if (typeof queryValue === 'string' && queryValue.includes(',')) {
          queryValue = queryValue.split(',');
        }

        if (Array.isArray(queryValue)) {
          Reflect.set(options.filters, key, { $in: queryValue });
        } else {
          Reflect.set(options.filters, key, queryValue);
        }
      }

      // Add search filter if a search query is provided
      if (searchQuery) {
        const searchFields = EntityClass.getSearchFields();

        options.filters.$or = searchFields
          .filter(field => {
            const isIntegerField = ['id', 'originId'].includes(field);

            return !isIntegerField;
          })
          .map(field => {
            return {
              [field]: { $like: `%${searchQuery}%` },
            };
          });
      }

      const populate = request.query.populate ? request.query.populate.split(',') : [];

      // Fetch items from the database
      const [items, total] = await this.entityManager.findAndCount(this.entityName, options.filters, {
        limit: options.limit,
        offset: options.offset,
        orderBy: options.orderBy,
        populate,
      });

      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

      const data = {
        items,
        total,
        page,
        totalPages,
        limit: limit > 0 ? limit : total,
      };

      // Call postGetMany hook
      await this.postGetMany({
        entityManager: this.entityManager,
        request,
        reply,
        data,
      });

      reply.send({
        data: data.items,
        total_items: data.total,
        page: data.page,
        total_pages: data.totalPages,
        limit: data.limit,
      });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  protected async preGetOne(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
  }): Promise<void> {
    // Default implementation: do nothing
  }

  protected async postGetOne(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
    item: any;
  }): Promise<void> {
    // Default implementation: do nothing
  }

  public getOne = async (
    request: FastifyRequest<{
      Params: { id: number };
      Querystring: { populate: string };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      await this.preGetOne({
        entityManager: this.entityManager,
        request,
        reply,
      });

      const queryPopulate = request.query.populate || null;
      const populateList: string[] = queryPopulate ? queryPopulate.split(',') : [];

      // Ensure populate is typed correctly for MikroORM
      const populate = populateList.map(field => `${field}.*`) as unknown as Populate<
        object,
        `${string}.*` | `${string}.$infer`
      >;

      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });
        return;
      }

      const id = request.params.id;

      const item = await this.entityManager.findOne(this.entityName, { id }, { populate });

      if (!item) {
        return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
      }

      await this.postGetOne({
        entityManager: this.entityManager,
        request,
        reply,
        item,
      });

      this.sendSuccessResponse({ reply, data: item });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  protected preCreateOne = ({
    request,
    reply,
  }: {
    request: FastifyRequest;
    reply: FastifyReply;
  }): { request: FastifyRequest; reply: FastifyReply } => {
    return { request, reply };
  };

  protected async postCreateOne(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
    item: any;
  }): Promise<void> {}

  public createOne = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });
        return;
      }

      // Listen for preCreateOne hook
      if (this.preCreateOne) {
        const { request: preCreateOneRequest } = await this.preCreateOne({
          request,
          reply,
        });
        if (preCreateOneRequest) {
          request = preCreateOneRequest;
        }
      }

      const { error, value } = EntityClass.validate(request.body, true);

      if (error) {
        return this.sendErrorResponse({ reply, error: error.message });
      }

      const item = this.entityManager.create(this.entityName, value as object);

      await this.entityManager.persistAndFlush(item);

      // Call postCreateOne hook
      await this.postCreateOne({
        entityManager: this.entityManager,
        request,
        reply,
        item,
      });

      this.sendSuccessResponse({ reply, data: item, statusCode: StatusCodes.CREATED });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  protected async postUpdateOne(_: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
    item: any;
  }): Promise<void> {}

  public updateOne = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });
        return;
      }

      const id = request.params.id;

      const { error, value } = EntityClass.validate(request.body, false);

      if (error) {
        return this.sendErrorResponse({ reply, error: error.message });
      }

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
      }

      this.entityManager.assign(item, value as object);

      await this.entityManager.persistAndFlush(item);

      // Call postUpdateOne hook
      await this.postUpdateOne({
        entityManager: this.entityManager,
        request,
        reply,
        item,
      });

      this.sendSuccessResponse({ reply, data: item });
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };

  public deleteOne = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse({ reply, error: 'Entity not found' });

        return;
      }

      const id = request.params.id;

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
      }

      await this.entityManager.removeAndFlush(item);

      reply.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      this.sendErrorResponse({ reply, error });
    }
  };
}
