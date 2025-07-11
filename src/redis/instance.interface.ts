import type { Redis } from 'ioredis';
import type { RedisManager } from './index.js';

export interface RedisInstanceProps {
  redisManager: RedisManager;
  client: Redis;
  publisherClient: Redis;
  subscriberClient: Redis;
}
