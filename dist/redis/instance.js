import { Logger } from '../logger/index.js';
export default class RedisInstance {
    redisManager;
    client;
    publisherClient;
    subscriberClient;
    constructor({ redisManager, client, publisherClient, subscriberClient }) {
        this.redisManager = redisManager;
        this.client = client;
        this.publisherClient = publisherClient;
        this.subscriberClient = subscriberClient;
    }
    async disconnect() {
        const disconnectPromises = [
            this.subscriberClient.quit().catch(() => Logger.error('Could not disconnect Redis subscriber client')),
            this.publisherClient.quit().catch(() => Logger.error('Could not disconnect Redis publisherClient')),
            this.client.quit().catch(() => Logger.error('Could not disconnect Redis client')),
        ];
        await Promise.all(disconnectPromises);
        this.redisManager.log('Disconnected');
    }
    isConnected() {
        return new Promise((resolve, reject) => {
            if (this.client) {
                this.client.ping((error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(true);
                    }
                });
            }
            else {
                resolve(false);
            }
        });
    }
    /**
     * Sets a value in the cache with an optional expiration time.
     *
     * @param key - The key to set in the cache.
     * @param value - The value to set in the cache.
     * @param expiration - The expiration time in seconds (optional).
     * @throws Error if the value type is not supported.
     * @returns A Promise that resolves when the value is set in the cache.
     */
    async setCache({ key, value, expiration }) {
        let formattedValue;
        if (typeof value === 'object') {
            formattedValue = JSON.stringify(value);
        }
        else if (typeof value === 'number') {
            formattedValue = value;
        }
        else if (typeof value === 'string') {
            formattedValue = value;
        }
        else {
            throw new Error('Unsupported value type');
        }
        if (expiration) {
            await this.client.set(key, formattedValue, 'EX', expiration);
        }
        else {
            await this.client.set(key, formattedValue);
        }
    }
    async getCache({ key }) {
        const cacheValue = this.client.get(key);
        return cacheValue;
    }
    async deleteCache({ key }) {
        await this.client.del(key);
    }
}
//# sourceMappingURL=instance.js.map