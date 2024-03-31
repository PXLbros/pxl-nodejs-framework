import RedisInstance from '../../redis/redis-instance';
import { CommandProps } from './command.interface';

export default abstract class Command {
  protected redisInstance: RedisInstance;
  // protected queueManager: QueueManager;
  // protected databaseInstance: DatabaseInstance;

  constructor({ redisInstance }: CommandProps) {
    this.redisInstance = redisInstance;
    // this.queueManager = queueManager;
    // this.databaseInstance = databaseInstance;
  }

  public abstract execute(): Promise<void>;
}
