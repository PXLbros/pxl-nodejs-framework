import { FastifyReply, FastifyRequest } from 'fastify';
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
import Jwt from '../../auth/jwt.js';
// import { env } from '../../env';

export interface AuthenticatedUser {
  userId: number;
  payload: any;
}

export default abstract class BaseController {
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
        } else if (typeof error === 'string') {
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

  protected async authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    // Get JWT secret key from application config
    const jwtSecretKey = this.applicationConfig.auth?.jwtSecretKey;

    if (!jwtSecretKey) {
      this.sendErrorResponse(reply, 'Authentication not configured.', StatusCodes.INTERNAL_SERVER_ERROR);
      return null;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.sendErrorResponse(reply, 'No token provided.', StatusCodes.UNAUTHORIZED);
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.sendErrorResponse(reply, 'Invalid token.', StatusCodes.UNAUTHORIZED);
      return null;
    }

    try {
      const importedJwtSecretKey = await Jwt.importJwtSecretKey({ jwtSecretKey });

      // Remove "Bearer " from token
      const jwtAccessToken = authHeader.substring(7);

      const { payload } = await Jwt.jwtVerify(jwtAccessToken, importedJwtSecretKey);

      if (!payload.sub) {
        this.sendErrorResponse(reply, 'Invalid token payload.', StatusCodes.UNAUTHORIZED);
        return null;
      }

      const userId = parseInt(payload.sub as string);

      return {
        userId,
        payload
      };
    } catch (error) {
      this.sendErrorResponse(reply, 'Invalid or expired token.', StatusCodes.UNAUTHORIZED);
      return null;
    }
  }
}
