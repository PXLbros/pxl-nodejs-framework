import BaseController from './base.js';
export default class extends BaseController {
    health = async (_, reply) => {
        try {
            const healthCheckPromises = [this.checkDatabaseConnection(), this.checkRedisConnection()];
            const results = await Promise.all(healthCheckPromises.map((healthCheckPromise) => healthCheckPromise.catch((error) => error)));
            const isDatabaseHealthy = results[0] === true;
            const isRedisHealthy = results[1] === true;
            // const activeQueueItems = await this.queueManager.listAllJobsWithStatus();
            const isAllHealthy = results.every((result) => result === true);
            reply.send({
                healthy: isAllHealthy,
                services: {
                    database: { healthy: isDatabaseHealthy },
                    redis: { healthy: isRedisHealthy },
                    // queue: { activeItems: activeQueueItems },
                },
            });
        }
        catch (error) {
            reply.status(500).send({
                healthy: false,
                error: error.message,
            });
        }
    };
    async checkDatabaseConnection() {
        try {
            return await this.databaseInstance.isConnected();
        }
        catch (error) {
            return false;
        }
    }
    async checkRedisConnection() {
        try {
            return await this.redisInstance.isConnected();
        }
        catch (error) {
            return false;
        }
    }
}
//# sourceMappingURL=health.js.map