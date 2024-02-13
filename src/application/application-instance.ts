import RedisInstance from '../redis/redis-instance';
import { ApplicationInstanceEvents, ApplicationInstanceProps } from './application-instance.interface';

export default abstract class ApplicationInstance {
  // private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  // protected isShuttingDown = false;

  protected redisInstance: RedisInstance;

  protected events?: ApplicationInstanceEvents;

  constructor({ redisInstance, events }: ApplicationInstanceProps) {
    this.redisInstance = redisInstance;

    this.events = events;
  }

  /**
   * Shutdown application instance
   */
  public async shutdown(): Promise<void> {
    // if (this.isShuttingDown) {
    //   return;
    // }

    // this.isShuttingDown = true;

    // Stop application instance
    await this.stop();

    // Disconnect Redis instance
    await this.redisInstance.disconnect();

    if (this.events?.onStopped) {
      const runtime = process.uptime() * 1000;

      // Emit stopped event
      this.events.onStopped({ runtime });
    }
  }

  // /**
  //  * Handle application instance shutdown
  //  */
  // public async handleShutdown(): Promise<void> {
  //   this.shutdownSignals.forEach((signal) => {
  //     process.on(signal, () => {
  //       this.shutdown();
  //     });
  //   });
  // }

  /**
   * Stop application instance
   */
  protected stop(): void | Promise<void> {}
}
