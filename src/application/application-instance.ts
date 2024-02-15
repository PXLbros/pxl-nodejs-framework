import RedisInstance from '../redis/redis-instance';
import { ApplicationInstanceEvents, ApplicationInstanceProps } from './application-instance.interface';

export default abstract class ApplicationInstance {
  protected redisInstance: RedisInstance;

  protected events?: ApplicationInstanceEvents;

  constructor({ redisInstance, events }: ApplicationInstanceProps) {
    this.redisInstance = redisInstance;

    this.events = events;
  }

  /**
   * Stop application instance
   */
  public async stop(): Promise<void> {
    // Disconnect Redis instance
    await this.redisInstance.disconnect();

    if (this.events?.onStopped) {
      const runtime = process.uptime() * 1000;

      // Emit stopped event
      this.events.onStopped({ runtime });
    }
  }
}
