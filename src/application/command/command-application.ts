import Application from '../application';
import { StartCommandApplicationProps } from './command-application.interface';
import logger from '../../logger/logger';
import RedisInstance from 'src/redis/redis-instance';

export default class CommandApplication extends Application {
  /**
   * Start command application
   */
  public async start(props?: StartCommandApplicationProps): Promise<void> {
    try {
      // Start
      await this.startInstance(props);

      // Stop
      await this.stop();
    } catch (error) {
      // Log error
      logger.error(error);

      process.exit(1);
    }
  }

  /**
   * Start command application callback
   */
  protected async startCallback({ redisInstance }: { redisInstance: RedisInstance }): Promise<void> {
    logger.debug('Run command');
  }
  
  /**
   * Stop command application callback
   */
  protected async stopCallback(): Promise<void> {
    logger.debug('Stop command application');
  }
}
