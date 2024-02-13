import { Request, Response } from 'express';
import { EntityManager } from '@mikro-orm/postgresql';
import { StatusCodes } from 'http-status-codes';
import { BaseController, DatabaseInstance, RedisInstance } from '~/lib';
import { DynamicEntity } from '~/lib/database/DynamicEntity';

export default abstract class extends BaseController {
  protected abstract entityName: string;
  protected entityManager: EntityManager;

  constructor({
    redisInstance,
    databaseInstance,
  }: {
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance;
  }) {
    super({ redisInstance, databaseInstance });

    this.entityManager = databaseInstance.getEntityManager();
  }

  protected getEntity = async (): Promise<typeof DynamicEntity | undefined> => {
    const module = await import(`~/database/entities/${this.entityName}`);

    const EntityClass = module[this.entityName];

    return EntityClass;
  };

  public getMany = async (request: Request, response: Response) => {
    try {
      // Pagination parameters
      const page = parseInt(request.query.page as string) || 1;
      const limit = parseInt(request.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Filtering and sorting
      const filters = request.query.filters ? JSON.parse(request.query.filters as string) : {};
      const orderBy = request.query.sort ? JSON.parse(request.query.sort as string) : { id: 'ASC' };

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

      response.send({
        data: items,
        total_items: total,
        page,
        total_pages: totalPages,
        limit,
      });
    } catch (error) {
      this.sendErrorResponse(response, error);
    }
  };

  public getOne = async (request: Request, response: Response) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(response, 'Entity not found');

        return;
      }

      const id = request.params.id;

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(response, `${EntityClass.singularNameCapitalized} not found`);
      }

      this.sendSuccessResponse(response, item);
    } catch (error) {
      this.sendErrorResponse(response, error);
    }
  };

  public createOne = async (request: Request, response: Response) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(response, 'Entity not found');

        return;
      }

      const { error, value } = EntityClass.validate(request.body);

      if (error) {
        return this.sendErrorResponse(response, error.message);
      }

      const item = this.entityManager.create(this.entityName, value);

      await this.entityManager.persistAndFlush(item);

      this.sendSuccessResponse(response, item, StatusCodes.CREATED);
    } catch (error) {
      this.sendErrorResponse(response, error);
    }
  };

  public updateOne = async (reqest: Request, response: Response) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(response, 'Entity not found');

        return;
      }

      const id = reqest.params.id;

      const { error, value } = EntityClass.validate(reqest.body);

      if (error) {
        return this.sendErrorResponse(response, error.message);
      }

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(response, `${EntityClass.singularNameCapitalized} not found`);
      }

      this.entityManager.assign(item, value);

      await this.entityManager.persistAndFlush(item);

      this.sendSuccessResponse(response, item);
    } catch (error) {
      this.sendErrorResponse(response, error);
    }
  };

  public deleteOne = async (request: Request, response: Response) => {
    try {
      const EntityClass = await this.getEntity();

      if (!EntityClass) {
        this.sendErrorResponse(response, 'Entity not found');

        return;
      }

      const id = request.params.id;

      const item = await this.entityManager.findOne(this.entityName, { id });

      if (!item) {
        return this.sendNotFoundResponse(response, `${EntityClass.singularNameCapitalized} not found`);
      }

      await this.entityManager.removeAndFlush(item);

      response.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      this.sendErrorResponse(response, error);
    }
  };
}
