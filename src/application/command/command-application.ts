import Application from '../application';

export default class CommandApplication extends Application {
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
