import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DatabaseInstance, env, logger, RedisInstance } from '~/lib';

interface ControllerProps {
  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type ControllerType = new (props: ControllerProps) => BaseController;

export default abstract class BaseController {
  protected redisInstance: RedisInstance;
  // protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ redisInstance, databaseInstance }: ControllerProps) {
    this.redisInstance = redisInstance;
    // this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }

  protected sendSuccessResponse(response: Response, data: any, statusCode: StatusCodes = StatusCodes.OK) {
    response.status(statusCode).send({ data });
  }

  protected sendNotFoundResponse(response: Response, data?: any) {
    response.status(StatusCodes.NOT_FOUND).send(data ? { data } : undefined);
  }

  protected sendErrorResponse(response: Response, error: unknown, statusCode: StatusCodes = StatusCodes.BAD_REQUEST) {
    let errorMessage;

    if (env.isProduction) {
      if (error instanceof Error) {
        errorMessage = 'Something went wrong';
      } else if (error === typeof 'string') {
        errorMessage = error;
      } else {
        errorMessage = 'An unknown error occured';
      }
    } else {
      if (error instanceof Error) {
        errorMessage = error.stack || error.message;
      } else {
        errorMessage = error;
      }
    }

    logger.error(error);

    response.status(statusCode).send({ error: errorMessage });
  }
}
