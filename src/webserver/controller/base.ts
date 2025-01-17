import { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { DatabaseInstance } from '../../database/index.js';
import { RedisInstance } from '../../redis/index.js';
import { QueueManager } from '../../queue/index.js';
import { WebServerBaseControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import EventManager from '../../event/manager.js';
import cluster from 'cluster';
import { WebServerOptions } from '../webserver.interface.js';
// import { env } from '../../env';

export default abstract class {
  protected workerId: number | undefined;

  protected applicationConfig: ApplicationConfig;
  protected webServerOptions: WebServerOptions;

  protected redisInstance: RedisInstance;
  protected queueManager: QueueManager;
  protected eventManager: EventManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ applicationConfig, webServerOptions, redisInstance, queueManager, eventManager, databaseInstance }: WebServerBaseControllerConstructorParams) {
    this.workerId = cluster.worker?.id;

    this.applicationConfig = applicationConfig;
    this.webServerOptions = webServerOptions;

    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.eventManager = eventManager;
    this.databaseInstance = databaseInstance;
  }

  protected sendSuccessResponse(reply: FastifyReply, data: any, statusCode: StatusCodes = StatusCodes.OK) {
    reply.status(statusCode).send({ data });
  }

  protected sendNotFoundResponse(reply: FastifyReply, data?: any) {
    reply.status(StatusCodes.NOT_FOUND).send(data ? { data } : undefined);
  }

  protected sendErrorResponse(reply: FastifyReply, error: unknown, statusCode: StatusCodes = StatusCodes.BAD_REQUEST) {
    let publicErrorMessage;

    if (this.webServerOptions.errors?.verbose === true) {
      if (error instanceof Error) {
        publicErrorMessage = error.stack || error.message;
      } else {
        publicErrorMessage = error;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        if (error instanceof Error) {
          publicErrorMessage = 'Something went wrong';
        } else if (error === typeof 'string') {
          publicErrorMessage = error;
        } else {
          publicErrorMessage = 'An unknown error occured';
        }
      } else {
        if (error instanceof Error) {
          publicErrorMessage = error.stack || error.message;
        } else {
          publicErrorMessage = error;
        }
      }
    }

    Logger.custom('webServer', error);

    console.error(error);

    reply.status(statusCode).send({ error: publicErrorMessage });
  }
}
