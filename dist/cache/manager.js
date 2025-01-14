import { createClient } from 'redis';
export default class CacheManager {
    client;
    applicationConfig;
    redisManager;
    constructor({ applicationConfig, redisManager }) {
        this.applicationConfig = applicationConfig;
        this.redisManager = redisManager;
    }
    async getClient() {
        if (!this.client) {
            this.client = createClient({
                socket: {
                    host: this.applicationConfig.redis.host,
                    port: this.applicationConfig.redis.port,
                },
            });
            await this.client.connect();
        }
        return this.client;
    }
    async getItem({ key }) {
        const client = await this.getClient();
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
    }
    async setItem({ key, value, lifetime }) {
        const client = await this.getClient();
        const stringValue = JSON.stringify(value);
        if (lifetime) {
            await client.setEx(key, lifetime, stringValue);
        }
        else {
            await client.set(key, stringValue);
        }
    }
    async clearItem({ key }) {
        const client = await this.getClient();
        await client.del(key);
    }
    async close() {
        if (this.client) {
            await this.client.quit();
        }
    }
}
//# sourceMappingURL=manager.js.map