import path from 'path';
import { EntityManager } from '@mikro-orm/postgresql';
import { FastifyReply, FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import BaseController from './base.js';
import { RedisInstance } from '../../redis/index.js';
import { DatabaseInstance } from '../../database/index.js';
import { QueueManager } from '../../queue/index.js';
import { DynamicEntity } from '../../database/dynamic-entity.js';
import { ApplicationConfig } from '../../application/application.interface.js';

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
    // Define entity module path
    const entityModulePath = path.join(this.applicationConfig.database.entitiesDirectory, `${this.entityName}.ts`);

    // Import entity module
    const entityModule = await import(entityModulePath);

    if (!entityModule?.[this.entityName]) {
      throw new Error(`Entity not found (Entity: ${this.entityName})`);
    }

    // Get entity class
    const EntityClass = entityModule[this.entityName];

    return EntityClass;
  };

  public getMany = async (
    request: FastifyRequest<{
      Querystring: {
        page: string;
        limit: string;
        filters: string;
        sort: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
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
      const orderBy = request.query.sort ? JSON.parse(request.query.sort) : { id: 'ASC' };

      // Build query options
      const options = {
        limit,
        offset,
        filters,
        orderBy,
      };

      // Fetch items from the database
      const [items, total] = await this.entityManager.findAndCount(this.entityName, options.filters, {
        limit: options.limit,
        offset: options.offset,
        orderBy: options.orderBy,
      });

      // Calculate total pages
      const totalPages = Math.ceil(total / limit);

      reply.send({
        data: items,
        total_items: total,
        page,
        total_pages: totalPages,
        limit,
      });
    } catch (error) {
      this.sendErrorResponse(reply, error);
    }
  };

  public getOne = async (
    request: FastifyRequest<{ Params: { id: number }; Querystring: { with: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const queryWith = request.query.with || null;
      const withList: string[] = queryWith ? queryWith.split(',') : [];

      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(reply, 'Entity not found');

        return;
      }

      const id = request.params.id;

      // const item = await this.entityManager.findOne(this.entityName, { id });
      // @ts-ignore
      const item = await this.entityManager.findOne(this.entityName, { id }, { populate: withList });

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

      const { error, value } = EntityClass.validate(request.body);

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

      const { error, value } = EntityClass.validate(request.body);

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
