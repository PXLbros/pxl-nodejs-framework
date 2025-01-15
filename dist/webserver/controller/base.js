import { StatusCodes } from 'http-status-codes';
import { Logger } from '../../logger/index.js';
import cluster from 'cluster';
// import { env } from '../../env';
export default class {
    workerId;
    applicationConfig;
    redisInstance;
    queueManager;
    eventManager;
    databaseInstance;
    constructor({ applicationConfig, redisInstance, queueManager, eventManager, databaseInstance }) {
        this.workerId = cluster.worker?.id;
        this.applicationConfig = applicationConfig;
        this.redisInstance = redisInstance;
        this.queueManager = queueManager;
        this.eventManager = eventManager;
        this.databaseInstance = databaseInstance;
    }
    sendSuccessResponse(reply, data, statusCode = StatusCodes.OK) {
        reply.status(statusCode).send({ data });
    }
    sendNotFoundResponse(reply, data) {
        reply.status(StatusCodes.NOT_FOUND).send(data ? { data } : undefined);
    }
    sendErrorResponse(reply, error, statusCode = StatusCodes.BAD_REQUEST) {
        let publicErrorMessage;
        // if (env.isProduction) {
        if (process.env.NODE_ENV === 'production') {
            if (error instanceof Error) {
                publicErrorMessage = 'Something went wrong';
            }
            else if (error === typeof 'string') {
                publicErrorMessage = error;
            }
            else {
                publicErrorMessage = 'An unknown error occured';
            }
        }
        else {
            if (error instanceof Error) {
                publicErrorMessage = error.stack || error.message;
            }
            else {
                publicErrorMessage = error;
            }
        }
        Logger.custom('webServer', error);
        console.error(error);
        reply.status(statusCode).send({ error: publicErrorMessage });
    }
}
//# sourceMappingURL=base.js.map