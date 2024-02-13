import RedisInstance from '../redis/redis-instance';
import { ApplicationInstanceEvents, ApplicationInstanceProps } from './application-instance.interface';

export default abstract class ApplicationInstance {
  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  protected isShuttingDown = false;

  protected redisInstance: RedisInstance;

  protected events?: ApplicationInstanceEvents;

  constructor({ redisInstance, events }: ApplicationInstanceProps) {
    this.redisInstance = redisInstance;

    this.events = events;

    // Handle shutdown
    this.handleShutdown(); // TODO: This can be made public and called from application instead
  }

  /**
   * Shutdown application instance
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Stop application instance
    await this.stop();

    // Disconnect Redis instance
    await this.redisInstance.disconnect();

    if (this.events?.onStopped) {
      // Emit stopped event
      this.events.onStopped({ runtime: process.uptime() });
    }
  }

  /**
   * Handle application instance shutdown
   */
  protected async handleShutdown(): Promise<void> {
    console.log('DOING THIS EVEN FOR CLSUTER APPS CURRNETLY...');
    
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.shutdown();
      });
    });
  }

  /**
   * Stop application instance
   */
  protected stop(): void | Promise<void> {}
}
