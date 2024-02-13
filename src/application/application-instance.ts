import RedisInstance from '../redis/redis-instance';
import { ApplicationInstanceProps } from './application-instance.interface';

export default abstract class ApplicationInstance {
  protected redisInstance: RedisInstance;

  constructor({ redisInstance }: ApplicationInstanceProps) {
    this.redisInstance = redisInstance;
  }
}
