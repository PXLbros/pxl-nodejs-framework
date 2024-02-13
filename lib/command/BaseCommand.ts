import { DatabaseInstance, RedisInstance } from '~/lib';

interface CommandProps {
  redisInstance: RedisInstance;
  // queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export type CommandType = new (props: CommandProps) => BaseCommand;

export default abstract class BaseCommand {
  protected redisInstance: RedisInstance;
  // protected queueManager: QueueManager;
  protected databaseInstance: DatabaseInstance;

  constructor({ redisInstance, databaseInstance }: CommandProps) {
    this.redisInstance = redisInstance;
    // this.queueManager = queueManager;
    this.databaseInstance = databaseInstance;
  }

  public abstract execute(): Promise<void>;
}
