import { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { DatabaseInstance } from '../../database/index.js';
import { RedisInstance } from '../../redis/index.js';
import { QueueManager } from '../../queue/index.js';
import { BaseControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
// import { env } from '../../env';

export default abstract class BaseController {
  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ redisInstance, queueManager, databaseInstance }: BaseControllerConstructorParams) {
    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }

  protected sendSuccessResponse(reply: FastifyReply, data: any, statusCode: StatusCodes = StatusCodes.OK) {
    reply.status(statusCode).send({ data });
  }

  protected sendNotFoundResponse(reply: FastifyReply, data?: any) {
    reply.status(StatusCodes.NOT_FOUND).send(data ? { data } : undefined);
  }

  protected sendErrorResponse(reply: FastifyReply, error: unknown, statusCode: StatusCodes = StatusCodes.BAD_REQUEST) {
    let errorMessage;

    // if (env.isProduction) {
    if (process.env.NODE_ENV === 'production') {
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

    Logger.error(error);

    reply.status(statusCode).send({ error: errorMessage });
  }
}
