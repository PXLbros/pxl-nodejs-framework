import DatabaseInstance from '../database/instance.js';
import { Logger } from '../logger/index.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import BaseApplication from './base-application.js';
import { CommandApplicationConfig } from './command-application.interface.js';

export default class CommandApplication extends BaseApplication {
  /** Web application config */
  protected config: CommandApplicationConfig;

  constructor(config: CommandApplicationConfig) {
    super(config);

    this.config = config;
  }

  protected async startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager; }): Promise<void> {
    // throw new Error('Method not implemented.');
    Logger.info('Command started yoyo!!www!ww!!1!!!!!!!!!!!');

    console.log('SCAN COMMDNAS DIR FOR COMMAND: ', this.config.commandsDirectory);
  }

  protected stopCallback(): void {
    // throw new Error('Method not implemented.');
    Logger.info('Command stopped');
  }

  // /**
  //  * Run command
  //  */
  // public async runCommand({ command }: { command: string }): Promise<void> {
  //   const startInstanceOptions: ApplicationStartInstanceOptions = {
  //     onStarted: ({ startupTime }) => {
  //       Logger.info('Command started', {
  //         Name: this.config.name,
  //         'PXL Framework Version': this.applicationVersion,
  //         'Startup Time': Time.formatTime({ time: startupTime, format: 's', numDecimals: 2, showUnit: true }),
  //       });
  //     },
  //   };

  //   const stopInstanceOptions: ApplicationStopInstanceOptions = {
  //     onStopped: ({ runtime }) => {
  //       Logger.info('Command stopped', {
  //         Name: this.config.name,
  //         'Runtime': Time.formatTime({ time: runtime, format: 's', numDecimals: 2, showUnit: true }),
  //       });
  //     },
  //   };

  //   // Start standalone application
  //   await this.startInstance(startInstanceOptions);

  //   // Handle standalone application shutdown
  //   this.handleShutdown({ onStopped: stopInstanceOptions.onStopped });
  // }
}
