import { existsSync } from 'fs';
import DatabaseInstance from '../database/instance.js';
import { Logger } from '../logger/index.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import BaseApplication from './base-application.js';
import { CommandApplicationConfig } from './command-application.interface.js';
import { Loader } from '../util/index.js';

export default class CommandApplication extends BaseApplication {
  /** Command application config */
  protected config: CommandApplicationConfig;

  constructor(config: CommandApplicationConfig) {
    super(config);

    this.config = config;
  }

  protected async startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager; }): Promise<void> {
    // get argv (yargs) input args
    const argv = this.config.commandManager.argv;

    const parsedArgv = argv.parseSync();
    console.log('parsedArgv', parsedArgv);

    if (parsedArgv._.length === 0) {
      Logger.warn('No command provided');

      this.stopCommand();

      return;
    }

    const inputCommandName = parsedArgv._[0];

    console.log('inputCommandName', inputCommandName);


    const commandsDirectoryExists = await existsSync(this.config.commandsDirectory);

    if (!commandsDirectoryExists) {
      Logger.warn('Commands directory not found', { Directory: this.config.commandsDirectory });

      return;
    }

    // Load commands
    const commands = await Loader.loadModulesInDirectory({
      directory: this.config.commandsDirectory,
      extensions: ['.ts'],
    });

    // Find command by name
    const CommandClass = commands[inputCommandName];

    if (!CommandClass) {
      Logger.warn('Command not found', { Command: inputCommandName });

      return;
    }

    // Execute command
    const command = new CommandClass();

    await command.run(parsedArgv);

    // Call shutdown signtal to stop the command
    this.stopCommand();
  }

  private stopCommand(): void {
    process.kill(process.pid, 'SIGINT');
  }

  protected stopCallback(): void {
    // throw new Error('Method not implemented.');
    Logger.info('Command stopped');
  }
}
