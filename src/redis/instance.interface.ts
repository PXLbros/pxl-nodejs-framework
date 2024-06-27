import { Redis } from 'ioredis';
import { RedisManager } from './index.js';

export interface RedisInstanceProps {
  redisManager: RedisManager;
  client: Redis;
  publisherClient: Redis;
  subscriberClient: Redis;
}
