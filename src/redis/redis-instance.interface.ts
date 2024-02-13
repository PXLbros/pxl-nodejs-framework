import { Redis } from 'ioredis';

export interface RedisInstanceProps {
  client: Redis;

  publisherClient: Redis;
  subscriberClient: Redis;
}
