import { StatusCodes } from 'http-status-codes';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseInstance } from '../../database/index.js';
import type { RedisInstance } from '../../redis/index.js';
import type { QueueManager } from '../../queue/index.js';
import type { ApiError, ApiResponse, WebServerBaseControllerConstructorParams } from './base.interface.js';
import { Logger } from '../../logger/index.js';
import type { ApplicationConfig } from '../../application/base-application.interface.js';
import type EventManager from '../../event/manager.js';
import cluster from 'cluster';
import type { WebServerOptions } from '../webserver.interface.js';
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

  constructor({
    applicationConfig,
    webServerOptions,
    redisInstance,
    queueManager,
    eventManager,
    databaseInstance,
  }: WebServerBaseControllerConstructorParams) {
    this.workerId = cluster.worker?.id;

    this.applicationConfig = applicationConfig;
    this.webServerOptions = webServerOptions;

    this.redisInstance = redisInstance;
    this.queueManager = queueManager;
    this.eventManager = eventManager;
    this.databaseInstance = databaseInstance;
  }

  protected sendSuccessResponse<T = any>(
    reply: FastifyReply,
    data: T,
    statusCode: StatusCodes = StatusCodes.OK,
    meta?: ApiResponse<T>['meta'],
  ) {
    const response: ApiResponse<T> = {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: reply.request.id || 'unknown',
        ...meta,
      },
    };
    reply.status(statusCode).send(response);
  }

  protected sendNotFoundResponse(reply: FastifyReply, message: string = 'Resource not found') {
    const error: ApiError = {
      message,
      type: 'not_found',
      timestamp: new Date().toISOString(),
      requestId: reply.request.id || 'unknown',
    };
    const response: ApiResponse = { error };
    reply.status(StatusCodes.NOT_FOUND).send(response);
  }

  protected sendErrorResponse(
    reply: FastifyReply,
    error: unknown,
    statusCode: StatusCodes = StatusCodes.BAD_REQUEST,
    errorType?: ApiError['type'],
  ) {
    let publicErrorMessage: string;
    let errorDetails: any = undefined;

    if (this.webServerOptions.errors?.verbose === true) {
      if (error instanceof Error) {
        publicErrorMessage = error.stack ?? error.message;
        errorDetails = { stack: error.stack, name: error.name };
      } else {
        publicErrorMessage = String(error);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        if (error instanceof Error) {
          publicErrorMessage = 'Something went wrong';
        } else if (typeof error === 'string') {
          publicErrorMessage = error;
        } else {
          publicErrorMessage = 'An unknown error occurred';
        }
      } else {
        if (error instanceof Error) {
          publicErrorMessage = error.stack ?? error.message;
          errorDetails = { stack: error.stack, name: error.name };
        } else {
          publicErrorMessage = String(error);
        }
      }
    }

    Logger.custom('webServer', error);
    console.error(error);

    const apiError: ApiError = {
      message: publicErrorMessage,
      type: errorType ?? this.getErrorType(statusCode),
      timestamp: new Date().toISOString(),
      requestId: reply.request.id || 'unknown',
      ...(errorDetails && { details: errorDetails }),
    };

    const response: ApiResponse = { error: apiError };
    reply.status(statusCode).send(response);
  }

  private getErrorType(statusCode: StatusCodes): ApiError['type'] {
    switch (statusCode) {
      case StatusCodes.UNAUTHORIZED:
        return 'authentication';
      case StatusCodes.FORBIDDEN:
        return 'authorization';
      case StatusCodes.NOT_FOUND:
        return 'not_found';
      case StatusCodes.BAD_REQUEST:
      case StatusCodes.UNPROCESSABLE_ENTITY:
        return 'validation';
      case StatusCodes.INTERNAL_SERVER_ERROR:
      case StatusCodes.BAD_GATEWAY:
      case StatusCodes.SERVICE_UNAVAILABLE:
        return 'server_error';
      default:
        return 'client_error';
    }
  }

  protected async authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
    // Get JWT secret key from application config
    const jwtSecretKey = this.applicationConfig.auth?.jwtSecretKey;

    if (!jwtSecretKey) {
      this.sendErrorResponse(
        reply,
        'Authentication not configured.',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'server_error',
      );
      return null;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.sendErrorResponse(reply, 'No token provided.', StatusCodes.UNAUTHORIZED, 'authentication');
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.sendErrorResponse(reply, 'Invalid token.', StatusCodes.UNAUTHORIZED, 'authentication');
      return null;
    }

    try {
      const importedJwtSecretKey = await Jwt.importJwtSecretKey({
        jwtSecretKey,
      });

      // Remove "Bearer " from token
      const jwtAccessToken = authHeader.substring(7);

      const { payload } = await Jwt.jwtVerify(jwtAccessToken, importedJwtSecretKey);

      if (!payload.sub) {
        this.sendErrorResponse(reply, 'Invalid token payload.', StatusCodes.UNAUTHORIZED, 'authentication');
        return null;
      }

      const userId = parseInt(payload.sub);

      return {
        userId,
        payload,
      };
    } catch {
      this.sendErrorResponse(reply, 'Invalid or expired token.', StatusCodes.UNAUTHORIZED, 'authentication');
      return null;
    }
  }
}
