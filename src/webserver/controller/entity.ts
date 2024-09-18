import 'reflect-metadata';
import path from 'path';
import { EntityManager } from '@mikro-orm/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import BaseController from './base.js';
import { RedisInstance } from '../../redis/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { QueueManager } from '../../queue/index.js';
import { DynamicEntity } from '../../database/dynamic-entity.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import { generateFormFields } from '../../database/dynamic-entity-form-decorators.js';
import { Logger } from '../../logger/index.js';
import { Helper } from '../../util/index.js';

export default abstract class EntityController extends BaseController {
  protected abstract entityName: string;

  protected entityManager: EntityManager;

  constructor({
    applicationConfig,
    redisInstance,
    queueManager,
    databaseInstance,
  }: {
    applicationConfig: ApplicationConfig;
    redisInstance: RedisInstance;
    queueManager: QueueManager;
    databaseInstance: DatabaseInstance;
  }) {
    super({ applicationConfig, redisInstance, queueManager, databaseInstance });

    this.entityManager = databaseInstance.getEntityManager();
  }

  protected getEntity = async (): Promise<typeof DynamicEntity | undefined> => {
    if (!this.applicationConfig.database || this.applicationConfig.database.enabled !== true) {
      throw new Error(`Database not enabled (Entity: ${this.entityName})`);
    }

    // Define entity module path
    const entityModulePath = path.join(this.applicationConfig.database.entitiesDirectory, `${this.entityName}.${Helper.getScriptFileExtension()}`);

    // Import entity module
    const entityModule = await import(entityModulePath);

    if (!entityModule?.[this.entityName]) {
      throw new Error(`Entity not found (Entity: ${this.entityName})`);
    }

    // Get entity class
    const EntityClass = entityModule[this.entityName];

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
        this.sendErrorResponse(reply, 'Entity not found');

        return;
      }

      const formFields = generateFormFields({ model: EntityClass });

      this.sendSuccessResponse(reply, {
        form_fields: formFields,
      });
    } catch (error) {
      this.sendErrorResponse(reply, error);
    }
  };

   // Pre-getMany hook (can be overridden in the child controller)
   protected async preGetMany({
    entityManager,
    request,
    reply
  }: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
  }): Promise<void> {
    // Default implementation: do nothing
  }

  // Post-getMany hook (can be overridden in the child controller)
  // await this.postGetMany({ entityManager: this.entityManager, request, reply, data });
  protected async postGetMany({
    entityManager,
    request,
    reply,
    data,
  }: {
    entityManager: EntityManager;
    request: FastifyRequest;
    reply: FastifyReply;
    data: { items: any[]; total: number; page: number; totalPages: number; limit: number };
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
        [key: string]: any;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      // Call preGetMany hook
      await this.preGetMany({ entityManager: this.entityManager, request, reply });

      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');
        return;
      }

      // Pagination parameters
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Filtering and sorting
      const filters = request.query.filters ? JSON.parse(request.query.filters) : {};
      const sortOrder = request.query['sort-order'] || 'ASC';
      const orderBy = request.query.sort ? JSON.parse(request.query.sort) : { id: sortOrder };

      const normalizedQuery: { [key: string]: any } = {};

      for (const key in request.query) {
        if (key.endsWith('[]')) {
          const normalizedKey = key.slice(0, -2);
          normalizedQuery[normalizedKey] = request.query[key];
        } else {
          normalizedQuery[key] = request.query[key];
        }
      }

      // Build query options
      const options = {
        limit,
        offset,
        filters,
        orderBy,
      };

      const entityProperties = this.getEntityProperties(EntityClass);

      const reservedQueryKeys = ['page', 'limit', 'filters', 'sort', 'populate'];

      for (const key in normalizedQuery) {
        if (reservedQueryKeys.includes(key)) {
          continue;
        }

        if (!entityProperties.includes(key)) {
          // Key query not found in entity properties so ignore (might be used in other cases)

          continue;
        }

        let queryValue = normalizedQuery[key];

        if (!queryValue) {
          continue;
        }

        // if queryValue contains comma, split it
        if (typeof queryValue === 'string' && queryValue.includes(',')) {
          queryValue = queryValue.split(',');
        }

        // Check if the queryValue is an array or a single value
        if (Array.isArray(queryValue)) {
          options.filters[key] = { $in: queryValue };
        } else {
          options.filters[key] = queryValue;
        }
      }

      const populate = request.query.populate ? request.query.populate.split(',') : [];

      // Fetch items from the database
      const [items, total] = await this.entityManager.findAndCount(
        this.entityName,
        options.filters,
        {
          limit: options.limit,
          offset: options.offset,
          orderBy: options.orderBy,
          populate,
        }
      );

      // Calculate total pages
      const totalPages = Math.ceil(total / limit);

      const data = {
        items,
        total,
        page,
        totalPages,
        limit,
      };

      // Call postGetMany hook
      await this.postGetMany({ entityManager: this.entityManager, request, reply, data });

      reply.send({
        data: data.items,
        total_items: data.total,
        page: data.page,
        total_pages: data.totalPages,
        limit: data.limit,
      });
    } catch (error) {
      this.sendErrorResponse(reply, error);
    }
  };

  public getOne = async (
    request: FastifyRequest<{ Params: { id: number }; Querystring: { populate: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const queryPopulate = request.query.populate || null;
      const populateList: string[] = queryPopulate ? queryPopulate.split(',') : [];

      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');
        return;
      }

      const id = request.params.id;

      // const item = await this.entityManager.findOne(this.entityName, { id });
      // @ts-ignore
      const item = await this.entityManager.findOne(this.entityName, { id }, { populate: populateList });

      if (!item) {
        return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
      }

      this.sendSuccessResponse(reply, item);
    } catch (error) {
      this.sendErrorResponse(reply, error);
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

  public createOne = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');

        return;
      }

      // Listen for preCreateOne hook
      if (this.preCreateOne) {
        const { request: preCreateOneRequest } = await this.preCreateOne({ request, reply });

        if (preCreateOneRequest) {
          request = preCreateOneRequest;
        }
      }

      const { error, value } = EntityClass.validate(request.body, true);

      if (error) {
        return this.sendErrorResponse(reply, error.message);
      }

      const item = this.entityManager.create(this.entityName, value);

      await this.entityManager.persistAndFlush(item);

      this.sendSuccessResponse(reply, item, StatusCodes.CREATED);
    } catch (error) {
      this.sendErrorResponse(reply, error);
    }
  };

  public updateOne = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');

        return;
      }

      const id = request.params.id;

      const { error, value } = EntityClass.validate(request.body, false);

      if (error) {
        return this.sendErrorResponse(reply, error.message);
      }

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
      }

      this.entityManager.assign(item, value);

      await this.entityManager.persistAndFlush(item);

      this.sendSuccessResponse(reply, item);
    } catch (error) {
      this.sendErrorResponse(reply, error);
    }
  };

  public deleteOne = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');

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
      this.sendErrorResponse(reply, error);
    }
  };
}
