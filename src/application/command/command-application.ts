import Application from '../application';
import CommandApplicationInstance from './command-application-instance';

export default class CommandApplication extends Application {
  /**
   * Start command application
   */
  protected async startInstance(): Promise<CommandApplicationInstance> {
    const { redisInstance } = await this.connect();

    const commandApplicationInstance = new CommandApplicationInstance({
      redisInstance,
    });

    return commandApplicationInstance;
  }

  /**
   * Stop command application
   */
  protected async stop(): Promise<void> {
  }

  /**
   * Start command application
   */
  public async startCommand(): Promise<void> {
    console.log('START APP v3');
  }

  /**
   * Stop command application
   */
  public async stopCommand(): Promise<void> {
  }
}
