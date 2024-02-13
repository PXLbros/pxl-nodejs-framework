import RedisInstance from '../redis/redis-instance';
import { ApplicationInstanceProps } from './application-instance.interface';

export default abstract class ApplicationInstance {
  private shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  protected isShuttingDown = false;

  protected redisInstance: RedisInstance;

  constructor({ redisInstance }: ApplicationInstanceProps) {
    this.redisInstance = redisInstance;

    // Handle shutdown
    this.handleShutdown();
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('Application instance is already stopping');

      return;
    }

    this.isShuttingDown = true;

    await this.stop();

    // Disconnect Redis instance
    await this.redisInstance.disconnect();
  }

  protected stop(): void | Promise<void> {}

  protected async handleShutdown(): Promise<void> {
    this.shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.shutdown();
      });
    });
  }
}
