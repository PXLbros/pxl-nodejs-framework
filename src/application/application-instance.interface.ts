import RedisInstance from '../redis/redis-instance';
import { OnStoppedEvent } from './application.interface';

export interface ApplicationInstanceEvents {
  onStopped?: OnStoppedEvent;
}

export interface ApplicationInstanceProps {
  redisInstance: RedisInstance;

  events?: ApplicationInstanceEvents;
}
