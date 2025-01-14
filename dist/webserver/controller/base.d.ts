import { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { DatabaseInstance } from '../../database/index.js';
import { RedisInstance } from '../../redis/index.js';
import { QueueManager } from '../../queue/index.js';
import { WebServerBaseControllerConstructorParams } from './base.interface.js';
import { ApplicationConfig } from '../../application/base-application.interface.js';
import EventManager from '../../event/manager.js';
export default abstract class {
    protected workerId: number | undefined;
    protected applicationConfig: ApplicationConfig;
    protected redisInstance: RedisInstance;
    protected queueManager: QueueManager;
    protected eventManager: EventManager;
    protected databaseInstance: DatabaseInstance;
    constructor({ applicationConfig, redisInstance, queueManager, eventManager, databaseInstance }: WebServerBaseControllerConstructorParams);
    protected sendSuccessResponse(reply: FastifyReply, data: any, statusCode?: StatusCodes): void;
    protected sendNotFoundResponse(reply: FastifyReply, data?: any): void;
    protected sendErrorResponse(reply: FastifyReply, error: unknown, statusCode?: StatusCodes): void;
}
//# sourceMappingURL=base.d.ts.map