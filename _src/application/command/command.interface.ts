import RedisInstance from '../../redis/redis-instance';
import Command from './command';

export interface CommandProps {
  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  // databaseInstance: DatabaseInstance;
}

export type CommandType = new (props: CommandProps) => Command;
