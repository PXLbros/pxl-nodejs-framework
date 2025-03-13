import { Redis } from 'ioredis';
import RedisInstance from './instance.js';
import { Logger } from '../logger/index.js';
export default class RedisManager {
    logger = Logger;
    options;
    instances = [];
    constructor(config) {
        this.options = config;
    }
    connect() {
        return new Promise((resolve, reject) => {
            const redisOptions = {
                host: this.options.host,
                port: this.options.port,
                password: this.options.password,
                maxRetriesPerRequest: null, // Needed for bullmq
            };
            const client = new Redis(redisOptions);
            const publisherClient = new Redis(redisOptions);
            const subscriberClient = new Redis(redisOptions);
            const handleConnect = () => {
                const redisInstance = new RedisInstance({
                    redisManager: this,
                    client,
                    publisherClient,
                    subscriberClient,
                });
                this.instances.push(redisInstance);
                if (this.options.applicationConfig.log?.startUp) {
                    this.log('Connected', {
                        Host: this.options.host,
                        Port: this.options.port,
                    });
                }
                resolve(redisInstance);
            };
            const handleError = (error) => {
                Logger.error(error);
                reject(error);
            };
            client.on('connect', handleConnect);
            client.on('error', handleError);
        });
    }
    async disconnect() {
        await Promise.all(this.instances.map((instance) => instance.disconnect()));
    }
    /**
     * Log Redis message
     */
    log(message, meta) {
        this.logger.custom('redis', message, meta);
    }
}
//# sourceMappingURL=manager.js.map